
import React from "react";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View, ViewStyle } from "react-native";

type ScrollFadeProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  gradientColors?: [string, string, string];
};

export default function ScrollFade({
  children,
  style,
  gradientColors,
}: ScrollFadeProps) {
  return (
    <View style={[styles.container, style]}>
      {/* Fixed purple background gradient */}
      <LinearGradient
        colors={
          gradientColors ?? [
            "rgba(139, 92, 246, 0.30)",
            "rgba(99, 65, 180, 0.12)",
            "rgba(8, 9, 13, 0)",
          ]
        }
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.backgroundGradient}
        pointerEvents="none"
      />

      {/* Screen content */}
      <View style={styles.content}>
        {children}
      </View>

      {/* Top fade overlay */}
      <LinearGradient
        colors={[
          "rgba(8, 9, 13, 0.65)",
          "rgba(8, 9, 13, 0.25)",
          "rgba(8, 9, 13, 0)",
        ]}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.fadeOverlay}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08090D",
  },
  backgroundGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    zIndex: 0,
  },
  content: {
    flex: 1,
    zIndex: 1,
    backgroundColor: "transparent",
  },
  fadeOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 75,
    zIndex: 2,
  },
});
