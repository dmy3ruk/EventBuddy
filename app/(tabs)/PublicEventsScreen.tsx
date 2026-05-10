import React, { useEffect, useMemo, useState } from "react";
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ScrollView, Platform, StatusBar, ActivityIndicator
} from "react-native";
import * as Haptics from 'expo-haptics';
import { collection, onSnapshot, query, where, orderBy, updateDoc, doc, arrayUnion, arrayRemove } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../../FirebaseConfig";
import { EVENT_CATEGORIES } from "../../utils/categories";
import { EventFull } from "../../utils/types";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import EventCard from "@/components/EventCard";
import { useRouter } from "expo-router";
import {useNavigation} from "@react-navigation/native"; // Use only this for Expo Router

const COLORS = {
    primary: "#505BEB",
    primaryContainer: "rgba(80, 91, 235, 0.1)",
    surface: "#F8FAFC",
    onSurface: "#1A1A1A",
    outline: "#64748B",
    white: "#FFFFFF",
};

export default function PublicEventsScreen() {
    const [events, setEvents] = useState<EventFull[]>([]);
    const [activeCategory, setActiveCategory] = useState("All");
    const [loading, setLoading] = useState(true);
    const uid = getAuth().currentUser?.uid;
    const router = useRouter();

    const navigation = useNavigation<any>();
    useEffect(() => {
        const q = query(
            collection(db, "events"),
            where("isPublic", "==", true),
            orderBy("date", "asc")
        );
        const unsubscribe = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as EventFull));
            setEvents(list);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const filteredEvents = useMemo(() => {
        const todayStr = new Date().toISOString().split("T")[0];

        return events.filter((e: any) => {
            if (e.isDeleted) return false;
            if (e.hiddenFor?.includes(uid)) return false;
            if (e.date < todayStr) return false;
            if (activeCategory !== "All" && e.category !== activeCategory) return false;

            return true;
        });
    }, [events, activeCategory, uid]);

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
            console.error("Join error", e);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <StatusBar barStyle="dark-content" />

            <View style={styles.header}>
                <View>
                    <Text style={styles.overtitle}>Discovery</Text>
                    <Text style={styles.title}>Find your vibe</Text>
                </View>
                <TouchableOpacity
                    style={styles.filterBtn}
                    onPress={() => navigation.navigate("Calendar")}
                    activeOpacity={0.7}
                >
                    <MaterialCommunityIcons name="calendar-month" size={24} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <View style={styles.filterSection}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsContent}
                >
                    {["All", ...EVENT_CATEGORIES].map((cat) => (
                        <TouchableOpacity
                            key={cat}
                            onPress={() => {
                                setActiveCategory(cat);
                                Haptics.selectionAsync();
                            }}
                            style={[
                                styles.chip,
                                activeCategory === cat && styles.chipActive
                            ]}
                        >
                            {cat === "All" && (
                                <MaterialCommunityIcons
                                    name="earth"
                                    size={16}
                                    color={activeCategory === cat ? COLORS.white : COLORS.primary}
                                    style={{ marginRight: 6 }}
                                />
                            )}
                            <Text style={[
                                styles.chipText,
                                activeCategory === cat && styles.chipTextActive
                            ]}>
                                {cat}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={filteredEvents}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <View style={styles.cardWrapper}>
                            <EventCard
                                item={item}
                                uid={uid || ""}
                                mode="discover"
                                onJoinToggle={handleJoinToggle}
                            />
                        </View>
                    )}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconCircle}>
                                <MaterialCommunityIcons name="map-marker-off-outline" size={48} color={COLORS.outline} />
                            </View>
                            <Text style={styles.emptyText}>No events in this category yet</Text>
                            <TouchableOpacity
                                style={styles.resetBtn}
                                onPress={() => setActiveCategory("All")}
                            >
                                <Text style={styles.resetBtnText}>Show all events</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.surface
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 10,
        marginBottom: 15
    },
    overtitle: {
        fontSize: 12,
        fontWeight: '800',
        color: COLORS.primary,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginBottom: 2
    },
    title: { fontSize: 32, fontWeight: "800", color: COLORS.onSurface, letterSpacing: -0.5 },

    filterBtn: {
        backgroundColor: COLORS.primaryContainer,
        padding: 12,
        borderRadius: 16,
    },
    filterSection: {
        marginBottom: 10
    },
    chipsContent: {
        paddingHorizontal: 20,
        paddingVertical: 5,
        gap: 8
    },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.primaryContainer,
        elevation: 2,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
    },
    chipActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary
    },
    chipText: {
        fontSize: 14,
        fontWeight: "700",
        color: COLORS.outline
    },
    chipTextActive: {
        color: COLORS.white
    },
    listContent: {
        paddingBottom: 40,
        paddingTop: 10
    },
    cardWrapper: {
        marginBottom: 8,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 60,
        paddingHorizontal: 40
    },
    emptyIconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.primaryContainer,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20
    },
    emptyText: {
        fontSize: 16,
        color: COLORS.outline,
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 20
    },
    resetBtn: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 20,
        backgroundColor: COLORS.primaryContainer
    },
    resetBtnText: {
        color: COLORS.primary,
        fontWeight: '700'
    }
});