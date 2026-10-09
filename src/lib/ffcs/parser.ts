import {
  FFCS_DAYS,
  FFCS_TIME_SLOTS,
} from "./constants";

import type {
  FFCSCourse,
  FFCSHeatmapCell,
  ParsedFFCSCourse,
} from "./types";

/**
 * Extract the course code from a heatmap cell.
 *
 * Example:
 *
 * A21-CSE3001-LTP-AB02-316-ALL
 *
 * returns:
 *
 * CSE3001
 */
export function extractCourseCode(
  cellValue: string
): string | null {
  const match = cellValue.match(
    /(?:^|-)([A-Z]{2,4}\d{4})(?:-|$)/
  );

  return match ? match[1] : null;
}

/**
 * Extract the FFCS slot from a heatmap cell.
 *
 * Example:
 *
 * A21-CSE3001-LTP-AB02-316-ALL
 *
 * returns:
 *
 * A21
 */
export function extractSlot(
  cellValue: string
): string | null {
  const match = cellValue.match(
    /^([A-Z]\d{2})-/
  );

  return match ? match[1] : null;
}

/**
 * Determine whether a heatmap cell
 * contains an actual class.
 */
export function isClassCell(
  value: string
): boolean {
  return (
    extractCourseCode(value) !== null &&
    extractSlot(value) !== null
  );
}

/**
 * Parse one heatmap cell.
 */
export function parseHeatmapCell(
  cell: FFCSHeatmapCell
) {
  if (!isClassCell(cell.value)) {
    return null;
  }

  const slot = extractSlot(cell.value);
  const courseCode = extractCourseCode(
    cell.value
  );

  if (!slot || !courseCode) {
    return null;
  }

  const timeSlot =
  FFCS_TIME_SLOTS.find(
    (slot) => slot.column === cell.column
  );

  if (!timeSlot) {
    return null;
  }

  return {
    courseCode,
    slot,
    weekday: cell.day,
    start_time: timeSlot.start_time,
    end_time: timeSlot.end_time,
  };
}

/**
 * Convert the student's VTOP course data
 * + heatmap cells into final structured courses.
 */
export function buildParsedCourses(
  courses: FFCSCourse[],
  heatmapCells: FFCSHeatmapCell[]
): ParsedFFCSCourse[] {
  return courses.map((course) => {
    const courseClasses = heatmapCells
      .map(parseHeatmapCell)
      .filter(Boolean)
      .filter(
        (item) =>
          item!.courseCode === course.code &&
          course.slots.includes(item!.slot)
      )
      .map((item) => ({
        slot: item!.slot,
        weekday: item!.weekday,
        start_time: item!.start_time,
        end_time: item!.end_time,
        room: course.venue,
      }));

    return {
      code: course.code,
      name: course.name,
      faculty: course.faculty,
      classes: courseClasses,
    };
  });
}