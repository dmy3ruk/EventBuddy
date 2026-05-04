import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import {
    collection,
    doc,
    onSnapshot,
    orderBy,
    query,
    updateDoc,
    getDoc,
} from "firebase/firestore";
import { db } from "../../FirebaseConfig";
import { useNavigation } from "@react-navigation/native";

type Report = {
    id: string;
    type: "event" | "message" | "user";
    targetId: string;
    eventId?: string;
    messageId?: string;
    reportedUserId?: string;
    reporterId: string;
    reporters?: string[];
    reasons: string[];
    details?: string;
    status: "open" | "reviewed" | "dismissed" | "resolved";
    createdAt?: any;
};

const COLORS = {
    primary: "#505BEB",
    green: "#10B981",
    bg: "#F1F5F9",
    white: "#FFFFFF",
    text: "#1E293B",
    muted: "#64748B",
    danger: "#EF4444",
    orange: "#F59E0B",
    border: "#E2E8F0",
};

const getCategoryTheme = (category?: string) => {
    const cat = category?.toLowerCase() || "";

    if (cat.includes("work & study")) return { primary: "#334882", bg: "#EFF6FF" };
    if (cat.includes("social")) return { primary: "#EC4899", bg: "#FDF2F8" };
    if (cat.includes("entertaiment")) return { primary: "#8B5CF6", bg: "#F5F3FF" };
    if (cat.includes("health & self-care")) return { primary: "#76cdf3", bg: "#F0FDF4" };
    if (cat.includes("food & drinks")) return { primary: "#F59E0B", bg: "#FFFBEB" };
    if (cat.includes("sport")) return { primary: "#10B981", bg: "#F0FDF4" };
    if (cat.includes("other")) return { primary: "#94A3B8", bg: "#F8FAFC" };

    return { primary: "#64748B", bg: "#F8FAFC" };
};

export default function AdminReportsScreen() {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<"open" | "resolved" | "dismissed">("open");
    const [usernames, setUsernames] = useState<Record<string, string>>({});
    const [eventsMap, setEventsMap] = useState<Record<string, any>>({});

    const navigation = useNavigation<any>();

    useEffect(() => {
        const q = query(collection(db, "reports"), orderBy("createdAt", "desc"));

        const unsub = onSnapshot(
            q,
            (snap) => {
                const data = snap.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                })) as Report[];

                setReports(data);
                setLoading(false);
            },
            (e) => {
                console.error("Reports load error:", e);
                setLoading(false);
            }
        );

        return unsub;
    }, []);

    const getUsername = async (uid: string) => {
        if (!uid || usernames[uid]) return;

        try {
            const snap = await getDoc(doc(db, "usernames", uid));
            const name = snap.exists() ? snap.data().username : uid;

            setUsernames((prev) => ({ ...prev, [uid]: name }));
        } catch {
            setUsernames((prev) => ({ ...prev, [uid]: uid }));
        }
    };

    const getEvent = async (eventId: string) => {
        if (!eventId || eventsMap[eventId]) return;

        try {
            const snap = await getDoc(doc(db, "events", eventId));

            if (snap.exists()) {
                setEventsMap((prev) => ({
                    ...prev,
                    [eventId]: {
                        id: snap.id,
                        ...snap.data(),
                    },
                }));
            }
        } catch (e) {
            console.log("Event load error:", e);
        }
    };

    useEffect(() => {
        reports.forEach((r) => {
            getUsername(r.reporterId);

            if (r.reportedUserId) getUsername(r.reportedUserId);
            if (r.eventId) getEvent(r.eventId);
        });
    }, [reports]);

    const filteredReports = Object.values(
        reports
            .filter((r) => r.status === filter)
            .reduce<Record<string, Report>>((acc, report) => {
                const key = report.eventId || report.targetId || report.id;

                if (!acc[key]) {
                    acc[key] = report;
                } else {
                    const existing = acc[key];

                    acc[key] = {
                        ...existing,
                        reporters: Array.from(
                            new Set([
                                ...(existing.reporters || [existing.reporterId]),
                                ...(report.reporters || [report.reporterId]),
                            ])
                        ),
                        reasons: Array.from(
                            new Set([
                                ...((existing as any).reasons || [existing.reasons]),
                                ...((report as any).reasons || [report.reasons]),
                            ])
                        ) as any,
                    };
                }

                return acc;
            }, {})
    );
    const updateStatus = async (reportId: string, status: Report["status"]) => {
        try {
            await updateDoc(doc(db, "reports", reportId), { status });
        } catch (e) {
            Alert.alert("Error", "Failed to update report.");
        }
    };

    const handleResolve = async (item: Report) => {
        try {
            if (item.type === "event" && item.eventId) {
                await updateDoc(doc(db, "events", item.eventId), {
                    isDeleted: true,
                });
            }

            await updateDoc(doc(db, "reports", item.id), {
                status: "resolved",
            });
        } catch (e) {
            console.error("Resolve error:", e);
            Alert.alert("Error", "Failed to resolve report.");
        }
    };

    const handleReopen = async (item: Report) => {
        try {
            await updateDoc(doc(db, "reports", item.id), {
                status: "open",
            });
        } catch (e) {
            console.error("Reopen error:", e);
            Alert.alert("Error", "Failed to reopen report.");
        }
    };

    const renderEventPreview = (event: any) => {
        if (!event) {
            return (
                <View style={styles.eventPreviewEmpty}>
                    <Ionicons name="alert-circle-outline" size={20} color={COLORS.muted} />
                    <Text style={styles.eventPreviewEmptyText}>Event not found or deleted</Text>
                </View>
            );
        }

        const theme = getCategoryTheme(event.category);

        return (
            <View style={[styles.eventPreviewCard, { borderLeftColor: theme.primary }]}>
                <View style={styles.eventPreviewTop}>
                    <View style={[styles.eventCategoryBadge, { backgroundColor: theme.bg }]}>
                        <Text style={[styles.eventCategoryText, { color: theme.primary }]}>
                            {event.category ? `#${event.category.toLowerCase()}` : "#general"}
                        </Text>
                    </View>

                    <View style={[styles.eventTypeBadge, event.isPublic ? styles.publicBadge : styles.privateBadge]}>
                        <Ionicons
                            name={event.isPublic ? "globe-outline" : "lock-closed-outline"}
                            size={12}
                            color={event.isPublic ? "#059669" : "#6366F1"}
                        />
                        <Text style={[styles.eventTypeText, { color: event.isPublic ? "#059669" : "#6366F1" }]}>
                            {event.isPublic ? "Public" : "Private"}
                        </Text>
                    </View>
                </View>

                <Text style={styles.eventPreviewName} numberOfLines={1}>
                    {event.name || "Untitled event"}
                </Text>

                <View style={styles.eventPreviewInfoRow}>
                    <Ionicons name="calendar-outline" size={18} color={COLORS.muted} />
                    <Text style={styles.eventPreviewInfo}>
                        {event.date} • {event.time}
                    </Text>
                </View>

                {!!event.location?.name && (
                    <View style={styles.eventPreviewInfoRow}>
                        <Ionicons name="location-outline" size={18} color={theme.primary} />
                        <Text style={[styles.eventPreviewInfo, { color: theme.primary }]} numberOfLines={1}>
                            {event.location.name}
                        </Text>
                    </View>
                )}

                {event.isDeleted && (
                    <View style={styles.deletedBadge}>
                        <Ionicons name="eye-off-outline" size={14} color={COLORS.danger} />
                        <Text style={styles.deletedText}>Hidden by moderation</Text>
                    </View>
                )}
            </View>
        );
    };
    const handleDismiss = async (item: Report) => {
        try {
            if (item.type === "event" && item.eventId) {
                await updateDoc(doc(db, "events", item.eventId), {
                    isDeleted: false,
                });
            }

            await updateDoc(doc(db, "reports", item.id), {
                status: "dismissed",
            });

        } catch (e) {
            console.error("Dismiss error:", e);
            Alert.alert("Error", "Failed to dismiss report.");
        }
    };

    const renderReport = ({ item }: { item: Report }) => {
        const typeIcon =
            item.type === "event"
                ? "calendar-outline"
                : item.type === "message"
                    ? "chatbubble-ellipses-outline"
                    : "person-outline";

        const event = item.eventId ? eventsMap[item.eventId] : null;

        return (
            <View style={styles.card}>
                <View style={styles.cardTop}>
                    <View style={styles.typeBadge}>
                        <Ionicons name={typeIcon as any} size={14} color={COLORS.primary} />
                        <Text style={styles.typeText}>{item.type}</Text>
                    </View>

                    <View style={styles.statusBadge}>
                        <View style={styles.statusDot} />
                        <Text style={styles.statusText}>{item.status}</Text>
                    </View>
                </View>

                <Text style={styles.reason}>{item.reasons}</Text>

                {/*{Array.isArray(item.details) ? (*/}
                {/*    <View style={styles.detailsBox}>*/}
                {/*        {item.details.map((d: any, index: number) => (*/}
                {/*            <Text key={index} style={styles.details}>*/}
                {/*                • {d.reason} — {usernames[d.reporterId] || d.reporterId || "User"}*/}
                {/*            </Text>*/}
                {/*        ))}*/}
                {/*    </View>*/}
                {/*) : (*/}
                {/*    !!item.details && <Text style={styles.details}>{item.details}</Text>*/}
                {/*)}*/}
                <View style={styles.metaBox}>
                    {(item.reporters?.length ?? 1) === 1 ? (
                        <Text style={styles.metaText}>
                            Reporter: {usernames[item.reporters?.[0] || item.reporterId] || item.reporterId}
                        </Text>
                    ) : (
                        <Text style={styles.metaText}>
                            Reporters: {item.reporters?.length} users ...
                        </Text>
                    )}
                    {}
                    <Text style={styles.metaText}>
                        Reports count: {item.reporters?.length || 1}
                    </Text>
                    {Array.isArray((item as any).reasons) ? (
                        <Text style={styles.details}>
                            Reasons: {(item as any).reasons.join(", ")}
                        </Text>
                    ) : (
                        <Text style={styles.reason}>{item.reasons}</Text>
                    )}
                    {!!item.reportedUserId && (
                        <Text style={styles.metaText}>
                            Reported user: {usernames[item.reportedUserId] || item.reportedUserId}
                        </Text>
                    )}

                    {item.messageId && <Text style={styles.metaText}>Message: {item.messageId}</Text>}
                </View>

                {item.type === "event" && renderEventPreview(event)}

                <View style={styles.actions}>
                    {item.status === "open" && (
                        <>
                            <TouchableOpacity
                                style={[styles.actionBtn, styles.resolveBtn]}
                                onPress={() => handleResolve(item)}
                            >
                                <Feather name="eye-off" size={16} color="#fff" />
                                <Text style={styles.actionTextWhite}>Hide event</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionBtn, styles.dismissBtn]}
                                onPress={() => handleDismiss(item)}
                            >
                                <Feather name="x" size={16} color={COLORS.muted} />
                                <Text style={styles.actionTextMuted}>Dismiss</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {item.status !== "open" && (
                        <TouchableOpacity
                            style={[styles.actionBtn, styles.reopenBtn]}
                            onPress={() => handleReopen(item)}
                        >
                            <Feather name="rotate-ccw" size={16} color={COLORS.primary} />
                            <Text style={styles.actionTextPrimary}>Reopen</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Admin Panel</Text>
                    <Text style={styles.subtitle}>Review reports and keep EventBuddy safe.</Text>
                </View>

                <TouchableOpacity
                    style={styles.userModeBtn}
                    onPress={() => navigation.navigate("Home")}
                >
                    <Ionicons name="person-outline" size={18} color={COLORS.primary} />
                </TouchableOpacity>


            </View>

            <View style={styles.heroCard}>
                <View style={styles.heroBadge}>
                    <View style={styles.heroDot} />
                    <Text style={styles.heroBadgeText}>MODERATION</Text>
                </View>

                <Text style={styles.heroTitle}>
                    {reports.filter((r) => r.status === "open").length} open reports
                </Text>
                <Text style={styles.heroText}>Check suspicious events, messages, and users.</Text>
            </View>

            <View style={styles.filters}>
                {(["open", "resolved", "dismissed"] as const).map((status) => (
                    <TouchableOpacity
                        key={status}
                        style={[styles.filterBtn, filter === status && styles.filterActive]}
                        onPress={() => setFilter(status)}
                    >
                        <Text style={[styles.filterText, filter === status && styles.filterTextActive]}>
                            {status}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={filteredReports}
                    keyExtractor={(item) => item.id}
                    renderItem={renderReport}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="sparkles-outline" size={32} color={COLORS.muted} />
                            <Text style={styles.emptyTitle}>No reports here</Text>
                            <Text style={styles.emptyText}>Everything looks calm.</Text>
                        </View>
                    }
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.bg,
        paddingTop: 64,
    },
    header: {
        paddingHorizontal: 24,
        marginBottom: 20,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
    },
    title: {
        fontSize: 30,
        fontWeight: "900",
        color: COLORS.text,
    },
    subtitle: {
        fontSize: 15,
        color: COLORS.muted,
        marginTop: 4,
    },
    userModeBtn: {
        width: 48,
        height: 48,
        backgroundColor: COLORS.white,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
    },
    headerIcon: {
        width: 56,
        height: 56,
        borderRadius: 20,
        backgroundColor: COLORS.white,
        alignItems: "center",
        justifyContent: "center",
        ...Platform.select({
            ios: {
                shadowColor: "#505BEB",
                shadowOpacity: 0.12,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 8 },
            },
            android: { elevation: 4 },
        }),
    },
    heroCard: {
        marginHorizontal: 24,
        backgroundColor: COLORS.primary,
        borderRadius: 28,
        padding: 24,
        marginBottom: 22,
    },
    heroBadge: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255,255,255,0.22)",
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 16,
        marginBottom: 18,
    },
    heroDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#FDE047",
        marginRight: 8,
    },
    heroBadgeText: {
        color: "#fff",
        fontSize: 12,
        fontWeight: "900",
        letterSpacing: 1,
    },
    heroTitle: {
        color: "#fff",
        fontSize: 28,
        fontWeight: "900",
    },
    heroText: {
        color: "rgba(255,255,255,0.8)",
        fontSize: 15,
        marginTop: 8,
        fontWeight: "600",
    },
    filters: {
        flexDirection: "row",
        marginHorizontal: 24,
        backgroundColor: "#E2E8F0",
        padding: 5,
        borderRadius: 24,
        marginBottom: 18,
    },
    filterBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 19,
        alignItems: "center",
    },
    filterActive: {
        backgroundColor: COLORS.white,
    },
    filterText: {
        color: COLORS.muted,
        fontWeight: "800",
        textTransform: "capitalize",
    },
    filterTextActive: {
        color: COLORS.text,
    },
    list: {
        paddingHorizontal: 24,
        paddingBottom: 120,
    },
    card: {
        backgroundColor: COLORS.white,
        borderRadius: 24,
        padding: 18,
        marginBottom: 16,
    },
    cardTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    typeBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#EEF2FF",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
    },
    typeText: {
        color: COLORS.primary,
        fontWeight: "900",
        fontSize: 11,
        marginLeft: 5,
        textTransform: "uppercase",
    },
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F8FAFC",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
    },
    statusDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: COLORS.green,
        marginRight: 6,
    },
    statusText: {
        color: COLORS.muted,
        fontWeight: "800",
        fontSize: 11,
        textTransform: "uppercase",
    },
    reason: {
        fontSize: 19,
        fontWeight: "900",
        color: COLORS.text,
        marginBottom: 6,
    },
    details: {
        color: COLORS.muted,
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 12,
    },
    metaBox: {
        backgroundColor: "#F8FAFC",
        borderRadius: 16,
        padding: 12,
        marginTop: 6,
        marginBottom: 14,
    },
    metaText: {
        color: COLORS.muted,
        fontSize: 12,
        fontWeight: "600",
        marginBottom: 3,
    },
    eventPreviewCard: {
        backgroundColor: COLORS.white,
        borderRadius: 20,
        padding: 14,
        borderLeftWidth: 5,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "#F1F5F9",
    },
    eventPreviewTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },
    eventCategoryBadge: {
        alignSelf: "flex-start",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    eventCategoryText: {
        fontSize: 10,
        fontWeight: "900",
        textTransform: "uppercase",
    },
    eventTypeBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
    },
    publicBadge: {
        backgroundColor: "#ECFDF5",
        borderColor: "#A7F3D0",
    },
    privateBadge: {
        backgroundColor: "#EEF2FF",
        borderColor: "#C7D2FE",
    },
    eventTypeText: {
        fontSize: 9,
        fontWeight: "900",
        textTransform: "uppercase",
    },
    eventPreviewName: {
        fontSize: 18,
        fontWeight: "900",
        color: COLORS.text,
        marginBottom: 10,
    },
    eventPreviewInfoRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: 4,
    },
    eventPreviewInfo: {
        color: COLORS.muted,
        fontSize: 13,
        fontWeight: "700",
    },
    deletedBadge: {
        marginTop: 10,
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "#FEF2F2",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
    },
    deletedText: {
        color: COLORS.danger,
        fontWeight: "800",
        fontSize: 11,
    },
    eventPreviewEmpty: {
        backgroundColor: "#F8FAFC",
        borderRadius: 16,
        padding: 14,
        marginBottom: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    eventPreviewEmptyText: {
        color: COLORS.muted,
        fontWeight: "700",
    },
    actions: {
        flexDirection: "row",
        gap: 10,
    },
    actionBtn: {
        height: 42,
        borderRadius: 14,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
    },
    resolveBtn: {
        flex: 1,
        backgroundColor: COLORS.green,
    },
    dismissBtn: {
        flex: 1,
        backgroundColor: "#F1F5F9",
    },
    reopenBtn: {
        flex: 1,
        backgroundColor: "#EEF2FF",
    },
    actionTextWhite: {
        color: "#fff",
        fontWeight: "900",
    },
    actionTextMuted: {
        color: COLORS.muted,
        fontWeight: "900",
    },
    actionTextPrimary: {
        color: COLORS.primary,
        fontWeight: "900",
    },
    center: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    empty: {
        alignItems: "center",
        paddingTop: 70,
    },
    emptyTitle: {
        marginTop: 12,
        fontSize: 18,
        fontWeight: "900",
        color: COLORS.text,
    },
    emptyText: {
        marginTop: 4,
        color: COLORS.muted,
        fontWeight: "600",
    },
    detailsBox: {
        backgroundColor: "#F8FAFC",
        borderRadius: 14,
        padding: 10,
        marginBottom: 12,
    },
});