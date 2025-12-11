// app/(tabs)/ChatsListScreen.tsx
import React, { useEffect, useState, useMemo } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    StyleSheet,
} from "react-native";
import { getAuth } from "firebase/auth";
import {
    collection,
    onSnapshot,
    query,
    where,
    DocumentData,
    doc,
    getDoc,
    orderBy,
} from "firebase/firestore";
import { db } from "../../FirebaseConfig";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

type EventChatItem = {
    id: string;
    name: string;
    date: string;
    time: string;
    userId: string;
    invitedUserIds?: string[];
    acceptedUserIds?: string[];
};

export default function ChatsListScreen() {
    const [ownerEvents, setOwnerEvents] = useState<EventChatItem[]>([]);
    const [acceptedEvents, setAcceptedEvents] = useState<EventChatItem[]>([]);
    const [unreadByEvent, setUnreadByEvent] = useState<Record<string, boolean>>({});
    const [showArchived, setShowArchived] = useState(false);

    const auth = getAuth();
    const user = auth.currentUser;
    const navigation = useNavigation<any>();

    // ---------- MY EVENTS ----------
    useEffect(() => {
        if (!user) return;

        const qOwner = query(
            collection(db, "events"),
            where("userId", "==", user.uid)
        );

        return onSnapshot(qOwner, (snapshot) => {
            const data: EventChatItem[] = snapshot.docs.map((docSnap) => {
                const d = docSnap.data() as DocumentData;
                return {
                    id: docSnap.id,
                    name: d.name ?? "",
                    date: d.date ?? "",
                    time: d.time ?? "",
                    userId: d.userId ?? "",
                    invitedUserIds: d.invitedUserIds ?? [],
                    acceptedUserIds: d.acceptedUserIds ?? [],
                };
            });
            setOwnerEvents(data);
        });
    }, [user]);

    // ---------- ACCEPTED EVENTS ----------
    useEffect(() => {
        if (!user) return;

        const qAccepted = query(
            collection(db, "events"),
            where("acceptedUserIds", "array-contains", user.uid)
        );

        return onSnapshot(qAccepted, (snapshot) => {
            const data: EventChatItem[] = snapshot.docs.map((docSnap) => {
                const d = docSnap.data() as DocumentData;
                return {
                    id: docSnap.id,
                    name: d.name ?? "",
                    date: d.date ?? "",
                    time: d.time ?? "",
                    userId: d.userId ?? "",
                    invitedUserIds: d.invitedUserIds ?? [],
                    acceptedUserIds: d.acceptedUserIds ?? [],
                };
            });
            setAcceptedEvents(data);
        });
    }, [user]);

    // ---------- MERGED EVENTS ----------
    const chats = useMemo(() => {
        const map = new Map<string, EventChatItem>();

        [...ownerEvents, ...acceptedEvents].forEach((ev) => {
            map.set(ev.id, ev);
        });

        let merged = Array.from(map.values());

        merged = merged.filter(ev => {
            const amIOwner = ev.userId === user?.uid;
            const amIAccepted = ev.acceptedUserIds?.includes(user?.uid || "");

            return amIOwner || amIAccepted;
        });

        merged.sort((a, b) => {
            if (!a.date || !b.date) return 0;
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });

        return merged;
    }, [ownerEvents, acceptedEvents]);

    // ---------- SPLIT ACTIVE / ARCHIVED ----------
    const { activeChats, archivedChats } = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const active: EventChatItem[] = [];
        const archived: EventChatItem[] = [];

        chats.forEach(ev => {
            const evDate = new Date(ev.date);
            evDate.setHours(0, 0, 0, 0);

            if (evDate >= today) active.push(ev);
            else archived.push(ev);
        });

        return { activeChats: active, archivedChats: archived };
    }, [chats]);

    // ---------- UNREAD ----------
    useEffect(() => {
        if (!user) return;

        let unsubs: (() => void)[] = [];
        const list = [...activeChats, ...archivedChats];

        list.forEach((chat) => {
            const qMsgs = query(
                collection(db, "events", chat.id, "messages"),
                orderBy("createdAt", "desc")
            );

            const unsub = onSnapshot(qMsgs, async (msgSnap) => {
                const statusRef = doc(
                    db,
                    "users",
                    user.uid,
                    "chatStatus",
                    chat.id
                );
                const statusSnap = await getDoc(statusRef);
                const lastRead = statusSnap.exists()
                    ? statusSnap.data().lastRead
                    : null;

                let unread = false;

                msgSnap.forEach((m) => {
                    const data: any = m.data();
                    if (!data.createdAt) return;

                    if (data.userId === user.uid) return;

                    const createdMs = data.createdAt.toMillis
                        ? data.createdAt.toMillis()
                        : new Date(data.createdAt).getTime();

                    const lastReadMs = lastRead?.toMillis
                        ? lastRead.toMillis()
                        : lastRead
                            ? new Date(lastRead).getTime()
                            : 0;

                    if (!lastRead || createdMs > lastReadMs) unread = true;
                });

                setUnreadByEvent((prev) => ({
                    ...prev,
                    [chat.id]: unread,
                }));
            });

            unsubs.push(unsub);
        });

        return () => unsubs.forEach((fn) => fn());
    }, [activeChats, archivedChats, user]);

    // ---------- OPEN CHAT ----------
    const openChat = (event: EventChatItem) => {
        navigation.navigate("Chat", {
            eventId: event.id,
            name: event.name,
            date: event.date,
            time: event.time,
            participantsCount: event.acceptedUserIds?.length || 0,
        });
    };

    // ---------- RENDER ITEM ----------
    const renderItem = ({ item }: { item: EventChatItem }) => {
        const hasUnread = unreadByEvent[item.id];
        const initial = item.name?.trim()?.[0]?.toUpperCase() || "E";

        return (
            <TouchableOpacity
                style={[styles.item, hasUnread && styles.itemUnread]}
                onPress={() => openChat(item)}
                activeOpacity={0.85}
            >
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initial}</Text>
                </View>

                <View style={styles.content}>
                    <View style={styles.topRow}>
                        <Text style={styles.eventName} numberOfLines={1}>
                            {item.name}
                        </Text>
                        <Text style={styles.timeText}>{item.time}</Text>
                    </View>

                    <View style={styles.bottomRow}>
                        <Text style={styles.eventDate}>{item.date}</Text>
                        {hasUnread && <View style={styles.chatBadge} />}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // --------------------------------------------------

    return (
        <View style={styles.container}>
            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.navigate("Home")}
                    style={styles.backButton}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                    <Ionicons name="chevron-back" size={30} color="#111" />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>Chats</Text>

                <View style={{ width: 30 }} />
            </View>

            {/* SWITCH ACTIVE / ARCHIVED */}
            <View style={styles.switchRow}>
                <TouchableOpacity
                    style={[styles.switchBtn, !showArchived && styles.switchActive]}
                    onPress={() => setShowArchived(false)}
                >
                    <Text
                        style={[
                            styles.switchText,
                            !showArchived && styles.switchTextActive,
                        ]}
                    >
                        Active
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.switchBtn, showArchived && styles.switchActive]}
                    onPress={() => setShowArchived(true)}
                >
                    <Text
                        style={[
                            styles.switchText,
                            showArchived && styles.switchTextActive,
                        ]}
                    >
                        Archived
                    </Text>
                </TouchableOpacity>
            </View>

            {/* LIST */}
            <FlatList
                data={showArchived ? archivedChats : activeChats}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                ListEmptyComponent={
                    <Text style={styles.empty}>
                        {showArchived
                            ? "No archived chats"
                            : "You don't have any chats yet"}
                    </Text>
                }
                contentContainerStyle={{ paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
            />
        </View>
    );
}

// ---------- STYLES ----------
const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 14,
        paddingTop: 20,
        backgroundColor: "#F3F4F6",
        marginTop: 30,
    },

    header: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 10,
    },

    backButton: { padding: 6, borderRadius: 999 },
    headerTitle: {
        flex: 1,
        textAlign: "center",
        fontSize: 20,
        fontWeight: "700",
        color: "#111",
    },

    switchRow: {
        flexDirection: "row",
        justifyContent: "center",
        marginBottom: 14,
        gap: 8,
    },
    switchBtn: {
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: "#E5E7EB",
    },
    switchActive: { backgroundColor: "#505BEB" },
    switchText: { color: "#4B5563", fontWeight: "600" },
    switchTextActive: { color: "#fff" },

    item: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 16,
        marginBottom: 8,
        borderWidth: 0.5,
        borderColor: "#E5E7EB",
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 1,
    },
    itemUnread: {
        borderColor: "#C7D2FE",
        backgroundColor: "#F8FAFF",
    },

    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "#E0E7FF",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    avatarText: {
        fontSize: 18,
        fontWeight: "800",
        color: "#505BEB",
    },

    content: { flex: 1, gap: 4 },

    topRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    bottomRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    eventName: {
        fontSize: 16,
        fontWeight: "700",
        color: "#111",
        flex: 1,
    },
    timeText: { fontSize: 12, color: "#9CA3AF", fontWeight: "600" },
    eventDate: { fontSize: 13, color: "#6E7D93", fontWeight: "500" },

    chatBadge: {
        width: 10,
        height: 10,
        borderRadius: 6,
        backgroundColor: "#22C55E",
    },

    empty: {
        marginTop: 60,
        textAlign: "center",
        color: "#6E7D93",
        fontSize: 14,
    },
});
