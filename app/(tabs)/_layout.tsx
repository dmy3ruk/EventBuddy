import { createBottomTabNavigator, BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { useEffect } from "react";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import HomeScreen from "./HomeScreen";
import ProfileScreen from "./ProfileScreen";
import CalendarScreen from "./CalendarScreen";
import ModalScreen from "./ModalScreen";
import FriendsScreen from "./Friends";
import ChatScreen from "./ChatScreen";
import ChatsListScreen from "./ChatsListScreen";

import { auth } from "../../FirebaseConfig";
import PublicEventsScreen from "./PublicEventsScreen";

const Tab = createBottomTabNavigator();

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {

    useEffect(() => {
        const unsub = auth.onAuthStateChanged((user) => {
            if (!user) router.replace("/SignIn");
        });
        return unsub;
    }, []);

    const isChatFocused =
        state.routes[state.index]?.name === "Chats" ||
        state.routes[state.index]?.name === "Chat";

    if (isChatFocused) {
        return null;
    }

    // маршрути, які НЕ показуємо внизу
    const visibleRoutes = state.routes.filter(
        (route) => route.name !== "Chats" && route.name !== "Chat"
    );

    return (
        <View style={styles.container}>
            {visibleRoutes.map((route) => {
                const isFocused = state.routes[state.index]?.name === route.name;

                const onPress = () => {
                    if (!isFocused) navigation.navigate(route.name);
                };

                let iconSource;
                if (route.name === "Home") iconSource = require("../../assets/images/Home 1.svg");
                if (route.name === "Calendar") iconSource = require("../../assets/images/Calender 2.svg");
                if (route.name === "Profile") iconSource = require("../../assets/images/Profile Circle.svg");
                if (route.name === "Friends") iconSource = require("../../assets/images/search.svg");
                if (route.name === "Public Events") iconSource = require("../../assets/images/people.svg");

                return (
                    <TouchableOpacity
                        key={route.key}
                        onPress={onPress}
                        style={isFocused ? styles.activeTab : styles.tab}
                    >
                        <Image
                            source={iconSource}
                            style={{
                                width: 30,
                                height: 30,
                                tintColor: isFocused ? "#fff" : "#505BEB",
                            }}
                        />
                        {isFocused && (
                            <Text style={styles.activeText}>
                                {route.name.toLowerCase()}
                            </Text>
                        )}
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

export default function TabLayout() {
    return (
        <>
            <Tab.Navigator
                screenOptions={{
                    headerShown: false,
                    tabBarStyle: { backgroundColor: "transparent" },
                }}
                tabBar={(props) => <CustomTabBar {...props} />}
            >
                <Tab.Screen name="Home" component={HomeScreen} />
                <Tab.Screen name="Friends" component={FriendsScreen} />
                <Tab.Screen name="Calendar" component={CalendarScreen} />
                <Tab.Screen name="Profile" component={ProfileScreen} />
                <Tab.Screen name="Public Events" component={PublicEventsScreen} />

                {/* приховані з таббару екрани */}
                <Tab.Screen
                    name="Chat"
                    component={ChatScreen}
                    options={{ tabBarButton: () => null }}
                />
                <Tab.Screen
                    name="Chats"
                    component={ChatsListScreen}
                    options={{ tabBarButton: () => null }}
                />
            </Tab.Navigator>

            {/* це перекриває білу смугу safe area на iPhone */}
            <SafeAreaView
                edges={["bottom"]}
                style={{ backgroundColor: "#F9F9F9" }}
            />
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        height: 70,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 40,
        alignSelf: "center",
        elevation: 5,
        paddingHorizontal: 10,
        position: "absolute",
        bottom: 5,
        borderWidth: 0.5,
        borderColor: "#E2E8F0",
    },
    tab: {
        marginHorizontal: 10,
        alignItems: "center",
        justifyContent: "center",
    },
    activeTab: {
        backgroundColor: "#505BEB",
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 30,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 90,
    },
    activeText: {
        color: "#fff",
        marginLeft: 6,
        fontWeight: "500",
        fontSize: 14,
    },
});