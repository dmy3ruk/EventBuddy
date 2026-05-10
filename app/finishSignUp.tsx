import { useEffect, useCallback } from "react";
import { ActivityIndicator, View, Alert } from "react-native";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth, db } from "@/FirebaseConfig";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

function extractFirebaseLink(url: string): string {
    if (url.includes("link=")) {
        return decodeURIComponent(url.substring(url.indexOf("link=") + 5));
    }
    return url;
}

export default function FinishSignUp() {
    const processLink = useCallback(async (url: string) => {
        try {
            console.log("STEP 1 - raw url:", url.slice(0, 100));
            const finalLink = extractFirebaseLink(url);
            console.log("STEP 2 - firebase link:", finalLink.slice(0, 100));

            const isValid = isSignInWithEmailLink(auth, finalLink);
            console.log("STEP 3 - isValid:", isValid);

            if (!isValid) {
                Alert.alert("Помилка", "Недійсне посилання");
                router.replace("/SignIn");
                return;
            }

            const email = await AsyncStorage.getItem("emailForSignIn");
            const username = await AsyncStorage.getItem("usernameForSignIn");
            console.log("STEP 4 - email:", email);

            if (!email) {
                Alert.alert("Помилка", "Email не знайдено");
                router.replace("/SignIn");
                return;
            }

            console.log("STEP 5 - calling signInWithEmailLink...");
            const result = await signInWithEmailLink(auth, email, finalLink);
            console.log("STEP 6 - success!", result.user.uid);

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

        } catch (error: any) {
            console.log("ERROR code:", error.code);
            console.log("ERROR message:", error.message);
            Alert.alert("Помилка", `${error.code ?? ""}\n${error.message ?? "Невідома помилка"}`);
            router.replace("/SignIn");
        }
    }, []);

    useEffect(() => {
        let subscription: ReturnType<typeof Linking.addEventListener>;

        const init = async () => {
            const initialUrl = await Linking.getInitialURL();
            if (initialUrl) {
                await processLink(initialUrl);
                return;
            }
            subscription = Linking.addEventListener("url", ({ url }) => {
                processLink(url);
            });
        };

        init();
        return () => subscription?.remove();
    }, [processLink]);

    return (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" />
        </View>
    );
}