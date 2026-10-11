import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
type Course = {
  id: string;
  name: string;
  code: string;
  faculty: string | null;
  color: string | null;
};
export default function NotesTab() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const loadCourses = useCallback(async () => {
    setError("");
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        setCourses([]);
        setError("Please sign in to view your courses.");
        return;
      }
      const { data, error: coursesError } = await supabase
        .from("courses")
        .select("id, name, code, faculty, color")
        .eq("user_id", user.id)
        .order("name", { ascending: true });
      if (coursesError) throw coursesError;
      setCourses((data ?? []) as Course[]);
    } catch (err) {
      console.error("Failed to load courses:", err);
      setError("Couldn't load your courses. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadCourses();
  }, [loadCourses]);
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>YOUR STUDY SPACE</Text>
      <Text style={styles.title}>My Notes</Text>
      <Text style={styles.subtitle}>
        Your courses, your notes, all in one place.
      </Text>
      <Pressable
        onPress={() => router.push("/note-editor")}
        style={styles.createButton}
        accessibilityRole="button"
        accessibilityLabel="Create a new note"
      >
        <Text style={styles.createButtonText}>+ Create Note</Text>
      </Pressable>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your courses</Text>
        <Text style={styles.count}>
          {courses.length} {courses.length === 1 ? "course" : "courses"}
        </Text>
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.message}>Loading your courses...</Text>
        </View>
      ) : error ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Something went wrong</Text>
          <Text style={styles.message}>{error}</Text>
          <Text style={styles.retry} onPress={() => {
            setLoading(true);
            void loadCourses();
          }}>
            Try again
          </Text>
        </View>
      ) : courses.length === 0 ? (
        <View style={styles.stateCard}>
          <Text style={styles.emptyIcon}>📚</Text>
          <Text style={styles.stateTitle}>No courses yet</Text>
          <Text style={styles.message}>
            Add courses or import your FFCS timetable to get started.
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#8B5CF6"
              colors={["#8B5CF6"]}
            />
          }
        >
          {courses.map((course) => {
            const accent = course.color || "#8B5CF6";
            return (
              <View key={course.id} style={styles.courseCard}>
                <View
                  style={[
                    styles.courseAccent,
                    { backgroundColor: accent },
                  ]}
                />
                <View style={styles.courseContent}>
                  <View style={styles.courseTopRow}>
                    <View
                      style={[
                        styles.courseIcon,
                        { backgroundColor: `${accent}22` },
                      ]}
                    >
                      <Text
                        style={[styles.courseInitial, { color: accent }]}
                      >
                        {(course.code || course.name || "?")
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.courseInfo}>
                      <Text style={styles.courseCode}>
                        {course.code}
                      </Text>
                      <Text style={styles.courseName}>
                        {course.name}
                      </Text>
                      {course.faculty ? (
                        <Text style={styles.faculty}>
                          {course.faculty}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.cardFooter}>
                    <Text style={styles.notebookLabel}>
                      COURSE NOTEBOOK
                    </Text>
                    <Text style={styles.comingSoon}>
                      Notes setup in progress
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08090D",
    paddingHorizontal: 22,
    paddingTop: 70,
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 32,
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#F5F7FA",
    fontSize: 18,
    fontWeight: "700",
  },
  count: {
    color: "#A78BFA",
    fontSize: 12,
    fontWeight: "700",
  },
  list: {
    paddingBottom: 32,
    gap: 14,
  },
  courseCard: {
    flexDirection: "row",
    backgroundColor: "#11131A",
    borderWidth: 1,
    borderColor: "#242630",
    borderRadius: 18,
    overflow: "hidden",
  },
  courseAccent: {
    width: 4,
  },
  courseContent: {
    flex: 1,
    padding: 16,
  },
  courseTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  courseIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  courseInitial: {
    fontSize: 19,
    fontWeight: "800",
  },
  courseInfo: {
    flex: 1,
  },
  courseCode: {
    color: "#A78BFA",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  courseName: {
    color: "#F5F7FA",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 4,
  },
  faculty: {
    color: "#858B98",
    fontSize: 12,
    marginTop: 5,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: "#242630",
    marginTop: 16,
    paddingTop: 12,
    gap: 5,
  },
  notebookLabel: {
    color: "#777D8A",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  comingSoon: {
    color: "#A0A5B1",
    fontSize: 12,
  },
  center: {
    flex: 1,
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
  retry: {
    color: "#B69AFF",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 18,
    padding: 8,
  },
});
