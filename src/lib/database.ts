
import * as SQLite from "expo-sqlite";

const DATABASE_NAME = "syllo.db";

let database: SQLite.SQLiteDatabase | null = null;


let transactionQueue: Promise<void> = Promise.resolve();


export async function withSerializedTransaction<T>(
  callback: () => Promise<T>
): Promise<T> {
  const previousTransaction = transactionQueue;

  let release!: () => void;

  transactionQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previousTransaction;

  try {
    const db = await getDatabase();
    let result!: T;

    await db.withTransactionAsync(async () => {
      result = await callback();
    });

    return result;
  } finally {
    release();
  }
}



export async function getDatabase() {
  if (database) {
    return database;
  }

  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    -- =========================================
    -- TIMETABLE TABLES
    -- =========================================

    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT,
      faculty TEXT,
      color TEXT DEFAULT '#8B5CF6',
      updated_at TEXT,
      sync_status TEXT DEFAULT 'synced'
    );

    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY NOT NULL,
      course_id TEXT NOT NULL,
      weekday INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      room TEXT,
      slot TEXT,
      valid_from TEXT,
      valid_until TEXT,
      updated_at TEXT,
      sync_status TEXT DEFAULT 'synced',

      FOREIGN KEY (course_id)
        REFERENCES courses(id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_classes_weekday
    ON classes(weekday);

    CREATE INDEX IF NOT EXISTS idx_classes_course_id
    ON classes(course_id);

    CREATE INDEX IF NOT EXISTS idx_courses_user_id
    ON courses(user_id);

    -- =========================================
    -- NOTES TABLE
    -- =========================================

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      course_id TEXT,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      note_date TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      is_pinned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'synced',

      FOREIGN KEY (course_id)
        REFERENCES courses(id)
        ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notes_user_id
    ON notes(user_id);

    CREATE INDEX IF NOT EXISTS idx_notes_course_id
    ON notes(course_id);

    CREATE INDEX IF NOT EXISTS idx_notes_note_date
    ON notes(note_date);

    CREATE INDEX IF NOT EXISTS idx_notes_updated_at
    ON notes(updated_at);

    -- =========================================
    -- NOTE ATTACHMENTS TABLE
    -- =========================================

    CREATE TABLE IF NOT EXISTS note_attachments (
      id TEXT PRIMARY KEY NOT NULL,
      note_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      local_uri TEXT,
      storage_path TEXT,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      upload_status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',

      FOREIGN KEY (note_id)
        REFERENCES notes(id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_note_attachments_note_id
    ON note_attachments(note_id);

    CREATE INDEX IF NOT EXISTS idx_note_attachments_user_id
    ON note_attachments(user_id);

    CREATE INDEX IF NOT EXISTS idx_note_attachments_upload_status
    ON note_attachments(upload_status);

    -- =========================================
    -- TASKS TABLE
    -- =========================================

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,

      title TEXT NOT NULL,
      description TEXT DEFAULT '',

      category TEXT NOT NULL DEFAULT 'academic',
      task_type TEXT NOT NULL DEFAULT 'other',

      course_id TEXT,

      status TEXT NOT NULL DEFAULT 'todo',
      priority TEXT NOT NULL DEFAULT 'medium',
      priority_mode TEXT NOT NULL DEFAULT 'manual',

      energy_level TEXT NOT NULL DEFAULT 'medium',

      due_at TEXT,
      reminder_at TEXT,
      reminder_enabled INTEGER NOT NULL DEFAULT 0,

      estimated_minutes INTEGER DEFAULT 30,
      postponed_count INTEGER NOT NULL DEFAULT 0,
      postpone_reason TEXT,

      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,

      sync_status TEXT NOT NULL DEFAULT 'pending',

      FOREIGN KEY (course_id)
        REFERENCES courses(id)
        ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_user_id
    ON tasks(user_id);

    CREATE INDEX IF NOT EXISTS idx_tasks_course_id
    ON tasks(course_id);

    CREATE INDEX IF NOT EXISTS idx_tasks_due_at
    ON tasks(due_at);

    CREATE INDEX IF NOT EXISTS idx_tasks_status
    ON tasks(status);

    CREATE INDEX IF NOT EXISTS idx_tasks_sync_status
    ON tasks(sync_status);

        -- =========================================
    -- TASK TIME SESSIONS
    -- =========================================

    CREATE TABLE IF NOT EXISTS task_time_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL,
      user_id TEXT NOT NULL,

      started_at TEXT NOT NULL,
      ended_at TEXT,

      duration_seconds INTEGER NOT NULL DEFAULT 0,

      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,

      sync_status TEXT NOT NULL DEFAULT 'pending',

      FOREIGN KEY (task_id)
        REFERENCES tasks(id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_task_time_sessions_task_id
    ON task_time_sessions(task_id);

    CREATE INDEX IF NOT EXISTS idx_task_time_sessions_user_id
    ON task_time_sessions(user_id);

    CREATE INDEX IF NOT EXISTS idx_task_time_sessions_started_at
    ON task_time_sessions(started_at);

    CREATE INDEX IF NOT EXISTS idx_task_time_sessions_sync_status
    ON task_time_sessions(sync_status);

    -- =========================================
    -- BACKGROUND SYNC QUEUE
    -- =========================================

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0,
      last_error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at
    ON sync_queue(created_at);

    CREATE INDEX IF NOT EXISTS idx_sync_queue_entity
    ON sync_queue(entity_type, entity_id);
  `);

  database = db;

  return database;
}
