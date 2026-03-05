import React, { useEffect, useState, useMemo } from "react";
import { 
    View, Text, StyleSheet, TouchableOpacity, FlatList, StatusBar, Platform 
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from 'expo-haptics';
import { Ionicons } from "@expo/vector-icons";
import { getAuth } from "firebase/auth";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../../FirebaseConfig";
import { useNavigation } from "@react-navigation/native";

import EventCard from "../../components/events/EventCard";
import CreateEventModal from "../../components/modals/CreateEventModal";
import { EventType } from "../../utils/types";
import { filterEventsByTab, getTodayEvent } from "../../utils/eventUtils";
import { fetchUsername, acceptInvite, declineInvite } from "../../utils/firestoreHelpers";
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

export default function HomeScreen() {
    const insets = useSafeAreaInsets();
    const tabBarHeight = useBottomTabBarHeight();

    const [activeTab, setActiveTab] = useState<"Upcoming" | "Invitings" | "My Events">("Upcoming");
    const [isModalVisible, setModalVisible] = useState(false);
    const [events, setEvents] = useState<EventType[]>([]);
    const [username, setUsername] = useState<string | null>(null);
    
    const navigation = useNavigation<any>();
    const uid = getAuth().currentUser?.uid || "";

    useEffect(() => {
        const loadUser = async () => {
            const name = await fetchUsername();
            if (name) setUsername(name);
        };
        loadUser();
    }, []);

    useEffect(() => {
        const q = query(collection(db, "events"), orderBy("createdAt", "desc"));
        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EventType));
            setEvents(data);
        });
    }, []);

    const filteredEvents = useMemo(() => filterEventsByTab(events, activeTab, uid), [events, activeTab, uid]);
    const todayEvent = useMemo(() => getTodayEvent(events), [events]);

    const handleTabChange = (tab: any) => {
        if (Platform.OS === 'ios') Haptics.selectionAsync();
        setActiveTab(tab);
    };

    const openChat = (event: EventType) => {
        if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        navigation.navigate("Chat", {
            eventId: event.id,
            name: event.name,
            date: event.date,
            time: event.time,
        });
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.container}>
                <FlatList
                    data={filteredEvents.length > 0 ? filteredEvents : [{ id: "empty" } as any]}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[
                        styles.listContent,
                        { paddingBottom: tabBarHeight + 90 } 
                    ]}
                    ListHeaderComponent={
                        <>
                            <View style={styles.headerRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.greeting}>{username ? `Hi, ${username}!` : "Welcome!"}</Text>
                                    <Text style={styles.subGreeting}>Ready to make memories?</Text>
                                </View>
                                <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate("Chats")}>
                                    <Ionicons name="chatbubble-ellipses-outline" size={24} color="#1A1A1A" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.todayCard}>
                                <View style={styles.todayBgIcon}>
                                    <Ionicons name="flash" size={100} color="rgba(255, 255, 255, 0.12)" />
                                </View>

                                <View style={styles.todayHeader}>
                                    <View style={styles.liveBadge}>
                                        <View style={styles.liveDot} />
                                        <Text style={styles.liveText}>СЬОГОДНІ</Text>
                                    </View>
                                    <Ionicons name="star" size={16} color="#FFD700" />
                                </View>

                                {todayEvent ? (
                                    <View style={styles.todayBody}>
                                        <Text style={styles.todayEventName} numberOfLines={1}>
                                            {todayEvent.name}
                                        </Text>
                                        
                                        <View style={styles.todayTags}>
                                            <View style={styles.tag}>
                                                <Ionicons name="time" size={12} color="#FFF" />
                                                <Text style={styles.tagText}>{todayEvent.time}</Text>
                                            </View>
                                            <View style={styles.tag}>
                                                <Text style={styles.tagText}>📍 {todayEvent.locationName || "Somewhere"}</Text>
                                            </View>
                                        </View>

                                        <TouchableOpacity 
                                            activeOpacity={0.9} 
                                            style={styles.todayButton}
                                            onPress={() => openChat(todayEvent)}
                                        >
                                            <Text style={styles.todayButtonText}>Open Event Chat</Text>
                                            <View style={styles.btnCircle}>
                                                <Ionicons name="arrow-forward" size={14} color="#505BEB" />
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View style={styles.emptyToday}>
                                        <Text style={styles.emptyTodayText}>No plans yet? Tap + to create one!</Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.tabsWrapper}>
                                {["Upcoming", "Invitings", "My Events"].map((tab) => (
                                    <TouchableOpacity
                                        key={tab}
                                        onPress={() => handleTabChange(tab as any)}
                                        style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
                                    >
                                        <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                                            {tab === "Invitings" ? "Invites" : tab}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </>
                    }
                    renderItem={({ item }) => (
                        item.id === "empty" ? (
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyStateText}>No events in this category</Text>
                            </View>
                        ) : (
                            <EventCard
                                item={item}
                                uid={uid}
                                onOpenChat={openChat}
                                onAccept={acceptInvite}
                                onDecline={declineInvite}
                            />
                        )
                    )}
                />

                <TouchableOpacity
                    activeOpacity={0.8}
                    style={[
                        styles.addButtonFloating,
                        { bottom: tabBarHeight + 10 }
                    ]}
                    onPress={() => {
                        if (Platform.OS === "ios") {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        }
                        setModalVisible(true);
                    }}
                >
                    <Ionicons name="add" size={32} color="#FFF" />
                </TouchableOpacity>
                
                <CreateEventModal visible={isModalVisible} closeModal={() => setModalVisible(false)} />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { 
        flex: 1, 
        backgroundColor: "#F8FAFC" 
    },
    container: { 
        flex: 1, 
        backgroundColor: "#F8FAFC" 
    },
    listContent: { 
        paddingBottom: 20,
    },
    headerRow: { 
        flexDirection: "row", 
        alignItems: "center", 
        paddingHorizontal: 20, 
        paddingVertical: 15 // Трохи менше
    },
    greeting: { fontSize: 26, fontWeight: "900", color: "#1A1A1A", letterSpacing: -0.5 },
    subGreeting: { fontSize: 14, color: "#64748B", marginTop: 2 },
    iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFF", justifyContent: "center", alignItems: "center", elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },

    todayCard: {
        backgroundColor: "#505BEB",
        borderRadius: 24, // Більш лаконічно
        padding: 16,     // Стиснуто з 24
        marginHorizontal: 16,
        marginBottom: 20,
        position: "relative",
        overflow: "hidden",
        ...Platform.select({
            ios: { shadowColor: "#505BEB", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 10 },
            android: { elevation: 8 }
        })
    },
    todayBgIcon: { position: "absolute", right: -10, top: -10, opacity: 0.5 },
    todayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    liveBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255, 255, 255, 0.2)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
    liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "#FFD700", marginRight: 5 },
    liveText: { fontSize: 10, fontWeight: "900", color: "#FFF", letterSpacing: 0.5 },
    
    todayBody: { zIndex: 2 },
    todayEventName: { fontSize: 20, fontWeight: "800", color: "#FFF", marginBottom: 8, lineHeight: 26 },
    todayTags: { flexDirection: "row", gap: 6, marginBottom: 16 },
    tag: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255, 255, 255, 0.15)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    tagText: { color: "#FFF", fontSize: 12, fontWeight: "600", marginLeft: 4 },
    
    todayButton: { 
        backgroundColor: "#FFF", 
        borderRadius: 12, 
        paddingVertical: 10, 
        paddingHorizontal: 16, 
        flexDirection: "row", 
        alignItems: "center", 
        justifyContent: "space-between" 
    },
    todayButtonText: { color: "#1A1A1A", fontSize: 14, fontWeight: "700" },
    btnCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center" },
    
    emptyToday: { paddingVertical: 10, alignItems: 'center' },
    emptyTodayText: { color: "rgba(255, 255, 255, 0.8)", fontSize: 14, fontWeight: "500" },

    tabsWrapper: { flexDirection: "row", backgroundColor: "#E2E8F0", padding: 4, borderRadius: 14, marginHorizontal: 16, marginBottom: 15 },
    tabItem: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
    tabItemActive: { backgroundColor: "#FFF", elevation: 2, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
    tabLabel: { fontSize: 13, color: "#64748B", fontWeight: "700" },
    tabLabelActive: { color: "#1A1A1A" },

    addButtonFloating: {
        position: "absolute",
        left: "50%",
        transform: [{ translateX: -30 }],
        backgroundColor: "#16A34A", // Чистий зелений (виглядає краще за прозорий)
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: "center",
        alignItems: "center",
        elevation: 6,
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 3 }
    },
    emptyState: { alignItems: "center", paddingVertical: 60 },
    emptyStateText: { color: "#94A3B8", fontSize: 16, fontWeight: "500" },
});