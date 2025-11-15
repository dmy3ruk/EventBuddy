import {
    View,
    TextInput,
    TouchableOpacity,
    Text,
    StyleSheet,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    ScrollView
} from 'react-native';
import { useState } from 'react';
import { auth } from '../FirebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from 'expo-router';

export default function SignIn() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const router = useRouter();

    const handleSignIn = async () => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const token = await userCredential.user.getIdToken();
            await AsyncStorage.setItem("token", token);
            router.replace("/(tabs)");
        } catch (error: any) {
            console.log(error);
            alert("Login failed: " + error.message);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                style={{ flex: 1, width: "100%" }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.signIn}>
                        <View style={styles.welcomeView}>
                            <Text style={styles.headline}>Welcome</Text>
                            <Text style={styles.subHeadline}>
                                Sign in to continue planning your next great moment
                            </Text>
                        </View>

                        <View style={styles.inputsWrapper}>
                            <View>
                                <Text>Email</Text>
                                <TextInput
                                    style={styles.signInInput}
                                    placeholder="email"
                                    value={email}
                                    placeholderTextColor="#B7BFCA"
                                    onChangeText={setEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>

                            <View>
                                <Text>Password</Text>
                                <TextInput
                                    style={styles.signInInput}
                                    placeholder="password"
                                    placeholderTextColor="#B7BFCA"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                />
                            </View>
                        </View>


                            <TouchableOpacity style={styles.signInButton} onPress={handleSignIn}>
                                <Text style={styles.signInText}>Login</Text>
                            </TouchableOpacity>

                            <Text style={styles.footerText}>
                                {"Don’t have an account? "}
                                <Text
                                    style={styles.footerLink}
                                    onPress={() => router.push('/SignUp')}
                                >
                                    Sign Up
                                </Text>
                            </Text>
                    </View>
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
    scrollContent: {
        flexGrow: 1,
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: 100,
    },
    signIn: {
        width: "90%",
        maxWidth: 350,
        gap: 40,
        flexDirection: "column",
        alignItems: "center",
    },
    welcomeView: {
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 16,
        width: "100%",
    },
    headline: {
        fontFamily: 'Inter',
        fontWeight: '700',
        fontSize: 24,
        lineHeight: 36,
        textAlign: 'center',
        color: '#000000',
    },
    subHeadline: {
        color: "#6E7D93",
        textAlign: 'center',
    },
    inputsWrapper: {
        width: "100%",
        gap: 20,
    },
    signInInput: {
        padding: 10,
        width: "100%",
        height: 48,
        backgroundColor: '#F8F9FA',
        borderWidth: 0.5,
        borderColor: '#D6D6D6',
        borderRadius: 8,
    },
    signInButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 10,
        borderWidth: 0.5,
        borderColor: '#D6D6D6',
        borderRadius: 8,
        backgroundColor: '#505BEB',
        width: "100%",
        height: 48,
    },
    signInText: {
        fontFamily: 'Inter',
        fontWeight: '600',
        fontSize: 14,
        color: '#FFFFFF',
    },
    footerText: {
        color: '#6E7D93',
        marginTop: 10,
    },
    footerLink: {
        color: "#505BEB",
        fontWeight: "600",
    },
});
