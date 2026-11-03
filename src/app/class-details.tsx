
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  router,
  useLocalSearchParams,
} from "expo-router";

import { useAuth } from "@/context/AuthContext";

import {
  getLocalSchedule,
  deleteLocalClass,
  type ScheduleItem,
} from "@/lib/timetable-repository";

export default function ClassDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { user, loading: authLoading } = useAuth();

  const [classData, setClassData] =
    useState<ScheduleItem | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const fetchClassDetails = async () => {
      if (authLoading) return;

      if (!user?.id || !id) {
        setClassData(null);
        setError("Please sign in to view this class.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        // Read class details directly from SQLite.
        const localSchedule = await getLocalSchedule(user.id);

        if (!active) return;

        const selectedClass =
          localSchedule.find((item) => item.id === id) ?? null;

        setClassData(selectedClass);

        if (!selectedClass) {
          setError("Class not found in your local timetable.");
        }
      } catch (err) {
        console.error("Local class details error:", err);

        if (active) {
          setError("Couldn't load class details.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void fetchClassDetails();

    return () => {
      active = false;
    };
  }, [id, user?.id, authLoading]);

  const handleDelete = () => {
    Alert.alert(
      "Delete Class",
      "Are you sure you want to delete this class?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: deleteClass,
        },
      ],
    );
  };

  const deleteClass = async () => {
    try {
      await deleteLocalClass(id);

      router.back();
    } catch (err) {
      console.error("Delete class error:", err);

      Alert.alert(
        "Delete Failed",
        "Couldn't delete this class. Please try again.",
      );
    }
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

  if (authLoading || loading) {
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

  if (error || !classData) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>
          Couldn't load class
        </Text>

        <Text style={styles.errorText}>
          {error || "Class not found."}
        </Text>
      </View>
    );
  }

  const course = classData.course;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {getDayName(classData.weekday)}
      </Text>

      <Text style={styles.title}>
        {course?.name ?? "Unknown course"}
      </Text>

      {course?.code && (
        <Text style={styles.code}>
          {course.code}
        </Text>
      )}

      <Text style={styles.time}>
        {classData.start_time.slice(0, 5)} –{" "}
        {classData.end_time.slice(0, 5)}
      </Text>

      {course?.faculty && (
        <Text style={styles.detail}>
          Faculty: {course.faculty}
        </Text>
      )}

      {classData.room && (
        <Text style={styles.detail}>
          Room: {classData.room}
        </Text>
      )}

      <TouchableOpacity
        style={styles.editButton}
        activeOpacity={0.8}
        onPress={() =>
          router.push({
            pathname: "/edit-class",
            params: {
              id: classData.id,
            },
          })
        }
      >
        <Text style={styles.editButtonText}>
          Edit Class
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteButton}
        activeOpacity={0.8}
        onPress={handleDelete}
      >
        <Text style={styles.deleteButtonText}>
          Delete Class
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08090D",
    padding: 28,
    paddingTop: 70,
  },

  center: {
    flex: 1,
    backgroundColor: "#08090D",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },

  label: {
    color: "#8B5CF6",
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  title: {
    color: "#F5F7FA",
    fontSize: 30,
    fontWeight: "800",
    marginTop: 12,
  },

  code: {
    color: "#8F95A3",
    fontSize: 14,
    marginTop: 6,
  },

  time: {
    color: "#F5F7FA",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 28,
  },

  detail: {
    color: "#9CA3AF",
    fontSize: 15,
    marginTop: 16,
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

  editButton: {
    marginTop: 40,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#8B5CF6",
    alignItems: "center",
    justifyContent: "center",
  },

  editButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },

  deleteButton: {
    marginTop: 40,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#241417",
    borderWidth: 1,
    borderColor: "#4A2429",
    alignItems: "center",
    justifyContent: "center",
  },

  deleteButtonText: {
    color: "#FF6B6B",
    fontSize: 15,
    fontWeight: "700",
  },
});
