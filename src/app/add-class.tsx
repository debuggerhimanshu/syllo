import { useEffect, useState } from "react";
import { router } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";

import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { supabase } from "@/lib/supabase";

type Course = {
  id: string;
  name: string;
  code: string | null;
  faculty: string | null;
  color: string;
};

type ExistingClass = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  room: string | null;
  courses:
    | {
        id: string;
        name: string;
        code: string | null;
      }
    | {
        id: string;
        name: string;
        code: string | null;
      }[]
    | null;
};

export default function AddClassScreen() {
  // =====================================================
  // STATE
  // =====================================================

  const [courses, setCourses] = useState<Course[]>([]);

  const [selectedCourse, setSelectedCourse] =
    useState<Course | null>(null);

  const [selectedDay, setSelectedDay] =
    useState<number | null>(null);

  const [dayModalVisible, setDayModalVisible] =
    useState(false);

  const [loadingCourses, setLoadingCourses] =
    useState(true);

  const [courseModalVisible, setCourseModalVisible] =
    useState(false);

  const [error, setError] = useState("");

  const [room, setRoom] = useState("");

  const [saving, setSaving] = useState(false);

  // =====================================================
  // TIME STATE
  // =====================================================

  const [startTime, setStartTime] = useState(() => {
    const date = new Date();
    date.setHours(10, 0, 0, 0);
    return date;
  });

  const [endTime, setEndTime] = useState(() => {
    const date = new Date();
    date.setHours(11, 0, 0, 0);
    return date;
  });

  const [showStartPicker, setShowStartPicker] =
    useState(false);

  const [showEndPicker, setShowEndPicker] =
    useState(false);

  // =====================================================
  // DAYS
  // =====================================================

  const days = [
    { label: "Monday", value: 1 },
    { label: "Tuesday", value: 2 },
    { label: "Wednesday", value: 3 },
    { label: "Thursday", value: 4 },
    { label: "Friday", value: 5 },
    { label: "Saturday", value: 6 },
    { label: "Sunday", value: 7 },
  ];

  // =====================================================
  // FETCH COURSES
  // =====================================================

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoadingCourses(true);
      setError("");

      const { data, error } = await supabase
        .from("courses")
        .select(
          "id, name, code, faculty, color"
        )
        .order("name", {
          ascending: true,
        });

      if (error) {
        console.error(
          "Courses fetch error:",
          error
        );

        setError(error.message);
        return;
      }

      setCourses(data ?? []);
    } catch (err) {
      console.error(
        "Unexpected courses error:",
        err
      );

      setError(
        "Something went wrong while loading courses."
      );
    } finally {
      setLoadingCourses(false);
    }
  };

  // =====================================================
  // TIME HELPERS
  // =====================================================

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time
      .split(":")
      .map(Number);

    return hours * 60 + minutes;
  };

  const formatPostgresTime = (date: Date) => {
    const hours = String(
      date.getHours()
    ).padStart(2, "0");

    const minutes = String(
      date.getMinutes()
    ).padStart(2, "0");

    return `${hours}:${minutes}:00`;
  };

  // =====================================================
  // TIME PICKER HANDLERS
  // =====================================================

  const handleStartTimeChange = (
    event: any,
    selectedTime?: Date
  ) => {
    setShowStartPicker(false);

    if (selectedTime) {
      setStartTime(selectedTime);
    }
  };

  const handleEndTimeChange = (
    event: any,
    selectedTime?: Date
  ) => {
    setShowEndPicker(false);

    if (selectedTime) {
      setEndTime(selectedTime);
    }
  };

  // =====================================================
  // SAVE CLASS
  // =====================================================

  const handleSaveClass = async () => {
    try {
      setError("");

      // -----------------------------------------------
      // VALIDATION
      // -----------------------------------------------

      if (!selectedCourse) {
        setError("Please select a course.");
        return;
      }

      if (!selectedDay) {
        setError("Please select a day.");
        return;
      }

      const startMinutes =
        startTime.getHours() * 60 +
        startTime.getMinutes();

      const endMinutes =
        endTime.getHours() * 60 +
        endTime.getMinutes();

      if (endMinutes <= startMinutes) {
        setError(
          "End time must be after start time."
        );
        return;
      }

      // -----------------------------------------------
      // CHECK FOR SCHEDULE CONFLICT
      // -----------------------------------------------

      const {
        data: existingClassesData,
        error: conflictError,
      } = await supabase
        .from("classes")
        .select(`
          id,
          weekday,
          start_time,
          end_time,
          room,
          courses (
            id,
            name,
            code
          )
        `)
        .eq("weekday", selectedDay);

      if (conflictError) {
        console.error(
          "Conflict check error:",
          conflictError
        );

        setError(
          "Unable to check for schedule conflicts."
        );

        return;
      }

      // Explicitly type the Supabase result.
      // This prevents TypeScript from treating
      // the relational `courses` value as `never`.

      const existingClasses =
        (existingClassesData ??
          []) as ExistingClass[];

      // -----------------------------------------------
      // COMPARE TIMES
      // -----------------------------------------------

      const newStartMinutes =
        startTime.getHours() * 60 +
        startTime.getMinutes();

      const newEndMinutes =
        endTime.getHours() * 60 +
        endTime.getMinutes();

      const conflictingClass =
        existingClasses.find(
          (existingClass) => {
            const existingStart =
              timeToMinutes(
                existingClass.start_time
              );

            const existingEnd =
              timeToMinutes(
                existingClass.end_time
              );

            return (
              newStartMinutes <
                existingEnd &&
              newEndMinutes >
                existingStart
            );
          }
        );

      // -----------------------------------------------
      // CONFLICT FOUND
      // -----------------------------------------------

      if (conflictingClass) {
        let courseName =
          "another class";

        if (
          Array.isArray(
            conflictingClass.courses
          )
        ) {
          courseName =
            conflictingClass.courses[0]
              ?.name ?? "another class";
        } else {
          courseName =
            conflictingClass.courses
              ?.name ?? "another class";
        }

        const existingStart =
          conflictingClass.start_time.slice(
            0,
            5
          );

        const existingEnd =
          conflictingClass.end_time.slice(
            0,
            5
          );

        setError(
          `Schedule conflict with ${courseName} (${existingStart} - ${existingEnd}).`
        );

        return;
      }

      // -----------------------------------------------
      // CONVERT TIME
      // -----------------------------------------------

      const postgresStartTime =
        formatPostgresTime(startTime);

      const postgresEndTime =
        formatPostgresTime(endTime);

      // -----------------------------------------------
      // SAVE TO SUPABASE
      // -----------------------------------------------

      setSaving(true);

      const {
        error: insertError,
      } = await supabase
        .from("classes")
        .insert({
          course_id: selectedCourse.id,
          weekday: selectedDay,
          start_time: postgresStartTime,
          end_time: postgresEndTime,
          room: room.trim() || null,
        });

      if (insertError) {
        console.error(
          "Class insert error:",
          insertError
        );

        setError(insertError.message);
        return;
      }

      
      // -----------------------------------------------
      // SUCCESS — refresh class reminders
      // -----------------------------------------------

      router.back();

    } catch (err) {
      console.error(
        "Unexpected save class error:",
        err
      );

      setError(
        "Something went wrong while saving the class."
      );
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // UI
  // =====================================================

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.8}
            onPress={() => router.back()}
          >
            <Text style={styles.backIcon}>
              ‹
            </Text>
          </TouchableOpacity>

          <View>
            <Text style={styles.title}>
              Add Class
            </Text>

            <Text style={styles.subtitle}>
              Add a class to your weekly schedule
            </Text>
          </View>
        </View>

        {/* ================================================= */}
        {/* COURSE */}
        {/* ================================================= */}

        <View style={styles.section}>
          <Text style={styles.label}>
            COURSE
          </Text>

          <TouchableOpacity
            style={styles.input}
            activeOpacity={0.8}
            onPress={() =>
              setCourseModalVisible(true)
            }
          >
            <Text
              style={
                selectedCourse
                  ? styles.selectedText
                  : styles.placeholder
              }
            >
              {selectedCourse
                ? selectedCourse.name
                : "Select a course"}
            </Text>

            <Text style={styles.chevron}>
              ›
            </Text>
          </TouchableOpacity>
        </View>

        {/* ================================================= */}
        {/* ERROR */}
        {/* ================================================= */}

        {error ? (
          <Text style={styles.errorText}>
            {error}
          </Text>
        ) : null}

        {/* ================================================= */}
        {/* DAY */}
        {/* ================================================= */}

        <View style={styles.section}>
          <Text style={styles.label}>
            DAY
          </Text>

          <TouchableOpacity
            style={styles.input}
            activeOpacity={0.8}
            onPress={() =>
              setDayModalVisible(true)
            }
          >
            <Text
              style={
                selectedDay
                  ? styles.selectedText
                  : styles.placeholder
              }
            >
              {selectedDay
                ? days.find(
                    (day) =>
                      day.value ===
                      selectedDay
                  )?.label
                : "Select a day"}
            </Text>

            <Text style={styles.chevron}>
              ›
            </Text>
          </TouchableOpacity>
        </View>

        {/* ================================================= */}
        {/* TIME */}
        {/* ================================================= */}

        <View style={styles.row}>
          {/* START TIME */}

          <View style={styles.halfSection}>
            <Text style={styles.label}>
              START TIME
            </Text>

            <TouchableOpacity
              style={styles.input}
              activeOpacity={0.8}
              onPress={() =>
                setShowStartPicker(true)
              }
            >
              <Text style={styles.selectedText}>
                {formatTime(startTime)}
              </Text>

              <Text style={styles.chevron}>
                ›
              </Text>
            </TouchableOpacity>

            {showStartPicker && (
              <DateTimePicker
                value={startTime}
                mode="time"
                is24Hour={false}
                display="default"
                onChange={
                  handleStartTimeChange
                }
              />
            )}
          </View>

          {/* END TIME */}

          <View style={styles.halfSection}>
            <Text style={styles.label}>
              END TIME
            </Text>

            <TouchableOpacity
              style={styles.input}
              activeOpacity={0.8}
              onPress={() =>
                setShowEndPicker(true)
              }
            >
              <Text style={styles.selectedText}>
                {formatTime(endTime)}
              </Text>

              <Text style={styles.chevron}>
                ›
              </Text>
            </TouchableOpacity>

            {showEndPicker && (
              <DateTimePicker
                value={endTime}
                mode="time"
                is24Hour={false}
                display="default"
                onChange={
                  handleEndTimeChange
                }
              />
            )}
          </View>
        </View>

        {/* ================================================= */}
        {/* ROOM */}
        {/* ================================================= */}

        <View style={styles.section}>
          <Text style={styles.label}>
            ROOM
          </Text>

          <TextInput
            style={styles.textInput}
            placeholder="e.g. AB101"
            placeholderTextColor="#777D8A"
            value={room}
            onChangeText={setRoom}
            autoCapitalize="characters"
          />
        </View>

        {/* ================================================= */}
        {/* SAVE */}
        {/* ================================================= */}

        <TouchableOpacity
          style={[
            styles.saveButton,
            saving &&
              styles.saveButtonDisabled,
          ]}
          activeOpacity={0.8}
          onPress={handleSaveClass}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <Text style={styles.saveButtonText}>
              Save Class
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* ================================================= */}
      {/* COURSE MODAL */}
      {/* ================================================= */}

      <Modal
        visible={courseModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setCourseModalVisible(false)
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  Select Course
                </Text>

                <Text
                  style={styles.modalSubtitle}
                >
                  Choose the course for this class
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setCourseModalVisible(false)
                }
              >
                <Text
                  style={styles.closeButton}
                >
                  ×
                </Text>
              </TouchableOpacity>
            </View>

            {loadingCourses ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator
                  size="large"
                  color="#8B5CF6"
                />

                <Text
                  style={styles.loadingText}
                >
                  Loading courses...
                </Text>
              </View>
            ) : courses.length === 0 ? (
              <View style={styles.noCourses}>
                <Text
                  style={styles.noCoursesTitle}
                >
                  No courses yet
                </Text>

                <Text
                  style={styles.noCoursesText}
                >
                  Create a course first before
                  adding a class.
                </Text>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={
                  false
                }
              >
                {courses.map((course) => (
                  <TouchableOpacity
                    key={course.id}
                    style={
                      styles.courseOption
                    }
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedCourse(
                        course
                      );
                      setCourseModalVisible(
                        false
                      );
                    }}
                  >
                    <View
                      style={[
                        styles.courseDot,
                        {
                          backgroundColor:
                            course.color ||
                            "#8B5CF6",
                        },
                      ]}
                    />

                    <View
                      style={
                        styles.courseOptionInfo
                      }
                    >
                      <Text
                        style={
                          styles.courseOptionName
                        }
                      >
                        {course.name}
                      </Text>

                      {course.code ? (
                        <Text
                          style={
                            styles.courseOptionCode
                          }
                        >
                          {course.code}
                        </Text>
                      ) : null}
                    </View>

                    {selectedCourse?.id ===
                    course.id ? (
                      <Text
                        style={
                          styles.checkmark
                        }
                      >
                        ✓
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ================================================= */}
      {/* DAY MODAL */}
      {/* ================================================= */}

      <Modal
        visible={dayModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setDayModalVisible(false)
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  Select Day
                </Text>

                <Text
                  style={styles.modalSubtitle}
                >
                  Choose the day for this class
                </Text>
              </View>

              <TouchableOpacity
                onPress={() =>
                  setDayModalVisible(false)
                }
              >
                <Text
                  style={styles.closeButton}
                >
                  ×
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
            >
              {days.map((day) => (
                <TouchableOpacity
                  key={day.value}
                  style={styles.dayOption}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedDay(
                      day.value
                    );
                    setDayModalVisible(
                      false
                    );
                  }}
                >
                  <Text
                    style={
                      styles.dayOptionText
                    }
                  >
                    {day.label}
                  </Text>

                  {selectedDay ===
                    day.value && (
                    <Text
                      style={
                        styles.checkmark
                      }
                    >
                      ✓
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ===================================================== */
/* STYLES */
/* ===================================================== */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08090D",
  },

  content: {
    paddingHorizontal: 24,
    paddingTop: 52,
    paddingBottom: 50,
  },

  /* ========================= */
  /* HEADER */
  /* ========================= */

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 40,
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#111318",
    borderWidth: 1,
    borderColor: "#20232B",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  backIcon: {
    color: "#F5F7FA",
    fontSize: 32,
    fontWeight: "300",
    lineHeight: 34,
    marginTop: -3,
  },

  title: {
    color: "#F5F7FA",
    fontSize: 26,
    fontWeight: "800",
  },

  subtitle: {
    color: "#777D8A",
    fontSize: 13,
    marginTop: 4,
  },

  /* ========================= */
  /* FORM */
  /* ========================= */

  section: {
    marginBottom: 24,
  },

  label: {
    color: "#777D8A",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 9,
  },

  input: {
    height: 56,
    backgroundColor: "#111318",
    borderWidth: 1,
    borderColor: "#20232B",
    borderRadius: 15,
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  placeholder: {
    color: "#8F95A3",
    fontSize: 14,
    flex: 1,
  },

  selectedText: {
    color: "#F5F7FA",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },

  chevron: {
    color: "#777D8A",
    fontSize: 24,
    fontWeight: "300",
  },

  errorText: {
    color: "#FF6B6B",
    fontSize: 13,
    marginTop: -12,
    marginBottom: 20,
    lineHeight: 19,
  },

  /* ========================= */
  /* TIME */
  /* ========================= */

  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },

  halfSection: {
    flex: 1,
  },

  /* ========================= */
  /* ROOM */
  /* ========================= */

  textInput: {
    height: 56,
    backgroundColor: "#111318",
    borderWidth: 1,
    borderColor: "#20232B",
    borderRadius: 15,
    paddingHorizontal: 17,
    color: "#F5F7FA",
    fontSize: 14,
  },

  /* ========================= */
  /* SAVE */
  /* ========================= */

  saveButton: {
    height: 56,
    borderRadius: 15,
    backgroundColor: "#8B5CF6",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  saveButtonDisabled: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  /* ========================= */
  /* MODAL */
  /* ========================= */

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },

  modalContainer: {
    backgroundColor: "#111318",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 35,
    maxHeight: "70%",
    borderWidth: 1,
    borderColor: "#20232B",
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },

  modalTitle: {
    color: "#F5F7FA",
    fontSize: 20,
    fontWeight: "800",
  },

  modalSubtitle: {
    color: "#777D8A",
    fontSize: 13,
    marginTop: 5,
  },

  closeButton: {
    color: "#9CA3AF",
    fontSize: 30,
    fontWeight: "300",
  },

  modalLoading: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 45,
  },

  loadingText: {
    color: "#8F95A3",
    marginTop: 12,
    fontSize: 13,
  },

  noCourses: {
    alignItems: "center",
    paddingVertical: 45,
  },

  noCoursesTitle: {
    color: "#F5F7FA",
    fontSize: 17,
    fontWeight: "700",
  },

  noCoursesText: {
    color: "#777D8A",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },

  /* ========================= */
  /* COURSE OPTIONS */
  /* ========================= */

  courseOption: {
    minHeight: 70,
    backgroundColor: "#171A21",
    borderWidth: 1,
    borderColor: "#20232B",
    borderRadius: 16,
    marginBottom: 10,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
  },

  courseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 13,
  },

  courseOptionInfo: {
    flex: 1,
  },

  courseOptionName: {
    color: "#F5F7FA",
    fontSize: 15,
    fontWeight: "700",
  },

  courseOptionCode: {
    color: "#777D8A",
    fontSize: 12,
    marginTop: 4,
  },

  /* ========================= */
  /* DAY OPTIONS */
  /* ========================= */

  dayOption: {
    minHeight: 58,
    backgroundColor: "#171A21",
    borderWidth: 1,
    borderColor: "#20232B",
    borderRadius: 15,
    marginBottom: 9,
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dayOptionText: {
    color: "#F5F7FA",
    fontSize: 15,
    fontWeight: "600",
  },

  /* ========================= */
  /* CHECKMARK */
  /* ========================= */

  checkmark: {
    color: "#8B5CF6",
    fontSize: 20,
    fontWeight: "700",
    marginLeft: 10,
  },
});