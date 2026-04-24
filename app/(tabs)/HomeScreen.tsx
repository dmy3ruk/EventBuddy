import React, {useEffect, useState, useMemo} from "react";
import {
    View, Text, StyleSheet, TouchableOpacity, FlatList, StatusBar, Platform, ActivityIndicator
} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Haptics from 'expo-haptics';
import {Ionicons, MaterialCommunityIcons} from "@expo/vector-icons";
import {getAuth} from "firebase/auth";
import {collection, query, orderBy, onSnapshot} from "firebase/firestore";
import {db} from "../../FirebaseConfig";
import {useNavigation} from "@react-navigation/native";
import {useBottomTabBarHeight} from '@react-navigation/bottom-tabs';

import EventCard from "../../components/events/EventCard";
import CreateEventModal from "../../components/modals/CreateEventModal";
import {EventFull} from "../../utils/types";
import {filterEventsByTab, getTodayEvent} from "../../utils/eventUtils";
import {fetchUsername, acceptInvite, declineInvite} from "../../utils/firestoreHelpers";

const COLORS = {
    accent: "#505BEB",
    accentLight: "rgba(80, 91, 235, 0.12)",
    surface: "#F8FAFC",
    onSurface: "#1A1A1A",
    secondary: "#64748B",
    white: "#FFFFFF",
    error: "#EF4444",
    tabBg: "#E2E8F0",
    success: "#16A34A"
};

export default function HomeScreen() {
    const tabBarHeight = useBottomTabBarHeight();
    const navigation = useNavigation<any>();
    const uid = getAuth().currentUser?.uid || "";

    const [activeTab, setActiveTab] = useState<"Upcoming" | "Invitings" | "My Events">("Upcoming");
    const [isModalVisible, setModalVisible] = useState(false);
    const [events, setEvents] = useState<EventFull[]>([]);
    const [username, setUsername] = useState<string | null>(null);
    const [loading, setLoading] = useState(true); // Стан для анімації завантаження

    // Завантажуємо ім'я юзера
    useEffect(() => {
        const loadUser = async () => {
            const name = await fetchUsername();
            if (name) setUsername(name);
        };
        loadUser();
    }, []);

    // Слухаємо базу даних в реальному часі
    useEffect(() => {
        setLoading(true);
        const q = query(collection(db, "events"), orderBy("createdAt", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as EventFull));
            setEvents(data);
            setLoading(false); // Вимикаємо завантаження після отримання даних
        }, (error) => {
            console.error("Firestore error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Фільтрація подій
    const filteredEvents = useMemo(() => filterEventsByTab(events, activeTab, uid), [events, activeTab, uid]);
    const todayEvent = useMemo(() => getTodayEvent(events), [events]);

    const handleTabChange = (tab: any) => {
        if (Platform.OS === 'ios') Haptics.selectionAsync();
        setActiveTab(tab);
    };

    const openChat = (event: EventFull) => {
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
            <StatusBar barStyle="dark-content"/>

            <View style={styles.container}>
                <FlatList
                    // Якщо завантажується, передаємо порожній масив, щоб не показувати "No events" передчасно
                    data={loading ? [] : (filteredEvents.length > 0 ? filteredEvents : [{id: "empty"} as any])}
                    keyExtractor={(item) => item.id}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.listContent, {paddingBottom: tabBarHeight + 100}]}
                    ListHeaderComponent={
                        <View style={styles.headerContainer}>
                            <View style={styles.topRow}>
                                <View>
                                    <Text style={styles.greeting}>{username ? `Hi, ${username}!` : "Welcome!"}</Text>
                                    <Text style={styles.subGreeting}>Ready to make memories?</Text>
                                </View>
                                <TouchableOpacity style={styles.chatIconBtn}
                                                  onPress={() => navigation.navigate("Chats")}>
                                    <Ionicons name="chatbubble-ellipses" size={24} color={COLORS.accent}/>
                                </TouchableOpacity>
                            </View>

                            {/* Картка події на сьогодні (ховаємо під час завантаження для чистоти) */}
                            {!loading && (
                                <View style={styles.todayCard}>
                                    <View style={styles.todayHeader}>
                                        <View style={styles.liveBadge}>
                                            <View style={styles.liveDot}/>
                                            <Text style={styles.liveText}>TODAY</Text>
                                        </View>
                                        <Ionicons name="sparkles" size={18} color="#FFD700"/>
                                    </View>

                                    {todayEvent ? (
                                        <View>
                                            <Text style={styles.todayTitle} numberOfLines={1}>{todayEvent.name}</Text>
                                            <View style={styles.tagsRow}>
                                                <View style={styles.tag}>
                                                    <Ionicons name="time-outline" size={14} color="#FFF"/>
                                                    <Text style={styles.tagText}>{todayEvent.time}</Text>
                                                </View>
                                                <View style={styles.tag}>
                                                    <Ionicons name="location-outline" size={14} color="#FFF"/>
                                                    <Text style={styles.tagText} numberOfLines={1}>
                                                        {todayEvent.location?.name || "Somewhere"}
                                                    </Text>
                                                </View>
                                            </View>
                                            <TouchableOpacity activeOpacity={0.9} style={styles.todayButton}
                                                              onPress={() => openChat(todayEvent)}>
                                                <Text style={styles.todayButtonText}>Open Chat</Text>
                                                <View style={styles.btnCircle}>
                                                    <Ionicons name="arrow-forward" size={16} color={COLORS.accent}/>
                                                </View>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <View style={styles.emptyToday}>
                                            <Text style={styles.emptyTodayText}>No plans for today. Create an event!</Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* Перемикач вкладок */}
                            <View style={styles.tabsWrapper}>
                                {["Upcoming", "Invitings", "My Events"].map((tab) => {
                                    const isActive = activeTab === tab;
                                    const hasInvites = tab === "Invitings" && events.filter(e =>
                                        filterEventsByTab([e], "Invitings", uid).length > 0).length > 0;
                                    return (
                                        <TouchableOpacity key={tab} onPress={() => handleTabChange(tab as any)}
                                                          style={[styles.tabBtn, isActive && styles.tabBtnActive]}>
                                            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                                                {tab === "Invitings" ? "Invites" : tab}
                                            </Text>
                                            {hasInvites && <View style={styles.tabBadge}/>}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Блок завантаження */}
                            {loading && (
                                <View style={styles.loaderContainer}>
                                    <ActivityIndicator size="large" color={COLORS.accent} />
                                    <Text style={styles.loaderText}>Loading your plans...</Text>
                                </View>
                            )}
                        </View>
                    }
                    renderItem={({item}) => (
                        item.id === "empty" ? (
                            <View style={styles.emptyState}>
                                <MaterialCommunityIcons name="calendar-question" size={60} color={COLORS.secondary}/>
                                <Text style={styles.emptyStateText}>No events found</Text>
                            </View>
                        ) : (
                            <View style={styles.cardPadding}>
                                <EventCard
                                    item={item}
                                    uid={uid}
                                    onOpenChat={openChat}
                                    onAccept={acceptInvite}
                                    onDecline={declineInvite}
                                />
                            </View>
                        )
                    )}
                />

                {/* FAB */}
                <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.fab, {bottom: tabBarHeight + 15}]}
                    onPress={() => {
                        if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setModalVisible(true);
                    }}
                >
                    <Ionicons name="add" size={32} color="#FFF"/>
                </TouchableOpacity>

                <CreateEventModal visible={isModalVisible} closeModal={() => setModalVisible(false)}/>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {flex: 1, backgroundColor: COLORS.surface},
    container: {flex: 1},
    listContent: {paddingBottom: 20},
    headerContainer: {paddingHorizontal: 16},
    topRow: {flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 20},
    greeting: {fontSize: 28, fontWeight: "900", color: COLORS.onSurface, letterSpacing: -0.8},
    subGreeting: {fontSize: 15, color: COLORS.secondary, marginTop: 2},
    chatIconBtn: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: COLORS.white,
        justifyContent: "center",
        alignItems: "center",
        elevation: 3,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 8
    },
    todayCard: {
        backgroundColor: COLORS.accent,
        borderRadius: 28,
        padding: 20,
        marginBottom: 25,
        elevation: 10,
        shadowColor: COLORS.accent,
        shadowOpacity: 0.3,
        shadowRadius: 15
    },
    todayHeader: {flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15},
    liveBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255, 255, 255, 0.25)",
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12
    },
    liveDot: {width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFD700", marginRight: 6},
    liveText: {fontSize: 11, fontWeight: "900", color: COLORS.white, letterSpacing: 0.8},
    todayTitle: {fontSize: 24, fontWeight: "800", color: COLORS.white, marginBottom: 12},
    tagsRow: {flexDirection: "row", gap: 8, marginBottom: 20},
    tag: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255, 255, 255, 0.18)",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10
    },
    tagText: {color: COLORS.white, fontSize: 12, fontWeight: "600", marginLeft: 4},
    todayButton: {
        backgroundColor: COLORS.white,
        borderRadius: 18,
        paddingVertical: 14,
        paddingHorizontal: 20,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between"
    },
    todayButtonText: {color: COLORS.onSurface, fontSize: 15, fontWeight: "800"},
    btnCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.accentLight,
        justifyContent: "center",
        alignItems: "center"
    },
    emptyToday: {paddingVertical: 15, alignItems: 'center'},
    emptyTodayText: {color: "rgba(255, 255, 255, 0.8)", fontSize: 14, fontWeight: "600"},
    tabsWrapper: {flexDirection: "row", backgroundColor: COLORS.tabBg, padding: 5, borderRadius: 20, marginBottom: 20},
    tabBtn: {flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 16, position: "relative"},
    tabBtnActive: {
        backgroundColor: COLORS.white,
        elevation: 4,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 5
    },
    tabLabel: {fontSize: 13, color: COLORS.secondary, fontWeight: "700"},
    tabLabelActive: {color: COLORS.onSurface},
    tabBadge: {
        position: "absolute",
        top: 6,
        right: 12,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.error,
        borderWidth: 2,
        borderColor: COLORS.white
    },
    loaderContainer: {marginTop: 40, alignItems: "center", justifyContent: "center"},
    loaderText: {marginTop: 12, color: COLORS.secondary, fontSize: 14, fontWeight: "600"},
    cardPadding: {marginBottom: 8},
    emptyState: {alignItems: "center", marginTop: 60},
    emptyStateText: {color: COLORS.secondary, fontSize: 16, fontWeight: "600", marginTop: 12},
    fab: {
        position: "absolute",
        alignSelf: "center",
        backgroundColor: COLORS.success,
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: "center",
        alignItems: "center",
        elevation: 8,
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 }
    },
});