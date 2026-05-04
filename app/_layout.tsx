import "react-native-gesture-handler";
import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts } from "expo-font";
import { View } from "react-native";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const router = useRouter();
    const segments = useSegments();

    const [user, setUser] = useState<User | null>(null);
    const [authReady, setAuthReady] = useState(false);

    const [fontsLoaded] = useFonts({
        SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    });

    useEffect(() => {
        const auth = getAuth();

        const unsub = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthReady(true);
        });

        return unsub;
    }, []);

    useEffect(() => {
        if (!authReady) return;

        const firstSegment = segments?.[0];

        const inAuth =
            firstSegment === "SignIn" ||
            firstSegment === "SignUp" ||
            firstSegment === "finishSignUp";

        const inTabsGroup = firstSegment === "(tabs)";

        if (!user && inTabsGroup) {
            router.replace("/SignIn");
            return;
        }

        if (user && inAuth) {
            router.replace("/(tabs)");
        }
    }, [user, authReady, segments]);

    useEffect(() => {
        if (authReady && fontsLoaded) {
            SplashScreen.hideAsync();
        }
    }, [authReady, fontsLoaded]);

    if (!authReady || !fontsLoaded) {
        return <View style={{ flex: 1, backgroundColor: "#fff" }} />;
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }} />
        </GestureHandlerRootView>
    );
}