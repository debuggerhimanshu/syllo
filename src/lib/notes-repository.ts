
import * as SQLite from "expo-sqlite";
import { getDatabase } from "@/lib/database";

export type NotePriority = "low" | "medium" | "high";

export type LocalNote = {
  id: string;
  user_id: string;
  course_id: string | null;
  title: string;
  content: string;
  note_date: string;
  priority: NotePriority;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  sync_status: string;
};

export type LocalNoteAttachment = {
  id: string;
  note_id: string;
  user_id: string;
  local_uri: string | null;
  storage_path: string | null;
  file_name: string;
  mime_type: string;
  file_size: number;
  upload_status: string;
  created_at: string;
  sync_status: string;
};

export type SaveNoteInput = Omit<
  LocalNote,
  "created_at" | "updated_at" | "sync_status"
> & {
  created_at?: string;
  updated_at?: string;
};

export type SaveAttachmentInput = Omit<
  LocalNoteAttachment,
  "created_at" | "sync_status"
> & {
  created_at?: string;
};

function now() {
  return new Date().toISOString();
}

function normalizeNote(row: any): LocalNote {
  return {
    ...row,
    is_pinned: Boolean(row.is_pinned),
  };
}

async function queueOperation(
  db: SQLite.SQLiteDatabase,
  entityType: string,
  entityId: string,
  operation: string,
  payload: object | null
) {
  const existing = await db.getFirstAsync<{
    id: number;
    operation: string;
  }>(
    `SELECT id, operation
     FROM sync_queue
     WHERE entity_type = ? AND entity_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    entityType,
    entityId
  );

  if (existing) {
    const previous = existing.operation;

    if (previous === "insert" && operation === "delete") {
      await db.runAsync(
        `DELETE FROM sync_queue
         WHERE entity_type = ? AND entity_id = ?`,
        entityType,
        entityId
      );
      return;
    }

    if (previous === "insert" && operation === "update") {
      operation = "insert";
    }

    if (previous === "delete" && operation === "update") {
      operation = "insert";
    }

    await db.runAsync(
      `DELETE FROM sync_queue
       WHERE entity_type = ? AND entity_id = ?`,
      entityType,
      entityId
    );
  }

  await db.runAsync(
    `INSERT INTO sync_queue
      (entity_type, entity_id, operation, payload, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    entityType,
    entityId,
    operation,
    payload ? JSON.stringify(payload) : null,
    now()
  );
}

// ============================================
// NOTES
// ============================================

export async function getLocalNotes(
  userId: string
): Promise<LocalNote[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<any>(
    `SELECT *
     FROM notes
     WHERE user_id = ?
     ORDER BY is_pinned DESC, note_date DESC, updated_at DESC`,
    userId
  );

  return rows.map(normalizeNote);
}

export async function getLocalNoteById(
  noteId: string,
  userId: string
): Promise<LocalNote | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<any>(
    `SELECT *
     FROM notes
     WHERE id = ? AND user_id = ?
     LIMIT 1`,
    noteId,
    userId
  );

  return row ? normalizeNote(row) : null;
}


export async function saveLocalNote(
  note: SaveNoteInput,
  sync = true
): Promise<void> {
  const db = await getDatabase();
  const timestamp = now();

  

  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<{
      id: string;
      user_id: string;
      created_at: string;
    }>(
      `SELECT id, user_id, created_at
       FROM notes
       WHERE id = ?`,
      note.id
    );

    if (existing && existing.user_id !== note.user_id) {
      throw new Error("You cannot modify another user's note.");
    }

    const createdAt = existing?.created_at ?? note.created_at ?? timestamp;
    const updatedAt = timestamp;

    const operation = existing ? "update" : "insert";

    const payload = {
      id: note.id,
      user_id: note.user_id,
      course_id: note.course_id,
      title: note.title,
      content: note.content,
      note_date: note.note_date,
      priority: note.priority,
      is_pinned: note.is_pinned,
      created_at: createdAt,
      updated_at: updatedAt,
    };

    await db.runAsync(
      `INSERT INTO notes (
        id, user_id, course_id, title, content,
        note_date, priority, is_pinned,
        created_at, updated_at, sync_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        course_id = excluded.course_id,
        title = excluded.title,
        content = excluded.content,
        note_date = excluded.note_date,
        priority = excluded.priority,
        is_pinned = excluded.is_pinned,
        updated_at = excluded.updated_at,
        sync_status = excluded.sync_status
      WHERE notes.user_id = excluded.user_id`,
      note.id,
      note.user_id,
      note.course_id,
      note.title,
      note.content,
      note.note_date,
      note.priority,
      note.is_pinned ? 1 : 0,
      createdAt,
      updatedAt,
      sync ? "pending" : "synced"
    );

    if (sync) {
      await queueOperation(
        db,
        "note",
        note.id,
        operation,
        payload
      );
    }
  });
}


export async function saveRemoteNotes(
  userId: string,
  remoteNotes: Omit<LocalNote, "sync_status">[]
): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    for (const note of remoteNotes) {
      await db.runAsync(
        `INSERT INTO notes (
          id, user_id, course_id, title, content,
          note_date, priority, is_pinned,
          created_at, updated_at, sync_status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
        ON CONFLICT(id) DO UPDATE SET
          course_id = excluded.course_id,
          title = excluded.title,
          content = excluded.content,
          note_date = excluded.note_date,
          priority = excluded.priority,
          is_pinned = excluded.is_pinned,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          sync_status = 'synced'
        WHERE notes.user_id = excluded.user_id
          AND notes.sync_status != 'pending'`,
        note.id,
        userId,
        note.course_id,
        note.title,
        note.content,
        note.note_date,
        note.priority,
        note.is_pinned ? 1 : 0,
        note.created_at,
        note.updated_at
      );
    }
  });
}



export async function deleteLocalNote(
  noteId: string,
  userId: string
): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    const note = await db.getFirstAsync<any>(
      `SELECT *
       FROM notes
       WHERE id = ? AND user_id = ?`,
      noteId,
      userId
    );

    if (!note) return;

    // Preserve cloud attachment deletions before SQLite cascade.
    const attachments =
      await db.getAllAsync<LocalNoteAttachment>(
        `SELECT *
         FROM note_attachments
         WHERE note_id = ? AND user_id = ?`,
        noteId,
        userId
      );

    for (const attachment of attachments) {
      if (
        attachment.upload_status === "uploaded" &&
        attachment.storage_path
      ) {
        // Uploaded image: queue deletion from Supabase Storage.
        await queueOperation(
          db,
          "note_attachment",
          attachment.id,
          "delete",
          {
            id: attachment.id,
            user_id: userId,
            storage_path: attachment.storage_path,
          }
        );
      } else {
        // Never uploaded: cancel its pending upload.
        await db.runAsync(
          `DELETE FROM sync_queue
           WHERE entity_type = 'note_attachment'
           AND entity_id = ?`,
          attachment.id
        );
      }
    }

    // Determine whether the note ever reached Supabase.
    const existingQueue = await db.getFirstAsync<{
      operation: string;
    }>(
      `SELECT operation
       FROM sync_queue
       WHERE entity_type = 'note' AND entity_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      noteId
    );

    const wasNeverSynced =
      note.sync_status === "pending" &&
      existingQueue?.operation === "insert";

    if (!wasNeverSynced) {
      await queueOperation(
        db,
        "note",
        noteId,
        "delete",
        {
          id: noteId,
          user_id: userId,
        }
      );
    } else {
      await db.runAsync(
        `DELETE FROM sync_queue
         WHERE entity_type = 'note'
         AND entity_id = ?`,
        noteId
      );
    }

    // Delete note; SQLite cascades its local attachments.
    await db.runAsync(
      `DELETE FROM notes
       WHERE id = ? AND user_id = ?`,
      noteId,
      userId
    );
  });
}


// ============================================
// NOTE ATTACHMENTS
// ============================================

export async function getLocalNoteAttachments(
  noteId: string,
  userId: string
): Promise<LocalNoteAttachment[]> {
  const db = await getDatabase();

  return db.getAllAsync<LocalNoteAttachment>(
    `SELECT *
     FROM note_attachments
     WHERE note_id = ? AND user_id = ?
     ORDER BY created_at ASC`,
    noteId,
    userId
  );
}

export async function saveLocalAttachment(
  attachment: SaveAttachmentInput,
  sync = true
): Promise<void> {
  const db = await getDatabase();
  const timestamp = now();

  const createdAt = attachment.created_at ?? timestamp;

  const payload = {
    id: attachment.id,
    note_id: attachment.note_id,
    user_id: attachment.user_id,
    storage_path: attachment.storage_path,
    file_name: attachment.file_name,
    mime_type: attachment.mime_type,
    file_size: attachment.file_size,
    created_at: createdAt,
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO note_attachments (
        id, note_id, user_id, local_uri, storage_path,
        file_name, mime_type, file_size,
        upload_status, created_at, sync_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        local_uri = excluded.local_uri,
        storage_path = excluded.storage_path,
        file_name = excluded.file_name,
        mime_type = excluded.mime_type,
        file_size = excluded.file_size,
        upload_status = excluded.upload_status,
        sync_status = excluded.sync_status
      WHERE note_attachments.user_id = excluded.user_id`,
      attachment.id,
      attachment.note_id,
      attachment.user_id,
      attachment.local_uri,
      attachment.storage_path,
      attachment.file_name,
      attachment.mime_type,
      attachment.file_size,
      attachment.upload_status,
      createdAt,
      sync ? "pending" : "synced"
    );

    if (sync) {
      await queueOperation(
        db,
        "note_attachment",
        attachment.id,
        "insert",
        payload
      );
    }
  });
}

export async function updateLocalAttachmentUpload(
  attachmentId: string,
  userId: string,
  storagePath: string
): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE note_attachments
       SET storage_path = ?,
           upload_status = 'uploaded',
           sync_status = 'synced'
       WHERE id = ? AND user_id = ?`,
      storagePath,
      attachmentId,
      userId
    );

    await db.runAsync(
      `DELETE FROM sync_queue
       WHERE entity_type = 'note_attachment'
       AND entity_id = ?`,
      attachmentId
    );
  });
}

export async function deleteLocalAttachment(
  attachmentId: string,
  userId: string
): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    const attachment =
      await db.getFirstAsync<LocalNoteAttachment>(
        `SELECT *
         FROM note_attachments
         WHERE id = ? AND user_id = ?`,
        attachmentId,
        userId
      );

    if (!attachment) return;

    const wasUploaded =
      attachment.upload_status === "uploaded" &&
      Boolean(attachment.storage_path);

    if (wasUploaded) {
      await queueOperation(
        db,
        "note_attachment",
        attachmentId,
        "delete",
        {
          id: attachmentId,
          user_id: userId,
          storage_path: attachment.storage_path,
        }
      );
    } else {
      await db.runAsync(
        `DELETE FROM sync_queue
         WHERE entity_type = 'note_attachment'
         AND entity_id = ?`,
        attachmentId
      );
    }

    await db.runAsync(
      `DELETE FROM note_attachments
       WHERE id = ? AND user_id = ?`,
      attachmentId,
      userId
    );
  });
}

// ============================================
// SYNC QUEUE HELPERS
// ============================================

export type PendingNoteSyncOperation = {
  id: number;
  entity_type: string;
  entity_id: string;
  operation: string;
  payload: string | null;
  created_at: string;
  retry_count: number;
  last_error: string | null;
};

export async function getPendingNoteSyncOperations():
Promise<PendingNoteSyncOperation[]> {
  const db = await getDatabase();

  return db.getAllAsync<PendingNoteSyncOperation>(
    `SELECT *
     FROM sync_queue
     WHERE entity_type IN ('note', 'note_attachment')
     ORDER BY created_at ASC, id ASC`
  );
}

export async function markNoteSyncComplete(
  queueId: number
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `DELETE FROM sync_queue WHERE id = ?`,
    queueId
  );
}

export async function markNoteSyncFailed(
  queueId: number,
  errorMessage: string
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE sync_queue
     SET retry_count = retry_count + 1,
         last_error = ?
     WHERE id = ?`,
    errorMessage,
    queueId
  );
}
