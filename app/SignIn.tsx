import React, { useState } from "react";
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, SafeAreaView, Alert, ActivityIndicator,
    KeyboardAvoidingView, Platform,
} from "react-native";
import { router } from "expo-router";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/FirebaseConfig";
// Додаємо сучасні іконки (входять в Expo за замовчуванням)
import { Ionicons } from "@expo/vector-icons";

export default function SignIn() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // Стейни для ефекту фокусу на інпутах
    const [isEmailFocused, setIsEmailFocused] = useState(false);
    const [isPasswordFocused, setIsPasswordFocused] = useState(false);

    const handleSignIn = async () => {
        const trimEmail = email.trim().toLowerCase();

        if (!trimEmail || !password) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }

        setLoading(true);

        try {
            const result = await signInWithEmailAndPassword(auth, trimEmail, password);

            if (!result.user.emailVerified) {
                Alert.alert(
                    "Email Not Verified",
                    "Please check your email and verify your account.",
                    [
                        { text: "OK", onPress: () => router.replace("/VerifyEmail") }
                    ]
                );
                return;
            }

            router.replace("/(tabs)");

        } catch (error: any) {
            const msg: Record<string, string> = {
                "auth/user-not-found": "Account not found",
                "auth/wrong-password": "Incorrect password",
                "auth/invalid-credential": "Invalid email or password",
                "auth/too-many-requests": "Too many attempts. Please try again later.",
            };

            Alert.alert("Error", msg[error.code] ?? error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        const trimEmail = email.trim().toLowerCase();

        if (!trimEmail) {
            Alert.alert("Enter Email", "Please enter your email address first.");
            return;
        }

        try {
            await sendPasswordResetEmail(auth, trimEmail);
            Alert.alert("Email Sent", `A password reset email has been sent to ${trimEmail}`);
        } catch (error: any) {
            Alert.alert("Error", error.message);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <View style={styles.content}>
                    {/* Хедер став більш повітряним */}
                    <View style={styles.header}>
                        <Text style={styles.headline}>Welcome Back</Text>
                        <Text style={styles.subtitle}>Sign in to continue to eventBuddy</Text>
                    </View>

                    <View style={styles.form}>
                        {/* Інпут Email */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Email Address</Text>
                            <TextInput
                                style={[
                                    styles.input,
                                    isEmailFocused && styles.inputFocused
                                ]}
                                placeholder="name@example.com"
                                placeholderTextColor="#94A3B8"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                onFocus={() => setIsEmailFocused(true)}
                                onBlur={() => setIsEmailFocused(false)}
                            />
                        </View>

                        {/* Інпут Пароля */}
                        <View style={styles.fieldGroup}>
                            <View style={styles.passwordHeader}>
                                <Text style={styles.label}>Password</Text>
                                <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7}>
                                    <Text style={styles.forgotText}>Forgot?</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.passwordInputContainer}>
                                <TextInput
                                    style={[
                                        styles.input,
                                        { paddingRight: 50 },
                                        isPasswordFocused && styles.inputFocused
                                    ]}
                                    placeholder="Enter your password"
                                    placeholderTextColor="#94A3B8"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    onFocus={() => setIsPasswordFocused(true)}
                                    onBlur={() => setIsPasswordFocused(false)}
                                />
                                <TouchableOpacity
                                    style={styles.eyeButton}
                                    onPress={() => setShowPassword((s) => !s)}
                                    activeOpacity={0.5}
                                >
                                    {/* Сучасна іконка замість тексту */}
                                    <Ionicons
                                        name={showPassword ? "eye-off-outline" : "eye-outline"}
                                        size={22}
                                        color="#64748B"
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Головна кнопка дії */}
                    <View style={styles.actionContainer}>
                        <TouchableOpacity
                            style={[styles.primaryButton, loading && { opacity: 0.6 }]}
                            onPress={handleSignIn}
                            disabled={loading}
                            activeOpacity={0.85}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.primaryButtonText}>Sign In</Text>
                            )}
                        </TouchableOpacity>

                        {/* Лінк на реєстрацію */}
                        <TouchableOpacity
                            onPress={() => router.push("/SignUp")}
                            style={styles.signUpLink}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.signUpText}>
                                Don't have an account?{" "}
                                <Text style={styles.signUpTextBold}>Sign Up</Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF"
    },
    content: {
        flex: 1,
        paddingHorizontal: 28,
        justifyContent: "center",
        gap: 40, // ЗБІЛЬШЕНО: тепер між Хедером, Формою та Кнопкою більше простору
    },
    header: {
        gap: 8,
        marginBottom: 16 // ЗБІЛЬШЕНО: гарний відступ від привітання до поля Email
    },
    headline: {
        fontSize: 32,
        fontWeight: "800",
        color: "#0F172A",
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 16,
        color: "#64748B",
        lineHeight: 22,
    },
    form: {
        gap: 24 // ЗБІЛЬШЕНО: додатковий простір між полем Email та Паролем
    },
    fieldGroup: {
        gap: 8
    },
    passwordHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        color: "#334155",
    },
    passwordInputContainer: {
        justifyContent: "center"
    },
    input: {
        height: 54,
        paddingHorizontal: 16,
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 14,
        fontSize: 16,
        color: "#0F172A",
    },
    inputFocused: {
        backgroundColor: "#FFFFFF",
        borderColor: "#6366F1",
        shadowColor: "#6366F1",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 1,
    },
    eyeButton: {
        position: "absolute",
        right: 16,
        height: "100%",
        justifyContent: "center",
    },
    forgotText: {
        fontSize: 14,
        color: "#6366F1",
        fontWeight: "600",
    },
    actionContainer: {
        gap: 16,
        marginTop: 12 // ЗБІЛЬШЕНО: відступ від форми до кнопки Sign In
    },
    primaryButton: {
        height: 56,
        backgroundColor: "#6366F1",
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#6366F1",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 3,
    },
    primaryButtonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "700",
        letterSpacing: -0.1,
    },
    signUpLink: {
        alignItems: "center",
        paddingVertical: 8,
    },
    signUpText: {
        fontSize: 15,
        color: "#64748B",
    },
    signUpTextBold: {
        color: "#6366F1",
        fontWeight: "700",
    },
});