import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import React, { useEffect, useState } from "react";
import { Image } from "expo-image";
import { getAuth } from "firebase/auth";
import { Ionicons } from "@expo/vector-icons";
import {collection, query, orderBy, doc, getDoc, onSnapshot, updateDoc, arrayUnion, arrayRemove, where,} from "firebase/firestore";
import { db } from "../../FirebaseConfig";
import ModalScreen from "./ModalScreen";
import { useNavigation } from "@react-navigation/native";
import EventCard from "./EventCard";

import { EventType } from "../../utils/types";
import { filterEventsByTab, getTodayEvent } from "../../utils/eventUtils";
import { fetchUsername, acceptInvite, declineInvite } from "../../utils/firestoreHelpers";

export default function HomeScreen() {
    const [activeTab, setActiveTab] =
        useState<"Upcoming" | "Invitings" | "My Events">("Upcoming");
    const [isModalVisible, setModalVisible] = useState(false);
    const [username, setUsername] = useState<string>("");
    const [events, setEvents] = useState<EventType[]>([]);
    const [hasUnread, setHasUnread] = useState(false);
    const navigation = useNavigation<any>();
    const [unreadByEvent, setUnreadByEvent] = useState<Record<string, boolean>>({});

    const navHeight = 60;

    const uid = getAuth().currentUser?.uid || "";

    // username
    useEffect(() => {
        const loadUsername = async () => {
            const name = await fetchUsername();
            if (name) {
                setUsername(name);
            } else {
                setUsername("No username");
            }
        };

        loadUsername();
    }, []);


    // events realtime
    useEffect(() => {
        const q = query(collection(db, "events"), orderBy("createdAt", "desc"));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const eventsData = snapshot.docs.map(
                    (docSnap) => ({ id: docSnap.id, ...docSnap.data() } as EventType)
                );
                setEvents(eventsData);
            },
            (error) => console.log("Error loading events:", error)
        );

        return () => unsubscribe();
    }, []);

    // unread tracking
    useEffect(() => {
        const user = getAuth().currentUser;
        if (!user) return;

        const eventsRef = collection(db, "events");
        const qEvents = query(
            eventsRef,
            where("acceptedUserIds", "array-contains", user.uid)
        );

        let messageUnsubs: (() => void)[] = [];

        const unsubEvents = onSnapshot(qEvents, (snapshot) => {
            messageUnsubs.forEach((fn) => fn());
            messageUnsubs = [];

            if (snapshot.empty) {
                setUnreadByEvent({});
                setHasUnread(false);
                return;
            }

            snapshot.docs.forEach((eventDoc) => {
                const eventId = eventDoc.id;

                const messagesRef = collection(db, "events", eventId, "messages");
                const qMsgs = query(messagesRef, orderBy("createdAt", "desc"));

                const unsubMsgs = onSnapshot(qMsgs, async (msgSnap) => {
                    const statusRef = doc(
                        db,
                        "users",
                        user.uid,
                        "chatStatus",
                        eventId
                    );
                    const statusSnap = await getDoc(statusRef);
                    const lastRead = statusSnap.exists()
                        ? (statusSnap.data().lastRead as any)
                        : null;

                    let hasUnreadForThisEvent = false;

                    msgSnap.forEach((msg) => {
                        const data: any = msg.data();
                        if (data.userId === user.uid) return;
                        if (!data.createdAt) return;

                        const createdMs = data.createdAt.toMillis
                            ? data.createdAt.toMillis()
                            : new Date(data.createdAt).getTime();

                        const lastReadMs = lastRead?.toMillis
                            ? lastRead.toMillis()
                            : lastRead
                                ? new Date(lastRead).getTime()
                                : 0;

                        if (!lastRead || createdMs > lastReadMs) {
                            hasUnreadForThisEvent = true;
                        }
                    });

                    setUnreadByEvent((prev) => {
                        const updated = { ...prev, [eventId]: hasUnreadForThisEvent };
                        setHasUnread(Object.values(updated).some(Boolean));
                        return updated;
                    });
                });

                messageUnsubs.push(unsubMsgs);
            });
        });

        return () => {
            unsubEvents();
            messageUnsubs.forEach((fn) => fn());
        };
    }, []);

    const filteredEvents = filterEventsByTab(events, activeTab, uid);
    const todayEvent = getTodayEvent(events);

    const openChat = (event: EventType) => {
        const participantsCount = (event.invitedUserIds?.length || 0) + 1;

        navigation.navigate("Chat", {
            eventId: event.id,
            name: event.name,
            date: event.date,
            time: event.time,
            participantsCount,
        });
    };

    const renderEvent = ({ item }: { item: EventType }) => (
        <EventCard
            item={item}
            uid={uid}
            onOpenChat={openChat}
            onAccept={acceptInvite}
            onDecline={declineInvite}
        />
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={
                    filteredEvents.length > 0 ? filteredEvents : ([{ id: "empty" }] as any)
                }
                keyExtractor={(item: any) => item.id}
                ListHeaderComponent={
                    <>
                        {/* header */}
                        <View style={styles.headerRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.greeting}>Hi {username}!</Text>
                                <Text style={styles.subGreeting}>
                                    ready to plan your next great moment?
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={styles.directButton}
                                onPress={() => navigation.navigate("Chats")}
                            >
                                <View style={{ position: "relative" }}>
                                    <Ionicons
                                        name="paper-plane-outline"
                                        size={22}
                                        color="#505BEB"
                                    />
                                    {hasUnread && <View style={styles.badge} />}
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* today */}
                        <View style={styles.todayCard}>
                            <View style={styles.todayHeader}>
                                <View style={styles.today}>
                                    <TouchableOpacity onPress={() => navigation.navigate("Calendar")}>
                                    <Image source={require("../../assets/images/today.svg")}
                                        style={{ width: 40, height: 40 }} />
                                    </TouchableOpacity>
                                    <Text style={styles.todayTitle}>Today</Text>
                                </View>

                            </View>

                            {todayEvent ? (
                                <>
                                    <Text style={{ fontSize: 16, fontWeight: "600", marginTop: 10 }}>
                                        {todayEvent.name}
                                    </Text>
                                    <Text style={{ fontSize: 14, color: "#6E7D93", marginTop: 4 }}>
                                        {todayEvent.time}
                                    </Text>

                                    <TouchableOpacity
                                        style={styles.chatButton}
                                        onPress={() => openChat(todayEvent)}
                                    >
                                        <Text style={styles.chatButtonText}>Open chat</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <Text style={styles.todayText}>
                                    You don't have any plans for today 😊
                                </Text>
                            )}
                        </View>

                        {/* tabs */}
                        <View style={styles.tabs}>
                            {["Upcoming", "Invitings", "My Events"].map((tabName) => (
                                <TouchableOpacity
                                    key={tabName}
                                    style={[
                                        styles.tab,
                                        activeTab === tabName && styles.activeTab,
                                    ]}
                                    onPress={() => setActiveTab(tabName as any)}
                                >
                                    <Text
                                        style={[
                                            styles.tabText,
                                            activeTab === tabName && styles.activeTabText,
                                        ]}
                                    >
                                        {tabName}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </>
                }
                renderItem={({ item }: any) =>
                    item.id === "empty" ? (
                        <View style={styles.cardEmpty}>
                            <Text style={styles.emptyText}>
                                You don't have any {activeTab}
                            </Text>
                        </View>
                    ) : (
                        renderEvent({ item })
                    )
                }
                contentContainerStyle={{ paddingBottom: 140 }}
            />

            {/* add button */}
            <TouchableOpacity
                style={[styles.addButtonFloating, { bottom: navHeight + 20 }]}
                onPress={() => setModalVisible(true)}
            >
                <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>

            <ModalScreen
                visible={isModalVisible}
                closeModal={() => setModalVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F9F9F9",
        marginTop: 20
    },

    headerRow: {
        marginTop: 50,
        marginHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
    },

    directButton: {
        width: 50,
        height: 50,
        borderRadius: 40,
        backgroundColor: "#FFFFFF",
        borderWidth: 0.5,
        borderColor: "#E2E8F0",
        alignItems: "center",
        justifyContent: "center",
        marginLeft: 12,
    },

    greeting: {
        fontSize: 20,
        fontWeight: "600",
        color: "#000",
    },

    subGreeting: {
        fontSize: 15,
        color: "#6E7D93",
        marginTop: 4,
        marginBottom: 0,
    },

    today: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },

    todayCard: {
        backgroundColor: "#fff",
        padding: 20,
        borderRadius: 16,
        marginBottom: 20,
        marginTop: 20,
        marginHorizontal: 16,
        borderWidth: 0.5,
        borderColor: "#E2E8F0",
    },

    todayHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },

    todayTitle: { fontSize: 18, fontWeight: "600", color: "#1A1A1A" },

    todayText: {
        fontSize: 16,
        color: "#6E7D93",
        marginTop: 8,
        textAlign: "center",
    },

    tabs: {
        flexDirection: "row",
        backgroundColor: "#fff",
        justifyContent: "space-between",
        marginBottom: 20,
        borderRadius: 40,
        borderWidth: 0.5,
        borderColor: "#E2E8F0",
        marginHorizontal: 20,
    },

    tab: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 20,
        backgroundColor: "#fff",
    },

    tabText: { color: "#000" },
    activeTab: { backgroundColor: "#505BEB" },
    activeTabText: { color: "#fff" },

    addButtonFloating: {
        position: "absolute",
        alignSelf: "center",
        backgroundColor: "green",
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.3,
        marginBottom: 20,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 5,
        elevation: 5,
        zIndex: 10,
    },

    addButtonText: { color: "#fff", fontSize: 24, fontWeight: "bold" },

    chatButton: {
        marginTop: 10,
        alignSelf: "flex-start",
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 0.8,
        borderColor: "#505BEB",
        backgroundColor: "#EEF2FF",
    },

    chatButtonText: {
        color: "#505BEB",
        fontSize: 13,
        fontWeight: "600",
    },

    cardEmpty: {
        backgroundColor: "#fff",
        padding: 10,
        borderRadius: 16,
        marginBottom: 20,
        marginHorizontal: 24,
        borderWidth: 0.5,
        borderColor: "#E2E8F0",
    },

    emptyText: { color: "#6E7D93", textAlign: "center", paddingVertical: 32 },

    badge: {
        position: "absolute",
        top: -2,
        right: -2,
        width: 9,
        height: 9,
        borderRadius: 100,
        backgroundColor: "#22C55E",
    },
});