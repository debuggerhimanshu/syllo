
import type { TaskCategory, TaskPriority } from "./tasks-repository";

export type PriorityResult = {
  priority: TaskPriority;
  score: number;
  reason: string;
};

type PriorityInput = {
  category: TaskCategory;
  due_at: string | null;
  estimated_minutes: number;
};

export function calculateTaskPriority(
  task: PriorityInput,
  now: Date = new Date()
): PriorityResult {
  let score = 0;
  const reasons: string[] = [];

  // 1. Deadline urgency
  if (task.due_at) {
    const deadline = new Date(task.due_at);

    if (!Number.isNaN(deadline.getTime())) {
      const hoursRemaining =
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursRemaining < 0) {
        score += 50;
        reasons.push("Deadline has passed");
      } else if (hoursRemaining <= 24) {
        score += 45;
        reasons.push("Due within 24 hours");
      } else if (hoursRemaining <= 72) {
        score += 35;
        reasons.push("Due within 3 days");
      } else if (hoursRemaining <= 168) {
        score += 25;
        reasons.push("Due within 7 days");
      } else if (hoursRemaining <= 336) {
        score += 15;
        reasons.push("Due within 14 days");
      }
    }
  }

  // 2. Estimated effort
  if (task.estimated_minutes >= 180) {
    score += 15;
    reasons.push("Requires substantial effort");
  } else if (task.estimated_minutes >= 90) {
    score += 10;
    reasons.push("Requires significant effort");
  } else if (task.estimated_minutes >= 45) {
    score += 5;
    reasons.push("Requires moderate effort");
  }

  // 3. Academic importance
  if (task.category === "academic") {
    score += 10;
    reasons.push("Academic task");
  }

  score = Math.min(score, 100);

  const priority: TaskPriority =
    score >= 55 ? "high" :
    score >= 25 ? "medium" :
    "low";

  return {
    priority,
    score,
    reason: reasons.length > 0
      ? reasons.join(" · ")
      : "No immediate urgency",
  };
}
