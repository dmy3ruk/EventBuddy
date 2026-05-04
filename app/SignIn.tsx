import React, { useState } from "react";
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, SafeAreaView, Platform, Alert,
} from "react-native";
import { router } from "expo-router";
import { getFunctions, httpsCallable } from "firebase/functions";
import * as AppleAuthentication from "expo-apple-authentication";
import { useGoogleSignIn } from "@/hooks/UseGoogleSignIn";
import { Ionicons } from "@expo/vector-icons";

const functions = getFunctions();

export default function SignIn() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);

    const { promptAsync, request } = useGoogleSignIn(() => router.replace("/(tabs)"));

    const handleEmailContinue = async () => {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed) return;

        setLoading(true);
        try {
            const sendOTP = httpsCallable(functions, "sendOTP");
            await sendOTP({ email: trimmed });

            router.push({
                pathname: "/VerifyOTP",
                params: { email: trimmed, mode: "signin" },
            });
        } catch (err: any) {
            Alert.alert("Помилка", err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.headline}>Увійти</Text>
                <Text style={styles.subtitle}>Вибери зручний спосіб</Text>

                {/* Соціальні логіни */}
                <TouchableOpacity
                    style={styles.socialButton}
                    onPress={() => promptAsync()}
                    disabled={!request}
                >
                    <Ionicons name="logo-google" size={20} color="#333" />
                    <Text style={styles.socialText}>Продовжити з Google</Text>
                </TouchableOpacity>

                {/* Розділювач */}
                <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>або email</Text>
                    <View style={styles.dividerLine} />
                </View>

                {/* Email */}
                <TextInput
                    style={styles.input}
                    placeholder="email@example.com"
                    placeholderTextColor="#B7BFCA"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                />

                <TouchableOpacity
                    style={[styles.primaryButton, loading && { opacity: 0.6 }]}
                    onPress={handleEmailContinue}
                    disabled={loading}
                >
                    <Text style={styles.primaryButtonText}>
                        {loading ? "Надсилаємо..." : "Отримати код"}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.push("/SignUp")}>
                    <Text style={styles.link}>
                        Немає акаунту?{" "}
                        <Text style={styles.linkBold}>Зареєструватись</Text>
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}


const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: "center",
        gap: 18,
    },
    headline: {
        fontSize: 28,
        lineHeight: 36,
        fontWeight: "700",
        color: "#111827",
        textAlign: "center",
    },
    subtitle: {
        fontSize: 15,
        color: "#6B7280",
        textAlign: "center",
        marginBottom: 12,
    },
    socialButton: {
        height: 52,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: "#FFFFFF",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
    },
    socialText: {
        fontSize: 15,
        fontWeight: "600",
        color: "#111827",
    },
    appleButton: {
        height: 52,
        borderRadius: 12,
    },
    divider: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        marginVertical: 8,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: "#E5E7EB",
    },
    dividerText: {
        fontSize: 13,
        color: "#9CA3AF",
    },
    input: {
        height: 52,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: "#F9FAFB",
        paddingHorizontal: 16,
        fontSize: 15,
        color: "#111827",
    },
    primaryButton: {
        height: 52,
        borderRadius: 12,
        backgroundColor: "#505BEB",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 4,
    },
    primaryButtonText: {
        fontSize: 15,
        fontWeight: "700",
        color: "#FFFFFF",
    },
    link: {
        marginTop: 14,
        textAlign: "center",
        fontSize: 14,
        color: "#6B7280",
    },
    linkBold: {
        color: "#505BEB",
        fontWeight: "700",
    },
});