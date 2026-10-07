import { useState } from "react";

import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { router } from "expo-router";
import { makeRedirectUri } from "expo-auth-session";

import { supabase } from "@/lib/supabase";

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleAuth = async () => {
    setErrorMessage("");
    setSuccessMessage("");

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setErrorMessage("Please enter your email and password.");
      return;
    }

    if (!cleanEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must contain at least 6 characters.");
      return;
    }

    try {
      setLoading(true);

      // Deep-link destination for Supabase email verification.
      const redirectTo = makeRedirectUri({
        scheme: "syllo",
        path: "auth/callback",
      });

      if (isLogin) {
        // -----------------------------
        // LOGIN
        // -----------------------------
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        router.replace("/home");
      } else {
        // -----------------------------
        // SIGN UP
        // -----------------------------
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: redirectTo,
          },
        });

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        if (data.session) {
          router.replace("/home");
        } else {
          setSuccessMessage(
            "Account created. Please check your email to verify your account."
          );
        }
      }
    } catch {
      setErrorMessage(
        "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>SYLLO</Text>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>Back</Text>
        </TouchableOpacity>
      </View>

      {/* Main */}
      <View style={styles.content}>
        <Text style={styles.eyebrow}>
          {isLogin ? "WELCOME BACK" : "GET STARTED"}
        </Text>

        <Text style={styles.title}>
          {isLogin ? (
            <>
              Welcome{"\n"}
              back to Syllo.
            </>
          ) : (
            <>
              Start your{"\n"}
              Syllo journey.
            </>
          )}
        </Text>

        <Text style={styles.description}>
          {isLogin
            ? "Log in to continue organizing your academic life."
            : "Create your account and keep your academic life organized."}
        </Text>

        {/* Form */}
        <View style={styles.form}>
          <View>
            <Text style={styles.label}>EMAIL</Text>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#555A66"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              editable={!loading}
            />
          </View>

          <View>
            <Text style={styles.label}>PASSWORD</Text>

            <View style={styles.passwordContainer}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#555A66"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.passwordInput}
                editable={!loading}
              />

              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                <Text style={styles.showPassword}>
                  {showPassword ? "HIDE" : "SHOW"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Error */}
        {errorMessage ? (
          <View style={styles.messageBox}>
            <Text style={styles.errorText}>
              {errorMessage}
            </Text>
          </View>
        ) : null}

        {/* Success */}
        {successMessage ? (
          <View style={styles.messageBox}>
            <Text style={styles.successText}>
              {successMessage}
            </Text>
          </View>
        ) : null}

        {/* Primary button */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={[
            styles.primaryButton,
            loading && styles.disabledButton,
          ]}
          onPress={handleAuth}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#08090D" />
          ) : (
            <>
              <Text style={styles.primaryButtonText}>
                {isLogin ? "Log In" : "Create Account"}
              </Text>

              <Text style={styles.arrow}>→</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Mode switch */}
        <View style={styles.switchContainer}>
          <Text style={styles.switchText}>
            {isLogin
              ? "Don't have an account?"
              : "Already have an account?"}
          </Text>

          <TouchableOpacity
            onPress={() => {
              setIsLogin(!isLogin);
              setErrorMessage("");
              setSuccessMessage("");
            }}
            disabled={loading}
          >
            <Text style={styles.switchAction}>
              {isLogin ? "Sign Up" : "Log In"}
            </Text>
          </TouchableOpacity>
        </View>
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
    </KeyboardAvoidingView>
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

  passwordContainer: {
    height: 54,
    borderRadius: 15,
    backgroundColor: "#111318",
    borderWidth: 1,
    borderColor: "#20232B",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 14,
  },

  passwordInput: {
    flex: 1,
    color: "#F5F7FA",
    fontSize: 15,
  },

  showPassword: {
    color: "#8B5CF6",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },

  messageBox: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#111318",
    borderWidth: 1,
    borderColor: "#20232B",
  },

  errorText: {
    color: "#F87171",
    fontSize: 13,
    lineHeight: 19,
  },

  successText: {
    color: "#4ADE80",
    fontSize: 13,
    lineHeight: 19,
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

  disabledButton: {
    opacity: 0.7,
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

  switchContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 22,
    gap: 5,
  },

  switchText: {
    color: "#666B78",
    fontSize: 13,
  },

  switchAction: {
    color: "#8B5CF6",
    fontSize: 13,
    fontWeight: "700",
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