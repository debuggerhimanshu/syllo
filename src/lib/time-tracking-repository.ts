
import * as Crypto from "expo-crypto";
import {
  getDatabase,
  withSerializedTransaction,
} from "@/lib/database";


// =========================================
// TYPES
// =========================================

export type TaskTimeSession = {
  id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  created_at: string;
  updated_at: string;
  sync_status: string;
};

// =========================================
// START SESSION
// =========================================

export async function startTaskSession(
  userId: string,
  taskId: string
): Promise<TaskTimeSession> {
  return withSerializedTransaction(async () => {
    const db = await getDatabase();

    const task = await db.getFirstAsync<{ id: string; status: string }>(
      `SELECT id, status FROM tasks
       WHERE id = ? AND user_id = ?`,
      taskId,
      userId
    );

    if (!task) {
      throw new Error("Task not found.");
    }

    if (task.status === "completed") {
      throw new Error("Cannot start a session for a completed task.");
    }

    const activeSession = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM task_time_sessions
       WHERE user_id = ? AND ended_at IS NULL`,
      userId
    );

    if (activeSession) {
      throw new Error("Another focus session is already running.");
    }

    const now = new Date().toISOString();

    const session: TaskTimeSession = {
      id: Crypto.randomUUID(),
      task_id: taskId,
      user_id: userId,
      started_at: now,
      ended_at: null,
      duration_seconds: 0,
      created_at: now,
      updated_at: now,
      sync_status: "pending",
    };

    await db.runAsync(
      `INSERT INTO task_time_sessions (
        id, task_id, user_id, started_at, ended_at,
        duration_seconds, created_at, updated_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      session.id,
      session.task_id,
      session.user_id,
      session.started_at,
      session.ended_at,
      session.duration_seconds,
      session.created_at,
      session.updated_at,
      session.sync_status
    );

    return session;
  });
}

// =========================================
// PAUSE SESSION
// =========================================

export async function pauseTaskSession(
  userId: string,
  taskId: string
): Promise<void> {
  await withSerializedTransaction(async () => {
    const db = await getDatabase();

    const session = await db.getFirstAsync<TaskTimeSession>(
      `SELECT * FROM task_time_sessions
       WHERE task_id = ?
       AND user_id = ?
       AND ended_at IS NULL`,
      taskId,
      userId
    );

    if (!session) {
      throw new Error("No active session found.");
    }

    const endedAt = new Date();
    const startedAt = new Date(session.started_at);

    const elapsedSeconds = Math.max(
      0,
      Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)
    );

    await db.runAsync(
      `UPDATE task_time_sessions
       SET ended_at = ?,
           duration_seconds = ?,
           updated_at = ?,
           sync_status = 'pending'
       WHERE id = ? AND user_id = ?`,
      endedAt.toISOString(),
      elapsedSeconds,
      endedAt.toISOString(),
      session.id,
      userId
    );
  });
}

// =========================================
// RESUME SESSION
// =========================================

export async function resumeTaskSession(
  userId: string,
  taskId: string
): Promise<TaskTimeSession> {
  // Resuming creates a new session.
  // Previous completed sessions remain unchanged.
  return startTaskSession(userId, taskId);
}

// =========================================
// GET ACTIVE SESSION
// =========================================

export async function getActiveTaskSession(
  userId: string
): Promise<TaskTimeSession | null> {
  const db = await getDatabase();

  return db.getFirstAsync<TaskTimeSession>(
    `SELECT * FROM task_time_sessions
     WHERE user_id = ?
     AND ended_at IS NULL
     ORDER BY started_at DESC
     LIMIT 1`,
    userId
  );
}

// =========================================
// GET TASK SESSIONS
// =========================================

export async function getTaskSessions(
  userId: string,
  taskId: string
): Promise<TaskTimeSession[]> {
  const db = await getDatabase();

  return db.getAllAsync<TaskTimeSession>(
    `SELECT * FROM task_time_sessions
     WHERE user_id = ? AND task_id = ?
     ORDER BY started_at DESC`,
    userId,
    taskId
  );
}

// =========================================
// GET ACTUAL TASK DURATION
// =========================================

export async function getTaskActualDuration(
  userId: string,
  taskId: string
): Promise<number> {
  const db = await getDatabase();

  const result = await db.getFirstAsync<{ total: number | null }>(
    `SELECT COALESCE(SUM(
      duration_seconds +
      CASE
        WHEN ended_at IS NULL
        THEN MAX(0, CAST(
          (julianday('now') - julianday(started_at)) * 86400
          AS INTEGER
        ))
        ELSE 0
      END
    ), 0) AS total
    FROM task_time_sessions
    WHERE user_id = ? AND task_id = ?`,
    userId,
    taskId
  );

  return result?.total ?? 0;
}
