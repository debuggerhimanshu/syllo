import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";

import { supabase } from "@/lib/supabase";

type Course = {
  id: string;
  name: string;
  code: string | null;
};

type ClassData = {
  id: string;
  course_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  room: string | null;
};

type ConflictClass = {
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

export default function EditClass() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [weekday, setWeekday] = useState(1);

  const [startTime, setStartTime] = useState(
    new Date(2026, 0, 1, 10, 0)
  );

  const [endTime, setEndTime] = useState(
    new Date(2026, 0, 1, 11, 0)
  );

  const [room, setRoom] = useState("");

  const [showStartPicker, setShowStartPicker] =
    useState(false);

  const [showEndPicker, setShowEndPicker] =
    useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        { data: coursesData, error: coursesError },
        { data: classData, error: classError },
      ] = await Promise.all([
        supabase
          .from("courses")
          .select("id, name, code")
          .order("name"),

        supabase
          .from("classes")
          .select(
            "id, course_id, weekday, start_time, end_time, room"
          )
          .eq("id", id)
          .single(),
      ]);

      if (coursesError) {
        setError(coursesError.message);
        return;
      }

      if (classError) {
        setError(classError.message);
        return;
      }

      setCourses(coursesData ?? []);

      const existingClass =
        classData as ClassData;

      setCourseId(existingClass.course_id);
      setWeekday(existingClass.weekday);
      setRoom(existingClass.room ?? "");

      const [startHour, startMinute] =
        existingClass.start_time
          .slice(0, 5)
          .split(":")
          .map(Number);

      const [endHour, endMinute] =
        existingClass.end_time
          .slice(0, 5)
          .split(":")
          .map(Number);

      setStartTime(
        new Date(
          2026,
          0,
          1,
          startHour,
          startMinute
        )
      );

      setEndTime(
        new Date(
          2026,
          0,
          1,
          endHour,
          endMinute
        )
      );
    } catch (err) {
      console.error(
        "Edit class loading error:",
        err
      );

      setError(
        "Something went wrong while loading the class."
      );
    } finally {
      setLoading(false);
    }
  };

  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time
      .slice(0, 5)
      .split(":")
      .map(Number);

    return hours * 60 + minutes;
  };

  const saveChanges = async () => {
    if (!courseId) {
      Alert.alert(
        "Missing Course",
        "Please select a course."
      );
      return;
    }

    const newStartMinutes =
      startTime.getHours() * 60 +
      startTime.getMinutes();

    const newEndMinutes =
      endTime.getHours() * 60 +
      endTime.getMinutes();

    if (newEndMinutes <= newStartMinutes) {
      Alert.alert(
        "Invalid Time",
        "End time must be after start time."
      );
      return;
    }

    try {
      setSaving(true);

      const {
        data: existingClassesData,
        error: conflictError,
      } = await supabase
        .from("classes")
        .select(
          `
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
          `
        )
        .eq("weekday", weekday)
        .neq("id", id);

      if (conflictError) {
        Alert.alert(
          "Error",
          conflictError.message
        );
        return;
      }

      const existingClasses =
        (existingClassesData ??
          []) as ConflictClass[];

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

      if (conflictingClass) {
        const conflictingCourse =
          Array.isArray(
            conflictingClass.courses
          )
            ? conflictingClass.courses[0]
            : conflictingClass.courses;

        const courseName =
          conflictingCourse?.name ??
          "Another class";

        Alert.alert(
          "Class Conflict",
          `${courseName} already exists during this time.`
        );

        return;
      }

      const formatTime = (date: Date) => {
        const hours = String(
          date.getHours()
        ).padStart(2, "0");

        const minutes = String(
          date.getMinutes()
        ).padStart(2, "0");

        return `${hours}:${minutes}:00`;
      };

      const {
        error: updateError,
      } = await supabase
        .from("classes")
        .update({
          course_id: courseId,
          weekday,
          start_time: formatTime(startTime),
          end_time: formatTime(endTime),
          room: room.trim() || null,
        })
        .eq("id", id);

      if (updateError) {
        Alert.alert(
          "Update Failed",
          updateError.message
        );
        return;
      }

      Alert.alert(
        "Class Updated",
        "Your class has been updated successfully.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    } catch (err) {
      console.error(
        "Update class error:",
        err
      );

      Alert.alert(
        "Error",
        "Something went wrong while updating the class."
      );
    } finally {
      setSaving(false);
    }
  };

  const getDayName = (day: number) => {
    const days = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];

    return days[day - 1] ?? "Unknown";
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color="#8B5CF6"
        />

        <Text style={styles.loadingText}>
          Loading class...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>
          Couldn't load class
        </Text>

        <Text style={styles.errorText}>
          {error}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>
        Edit Class
      </Text>

      <Text style={styles.subtitle}>
        Update your class details
      </Text>

      {/* Course */}

      <Text style={styles.label}>
        Course
      </Text>

      <View style={styles.courseList}>
        {courses.map((course) => {
          const selected =
            course.id === courseId;

          return (
            <TouchableOpacity
              key={course.id}
              style={[
                styles.courseOption,
                selected &&
                  styles.courseOptionSelected,
              ]}
              activeOpacity={0.8}
              onPress={() =>
                setCourseId(course.id)
              }
            >
              <Text
                style={[
                  styles.courseName,
                  selected &&
                    styles.courseNameSelected,
                ]}
              >
                {course.name}
              </Text>

              {course.code && (
                <Text style={styles.courseCode}>
                  {course.code}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Day */}

      <Text style={styles.label}>
        Day
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dayScroll}
      >
        {[1, 2, 3, 4, 5, 6, 7].map(
          (day) => {
            const selected =
              weekday === day;

            return (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayButton,
                  selected &&
                    styles.dayButtonSelected,
                ]}
                activeOpacity={0.8}
                onPress={() =>
                  setWeekday(day)
                }
              >
                <Text
                  style={[
                    styles.dayText,
                    selected &&
                      styles.dayTextSelected,
                  ]}
                >
                  {getDayName(day).slice(
                    0,
                    3
                  )}
                </Text>
              </TouchableOpacity>
            );
          }
        )}
      </ScrollView>

      {/* Start Time */}

      <Text style={styles.label}>
        Start Time
      </Text>

      <TouchableOpacity
        style={styles.timeButton}
        activeOpacity={0.8}
        onPress={() =>
          setShowStartPicker(true)
        }
      >
        <Text style={styles.timeText}>
          {startTime.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </TouchableOpacity>

      {showStartPicker && (
        <DateTimePicker
          value={startTime}
          mode="time"
          is24Hour={false}
          display={
            Platform.OS === "ios"
              ? "spinner"
              : "default"
          }
          onChange={(
            _,
            selectedDate
          ) => {
            setShowStartPicker(false);

            if (selectedDate) {
              setStartTime(selectedDate);
            }
          }}
        />
      )}

      {/* End Time */}

      <Text style={styles.label}>
        End Time
      </Text>

      <TouchableOpacity
        style={styles.timeButton}
        activeOpacity={0.8}
        onPress={() =>
          setShowEndPicker(true)
        }
      >
        <Text style={styles.timeText}>
          {endTime.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </TouchableOpacity>

      {showEndPicker && (
        <DateTimePicker
          value={endTime}
          mode="time"
          is24Hour={false}
          display={
            Platform.OS === "ios"
              ? "spinner"
              : "default"
          }
          onChange={(
            _,
            selectedDate
          ) => {
            setShowEndPicker(false);

            if (selectedDate) {
              setEndTime(selectedDate);
            }
          }}
        />
      )}

      {/* Room */}

      <Text style={styles.label}>
        Room
      </Text>

      <TextInput
        value={room}
        onChangeText={setRoom}
        placeholder="e.g. AB101"
        placeholderTextColor="#666B78"
        style={styles.input}
      />

      {/* Save */}

      <TouchableOpacity
        style={[
          styles.saveButton,
          saving &&
            styles.saveButtonDisabled,
        ]}
        activeOpacity={0.8}
        disabled={saving}
        onPress={saveChanges}
      >
        {saving ? (
          <ActivityIndicator
            color="#FFFFFF"
          />
        ) : (
          <Text style={styles.saveButtonText}>
            Save Changes
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08090D",
  },

  content: {
    padding: 28,
    paddingTop: 70,
    paddingBottom: 50,
  },

  center: {
    flex: 1,
    backgroundColor: "#08090D",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },

  title: {
    color: "#F5F7FA",
    fontSize: 32,
    fontWeight: "800",
  },

  subtitle: {
    color: "#777D8A",
    fontSize: 15,
    marginTop: 8,
    marginBottom: 32,
  },

  label: {
    color: "#F5F7FA",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
    marginTop: 22,
  },

  courseList: {
    gap: 10,
  },

  courseOption: {
    backgroundColor: "#111318",
    borderWidth: 1,
    borderColor: "#20232B",
    borderRadius: 14,
    padding: 16,
  },

  courseOptionSelected: {
    borderColor: "#8B5CF6",
    backgroundColor: "#171322",
  },

  courseName: {
    color: "#F5F7FA",
    fontSize: 15,
    fontWeight: "600",
  },

  courseNameSelected: {
    color: "#A78BFA",
  },

  courseCode: {
    color: "#777D8A",
    fontSize: 12,
    marginTop: 4,
  },

  dayScroll: {
    marginHorizontal: -4,
  },

  dayButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#111318",
    borderWidth: 1,
    borderColor: "#20232B",
    marginHorizontal: 4,
  },

  dayButtonSelected: {
    backgroundColor: "#8B5CF6",
    borderColor: "#8B5CF6",
  },

  dayText: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "700",
  },

  dayTextSelected: {
    color: "#FFFFFF",
  },

  timeButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#111318",
    borderWidth: 1,
    borderColor: "#20232B",
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  timeText: {
    color: "#F5F7FA",
    fontSize: 16,
    fontWeight: "600",
  },

  input: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#111318",
    borderWidth: 1,
    borderColor: "#20232B",
    paddingHorizontal: 16,
    color: "#F5F7FA",
    fontSize: 15,
  },

  saveButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: "#8B5CF6",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 34,
  },

  saveButtonDisabled: {
    opacity: 0.6,
  },

  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  loadingText: {
    color: "#8F95A3",
    marginTop: 14,
  },

  errorTitle: {
    color: "#F5F7FA",
    fontSize: 20,
    fontWeight: "700",
  },

  errorText: {
    color: "#FF6B6B",
    textAlign: "center",
    marginTop: 10,
  },
});