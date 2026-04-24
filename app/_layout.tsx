import 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { View } from 'react-native';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
    const router = useRouter();
    const segments = useSegments();

    const [user, setUser] = useState<User | null>(null);
    const [authReady, setAuthReady] = useState(false);

    const [fontsLoaded] = useFonts({
        SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    });

    // 🔥 AUTH LISTENER (only source of truth)
    useEffect(() => {
        const auth = getAuth();

        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setAuthReady(true);
        });

        return unsub;
    }, []);

    useEffect(() => {
        if (!authReady) return;

        const firstSegment = segments?.[0];

        const inAuth = segments?.[0] === "SignIn" || segments?.[0] === "SignUp";
        const inTabsGroup = firstSegment === "(tabs)";

        if (!user && inTabsGroup) {
            router.replace("/SignIn");
        }

        if (user && inAuth) {
            router.replace("/HomeScreen");
        }
    }, [user, authReady, segments]);

    // 🔥 Splash control
    useEffect(() => {
        if (authReady && fontsLoaded) {
            SplashScreen.hideAsync();
        }
    }, [authReady, fontsLoaded]);

    // 🔥 BLOCK UI until ready (IMPORTANT)
    if (!authReady || !fontsLoaded) {
        return <View style={{ flex: 1, backgroundColor: "#fff" }} />;
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }} />
        </GestureHandlerRootView>
    );
}