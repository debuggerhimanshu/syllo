import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "@/context/AuthContext";

export default function HomeRedirect() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/auth" />;
  }

  return <Redirect href={"/(tabs)" as any} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08090D",
    alignItems: "center",
    justifyContent: "center",
  },
});