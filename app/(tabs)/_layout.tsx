import { createBottomTabNavigator, BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { View, TouchableOpacity, Text, StyleSheet, Platform, Dimensions } from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import Svg, { Path } from 'react-native-svg';
import * as Haptics from "expo-haptics";
import AdminReportsScreen from "./AdminReportsScreen";

// ПРИБИРАЄМО ПРЯМИЙ ІМПОРТ Notifications ТУТ
// Ми завантажимо його динамічно, щоб симулятор не сварився

import HomeScreen from "./HomeScreen";
import ProfileScreen from "./ProfileScreen";
import CalendarScreen from "./CalendarScreen";
import FriendsScreen from "./Friends";
import ChatScreen from "./ChatScreen";
import ChatsListScreen from "./ChatsListScreen";
import PublicEventsScreen from "./PublicEventsScreen";
import CreateEventModal from "@/components/modals/CreateEventModal";

import { auth } from "../../FirebaseConfig";
import { registerForPushNotificationsAsync } from "@/utils/Notification";

const Tab = createBottomTabNavigator();
const { width } = Dimensions.get("window");

// Функція для налаштування обробника сповіщень (безпечна для симулятора)
const setupNotifications = async () => {
    if (Platform.OS === 'web') return;

    try {
        const Device = await import('expo-device');
        if (!Device.isDevice) return; // Якщо симулятор - нічого не робимо

        const Notifications = await import('expo-notifications');
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
                shouldShowBanner: true,
                shouldShowList: true,
            }),
        });
    } catch (e) {
        console.log("Notifications setup failed on simulator");
    }
};

// Викликаємо налаштування
setupNotifications();

const TabBarBackground = () => {
    const barWidth = width * 0.94;
    const center = barWidth / 2;
    const barHeight = 70;

    const d = `
        M25 0 
        L${center - 58} 0 
        C${center - 40} 0 ${center - 38} 50 ${center} 50 
        C${center + 38} 50 ${center + 40} 0 ${center + 58} 0 
        L${barWidth - 25} 0 
        Q${barWidth} 0 ${barWidth} 25 
        L${barWidth} 45 
        Q${barWidth} 70 ${barWidth - 25} 70 
        L25 70 
        Q0 70 0 45 
        L0 25 
        Q0 0 25 0 
        Z
    `;

    return (
        <View style={styles.svgContainer}>
            <Svg width={barWidth} height={barHeight}>
                <Path d={d} fill="white" />
            </Svg>
        </View>
    );
};

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
    const [isModalVisible, setModalVisible] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const unsub = auth.onAuthStateChanged(async (user) => {
            if (user) {
                registerForPushNotificationsAsync(user.uid);

                // 🔥 перевірка ролі
                try {
                    const { doc, getDoc } = await import("firebase/firestore");
                    const { db } = await import("../../FirebaseConfig");

                    const snap = await getDoc(doc(db, "users", user.uid));

                    if (snap.exists() && snap.data().role === "admin") {
                        setIsAdmin(true);
                        navigation.navigate("Admin");
                    }
                } catch (e) {
                    console.log("Admin check error:", e);
                }

            } else {
                router.replace("/SignIn");
            }
        });
        return unsub;
    }, []);
    useEffect(() => {
        const unsub = auth.onAuthStateChanged((user) => {
            if (user) {
                // Викликаємо нашу безпечну функцію з Notification.tsx
                registerForPushNotificationsAsync(user.uid);
            } else {
                router.replace("/SignIn");
            }
        });
        return unsub;
    }, []);

    const currentRouteName = state.routes[state.index].name;
    if (["Chats", "Chat", "Calendar", "Admin"].includes(currentRouteName)) return null;

    const routes = state.routes.filter(r =>
        ["Home", "Public Events", "Friends", "Profile", ...(isAdmin ? ["Admin"] : [])].includes(r.name)
    );
    const leftTabs = routes.slice(0, 2);
    const rightTabs = routes.slice(2, 4);

    const renderTab = (route: any) => {
        const index = state.routes.findIndex(r => r.key === route.key);
        const isFocused = state.index === index;

        return (
            <TouchableOpacity
                key={route.key}
                onPress={() => !isFocused && navigation.navigate(route.name)}
                style={isFocused ? styles.activeTab : styles.tab}
                activeOpacity={0.7}
            >
                <MaterialCommunityIcons
                    name={(isFocused ? getIcon(route.name).active : getIcon(route.name).outline) as any}
                    size={24}
                    color={isFocused ? "#fff" : "#505BEB"}
                />
                {isFocused && (
                    <Text style={styles.activeText} numberOfLines={1}>
                        {route.name === "Public Events" ? "Explore" : route.name.toLowerCase()}
                    </Text>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.wrapper}>
            <TabBarBackground />
            <TouchableOpacity
                style={styles.fabButton}
                activeOpacity={0.85}
                onPress={() => {
                    if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setModalVisible(true);
                }}
            >
                <Ionicons name="add" size={32} color="#fff" />
            </TouchableOpacity>
            <View style={styles.contentContainer}>
                <View style={styles.sideSection}>{leftTabs.map(renderTab)}</View>
                <View style={styles.placeholder} />
                <View style={styles.sideSection}>{rightTabs.map(renderTab)}</View>
            </View>
            <CreateEventModal visible={isModalVisible} closeModal={() => setModalVisible(false)} />
        </View>
    );
}

const getIcon = (name: string) => {
    switch (name) {
        case "Home": return { active: "home", outline: "home-outline" };
        case "Public Events": return { active: "calendar", outline: "calendar-outline" };
        case "Friends": return { active: "account-search", outline: "account-search-outline" };
        case "Profile": return { active: "account", outline: "account-outline" };
        case "Admin": return { active: "shield-check", outline: "shield-outline" };
        default: return { active: "circle", outline: "circle-outline" };
    }
};

export default function TabLayout() {
    return (
        <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <CustomTabBar {...props} />}>
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Public Events" component={PublicEventsScreen} />
            <Tab.Screen name="Friends" component={FriendsScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
            <Tab.Screen name="Calendar" component={CalendarScreen} />
            <Tab.Screen name="Chat" component={ChatScreen} />
            <Tab.Screen name="Chats" component={ChatsListScreen} />
            <Tab.Screen name="Admin" component={AdminReportsScreen} />
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    wrapper: { position: "absolute", bottom: 30, width: '100%', height: 70, alignItems: 'center', backgroundColor: 'transparent' },
    svgContainer: { position: 'absolute', top: 0, shadowColor: '#505BEB', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 20 },
    contentContainer: { flexDirection: "row", width: '94%', height: 70, alignItems: "center", paddingHorizontal: 10 },
    sideSection: { flex: 1, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
    placeholder: { width: 85 },
    fabButton: { position: 'absolute', top: -24, width: 60, height: 60, backgroundColor: "#10B981", borderRadius: 30, justifyContent: "center", alignItems: "center", zIndex: 30, shadowColor: "#10B981", shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 12 },
    tab: { alignItems: "center", justifyContent: "center", padding: 5 },
    activeTab: { backgroundColor: "#505BEB", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, flexDirection: "row", alignItems: "center", maxWidth: 100 },
    activeText: { color: "#fff", marginLeft: 5, fontWeight: "700", fontSize: 12 },
});