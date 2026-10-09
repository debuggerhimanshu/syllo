
import type {
  FFCSCourse,
  FFCSHeatmapCell,
} from "./types";

export type FFCSOCRBlock = {
  text: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

type OCRLine = {
  text: string;
  x: number;
  y: number;
  centerX: number;
};

type CourseRow = {
  code: string;
  name: string;
  y: number;
};

export type FFCSExtractionResult = {
  courses: FFCSCourse[];
  heatmapCells: FFCSHeatmapCell[];
  warnings: string[];
};

// Approximate horizontal centers of the timetable columns.
// Column 3 is Lunch and is intentionally excluded.
const HEATMAP_COLUMNS = [
  { column: 0, x: 662 },
  { column: 1, x: 944 },
  { column: 2, x: 1204 },
  { column: 4, x: 1703 },
  { column: 5, x: 1986 },
  { column: 6, x: 2276 },
  { column: 7, x: 2579 },
] as const;

// Approximate vertical centers of the weekday rows.
const HEATMAP_DAY_Y = [1025, 1058, 1091, 1124, 1157, 1190];

const SCHOOL_SUFFIXES = new Set([
  "SCAL",
  "SCAI",
  "SCOPE",
  "SASL",
  "ACAD",
]);

/**
 * Split OCR blocks into lines and estimate each line's vertical position.
 * Multi-line blocks retain their original horizontal position.
 */
function splitOCRBlock(block: FFCSOCRBlock): OCRLine[] {
  const lines = block.text
    .split(/\r?\n/)
    .map((text) => text.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const { x, y, width, height } = block.boundingBox;
  const centerX = x + width / 2;

  if (lines.length === 1) {
    return [{
      text: lines[0],
      x,
      y: y + height / 2,
      centerX,
    }];
  }

  const estimatedLineHeight = Math.min(12, height / lines.length);
  const step = (height - estimatedLineHeight) / (lines.length - 1);

  return lines.map((text, index) => ({
    text,
    x,
    y: y + estimatedLineHeight / 2 + index * step,
    centerX,
  }));
}

function getAllLines(blocks: FFCSOCRBlock[]): OCRLine[] {
  return blocks.flatMap(splitOCRBlock);
}

/**
 * Normalize common OCR errors in room codes.
 * Examples:
 * ABO2-423 -> AB02-423
 * AB-228   -> AB-228
 */
function normalizeRoom(value: string): string {
  return value
    .toUpperCase()
    .replace(/\bABO(?=\d)/g, "AB0")
    .replace(/\s+/g, "")
    .replace(/[.,]+$/, "");
}

function extractRoom(text: string): string | null {
  const match = text.match(
    /\b(?:AB[O0]?\d{1,2}-\d{3}|AB-\d{3}|AR-\d{3})\b/i,
  );

  return match ? normalizeRoom(match[0]) : null;
}

function extractRegisteredSlots(text: string): string[] {
  return [
    ...new Set(
      [...text.toUpperCase().matchAll(/\b([A-F]\d{2})\b/g)]
        .map((match) => match[1]),
    ),
  ];
}

/**
 * Find the closest course row to a given vertical position.
 * Used to prevent metadata from being assigned to adjacent courses.
 */
function nearestCourseRowIndex(
  y: number,
  courseRows: CourseRow[],
): number {
  let nearestIndex = -1;
  let nearestDistance = Infinity;

  courseRows.forEach((row, index) => {
    const distance = Math.abs(y - row.y);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

function getNearestColumn(centerX: number): number | null {
  let bestColumn: number | null = null;
  let bestDistance = Infinity;

  for (const item of HEATMAP_COLUMNS) {
    const distance = Math.abs(centerX - item.x);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestColumn = item.column;
    }
  }

  return bestDistance <= 145 ? bestColumn : null;
}

function getNearestDay(y: number): number | null {
  let bestIndex = -1;
  let bestDistance = Infinity;

  HEATMAP_DAY_Y.forEach((dayY, index) => {
    const distance = Math.abs(y - dayY);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  if (bestIndex === -1 || bestDistance > 19) {
    return null;
  }

  // Monday = 1, Tuesday = 2, ..., Saturday = 6.
  return bestIndex + 1;
}

/**
 * Detect course-name rows from the registration table.
 */
function extractCourseRows(lines: OCRLine[]): CourseRow[] {
  const rows: CourseRow[] = [];

  for (const line of lines) {
    // The course-name column is on the left side of the screenshot.
    if (line.x >= 750 || line.y >= 900) continue;

    const match = line.text.match(
      /\b([A-Z]{2,4}\d{4})\s*[-–]\s*(.+)/i,
    );

    if (!match) continue;

    const code = match[1].toUpperCase();

    const name = match[2]
      .split(/[|(]/)[0]
      .replace(/\s+/g, " ")
      .replace(/[\s,;:-]+$/, "")
      .trim();

    if (!name) continue;

    // Prevent duplicate rows if OCR returns the same course more than once.
    if (rows.some((row) => row.code === code)) continue;

    rows.push({
      code,
      name,
      y: line.y,
    });
  }

  return rows.sort((a, b) => a.y - b.y);
}

/**
 * Collect table metadata belonging to one course row.
 */
function getCourseTableLines(
  lines: OCRLine[],
  courseRows: CourseRow[],
  rowIndex: number,
): OCRLine[] {
  const row = courseRows[rowIndex];

  return lines.filter(
    (line) =>
      line.centerX >= 1200 &&
      line.centerX <= 1450 &&
      Math.abs(line.y - row.y) <= 65 &&
      nearestCourseRowIndex(line.y, courseRows) === rowIndex,
  );
}

function extractFaculty(
  lines: OCRLine[],
  courseRows: CourseRow[],
  rowIndex: number,
): string | null {
  const row = courseRows[rowIndex];

  const facultyLines = lines
    .filter(
      (line) =>
        line.centerX >= 1450 &&
        line.centerX <= 1800 &&
        Math.abs(line.y - row.y) <= 65 &&
        nearestCourseRowIndex(line.y, courseRows) === rowIndex,
    )
    .sort((a, b) => a.y - b.y)
    .map((line) => line.text.trim())
    .filter(
      (text) =>
        !SCHOOL_SUFFIXES.has(
          text.replace(/[-\s]/g, "").toUpperCase(),
        ),
    );

  const faculty = facultyLines
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, " ")
    .trim();

  return faculty || null;
}

/**
 * Extract registered courses and timetable cells from OCR blocks.
 * Pass result.blocks from expo-ocr-kit, not result.text.
 */
export function extractFFCSFromOCRBlocks(
  blocks: FFCSOCRBlock[],
): FFCSExtractionResult {
  const warnings: string[] = [];
  const lines = getAllLines(blocks);

  const courseRows = extractCourseRows(lines);

  if (courseRows.length === 0) {
    return {
      courses: [],
      heatmapCells: [],
      warnings: [
        "No course rows were detected. Check that the full VTOP registration table is visible.",
      ],
    };
  }

  // 1. Extract the student's registered courses and their metadata.
  const courses: FFCSCourse[] = courseRows.map((row, rowIndex) => {
    const tableLines = getCourseTableLines(
      lines,
      courseRows,
      rowIndex,
    );

    const slots = [
      ...new Set(
        tableLines.flatMap((line) =>
          extractRegisteredSlots(line.text),
        ),
      ),
    ];

    const venue =
      tableLines
        .map((line) => extractRoom(line.text))
        .find((room): room is string => room !== null) ?? null;

    if (slots.length === 0) {
      warnings.push(
        `${row.code}: no registered slots detected; review this course.`,
      );
    }

    if (!venue && slots.length > 0) {
      warnings.push(
        `${row.code}: venue not detected; review the room.`,
      );
    }

    return {
      code: row.code,
      name: row.name,
      faculty: extractFaculty(lines, courseRows, rowIndex),
      slots,
      venue,
    };
  });

  const coursesByCode = new Map(
    courses.map((course) => [course.code, course]),
  );

  // 2. Extract scheduled classes from the heatmap.
  const heatmapCells: FFCSHeatmapCell[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    const { x, y, width } = block.boundingBox;

    // The heatmap appears below the registration table.
    if (y < 980) continue;

    const column = getNearestColumn(x + width / 2);
    if (column === null) continue;

    for (const line of splitOCRBlock(block)) {
      const matches = [
        ...line.text.matchAll(
          /\b([A-F]\d{2})\s*-\s*([A-Z]{2,4}\d{4})\s*-/gi,
        ),
      ];

      if (matches.length === 0) continue;

      const weekday = getNearestDay(line.y);

      if (weekday === null) {
        warnings.push(
          `Could not determine the weekday for: ${line.text}`,
        );
        continue;
      }

      for (const match of matches) {
        const slot = match[1].toUpperCase();
        const courseCode = match[2].toUpperCase();
        const course = coursesByCode.get(courseCode);

        if (!course) {
          warnings.push(
            `Heatmap entry ${slot}-${courseCode} has no matching course row.`,
          );
          continue;
        }

        if (!course.slots.includes(slot)) {
          warnings.push(
            `${courseCode}: heatmap slot ${slot} does not match the registered slots.`,
          );
          continue;
        }

        const key = `${weekday}:${column}:${slot}:${courseCode}`;

        if (seen.has(key)) continue;
        seen.add(key);

        heatmapCells.push({
          day: weekday,
          column,
          value: line.text.trim().toUpperCase(),
        });
      }
    }
  }

  if (heatmapCells.length === 0) {
    warnings.push(
      "No valid heatmap classes were detected. Check the screenshot crop and OCR coordinates.",
    );
  }

  return {
    courses,
    heatmapCells,
    warnings: [...new Set(warnings)],
  };
}
