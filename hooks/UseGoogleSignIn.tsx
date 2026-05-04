import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/FirebaseConfig";
import { useEffect } from "react";

WebBrowser.maybeCompleteAuthSession();

export function useGoogleSignIn(onSuccess: () => void) {
    const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
        clientId: process.env.EXPO_PUBLIC_WEB_CLIENT_ID,         // з Google Cloud Console
        iosClientId: process.env.EXPO_PUBLIC_FIREBASE_IOS_CLIENT_ID,
        androidClientId: process.env.EXPO_PUBLIC_FIREBASE_ANDROID_CLIENT_ID,
    });

    useEffect(() => {
        if (response?.type !== "success") return;

        const { id_token } = response.params;
        const credential = GoogleAuthProvider.credential(id_token);

        signInWithCredential(auth, credential).then(async (result) => {
            const user = result.user;
            const userRef = doc(db, "users", user.uid);
            const snap = await getDoc(userRef);

            if (!snap.exists()) {
                // Перший вхід — зберегти профіль
                const username = user.displayName?.replace(/\s+/g, "_") ?? `user_${user.uid.slice(0, 6)}`;
                await setDoc(userRef, {
                    uid: user.uid,
                    email: user.email,
                    username,
                    usernameLower: username.toLowerCase(),
                    photoURL: user.photoURL,
                    createdAt: new Date(),
                });
            }

            onSuccess();
        });
    }, [response]);

    return { promptAsync, request };
}