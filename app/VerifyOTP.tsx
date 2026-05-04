import React, { useRef, useState, useEffect } from "react";
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, SafeAreaView, Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { getFunctions, httpsCallable } from "firebase/functions";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/FirebaseConfig";

const functions = getFunctions();

export default function VerifyOTP() {
    const { email, mode } = useLocalSearchParams<{ email: string; mode: "signin" | "signup" }>();
    const [code, setCode] = useState(["", "", "", "", "", ""]);
    const [loading, setLoading] = useState(false);
    const [countdown, setCountdown] = useState(60);
    const inputs = useRef<TextInput[]>([]);

    // Таймер для повторного відправлення
    useEffect(() => {
        if (countdown === 0) return;
        const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [countdown]);

    const handleChange = (value: string, index: number) => {
        const newCode = [...code];
        newCode[index] = value;
        setCode(newCode);

        // Авто-перехід до наступного поля
        if (value && index < 5) {
            inputs.current[index + 1]?.focus();
        }

        // Авто-сабміт коли всі 6 цифр введено
        if (newCode.every((c) => c !== "") && value) {
            handleVerify(newCode.join(""));
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === "Backspace" && !code[index] && index > 0) {
            inputs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async (fullCode?: string) => {
        const finalCode = fullCode ?? code.join("");
        if (finalCode.length !== 6) return;

        setLoading(true);
        try {
            const verifyOTP = httpsCallable(functions, "verifyOTP");
            const result: any = await verifyOTP({ email, code: finalCode });

            await signInWithCustomToken(auth, result.data.token);
            router.replace("/(tabs)");
        } catch (err: any) {
            Alert.alert("Невірний код", err.message);
            setCode(["", "", "", "", "", ""]);
            inputs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (countdown > 0) return;
        try {
            const sendOTP = httpsCallable(functions, "sendOTP");
            await sendOTP({ email });
            setCountdown(60);
            setCode(["", "", "", "", "", ""]);
            inputs.current[0]?.focus();
        } catch (err: any) {
            Alert.alert("Помилка", err.message);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <TouchableOpacity onPress={() => router.back()} style={styles.back}>
                    <Text style={styles.backText}>← Назад</Text>
                </TouchableOpacity>

                <Text style={styles.headline}>Введи код</Text>
                <Text style={styles.subtitle}>
                    Надіслали 6-значний код на{"\n"}
                    <Text style={styles.email}>{email}</Text>
                </Text>

                {/* OTP Inputs */}
                <View style={styles.otpRow}>
                    {code.map((digit, i) => (
                        <TextInput
                            key={i}
                            ref={(el) => { if (el) inputs.current[i] = el; }}
                            style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                            value={digit}
                            onChangeText={(v) => handleChange(v.replace(/[^0-9]/g, ""), i)}
                            onKeyPress={(e) => handleKeyPress(e, i)}
                            keyboardType="number-pad"
                            maxLength={1}
                            selectTextOnFocus
                        />
                    ))}
                </View>

                <TouchableOpacity
                    style={[styles.primaryButton, loading && { opacity: 0.6 }]}
                    onPress={() => handleVerify()}
                    disabled={loading || code.some((c) => !c)}
                >
                    <Text style={styles.primaryButtonText}>
                        {loading ? "Перевіряємо..." : "Підтвердити"}
                    </Text>
                </TouchableOpacity>

                {/* Resend */}
                <TouchableOpacity onPress={handleResend} disabled={countdown > 0}>
                    <Text style={[styles.link, countdown > 0 && { color: "#B7BFCA" }]}>
                        {countdown > 0
                            ? `Відправити ще раз через ${countdown}с`
                            : "Відправити ще раз"}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    content: { flex: 1, padding: 24, paddingTop: 16, gap: 20 },
    back: { marginBottom: 8 },
    backText: { color: "#505BEB", fontSize: 16 },
    headline: { fontSize: 28, fontWeight: "700", color: "#000" },
    subtitle: { color: "#6E7D93", fontSize: 15, lineHeight: 22 },
    email: { color: "#000", fontWeight: "600" },
    otpRow: { flexDirection: "row", gap: 10, justifyContent: "center", marginVertical: 10 },
    otpBox: {
        width: 48, height: 56, borderRadius: 10,
        borderWidth: 1.5, borderColor: "#D6D6D6",
        textAlign: "center", fontSize: 22, fontWeight: "700",
        backgroundColor: "#F8F9FA", color: "#000",
    },
    otpBoxFilled: { borderColor: "#505BEB", backgroundColor: "#EEF0FF" },
    primaryButton: {
        backgroundColor: "#505BEB", borderRadius: 10,
        height: 52, justifyContent: "center", alignItems: "center",
    },
    primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
    link: { textAlign: "center", color: "#6E7D93", fontSize: 14 },
});