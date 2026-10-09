import type {
  FFCSCourse,
  FFCSHeatmapCell,
} from "./types";

type ExtractedVTOPData = {
  courses: FFCSCourse[];
  heatmapCells: FFCSHeatmapCell[];
};

const COURSE_CODE_REGEX =
  /\b[A-Z]{2,4}\d{4}\b/;

const ROOM_REGEX =
  /\b[A-Z]{1,4}\d{0,2}-[A-Z0-9-]+\b/;

const SLOT_REGEX =
  /\b[A-Z]\d{2}\b/g;

const HEATMAP_CELL_REGEX =
  /^([A-Z]\d{2})-([A-Z]{2,4}\d{4})-[A-Z]+-(.+?)(?:-ALL)?$/;

function cleanText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

export function extractCourseCode(
  value: string
): string | null {
  const match = value.match(COURSE_CODE_REGEX);

  return match ? match[0] : null;
}

export function extractCourseName(
  value: string
): string | null {
  const code = extractCourseCode(value);

  if (!code) {
    return null;
  }

  const name = value
    .replace(code, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[-–—:\s]+/, "")
    .trim();

  return name || null;
}

export function extractRegisteredSlots(
  value: string
): string[] {
  const matches = value.match(SLOT_REGEX);

  return matches ?? [];
}

export function extractRoom(
  value: string
): string | null {
  const match = value.match(ROOM_REGEX);

  return match ? match[0] : null;
}

export function extractFaculty(
  value: string
): string | null {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return null;
  }

  const faculty = cleaned
    .split(" - ")[0]
    .trim();

  return faculty || null;
}

export function parseHeatmapValue(
  value: string
): {
  slot: string;
  courseCode: string;
  room: string | null;
} | null {
  const cleaned = cleanText(value);

  if (
    !cleaned ||
    cleaned.toLowerCase() === "lunch"
  ) {
    return null;
  }

  const match =
    cleaned.match(HEATMAP_CELL_REGEX);

  if (!match) {
    return null;
  }

  const [, slot, courseCode, roomPart] =
    match;

  return {
    slot,
    courseCode,
    room: roomPart || null,
  };
}

export function buildExtractedVTOPData(
  courses: FFCSCourse[],
  heatmapCells: FFCSHeatmapCell[]
): ExtractedVTOPData {
  return {
    courses,
    heatmapCells,
  };
}