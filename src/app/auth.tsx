import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";

export default function AuthScreen() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>SYLLO</Text>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>Back</Text>
        </TouchableOpacity>
      </View>

      {/* Main */}
      <View style={styles.content}>
        <Text style={styles.eyebrow}>WELCOME TO SYLLO</Text>

        <Text style={styles.title}>
          Your academic
          {"\n"}
          journey starts here.
        </Text>

        <Text style={styles.description}>
          Create your account and let Syllo organize
          your academic life.
        </Text>

        {/* Inputs */}
        <View style={styles.form}>
          <View>
            <Text style={styles.label}>EMAIL</Text>

            <TextInput
              placeholder="you@example.com"
              placeholderTextColor="#555A66"
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
          </View>

          <View>
            <Text style={styles.label}>PASSWORD</Text>

            <TextInput
              placeholder="••••••••"
              placeholderTextColor="#555A66"
              secureTextEntry
              style={styles.input}
            />
          </View>
        </View>

        {/* Login */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.primaryButton}
          onPress={() => router.replace("/home")}
        >
          <Text style={styles.primaryButtonText}>
            Continue
          </Text>

          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.or}>OR</Text>
          <View style={styles.divider} />
        </View>

        {/* Google */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.googleButton}
        >
          <Text style={styles.googleIcon}>G</Text>
          <Text style={styles.googleText}>
            Continue with Google
          </Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          By continuing, you agree to Syllo's{" "}
          <Text style={styles.footerLink}>
            Terms & Privacy Policy
          </Text>
          .
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#08090D",
    paddingHorizontal: 28,
  },

  header: {
    paddingTop: 65,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  logo: {
    color: "#F5F7FA",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 4,
  },

  back: {
    color: "#8F95A3",
    fontSize: 14,
  },

  content: {
    flex: 1,
    justifyContent: "center",
  },

  eyebrow: {
    color: "#8B5CF6",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 14,
  },

  title: {
    color: "#F5F7FA",
    fontSize: 34,
    lineHeight: 41,
    fontWeight: "800",
    letterSpacing: -0.8,
  },

  description: {
    color: "#8F95A3",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 16,
    maxWidth: 350,
  },

  form: {
    marginTop: 34,
    gap: 18,
  },

  label: {
    color: "#777D8A",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 8,
  },

  input: {
    height: 54,
    borderRadius: 15,
    backgroundColor: "#111318",
    borderWidth: 1,
    borderColor: "#20232B",
    paddingHorizontal: 16,
    color: "#F5F7FA",
    fontSize: 15,
  },

  primaryButton: {
    height: 56,
    borderRadius: 17,
    backgroundColor: "#F5F7FA",
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },

  primaryButtonText: {
    color: "#08090D",
    fontSize: 16,
    fontWeight: "700",
  },

  arrow: {
    color: "#08090D",
    fontSize: 21,
  },

  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 22,
  },

  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#20232B",
  },

  or: {
    color: "#555A66",
    fontSize: 10,
    fontWeight: "700",
  },

  googleButton: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#20232B",
    backgroundColor: "#111318",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },

  googleIcon: {
    color: "#F5F7FA",
    fontSize: 18,
    fontWeight: "800",
  },

  googleText: {
    color: "#D5D8DE",
    fontSize: 14,
    fontWeight: "600",
  },

  footer: {
    paddingBottom: 30,
    alignItems: "center",
  },

  footerText: {
    color: "#555A66",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
  },

  footerLink: {
    color: "#8F95A3",
  },
});