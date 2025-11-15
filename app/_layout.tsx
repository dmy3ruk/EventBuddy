import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from 'expo-router';

export const unstable_settings = {
    initialRouteName: '(tabs)',
};

export default function RootLayout() {
    const [initialRoute, setInitialRoute] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const checkAuth = async () => {
            const token = await AsyncStorage.getItem("token");
            if (token) {
                setInitialRoute("(tabs)"); // Якщо токен є — переходимо в таби
            } else {
                setInitialRoute("SignIn"); // Інакше — на SignIn
            }
        };
        checkAuth();
    }, []);

    if (!initialRoute) return null; // Чекаємо поки перевіриться токен

    return (
        <Stack initialRouteName={initialRoute}>
            <Stack.Screen name="SignIn" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
    );
}
