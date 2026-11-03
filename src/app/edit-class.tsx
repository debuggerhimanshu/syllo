
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

import { useAuth } from "@/context/AuthContext";

import {
  getLocalCourses,
  getLocalSchedule,
  saveLocalClass,
  type LocalCourse,
  type LocalClass,
} from "@/lib/timetable-repository";

type Course = LocalCourse;

export default function EditClass() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();

  const [courses, setCourses] = useState<Course[]>([]);
  const [existingClass, setExistingClass] =
    useState<LocalClass | null>(null);

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
    let active = true;

    const loadData = async () => {
      if (authLoading) return;

      if (!user?.id || !id) {
        setError("Please sign in to edit this class.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        // Load courses and timetable from SQLite.
        const [coursesData, scheduleData] = await Promise.all([
          getLocalCourses(user.id),
          getLocalSchedule(user.id),
        ]);

        if (!active) return;

        const selectedClass = scheduleData.find(
          (item) => item.id === id
        );

        if (!selectedClass) {
          setError("Class not found in your local timetable.");
          return;
        }

        setCourses(coursesData);
        setExistingClass({
          id: selectedClass.id,
          course_id: selectedClass.course_id,
          weekday: selectedClass.weekday,
          start_time: selectedClass.start_time,
          end_time: selectedClass.end_time,
          room: selectedClass.room,
          slot: selectedClass.slot,
          valid_from: selectedClass.valid_from,
          valid_until: selectedClass.valid_until,
        });

        setCourseId(selectedClass.course_id);
        setWeekday(selectedClass.weekday);
        setRoom(selectedClass.room ?? "");

        const [startHour, startMinute] =
          selectedClass.start_time
            .slice(0, 5)
            .split(":")
            .map(Number);

        const [endHour, endMinute] =
          selectedClass.end_time
            .slice(0, 5)
            .split(":")
            .map(Number);

        setStartTime(
          new Date(2026, 0, 1, startHour, startMinute)
        );

        setEndTime(
          new Date(2026, 0, 1, endHour, endMinute)
        );
      } catch (err) {
        console.error("Edit class loading error:", err);

        if (active) {
          setError("Something went wrong while loading the class.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [id, user?.id, authLoading]);

  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time
      .slice(0, 5)
      .split(":")
      .map(Number);

    return hours * 60 + minutes;
  };

  const saveChanges = async () => {
    if (!user?.id || !existingClass) {
      Alert.alert("Error", "Class information is unavailable.");
      return;
    }

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

      // Check timetable conflicts using local SQLite data.
      const localSchedule = await getLocalSchedule(user.id);

      const conflictingClass = localSchedule.find(
        (item) => {
          if (item.id === id || item.weekday !== weekday) {
            return false;
          }

          const existingStart = timeToMinutes(item.start_time);
          const existingEnd = timeToMinutes(item.end_time);

          return (
            newStartMinutes < existingEnd &&
            newEndMinutes > existingStart
          );
        }
      );

      if (conflictingClass) {
        const courseName =
          conflictingClass.course?.name ?? "Another class";

        Alert.alert(
          "Class Conflict",
          `${courseName} already exists during this time.`
        );

        return;
      }

      const formatTime = (date: Date) => {
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");

        return `${hours}:${minutes}:00`;
      };

      // Save locally first and queue the change for cloud sync.
      await saveLocalClass({
        id: existingClass.id,
        course_id: courseId,
        weekday,
        start_time: formatTime(startTime),
        end_time: formatTime(endTime),
        room: room.trim() || null,
        slot: existingClass.slot,
        valid_from: existingClass.valid_from,
        valid_until: existingClass.valid_until,
      });

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
      console.error("Update class error:", err);

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

  if (authLoading || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#8B5CF6" />

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
          const selected = course.id === courseId;

          return (
            <TouchableOpacity
              key={course.id}
              style={[
                styles.courseOption,
                selected && styles.courseOptionSelected,
              ]}
              activeOpacity={0.8}
              onPress={() => setCourseId(course.id)}
            >
              <Text
                style={[
                  styles.courseName,
                  selected && styles.courseNameSelected,
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
        {[1, 2, 3, 4, 5, 6, 7].map((day) => {
          const selected = weekday === day;

          return (
            <TouchableOpacity
              key={day}
              style={[
                styles.dayButton,
                selected && styles.dayButtonSelected,
              ]}
              activeOpacity={0.8}
              onPress={() => setWeekday(day)}
            >
              <Text
                style={[
                  styles.dayText,
                  selected && styles.dayTextSelected,
                ]}
              >
                {getDayName(day).slice(0, 3)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Start Time */}

      <Text style={styles.label}>
        Start Time
      </Text>

      <TouchableOpacity
        style={styles.timeButton}
        activeOpacity={0.8}
        onPress={() => setShowStartPicker(true)}
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
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, selectedDate) => {
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
        onPress={() => setShowEndPicker(true)}
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
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, selectedDate) => {
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
          saving && styles.saveButtonDisabled,
        ]}
        activeOpacity={0.8}
        disabled={saving}
        onPress={saveChanges}
      >
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
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
