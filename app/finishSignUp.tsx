import { useEffect } from "react";
import { ActivityIndicator, View, Alert } from "react-native";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "@/FirebaseConfig";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

async function extractFirebaseLink(url: string): Promise<string> {
    if (url.includes("link=")) {
        return decodeURIComponent(url.substring(url.indexOf("link=") + 5));
    }
    return url;
}

async function processLink(url: string) {
    const finalLink = await extractFirebaseLink(url);
    console.log("FINAL FIREBASE LINK:", finalLink);

    if (!isSignInWithEmailLink(auth, finalLink)) {
        Alert.alert("Error", "Invalid sign-in link.");
        router.replace("/SignIn");
        return;
    }

    const email = await AsyncStorage.getItem("emailForSignIn");
    const username = await AsyncStorage.getItem("usernameForSignIn");

    if (!email) {
        Alert.alert("Error", "Email not found. Please sign up again.");
        router.replace("/SignIn");
        return;
    }

    const result = await signInWithEmailLink(auth, email, finalLink);
    const user = result.user;

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists() && username) {
        await setDoc(userRef, {
            uid: user.uid,
            email,
            username,
            usernameLower: username.toLowerCase(),
            createdAt: new Date(),
        });
        await setDoc(doc(db, "usernames", username.toLowerCase()), {
            uid: user.uid,
            username,
            usernameLower: username.toLowerCase(),
        });
    }

    await AsyncStorage.removeItem("emailForSignIn");
    await AsyncStorage.removeItem("usernameForSignIn");
    router.replace("/(tabs)");
}

export default function FinishSignUp() {
    useEffect(() => {
        let subscription: ReturnType<typeof Linking.addEventListener>;

        const init = async () => {
            try {
                // Case 1: App opened cold by the deep link
                const initialUrl = await Linking.getInitialURL();
                if (initialUrl) {
                    await processLink(initialUrl);
                    return;
                }

                // Case 2: App was already running — wait for the URL event
                subscription = Linking.addEventListener("url", async ({ url }) => {
                    try {
                        await processLink(url);
                    } catch (err) {
                        console.error("Link event error:", err);
                        Alert.alert("Error", "Could not finish sign in.");
                        router.replace("/SignIn");
                    }
                });
            } catch (error) {
                console.error("FinishSignUp error:", error);
                Alert.alert("Error", "Could not finish sign in.");
                router.replace("/SignIn");
            }
        };

        init();
        return () => subscription?.remove();
    }, []);

    return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" />
        </View>
    );
}