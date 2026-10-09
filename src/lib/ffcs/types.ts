export type FFCSCourse = {
  code: string;
  name: string;
  faculty: string | null;
  slots: string[];
  venue: string | null;
};

export type FFCSHeatmapCell = {
  day: number;
  column: number;
  value: string;
};

export type FFCSClass = {
  slot: string;
  weekday: number;
  start_time: string;
  end_time: string;
  room: string | null;
};

export type ParsedFFCSCourse = {
  code: string;
  name: string;
  faculty: string | null;
  classes: FFCSClass[];
};