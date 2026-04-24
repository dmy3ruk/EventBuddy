import { createBottomTabNavigator, BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { useEffect } from "react";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import HomeScreen from "./HomeScreen";
import ProfileScreen from "./ProfileScreen";
import CalendarScreen from "./CalendarScreen";
import FriendsScreen from "./Friends";
import ChatScreen from "./ChatScreen";
import ChatsListScreen from "./ChatsListScreen";
import PublicEventsScreen from "./PublicEventsScreen";

import { auth } from "../../FirebaseConfig";

const Tab = createBottomTabNavigator();

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
    useEffect(() => {
        const unsub = auth.onAuthStateChanged((user) => {
            if (!user) router.replace("/SignIn");
        });
        return unsub;
    }, []);

    const currentRouteName = state.routes[state.index].name;

    const shouldHideTabBar =
        currentRouteName === "Chats" ||
        currentRouteName === "Chat" ||
        currentRouteName === "Calendar";

    if (shouldHideTabBar) return null;

    const visibleRouteNames = ["Home", "Public Events", "Friends", "Profile"];

    const getIconName = (name: string, focused: boolean): any => {
        switch (name) {
            case "Home":          return focused ? "home" : "home-outline";
            case "Public Events": return focused ? "calendar" : "calendar-outline";
            case "Friends":       return focused ? "account-search" : "account-search-outline";
            case "Profile":       return focused ? "account" : "account-outline";
            default:              return "circle-outline";
        }
    };

    return (
        <View style={styles.container}>
            {state.routes.map((route, index) => {
                if (!visibleRouteNames.includes(route.name)) return null;

                const isFocused = state.index === index;

                const onPress = () => {
                    const event = navigation.emit({
                        type: 'tabPress',
                        target: route.key,
                        canPreventDefault: true,
                    });

                    if (!isFocused && !event.defaultPrevented) {
                        navigation.navigate(route.name);
                    }
                };

                return (
                    <TouchableOpacity
                        key={route.key}
                        onPress={onPress}
                        style={isFocused ? styles.activeTab : styles.tab}
                    >
                        <MaterialCommunityIcons
                            name={getIconName(route.name, isFocused)}
                            size={26}
                            color={isFocused ? "#fff" : "#505BEB"}
                        />
                        {isFocused && (
                            <Text style={styles.activeText}>
                                {route.name === "Public Events" ? "Explore" : route.name.toLowerCase()}
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
        <Tab.Navigator
            screenOptions={{ headerShown: false }}
            tabBar={(props) => <CustomTabBar {...props} />}
        >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Public Events" component={PublicEventsScreen} />
            <Tab.Screen name="Friends" component={FriendsScreen} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
            <Tab.Screen name="Calendar" component={CalendarScreen} />
            <Tab.Screen name="Chat" component={ChatScreen} />
            <Tab.Screen name="Chats" component={ChatsListScreen} />
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: "row",
        height: 65,
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "space-around",
        borderRadius: 35,
        alignSelf: "center",
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        paddingHorizontal: 1,
        position: "absolute",
        bottom: 30,
        width: '80%',
        borderWidth: 0.5,
        borderColor: "#E2E8F0",
    },
    tab: {
        padding: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    activeTab: {
        backgroundColor: "#505BEB",
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 25,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    activeText: {
        color: "#fff",
        marginLeft: 8,
        fontWeight: "600",
        fontSize: 14,
    },
});