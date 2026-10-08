import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import { supabase } from "@/lib/supabase";

type Course = {
  id: string;
  name: string;
  code: string | null;
  faculty: string | null;
  color: string;
};

type Class = {
  id: string;
  course_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  room: string | null;
};

type ScheduleItem = Class & {
  course: Course | null;
};

export default function ScheduleTab() {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchSchedule = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const { data, error } = await supabase
        .from("classes")
        .select(`
          id,
          course_id,
          weekday,
          start_time,
          end_time,
          room,
          courses (
            id,
            name,
            code,
            faculty,
            color
          )
        `)
        .order("weekday", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) {
        console.error("Schedule fetch error:", error);
        setError(error.message);
        return;
      }

      const formattedData: ScheduleItem[] = (data ?? []).map(
        (item: any) => {
          const course = Array.isArray(item.courses)
            ? item.courses[0] ?? null
            : item.courses ?? null;

          return {
            id: item.id,
            course_id: item.course_id,
            weekday: item.weekday,
            start_time: item.start_time,
            end_time: item.end_time,
            room: item.room,
            course,
          };
        }
      );

      setSchedule(formattedData);

      console.log("Schedule loaded:", formattedData);
    } catch (err) {
      console.error("Unexpected schedule error:", err);
      setError("Something went wrong while loading your schedule.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /*
   * Fetch every time the Schedule tab becomes active.
   */
  useFocusEffect(
    useCallback(() => {
      fetchSchedule();
    }, [])
  );

  const handleRefresh = () => {
    fetchSchedule(true);
  };

  const getDayName = (weekday: number) => {
    const days = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];

    return days[weekday - 1] ?? "Unknown";
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color="#8B5CF6"
        />

        <Text style={styles.loadingText}>
          Loading your schedule...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>
          Couldn't load schedule
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
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#8B5CF6"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>
            Schedule
          </Text>

          <Text style={styles.subtitle}>
            Your weekly classes
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          activeOpacity={0.8}
          onPress={() => router.push("/add-class")}
        >
          <Text style={styles.addButtonText}>
            +
          </Text>
        </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.importButton}
          activeOpacity={0.8}
          onPress={() => router.push("/import-ffcs")}
        >
          <Text style={styles.importButtonText}>
            Import FFCS Timetable
          </Text>
        </TouchableOpacity> 

        

      {/* Schedule */}
      {schedule.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            No classes yet
          </Text>

          <Text style={styles.emptyText}>
            Add your courses and classes to see your
            timetable here.
          </Text>
        </View>
      ) : (
        schedule.map((item) => (
  <TouchableOpacity
    key={item.id}
    style={styles.classCard}
    activeOpacity={0.8}
    onPress={() =>
      router.push({
        pathname: "/class-details",
        params: {
          id: item.id,
        },
      })
    }
  >
    <View style={styles.daySection}>
      <Text style={styles.day}>
        {getDayName(item.weekday)}
      </Text>

      <Text style={styles.time}>
        {item.start_time.slice(0, 5)} –{" "}
        {item.end_time.slice(0, 5)}
      </Text>
    </View>

    <View style={styles.classInfo}>
      <Text style={styles.courseName}>
        {item.course?.name ?? "Unknown course"}
      </Text>

      {item.course?.code && (
        <Text style={styles.courseCode}>
          {item.course.code}
        </Text>
      )}

      {item.room && (
        <Text style={styles.room}>
          Room {item.room}
        </Text>
      )}
    </View>
  </TouchableOpacity>
))
      )}
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
    paddingBottom: 40,
  },

  center: {
    flex: 1,
    backgroundColor: "#08090D",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },

  title: {
    color: "#F5F7FA",
    fontSize: 32,
    fontWeight: "800",
  },

  subtitle: {
    color: "#777D8A",
    marginTop: 10,
    fontSize: 15,
  },

  addButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#8B5CF6",
    alignItems: "center",
    justifyContent: "center",
  },

  addButtonText: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "400",
    lineHeight: 30,
  },

  importButton: {
  height: 50,
  borderRadius: 14,
  backgroundColor: "#111318",
  borderWidth: 1,
  borderColor: "#8B5CF6",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 22,
},

importButtonText: {
  color: "#A78BFA",
  fontSize: 14,
  fontWeight: "700",
},

  loadingText: {
    color: "#8F95A3",
    marginTop: 14,
    fontSize: 14,
  },

  errorTitle: {
    color: "#F5F7FA",
    fontSize: 20,
    fontWeight: "700",
  },

  errorText: {
    color: "#FF6B6B",
    marginTop: 10,
    textAlign: "center",
  },

  emptyCard: {
    backgroundColor: "#111318",
    borderWidth: 1,
    borderColor: "#20232B",
    borderRadius: 18,
    padding: 24,
    marginTop: 10,
  },

  emptyTitle: {
    color: "#F5F7FA",
    fontSize: 18,
    fontWeight: "700",
  },

  emptyText: {
    color: "#777D8A",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },

  classCard: {
    backgroundColor: "#111318",
    borderWidth: 1,
    borderColor: "#20232B",
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },

  daySection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  day: {
    color: "#8B5CF6",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  time: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "600",
  },

  classInfo: {
    marginTop: 14,
  },

  courseName: {
    color: "#F5F7FA",
    fontSize: 18,
    fontWeight: "700",
  },

  courseCode: {
    color: "#8F95A3",
    fontSize: 13,
    marginTop: 5,
  },

  room: {
    color: "#777D8A",
    fontSize: 13,
    marginTop: 8,
  },
});