
import { useEffect,useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../lib/supabase";

type Priority = "low" | "medium" | "high";

type NoteDetails = {
  id: string;
  course_id: string | null;
  title: string;
  content: string;
  note_date: string;
  priority: Priority;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
};

type CourseDetails = {
  id: string;
  name: string;
  code: string;
  color: string | null;
};

type NoteAttachment = {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: "image/jpeg" | "image/png" | "image/webp";
  file_size: number;
  signedUrl?: string;
};

export default function NoteDetailsScreen() {
  const router = useRouter();
  const { noteId } = useLocalSearchParams<{ noteId: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState<NoteDetails | null>(null);
  const [course, setCourse] = useState<CourseDetails | null>(null);
  const [attachments, setAttachments] = useState<NoteAttachment[]>([]);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [showBackButton, setShowBackButton] = useState(false);
  const lastScrollY = useRef(0);
  const backButtonX = useRef(new Animated.Value(0)).current;

useEffect(() => {
  Animated.timing(backButtonX, {
    toValue: showBackButton ? 0 : -120,
    duration: 220,
    useNativeDriver: true,
  }).start();
}, [showBackButton, backButtonX]);


  const loadNoteDetails = async () => {
  setLoading(true);
  setError("");

  try {
    if (!noteId || typeof noteId !== "string") {
      throw new Error("Note ID is missing.");
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;

    if (!user) {
      throw new Error("Please sign in to view this note.");
    }

    const { data: noteData, error: noteError } = await supabase
      .from("notes")
      .select(
        "id, course_id, title, content, note_date, priority, is_pinned, created_at, updated_at"
      )
      .eq("id", noteId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (noteError) throw noteError;

    if (!noteData) {
      throw new Error("This note could not be found.");
    }

    const loadedNote = noteData as NoteDetails;
    setNote(loadedNote);

    if (loadedNote.course_id) {
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("id, name, code, color")
        .eq("id", loadedNote.course_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (courseError) throw courseError;
      setCourse((courseData as CourseDetails | null) ?? null);
    } else {
      setCourse(null);
    }

    const { data: attachmentData, error: attachmentError } = await supabase
      .from("note_attachments")
      .select("id, storage_path, file_name, mime_type, file_size")
      .eq("note_id", noteId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (attachmentError) throw attachmentError;

    const loadedAttachments = await Promise.all(
      (attachmentData ?? []).map(async (attachment) => {
        const { data: signedData, error: signedError } = await supabase.storage
          .from("note-images")
          .createSignedUrl(attachment.storage_path, 3600);

        if (signedError) {
          console.error("Could not load attachment URL:", signedError);
          return attachment as NoteAttachment;
        }

        return {
          ...attachment,
          signedUrl: signedData.signedUrl,
        } as NoteAttachment;
      })
    );

    

    
    setAttachments(loadedAttachments);
} catch (err) {
    console.error("Failed to load note details:", err);
    setError(
        err instanceof Error ? err.message : "Couldn't load this note."
    );
} finally {
    setLoading(false);
}
};

const handleDeleteNote = () => {
  if (!note) return;

  Alert.alert(
    "Delete note?",
    "This note and all its attached images will be permanently deleted. This action cannot be undone.",
    [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true);
            setError("");

            const {
              data: { user },
              error: authError,
            } = await supabase.auth.getUser();

            if (authError) throw authError;
            if (!user) throw new Error("Please sign in again.");

            const { data: attachmentData, error: attachmentError } =
              await supabase
                .from("note_attachments")
                .select("id, storage_path")
                .eq("note_id", note.id)
                .eq("user_id", user.id);

            if (attachmentError) throw attachmentError;

            const attachmentPaths = (attachmentData ?? []).map(
              (attachment) => attachment.storage_path
            );

            // Delete the note first. The database cascade removes
            // its attachment records.
            const { error: deleteError } = await supabase
              .from("notes")
              .delete()
              .eq("id", note.id)
              .eq("user_id", user.id);

            if (deleteError) throw deleteError;

            // Then remove the image files from private storage.
            if (attachmentPaths.length > 0) {
              const { error: storageError } = await supabase.storage
                .from("note-images")
                .remove(attachmentPaths);

              if (storageError) {
                console.error(
                  "Note deleted, but some image files may remain:",
                  storageError
                );
              }
            }

            Alert.alert("Note deleted", "Your note has been deleted.");
            router.replace("/(tabs)/notes");
          } catch (err) {
            console.error("Failed to delete note:", err);
            setError(
              err instanceof Error
                ? err.message
                : "Couldn't delete this note. Please try again."
            );
          } finally {
            setLoading(false);
          }
        },
      },
    ]
  );
};

useEffect(() => {
void loadNoteDetails();
}, [noteId]);

  return (
    <View style={styles.container}>
        
<Animated.View
  style={[
    styles.stickyHeader,
    { transform: [{ translateX: backButtonX }] },
  ]}
  pointerEvents={showBackButton ? "auto" : "none"}
>
  <Pressable onPress={() => router.back()} style={styles.backButton}>
    <Text style={styles.backText}>‹ Back</Text>
  </Pressable>
</Animated.View>


        
        <ScrollView
        contentContainerStyle={styles.content}
        onScroll={(event) => {
            const currentY = event.nativeEvent.contentOffset.y;
            const previousY = lastScrollY.current;
            const difference = currentY - previousY;

            if (currentY < 10 || difference > 5) {
            setShowBackButton(false);
            } else if (difference < -5) {
            setShowBackButton(true);
            }

            lastScrollY.current = currentY;
        }}
        scrollEventThrottle={16}
        >


        
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#A78BFA" />
            <Text style={styles.muted}>Loading note...</Text>
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : note ? (
          <View style={styles.noteBody}>
            <Text style={styles.courseName}>
              {course ? `${course.name}${course.code ? ` · ${course.code}` : ""}` : "General Note"}
            </Text>

            <Text style={styles.noteTitle}>{note.title}</Text>

            <Text style={styles.noteDate}>
                {new Date(`${note.note_date}T12:00:00`).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                })}
                </Text>

            <View style={styles.metadataRow}>
              
                <View style={styles.metadataItem}>
                <Text style={styles.metadataLabel}>PRIORITY</Text>
                <View
                    style={[
                    styles.priorityBadge,
                    note.priority === "high" && styles.highPriority,
                    note.priority === "medium" && styles.mediumPriority,
                    note.priority === "low" && styles.lowPriority,
                    ]}
                >
                    <View
                    style={[
                        styles.priorityDot,
                        note.priority === "high" && styles.highPriorityDot,
                        note.priority === "medium" && styles.mediumPriorityDot,
                        note.priority === "low" && styles.lowPriorityDot,
                    ]}
                    />
                    <Text
                    style={[
                        styles.priorityText,
                        note.priority === "high" && styles.highPriorityText,
                        note.priority === "medium" && styles.mediumPriorityText,
                        note.priority === "low" && styles.lowPriorityText,
                    ]}
                    >
                    {note.priority.charAt(0).toUpperCase() + note.priority.slice(1)}
                    </Text>
                </View>
                </View>

              {note.is_pinned && (
                <View style={styles.metadataItem}>
                  <Text style={styles.metadataLabel}>STATUS</Text>
                  <Text style={styles.metadataValue}>📌 Pinned</Text>
                </View>
              )}
            </View>

            <View style={styles.separator} />

            <Text style={styles.sectionTitle}>Note Content</Text>
            <Text style={styles.noteContent}>
              {note.content || "This note has no content yet."}
            </Text>

            {attachments.length > 0 && (
              <View style={styles.attachmentsSection}>
                <Text style={styles.sectionTitle}>
                  Attachments ({attachments.length})
                </Text>

                {attachments.map((attachment) => (
                  <View key={attachment.id} style={styles.attachmentItem}>
                    {attachment.signedUrl ? (
                      <Pressable
                        onPress={() => setFullScreenImage(attachment.signedUrl ?? null)}
                        disabled={!attachment.signedUrl}
                        >
                        <Image
                            source={{ uri: attachment.signedUrl }}
                            style={styles.attachmentImage}
                            resizeMode="cover"
                        />
                        </Pressable>
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <Text style={styles.muted}>Image unavailable</Text>
                      </View>
                    )}

                    <Text style={styles.attachmentName}>
                      {attachment.file_name}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            
          </View>
        ) : (
          <Text style={styles.errorText}>Note details are unavailable.</Text>
        )}

      </ScrollView>


      
{!loading && !error && note && (
  <View style={styles.bottomBar}>
    <Pressable
      style={styles.deleteButton}
      onPress={handleDeleteNote}
    >
      <Text style={styles.deleteButtonText}>Delete Note</Text>
    </Pressable>

    <Pressable
      style={styles.editButton}
      onPress={() =>
        router.push({
          pathname: "/note-editor",
          params: { noteId: note.id },
        })
      }
    >
      <Text style={styles.editButtonText}>✎  Edit Note</Text>
    </Pressable>
  </View>
)}



<Modal
        visible={fullScreenImage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setFullScreenImage(null)}
        statusBarTranslucent
      >
        <View style={styles.fullScreenViewer}>
          <Pressable
            style={styles.closeImageViewer}
            onPress={() => setFullScreenImage(null)}
            hitSlop={12}
          >
            <Text style={styles.closeImageViewerText}>✕</Text>
          </Pressable>

          {fullScreenImage && (
            <Image
              source={{ uri: fullScreenImage }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08090D",
  },
  content: {
  paddingHorizontal: 22,
  paddingTop: 60,
  paddingBottom: 40,
},
  
backButton: {
  backgroundColor: "#A78BFA",
  borderRadius: 12,
  paddingHorizontal: 16,
  paddingVertical: 10,
  alignSelf: "flex-start",
},
backText: {
  color: "#111019",
  fontSize: 15,
  fontWeight: "800",
},

  center: {
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  muted: {
    color: "#858B98",
    fontSize: 14,
  },
  errorText: {
    color: "#FF8C9B",
    fontSize: 14,
  },

  
  noteCard: {
    backgroundColor: "#11131B",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#242735",
    padding: 20,
    gap: 16,
  },
  courseName: {
    color: "#A78BFA",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  noteTitle: {
    color: "#F5F5FA",
    fontSize: 27,
    fontWeight: "800",
    lineHeight: 35,
  },
  metadataRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 20,
  },
  metadataItem: {
    gap: 5,
  },
  metadataLabel: {
    color: "#858B98",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  metadataValue: {
    color: "#E0E2EB",
    fontSize: 13,
    fontWeight: "600",
  },
  separator: {
    height: 1,
    backgroundColor: "#292C39",
    marginVertical: 4,
  },
  sectionTitle: {
    color: "#F5F5FA",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  noteContent: {
    color: "#C7CAD5",
    fontSize: 15,
    lineHeight: 25,
  },
  attachmentsSection: {
    gap: 14,
    marginTop: 8,
  },
  attachmentItem: {
    gap: 8,
  },
  attachmentImage: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    backgroundColor: "#1B1E29",
  },
  imagePlaceholder: {
    height: 120,
    borderRadius: 12,
    backgroundColor: "#1B1E29",
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentName: {
    color: "#AEB3C2",
    fontSize: 12,
  },
  editButton: {
    backgroundColor: "#A78BFA",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  editButtonText: {
    color: "#111019",
    fontSize: 15,
    fontWeight: "800",
  },



  fullScreenViewer: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  fullScreenImage: {
    width: "100%",
    height: "100%",
  },
  closeImageViewer: {
    position: "absolute",
    top: 55,
    right: 22,
    zIndex: 10,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#242424",
    alignItems: "center",
    justifyContent: "center",
  },
  closeImageViewerText: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
  },
  

  priorityBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: "800",
  },
  highPriority: {
    backgroundColor: "#351B24",
    borderColor: "#743343",
  },
  highPriorityDot: {
    backgroundColor: "#FF647C",
  },
  highPriorityText: {
    color: "#FF8193",
  },
  mediumPriority: {
    backgroundColor: "#352A16",
    borderColor: "#735323",
  },
  mediumPriorityDot: {
    backgroundColor: "#F5B942",
  },
  mediumPriorityText: {
    color: "#FFD071",
  },
  lowPriority: {
    backgroundColor: "#163027",
    borderColor: "#285B43",
  },
  lowPriorityDot: {
    backgroundColor: "#4ADE80",
  },
  lowPriorityText: {
    color: "#72E8A0",
  },

  
  bottomBar: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: "#08090D",
    borderTopWidth: 1,
    borderTopColor: "#242735",
  },
  
  noteBody: {
  gap: 16,
  paddingBottom: 12,
},

noteDate: {
  color: "#858B98",
  fontSize: 13,
  fontWeight: "500",
  marginTop: -8,
},

stickyHeader: {
  position: "absolute",
  top: 48,
  left: 22,
  zIndex: 20,
  elevation: 20,
},


deleteButton: {
  backgroundColor: "#24151A",
  borderColor: "#743343",
  borderWidth: 1,
  borderRadius: 14,
  paddingVertical: 14,
  alignItems: "center",
},

deleteButtonText: {
  color: "#FF8193",
  fontSize: 15,
  fontWeight: "700",
},

});
