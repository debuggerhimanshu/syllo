import { Redirect, router } from "expo-router";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "@/context/AuthContext";

export default function HomeScreen() {
  const { session, loading, signOut } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/auth" />;
  }

  const handleSignOut = async () => {
    await signOut();
    router.replace("/auth");
  };

  return (
    <View style={styles.center}>
      <Text style={styles.title}>Syllo Home</Text>

      <Text style={styles.subtitle}>
        Authentication is working.
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={handleSignOut}
      >
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: "#08090D",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  title: {
    color: "#F5F7FA",
    fontSize: 26,
    fontWeight: "700",
  },

  subtitle: {
    color: "#8F95A3",
    marginTop: 8,
    fontSize: 14,
  },

  button: {
    marginTop: 30,
    backgroundColor: "#8B5CF6",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});