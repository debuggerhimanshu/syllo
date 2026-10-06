import { StyleSheet, Text, View } from "react-native";

export default function HomeTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Good morning 👋</Text>

      <Text style={styles.title}>
        Welcome to{"\n"}
        <Text style={styles.brand}>Syllo.</Text>
      </Text>

      <Text style={styles.description}>
        Your academic life, organized.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08090D",
    paddingHorizontal: 28,
    paddingTop: 70,
  },

  greeting: {
    color: "#8F95A3",
    fontSize: 14,
    marginBottom: 18,
  },

  title: {
    color: "#F5F7FA",
    fontSize: 38,
    lineHeight: 45,
    fontWeight: "800",
  },

  brand: {
    color: "#8B5CF6",
  },

  description: {
    color: "#777D8A",
    fontSize: 15,
    marginTop: 14,
  },
});