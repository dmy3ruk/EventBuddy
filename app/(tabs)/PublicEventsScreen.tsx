import React, { useEffect, useMemo, useState } from "react";
import { 
    View, Text, StyleSheet, FlatList, TouchableOpacity, 
    ScrollView, Platform, SafeAreaView, StatusBar 
} from "react-native";
import * as Haptics from 'expo-haptics';
import { collection, onSnapshot, query, where, orderBy, updateDoc, doc, arrayUnion, arrayRemove } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../../FirebaseConfig";
import { EVENT_CATEGORIES } from "../../utils/categories";
import { EventFull } from "../../utils/types";
import EventCard from "@/components/events/EventCard"; // Імпортуємо наш новий компонент

const CategoryChip = ({ label, isActive, onPress }: { label: string, isActive: boolean, onPress: () => void }) => (
    <TouchableOpacity
        activeOpacity={0.8}
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

    const handleJoinToggle = async (eventId: string) => {
        if (!uid) return;
        if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        
        const event = events.find(e => e.id === eventId);
        const joined = event?.acceptedUserIds?.includes(uid);
        const ref = doc(db, "events", eventId);

        try {
            await updateDoc(ref, {
                acceptedUserIds: joined ? arrayRemove(uid) : arrayUnion(uid),
            });
        } catch (e) {
            console.error("Error updating join status", e);
        }
    };

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
                    renderItem={({ item }) => (
                        <EventCard 
                            item={item} 
                            uid={uid || ""} 
                            mode="discover"
                            onJoinToggle={handleJoinToggle}
                        />
                    )}
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

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#FFFFFF" },
    container: { flex: 1, backgroundColor: "#FDFDFD" },
    header: { paddingHorizontal: 24, paddingTop: 16, marginBottom: 8 },
    title: { fontSize: 34, fontWeight: "900", color: "#1A1A1A", letterSpacing: -1 },
    subtitle: { fontSize: 16, color: "#8E8E93", marginTop: 2 },
    
    filterSection: { marginBottom: 16 },
    chipsContent: { paddingHorizontal: 20, paddingVertical: 10 },
    chip: { 
        paddingHorizontal: 16, 
        height: 38, 
        borderRadius: 12, 
        backgroundColor: "#F2F2F7", 
        marginRight: 8, 
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#E5E5EA"
    },
    chipActive: { backgroundColor: "#1A1A1A", borderColor: "#1A1A1A" },
    chipText: { fontSize: 14, fontWeight: "600", color: "#3A3A3C" },
    chipTextActive: { color: "#FFF" },

    listContent: { paddingHorizontal: 4, paddingBottom: 40 }, 
    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyEmoji: { fontSize: 50, marginBottom: 10 },
    emptyText: { fontSize: 16, color: '#8E8E93', fontWeight: '500' },
});