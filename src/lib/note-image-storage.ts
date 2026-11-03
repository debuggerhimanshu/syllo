
import { Directory, File, Paths } from "expo-file-system";
import * as Crypto from "expo-crypto";

const attachmentDirectory = new Directory(
  Paths.document,
  "note-attachments"
);

function ensureAttachmentDirectory() {
  attachmentDirectory.create({
    idempotent: true,
    intermediates: true,
  });
}

export function persistNoteImage(
  sourceUri: string,
  fileName: string
): string {
  ensureAttachmentDirectory();

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueName = `${Crypto.randomUUID()}-${safeName}`;

  const source = new File(sourceUri);
  const destination = new File(
    attachmentDirectory,
    uniqueName
  );

  source.copy(destination);

  return destination.uri;
}

export function deletePersistedNoteImage(
  uri: string | null
): void {
  if (!uri) return;

  try {
    const file = new File(uri);

    if (file.exists) {
      file.delete();
    }
  } catch (error) {
    console.warn("Could not delete local note image:", error);
  }
}
