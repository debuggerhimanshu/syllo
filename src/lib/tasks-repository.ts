
import * as Crypto from "expo-crypto";
import {
  getDatabase,
  withSerializedTransaction,
} from "@/lib/database";
import { scheduleTaskReminder } from "@/lib/notifications";

// =========================================
// TYPES
// =========================================

export type TaskCategory = "academic" | "personal";

export type TaskStatus =
  | "todo"
  | "in_progress"
  | "completed";

export type TaskPriority = "low" | "medium" | "high";

export type TaskEnergy = "deep_focus" | "medium" | "low";

export type Task = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: TaskCategory;
  task_type: string;
  course_id: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  priority_mode: "manual" | "automatic";
  energy_level: TaskEnergy;
  due_at: string | null;
  reminder_at: string | null;
  reminder_enabled: number;
  estimated_minutes: number;
  postponed_count: number;
  postpone_reason: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  sync_status: string;
};

export type CreateTaskInput = {
  title: string;
  description?: string;
  category: TaskCategory;
  task_type?: string;
  course_id?: string | null;
  priority?: TaskPriority;
  priority_mode?: "manual" | "automatic";
  energy_level?: TaskEnergy;
  due_at?: string | null;
  reminder_at?: string | null;
  reminder_enabled?: boolean;
  estimated_minutes?: number;
};

export type TaskSyncOperation = {
  id: number;
  entity_type: string;
  entity_id: string;
  operation: "insert" | "update" | "delete";
  payload: string | null;
  retry_count: number;
};

// =========================================
// SYNC QUEUE HELPERS
// =========================================

async function queueTaskChange(
  db: Awaited<ReturnType<typeof getDatabase>>,
  taskId: string,
  operation: "insert" | "update" | "delete",
  payload: string
) {
  await db.runAsync(
    `INSERT INTO sync_queue (
      entity_type,
      entity_id,
      operation,
      payload,
      created_at
    ) VALUES (?, ?, ?, ?, ?)`,
    "task",
    taskId,
    operation,
    payload,
    new Date().toISOString()
  );
}

async function getTaskQueueEntries(
  db: Awaited<ReturnType<typeof getDatabase>>,
  taskId: string
) {
  return db.getAllAsync<{
    id: number;
    operation: string;
  }>(
    `SELECT id, operation
     FROM sync_queue
     WHERE entity_type = 'task'
       AND entity_id = ?
     ORDER BY id ASC`,
    taskId
  );
}

async function removeTaskQueueEntries(
  db: Awaited<ReturnType<typeof getDatabase>>,
  taskId: string
) {
  await db.runAsync(
    `DELETE FROM sync_queue
     WHERE entity_type = 'task'
       AND entity_id = ?`,
    taskId
  );
}

// =========================================
// CREATE TASK
// =========================================

export async function createLocalTask(
  userId: string,
  input: CreateTaskInput
): Promise<Task> {
  const now = new Date().toISOString();

  const task: Task = {
    id: Crypto.randomUUID(),
    user_id: userId,
    title: input.title.trim(),
    description: input.description ?? "",
    category: input.category,
    task_type: input.task_type ?? "other",
    course_id: input.course_id ?? null,
    status: "todo",
    priority: input.priority ?? "medium",
    priority_mode: input.priority_mode ?? "manual",
    energy_level: input.energy_level ?? "medium",
    due_at: input.due_at ?? null,
    reminder_at: input.reminder_at ?? null,
    reminder_enabled: input.reminder_enabled ? 1 : 0,
    estimated_minutes: input.estimated_minutes ?? 30,
    postponed_count: 0,
    postpone_reason: null,
    created_at: now,
    updated_at: now,
    completed_at: null,
    sync_status: "pending",
  };

  await withSerializedTransaction(async () => {
    const db = await getDatabase();

    await db.runAsync(
      `INSERT INTO tasks (
        id, user_id, title, description, category, task_type,
        course_id, status, priority, priority_mode, energy_level,
        due_at, reminder_at, reminder_enabled, estimated_minutes,
        postponed_count, postpone_reason, created_at, updated_at,
        completed_at, sync_status
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )`,
      task.id,
      task.user_id,
      task.title,
      task.description,
      task.category,
      task.task_type,
      task.course_id,
      task.status,
      task.priority,
      task.priority_mode,
      task.energy_level,
      task.due_at,
      task.reminder_at,
      task.reminder_enabled,
      task.estimated_minutes,
      task.postponed_count,
      task.postpone_reason,
      task.created_at,
      task.updated_at,
      task.completed_at,
      task.sync_status
    );

    await queueTaskChange(
      db,
      task.id,
      "insert",
      JSON.stringify(task)
    );
  });

  return task;
}

// =========================================
// GET LOCAL TASKS
// =========================================

export async function getLocalTasks(
  userId: string
): Promise<Task[]> {
  const db = await getDatabase();

  return db.getAllAsync<Task>(
    `SELECT * FROM tasks
     WHERE user_id = ?
     ORDER BY
       CASE WHEN status = 'completed' THEN 1 ELSE 0 END,
       CASE WHEN due_at IS NULL THEN 1 ELSE 0 END,
       due_at ASC,
       created_at DESC`,
    userId
  );
}

// =========================================
// UPDATE TASK
// =========================================

export async function updateLocalTask(
  userId: string,
  taskId: string,
  changes: Partial<CreateTaskInput> & {
    status?: TaskStatus;
    postponed_count?: number;
    postpone_reason?: string | null;
    completed_at?: string | null;
  }
): Promise<void> {
  await withSerializedTransaction(async () => {
    const db = await getDatabase();

    const existing = await db.getFirstAsync<Task>(
      `SELECT * FROM tasks
       WHERE id = ? AND user_id = ?`,
      taskId,
      userId
    );

    if (!existing) {
      throw new Error("Task not found.");
    }

    const updated: Task = {
      ...existing,
      ...changes,
      reminder_enabled:
        changes.reminder_enabled === undefined
          ? existing.reminder_enabled
          : changes.reminder_enabled
            ? 1
            : 0,
      updated_at: new Date().toISOString(),
      sync_status: "pending",
    };

    if (updated.status === "completed" && !updated.completed_at) {
      updated.completed_at = updated.updated_at;
    }

    if (updated.status !== "completed") {
      updated.completed_at = null;
    }

    await db.runAsync(
      `UPDATE tasks SET
        title = ?,
        description = ?,
        category = ?,
        task_type = ?,
        course_id = ?,
        status = ?,
        priority = ?,
        priority_mode = ?,
        energy_level = ?,
        due_at = ?,
        reminder_at = ?,
        reminder_enabled = ?,
        estimated_minutes = ?,
        postponed_count = ?,
        postpone_reason = ?,
        updated_at = ?,
        completed_at = ?,
        sync_status = ?
       WHERE id = ? AND user_id = ?`,
      updated.title,
      updated.description,
      updated.category,
      updated.task_type,
      updated.course_id,
      updated.status,
      updated.priority,
      updated.priority_mode,
      updated.energy_level,
      updated.due_at,
      updated.reminder_at,
      updated.reminder_enabled,
      updated.estimated_minutes,
      updated.postponed_count,
      updated.postpone_reason,
      updated.updated_at,
      updated.completed_at,
      updated.sync_status,
      taskId,
      userId
    );

    const queueEntries = await getTaskQueueEntries(db, taskId);

    const hasPendingInsert = queueEntries.some(
      (entry) => entry.operation === "insert"
    );

    const hasPendingDelete = queueEntries.some(
      (entry) => entry.operation === "delete"
    );

    await removeTaskQueueEntries(db, taskId);

    // Preserve insert when a newly created task is edited offline.
    // Otherwise, queue an update for an existing remote task.
    await queueTaskChange(
      db,
      taskId,
      hasPendingInsert || hasPendingDelete ? "insert" : "update",
      JSON.stringify(updated)
    );
  });
}

// =========================================
// POSTPONE TASK
// =========================================

export async function postponeLocalTask(
  userId: string,
  taskId: string,
  reason: string | null,
  newDueAt?: string | null
): Promise<void> {
  const db = await getDatabase();

  const existing = await db.getFirstAsync<Task>(
    `SELECT * FROM tasks WHERE id = ? AND user_id = ?`,
    taskId,
    userId
  );

  if (!existing) {
    throw new Error("Task not found.");
  }

  await updateLocalTask(userId, taskId, {
    postponed_count: existing.postponed_count + 1,
    postpone_reason: reason,
    ...(newDueAt !== undefined ? { due_at: newDueAt } : {}),
  });
}

// =========================================
// DELETE TASK
// =========================================

export async function deleteLocalTask(
  userId: string,
  taskId: string
): Promise<void> {
  await withSerializedTransaction(async () => {
    const db = await getDatabase();

    const existing = await db.getFirstAsync<Task>(
      `SELECT * FROM tasks
       WHERE id = ? AND user_id = ?`,
      taskId,
      userId
    );

    if (!existing) return;

    const queueEntries = await getTaskQueueEntries(db, taskId);

    const hasPendingInsert = queueEntries.some(
      (entry) => entry.operation === "insert"
    );

    await db.runAsync(
      `DELETE FROM tasks
       WHERE id = ? AND user_id = ?`,
      taskId,
      userId
    );

    await removeTaskQueueEntries(db, taskId);

    // A task that was never uploaded does not need a remote delete.
    if (hasPendingInsert) return;

    // Preserve the original task data for safe remote deletion.
    await queueTaskChange(
      db,
      taskId,
      "delete",
      JSON.stringify(existing)
    );
  });
}

// =========================================
// GET PENDING TASK SYNC OPERATIONS
// =========================================

export async function getPendingTaskSyncOperations():
Promise<TaskSyncOperation[]> {
  const db = await getDatabase();

  return db.getAllAsync<TaskSyncOperation>(
    `SELECT
       id,
       entity_type,
       entity_id,
       operation,
       payload,
       retry_count
     FROM sync_queue
     WHERE entity_type = 'task'
     ORDER BY id ASC`
  );
}

// =========================================
// MARK TASK SYNC COMPLETE
// =========================================


export async function markTaskSyncComplete(
  operationId: number,
  taskId: string,
  operation: "insert" | "update" | "delete"
): Promise<void> {
  await withSerializedTransaction(async () => {
    const db = await getDatabase();

    await db.runAsync(
      `DELETE FROM sync_queue WHERE id = ?`,
      operationId
    );

    if (operation === "delete") return;

    const pending = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM sync_queue
       WHERE entity_type = 'task'
         AND entity_id = ?`,
      taskId
    );

    // Only mark synced when no newer operation remains.
    if (pending?.count === 0) {
      await db.runAsync(
        `UPDATE tasks
         SET sync_status = 'synced'
         WHERE id = ?`,
        taskId
      );
    }
  });
}


// =========================================
// MARK TASK SYNC FAILED
// =========================================

export async function markTaskSyncFailed(
  operationId: number,
  error: string
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE sync_queue
     SET retry_count = retry_count + 1,
         last_error = ?
     WHERE id = ?`,
    error,
    operationId
  );
}
