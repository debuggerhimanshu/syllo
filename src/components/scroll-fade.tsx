
import React from "react";
import MaskedView from "@react-native-masked-view/masked-view";
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

      {/* Fade only the scrolling content */}
      <MaskedView
        style={styles.content}
        maskElement={
          <LinearGradient
            colors={[
              "rgba(255,255,255,0.50)",
              "rgba(255,255,255,0.80)",
              "rgba(255,255,255,1)",
            ]}
            locations={[0, 0.12, 0.28]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        }
      >
        {children}
      </MaskedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    zIndex: 0,
    backgroundColor: "transparent",
  },
  content: {
    flex: 1,
    zIndex: 1,
  },
});
