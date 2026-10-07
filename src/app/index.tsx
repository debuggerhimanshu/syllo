import { useEffect } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function Index() {
  const { session, loading } = useAuth();

  useEffect(() => {
    if (loading) return;

    const timer = setTimeout(() => {
      if (session) {
        router.replace("/home");
      } else {
        router.replace("/onboarding");
      }
    }, 1800);

    return () => clearTimeout(timer);
  }, [loading, session]);

  return (
    <View style={styles.container}>
      <Animated.View>
        <Text style={styles.logo}>SYLLO</Text>
        <Text style={styles.tagline}>Your academic life, organized.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08090D",
    alignItems: "center",
    justifyContent: "center",
  },

  logo: {
    color: "#F5F7FA",
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: 8,
    textAlign: "center",
  },

  tagline: {
    marginTop: 12,
    color: "#8F95A3",
    fontSize: 13,
    textAlign: "center",
  },
});