import React, { useState, useEffect } from "react";
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
import { Ionicons } from "@expo/vector-icons";

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
    onBlur?: () => void;
    isChecking?: boolean;
    textContentType?: "none" | "oneTimeCode" | "emailAddress" | "username" | "password";
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
                   onBlur,
                   isChecking = false,
                   textContentType = "none",
               }: FieldProps) {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <View style={styles.fieldGroup}>
            <Text style={styles.label}>{label}</Text>

            <View style={styles.inputContainer}>
                <TextInput
                    style={[
                        styles.input,
                        secure || isChecking ? { paddingRight: 50 } : null,
                        error ? styles.inputError : null,
                        isFocused && !error ? styles.inputFocused : null,
                    ]}
                    placeholder={placeholder}
                    placeholderTextColor="#94A3B8"
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
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => {
                        setIsFocused(false);
                        onBlur?.();
                    }}
                    textContentType={textContentType}
                />

                {isChecking && (
                    <View style={styles.rightActivityIndicator}>
                        <ActivityIndicator size="small" color="#6366F1" />
                    </View>
                )}

                {secure && !isChecking && (
                    <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={onTogglePassword}
                        activeOpacity={0.5}
                    >
                        <Ionicons
                            name={showPassword ? "eye-off-outline" : "eye-outline"}
                            size={22}
                            color="#64748B"
                        />
                    </TouchableOpacity>
                )}
            </View>

            {error ? (
                <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
                    <Text style={styles.errorText}>{error}</Text>
                </View>
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
    const [isCheckingUsername, setIsCheckingUsername] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const setFieldError = (field: string, errorMsg: string) => {
        setErrors((prev) => ({ ...prev, [field]: errorMsg }));
    };

    const clearFieldError = (field: string) => {
        setErrors((prev) => {
            if (!prev[field]) return prev;
            const next = { ...prev };
            delete next[field];
            return next;
        });
    };

    // --- Валідація форматів при втраті фокусу (onBlur) ---
    const validateUsernameFormat = (value: string) => {
        const trimName = value.trim();
        if (!trimName) {
            setFieldError("name", "Enter your username");
            return false;
        }
        if (trimName.length < 2) {
            setFieldError("name", "Minimum 2 characters");
            return false;
        }
        if (!/^[a-zA-Zа-яА-ЯіІїЇєЄ0-9_]+$/.test(trimName)) {
            setFieldError("name", "Only letters, numbers, and _ are allowed");
            return false;
        }
        clearFieldError("name");
        return true;
    };

    const validateEmailFormat = (value: string) => {
        const trimEmail = value.trim().toLowerCase();
        if (!trimEmail) {
            setFieldError("email", "Enter your email");
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) {
            setFieldError("email", "Invalid email format");
            return false;
        }
        clearFieldError("email");
        return true;
    };

    const validatePasswordFormat = (value: string) => {
        if (!value) {
            setFieldError("password", "Enter your password");
            return false;
        }
        if (value.length < 6) {
            setFieldError("password", "Minimum 6 characters");
            return false;
        }
        clearFieldError("password");

        if (confirmPassword && value !== confirmPassword) {
            setFieldError("confirmPassword", "Passwords do not match");
        } else if (confirmPassword && value === confirmPassword) {
            clearFieldError("confirmPassword");
        }
        return true;
    };

    const validateConfirmPasswordFormat = (value: string) => {
        if (!value) {
            setFieldError("confirmPassword", "Confirm your password");
            return false;
        }
        if (password !== value) {
            setFieldError("confirmPassword", "Passwords do not match");
            return false;
        }
        clearFieldError("confirmPassword");
        return true;
    };

    // --- Зміна паролів у реальному часі (onChange) ---
    const handlePasswordChange = (text: string) => {
        setPassword(text);

        if (errors.password && text.length >= 6) {
            clearFieldError("password");
        }

        if (confirmPassword) {
            if (text === confirmPassword) {
                clearFieldError("confirmPassword");
            } else {
                setFieldError("confirmPassword", "Passwords do not match");
            }
        }
    };

    const handleConfirmPasswordChange = (text: string) => {
        setConfirmPassword(text);

        if (password === text) {
            clearFieldError("confirmPassword");
        } else if (errors.confirmPassword) {
            setFieldError("confirmPassword", "Passwords do not match");
        }
    };

    // --- Перевірка унікальності нікнейму з дебаунсом ---
    useEffect(() => {
        if (!name.trim()) {
            clearFieldError("name");
            return;
        }

        const trimName = name.trim();
        if (trimName.length < 2 || !/^[a-zA-Zа-яА-ЯіІїЇєЄ0-9_]+$/.test(trimName)) {
            validateUsernameFormat(name);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setIsCheckingUsername(true);
            try {
                const q = query(
                    collection(db, "usernames"),
                    where("usernameLower", "==", trimName.toLowerCase())
                );
                const snap = await getDocs(q);

                if (!snap.empty) {
                    setFieldError("name", "This username is already taken");
                } else {
                    clearFieldError("name");
                }
            } catch (err) {
                console.error("Error checking username: ", err);
            } finally {
                setIsCheckingUsername(false);
            }
        }, 600);

        return () => clearTimeout(delayDebounceFn);
    }, [name]);

    const validateAll = () => {
        const isNameOk = validateUsernameFormat(name) && !errors.name;
        const isEmailOk = validateEmailFormat(email);
        const isPasswordOk = validatePasswordFormat(password);
        const isConfirmOk = validateConfirmPasswordFormat(confirmPassword);

        return isNameOk && isEmailOk && isPasswordOk && isConfirmOk;
    };

    const handleSignUp = async () => {
        if (!validateAll() || isCheckingUsername) return;

        const trimName = name.trim();
        const trimEmail = email.trim().toLowerCase();

        setLoading(true);

        try {
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
                keyboardVerticalOffset={Platform.OS === "ios" ? 47 : 0}
            >
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.header}>
                        <Text style={styles.headline}>Create Account</Text>
                        <Text style={styles.subtitle}>
                            Sign up to discover nearby events with eventBuddy
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
                            isChecking={isCheckingUsername}
                            onBlur={() => validateUsernameFormat(name)}
                            textContentType="username"
                        />

                        <Field
                            label="Email Address"
                            value={email}
                            onChange={setEmail}
                            placeholder="name@example.com"
                            error={errors.email}
                            keyboard="email-address"
                            clearError={() => clearFieldError("email")}
                            onBlur={() => validateEmailFormat(email)}
                            textContentType="emailAddress"
                        />

                        <Field
                            label="Password"
                            value={password}
                            onChange={handlePasswordChange}
                            placeholder="Minimum 6 characters"
                            secure
                            error={errors.password}
                            showPassword={showPassword}
                            onTogglePassword={() => setShowPassword((s) => !s)}
                            onBlur={() => validatePasswordFormat(password)}
                            textContentType="oneTimeCode"
                        />

                        <Field
                            label="Confirm Password"
                            value={confirmPassword}
                            onChange={handleConfirmPasswordChange}
                            placeholder="Repeat password"
                            secure
                            error={errors.confirmPassword}
                            showPassword={showPassword}
                            onTogglePassword={() => setShowPassword((s) => !s)}
                            onBlur={() => validateConfirmPasswordFormat(confirmPassword)}
                            textContentType="oneTimeCode"
                        />
                    </View>

                    <View style={styles.actionContainer}>
                        <TouchableOpacity
                            style={[
                                styles.primaryButton,
                                (loading || isCheckingUsername) && { opacity: 0.6 }
                            ]}
                            onPress={handleSignUp}
                            disabled={loading || isCheckingUsername}
                            activeOpacity={0.85}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.primaryButtonText}>Create Account</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => router.push("/SignIn")}
                            style={styles.signInLink}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.signInText}>
                                Already have an account?{" "}
                                <Text style={styles.signInTextBold}>Sign In</Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#FFFFFF" },
    scroll: {
        flexGrow: 1,
        paddingHorizontal: 28,
        paddingTop: 50,
        paddingBottom: 40,
        justifyContent: "center",
        gap: 40,
    },
    header: { gap: 10, marginBottom: 16 },
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
    form: { gap: 24 },
    fieldGroup: { gap: 8 },
    label: {
        fontSize: 14,
        fontWeight: "600",
        color: "#334155",
    },
    inputContainer: { justifyContent: "center" },
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
    inputError: {
        borderColor: "#EF4444",
        backgroundColor: "#FEF2F2",
    },
    errorContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 2,
    },
    errorText: {
        fontSize: 13,
        color: "#EF4444",
        fontWeight: "500",
    },
    hint: {
        fontSize: 13,
        color: "#94A3B8",
        paddingLeft: 2,
    },
    eyeButton: {
        position: "absolute",
        right: 16,
        height: "100%",
        justifyContent: "center",
    },
    rightActivityIndicator: {
        position: "absolute",
        right: 16,
        height: "100%",
        justifyContent: "center",
    },
    actionContainer: { gap: 16, marginTop: 12 },
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
    signInLink: { alignItems: "center", paddingVertical: 8 },
    signInText: { fontSize: 15, color: "#64748B" },
    signInTextBold: { color: "#6366F1", fontWeight: "700" },
});