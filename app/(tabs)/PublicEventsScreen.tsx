import React, { useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ScrollView,
} from "react-native";
import {
    collection,
    onSnapshot,
    query,
    where,
    orderBy,
    updateDoc,
    doc,
    arrayUnion,
    arrayRemove,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../../FirebaseConfig";
import {data} from "browserslist";

/* ================= TYPES ================= */
type EventData = {
    name: string;
    date: string;
    time: string;
    details?: string;
    category?: string;
    isPublic: boolean;
    userId: string;
    acceptedUserIds?: string[];
    maxAttendees?: number;
};

type EventItem = EventData & {
    id: string;
};


/* ================= CATEGORIES ================= */
const CATEGORIES = ["All", "networking", "outdoor", "creative", "social", "wellness"];

/* ================= SCREEN ================= */
export default function PublicEventsScreen() {
    const [events, setEvents] = useState<EventItem[]>([]);
    const [activeCategory, setActiveCategory] = useState("All");
    const today = new Date();
    const uid = getAuth().currentUser?.uid;

    useEffect(() => {
        const q = query(
            collection(db, "events"),
            where("isPublic", "==", true),
            orderBy("date", "asc")
        );

        const unsub = onSnapshot(q, (snap) => {
            const list: EventItem[] = snap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as EventData),
            }));

            setEvents(list);
        });

        return unsub;
    }, []);

    const filteredEvents = useMemo(() => {
        let list = events;

        // ❌ не показуємо свої івенти
        if (uid) {
            list = list.filter((e) => e.userId !== uid);
        }
        list = list.filter((e) => {
            const eventDate = new Date(`${e.date}T${e.time}`);
            return eventDate >= today;
        });
        // 🎯 фільтр по категорії
        if (activeCategory !== "All") {
            list = list.filter((e) => e.category === activeCategory);
        }

        return list;
    }, [events, activeCategory, uid]);

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Discover Events</Text>
            <Text style={styles.subtitle}>
                Find and join amazing events happening around you
            </Text>

            {/* CATEGORY FILTER */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.chipsContainer}
                contentContainerStyle={styles.chipsContent}
            >
                {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                        key={cat}
                        style={[
                            styles.chip,
                            activeCategory === cat && styles.chipActive,
                        ]}
                        onPress={() => setActiveCategory(cat)}
                        activeOpacity={0.8}
                    >
                        <Text
                            style={[
                                styles.chipText,
                                activeCategory === cat && styles.chipTextActive,
                            ]}
                        >
                            {cat}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <FlatList
                data={filteredEvents}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <EventCard event={item} uid={uid} />
                )}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <Text style={styles.empty}>
                        No public events right now ✨
                    </Text>
                }
            />
        </View>
    );
}

/* ================= EVENT CARD ================= */
function EventCard({
                       event,
                       uid,
                   }: {
    event: EventItem;
    uid?: string;
}) {
    const joined = event.acceptedUserIds?.includes(uid || "");
    const going = event.acceptedUserIds?.length || 0;
    const limit = event.maxAttendees;

    const toggleJoin = async () => {
        if (!uid) return;

        const ref = doc(db, "events", event.id);

        if (joined) {
            await updateDoc(ref, {
                acceptedUserIds: arrayRemove(uid),
            });
        } else {
            if (limit && going >= limit) return;
            await updateDoc(ref, {
                acceptedUserIds: arrayUnion(uid),
            });
        }
    };

    return (
        <View style={styles.card}>
            <View style={[styles.cardHeader, categoryColor(event.category)]}>
                <Text style={styles.cardHeaderText}>{event.name}</Text>

                {event.category && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{event.category}</Text>
                    </View>
                )}
            </View>

            <View style={styles.cardBody}>
                {!!event.details && (
                    <Text style={styles.cardDesc}>{event.details}</Text>
                )}

                <Text style={styles.meta}>
                    📅 {event.date} at {event.time}
                </Text>

                <Text style={styles.meta}>
                    👥 {going}
                    {limit ? ` / ${limit}` : ""} going
                </Text>

                <TouchableOpacity
                    style={[
                        styles.actionBtn,
                        joined ? styles.leaveBtn : styles.joinBtn,
                    ]}
                    onPress={toggleJoin}
                >
                    <Text
                        style={[
                            styles.actionText,
                            joined && { color: "#4B5563" },
                        ]}
                    >
                        {joined ? "Leave Event" : "Join Event"}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

/* ================= HELPERS ================= */
function categoryColor(category?: string) {
    switch (category) {
        case "networking":
            return { backgroundColor: "#4F8F6F" };
        case "outdoor":
            return { backgroundColor: "#4F63E6" };
        case "creative":
            return { backgroundColor: "#F08A5D" };
        case "social":
            return { backgroundColor: "#E0C12C" };
        case "wellness":
            return { backgroundColor: "#5A67D8" };
        default:
            return { backgroundColor: "#6B7280" };
    }
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F9FAFB",
        padding: 16,
    },
    title: {
        marginTop:45,
        fontSize: 24,
        fontWeight: "700",
        color: "#111827",
    },
    subtitle: {
        color: "#6B7280",
        marginTop: 4,
    },

    chipsContainer: {
        marginTop: 12,
        marginBottom: 8,
        maxHeight: 44,
    },
    chipsContent: {
        alignItems: "center",
    },
    chip: {
        height: 36,
        paddingHorizontal: 16,
        borderRadius: 999,
        backgroundColor: "#E5E7EB",
        marginRight: 8,
        justifyContent: "center",
        alignItems: "center",
    },
    chipActive: {
        backgroundColor: "#4F46E5",
    },
    chipText: {
        color: "#374151",
        fontSize: 13,
    },
    chipTextActive: {
        color: "#fff",
        fontWeight: "600",
    },

    empty: {
        textAlign: "center",
        marginTop: 40,
        color: "#6B7280",
    },

    card: {
        backgroundColor: "#fff",
        borderRadius: 16,
        marginBottom: 16,
        overflow: "hidden",
        elevation: 2,
    },
    cardHeader: {
        padding: 16,
    },
    cardHeaderText: {
        fontSize: 28,
        fontWeight: "700",
        color: "#fff",
    },
    badge: {
        marginTop: 8,
        backgroundColor: "rgba(0,0,0,0.6)",
        alignSelf: "flex-start",
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    badgeText: {
        color: "#fff",
        fontSize: 11,
    },
    cardBody: {
        padding: 16,
    },
    cardDesc: {
        color: "#6B7280",
        fontSize: 13,
        marginBottom: 8,
    },
    meta: {
        fontSize: 12,
        color: "#6B7280",
        marginBottom: 4,
    },
    actionBtn: {
        marginTop: 10,
        paddingVertical: 10,
        borderRadius: 999,
        alignItems: "center",
    },
    joinBtn: {
        backgroundColor: "#4F8F6F",
    },
    leaveBtn: {
        backgroundColor: "#E5E7EB",
    },
    actionText: {
        color: "#fff",
        fontWeight: "600",
    },
});
