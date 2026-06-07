import React, { useEffect, useState, useMemo } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Platform, StatusBar, TextInput,
} from "react-native";
import { getAuth } from "firebase/auth";
import { limit } from "firebase/firestore";
import { collection, onSnapshot, query, where, doc, getDoc, orderBy,
} from "firebase/firestore";
import { db } from "../../FirebaseConfig";
import { useNavigation } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from 'expo-haptics';
import {EventChatItem} from "@/utils/types";

const COLORS = {
    primary: "#505BEB",
    primaryContainer: "rgba(80, 91, 235, 0.1)",
    surface: "#F8FAFC",
    onSurface: "#1A1A1A",
    outline: "#64748B",
    white: "#FFFFFF",
    success: "#16A34A",
    cardBg: "#FFFFFF",
};

export default function ChatsListScreen() {
    const [ownerEvents, setOwnerEvents] = useState<EventChatItem[]>([]);
    const [acceptedEvents, setAcceptedEvents] = useState<EventChatItem[]>([]);
    const [unreadByEvent, setUnreadByEvent] = useState<Record<string, boolean>>({});
    const [showArchived, setShowArchived] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);

    const auth = getAuth();
    const user = auth.currentUser;
    const navigation = useNavigation<any>();

    useEffect(() => {
        if (!user) return;
        const qOwner = query(collection(db, "events"), where("userId", "==", user.uid));
        return onSnapshot(qOwner, (snapshot) => {
            setOwnerEvents(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as EventChatItem)));
            setLoading(false);
        });
    }, [user]);

    useEffect(() => {
        if (!user) return;
        const qAccepted = query(collection(db, "events"), where("acceptedUserIds", "array-contains", user.uid));
        return onSnapshot(qAccepted, (snapshot) => {
            setAcceptedEvents(snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as EventChatItem)));
        });
    }, [user]);

    const chats = useMemo(() => {
        const map = new Map<string, EventChatItem>();
        [...ownerEvents, ...acceptedEvents].forEach((ev) => map.set(ev.id, ev));
        let merged = Array.from(map.values()).filter(ev => ev.userId === user?.uid || ev.acceptedUserIds?.includes(user?.uid || ""));
        // Фільтрація за пошуковим запитом
        if (searchQuery.trim().length > 0) {
            merged = merged.filter(chat => 
                chat.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return merged;
    }, [ownerEvents, acceptedEvents, user, searchQuery]);

    const { activeChats, archivedChats } = useMemo(() => {
        const today = new Date().setHours(0, 0, 0, 0);
        const active: EventChatItem[] = [];
        const archived: EventChatItem[] = [];
        chats.forEach(ev => {
            const evDate = new Date(ev.date).setHours(0, 0, 0, 0);
            if (evDate >= today) active.push(ev);
            else archived.push(ev);
        });
        return { activeChats: active, archivedChats: archived };
    }, [chats]);

    useEffect(() => {
        if (!user) return;
        const allChats = (() => {
            const map = new Map<string, EventChatItem>();
            [...ownerEvents, ...acceptedEvents].forEach((ev) => map.set(ev.id, ev));
            return Array.from(map.values()).filter(
                ev => ev.userId === user.uid || ev.acceptedUserIds?.includes(user.uid)
            );
        })();

        const unsubs: (() => void)[] = [];
        const subscribedIds = new Set<string>();

        allChats.forEach((chat) => {
            if (subscribedIds.has(chat.id)) return;
            subscribedIds.add(chat.id);

            const messagesRef = collection(db, "events", chat.id, "messages");
            const qMsgs = query(messagesRef, orderBy("createdAt", "desc"), limit(1));
            const statusRef = doc(db, "users", user.uid, "chatStatus", chat.id);

            let lastMsgData: any = null;
            let lastReadMs = 0;
            let msgLoaded = false;
            let statusLoaded = false;

            const recalcUnread = () => {
                if (!msgLoaded || !statusLoaded) return;
                const isUnread = lastMsgData && lastMsgData.userId !== user.uid && (() => {
                    const createdMs = lastMsgData.createdAt?.toMillis?.() ?? new Date(lastMsgData.createdAt).getTime();
                    return createdMs > lastReadMs;
                })();
                setUnreadByEvent(prev => {
                    const next = !!isUnread;
                    if (prev[chat.id] === next) return prev; // ← не оновлюємо стейт якщо не змінилось
                    return { ...prev, [chat.id]: next };
                });
            };

            const unsubMsg = onSnapshot(qMsgs, (snap) => {
                lastMsgData = snap.docs[0]?.data() ?? null;
                msgLoaded = true;
                recalcUnread();
            });

            const unsubStatus = onSnapshot(statusRef, (snap) => {
                lastReadMs = snap.exists() ? (snap.data().lastRead?.toMillis?.() ?? 0) : 0;
                statusLoaded = true;
                recalcUnread();
            });

            unsubs.push(unsubMsg, unsubStatus);
        });

        return () => unsubs.forEach(fn => fn());
    }, [ownerEvents, acceptedEvents, user]);


    const openChat = (event: EventChatItem) => {
        if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate("Chat", {
            eventId: event.id,
            name: event.name,
            date: event.date,
            time: event.time,
            participantsCount: event.acceptedUserIds?.length || 0,
        });
    };

    const handleSwitch = (archived: boolean) => {
        if (Platform.OS === 'ios') Haptics.selectionAsync();
        setShowArchived(archived);
    };

    const toggleSearch = () => {
        setIsSearching(!isSearching);
        if (isSearching) setSearchQuery("");
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <StatusBar barStyle="dark-content" />
            
            <View style={styles.header}>
                {!isSearching ? (
                    <>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                            <Ionicons name="chevron-back" size={24} color={COLORS.onSurface} />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Messages</Text>
                        <TouchableOpacity style={styles.headerIcon} onPress={toggleSearch}>
                            <MaterialCommunityIcons name="comment-search-outline" size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                    </>
                ) : (
                    <View style={styles.searchContainer}>
                        <View style={styles.searchInputWrapper}>
                            <Ionicons name="search" size={20} color={COLORS.outline} style={{ marginRight: 8 }} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search chats..."
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoFocus
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery("")}>
                                    <Ionicons name="close-circle" size={18} color={COLORS.outline} />
                                </TouchableOpacity>
                            )}
                        </View>
                        <TouchableOpacity onPress={toggleSearch} style={styles.cancelBtn}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity 
                    onPress={() => handleSwitch(false)}
                    style={[styles.tab, !showArchived && styles.tabActive]}
                >
                    <Text style={[styles.tabText, !showArchived && styles.tabTextActive]}>Active</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={() => handleSwitch(true)}
                    style={[styles.tab, showArchived && styles.tabActive]}
                >
                    <Text style={[styles.tabText, showArchived && styles.tabTextActive]}>Archived</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
            ) : (
                <FlatList
                    data={showArchived ? archivedChats : activeChats}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => {
                        const hasUnread = unreadByEvent[item.id];
                        return (
                            <TouchableOpacity 
                                style={[styles.chatCard, hasUnread && styles.unreadCard]} 
                                onPress={() => openChat(item)}
                            >
                                <View style={[styles.avatar, { backgroundColor: COLORS.primaryContainer }]}>
                                    <Text style={styles.avatarText}>{item.name[0].toUpperCase()}</Text>
                                </View>

                                <View style={styles.chatInfo}>
                                    <View style={styles.infoTop}>
                                        <Text style={styles.chatName} numberOfLines={1}>{item.name}</Text>
                                        <Text style={styles.chatTime}>{item.time}</Text>
                                    </View>
                                    <View style={styles.infoBottom}>
                                        <Text style={styles.chatDate}>{item.date}</Text>
                                        {hasUnread && <View style={styles.unreadDot} />}
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="message-off-outline" size={60} color={COLORS.outline} />
                            <Text style={styles.emptyText}>
                                {searchQuery 
                                    ? "No chats match your search" 
                                    : showArchived ? "No old memories here" : "No active chats found"}
                            </Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: COLORS.surface },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        minHeight: 70,
    },
    headerTitle: { fontSize: 24, fontWeight: "800", color: COLORS.onSurface, letterSpacing: -0.5 },
    backBtn: { padding: 8, backgroundColor: COLORS.white, borderRadius: 12, elevation: 2 },
    headerIcon: { padding: 8 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    searchInputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: "rgba(0,0,0,0.05)",
        paddingHorizontal: 12,
        borderRadius: 12,
        height: 45,
    },
    searchInput: { flex: 1, fontSize: 16, color: COLORS.onSurface, paddingVertical: 0 },
    cancelBtn: { marginLeft: 12 },
    cancelText: { color: COLORS.primary, fontWeight: "600", fontSize: 16 },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: "rgba(0,0,0,0.05)",
        marginHorizontal: 20,
        padding: 4,
        borderRadius: 16,
        marginBottom: 20,
    },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 12 },
    tabActive: { backgroundColor: COLORS.white, elevation: 2, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4 },
    tabText: { fontSize: 14, fontWeight: "700", color: COLORS.outline },
    tabTextActive: { color: COLORS.primary },
    listContent: { paddingHorizontal: 20, paddingBottom: 40 },
    chatCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.cardBg,
        padding: 14,
        borderRadius: 20,
        marginBottom: 12,
        elevation: 2,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 }
    },
    unreadCard: {
        borderLeftWidth: 4,
        borderLeftColor: COLORS.primary,
        backgroundColor: "#F0F2FF"
    },
    avatar: {
        width: 54,
        height: 54,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: { fontSize: 22, fontWeight: "800", color: COLORS.primary },
    chatInfo: { flex: 1, marginLeft: 15 },
    infoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    infoBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    chatName: { fontSize: 17, fontWeight: "700", color: COLORS.onSurface, flex: 1, marginRight: 10 },
    chatTime: { fontSize: 12, color: COLORS.outline, fontWeight: "600" },
    chatDate: { fontSize: 13, color: COLORS.outline, fontWeight: "500" },
    unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { marginTop: 12, fontSize: 16, color: COLORS.outline, fontWeight: "600" }
});