
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";

import { useAuth } from "@/context/AuthContext";
import { getLocalCourses, type LocalCourse } from "@/lib/timetable-repository";
import {
  createLocalTask,
  type TaskCategory,
  type TaskEnergy,
  type TaskPriority,
} from "@/lib/tasks-repository";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScrollFade from "@/components/scroll-fade";

const COLORS = {
  background: "#0A0A0F",
  surface: "#14141C",
  surfaceLight: "#1B1B26",
  border: "#292936",
  text: "#F5F5FA",
  muted: "#858594",
  purple: "#7657F6",
  purpleLight: "#A18AFF",
  white: "#FFFFFF",
};

export default function TaskCreateScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [category, setCategory] =
    useState<TaskCategory>("academic");

  const [priority, setPriority] =
    useState<TaskPriority>("medium");

  const [energy, setEnergy] =
    useState<TaskEnergy>("medium");

  const [courses, setCourses] = useState<LocalCourse[]>([]);
  const [selectedCourse, setSelectedCourse] =
    useState<string | null>(null);

  const [coursePickerOpen, setCoursePickerOpen] = useState(false);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingCourses, setLoadingCourses] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadCourses() {
      if (!user?.id) return;

      setLoadingCourses(true);

      try {
        const result = await getLocalCourses(user.id);

        if (active) setCourses(result);
      } catch (error) {
        console.error("Could not load courses:", error);
      } finally {
        if (active) setLoadingCourses(false);
      }
    }

    loadCourses();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const selectedCourseName =
    courses.find((course) => course.id === selectedCourse)?.name;

  const handleCategoryChange = (value: TaskCategory) => {
    setCategory(value);

    if (value === "personal") {
      setSelectedCourse(null);
    }
  };

  const handleDateChange = (_event: any, selected?: Date) => {
    setShowDatePicker(false);

    if (selected) {
      const updated = new Date(dueDate ?? new Date());
      updated.setFullYear(
        selected.getFullYear(),
        selected.getMonth(),
        selected.getDate()
      );

      setDueDate(updated);
      setShowTimePicker(true);
    }
  };

  const handleTimeChange = (_event: any, selected?: Date) => {
    setShowTimePicker(false);

    if (selected) {
      const updated = new Date(dueDate ?? new Date());
      updated.setHours(
        selected.getHours(),
        selected.getMinutes(),
        0,
        0
      );
      setDueDate(updated);
    }
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
    });

  const handleSave = async () => {
    if (!user?.id) {
      Alert.alert("Session unavailable", "Please sign in again.");
      return;
    }

    if (!title.trim()) {
      Alert.alert("Task title required", "Please enter a task title.");
      return;
    }

    if (category === "academic" && selectedCourse === null && courses.length > 0) {
      Alert.alert(
        "Select a course",
        "Choose a course for this academic task, or switch to Personal."
      );
      return;
    }

    setSaving(true);

    try {
      await createLocalTask(user.id, {
        title: title.trim(),
        description: description.trim(),
        category,
        task_type: "other",
        course_id: category === "academic" ? selectedCourse : null,
        priority,
        priority_mode: "manual",
        energy_level: energy,
        due_at: dueDate?.toISOString() ?? null,
        reminder_at:
          reminderEnabled && dueDate
            ? dueDate.toISOString()
            : null,
        reminder_enabled: reminderEnabled && dueDate !== null,
        estimated_minutes: 30,
      });

      Alert.alert(
        "Task created",
        "Your task has been saved on this device.",
        [
          {
            text: "Done",
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error("Task creation failed:", error);
      Alert.alert("Couldn't create task", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
  <ScrollFade style={styles.screen}>
    <StatusBar
      barStyle="light-content"
      translucent
      backgroundColor="transparent"
    />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* HEADER */}
        <View
  style={[
    styles.header,
    {
      minHeight: 62 + insets.top,
      paddingTop: insets.top,
    },
  ]}
>
          <Pressable
            onPress={() => router.back()}
            style={styles.iconButton}
            hitSlop={10}
          >
            <Ionicons name="close" size={23} color={COLORS.text} />
          </Pressable>

          <Text style={styles.headerTitle}>New Task</Text>

          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={[styles.createButton, saving && styles.disabled]}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Text style={styles.createButtonText}>Create</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          {/* TITLE */}
          <Text style={styles.fieldLabel}>TASK TITLE</Text>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="What needs to get done?"
            placeholderTextColor="#666675"
            style={styles.titleInput}
            maxLength={120}
          />

          {/* DESCRIPTION */}
          <Text style={styles.fieldLabel}>DESCRIPTION</Text>

          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Add some details about this task..."
            placeholderTextColor="#666675"
            multiline
            textAlignVertical="top"
            style={styles.descriptionInput}
            maxLength={1000}
          />

          {/* CATEGORY */}
          <Text style={styles.fieldLabel}>CATEGORY</Text>

          <View style={styles.segmentContainer}>
            {(["academic", "personal"] as TaskCategory[]).map((item) => {
              const selected = category === item;

              return (
                <Pressable
                  key={item}
                  onPress={() => handleCategoryChange(item)}
                  style={[
                    styles.segment,
                    selected && styles.segmentSelected,
                  ]}
                >
                  <Ionicons
                    name={item === "academic" ? "school-outline" : "person-outline"}
                    size={17}
                    color={selected ? "#17151F" : COLORS.muted}
                  />
                  <Text
                    style={[
                      styles.segmentText,
                      selected && styles.segmentTextSelected,
                    ]}
                  >
                    {item === "academic" ? "Academic" : "Personal"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* COURSE */}
          {category === "academic" && (
            <>
              <Text style={styles.fieldLabel}>COURSE</Text>

              <Pressable
                onPress={() => setCoursePickerOpen(!coursePickerOpen)}
                style={styles.selectionField}
              >
                <View style={styles.fieldIcon}>
                  <Ionicons name="book-outline" size={19} color={COLORS.muted} />
                </View>

                <Text
                  style={[
                    styles.selectionText,
                    !selectedCourseName && styles.placeholder,
                  ]}
                >
                  {loadingCourses
                    ? "Loading courses..."
                    : selectedCourseName ?? "Select a course"}
                </Text>

                <Ionicons
                  name={coursePickerOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={COLORS.muted}
                />
              </Pressable>

              {coursePickerOpen && (
                <View style={styles.dropdown}>
                  {courses.length === 0 ? (
                    <Text style={styles.emptyText}>
                      No courses found. You can still create this task without a course.
                    </Text>
                  ) : (
                    courses.map((course) => (
                      <Pressable
                        key={course.id}
                        onPress={() => {
                          setSelectedCourse(course.id);
                          setCoursePickerOpen(false);
                        }}
                        style={styles.dropdownItem}
                      >
                        <Text style={styles.dropdownText}>
                          {course.name}
                        </Text>

                        {selectedCourse === course.id && (
                          <Ionicons
                            name="checkmark"
                            size={19}
                            color={COLORS.purpleLight}
                          />
                        )}
                      </Pressable>
                    ))
                  )}
                </View>
              )}
            </>
          )}

          {/* DUE DATE */}
          <Text style={styles.fieldLabel}>DUE DATE & TIME</Text>

          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={styles.selectionField}
          >
            <View style={styles.fieldIcon}>
              <Ionicons name="calendar-outline" size={19} color={COLORS.muted} />
            </View>

            <Text
              style={[
                styles.selectionText,
                !dueDate && styles.placeholder,
              ]}
            >
              {dueDate
                ? `${formatDate(dueDate)} · ${formatTime(dueDate)}`
                : "Set due date"}
            </Text>

            {dueDate && (
              <Pressable
                onPress={() => {
                  setDueDate(null);
                  setReminderEnabled(false);
                }}
                hitSlop={10}
              >
                <Ionicons name="close-circle" size={19} color={COLORS.muted} />
              </Pressable>
            )}

            <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
          </Pressable>

          {/* PRIORITY */}
          <Text style={styles.fieldLabel}>PRIORITY</Text>

          <View style={styles.priorityRow}>
            {(
              [
                { value: "low", label: "Low", color: "#60BFA0" },
                { value: "medium", label: "Medium", color: "#E5B75E" },
                { value: "high", label: "High", color: "#E87979" },
              ] as const
            ).map((item) => {
              const selected = priority === item.value;

              return (
                <Pressable
                  key={item.value}
                  onPress={() => setPriority(item.value)}
                  style={[
                    styles.priorityOption,
                    selected && styles.prioritySelected,
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
                      selected && styles.priorityTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ENERGY */}
          <Text style={styles.fieldLabel}>ENERGY REQUIRED</Text>

          <View style={styles.energyContainer}>
            {(
              [
                { value: "deep_focus", label: "Deep Focus", icon: "flash" },
                { value: "medium", label: "Medium", icon: "sunny-outline" },
                { value: "low", label: "Low", icon: "leaf-outline" },
              ] as const
            ).map((item) => {
              const selected = energy === item.value;

              return (
                <Pressable
                  key={item.value}
                  onPress={() => setEnergy(item.value)}
                  style={[
                    styles.energyOption,
                    selected && styles.energySelected,
                  ]}
                >
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={selected ? COLORS.purpleLight : COLORS.muted}
                  />
                  <Text
                    style={[
                      styles.energyText,
                      selected && styles.energyTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* REMINDER */}
          <View style={styles.reminderCard}>
            <View style={styles.reminderIcon}>
              <Ionicons name="notifications-outline" size={21} color={COLORS.purpleLight} />
            </View>

            <View style={styles.reminderInfo}>
              <Text style={styles.reminderTitle}>Deadline reminder</Text>
              <Text style={styles.reminderSubtitle}>
                {dueDate
                  ? "Reminder settings for this deadline"
                  : "Set a due date first to enable a reminder"}
              </Text>
            </View>

            <Switch
              value={reminderEnabled}
              onValueChange={setReminderEnabled}
              disabled={!dueDate}
              trackColor={{ false: "#343440", true: "#7657F6" }}
              thumbColor={COLORS.white}
            />
          </View>

          <View style={styles.bottomNote}>
            <Ionicons name="cloud-upload-outline" size={15} color={COLORS.muted} />
            <Text style={styles.bottomNoteText}>
              Saved locally first. Cloud sync happens when connected.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {showDatePicker && (
        <DateTimePicker
          value={dueDate ?? new Date()}
          mode="date"
          minimumDate={new Date()}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleDateChange}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={dueDate ?? new Date()}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleTimeChange}
        />
      )}
      </ScrollFade>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    minHeight: 62,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "700",
  },
  createButton: {
    backgroundColor: COLORS.purple,
    borderRadius: 11,
    minWidth: 76,
    paddingHorizontal: 17,
    paddingVertical: 10,
    alignItems: "center",
  },
  createButtonText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 13,
  },
  disabled: {
    opacity: 0.6,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 50,
  },
  fieldLabel: {
    color: "#9292A2",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginTop: 25,
    marginBottom: 11,
  },
  titleInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    paddingHorizontal: 15,
    paddingVertical: 15,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
  },
  descriptionInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    padding: 15,
    color: COLORS.text,
    fontSize: 14,
    minHeight: 95,
    lineHeight: 21,
  },
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: 13,
    padding: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 5,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
  },
  segmentSelected: {
    backgroundColor: COLORS.white,
  },
  segmentText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  segmentTextSelected: {
    color: "#17151F",
  },
  selectionField: {
    minHeight: 55,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 11,
  },
  fieldIcon: {
    width: 28,
    alignItems: "center",
  },
  selectionText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "500",
  },
  placeholder: {
    color: "#707080",
  },
  dropdown: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 7,
    overflow: "hidden",
  },
  dropdownItem: {
    minHeight: 48,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dropdownText: {
    color: COLORS.text,
    fontSize: 13,
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 19,
    padding: 14,
  },
  priorityRow: {
    flexDirection: "row",
    gap: 9,
  },
  priorityOption: {
    flex: 1,
    minHeight: 47,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  prioritySelected: {
    borderColor: COLORS.purple,
    backgroundColor: "#211B35",
  },
  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  priorityText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  priorityTextSelected: {
    color: COLORS.text,
  },
  energyContainer: {
    gap: 9,
  },
  energyOption: {
    minHeight: 48,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  energySelected: {
    borderColor: COLORS.purple,
    backgroundColor: "#211B35",
  },
  energyText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  energyTextSelected: {
    color: COLORS.text,
  },
  reminderCard: {
    marginTop: 27,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  reminderIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#27203D",
    alignItems: "center",
    justifyContent: "center",
  },
  reminderInfo: {
    flex: 1,
    gap: 4,
  },
  reminderTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  reminderSubtitle: {
    color: COLORS.muted,
    fontSize: 10,
    lineHeight: 15,
  },
  bottomNote: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 7,
    marginTop: 25,
  },
  bottomNoteText: {
    color: COLORS.muted,
    fontSize: 10,
  },
});
