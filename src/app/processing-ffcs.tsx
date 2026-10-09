import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function ProcessingFFCS() {
  const { uri, name, mimeType } =
    useLocalSearchParams<{
      uri?: string;
      name?: string;
      mimeType?: string;
    }>();

  const isValidFile =
    typeof uri === "string" &&
    uri.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator
            size="large"
            color="#8B5CF6"
          />
        </View>

        <Text style={styles.title}>
          Processing Timetable
        </Text>

        <Text style={styles.subtitle}>
          Syllo is getting your FFCS timetable ready.
        </Text>

        <View style={styles.statusCard}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: isValidFile
                  ? "#22C55E"
                  : "#EF4444",
              },
            ]}
          />

          <View style={styles.statusContent}>
            <Text style={styles.statusTitle}>
              {isValidFile
                ? "Timetable received"
                : "No timetable received"}
            </Text>

            <Text style={styles.statusText}>
              {isValidFile
                ? name ?? "Selected timetable"
                : "Something went wrong while passing the file."}
            </Text>
          </View>
        </View>

        {isValidFile && (
          <Text style={styles.debugText}>
            {mimeType || "Unknown file type"}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08090D",
    padding: 28,
  },

  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loaderContainer: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: "#111318",
    borderWidth: 1,
    borderColor: "#20232B",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },

  title: {
    color: "#F5F7FA",
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
  },

  subtitle: {
    color: "#777D8A",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 320,
    marginTop: 10,
  },

  statusCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111318",
    borderWidth: 1,
    borderColor: "#20232B",
    borderRadius: 16,
    padding: 16,
    marginTop: 32,
  },

  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  statusContent: {
    flex: 1,
    marginLeft: 14,
  },

  statusTitle: {
    color: "#F5F7FA",
    fontSize: 14,
    fontWeight: "700",
  },

  statusText: {
    color: "#777D8A",
    fontSize: 12,
    marginTop: 4,
  },

  debugText: {
    color: "#555B68",
    fontSize: 11,
    marginTop: 12,
  },
});