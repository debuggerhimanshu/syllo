import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const { code } = useLocalSearchParams<{ code?: string }>();

  const [error, setError] = useState("");

  useEffect(() => {
    const exchangeCode = async () => {
      if (!code) {
        setError("Verification link is invalid or incomplete.");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("Auth callback error:", error);
        setError("Email verification failed. Please try again.");
        return;
      }

      // Session successfully created.
      router.replace("/home");
    };

    exchangeCode();
  }, [code]);

  return (
    <View style={styles.container}>
      {error ? (
        <>
          <Text style={styles.title}>Verification failed</Text>

          <Text style={styles.message}>{error}</Text>
        </>
      ) : (
        <>
          <ActivityIndicator
            size="large"
            color="#8B5CF6"
          />

          <Text style={styles.title}>
            Verifying your email...
          </Text>

          <Text style={styles.message}>
            Please wait while we finish setting up your Syllo account.
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08090D",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },

  title: {
    marginTop: 24,
    color: "#F5F7FA",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },

  message: {
    marginTop: 12,
    color: "#8F95A3",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
});