import React, { useState } from "react";
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, SafeAreaView, Alert, ActivityIndicator,
    KeyboardAvoidingView, Platform,
} from "react-native";
import { router } from "expo-router";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/FirebaseConfig";

export default function SignIn() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSignIn = async () => {
        const trimEmail = email.trim().toLowerCase();
        if (!trimEmail || !password) {
            Alert.alert("Помилка", "Заповни всі поля");
            return;
        }

        setLoading(true);
        try {
            const result = await signInWithEmailAndPassword(auth, trimEmail, password);

            if (!result.user.emailVerified) {
                Alert.alert(
                    "Email не підтверджено",
                    "Перевір пошту і підтвердь акаунт",
                    [
                        { text: "Ок", onPress: () => router.replace("/VerifyEmail") }
                    ]
                );
                return;
            }

            router.replace("/(tabs)");

        } catch (error: any) {
            const msg: Record<string, string> = {
                "auth/user-not-found": "Акаунт не знайдено",
                "auth/wrong-password": "Невірний пароль",
                "auth/invalid-credential": "Невірний email або пароль",
                "auth/too-many-requests": "Забагато спроб. Спробуй пізніше",
            };
            Alert.alert("Помилка", msg[error.code] ?? error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        const trimEmail = email.trim().toLowerCase();
        if (!trimEmail) {
            Alert.alert("Введи email", "Спочатку введи свій email в поле вище");
            return;
        }
        try {
            await sendPasswordResetEmail(auth, trimEmail);
            Alert.alert("Надіслано", `Лист для скидання пароля надіслано на ${trimEmail}`);
        } catch (error: any) {
            Alert.alert("Помилка", error.message);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.headline}>Увійти</Text>
                        <Text style={styles.subtitle}>Раді тебе бачити знову</Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="email@example.com"
                                placeholderTextColor="#B7BFCA"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Пароль</Text>
                            <View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Твій пароль"
                                    placeholderTextColor="#B7BFCA"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                />
                                <TouchableOpacity
                                    style={styles.eyeButton}
                                    onPress={() => setShowPassword((s) => !s)}
                                >
                                    <Text style={styles.eyeText}>
                                        {showPassword ? "Сховати" : "Показати"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity onPress={handleForgotPassword}>
                                <Text style={styles.forgotText}>Забув пароль?</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.primaryButton, loading && { opacity: 0.6 }]}
                        onPress={handleSignIn}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.primaryButtonText}>Увійти</Text>
                        }
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.push("/SignUp")}
                        style={styles.signUpLink}
                    >
                        <Text style={styles.signUpText}>
                            Немає акаунту?{" "}
                            <Text style={styles.signUpTextBold}>Зареєструватись</Text>
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    content: {
        flex: 1, paddingHorizontal: 24,
        paddingTop: 64, gap: 28,
    },
    header: { gap: 6 },
    headline: { fontSize: 28, fontWeight: "700", color: "#0D0D0D", letterSpacing: -0.5 },
    subtitle: { fontSize: 15, color: "#6E7D93" },
    form: { gap: 20 },
    fieldGroup: { gap: 6 },
    label: { fontSize: 14, fontWeight: "600", color: "#333" },
    input: {
        height: 50, paddingHorizontal: 14,
        backgroundColor: "#F8F9FA", borderWidth: 1.5,
        borderColor: "#E2E5EA", borderRadius: 10,
        fontSize: 15, color: "#0D0D0D",
    },
    eyeButton: { position: "absolute", right: 14, top: 15 },
    eyeText: { fontSize: 13, color: "#505BEB", fontWeight: "500" },
    forgotText: { fontSize: 13, color: "#505BEB", fontWeight: "500", textAlign: "right" },
    primaryButton: {
        height: 52, backgroundColor: "#505BEB",
        borderRadius: 12, justifyContent: "center", alignItems: "center",
    },
    primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    signUpLink: { alignItems: "center" },
    signUpText: { fontSize: 14, color: "#6E7D93" },
    signUpTextBold: { color: "#505BEB", fontWeight: "700" },
});