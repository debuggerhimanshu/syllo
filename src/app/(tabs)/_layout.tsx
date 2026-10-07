import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAuth } from "@/context/AuthContext";

export default function TabsLayout() {
  const { session, loading } = useAuth();

  // Wait until Supabase finishes checking
  // whether a session already exists.
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  // User is not authenticated.
  // Do not allow access to any tab.
  if (!session) {
    return <Redirect href="/auth" />;
  }

  // User is authenticated.
  // Allow access to the entire tab navigation.
  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarStyle: {
          backgroundColor: "#111318",
          borderTopColor: "#20232B",
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
        },

        tabBarActiveTintColor: "#8B5CF6",
        tabBarInactiveTintColor: "#666B78",

        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
        }}
      />

      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
        }}
      />

      <Tabs.Screen
        name="notes"
        options={{
          title: "Notes",
        }}
      />

      <Tabs.Screen
        name="tasks"
        options={{
          title: "Tasks",
        }}
      />

      <Tabs.Screen
        name="ai"
        options={{
          title: "Syllo AI",
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#08090D",
    alignItems: "center",
    justifyContent: "center",
  },
});