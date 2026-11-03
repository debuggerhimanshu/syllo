
import * as Crypto from "expo-crypto";
import {
  getDatabase,
  withSerializedTransaction,
} from "@/lib/database";

export type LocalCourse = {
  id: string;
  user_id: string;
  name: string;
  code: string | null;
  faculty: string | null;
  color: string | null;
};

export type LocalClass = {
  id: string;
  course_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  room: string | null;
  slot: string | null;
  valid_from: string | null;
  valid_until: string | null;
};

export type ScheduleItem = LocalClass & {
  course: LocalCourse | null;
};

type SyncOperation = "insert" | "update" | "delete";
type SyncEntity = "course" | "class";

type PendingSyncOperation = {
  id: number;
  entity_type: SyncEntity;
  entity_id: string;
  operation: SyncOperation;
  payload: string | null;
  created_at: string;
  retry_count: number;
  last_error: string | null;
};

export function generateLocalId(): string {
  return Crypto.randomUUID();
}

// Must be called inside a database transaction.
async function addSyncOperation(
  db: Awaited<ReturnType<typeof getDatabase>>,
  entityType: SyncEntity,
  entityId: string,
  operation: SyncOperation,
  payload?: object,
) {
  const existing = await db.getFirstAsync<{
    id: number;
    operation: SyncOperation;
  }>(
    `SELECT id, operation
     FROM sync_queue
     WHERE entity_type = ? AND entity_id = ?
     LIMIT 1`,
    entityType,
    entityId,
  );

  let finalOperation = operation;

  if (existing) {
    // An item created offline and then deleted never needs to reach Supabase.
    if (existing.operation === "insert" && operation === "delete") {
      await db.runAsync(
        `DELETE FROM sync_queue
         WHERE entity_type = ? AND entity_id = ?`,
        entityType,
        entityId,
      );
      return;
    }

    // An offline insert followed by an edit is still an insert.
    if (existing.operation === "insert" && operation === "update") {
      finalOperation = "insert";
    }

    // A deleted item restored locally must be inserted again.
    if (existing.operation === "delete" && operation !== "delete") {
      finalOperation = "insert";
    }

    await db.runAsync(
      `DELETE FROM sync_queue
       WHERE entity_type = ? AND entity_id = ?`,
      entityType,
      entityId,
    );
  }

  await db.runAsync(
    `INSERT INTO sync_queue (
      entity_type,
      entity_id,
      operation,
      payload,
      created_at
    ) VALUES (?, ?, ?, ?, ?)`,
    entityType,
    entityId,
    finalOperation,
    payload ? JSON.stringify(payload) : null,
    new Date().toISOString(),
  );
}

// Always scope timetable reads to the currently authenticated user.
export async function getLocalSchedule(
  userId: string,
): Promise<ScheduleItem[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{
    id: string;
    course_id: string;
    weekday: number;
    start_time: string;
    end_time: string;
    room: string | null;
    slot: string | null;
    valid_from: string | null;
    valid_until: string | null;
    joined_course_id: string;
    course_user_id: string;
    course_name: string;
    course_code: string | null;
    course_faculty: string | null;
    course_color: string | null;
  }>(
    `SELECT
      c.id,
      c.course_id,
      c.weekday,
      c.start_time,
      c.end_time,
      c.room,
      c.slot,
      c.valid_from,
      c.valid_until,
      co.id AS joined_course_id,
      co.user_id AS course_user_id,
      co.name AS course_name,
      co.code AS course_code,
      co.faculty AS course_faculty,
      co.color AS course_color
    FROM classes c
    INNER JOIN courses co ON c.course_id = co.id
    WHERE co.user_id = ?
    ORDER BY c.weekday ASC, c.start_time ASC`,
    userId,
  );

  return rows.map((row) => ({
    id: row.id,
    course_id: row.course_id,
    weekday: row.weekday,
    start_time: row.start_time,
    end_time: row.end_time,
    room: row.room,
    slot: row.slot,
    valid_from: row.valid_from,
    valid_until: row.valid_until,
    course: {
      id: row.joined_course_id,
      user_id: row.course_user_id,
      name: row.course_name,
      code: row.course_code,
      faculty: row.course_faculty,
      color: row.course_color,
    },
  }));
}


export async function saveLocalCourse(
  course: LocalCourse,
  sync = true,
) {
  const db = await getDatabase();

  await withSerializedTransaction(async () => {
    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM courses WHERE id = ?`,
      course.id,
    );

    await db.runAsync(
      `INSERT INTO courses (
        id, user_id, name, code, faculty, color,
        updated_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        name = excluded.name,
        code = excluded.code,
        faculty = excluded.faculty,
        color = excluded.color,
        updated_at = excluded.updated_at,
        sync_status = excluded.sync_status
      WHERE ? = 1 OR courses.sync_status != 'pending'`,
      course.id,
      course.user_id,
      course.name,
      course.code,
      course.faculty,
      course.color,
      new Date().toISOString(),
      sync ? "pending" : "synced",
      sync ? 1 : 0,
    );

    if (sync) {
      await addSyncOperation(
        db,
        "course",
        course.id,
        existing ? "update" : "insert",
        course,
      );
    }
  });
}



export async function saveLocalClass(
  classItem: LocalClass,
  sync = true,
) {
  const db = await getDatabase();

  await withSerializedTransaction(async () => {
    const existing = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM classes WHERE id = ?`,
      classItem.id,
    );

    await db.runAsync(
      `INSERT INTO classes (
        id, course_id, weekday, start_time, end_time,
        room, slot, valid_from, valid_until,
        updated_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        course_id = excluded.course_id,
        weekday = excluded.weekday,
        start_time = excluded.start_time,
        end_time = excluded.end_time,
        room = excluded.room,
        slot = excluded.slot,
        valid_from = excluded.valid_from,
        valid_until = excluded.valid_until,
        updated_at = excluded.updated_at,
        sync_status = excluded.sync_status
      WHERE ? = 1 OR classes.sync_status != 'pending'`,
      classItem.id,
      classItem.course_id,
      classItem.weekday,
      classItem.start_time,
      classItem.end_time,
      classItem.room,
      classItem.slot,
      classItem.valid_from,
      classItem.valid_until,
      new Date().toISOString(),
      sync ? "pending" : "synced",
      sync ? 1 : 0,
    );

    if (sync) {
      await addSyncOperation(
        db,
        "class",
        classItem.id,
        existing ? "update" : "insert",
        classItem,
      );
    }
  });
}



export async function deleteLocalClass(
  classId: string,
  sync = true,
) {
  const db = await getDatabase();

  await withSerializedTransaction(async () => {
    const classItem = await db.getFirstAsync<LocalClass>(
      `SELECT
        id,
        course_id,
        weekday,
        start_time,
        end_time,
        room,
        slot,
        valid_from,
        valid_until
       FROM classes
       WHERE id = ?`,
      classId,
    );

    if (!classItem) return;

    if (sync) {
      await addSyncOperation(
        db,
        "class",
        classId,
        "delete",
        classItem,
      );
    }

    await db.runAsync(
      `DELETE FROM classes WHERE id = ?`,
      classId,
    );
  });
}


export async function getPendingSyncOperations(): Promise<
  PendingSyncOperation[]
> {
  const db = await getDatabase();

  return db.getAllAsync<PendingSyncOperation>(
    `SELECT *
     FROM sync_queue
     ORDER BY created_at ASC`,
  );
}

export async function markTimetableSyncComplete(
  queueId: number,
) {
  const db = await getDatabase();

  await db.runAsync(
    `DELETE FROM sync_queue WHERE id = ?`,
    queueId,
  );
}

export async function markTimetableSyncFailed(
  queueId: number,
  error: string,
) {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE sync_queue
     SET retry_count = retry_count + 1,
         last_error = ?
     WHERE id = ?`,
    error,
    queueId,
  );
}

export async function saveRemoteSchedule(
  userId: string,
  courses: LocalCourse[],
  classes: LocalClass[],
) {
  const db = await getDatabase();

  await withSerializedTransaction(async () => {
    await db.execAsync(`
      CREATE TEMP TABLE IF NOT EXISTS remote_schedule_class_ids (
        id TEXT PRIMARY KEY NOT NULL
      );
      DELETE FROM remote_schedule_class_ids;
    `);

    // Save cloud courses without overwriting pending local edits.
    for (const course of courses) {
      await db.runAsync(
        `INSERT INTO courses (
          id, user_id, name, code, faculty, color,
          updated_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'synced')
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          name = excluded.name,
          code = excluded.code,
          faculty = excluded.faculty,
          color = excluded.color,
          updated_at = excluded.updated_at,
          sync_status = 'synced'
        WHERE courses.sync_status != 'pending'`,
        course.id,
        course.user_id,
        course.name,
        course.code,
        course.faculty,
        course.color,
        new Date().toISOString(),
      );
    }

    // Save cloud classes without overwriting pending local edits
    // or recreating classes that have a pending local deletion.
    for (const item of classes) {
      await db.runAsync(
        `INSERT INTO classes (
          id, course_id, weekday, start_time, end_time,
          room, slot, valid_from, valid_until,
          updated_at, sync_status
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced'
        WHERE NOT EXISTS (
          SELECT 1 FROM sync_queue
          WHERE entity_type = 'class'
            AND entity_id = ?
            AND operation = 'delete'
        )
        ON CONFLICT(id) DO UPDATE SET
          course_id = excluded.course_id,
          weekday = excluded.weekday,
          start_time = excluded.start_time,
          end_time = excluded.end_time,
          room = excluded.room,
          slot = excluded.slot,
          valid_from = excluded.valid_from,
          valid_until = excluded.valid_until,
          updated_at = excluded.updated_at,
          sync_status = 'synced'
        WHERE classes.sync_status != 'pending'`,
        item.id,
        item.course_id,
        item.weekday,
        item.start_time,
        item.end_time,
        item.room,
        item.slot,
        item.valid_from,
        item.valid_until,
        new Date().toISOString(),
        item.id,
      );

      await db.runAsync(
        `INSERT OR IGNORE INTO remote_schedule_class_ids (id)
         VALUES (?)`,
        item.id,
      );
    }

    // Remove stale cloud-cached classes, but preserve pending offline work.
    await db.runAsync(
      `DELETE FROM classes
       WHERE sync_status != 'pending'
         AND course_id IN (
           SELECT id FROM courses WHERE user_id = ?
         )
         AND id NOT IN (
           SELECT id FROM remote_schedule_class_ids
         )`,
      userId,
    );
  });
}

export async function getLocalCourses(
  userId: string,
): Promise<LocalCourse[]> {
  const db = await getDatabase();

  return db.getAllAsync<LocalCourse>(
    `SELECT id, user_id, name, code, faculty, color
     FROM courses
     WHERE user_id = ?
     ORDER BY name ASC`,
    userId,
  );
}
