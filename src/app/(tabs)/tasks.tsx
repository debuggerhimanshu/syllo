import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";


import { useAuth } from "@/context/AuthContext";
import { getLocalTasks, type Task } from "@/lib/tasks-repository";
import ScrollFade from "@/components/scroll-fade";

type CategoryFilter = "all" | "academic" | "personal";

const COLORS = {
  background: "#0A0A0F",
  surface: "#14141C",
  border: "#292936",
  text: "#F5F5FA",
  muted: "#858594",
  purple: "#7657F6",
};

export default function TasksTab() {
  const router = useRouter();
  const { user } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    if (!user?.id) {
      setTasks([]);
      setLoading(false);
      return;
    }

    try {
      const result = await getLocalTasks(user.id);
      setTasks(result);
    } catch (error) {
      console.error("Failed to load tasks:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks])
  );

  const filteredTasks = tasks.filter((task) => {
    return filter === "all" || task.category === filter;
  });

  const pendingCount = tasks.filter(
    (task) => task.status !== "completed"
  ).length;

  const completedCount = tasks.filter(
    (task) => task.status === "completed"
  ).length;

  const formatDueDate = (value: string | null) => {
    if (!value) return "No deadline";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Invalid date";

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "#E87979";
      case "low":
        return "#60BFA0";
      default:
        return "#E5B75E";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "in_progress":
        return "In progress";
      case "completed":
        return "Completed";
      default:
        return "To do";
    }
  };

  const renderTask = (task: Task) => (
  <Pressable
    key={task.id}
    style={styles.taskCard}
    onPress={() =>
      router.push({
        pathname: "/task-details",
        params: { id: task.id },
      })
    }
  >
      <View style={styles.taskTopRow}>
        <View style={styles.taskCategory}>
          <Ionicons
            name={
              task.category === "academic"
                ? "school-outline"
                : "person-outline"
            }
            size={13}
            color="#A18AFF"
          />
          <Text style={styles.categoryText}>
            {task.category === "academic" ? "Academic" : "Personal"}
          </Text>
        </View>

        <View style={styles.priorityContainer}>
          <View
            style={[
              styles.priorityDot,
              { backgroundColor: getPriorityColor(task.priority) },
            ]}
          />
          <Text style={styles.priorityText}>
            {task.priority.charAt(0).toUpperCase() +
              task.priority.slice(1)}
          </Text>
        </View>
      </View>

      <Text
        style={[
          styles.taskTitle,
          task.status === "completed" && styles.completedTitle,
        ]}
      >
        {task.title}
      </Text>

      {!!task.description && (
        <Text style={styles.taskDescription} numberOfLines={2}>
          {task.description}
        </Text>
      )}

      <View style={styles.taskBottomRow}>
        <View style={styles.taskMeta}>
          <Ionicons
            name="calendar-outline"
            size={14}
            color={COLORS.muted}
          />
          <Text style={styles.metaText}>
            {formatDueDate(task.due_at)}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            task.status === "completed" && styles.completedBadge,
          ]}
        >
          <Text style={styles.statusText}>
            {getStatusLabel(task.status)}
          </Text>
        </View>
      </View>
        </Pressable>
  );

  return (
  <ScrollFade style={styles.container}>
    <StatusBar
      barStyle="light-content"
      translucent
      backgroundColor="transparent"
    />

    <View
      style={[
        styles.content,
      ]}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>STAY ORGANIZED</Text>
          <Text style={styles.title}>My Tasks</Text>
          <Text style={styles.subtitle}>
            Your goals, one step at a time.
          </Text>
        </View>

        <Pressable
          style={styles.addButton}
          onPress={() => router.push("/task-create")}
        >
          <Ionicons name="add" size={25} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{completedCount}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{tasks.length}</Text>
          <Text style={styles.statLabel}>Total tasks</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your tasks</Text>

        <Pressable onPress={loadTasks}>
          <Ionicons name="refresh-outline" size={19} color={COLORS.muted} />
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {(
          [
            { label: "All", value: "all" },
            { label: "Academic", value: "academic" },
            { label: "Personal", value: "personal" },
          ] as const
        ).map((item) => (
          <Pressable
            key={item.value}
            onPress={() => setFilter(item.value)}
            style={[
              styles.filterChip,
              filter === item.value && styles.activeFilter,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                filter === item.value && styles.activeFilterText,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={COLORS.purple} size="large" />
          <Text style={styles.emptySubtitle}>Loading your tasks...</Text>
        </View>
      ) : filteredTasks.length > 0 ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.taskList}
        >
          {filteredTasks.map(renderTask)}
        </ScrollView>
      ) : (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="checkmark-done-outline"
              size={34}
              color="#A18AFF"
            />
          </View>

          <Text style={styles.emptyTitle}>
            {tasks.length === 0
              ? "Nothing on your list yet"
              : "No tasks in this category"}
          </Text>

          <Text style={styles.emptySubtitle}>
            {tasks.length === 0
              ? "Add your first academic or personal task and start planning your day."
              : "Try another category to see your tasks."}
          </Text>

          {tasks.length === 0 && (
            <Pressable
              style={styles.createButton}
              onPress={() => router.push("/task-create")}
            >
              <Ionicons name="add" size={19} color="#FFFFFF" />
              <Text style={styles.createButtonText}>
                Create your first task
              </Text>
            </Pressable>
          )}
        </View>
      )}
        </View>
  </ScrollFade>
);
}

const styles = StyleSheet.create({
content: {
  flex: 1,
  paddingHorizontal: 22,
},
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 65,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: {
    color: "#9292A2",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  title: {
    color: COLORS.text,
    fontSize: 31,
    fontWeight: "800",
    marginTop: 7,
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 13,
    marginTop: 7,
  },
  addButton: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: COLORS.purple,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 27,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
  },
  statNumber: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "800",
  },
  statLabel: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 5,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 30,
    marginBottom: 15,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "700",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 17,
  },
  filterChip: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activeFilter: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  filterText: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  activeFilterText: {
    color: "#17151F",
  },
  taskList: {
    paddingBottom: 35,
    gap: 12,
  },
  taskCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  taskTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  taskCategory: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryText: {
    color: "#A18AFF",
    fontSize: 11,
    fontWeight: "600",
  },
  priorityContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  priorityText: {
    color: COLORS.muted,
    fontSize: 10,
  },
  taskTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 15,
  },
  completedTitle: {
    textDecorationLine: "line-through",
    color: COLORS.muted,
  },
  taskDescription: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },
  taskBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 17,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  taskMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    color: COLORS.muted,
    fontSize: 11,
  },
  statusBadge: {
    backgroundColor: "#29243B",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
  completedBadge: {
    backgroundColor: "#1D332B",
  },
  statusText: {
    color: "#B8A9FF",
    fontSize: 10,
    fontWeight: "600",
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    marginTop: 35,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 25,
    paddingVertical: 35,
    alignItems: "center",
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 23,
    backgroundColor: "#27203D",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  emptySubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 10,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: COLORS.purple,
    paddingHorizontal: 19,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 25,
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
