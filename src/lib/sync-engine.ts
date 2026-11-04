
import { supabase } from "@/lib/supabase";
import { getDatabase } from "@/lib/database";

import {
  getPendingNoteSyncOperations,
  getLocalNoteAttachments,
  updateLocalAttachmentUpload,
  markNoteSyncComplete,
  markNoteSyncFailed,
} from "@/lib/notes-repository";

import {
  getPendingSyncOperations,
  markTimetableSyncComplete,
  markTimetableSyncFailed,
  type LocalCourse,
  type LocalClass,
} from "@/lib/timetable-repository";
import {
  getPendingTaskSyncOperations,
  markTaskSyncComplete,
  markTaskSyncFailed,
  type Task,
} from "@/lib/tasks-repository";

type NoteSyncPayload = {
  id: string;
  user_id: string;
  course_id?: string | null;
  title?: string;
  content?: string;
  note_date?: string;
  priority?: string;
  is_pinned?: boolean;
  created_at?: string;
  updated_at?: string;
};

type AttachmentSyncPayload = {
  id: string;
  note_id?: string;
  user_id: string;
  storage_path?: string | null;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  created_at?: string;
};

type TimetableSyncPayload =
  | LocalCourse
  | LocalClass;

   async function syncPendingTimetable(userId: string): Promise<void> {
  const operations = await getPendingSyncOperations();

  const timetableOperations = operations.filter(
    (operation) =>
      operation.entity_type === "course" ||
      operation.entity_type === "class",
  );

  console.log(
  "PENDING CLASS DELETIONS:",
  timetableOperations
    .filter(
      (operation) =>
        operation.entity_type === "class" &&
        operation.operation === "delete",
    )
    .map((operation) => ({
      id: operation.id,
      entity_id: operation.entity_id,
      payload: operation.payload,
      retry_count: operation.retry_count,
      last_error: operation.last_error,
    })),
);

  // =========================================
  // STEP 1: SYNC COURSES
  // =========================================

  for (const operation of timetableOperations) {
    if (
      operation.entity_type !== "course" ||
      !["insert", "update"].includes(operation.operation)
    ) {
      continue;
    }

    try {
      if (!operation.payload) {
        throw new Error("Course sync payload is missing.");
      }

      const payload = JSON.parse(
        operation.payload,
      ) as LocalCourse;

      if (
        payload.id !== operation.entity_id ||
        payload.user_id !== userId
      ) {
        throw new Error("Course ownership validation failed.");
      }

      const { error } = await supabase
        .from("courses")
        .upsert(
          {
            id: payload.id,
            user_id: userId,
            name: payload.name,
            code: payload.code,
            faculty: payload.faculty,
            color: payload.color ?? "#8B5CF6",
          },
          { onConflict: "id" },
        );

      if (error) throw error;

      const db = await getDatabase();

      await db.runAsync(
        `UPDATE courses
         SET sync_status = 'synced'
         WHERE id = ? AND user_id = ?`,
        payload.id,
        userId,
      );

      await markTimetableSyncComplete(operation.id);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown course synchronization error.";

      console.error(
        `Course sync failed (${operation.entity_id}):`,
        message,
      );

      await markTimetableSyncFailed(operation.id, message);
    }
  }

  // =========================================
  // STEP 2: CREATE AND UPDATE CLASSES
  // =========================================

  for (const operation of timetableOperations) {
    if (
      operation.entity_type !== "class" ||
      !["insert", "update"].includes(operation.operation)
    ) {
      continue;
    }

    try {
      if (!operation.payload) {
        throw new Error("Class sync payload is missing.");
      }

      const payload = JSON.parse(
        operation.payload,
      ) as LocalClass;

      if (
        payload.id !== operation.entity_id ||
        !payload.course_id
      ) {
        throw new Error("Class sync payload is invalid.");
      }

      // Verify that the parent course belongs to this user.
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("id")
        .eq("id", payload.course_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (courseError) throw courseError;

      if (!course) {
        throw new Error(
          "Parent course is missing or does not belong to this user.",
        );
      }

      const { error } = await supabase
        .from("classes")
        .upsert(
          {
            id: payload.id,
            course_id: payload.course_id,
            weekday: payload.weekday,
            start_time: payload.start_time,
            end_time: payload.end_time,
            room: payload.room,
            slot: payload.slot,
            valid_from: payload.valid_from,
            valid_until: payload.valid_until,
          },
          { onConflict: "id" },
        );

      if (error) throw error;

      const db = await getDatabase();

      await db.runAsync(
        `UPDATE classes
         SET sync_status = 'synced'
         WHERE id = ? AND course_id = ?`,
        payload.id,
        payload.course_id,
      );

      await markTimetableSyncComplete(operation.id);
    } catch (error) {
        const message =
            error instanceof Error
            ? error.message
            : JSON.stringify(error) || String(error);

        console.error(
        `Class sync failed (${operation.entity_id}):`,
        String(error),
        JSON.stringify(error, Object.getOwnPropertyNames(error)),
        );

        await markTimetableSyncFailed(operation.id, message);
        }
  }

  // =========================================
  // STEP 3: DELETE CLASSES
  // =========================================

  
  // STEP 3: DELETE CLASSES
  for (const operation of timetableOperations) {
    if (
      operation.entity_type !== "class" ||
      operation.operation !== "delete"
    ) {
      continue;
    }

    try {
      let courseId: string;

      if (operation.payload) {
        // Normal deletion: use the saved local payload.
        const payload = JSON.parse(
          operation.payload,
        ) as LocalClass;

        if (
          payload.id !== operation.entity_id ||
          !payload.course_id
        ) {
          throw new Error("Class deletion payload is invalid.");
        }

        courseId = payload.course_id;
      } else {
        // Recovery: an older queue entry has no payload.
        const { data: remoteClass, error: classError } =
          await supabase
            .from("classes")
            .select("id, course_id")
            .eq("id", operation.entity_id)
            .maybeSingle();

        if (classError) throw classError;

        // Already absent remotely: deletion is complete.
        if (!remoteClass) {
          await markTimetableSyncComplete(operation.id);
          continue;
        }

        courseId = remoteClass.course_id;
      }

      // Always verify ownership through the parent course.
      const { data: course, error: courseError } =
        await supabase
          .from("courses")
          .select("id")
          .eq("id", courseId)
          .eq("user_id", userId)
          .maybeSingle();

      if (courseError) throw courseError;

      if (!course) {
        throw new Error(
          "Cannot verify ownership of the class's parent course.",
        );
      }

      // Delete only the verified class belonging to this course.
      const { error } = await supabase
        .from("classes")
        .delete()
        .eq("id", operation.entity_id)
        .eq("course_id", courseId);

      if (error) throw error;

      await markTimetableSyncComplete(operation.id);

      console.log(
        `Class deletion synchronized: ${operation.entity_id}`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      console.error(
        `Class deletion failed (${operation.entity_id}):`,
        error,
      );

      await markTimetableSyncFailed(operation.id, message);
    }
  }

}


// =========================================
// TASK SYNC
// =========================================

async function syncPendingTasks(userId: string): Promise<void> {
  const operations = await getPendingTaskSyncOperations();

  for (const operation of operations) {
    if (!["insert", "update", "delete"].includes(operation.operation)) {
      continue;
    }

    try {
      if (!operation.payload) {
        throw new Error("Task sync payload is missing.");
      }

      const payload = JSON.parse(operation.payload) as Task;

      // Validate task identity and ownership.
      if (
        payload.id !== operation.entity_id ||
        payload.user_id !== userId
      ) {
        throw new Error("Task ownership validation failed.");
      }

      // -------------------------------------
      // DELETE TASK
      // -------------------------------------

      if (operation.operation === "delete") {
        const { error } = await supabase
          .from("tasks")
          .delete()
          .eq("id", payload.id)
          .eq("user_id", userId);

        if (error) throw error;

        await markTaskSyncComplete(
          operation.id,
          payload.id,
          "delete"
        );

        console.log(`Task deletion synchronized: ${payload.id}`);
        continue;
      }

      // -------------------------------------
      // VERIFY PARENT COURSE
      // -------------------------------------

      if (payload.course_id) {
        const { data: course, error: courseError } = await supabase
          .from("courses")
          .select("id")
          .eq("id", payload.course_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (courseError) throw courseError;

        if (!course) {
          throw new Error(
            "Task's parent course is missing or does not belong to this user."
          );
        }
      }

      // -------------------------------------
      // CREATE / UPDATE TASK
      // -------------------------------------

      const { error } = await supabase
        .from("tasks")
        .upsert(
          {
            id: payload.id,
            user_id: userId,
            title: payload.title,
            description: payload.description,
            category: payload.category,
            task_type: payload.task_type,
            course_id: payload.course_id,
            status: payload.status,
            priority: payload.priority,
            priority_mode: payload.priority_mode,
            energy_level: payload.energy_level,
            due_at: payload.due_at,
            reminder_at: payload.reminder_at,
            reminder_enabled: Boolean(payload.reminder_enabled),
            estimated_minutes: payload.estimated_minutes,
            postponed_count: payload.postponed_count,
            postpone_reason: payload.postpone_reason,
            created_at: payload.created_at,
            updated_at: payload.updated_at,
            completed_at: payload.completed_at,
          },
          { onConflict: "id" }
        );

      if (error) throw error;

      await markTaskSyncComplete(
        operation.id,
        payload.id,
        operation.operation
      );

      console.log(`Task synchronized: ${payload.id}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown task synchronization error.";

      console.error(
        `Task sync failed (${operation.entity_id}):`,
        message
      );

      await markTaskSyncFailed(operation.id, message);
    }
  }
}


let isSyncing = false;

export async function syncPendingNotes(): Promise<void> {
  if (isSyncing) return;

  isSyncing = true;

  try {
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError) throw authError;

    const user = session?.user;

    if (!user) {
  throw new Error("No authenticated user available for sync.");
}

// Sync timetable before tasks.
await syncPendingTimetable(user.id);

// Sync tasks after their parent courses are available.
await syncPendingTasks(user.id);

// Sync notes and attachments.
const operations = await getPendingNoteSyncOperations();

    // =========================================
    // STEP 1: CREATE AND UPDATE NOTES
    // =========================================

    for (const operation of operations) {
      if (
        operation.entity_type !== "note" ||
        !["insert", "update"].includes(operation.operation)
      ) {
        continue;
      }

      try {
        if (!operation.payload) {
          throw new Error("Note sync payload is missing.");
        }

        const payload = JSON.parse(
          operation.payload
        ) as NoteSyncPayload;

        if (
          payload.id !== operation.entity_id ||
          payload.user_id !== user.id
        ) {
          throw new Error("Note ownership validation failed.");
        }

        const { error } = await supabase
          .from("notes")
          .upsert(
            {
              ...payload,
              is_pinned: Boolean(payload.is_pinned),
            },
            { onConflict: "id" }
          );

        if (error) throw error;

        const db = await getDatabase();

        await db.runAsync(
          `UPDATE notes
           SET sync_status = 'synced'
           WHERE id = ? AND user_id = ?`,
          payload.id,
          user.id
        );

        await markNoteSyncComplete(operation.id);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown note synchronization error.";

        console.error(
          `Note sync failed (${operation.entity_id}):`,
          message
        );

        await markNoteSyncFailed(operation.id, message);
      }
    }

    // =========================================
    // STEP 2: SYNCHRONIZE ATTACHMENTS
    // =========================================

    let attachmentDeleteFailed = false;

    for (const operation of operations) {
      if (operation.entity_type !== "note_attachment") {
        continue;
      }

      try {
        if (!operation.payload) {
          throw new Error("Attachment sync payload is missing.");
        }

        const payload = JSON.parse(
          operation.payload
        ) as AttachmentSyncPayload;

        if (
          payload.id !== operation.entity_id ||
          payload.user_id !== user.id
        ) {
          throw new Error("Attachment ownership validation failed.");
        }

        // -------------------------------------
        // DELETE ATTACHMENT
        // -------------------------------------

        if (operation.operation === "delete") {
          if (payload.storage_path) {
            const { error: storageError } = await supabase.storage
              .from("note-images")
              .remove([payload.storage_path]);

            if (storageError) throw storageError;
          }

          const { error: metadataError } = await supabase
            .from("note_attachments")
            .delete()
            .eq("id", payload.id)
            .eq("user_id", user.id);

          if (metadataError) throw metadataError;

          await markNoteSyncComplete(operation.id);
          continue;
        }

        // -------------------------------------
        // UPLOAD ATTACHMENT
        // -------------------------------------

        if (operation.operation !== "insert") {
          continue;
        }

        if (!payload.note_id) {
          throw new Error("Attachment note ID is missing.");
        }

        if (
          !payload.file_name ||
          !payload.mime_type ||
          payload.file_size === undefined
        ) {
          throw new Error("Attachment metadata is incomplete.");
        }

        // Ensure the parent note exists in Supabase first.
        const { data: remoteNote, error: noteCheckError } =
          await supabase
            .from("notes")
            .select("id")
            .eq("id", payload.note_id)
            .eq("user_id", user.id)
            .maybeSingle();

        if (noteCheckError) throw noteCheckError;

        if (!remoteNote) {
          throw new Error(
            "Parent note is not synchronized yet."
          );
        }

        const localAttachments = await getLocalNoteAttachments(
          payload.note_id,
          user.id
        );

        const attachment = localAttachments.find(
          (item) => item.id === payload.id
        );

        if (!attachment?.local_uri) {
          throw new Error("Local attachment file was not found.");
        }

        // Read the permanent local image file.
        const response = await fetch(attachment.local_uri);

        if (!response.ok) {
          throw new Error("Could not read the local image file.");
        }

        const fileData = await response.arrayBuffer();

        // Build a user-scoped, deterministic Storage path.
        const safeFileName = payload.file_name.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );

        const storagePath =
          `${user.id}/${payload.note_id}/` +
          `${payload.id}-${safeFileName}`;

        // Upload with upsert so retries are safe.
        const { error: uploadError } = await supabase.storage
          .from("note-images")
          .upload(storagePath, fileData, {
            contentType: payload.mime_type,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // Save attachment metadata in Supabase.
        const { error: metadataError } = await supabase
          .from("note_attachments")
          .upsert(
            {
              id: payload.id,
              note_id: payload.note_id,
              user_id: user.id,
              storage_path: storagePath,
              file_name: payload.file_name,
              mime_type: payload.mime_type,
              file_size: payload.file_size,
              created_at: payload.created_at,
            },
            { onConflict: "id" }
          );

        if (metadataError) {
          // Roll back the uploaded object if metadata fails.
          await supabase.storage
            .from("note-images")
            .remove([storagePath]);

          throw metadataError;
        }

        // Updates SQLite and removes this queue entry.
        await updateLocalAttachmentUpload(
          payload.id,
          user.id,
          storagePath
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown attachment synchronization error.";

        console.error(
          `Attachment sync failed (${operation.entity_id}):`,
          message
        );

        if (operation.operation === "delete") {
          attachmentDeleteFailed = true;
        }

        await markNoteSyncFailed(operation.id, message);
      }
    }

    // =========================================
    // STEP 3: DELETE NOTES
    // =========================================

    // Never delete notes while attachment deletions are failing.
    if (attachmentDeleteFailed) {
      return;
    }

    for (const operation of operations) {
      if (
        operation.entity_type !== "note" ||
        operation.operation !== "delete"
      ) {
        continue;
      }

      try {
        if (!operation.payload) {
          throw new Error("Note deletion payload is missing.");
        }

        const payload = JSON.parse(
          operation.payload
        ) as NoteSyncPayload;

        if (
          payload.id !== operation.entity_id ||
          payload.user_id !== user.id
        ) {
          throw new Error("Note ownership validation failed.");
        }

        const { error } = await supabase
          .from("notes")
          .delete()
          .eq("id", payload.id)
          .eq("user_id", user.id);

        if (error) throw error;

        await markNoteSyncComplete(operation.id);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown note deletion error.";

        console.error(
          `Note deletion failed (${operation.entity_id}):`,
          message
        );

        await markNoteSyncFailed(operation.id, message);
      }
    }
  } finally {
    isSyncing = false;
  }
}
