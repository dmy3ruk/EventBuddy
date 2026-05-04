import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    SafeAreaView,
} from "react-native";
import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../FirebaseConfig";
import { useRouter } from "expo-router";

export default function ForgotPassword() {
    const [email, setEmail] = useState("");
    const router = useRouter();

    const handleResetPassword = async () => {
        if (!email.trim()) {
            Alert.alert("Error", "Please enter your email.");
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email.trim());

            Alert.alert(
                "Success",
                "Password reset email has been sent."
            );

            router.back();
        } catch (error: any) {
            console.log(error);
            Alert.alert("Error", error.message);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Forgot Password</Text>

                <Text style={styles.subtitle}>
                    Enter your email to receive a password reset link.
                </Text>

                <TextInput
                    style={styles.input}
                    placeholder="Email"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                />

                <TouchableOpacity
                    style={styles.button}
                    onPress={handleResetPassword}
                >
                    <Text style={styles.buttonText}>
                        Send Reset Link
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={styles.backText}>
                        Back to login
                    </Text>
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
        paddingBottom: 80,
        gap: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: "700",
        color: "#000",
    },
    subtitle: {
        color: "#6E7D93",
        lineHeight: 22,
    },
    input: {
        height: 50,
        borderWidth: 1,
        borderColor: "#D6D6D6",
        borderRadius: 10,
        paddingHorizontal: 14,
        backgroundColor: "#F8F9FA",
    },
    button: {
        height: 50,
        borderRadius: 10,
        backgroundColor: "#505BEB",
        justifyContent: "center",
        alignItems: "center",
    },
    buttonText: {
        color: "#fff",
        fontWeight: "600",
        fontSize: 16,
    },
    backText: {
        textAlign: "center",
        color: "#505BEB",
        fontWeight: "600",
    },
});