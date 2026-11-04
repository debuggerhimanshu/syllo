
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";

import { AuthProvider } from "@/context/AuthContext";
import { getDatabase } from "@/lib/database";

export default function RootLayout() {
  const [databaseReady, setDatabaseReady] = useState(false);
  const [databaseError, setDatabaseError] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function initializeDatabase() {
      try {
        await getDatabase();

        if (mounted) {
          setDatabaseReady(true);
        }
      } catch (error) {
        console.error("SQLite initialization failed:", error);

        if (mounted) {
          setDatabaseError(true);
        }
      }
    }

    initializeDatabase();

    return () => {
      mounted = false;
    };
  }, []);

  if (!databaseReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#08090D",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  if (databaseError) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#08090D",
          justifyContent: "center",
          alignItems: "center",
        }}
      />
    );
  }

  
  return (
    <AuthProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          contentStyle: {
            backgroundColor: "#08090D",
          },
        }}
      >
        <Stack.Screen name="(tabs)" />

        <Stack.Screen
          name="note-editor"
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />

        <Stack.Screen
          name="task-create"
          options={{
            headerShown: false,
            animation: "slide_from_right",
            presentation: "card",
          }}
        />

        <Stack.Screen
          name="task-details"
          options={{
            headerShown: false,
            animation: "slide_from_right",
            presentation: "card",
            contentStyle: {
              backgroundColor: "#08090D",
            },
          }}
        />
      </Stack>
    </AuthProvider>
  );

}
