import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

export default function SplashScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -40,
          duration: 450,
          useNativeDriver: true,
        }),
      ]).start(() => {
        router.replace("/onboarding");
      });
    }, 1800);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        <Text style={styles.logo}>SYLLO</Text>

        <Text style={styles.tagline}>
          Your academic life, organized.
        </Text>
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
    color: "#9CA3AF",
    fontSize: 14,
    marginTop: 12,
    letterSpacing: 0.5,
    textAlign: "center",
  },
});