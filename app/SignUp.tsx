import React, { useState } from "react";
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, SafeAreaView, Alert, Platform,
    ActivityIndicator, KeyboardAvoidingView, ScrollView,
} from "react-native";
import { router } from "expo-router";
import { getFunctions, httpsCallable } from "firebase/functions";
import { collection, query, where, getDocs } from "firebase/firestore";
import * as AppleAuthentication from "expo-apple-authentication";
import { Ionicons } from "@expo/vector-icons";
import { db } from "@/FirebaseConfig";
import { useGoogleSignIn } from "@/hooks/UseGoogleSignIn";

const functions = getFunctions();

type Field = "name" | "email";

export default function SignUp() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

    const { promptAsync, request } = useGoogleSignIn(() => router.replace("/(tabs)"));

    // --- Валідація ---
    const validate = (): boolean => {
        const newErrors: Partial<Record<Field, string>> = {};

        const trimmedName = name.trim();
        const trimmedEmail = email.trim().toLowerCase();

        if (!trimmedName) {
            newErrors.name = "Введи ім'я";
        } else if (trimmedName.length < 2) {
            newErrors.name = "Мінімум 2 символи";
        } else if (!/^[a-zA-Zа-яА-ЯіІїЇєЄ0-9_]+$/.test(trimmedName)) {
            newErrors.name = "Тільки літери, цифри та _";
        }

        if (!trimmedEmail) {
            newErrors.email = "Введи email";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
            newErrors.email = "Невірний формат email";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleContinue = async () => {
        if (!validate()) return;

        const trimmedName = name.trim();
        const trimmedEmail = email.trim().toLowerCase();

        setLoading(true);
        try {
            // Перевірка унікальності username
            const usernamesRef = collection(db, "usernames");
            const q = query(usernamesRef, where("usernameLower", "==", trimmedName.toLowerCase()));
            const snap = await getDocs(q);

            if (!snap.empty) {
                setErrors({ name: "Це ім'я вже зайнято" });
                return;
            }

            // Надіслати OTP
            const sendOTP = httpsCallable(functions, "sendOTP");
            await sendOTP({ email: trimmedEmail });

            router.push({
                pathname: "/VerifyOTP",
                params: {
                    email: trimmedEmail,
                    username: trimmedName,
                    mode: "signup",
                },
            });
        } catch (err: any) {
            Alert.alert("Помилка", err.message ?? "Спробуй ще раз");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Заголовок */}
                    <View style={styles.header}>
                        <Text style={styles.headline}>Створити акаунт</Text>
                        <Text style={styles.subtitle}>
                            Зареєструйся щоб знаходити події поруч
                        </Text>
                    </View>

                    {/* Соціальні кнопки */}
                    <View style={styles.socialGroup}>
                        <TouchableOpacity
                            style={styles.socialButton}
                            onPress={() => promptAsync()}
                            disabled={!request}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="logo-google" size={20} color="#333" />
                            <Text style={styles.socialText}>Продовжити з Google</Text>
                        </TouchableOpacity>

                    </View>

                    {/* Розділювач */}
                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>або з email</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* Форма */}
                    <View style={styles.form}>
                        {/* Ім'я */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Ім'я користувача</Text>
                            <TextInput
                                style={[
                                    styles.input,
                                    errors.name ? styles.inputError : null,
                                ]}
                                placeholder="your_name"
                                placeholderTextColor="#B7BFCA"
                                value={name}
                                onChangeText={(v) => {
                                    setName(v);
                                    if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
                                }}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            {errors.name ? (
                                <Text style={styles.errorText}>{errors.name}</Text>
                            ) : (
                                <Text style={styles.hint}>
                                    Буде видно іншим користувачам
                                </Text>
                            )}
                        </View>

                        {/* Email */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                style={[
                                    styles.input,
                                    errors.email ? styles.inputError : null,
                                ]}
                                placeholder="email@example.com"
                                placeholderTextColor="#B7BFCA"
                                value={email}
                                onChangeText={(v) => {
                                    setEmail(v);
                                    if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
                                }}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            {errors.email ? (
                                <Text style={styles.errorText}>{errors.email}</Text>
                            ) : (
                                <Text style={styles.hint}>
                                    Надішлемо код підтвердження
                                </Text>
                            )}
                        </View>
                    </View>

                    {/* Кнопка */}
                    <TouchableOpacity
                        style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                        onPress={handleContinue}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.primaryButtonText}>Далі →</Text>
                        )}
                    </TouchableOpacity>

                    {/* Угода */}
                    <Text style={styles.terms}>
                        Реєструючись, ти погоджуєшся з{" "}
                        <Text style={styles.termsLink}>Умовами використання</Text>
                        {" "}та{" "}
                        <Text style={styles.termsLink}>Політикою конфіденційності</Text>
                    </Text>

                    {/* Вже є акаунт */}
                    <TouchableOpacity
                        onPress={() => router.push("/SignIn")}
                        style={styles.signInLink}
                    >
                        <Text style={styles.signInText}>
                            Вже є акаунт?{" "}
                            <Text style={styles.signInTextBold}>Увійти</Text>
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    scroll: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 48,
        paddingBottom: 32,
        gap: 24,
    },
    header: {
        gap: 6,
    },
    headline: {
        fontSize: 28,
        fontWeight: "700",
        color: "#0D0D0D",
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 15,
        color: "#6E7D93",
        lineHeight: 22,
    },
    socialGroup: {
        gap: 12,
    },
    socialButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        height: 50,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: "#E2E5EA",
        backgroundColor: "#FAFAFA",
    },
    socialText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#1A1A1A",
    },
    appleButton: {
        height: 50,
        width: "100%",
    },
    divider: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: "#EAECEF",
    },
    dividerText: {
        fontSize: 13,
        color: "#9AA3AF",
        fontWeight: "500",
    },
    form: {
        gap: 20,
    },
    fieldGroup: {
        gap: 6,
    },
    label: {
        fontSize: 14,
        fontWeight: "600",
        color: "#333",
    },
    input: {
        height: 50,
        paddingHorizontal: 14,
        backgroundColor: "#F8F9FA",
        borderWidth: 1.5,
        borderColor: "#E2E5EA",
        borderRadius: 10,
        fontSize: 15,
        color: "#0D0D0D",
    },
    inputError: {
        borderColor: "#FF4D4F",
        backgroundColor: "#FFF5F5",
    },
    errorText: {
        fontSize: 12,
        color: "#FF4D4F",
        fontWeight: "500",
    },
    hint: {
        fontSize: 12,
        color: "#9AA3AF",
    },
    primaryButton: {
        height: 52,
        backgroundColor: "#505BEB",
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
    },
    primaryButtonDisabled: {
        opacity: 0.6,
    },
    primaryButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
        letterSpacing: 0.2,
    },
    terms: {
        fontSize: 12,
        color: "#9AA3AF",
        textAlign: "center",
        lineHeight: 18,
    },
    termsLink: {
        color: "#505BEB",
        fontWeight: "500",
    },
    signInLink: {
        alignItems: "center",
        paddingVertical: 4,
    },
    signInText: {
        fontSize: 14,
        color: "#6E7D93",
    },
    signInTextBold: {
        color: "#505BEB",
        fontWeight: "700",
    },
});