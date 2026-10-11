
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

type Course = {
  id: string;
  name: string;
  code: string;
  color: string | null;
};

type Priority = "low" | "medium" | "high";

type NoteRecord = {
  id: string;
  course_id: string | null;
  title: string;
  content: string;
  note_date: string;
  priority: Priority;
  is_pinned: boolean;
};

const today = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const isValidDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
};

export default function NoteEditor() {
  const router = useRouter();
  const { courseId, noteId } = useLocalSearchParams<{
    courseId?: string;
    noteId?: string;
  }>();

  const editingId =
    typeof noteId === "string" && noteId.length > 0 ? noteId : null;

  const initialCourseId =
    typeof courseId === "string" ? courseId : "";

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] =
    useState(initialCourseId);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [noteDate, setNoteDate] = useState(today());
  const [priority, setPriority] = useState<Priority>("medium");
  const [isPinned, setIsPinned] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadEditor = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        throw new Error("Please sign in before creating a note.");
      }

      setUserId(user.id);

      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("id, name, code, color")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (courseError) throw courseError;

      const availableCourses = (courseData ?? []) as Course[];
      setCourses(availableCourses);

      if (editingId) {
        const { data: note, error: noteError } = await supabase
          .from("notes")
          .select(
            "id, course_id, title, content, note_date, priority, is_pinned"
          )
          .eq("id", editingId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (noteError) throw noteError;
        if (!note) {
          throw new Error(
            "This note could not be found or you don't have access to it."
          );
        }

        setSelectedCourseId(note.course_id ?? "");
        setTitle(note.title ?? "");
        setContent(note.content ?? "");
        setNoteDate(note.note_date);
        setPriority(note.priority as Priority);
        setIsPinned(note.is_pinned);
      } else if (initialCourseId) {
        const belongsToUser = availableCourses.some(
          (course) => course.id === initialCourseId
        );

        if (!belongsToUser) {
          throw new Error("The selected course is not available.");
        }

        setSelectedCourseId(initialCourseId);
      }
    } catch (err) {
      console.error("Failed to load note editor:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't load the note editor."
      );
    } finally {
      setLoading(false);
    }
  }, [editingId, initialCourseId]);

  useEffect(() => {
    void loadEditor();
  }, [loadEditor]);

  const saveNote = async () => {
    if (!userId) {
      Alert.alert("Sign in required", "Please sign in and try again.");
      return;
    }

    if (!selectedCourseId) {
      Alert.alert("Choose a course", "Select the course for this note.");
      return;
    }

    if (!courses.some((course) => course.id === selectedCourseId)) {
      Alert.alert("Invalid course", "Please select one of your courses.");
      return;
    }

    if (!title.trim() && !content.trim()) {
      Alert.alert(
        "Empty note",
        "Add a title or some content before saving."
      );
      return;
    }

    if (!isValidDate(noteDate)) {
      Alert.alert(
        "Invalid date",
        "Enter a real date in YYYY-MM-DD format, such as 2026-09-22."
      );
      return;
    }

    setSaving(true);

    try {
      const noteData = {
        user_id: userId,
        course_id: selectedCourseId,
        title: title.trim() || "Untitled note",
        content,
        note_date: noteDate,
        priority,
        is_pinned: isPinned,
      };

      if (editingId) {
        const { error: updateError } = await supabase
          .from("notes")
          .update(noteData)
          .eq("id", editingId)
          .eq("user_id", userId)
          .select("id")
          .single();

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("notes")
          .insert(noteData)
          .select("id")
          .single();

        if (insertError) throw insertError;
      }

      Alert.alert(
        "Note saved",
        editingId
          ? "Your changes have been saved."
          : "Your note has been saved.",
        [
          {
            text: "Done",
            onPress: () => router.back(),
          },
        ]
      );
    } catch (err) {
      console.error("Failed to save note:", err);
      Alert.alert(
        "Couldn't save note",
        err instanceof Error
          ? err.message
          : "Please check your connection and try again."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.muted}>Preparing your notebook...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Unable to open note</Text>
        <Text style={styles.muted}>{error}</Text>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.back()}
        >
          <Text style={styles.secondaryButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityLabel="Go back"
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <View style={styles.headerInfo}>
            <Text style={styles.eyebrow}>
              {editingId ? "YOUR NOTEBOOK" : "NEW NOTE"}
            </Text>
            <Text style={styles.heading}>
              {editingId ? "Edit note" : "Create note"}
            </Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.label}>COURSE</Text>

        {courses.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.muted}>
              No registered courses found. Add a course before creating a
              course note.
            </Text>
          </View>
        ) : (
          <View style={styles.courseGrid}>
            {courses.map((course) => {
              const selected = selectedCourseId === course.id;
              const accent = course.color || "#8B5CF6";

              return (
                <Pressable
                  key={course.id}
                  onPress={() => setSelectedCourseId(course.id)}
                  style={[
                    styles.courseChip,
                    selected && {
                      borderColor: accent,
                      backgroundColor: `${accent}20`,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.courseDot,
                      { backgroundColor: accent },
                    ]}
                  />
                  <View style={styles.courseChipInfo}>
                    <Text
                      style={[
                        styles.courseCode,
                        selected && { color: accent },
                      ]}
                    >
                      {course.code}
                    </Text>
                    <Text
                      style={styles.courseName}
                      numberOfLines={2}
                    >
                      {course.name}
                    </Text>
                  </View>
                  {selected ? (
                    <Text style={[styles.check, { color: accent }]}>
                      ✓
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={styles.label}>NOTE TITLE</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Lecture 5 — Normalization"
          placeholderTextColor="#626775"
          style={styles.titleInput}
          maxLength={160}
          returnKeyType="next"
        />

        <View style={styles.fieldHeader}>
          <Text style={styles.label}>NOTE CONTENT</Text>
          <Text style={styles.optional}>Text</Text>
        </View>

        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="Write down concepts, examples, formulas, or anything you want to remember..."
          placeholderTextColor="#626775"
          style={styles.contentInput}
          multiline
          textAlignVertical="top"
          maxLength={100000}
        />

        <Text style={styles.label}>NOTE DATE</Text>
        <TextInput
          value={noteDate}
          onChangeText={setNoteDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#626775"
          style={styles.dateInput}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
        <Text style={styles.helper}>
          Use YYYY-MM-DD. You can change the date to organize an earlier
          lecture.
        </Text>

        <Text style={styles.label}>PRIORITY</Text>
        <View style={styles.priorityRow}>
          {(
            [
              { value: "low", label: "Low", color: "#91BFFF" },
              { value: "medium", label: "Medium", color: "#FFC66D" },
              { value: "high", label: "High", color: "#FF8C9B" },
            ] as const
          ).map((item) => {
            const selected = priority === item.value;

            return (
              <Pressable
                key={item.value}
                onPress={() => setPriority(item.value)}
                style={[
                  styles.priorityChip,
                  selected && {
                    borderColor: item.color,
                    backgroundColor: `${item.color}18`,
                  },
                ]}
              >
                <View
                  style={[
                    styles.priorityDot,
                    { backgroundColor: item.color },
                  ]}
                />
                <Text
                  style={[
                    styles.priorityText,
                    selected && { color: item.color },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.pinCard}>
          <View style={styles.pinInfo}>
            <Text style={styles.pinTitle}>Pin this note</Text>
            <Text style={styles.helper}>
              Keep it easy to find later.
            </Text>
          </View>
          <Switch
            value={isPinned}
            onValueChange={setIsPinned}
            trackColor={{ false: "#303440", true: "#6D4ACB" }}
            thumbColor={isPinned ? "#D9CCFF" : "#B5BAC5"}
          />
        </View>

        <Pressable
          onPress={() => void saveNote()}
          disabled={saving || courses.length === 0}
          style={[
            styles.saveButton,
            (saving || courses.length === 0) && styles.disabledButton,
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>
              {editingId ? "Save changes" : "Save note"}
            </Text>
          )}
        </Pressable>

        <Text style={styles.footerText}>
          Your note is saved to your Syllo account.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#08090D",
  },
  container: {
    paddingHorizontal: 22,
    paddingTop: Platform.OS === "android" ? 48 : 62,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    backgroundColor: "#08090D",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 30,
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#171923",
    borderWidth: 1,
    borderColor: "#292C38",
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    color: "#F5F7FA",
    fontSize: 30,
    lineHeight: 34,
  },
  headerInfo: {
    flex: 1,
  },
  headerSpacer: {
    width: 12,
  },
  eyebrow: {
    color: "#A78BFA",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
  heading: {
    color: "#F5F7FA",
    fontSize: 28,
    fontWeight: "800",
    marginTop: 4,
  },
  label: {
    color: "#9A9EAB",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.3,
    marginBottom: 12,
    marginTop: 24,
  },
  courseGrid: {
    gap: 10,
  },
  courseChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#11131A",
    borderWidth: 1,
    borderColor: "#252834",
    borderRadius: 15,
    padding: 13,
  },
  courseDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  courseChipInfo: {
    flex: 1,
    gap: 3,
  },
  courseCode: {
    color: "#A78BFA",
    fontSize: 11,
    fontWeight: "800",
  },
  courseName: {
    color: "#F5F7FA",
    fontSize: 14,
    fontWeight: "600",
  },
  check: {
    fontSize: 20,
    fontWeight: "800",
  },
  titleInput: {
    backgroundColor: "#11131A",
    borderWidth: 1,
    borderColor: "#292C38",
    borderRadius: 14,
    color: "#F5F7FA",
    fontSize: 16,
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
  },
  optional: {
    color: "#626775",
    fontSize: 11,
  },
  contentInput: {
    minHeight: 220,
    backgroundColor: "#11131A",
    borderWidth: 1,
    borderColor: "#292C38",
    borderRadius: 14,
    color: "#F5F7FA",
    fontSize: 15,
    lineHeight: 24,
    padding: 15,
  },
  dateInput: {
    backgroundColor: "#11131A",
    borderWidth: 1,
    borderColor: "#292C38",
    borderRadius: 14,
    color: "#F5F7FA",
    fontSize: 15,
    paddingHorizontal: 15,
    paddingVertical: 14,
  },
  helper: {
    color: "#777D8A",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },
  priorityRow: {
    flexDirection: "row",
    gap: 8,
  },
  priorityChip: {
    flex: 1,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#11131A",
    borderWidth: 1,
    borderColor: "#292C38",
    borderRadius: 12,
    paddingHorizontal: 6,
  },
  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  priorityText: {
    color: "#A0A5B1",
    fontSize: 12,
    fontWeight: "700",
  },
  pinCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#11131A",
    borderWidth: 1,
    borderColor: "#252834",
    borderRadius: 15,
    padding: 15,
    marginTop: 25,
  },
  pinInfo: {
    flex: 1,
    gap: 3,
  },
  pinTitle: {
    color: "#F5F7FA",
    fontSize: 14,
    fontWeight: "700",
  },
  saveButton: {
    minHeight: 54,
    backgroundColor: "#8B5CF6",
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  disabledButton: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#211B35",
  },
  secondaryButtonText: {
    color: "#D1C4F7",
    fontWeight: "700",
  },
  errorTitle: {
    color: "#F5F7FA",
    fontSize: 20,
    fontWeight: "800",
  },
  muted: {
    color: "#858B98",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  emptyCard: {
    backgroundColor: "#11131A",
    borderRadius: 14,
    padding: 16,
  },
  footerText: {
    color: "#626775",
    fontSize: 11,
    textAlign: "center",
    marginTop: 15,
  },
});
