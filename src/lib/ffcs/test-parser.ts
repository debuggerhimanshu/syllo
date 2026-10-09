import {
  buildParsedCourses,
} from "./parser";

import type {
  FFCSCourse,
  FFCSHeatmapCell,
} from "./types";

const testCourses: FFCSCourse[] = [
  {
    code: "CSE2004",
    name: "Theory Of Computation And Compiler Design",
    faculty: "PARAS JAIN",
    slots: ["C14", "E11", "E12"],
    venue: "AB02-306",
  },

  {
    code: "CSE3001",
    name: "Database Management Systems",
    faculty: "RIZWAN UR RAHMAN",
    slots: ["A21", "A22", "A23"],
    venue: "AB02-316",
  },
];

const testHeatmapCells: FFCSHeatmapCell[] = [
  // CSE2004
  {
    day: 2,
    column: 1,
    value: "E11-CSE2004-LT-AB02-306-ALL",
  },

  {
    day: 4,
    column: 1,
    value: "E12-CSE2004-LT-AB02-306-ALL",
  },

  {
    day: 5,
    column: 5,
    value: "C14-CSE2004-LT-AB02-306-ALL",
  },

  // CSE3001
  {
    day: 1,
    column: 4,
    value: "A21-CSE3001-LTP-AB02-316-ALL",
  },

  {
    day: 3,
    column: 4,
    value: "A22-CSE3001-LTP-AB02-316-ALL",
  },

  {
    day: 5,
    column: 4,
    value: "A23-CSE3001-LTP-AB02-316-ALL",
  },
];

const result = buildParsedCourses(
  testCourses,
  testHeatmapCells
);

console.log(
  JSON.stringify(result, null, 2)
);