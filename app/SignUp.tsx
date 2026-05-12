import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    ScrollView,
    Platform,
} from "react-native";
import { router } from "expo-router";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "@/FirebaseConfig";

type FieldProps = {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    secure?: boolean;
    error?: string;
    hint?: string;
    keyboard?: "default" | "email-address";
    showPassword?: boolean;
    onTogglePassword?: () => void;
    clearError?: () => void;
};

function Field({
                   label,
                   value,
                   onChange,
                   placeholder,
                   secure = false,
                   error,
                   hint,
                   keyboard = "default",
                   showPassword = false,
                   onTogglePassword,
                   clearError,
               }: FieldProps) {
    return (
        <View style={styles.fieldGroup}>
            <Text style={styles.label}>{label}</Text>

            <View>
                <TextInput
                    style={[
                        styles.input,
                        secure ? { paddingRight: 90 } : null,
                        error ? styles.inputError : null,
                    ]}
                    placeholder={placeholder}
                    placeholderTextColor="#B7BFCA"
                    value={value}
                    onChangeText={(v) => {
                        onChange(v);
                        clearError?.();
                    }}
                    secureTextEntry={secure && !showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType={keyboard}
                    blurOnSubmit={false}
                />

                {secure && (
                    <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={onTogglePassword}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.eyeText}>
                            {showPassword ? "Hide" : "Show"}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {error ? (
                <Text style={styles.errorText}>{error}</Text>
            ) : hint ? (
                <Text style={styles.hint}>{hint}</Text>
            ) : null}
        </View>
    );
}

export default function SignUp() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const clearFieldError = (field: string) => {
        setErrors((prev) => {
            if (!prev[field]) return prev;

            const next = { ...prev };
            delete next[field];
            return next;
        });
    };

    const validate = () => {
        const e: Record<string, string> = {};
        const trimName = name.trim();
        const trimEmail = email.trim().toLowerCase();

        if (!trimName) e.name = "Enter your username";
        else if (trimName.length < 2) e.name = "Minimum 2 characters";
        else if (!/^[a-zA-Zа-яА-ЯіІїЇєЄ0-9_]+$/.test(trimName)) {
            e.name = "Only letters, numbers, and _ are allowed";
        }

        if (!trimEmail) e.email = "Enter your email";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) {
            e.email = "Invalid email format";
        }

        if (!password) e.password = "Enter your password";
        else if (password.length < 6) e.password = "Minimum 6 characters";

        if (!confirmPassword) e.confirmPassword = "Confirm your password";
        else if (password !== confirmPassword) e.confirmPassword = "Passwords do not match";

        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSignUp = async () => {
        if (!validate()) return;

        const trimName = name.trim();
        const trimEmail = email.trim().toLowerCase();

        setLoading(true);

        try {
            const q = query(
                collection(db, "usernames"),
                where("usernameLower", "==", trimName.toLowerCase())
            );

            const snap = await getDocs(q);

            if (!snap.empty) {
                setErrors({ name: "This username is already taken" });
                return;
            }

            const result = await createUserWithEmailAndPassword(auth, trimEmail, password);
            const user = result.user;

            await sendEmailVerification(user);

            await AsyncStorage.setItem("pendingUsername", trimName);
            await AsyncStorage.setItem("pendingEmail", trimEmail);

            router.replace("/VerifyEmail");
        } catch (error: any) {
            const msg: Record<string, string> = {
                "auth/email-already-in-use": "This email is already registered",
                "auth/invalid-email": "Invalid email format",
                "auth/weak-password": "Password is too weak",
            };

            Alert.alert("Error", msg[error.code] ?? error.message);
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
                    <View style={styles.header}>
                        <Text style={styles.headline}>Create Account</Text>
                        <Text style={styles.subtitle}>
                            Sign up to discover nearby events
                        </Text>
                    </View>

                    <View style={styles.form}>
                        <Field
                            label="Username"
                            value={name}
                            onChange={setName}
                            placeholder="your_name"
                            error={errors.name}
                            hint="Visible to other users"
                            clearError={() => clearFieldError("name")}
                        />

                        <Field
                            label="Email"
                            value={email}
                            onChange={setEmail}
                            placeholder="email@example.com"
                            error={errors.email}
                            keyboard="email-address"
                            clearError={() => clearFieldError("email")}
                        />

                        <Field
                            label="Password"
                            value={password}
                            onChange={setPassword}
                            placeholder="Minimum 6 characters"
                            secure
                            error={errors.password}
                            showPassword={showPassword}
                            onTogglePassword={() => setShowPassword((s) => !s)}
                            clearError={() => clearFieldError("password")}
                        />

                        <Field
                            label="Confirm Password"
                            value={confirmPassword}
                            onChange={setConfirmPassword}
                            placeholder="Repeat password"
                            secure
                            error={errors.confirmPassword}
                            showPassword={showPassword}
                            onTogglePassword={() => setShowPassword((s) => !s)}
                            clearError={() => clearFieldError("confirmPassword")}
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.primaryButton, loading && { opacity: 0.6 }]}
                        onPress={handleSignUp}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.primaryButtonText}>Sign Up</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.push("/SignIn")}
                        style={styles.signInLink}
                    >
                        <Text style={styles.signInText}>
                            Already have an account?{" "}
                            <Text style={styles.signInTextBold}>Sign In</Text>
                        </Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    scroll: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 48,
        paddingBottom: 32,
        gap: 24,
    },
    header: { gap: 6 },
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
    form: { gap: 20 },
    fieldGroup: { gap: 6 },
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
    eyeButton: {
        position: "absolute",
        right: 14,
        top: 15,
    },
    eyeText: {
        fontSize: 13,
        color: "#505BEB",
        fontWeight: "500",
    },
    primaryButton: {
        height: 52,
        backgroundColor: "#505BEB",
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
    },
    primaryButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
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