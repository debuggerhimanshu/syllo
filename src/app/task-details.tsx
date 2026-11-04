
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useAuth } from "@/context/AuthContext";
import {
  getLocalTasks,
  updateLocalTask,
  deleteLocalTask,
  type Task,
  type TaskPriority,
  type TaskEnergy,
} from "@/lib/tasks-repository";
import {
  getLocalCourses,
  type LocalCourse,
} from "@/lib/timetable-repository";

import { StatusBar } from "react-native";
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

export default function TaskDetailsScreen() {


  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [task, setTask] = useState<Task | null>(null);
  const [course, setCourse] = useState<LocalCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [energy, setEnergy] = useState<TaskEnergy>("medium");

  const loadTask = useCallback(async () => {
    if (!user?.id || !id) {
      setLoading(false);
      return;
    }

    try {
      const [allTasks, courses] = await Promise.all([
        getLocalTasks(user.id),
        getLocalCourses(user.id),
      ]);

      const foundTask = allTasks.find((item) => item.id === id);

      if (!foundTask) {
        setTask(null);
        return;
      }

      setTask(foundTask);
      setTitle(foundTask.title);
      setDescription(foundTask.description ?? "");
      setPriority(foundTask.priority);
      setEnergy(foundTask.energy_level);

      const foundCourse = courses.find(
        (item) => item.id === foundTask.course_id
      );

      setCourse(foundCourse ?? null);
    } catch (error) {
      console.error("Failed to load task:", error);
      Alert.alert("Error", "Unable to load task details.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, id]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  const handleSave = async () => {
    if (!user?.id || !task) return;

    if (!title.trim()) {
      Alert.alert("Title required", "Please enter a task title.");
      return;
    }

    setSaving(true);

    try {
      await updateLocalTask(user.id, task.id, {
        title: title.trim(),
        description: description.trim(),
        priority,
        energy_level: energy,
      });

      await loadTask();
      setEditing(false);
    } catch (error) {
      console.error("Task update failed:", error);
      Alert.alert("Error", "Could not update this task.");
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!user?.id || !task) return;

    const newStatus =
      task.status === "completed" ? "todo" : "completed";

    setSaving(true);

    try {
      await updateLocalTask(user.id, task.id, {
        status: newStatus,
      });

      await loadTask();
    } catch (error) {
      console.error("Task status update failed:", error);
      Alert.alert("Error", "Could not update task status.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!user?.id || !task) return;

    Alert.alert(
      "Delete task?",
      "This task will be removed from your device and synced to the cloud.",
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
              await deleteLocalTask(user.id, task.id);
              router.back();
            } catch (error) {
              console.error("Task deletion failed:", error);
              Alert.alert("Error", "Could not delete this task.");
            }
          },
        },
      ]
    );
  };

  const formatDate = (value: string | null) => {
    if (!value) return "No deadline set";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Invalid date";

    return date.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (value: string | null) => {
    if (!value) return "No time set";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Invalid time";

    return date.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const priorityColor = (value: string) => {
    if (value === "high") return "#E87979";
    if (value === "low") return "#60BFA0";
    return "#E5B75E";
  };

  const energyLabel = (value: TaskEnergy) => {
    if (value === "deep_focus") return "Deep Focus";
    if (value === "low") return "Low Energy";
    return "Medium";
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.purple} />
        <Text style={styles.loadingText}>Loading task...</Text>
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons
          name="alert-circle-outline"
          size={45}
          color={COLORS.muted}
        />
        <Text style={styles.notFoundTitle}>Task not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    // <View style={styles.container}>
   <ScrollFade style={styles.container}>
    <StatusBar
      barStyle="light-content"
      translucent
      backgroundColor="transparent"
    />
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
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="chevron-back"
            size={23}
            color={COLORS.text}
          />
        </Pressable>

        <Text style={styles.headerTitle}>Task Details</Text>

        <Pressable
          style={styles.headerButton}
          onPress={() => {
            if (editing) {
              setTitle(task.title);
              setDescription(task.description ?? "");
              setPriority(task.priority);
              setEnergy(task.energy_level);
            }

            setEditing(!editing);
          }}
        >
          <Ionicons
            name={editing ? "close-outline" : "create-outline"}
            size={21}
            color={COLORS.text}
          />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* CATEGORY */}
        <View style={styles.categoryRow}>
          <View style={styles.categoryBadge}>
            <Ionicons
              name={
                task.category === "academic"
                  ? "school-outline"
                  : "person-outline"
              }
              size={15}
              color={COLORS.purpleLight}
            />
            <Text style={styles.categoryText}>
              {task.category === "academic" ? "Academic" : "Personal"}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              task.status === "completed" && styles.completedBadge,
            ]}
          >
            <Text style={styles.statusText}>
              {task.status === "completed"
                ? "Completed"
                : task.status === "in_progress"
                  ? "In Progress"
                  : "To Do"}
            </Text>
          </View>
        </View>

        {/* TITLE */}
        {editing ? (
          <>
            <Text style={styles.fieldLabel}>TASK TITLE</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              style={styles.titleInput}
              placeholder="Task title"
              placeholderTextColor={COLORS.muted}
              maxLength={120}
            />
          </>
        ) : (
          <Text
            style={[
              styles.taskTitle,
              task.status === "completed" && styles.completedTitle,
            ]}
          >
            {task.title}
          </Text>
        )}

        {/* DESCRIPTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>

          {editing ? (
            <TextInput
              value={description}
              onChangeText={setDescription}
              style={styles.descriptionInput}
              placeholder="Add task description..."
              placeholderTextColor={COLORS.muted}
              multiline
              textAlignVertical="top"
            />
          ) : (
            <Text style={styles.description}>
              {task.description?.trim() || "No description added."}
            </Text>
          )}
        </View>

        {/* DEADLINE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Deadline</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Ionicons
                name="calendar-outline"
                size={20}
                color={COLORS.purpleLight}
              />
            </View>

            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Due date</Text>
              <Text style={styles.infoValue}>
                {formatDate(task.due_at)}
              </Text>
              <Text style={styles.infoSubValue}>
                {formatTime(task.due_at)}
              </Text>
            </View>
          </View>
        </View>

        {/* COURSE */}
        {task.category === "academic" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Course</Text>

            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Ionicons
                  name="book-outline"
                  size={20}
                  color={COLORS.purpleLight}
                />
              </View>

              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Associated course</Text>
                <Text style={styles.infoValue}>
                  {course?.name ?? "No course associated"}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* PRIORITY */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Priority</Text>

          {editing ? (
            <View style={styles.optionRow}>
              {(
                ["low", "medium", "high"] as TaskPriority[]
              ).map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setPriority(item)}
                  style={[
                    styles.optionChip,
                    priority === item && styles.optionSelected,
                  ]}
                >
                  <View
                    style={[
                      styles.priorityDot,
                      { backgroundColor: priorityColor(item) },
                    ]}
                  />
                  <Text
                    style={[
                      styles.optionText,
                      priority === item && styles.optionTextSelected,
                    ]}
                  >
                    {item.charAt(0).toUpperCase() + item.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Ionicons
                  name="flag-outline"
                  size={20}
                  color={priorityColor(task.priority)}
                />
              </View>

              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Current priority</Text>
                <Text style={styles.infoValue}>
                  {task.priority.charAt(0).toUpperCase() +
                    task.priority.slice(1)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ENERGY */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Energy required</Text>

          {editing ? (
            <View style={styles.energyOptions}>
              {(
                [
                  { value: "deep_focus", label: "Deep Focus" },
                  { value: "medium", label: "Medium" },
                  { value: "low", label: "Low Energy" },
                ] as const
              ).map((item) => (
                <Pressable
                  key={item.value}
                  onPress={() => setEnergy(item.value)}
                  style={[
                    styles.energyChip,
                    energy === item.value && styles.optionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      energy === item.value && styles.optionTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Ionicons
                  name="flash-outline"
                  size={20}
                  color={COLORS.purpleLight}
                />
              </View>

              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Energy level</Text>
                <Text style={styles.infoValue}>
                  {energyLabel(task.energy_level)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ESTIMATED EFFORT */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Estimated effort</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Ionicons
                name="time-outline"
                size={20}
                color={COLORS.purpleLight}
              />
            </View>

            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Estimated time</Text>
              <Text style={styles.infoValue}>
                {task.estimated_minutes} minutes
              </Text>
            </View>
          </View>
        </View>

        
          {/* REMINDER */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reminder</Text>

            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Ionicons
                  name="notifications-outline"
                  size={20}
                  color={COLORS.purpleLight}
                />
              </View>

              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Deadline reminder</Text>

                <Text style={styles.infoValue}>
                  {task.reminder_enabled ? "Enabled" : "Disabled"}
                </Text>

                {task.reminder_enabled && task.reminder_at ? (
                  <Text style={styles.infoSubValue}>
                    {formatDate(task.reminder_at)} · {formatTime(task.reminder_at)}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>


        {/* SAVE CHANGES */}
        {editing && (
          <Pressable
            style={[styles.primaryButton, saving && styles.disabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Ionicons
                  name="save-outline"
                  size={18}
                  color={COLORS.white}
                />
                <Text style={styles.primaryButtonText}>Save Changes</Text>
              </>
            )}
          </Pressable>
        )}

        {/* COMPLETE TASK */}
        {!editing && (
          <Pressable
            style={[
              styles.primaryButton,
              task.status === "completed" && styles.reopenButton,
            ]}
            onPress={handleComplete}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Ionicons
                  name={
                    task.status === "completed"
                      ? "refresh-outline"
                      : "checkmark-circle-outline"
                  }
                  size={19}
                  color={COLORS.white}
                />
                <Text style={styles.primaryButtonText}>
                  {task.status === "completed"
                    ? "Reopen Task"
                    : "Mark as Completed"}
                </Text>
              </>
            )}
          </Pressable>
        )}

        {/* DELETE */}
        {!editing && (
          <Pressable
            style={styles.deleteButton}
            onPress={handleDelete}
          >
            <Ionicons
              name="trash-outline"
              size={17}
              color="#E87979"
            />
            <Text style={styles.deleteText}>Delete Task</Text>
          </Pressable>
        )}

        <Text style={styles.footerText}>
          Created {formatDate(task.created_at)}
        </Text>
      </ScrollView>
      {/* </View> */}
      </ScrollFade>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  loadingText: {
    color: COLORS.muted,
    fontSize: 13,
  },
  notFoundTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
  },
  backText: {
    color: COLORS.purpleLight,
    fontSize: 14,
    fontWeight: "600",
  },
  header: {
  paddingHorizontal: 20,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottomWidth: 1,
  borderBottomColor: COLORS.border,
},
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "700",
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 25,
    paddingBottom: 50,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#27203D",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
  },
  categoryText: {
    color: COLORS.purpleLight,
    fontSize: 11,
    fontWeight: "700",
  },
  statusBadge: {
    backgroundColor: "#29243B",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
  },
  completedBadge: {
    backgroundColor: "#1D332B",
  },
  statusText: {
    color: "#B8A9FF",
    fontSize: 10,
    fontWeight: "700",
  },
  taskTitle: {
    color: COLORS.text,
    fontSize: 27,
    fontWeight: "800",
    lineHeight: 35,
    marginTop: 25,
  },
  completedTitle: {
    color: COLORS.muted,
    textDecorationLine: "line-through",
  },
  fieldLabel: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.3,
    marginTop: 24,
    marginBottom: 10,
  },
  titleInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    padding: 14,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
  },
  section: {
    marginTop: 27,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 13,
  },
  description: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 22,
  },
  descriptionInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    padding: 14,
    color: COLORS.text,
    fontSize: 13,
    minHeight: 95,
    lineHeight: 21,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#27203D",
    alignItems: "center",
    justifyContent: "center",
  },
  infoContent: {
    flex: 1,
    gap: 4,
  },
  infoLabel: {
    color: COLORS.muted,
    fontSize: 10,
  },
  infoValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
  },
  infoSubValue: {
    color: COLORS.muted,
    fontSize: 11,
  },
  optionRow: {
    flexDirection: "row",
    gap: 8,
  },
  optionChip: {
    flex: 1,
    minHeight: 45,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  optionSelected: {
    backgroundColor: "#27203D",
    borderColor: COLORS.purple,
  },
  optionText: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  optionTextSelected: {
    color: COLORS.text,
  },
  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  energyOptions: {
    gap: 9,
  },
  energyChip: {
    minHeight: 44,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 11,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  primaryButton: {
    minHeight: 52,
    backgroundColor: COLORS.purple,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 32,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "700",
  },
  reopenButton: {
    backgroundColor: "#4C9476",
  },
  disabled: {
    opacity: 0.6,
  },
  deleteButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  deleteText: {
    color: "#E87979",
    fontSize: 12,
    fontWeight: "700",
  },
  footerText: {
    color: "#656575",
    fontSize: 10,
    textAlign: "center",
    marginTop: 25,
  },
});
