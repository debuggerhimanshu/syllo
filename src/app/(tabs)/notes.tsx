import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";

import { getLocalCourses } from "@/lib/timetable-repository";
import { supabase } from "../../lib/supabase";

import {
  getLocalNotes,
  saveRemoteNotes,
} from "@/lib/notes-repository";

import { saveLocalCourse } from "@/lib/timetable-repository";
import { syncPendingNotes } from "@/lib/sync-engine";
import ScrollFade from "@/components/scroll-fade";

type Course = {
  id: string;
  name: string;
  code: string | null;
  faculty: string | null;
  color: string | null;
};
type Priority = "low" | "medium" | "high";
type Filter = "all" | "pinned" | Priority;

type Note = {
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

const priorityColors: Record<Priority, string> = {
  low: "#91BFFF",
  medium: "#FFC66D",
  high: "#FF8C9B",
};

export default function NotesTab() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [courses, setCourses] = useState<Course[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
    null
  );

  
const loadNotes = useCallback(async (showLoader = false) => {
  if (authLoading) return;

  if (!user?.id) {
    setCourses([]);
    setNotes([]);
    setError("Please sign in to view your notes.");
    setLoading(false);
    setRefreshing(false);
    return;
  }

  let localDataLoaded = false;
  let currentStep = "Starting Notes loading";

  try {
    setError("");

    // STEP 1: Load locally cached courses and notes.
    currentStep = "Loading local courses and notes";
    const [localCourses, localNotes] = await Promise.all([
      getLocalCourses(user.id),
      getLocalNotes(user.id),
    ]);

    setCourses(localCourses);
    setNotes(localNotes);
    localDataLoaded = true;

    setLoading(false);

    // STEP 1.5: Synchronize pending notes with Supabase.
    currentStep = "Synchronizing pending changes";
    try {
      await syncPendingNotes();
    } catch (syncError) {
      console.warn("Background note sync failed:", syncError);
    }

    // STEP 2: Refresh data from Supabase in the background.
// Cloud refresh is best-effort: local SQLite data is already available.
try {
  currentStep = "Fetching courses and notes from Supabase";

  const [courseResult, noteResult] = await Promise.all([
    supabase
      .from("courses")
      .select("id, name, code, faculty, color")
      .eq("user_id", user.id)
      .order("name", { ascending: true }),

    supabase
      .from("notes")
      .select(
        "id, user_id, course_id, title, content, note_date, priority, is_pinned, created_at, updated_at"
      )
      .eq("user_id", user.id)
      .order("note_date", { ascending: false })
      .order("updated_at", { ascending: false }),
  ]);

  if (courseResult.error) throw courseResult.error;
  if (noteResult.error) throw noteResult.error;

  // STEP 3: Cache cloud courses locally.
  currentStep = "Saving remote courses to SQLite";

  for (const course of courseResult.data ?? []) {
    await saveLocalCourse(
      {
        ...course,
        user_id: user.id,
      },
      false
    );
  }

  // STEP 4: Cache cloud notes without overwriting pending edits.
  currentStep = "Saving remote notes to SQLite";
  await saveRemoteNotes(user.id, noteResult.data ?? []);

  // STEP 5: Refresh the UI from SQLite.
  currentStep = "Reloading updated local data";

  const [updatedCourses, updatedNotes] = await Promise.all([
    getLocalCourses(user.id),
    getLocalNotes(user.id),
  ]);

  setCourses(updatedCourses);
  setNotes(updatedNotes);
} catch (cloudError) {
  console.warn("Background cloud notes refresh skipped:", cloudError);
}
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : String(err);

    const isNetworkError =
      /fetch failed|UnknownHostException|Network request failed|Failed to fetch|Unable to resolve host/i.test(
        errorMessage
      );

    if (!isNetworkError) {
      console.error("NOTES LOADING DIAGNOSTIC:", {
        failedAt: currentStep,
        errorName: err instanceof Error ? err.name : typeof err,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorCode: (err as any)?.code,
        errorDetails: JSON.stringify(
          err,
          Object.getOwnPropertyNames(err ?? {})
        ),
      });
    }

    // Keep cached content visible when cloud access fails.
    if (!localDataLoaded) {
      setError(
        "Couldn't load your notes. Please try again."
      );
    }
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
}, [user?.id, authLoading]);


  useFocusEffect(
  useCallback(() => {
    if (!authLoading) {
      void loadNotes(true);
    }
  }, [loadNotes, authLoading])
);

  const courseCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const note of notes) {
      if (note.course_id) {
        counts[note.course_id] = (counts[note.course_id] ?? 0) + 1;
      }
    }

    return counts;
  }, [notes]);

  const visibleNotes = useMemo(() => {
    const query = search.trim().toLowerCase();


    return notes.filter((note) => {
      const matchesSearch =
        !query ||
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query);

      const matchesFilter =
        filter === "all" ||
        (filter === "pinned" && note.is_pinned) ||
        note.priority === filter;

      const matchesCourse =
        selectedCourseId === null ||
        note.course_id === selectedCourseId;

      const matchesDate =
        !selectedDate || note.note_date === selectedDate;

      return (
        matchesSearch &&
        matchesFilter &&
        matchesCourse &&
        matchesDate
      );
    });
 }, [notes, search, filter, selectedCourseId, selectedDate]);

  
    const openNote = (noteId: string) => {
      router.push({
        pathname: "/note-details",
        params: { noteId },
      });
    };


  const openNewNote = (courseId?: string) => {
    router.push({
      pathname: "/note-editor",
      params: courseId ? { courseId } : {},
    });
  };

  const formatDate = (value: string) => {
    const date = new Date(`${value.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const courseName = (courseId: string | null) => {
    if (!courseId) return "General note";
    const course = courses.find((item) => item.id === courseId);
    return course ? `${course.code} · ${course.name}` : "Course unavailable";
  };

  const renderNote = (note: Note) => {
    const accent = priorityColors[note.priority] ?? priorityColors.medium;

    return (
      <Pressable
        key={note.id}
        onPress={() => openNote(note.id)}
        style={({ pressed }) => [
          styles.noteCard,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Open note ${note.title || "Untitled note"}`}
      >
        <View style={styles.noteTopRow}>
          <View style={styles.noteText}>
            <Text style={styles.noteTitle} numberOfLines={2}>
              {note.title || "Untitled note"}
            </Text>
            <Text style={styles.noteCourse} numberOfLines={1}>
              {courseName(note.course_id)}
            </Text>
          </View>

          {note.is_pinned ? (
            <Text style={styles.pinIcon}></Text>
          ) : null}
        </View>

        {note.content.trim() ? (
          <Text style={styles.notePreview} numberOfLines={3}>
            {note.content.trim()}
          </Text>
        ) : (
          <Text style={styles.notePreviewEmpty}>No text content</Text>
        )}

        <View style={styles.noteFooter}>
          <View style={[styles.priorityBadge, { borderColor: `${accent}70` }]}>
            <View style={[styles.priorityDot, { backgroundColor: accent }]} />
            <Text style={[styles.priorityText, { color: accent }]}>
              {note.priority.charAt(0).toUpperCase() +
                note.priority.slice(1)}
            </Text>
          </View>

          <Text style={styles.noteDate}>{formatDate(note.note_date)}</Text>
        </View>
      </Pressable>
    );
  };

  return (
  <ScrollFade style={styles.container}>
    <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadNotes();
            }}
            tintColor="#8B5CF6"
            colors={["#8B5CF6"]}
          />
        }
      >
        <Text style={styles.eyebrow}>YOUR STUDY SPACE</Text>
        <Text style={styles.title}>My Notes</Text>
        <Text style={styles.subtitle}>
          Your courses, your notes, all in one place.
        </Text>

        <Pressable
          onPress={() => openNewNote()}
          style={styles.createButton}
          accessibilityRole="button"
        >
          <Text style={styles.createButtonText}>+ Create Note</Text>
        </Pressable>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={styles.message}>Loading your notes...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>Couldn't load your notes</Text>
            <Text style={styles.message}>{error}</Text>
            <Pressable
              onPress={() => void loadNotes(true)}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryNumber}>{notes.length}</Text>
                <Text style={styles.summaryLabel}>Total notes</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryNumber}>
                  {notes.filter((note) => note.is_pinned).length}
                </Text>
                <Text style={styles.summaryLabel}>Pinned</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryNumber}>{courses.length}</Text>
                <Text style={styles.summaryLabel}>Courses</Text>
              </View>
            </View>

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search titles and note content..."
              placeholderTextColor="#777D8A"
              style={styles.searchInput}
              returnKeyType="search"
              clearButtonMode="while-editing"
              accessibilityLabel="Search notes"
            />

            <View style={styles.dateFilterRow}>
              <TextInput
                value={selectedDate}
                onChangeText={setSelectedDate}
                placeholder="Filter by date: YYYY-MM-DD"
                placeholderTextColor="#777D8A"
                style={styles.dateFilterInput}
                maxLength={10}
                keyboardType="numbers-and-punctuation"
              />

              {selectedDate.length > 0 && (
                <Pressable onPress={() => setSelectedDate("")}>
                  <Text style={styles.clearDateText}>Clear</Text>
                </Pressable>
              )}
            </View>

            <Text style={styles.sectionTitle}>Your notebooks</Text>
            {courses.length === 0 ? (
              <View style={styles.stateCard}>
                <Text style={styles.stateTitle}>No registered courses</Text>
                <Text style={styles.message}>
                  Add a course or import your FFCS timetable to get started.
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.courseRow}
              >
                <Pressable
                  onPress={() => setSelectedCourseId(null)}
                  style={[
                    styles.courseChip,
                    selectedCourseId === null && styles.courseChipSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.courseChipText,
                      selectedCourseId === null &&
                        styles.courseChipTextSelected,
                    ]}
                  >
                    All courses
                  </Text>
                </Pressable>

                {courses.map((course) => {
                  const selected = selectedCourseId === course.id;
                  const accent = course.color || "#8B5CF6";

                  return (
                    <Pressable
                      key={course.id}
                      onPress={() =>
                        setSelectedCourseId(selected ? null : course.id)
                      }
                      style={[
                        styles.courseChip,
                        selected && {
                          borderColor: accent,
                          backgroundColor: `${accent}22`,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.courseChipText,
                          selected && { color: accent },
                        ]}
                        numberOfLines={1}
                      >
                        {course.code} · {courseCounts[course.id] ?? 0}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <Text style={styles.sectionTitle}>Browse notes</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {(
                [
                  { value: "all", label: "All notes" },
                  { value: "pinned", label: " Pinned" },
                  { value: "high", label: "High priority" },
                  { value: "medium", label: "Medium" },
                  { value: "low", label: "Low" },
                ] as const
              ).map((item) => {
                const selected = filter === item.value;

                return (
                  <Pressable
                    key={item.value}
                    onPress={() => setFilter(item.value)}
                    style={[
                      styles.filterChip,
                      selected && styles.filterChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        selected && styles.filterTextSelected,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your saved notes</Text>
              <Text style={styles.count}>
                {visibleNotes.length}{" "}
                {visibleNotes.length === 1 ? "note" : "notes"}
              </Text>
            </View>

            {visibleNotes.length === 0 ? (
              <View style={styles.stateCard}>
                <Text style={styles.emptyIcon}>📝</Text>
                <Text style={styles.stateTitle}>
                  {notes.length === 0
                    ? "Your notebook is empty"
                    : "No matching notes"}
                </Text>
                <Text style={styles.message}>
                  {notes.length === 0
                    ? "Create your first note to keep your study material organized."
                    : "Try another search, course, or filter."}
                </Text>
                {notes.length === 0 ? (
                  <Pressable
                    onPress={() =>
                      openNewNote(selectedCourseId ?? undefined)
                    }
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>
                      Create your first note
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <View style={styles.noteList}>
                {visibleNotes.map(renderNote)}
              </View>
            )}
          </>
        )}
          </ScrollView>
  </ScrollFade>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08090D",
  },
  page: {
    paddingHorizontal: 22,
    paddingTop: 70,
    paddingBottom: 40,
  },
  eyebrow: {
    color: "#A78BFA",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
  },
  title: {
    color: "#F5F7FA",
    fontSize: 32,
    fontWeight: "800",
    marginTop: 8,
  },
  subtitle: {
    color: "#858B98",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  createButton: {
    backgroundColor: "#8B5CF6",
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginTop: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: "#11131A",
    borderWidth: 1,
    borderColor: "#242630",
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  summaryNumber: {
    color: "#F5F7FA",
    fontSize: 23,
    fontWeight: "800",
  },
  summaryLabel: {
    color: "#858B98",
    fontSize: 11,
    marginTop: 5,
  },
  searchInput: {
    backgroundColor: "#11131A",
    borderWidth: 1,
    borderColor: "#292C38",
    borderRadius: 14,
    color: "#F5F7FA",
    fontSize: 14,
    paddingHorizontal: 15,
    paddingVertical: 14,
    marginTop: 24,
  },

  dateFilterRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  marginTop: 12,
},

dateFilterInput: {
  flex: 1,
  backgroundColor: "#11131A",
  borderWidth: 1,
  borderColor: "#292C38",
  borderRadius: 14,
  color: "#F5F7FA",
  fontSize: 13,
  paddingHorizontal: 15,
  paddingVertical: 13,
},

clearDateText: {
  color: "#A78BFA",
  fontSize: 13,
  fontWeight: "700",
},

  sectionTitle: {
  color: "#F5F7FA",
  fontSize: 17,
  fontWeight: "700",
  marginTop: 12,
},  
  courseRow: {
    gap: 9,
    paddingVertical: 14,
  },
  courseChip: {
    backgroundColor: "#11131A",
    borderWidth: 1,
    borderColor: "#292C38",
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    maxWidth: 220,
  },
  courseChipSelected: {
    borderColor: "#8B5CF6",
    backgroundColor: "#8B5CF622",
  },
  courseChipText: {
    color: "#A0A5B1",
    fontSize: 12,
    fontWeight: "700",
  },
  courseChipTextSelected: {
    color: "#C4B5FD",
  },
  filterRow: {
    gap: 8,
    paddingVertical: 14,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: "#292C38",
    backgroundColor: "#11131A",
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  filterChipSelected: {
    backgroundColor: "#8B5CF6",
    borderColor: "#8B5CF6",
  },
  filterText: {
    color: "#A0A5B1",
    fontSize: 12,
    fontWeight: "700",
  },
  filterTextSelected: {
    color: "#FFFFFF",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 14,
  },
  count: {
    color: "#A78BFA",
    fontSize: 12,
    fontWeight: "700",
  },
  noteList: {
    gap: 12,
  },
  noteCard: {
    backgroundColor: "#11131A",
    borderWidth: 1,
    borderColor: "#242630",
    borderRadius: 17,
    padding: 16,
  },
  pressed: {
    opacity: 0.75,
  },
  noteTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  noteText: {
    flex: 1,
  },
  noteTitle: {
    color: "#F5F7FA",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
  },
  noteCourse: {
    color: "#A78BFA",
    fontSize: 11,
    marginTop: 5,
  },
  pinIcon: {
    fontSize: 15,
  },
  notePreview: {
    color: "#A0A5B1",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 12,
  },
  notePreviewEmpty: {
    color: "#626775",
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 12,
  },
  noteFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 15,
    gap: 8,
  },
  priorityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: "700",
  },
  noteDate: {
    color: "#858B98",
    fontSize: 11,
  },
  center: {
    minHeight: 200,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  stateCard: {
    backgroundColor: "#11131A",
    borderWidth: 1,
    borderColor: "#242630",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    marginTop: 12,
  },
  emptyIcon: {
    fontSize: 34,
    marginBottom: 12,
  },
  stateTitle: {
    color: "#F5F7FA",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    color: "#858B98",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
  },
  retryButton: {
    marginTop: 14,
    padding: 10,
  },
  retryText: {
    color: "#B69AFF",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryButton: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#211B35",
  },
  secondaryButtonText: {
    color: "#D1C4F7",
    fontWeight: "700",
  },
});