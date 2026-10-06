import { Tabs } from "expo-router";

export default function TabsLayout() {
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
          tabBarIcon: () => null,
        }}
      />

      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          tabBarIcon: () => null,
        }}
      />

      <Tabs.Screen
        name="notes"
        options={{
          title: "Notes",
          tabBarIcon: () => null,
        }}
      />

      <Tabs.Screen
        name="tasks"
        options={{
          title: "Tasks",
          tabBarIcon: () => null,
        }}
      />

      <Tabs.Screen
        name="ai"
        options={{
          title: "Syllo AI",
          tabBarIcon: () => null,
        }}
      />
    </Tabs>
  );
}