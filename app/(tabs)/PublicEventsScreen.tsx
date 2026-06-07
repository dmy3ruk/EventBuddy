import React, { useEffect, useMemo, useState } from "react";
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ScrollView, Platform, StatusBar, ActivityIndicator, Alert
} from "react-native";
import * as Haptics from 'expo-haptics';
// import * as Location from 'expo-location';
import { collection, onSnapshot, query, where, orderBy, updateDoc, doc, arrayUnion, arrayRemove } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../../FirebaseConfig";
import { EVENT_CATEGORIES } from "../../utils/categories";
import { EventFull } from "../../utils/types";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import EventCard from "@/components/EventCard";
import { useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";

const COLORS = {
    primary: "#505BEB",
    primaryContainer: "rgba(80, 91, 235, 0.1)",
    surface: "#F8FAFC",
    onSurface: "#1A1A1A",
    outline: "#64748B",
    white: "#FFFFFF",
    success: "#10B981",
    successContainer: "rgba(16, 185, 129, 0.1)",
    warning: "#F59E0B",
};

const RADIUS_OPTIONS: { label: string; value: number | null }[] = [
    { label: "Any distance", value: null },
    { label: "5 km", value: 5 },
    { label: "10 km", value: 10 },
    { label: "20 km", value: 20 },
    { label: "40 km", value: 40 },
    { label: "100 km", value: 100 },
];

/** Haversine formula — returns distance in km between two coordinates */
function haversineKm(
    lat1: number, lon1: number,
    lat2: number, lon2: number
): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function PublicEventsScreen() {
    const [events, setEvents] = useState<EventFull[]>([]);
    const [activeCategory, setActiveCategory] = useState("All");
    const [loading, setLoading] = useState(true);

    // location state
    const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
    const [locationLoading, setLocationLoading] = useState(false);
    const [activeRadius, setActiveRadius] = useState<number | null>(null);

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

    const requestLocation = async () => {
        if (userCoords) {
            setUserCoords(null);
            setActiveRadius(null);
            return;
        }

        setLocationLoading(true);
        try {
            const Location = await import('expo-location').catch(() => null);

            if (!Location) {
                const res = await fetch("https://ipapi.co/json/");
                const data = await res.json();
                setUserCoords({ lat: data.latitude, lon: data.longitude });
                setActiveRadius(20);
                return;
            }

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") {
                Alert.alert("Location access denied", "Enable location in Settings to filter events by distance.");
                return;
            }

            const loc = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            setUserCoords({ lat: loc.coords.latitude, lon: loc.coords.longitude });
            setActiveRadius(20);
            if (Platform.OS === "ios") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
            Alert.alert("Error", "Could not get your location. Try again.");
        } finally {
            setLocationLoading(false);
        }
    };
    const filteredEvents = useMemo(() => {
        const todayStr = new Date().toISOString().split("T")[0];

        return events
            .filter((e: any) => {
                if (e.isDeleted) return false;
                if (e.hiddenFor?.includes(uid)) return false;
                if (e.date < todayStr) return false;
                if (activeCategory !== "All" && e.category !== activeCategory) return false;

                // radius filter
                if (userCoords && activeRadius !== null) {
                    const lat = e.location?.latitude;
                    const lon = e.location?.longitude;

                    // events without coordinates are hidden when radius filter is active
                    if (typeof lat !== "number" || typeof lon !== "number" || lat === 0 && lon === 0) {
                        return false;
                    }

                    const dist = haversineKm(userCoords.lat, userCoords.lon, lat, lon);
                    if (dist > activeRadius) return false;
                }

                return true;
            })
            .map((e: any) => {
                // attach computed distance for display
                if (userCoords) {
                    const lat = e.location?.latitude;
                    const lon = e.location?.longitude;
                    if (typeof lat === "number" && typeof lon === "number") {
                        return { ...e, _distanceKm: haversineKm(userCoords.lat, userCoords.lon, lat, lon) };
                    }
                }
                return e;
            })
            .sort((a: any, b: any) => {
                // if radius active — sort by distance first
                if (userCoords && activeRadius !== null) {
                    const da = a._distanceKm ?? Infinity;
                    const db_ = b._distanceKm ?? Infinity;
                    if (da !== db_) return da - db_;
                }
                return 0; // keep Firestore date order otherwise
            });
    }, [events, activeCategory, uid, userCoords, activeRadius]);

    const handleJoinToggle = async (eventId: string) => {
        if (!uid) return;
        if (Platform.OS === "ios") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const event = events.find(e => e.id === eventId);
        const joined = (event as any)?.acceptedUserIds?.includes(uid);
        const ref = doc(db, "events", eventId);

        try {
            await updateDoc(ref, {
                acceptedUserIds: joined ? arrayRemove(uid) : arrayUnion(uid),
            });
        } catch (e) {
            console.error("Join error", e);
        }
    };

    const locationActive = !!userCoords;

    return (
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
            <StatusBar barStyle="dark-content" />

            {/* ── Header ── */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.overtitle}>Discovery</Text>
                    <Text style={styles.title}>Find your vibe</Text>
                </View>

                <View style={styles.headerActions}>
                    {/* Location toggle button */}
                    <TouchableOpacity
                        style={[
                            styles.headerBtnLocation,
                            locationActive && styles.headerBtnActive,
                        ]}
                        onPress={requestLocation}
                        activeOpacity={0.7}
                    >
                        {locationLoading ? (
                            <ActivityIndicator size="small" color={locationActive ? COLORS.white : COLORS.success} />
                        ) : (
                            <Ionicons
                                name={locationActive ? "location" : "location-outline"}
                                size={22}
                                color={locationActive ? COLORS.white : COLORS.success}
                            />
                        )}
                    </TouchableOpacity>

                    {/* Calendar button */}
                    <TouchableOpacity
                        style={styles.headerBtn}
                        onPress={() => navigation.navigate("Calendar")}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons name="calendar-month" size={22} color={COLORS.primary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Radius chips (visible only when location is active) ── */}
            {locationActive && (
                <View style={styles.radiusSection}>
                    <View style={styles.radiusLabelRow}>
                        <Ionicons name="navigate-circle-outline" size={16} color={COLORS.success} />
                        <Text style={styles.radiusLabel}>Nearby events</Text>
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.chipsContent}
                    >
                        {RADIUS_OPTIONS.map((opt) => {
                            const isActive = activeRadius === opt.value;
                            return (
                                <TouchableOpacity
                                    key={String(opt.value)}
                                    onPress={() => {
                                        setActiveRadius(opt.value);
                                        Haptics.selectionAsync();
                                    }}
                                    style={[
                                        styles.chip,
                                        styles.radiusChip,
                                        isActive && styles.radiusChipActive,
                                    ]}
                                >
                                    {isActive && (
                                        <Ionicons
                                            name="radio-button-on"
                                            size={13}
                                            color={COLORS.white}
                                            style={{ marginRight: 4 }}
                                        />
                                    )}
                                    <Text style={[
                                        styles.chipText,
                                        { color: isActive ? COLORS.white : COLORS.success },
                                    ]}>
                                        {opt.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            )}

            {/* ── Category chips ── */}
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
                            style={[styles.chip, activeCategory === cat && styles.chipActive]}
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
                                activeCategory === cat && styles.chipTextActive,
                            ]}>
                                {cat}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* ── Events list ── */}
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
                            {/* distance badge */}
                            {typeof (item as any)._distanceKm === "number" && (
                                <View style={styles.distanceBadge}>
                                    <Ionicons name="navigate" size={11} color={COLORS.success} />
                                    <Text style={styles.distanceText}>
                                        {(item as any)._distanceKm < 1
                                            ? `${Math.round((item as any)._distanceKm * 1000)} m`
                                            : `${(item as any)._distanceKm.toFixed(1)} km`}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={
                        locationActive && activeRadius !== null ? (
                            <Text style={styles.resultsSummary}>
                                {filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""} within {activeRadius} km
                            </Text>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <View style={styles.emptyIconCircle}>
                                <MaterialCommunityIcons
                                    name={locationActive ? "map-marker-radius-outline" : "map-marker-off-outline"}
                                    size={48}
                                    color={COLORS.outline}
                                />
                            </View>
                            <Text style={styles.emptyText}>
                                {locationActive
                                    ? `No events within ${activeRadius ?? "?"} km`
                                    : "No events in this category yet"}
                            </Text>
                            {locationActive ? (
                                <TouchableOpacity
                                    style={styles.resetBtn}
                                    onPress={() => setActiveRadius(null)}
                                >
                                    <Text style={styles.resetBtnText}>Show all distances</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={styles.resetBtn}
                                    onPress={() => setActiveCategory("All")}
                                >
                                    <Text style={styles.resetBtnText}>Show all events</Text>
                                </TouchableOpacity>
                            )}
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
        backgroundColor: COLORS.surface,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 24,
        paddingTop: 10,
        marginBottom: 15,
    },
    overtitle: {
        fontSize: 12,
        fontWeight: "800",
        color: COLORS.primary,
        textTransform: "uppercase",
        letterSpacing: 1.5,
        marginBottom: 2,
    },
    title: {
        fontSize: 32,
        fontWeight: "800",
        color: COLORS.onSurface,
        letterSpacing: -0.5,
    },
    headerActions: {
        flexDirection: "row",
        gap: 10,
    },
    headerBtn: {
        backgroundColor: COLORS.primaryContainer,
        padding: 12,
        borderRadius: 16,
    },
    headerBtnActive: {
        backgroundColor: COLORS.success,
    },
    headerBtnLocation: {
            backgroundColor: "rgba(107,250,186,0.31)",
            padding: 12,
            borderRadius: 16,
        },

    // radius strip
    radiusSection: {
        marginBottom: 6,
    },
    radiusLabelRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 22,
        marginBottom: 6,
    },
    radiusLabel: {
        fontSize: 12,
        fontWeight: "700",
        color: COLORS.success,
        textTransform: "uppercase",
        letterSpacing: 1,
    },
    radiusChip: {
        borderColor: "rgba(16,185,129,0.25)",
        backgroundColor: "rgba(16,185,129,0.06)",
    },
    radiusChipActive: {
        backgroundColor: COLORS.success,
        borderColor: COLORS.success,
    },

    // categories strip
    filterSection: {
        marginBottom: 10,
    },
    chipsContent: {
        paddingHorizontal: 20,
        paddingVertical: 5,
        gap: 8,
    },
    chip: {
        flexDirection: "row",
        alignItems: "center",
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
        borderColor: COLORS.primary,
    },
    chipText: {
        fontSize: 14,
        fontWeight: "700",
        color: COLORS.outline,
    },
    chipTextActive: {
        color: COLORS.white,
    },

    // list
    listContent: {
        paddingBottom: 40,
        paddingTop: 10,
    },
    cardWrapper: {
        marginBottom: 8,
    },
    distanceBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        position: "absolute",
        bottom: 18,
        right: 28,
        backgroundColor: "rgba(16,185,129,0.12)",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 20,
    },
    distanceText: {
        fontSize: 11,
        fontWeight: "800",
        color: COLORS.success,
    },
    resultsSummary: {
        fontSize: 13,
        fontWeight: "700",
        color: COLORS.outline,
        paddingHorizontal: 24,
        marginBottom: 8,
    },

    center: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    emptyContainer: {
        alignItems: "center",
        marginTop: 60,
        paddingHorizontal: 40,
    },
    emptyIconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.primaryContainer,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 20,
    },
    emptyText: {
        fontSize: 16,
        color: COLORS.outline,
        fontWeight: "600",
        textAlign: "center",
        lineHeight: 24,
        marginBottom: 20,
    },
    resetBtn: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 20,
        backgroundColor: COLORS.primaryContainer,
    },
    resetBtnText: {
        color: COLORS.primary,
        fontWeight: "700",
    },
});