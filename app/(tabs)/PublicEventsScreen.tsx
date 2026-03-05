import React, { useEffect, useMemo, useState } from "react";
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    ScrollView, Alert, Linking, Platform, SafeAreaView, StatusBar 
} from "react-native";
import * as Haptics from 'expo-haptics';
import { collection, onSnapshot, query, where, orderBy, updateDoc, doc, arrayUnion, arrayRemove } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../../FirebaseConfig";
import { EVENT_CATEGORIES } from "../../utils/categories";
import { EventFull } from "../../utils/types";

// --- Chip Component (Material 3 Style) ---
const CategoryChip = ({ label, isActive, onPress }: { label: string, isActive: boolean, onPress: () => void }) => (
    <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
            if (Platform.OS === 'ios') Haptics.selectionAsync();
            onPress();
        }}
        style={[styles.chip, isActive && styles.chipActive]}
    >
        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
            {label === "All" ? "🌐 " : ""}{label}
        </Text>
    </TouchableOpacity>
);

export default function PublicEventsScreen() {
    const [events, setEvents] = useState<EventFull[]>([]);
    const [activeCategory, setActiveCategory] = useState("All");
    const uid = getAuth().currentUser?.uid;

    useEffect(() => {
        const q = query(
            collection(db, "events"),
            where("isPublic", "==", true),
            orderBy("date", "asc")
        );
        return onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as EventFull));
            setEvents(list);
        });
    }, []);

    const filteredEvents = useMemo(() => {
        const todayStr = new Date().toLocaleDateString('sv-SE'); 
        return events.filter(e => {
            if (e.date < todayStr) return false;
            if (activeCategory !== "All" && e.category !== activeCategory) return false;
            return true;
        });
    }, [events, activeCategory]);

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" />
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Discover</Text>
                    <Text style={styles.subtitle}>Events near you</Text>
                </View>
                
                <View style={styles.filterSection}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContent}>
                        {["All", ...EVENT_CATEGORIES].map((cat) => (
                            <CategoryChip 
                                key={cat} 
                                label={cat} 
                                isActive={activeCategory === cat} 
                                onPress={() => setActiveCategory(cat)} 
                            />
                        ))}
                    </ScrollView>
                </View>

                <FlatList
                    data={filteredEvents}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <EventCard event={item} uid={uid} />}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyEmoji}>🕵️‍♂️</Text>
                            <Text style={styles.emptyText}>No upcoming events found</Text>
                        </View>
                    }
                />
            </View>
        </SafeAreaView>
    );
}

function EventCard({ event, uid }: { event: EventFull; uid?: string }) {
    const isOwner = event.userId === uid;
    const joined = event.acceptedUserIds?.includes(uid || "");
    const goingCount = event.acceptedUserIds?.length || 0;

    const toggleJoin = async () => {
        if (!uid) return;
        if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        const ref = doc(db, "events", event.id);
        try {
            await updateDoc(ref, {
                acceptedUserIds: joined ? arrayRemove(uid) : arrayUnion(uid),
            });
        } catch (e) {
            Alert.alert("Error", "Could not update status");
        }
    };

    const headerBg = categoryColor(event.category);

    return (
        <View style={styles.shadowWrapper}>
            <View style={styles.card}>
                <View style={[styles.cardHeader, { backgroundColor: headerBg }]}>
                    <View style={styles.headerTopRow}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{event.name}</Text>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{event.category}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.cardBody}>
                    {!!event.details && <Text style={styles.cardDesc} numberOfLines={3}>{event.details}</Text>}
                    
                    <View style={styles.metaContainer}>
                        <Text style={styles.metaText}>📅 {event.date} • {event.time}</Text>
                        <Text style={styles.metaText}>👥 {goingCount} attending</Text>
                    </View>
                    
                    {event.location && typeof event.location === 'object' && (
                        <TouchableOpacity 
                            style={styles.locationContainer} 
                            onPress={() => openMap(event.location!.latitude, event.location!.longitude, event.name)}
                        >
                            <Text style={styles.locationLink}>📍 View on Map</Text>
                        </TouchableOpacity>
                    )}

                    {isOwner ? (
                        <View style={styles.ownerBox}>
                            <Text style={styles.ownerText}>You are the organizer</Text>
                        </View>
                    ) : (
                        <TouchableOpacity 
                            activeOpacity={0.8}
                            style={[styles.btn, joined ? styles.btnJoined : { backgroundColor: headerBg }]} 
                            onPress={toggleJoin}
                        >
                            <Text style={[styles.btnText, joined && { color: "#4B5563" }]}>
                                {joined ? "Leave Event" : "Join Event"}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );
}

// --- Helpers ---

function categoryColor(category?: string) {
    const cat = category?.toLowerCase() || "";
    if (cat.includes("sport"))  return "#059669"; 
    if (cat.includes("music"))  return "#7C3AED"; 
    if (cat.includes("food") || cat.includes("drink")) return "#D97706"; 
    if (cat.includes("study") || cat.includes("work")) return "#4F46E5"; 
    if (cat.includes("movie"))  return "#E11D48"; 
    if (cat.includes("party"))  return "#C026D3"; 
    if (cat.includes("games"))  return "#0891B2"; 
    if (cat.includes("coffee")) return "#78350F"; 
    return "#64748B"; 
}

const openMap = (lat: number, lng: number, label: string) => {
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const url = Platform.select({
        ios: `${scheme}${label}@${lat},${lng}`,
        android: `${scheme}${lat},${lng}(${label})`
    });
    if (url) Linking.openURL(url);
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#FFFFFF" },
    container: { flex: 1, backgroundColor: "#F9FAFB" },
    header: { paddingHorizontal: 20, paddingTop: 10, marginBottom: 10 },
    title: { fontSize: 34, fontWeight: "800", color: "#111827", letterSpacing: -0.8 },
    subtitle: { fontSize: 16, color: "#6B7280", marginTop: -4 },
    
    filterSection: { height: 80, marginVertical: 10 },
    chipsContent: { paddingHorizontal: 20, alignItems: 'center' },
    chip: { paddingHorizontal: 16, height: 36, borderRadius: 18, backgroundColor: "#E5E7EB", marginTop: 20, marginRight: 8, marginBottom:60, justifyContent: "center" },
    chipActive: { backgroundColor: "#111827" },
    chipText: { fontSize: 13, fontWeight: "600", color: "#4B5563" },
    chipTextActive: { color: "#FFF" },

    listContent: { paddingHorizontal: 16, paddingBottom: 30 },
    
    // Новий контейнер для тіні
    shadowWrapper: {
        marginBottom: 20,
        backgroundColor: 'transparent',
        ...Platform.select({
            ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.15,
                shadowRadius: 10,
            },
            android: {
                elevation: 6,
            }
        })
    },
    card: { 
        backgroundColor: "#FFF", 
        borderRadius: 24, 
        overflow: "hidden", // Тепер безпечно обрізає лише нутрощі
    },
    cardHeader: { padding: 20, paddingBottom: 28 },
    headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardTitle: { fontSize: 22, fontWeight: "800", color: "#FFF", flex: 1, marginRight: 10 },
    badge: { backgroundColor: "rgba(0,0,0,0.15)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    badgeText: { color: "#FFF", fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },

    cardBody: { 
        padding: 20, 
        marginTop: -15, 
        backgroundColor: "#FFF", 
        borderTopLeftRadius: 24, 
        borderTopRightRadius: 24 
    },
    cardDesc: { color: "#374151", fontSize: 15, marginBottom: 16, lineHeight: 22 },
    metaContainer: { marginBottom: 16, gap: 6 },
    metaText: { fontSize: 13, color: "#6B7280", fontWeight: '600' },
    
    locationContainer: { marginBottom: 18, alignSelf: 'flex-start' },
    locationLink: { color: "#4F46E5", fontWeight: "700", fontSize: 14 },

    btn: { height: 52, borderRadius: 16, justifyContent: "center", alignItems: "center" },
    btnJoined: { backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
    btnText: { color: "#FFF", fontWeight: "700", fontSize: 16 },

    ownerBox: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', alignItems: 'center' },
    ownerText: { fontSize: 12, color: "#9CA3AF", fontStyle: 'italic' },

    emptyContainer: { alignItems: 'center', marginTop: 80 },
    emptyEmoji: { fontSize: 48, marginBottom: 10 },
    emptyText: { fontSize: 16, color: '#9CA3AF', fontWeight: '500' },
});