export type FFTimeslot = {
  column: number;
  start_time: string;
  end_time: string;
};

export const FFCS_TIME_SLOTS: FFTimeslot[] = [
  {
    column: 0,
    start_time: "08:30",
    end_time: "10:00",
  },
  {
    column: 1,
    start_time: "10:05",
    end_time: "11:35",
  },
  {
    column: 2,
    start_time: "11:40",
    end_time: "13:10",
  },
  {
    column: 4,
    start_time: "13:15",
    end_time: "14:45",
  },
  {
    column: 5,
    start_time: "14:50",
    end_time: "16:20",
  },
  {
    column: 6,
    start_time: "16:25",
    end_time: "17:55",
  },
  {
    column: 7,
    start_time: "18:00",
    end_time: "19:30",
  },
];

export const FFCS_DAYS = {
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
} as const;