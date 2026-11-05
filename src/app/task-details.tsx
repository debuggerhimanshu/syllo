
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import DateTimePicker from "@react-native-community/datetimepicker";
import { postponeLocalTask } from "@/lib/tasks-repository";

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
import { scheduleTaskReminder } from "@/lib/notifications";
import { cancelTaskReminder } from "@/lib/notifications";
import { calculateTaskPriority } from "@/lib/priority-engine";
import {
  startTaskSession,
  pauseTaskSession,
  getActiveTaskSession,
  getTaskActualDuration,
  getTaskSessions,
  type TaskTimeSession,
} from "@/lib/time-tracking-repository";

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

  // TIME TRACKING
const [activeSession, setActiveSession] =
  useState<TaskTimeSession | null>(null);

const [actualSeconds, setActualSeconds] = useState(0);
const [timerNow, setTimerNow] = useState(Date.now());
const [timerLoading, setTimerLoading] = useState(true);

  const [showPostponeDatePicker, setShowPostponeDatePicker] = useState(false);
  const [showPostponeTimePicker, setShowPostponeTimePicker] = useState(false);
  const [showPostponeReasonModal, setShowPostponeReasonModal] = useState(false);
  const [postponeDate, setPostponeDate] = useState<Date | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [priorityMode, setPriorityMode] = useState<"manual" | "automatic">("automatic");
  const [energy, setEnergy] = useState<TaskEnergy>("medium");

  const isTaskTimerActive =
  activeSession?.task_id === id &&
  activeSession?.ended_at === null;

const currentSessionSeconds = isTaskTimerActive
  ? Math.max(
      0,
      Math.floor(
        (timerNow - new Date(activeSession.started_at).getTime()) / 1000
      )
    )
  : 0;

const totalActualSeconds =
  actualSeconds + currentSessionSeconds;

  const livePriority = task
    ? calculateTaskPriority({
        category: task.category,
        due_at: task.due_at,
        estimated_minutes: task.estimated_minutes,
      })
    : null;

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
      setPriorityMode(foundTask.priority_mode ?? "automatic");
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
   
  // =========================================
// TIME TRACKING: SESSION RECOVERY
// =========================================

useEffect(() => {
  let cancelled = false;

  const loadTimeTracking = async () => {
    if (!user?.id || !id) return;

    setTimerLoading(true);

    try {
      const [sessions, active] = await Promise.all([
        getTaskSessions(user.id, id),
        getActiveTaskSession(user.id),
      ]);

      const completedSeconds = sessions
        .filter((session) => session.ended_at !== null)
        .reduce(
          (total, session) => total + session.duration_seconds,
          0
        );

      if (!cancelled) {
        setActualSeconds(completedSeconds);
        setActiveSession(active);
        setTimerNow(Date.now());
      }
    } catch (error) {
      console.error("Failed to load time tracking:", error);
    } finally {
      if (!cancelled) {
        setTimerLoading(false);
      }
    }
  };

  loadTimeTracking();

  return () => {
    cancelled = true;
  };
}, [user?.id, id]);

// =========================================
// TIME TRACKING: LIVE CLOCK
// =========================================

useEffect(() => {
  if (!activeSession || activeSession.task_id !== id) return;

  const interval = setInterval(() => {
    setTimerNow(Date.now());
  }, 1000);

  return () => clearInterval(interval);
}, [activeSession, id]);

const handleStartTimer = async () => {
  if (!user?.id || !task) return;

  try {
    const session = await startTaskSession(user.id, task.id);
    setActiveSession(session);
    setTimerNow(Date.now());
  } catch (error) {
    Alert.alert(
      "Focus session",
      error instanceof Error
        ? error.message
        : "Unable to start the focus session."
    );
  }
};

const handlePauseTimer = async () => {
  if (!user?.id || !task) return;

  try {
    await pauseTaskSession(user.id, task.id);

    const [sessions, active] = await Promise.all([
      getTaskSessions(user.id, task.id),
      getActiveTaskSession(user.id),
    ]);

    const completedSeconds = sessions
      .filter((session) => session.ended_at !== null)
      .reduce((total, session) => total + session.duration_seconds, 0);

    setActualSeconds(completedSeconds);
    setActiveSession(active);
    setTimerNow(Date.now());
  } catch (error) {
    Alert.alert(
      "Focus session",
      error instanceof Error
        ? error.message
        : "Unable to pause the focus session."
    );
  }
};
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
        priority:
          priorityMode === "automatic"
            ? livePriority?.priority ?? priority
            : priority,
        priority_mode: priorityMode,
        energy_level: energy,
      });

      await scheduleTaskReminder({
        id: task.id,
        title: title.trim(),
        description: description.trim(),
        reminder_at: task.reminder_at,
        reminder_enabled: task.reminder_enabled,
        status: task.status,
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

    if (newStatus === "completed") {
      await cancelTaskReminder(task.id);
    } else {
      await scheduleTaskReminder({
        id: task.id,
        title: task.title,
        description: task.description,
        reminder_at: task.reminder_at,
        reminder_enabled: task.reminder_enabled,
        status: newStatus,
      });
    }

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
              await cancelTaskReminder(task.id);
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

  const handlePostponeDateChange = (_event: any, selected?: Date) => {
  setShowPostponeDatePicker(false);

  if (selected) {
    const updated = new Date(postponeDate ?? new Date());
    updated.setFullYear(
      selected.getFullYear(),
      selected.getMonth(),
      selected.getDate()
    );

    setPostponeDate(updated);
    setShowPostponeTimePicker(true);
  }
};

const handlePostponeTimeChange = (_event: any, selected?: Date) => {
  setShowPostponeTimePicker(false);

  if (!selected) return;

  const updated = new Date(postponeDate ?? new Date());

  updated.setHours(
    selected.getHours(),
    selected.getMinutes(),
    0,
    0
  );

  if (updated.getTime() <= Date.now()) {
    Alert.alert(
      "Invalid deadline",
      "Please choose a future date and time."
    );
    return;
  }

  setPostponeDate(updated);

  const count = task?.postponed_count ?? 0;

  if (count >= 2) {
    setShowPostponeReasonModal(true);
  } else {
    savePostponement(updated, null);
  }
};

const savePostponement = async (date: Date, reason: string | null) => {
  if (!user?.id || !task) return;

  try {
    setSaving(true);

    await postponeLocalTask(
      user.id,
      task.id,
      reason,
      date.toISOString()
    );

    await scheduleTaskReminder({
      id: task.id,
      title: task.title,
      description: task.description,
      reminder_at: task.reminder_enabled ? date.toISOString() : null,
      reminder_enabled: task.reminder_enabled,
      status: task.status,
    });

    setPostponeDate(null);

    await loadTask();

    const newCount = task.postponed_count + 1;

    if (newCount >= 3) {
      Alert.alert(
        "Let's make this easier",
        "This task has been postponed several times. Try breaking it into smaller actions so it's easier to get started."
      );
    } else if (newCount === 2) {
      Alert.alert(
        "A gentle reminder",
        "You've postponed this task twice. Try setting aside a small amount of time to get started."
      );
    } else {
      Alert.alert("Task rescheduled", "Your new deadline has been saved.");
    }
  } catch (error) {
    console.error("Postponement failed:", error);
    Alert.alert("Error", "Could not reschedule this task.");
  } finally {
    setSaving(false);
  }
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
              setPriorityMode(task.priority_mode ?? "automatic");
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
    <>
      {/* PRIORITY MODE */}
      <View style={styles.priorityModeRow}>
        <Pressable
          onPress={() => setPriorityMode("automatic")}
          style={[
            styles.priorityModeOption,
            priorityMode === "automatic" && styles.priorityModeSelected,
          ]}
        >
          <Ionicons name="sparkles-outline" size={16} color={priorityMode === "automatic" ? COLORS.purpleLight : COLORS.muted} />
          <Text style={[
            styles.priorityModeText,
            priorityMode === "automatic" && styles.priorityModeTextSelected,
          ]}>
            Automatic
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setPriorityMode("manual")}
          style={[
            styles.priorityModeOption,
            priorityMode === "manual" && styles.priorityModeSelected,
          ]}
        >
          <Ionicons name="options" size={16} color={priorityMode === "manual" ? COLORS.purpleLight : COLORS.muted} />
          <Text style={[
            styles.priorityModeText,
            priorityMode === "manual" && styles.priorityModeTextSelected,
          ]}>
            Manual
          </Text>
        </Pressable>
      </View>

      {priorityMode === "automatic" ? (
        <View style={styles.priorityHint}>
          <Text style={styles.priorityHintLabel}>
            CALCULATED PRIORITY
          </Text>

          <Text style={[
            styles.priorityHintValue,
            { color: priorityColor(livePriority?.priority ?? "medium") },
          ]}>
            {(livePriority?.priority ?? "medium").toUpperCase()}
          </Text>

          <Text style={styles.priorityHintReason}>
            {livePriority?.reason ?? "Priority will be calculated automatically."}
          </Text>
        </View>
      ) : (
        <View style={styles.optionRow}>
          {(["low", "medium", "high"] as TaskPriority[]).map((item) => (
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
      )}
    </>
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
          {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </Text>

        <Text style={styles.infoSubValue}>
          {task.priority_mode === "manual" ? "Manually assigned" : "Automatically calculated"}
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

                {/* FOCUS TIMER */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Focus timer</Text>

          <View style={styles.focusTimerCard}>
            <Text style={styles.focusTimerLabel}>
              {isTaskTimerActive ? "FOCUS SESSION IN PROGRESS" : "TOTAL TIME SPENT"}
            </Text>

            <Text style={styles.focusTimerValue}>
              {[
                Math.floor(totalActualSeconds / 3600),
                Math.floor((totalActualSeconds % 3600) / 60),
                totalActualSeconds % 60,
              ]
                .map((value) => String(value).padStart(2, "0"))
                .join(":")}
            </Text>

            <View style={styles.focusTimerComparison}>
              <Text style={styles.focusTimerMeta}>
                Estimated: {task.estimated_minutes} min
              </Text>
              <Text style={styles.focusTimerMeta}>
                Actual: {Math.floor(totalActualSeconds / 60)} min
              </Text>
            </View>

            {activeSession && activeSession.task_id !== id ? (
              <Text style={styles.focusTimerWarning}>
                Another task's focus session is running.
              </Text>
            ) : (
              <Pressable
                style={[
                  styles.focusTimerButton,
                  isTaskTimerActive && styles.focusTimerPauseButton,
                  task.status === "completed" && styles.disabled,
                ]}
                disabled={task.status === "completed" || timerLoading}
                onPress={
                  isTaskTimerActive ? handlePauseTimer : handleStartTimer
                }
              >
                <Ionicons
                  name={isTaskTimerActive ? "pause" : "play"}
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.focusTimerButtonText}>
                  {isTaskTimerActive
                    ? "Pause Session"
                    : actualSeconds > 0
                      ? "Resume Focus"
                      : "Start Focus"}
                </Text>
              </Pressable>
            )}
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

        {/* POSTPONE TASK */}
        {!editing && task.status !== "completed" && (
          <Pressable
            style={styles.postponeButton}
            onPress={() => {
              setPostponeDate(
                task.due_at && new Date(task.due_at) > new Date()
                  ? new Date(task.due_at)
                  : new Date(Date.now() + 24 * 60 * 60 * 1000)
              );
              setShowPostponeDatePicker(true);
            }}
            disabled={saving}
          >
            <Ionicons name="calendar-outline" size={18} color={COLORS.purpleLight} />
            <Text style={styles.postponeButtonText}>Postpone Task</Text>
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
        {/* POSTPONEMENT REASON MODAL */}
<Modal
  visible={showPostponeReasonModal}
  transparent
  animationType="fade"
  onRequestClose={() => {
    setShowPostponeReasonModal(false);
    setPostponeDate(null);
  }}
>
  <View style={styles.reasonModalOverlay}>
    <View style={styles.reasonModalCard}>
      <View style={styles.reasonModalIcon}>
        <Ionicons
          name="help-circle-outline"
          size={25}
          color={COLORS.purpleLight}
        />
      </View>

      <Text style={styles.reasonModalTitle}>
        What's getting in the way?
      </Text>

      <Text style={styles.reasonModalSubtitle}>
        You've postponed this task several times. Let's understand why.
      </Text>

      {[
        "Too difficult",
        "No time",
        "Low motivation",
        "Forgot",
        "Other",
      ].map((reason) => (
        <Pressable
          key={reason}
          style={styles.reasonOption}
          onPress={() => {
            if (!postponeDate) return;

            setShowPostponeReasonModal(false);
            savePostponement(postponeDate, reason);
          }}
        >
          <Text style={styles.reasonOptionText}>{reason}</Text>
          <Ionicons
            name="chevron-forward"
            size={17}
            color={COLORS.muted}
          />
        </Pressable>
      ))}

      <Pressable
        style={styles.reasonCancelButton}
        onPress={() => {
          setShowPostponeReasonModal(false);
          setPostponeDate(null);
        }}
      >
        <Text style={styles.reasonCancelText}>Cancel</Text>
      </Pressable>
    </View>
  </View>
</Modal>

      {showPostponeDatePicker && (
      <DateTimePicker
        value={postponeDate ?? new Date()}
        mode="date"
        minimumDate={new Date()}
        display={Platform.OS === "ios" ? "spinner" : "default"}
        onChange={handlePostponeDateChange}
      />
    )}

    {showPostponeTimePicker && (
      <DateTimePicker
        value={postponeDate ?? new Date()}
        mode="time"
        display={Platform.OS === "ios" ? "spinner" : "default"}
        onChange={handlePostponeTimeChange}
      />
    )}

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

  priorityModeRow: {
  flexDirection: "row",
  gap: 10,
  marginBottom: 12,
},
priorityModeOption: {
  flex: 1,
  minHeight: 45,
  backgroundColor: COLORS.surface,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: COLORS.border,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
},
priorityModeSelected: {
  backgroundColor: "#211B35",
  borderColor: COLORS.purple,
},
priorityModeText: {
  color: COLORS.muted,
  fontSize: 13,
  fontWeight: "500",
},
priorityModeTextSelected: {
  color: COLORS.white,
},
priorityHint: {
  backgroundColor: COLORS.surface,
  borderWidth: 1,
  borderColor: COLORS.border,
  borderRadius: 12,
  padding: 14,
  marginBottom: 12,
  gap: 6,
},
priorityHintLabel: {
  color: COLORS.muted,
  fontSize: 10,
  fontWeight: "700",
  letterSpacing: 1,
},
priorityHintValue: {
  fontSize: 17,
  fontWeight: "800",
},
priorityHintReason: {
  color: COLORS.muted,
  fontSize: 12,
  lineHeight: 18,
},

postponeButton: {
  minHeight: 48,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: COLORS.purple,
  backgroundColor: "#211B35",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
  marginTop: 16,
},
postponeButtonText: {
  color: COLORS.purpleLight,
  fontSize: 13,
  fontWeight: "700",
},


reasonModalOverlay: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.75)",
  justifyContent: "center",
  alignItems: "center",
  padding: 24,
},
reasonModalCard: {
  width: "100%",
  backgroundColor: COLORS.surface,
  borderRadius: 20,
  borderWidth: 1,
  borderColor: COLORS.border,
  padding: 20,
},
reasonModalIcon: {
  width: 48,
  height: 48,
  borderRadius: 15,
  backgroundColor: "#27203D",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 16,
},
reasonModalTitle: {
  color: COLORS.text,
  fontSize: 19,
  fontWeight: "800",
  marginBottom: 7,
},
reasonModalSubtitle: {
  color: COLORS.muted,
  fontSize: 12,
  lineHeight: 19,
  marginBottom: 17,
},
reasonOption: {
  minHeight: 46,
  borderTopWidth: 1,
  borderTopColor: COLORS.border,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
},
reasonOptionText: {
  color: COLORS.text,
  fontSize: 13,
  fontWeight: "500",
},
reasonCancelButton: {
  marginTop: 12,
  minHeight: 43,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: COLORS.surfaceLight,
  borderRadius: 11,
},
reasonCancelText: {
  color: COLORS.muted,
  fontSize: 13,
  fontWeight: "600",
},

  focusTimerCard: {
    backgroundColor: "#14141F",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#29243D",
    alignItems: "center",
  },
  focusTimerLabel: {
    color: "#A5A1B5",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  focusTimerValue: {
    color: "#FFFFFF",
    fontSize: 38,
    fontWeight: "700",
    marginTop: 12,
    fontVariant: ["tabular-nums"],
  },
  focusTimerComparison: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 14,
  },
  focusTimerMeta: {
    color: "#B8B4C7",
    fontSize: 12,
  },
  focusTimerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7657F6",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 24,
    marginTop: 20,
    gap: 9,
    width: "100%",
  },
  focusTimerPauseButton: {
    backgroundColor: "#38304F",
  },
  focusTimerButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  focusTimerWarning: {
    color: "#F0B86E",
    fontSize: 12,
    marginTop: 16,
    textAlign: "center",
  },

});
