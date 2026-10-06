import { StyleSheet, Text, View } from "react-native";

export default function AITab() {
  return (
    <View style={styles.container}>
      <Text style={styles.badge}>SYLLO AI</Text>

      <Text style={styles.title}>
        Study smarter.
      </Text>

      <Text style={styles.subtitle}>
        Ask questions, summarize notes, generate
        flashcards and understand difficult topics.
      </Text>
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

  badge: {
    color: "#8B5CF6",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 14,
  },

  title: {
    color: "#F5F7FA",
    fontSize: 34,
    fontWeight: "800",
  },

  subtitle: {
    color: "#777D8A",
    marginTop: 12,
    fontSize: 15,
    lineHeight: 24,
    maxWidth: 340,
  },
});