import { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";

const { width } = Dimensions.get("window");

const slides = [
  {
    id: "1",
    number: "01",
    title: "Organize\nyour academic life.",
    description:
      "Keep your timetable, classes, notes and important academic information in one place.",
    icon: "▦",
  },
  {
    id: "2",
    number: "02",
    title: "Never miss\na deadline.",
    description:
      "Stay ahead of assignments and classes with smart reminders designed around your schedule.",
    icon: "◷",
  },
  {
    id: "3",
    number: "03",
    title: "Study\nsmarter with AI.",
    description:
      "Turn your notes and assignments into summaries, explanations, flashcards and more.",
    icon: "✦",
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const flatListRef = useRef<FlatList>(null);

  const handleScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const index = Math.round(
      event.nativeEvent.contentOffset.x / width
    );

    setCurrentIndex(index);
  };

  const goNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      router.replace("/auth");
    }
  };

  return (
    <View style={styles.container}>
      {/* Top brand */}
      <View style={styles.header}>
        <Text style={styles.logo}>SYLLO</Text>

        <Text style={styles.skip}>
          {currentIndex < slides.length - 1 ? "SKIP" : ""}
        </Text>
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            {/* Visual */}
            <View style={styles.visual}>
              <View style={styles.visualGrid}>
                <View style={styles.gridLine} />
                <View style={styles.gridLine} />
                <View style={styles.gridLine} />
                <View style={styles.gridLine} />
              </View>

              <View style={styles.iconCircle}>
                <Text style={styles.icon}>{item.icon}</Text>
              </View>

              <Text style={styles.slideNumber}>
                {item.number}
              </Text>
            </View>

            {/* Text */}
            <View style={styles.textContainer}>
              <Text style={styles.title}>{item.title}</Text>

              <Text style={styles.description}>
                {item.description}
              </Text>
            </View>
          </View>
        )}
      />

      {/* Bottom controls */}
      <View style={styles.bottom}>
        {/* Pagination */}
        <View style={styles.pagination}>
          {slides.map((slide, index) => (
            <View
              key={slide.id}
              style={[
                styles.dot,
                index === currentIndex && styles.activeDot,
              ]}
            />
          ))}
        </View>

        {/* Continue */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.button}
          onPress={goNext}
        >
          <Text style={styles.buttonText}>
            {currentIndex === slides.length - 1
              ? "Get Started"
              : "Continue"}
          </Text>

          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08090D",
  },

  header: {
    paddingHorizontal: 28,
    paddingTop: 65,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  logo: {
    color: "#F5F7FA",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 4,
  },

  skip: {
    color: "#555A66",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },

  slide: {
    width,
    paddingHorizontal: 28,
    paddingTop: 35,
  },

  visual: {
    height: 300,
    borderRadius: 32,
    backgroundColor: "#111318",
    borderWidth: 1,
    borderColor: "#20232B",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  visualGrid: {
    position: "absolute",
    width: "100%",
    height: "100%",
    flexDirection: "row",
    justifyContent: "space-around",
    opacity: 0.25,
  },

  gridLine: {
    width: 1,
    height: "100%",
    backgroundColor: "#353945",
  },

  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#181B24",
    borderWidth: 1,
    borderColor: "#303440",
    alignItems: "center",
    justifyContent: "center",
  },

  icon: {
    color: "#8B5CF6",
    fontSize: 48,
    fontWeight: "300",
  },

  slideNumber: {
    position: "absolute",
    bottom: 22,
    right: 24,
    color: "#454A56",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
  },

  textContainer: {
    paddingTop: 32,
  },

  title: {
    color: "#F5F7FA",
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "800",
    letterSpacing: -1,
  },

  description: {
    color: "#8F95A3",
    fontSize: 15,
    lineHeight: 24,
    marginTop: 18,
    maxWidth: 350,
  },

  bottom: {
    paddingHorizontal: 28,
    paddingBottom: 38,
    gap: 22,
  },

  pagination: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#30333B",
  },

  activeDot: {
    width: 26,
    backgroundColor: "#8B5CF6",
  },

  button: {
    height: 58,
    borderRadius: 18,
    backgroundColor: "#F5F7FA",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },

  buttonText: {
    color: "#08090D",
    fontSize: 16,
    fontWeight: "700",
  },

  arrow: {
    color: "#08090D",
    fontSize: 22,
    fontWeight: "600",
  },
});