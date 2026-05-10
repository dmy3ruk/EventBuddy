import React, { useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    Alert,
    ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { reload, sendEmailVerification, deleteUser } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "@/FirebaseConfig";

export default function VerifyEmail() {
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);

    const checkVerification = async () => {
        const user = auth.currentUser;

        if (!user) {
            router.replace("/SignIn");
            return;
        }

        setLoading(true);

        try {
            // Reload user to get latest email verification status
            await reload(user);

            if (!auth.currentUser?.emailVerified) {
                Alert.alert(
                    "Пошта ще не підтверджена",
                    "Перейди на email, відкрий лист Firebase і натисни посилання підтвердження."
                );
                return;
            }

            // ✅ FORCE TOKEN REFRESH - This is the fix!
            await auth.currentUser.getIdToken(true);

            const username = await AsyncStorage.getItem("pendingUsername");

            if (!username) {
                Alert.alert(
                    "Помилка",
                    "Не знайдено ім'я користувача. Спробуй зареєструватися ще раз."
                );
                return;
            }

            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                email: user.email,
                username,
                usernameLower: username.toLowerCase(),
                createdAt: new Date(),
                emailVerified: true,
            });

            await setDoc(doc(db, "usernames", username.toLowerCase()), {
                uid: user.uid,
                username,
                usernameLower: username.toLowerCase(),
            });

            await AsyncStorage.removeItem("pendingUsername");
            await AsyncStorage.removeItem("pendingEmail");

            router.replace("/(tabs)");
        } catch (error: any) {
            Alert.alert("Помилка", error.message);
        } finally {
            setLoading(false);
        }
    };

    const resendEmail = async () => {
        const user = auth.currentUser;

        if (!user) {
            router.replace("/SignIn");
            return;
        }

        setResending(true);

        try {
            await sendEmailVerification(user);
            Alert.alert("Лист надіслано", "Перевір пошту ще раз.");
        } catch (error: any) {
            Alert.alert("Помилка", error.message);
        } finally {
            setResending(false);
        }
    };

    const cancelRegistration = async () => {
        const user = auth.currentUser;

        try {
            await AsyncStorage.removeItem("pendingUsername");
            await AsyncStorage.removeItem("pendingEmail");

            if (user && !user.emailVerified) {
                await deleteUser(user);
            }

            router.replace("/SignUp");
        } catch (error: any) {
            Alert.alert("Помилка", error.message);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Підтверди email</Text>

                <Text style={styles.subtitle}>
                    Ми надіслали лист підтвердження на твою пошту. Відкрий лист,
                    натисни посилання, а потім повернись у застосунок.
                </Text>

                <TouchableOpacity
                    style={[styles.button, loading && { opacity: 0.6 }]}
                    onPress={checkVerification}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Я підтвердила пошту</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={resendEmail}
                    disabled={resending}
                >
                    <Text style={styles.secondaryText}>
                        {resending ? "Надсилаємо..." : "Надіслати лист ще раз"}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={cancelRegistration}
                >
                    <Text style={styles.cancelText}>Скасувати реєстрацію</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    content: {
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: 24,
        gap: 18,
    },
    title: {
        fontSize: 28,
        fontWeight: "700",
        color: "#0D0D0D",
        textAlign: "center",
    },
    subtitle: {
        fontSize: 15,
        color: "#6E7D93",
        lineHeight: 22,
        textAlign: "center",
    },
    button: {
        height: 52,
        backgroundColor: "#505BEB",
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        marginTop: 12,
    },
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
    secondaryButton: {
        alignItems: "center",
        paddingVertical: 8,
    },
    secondaryText: {
        color: "#505BEB",
        fontSize: 14,
        fontWeight: "600",
    },
    cancelButton: {
        alignItems: "center",
        paddingVertical: 8,
    },
    cancelText: {
        color: "#FF4D4F",
        fontSize: 14,
        fontWeight: "600",
    },
});