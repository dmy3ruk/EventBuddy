import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../FirebaseConfig";
import { EventType } from "../../utils/types";

type Props = {
    item: EventType;
    uid: string;
    onOpenChat: (event: EventType) => void;
    onAccept: (eventId: string) => void;
    onDecline: (eventId: string) => void;
};

function getEventStatus(event: EventType, uid: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const d = new Date(event.date);
    d.setHours(0, 0, 0, 0);

    const isInvited =
        event.invitedUserIds?.includes(uid) && !event.acceptedUserIds?.includes(uid);

    if (isInvited) return "Invitation";
    if (d < today) return "Past";
    return "Upcoming";
}

function ParticipantsRow({
                             item,
                             usersMap,
                         }: {
    item: EventType;
    usersMap: Record<string, string>;
}) {
    // організатор + прийняті
    const participants = [item.userId, ...(item.acceptedUserIds || [])];

    const uniqueParticipants = Array.from(new Set(participants));

    // показуємо максимум 3 кружечки
    const visible = uniqueParticipants.slice(0, 3);
    const remainingCount = uniqueParticipants.length - visible.length;

    const colors = ["#FCA5A5", "#86EFAC", "#FDBA74"];

    const getInitial = (uid: string) => {
        const username = usersMap[uid];
        return username?.[0]?.toUpperCase() || uid?.[0]?.toUpperCase() || "U";
    };

    return (
        <View style={styles.participantRow}>
            <View style={styles.avatars}>
                {visible.map((pUid, index) => (
                    <View
                        key={pUid}
                        style={[
                            styles.avatar,
                            { backgroundColor: colors[index % colors.length] },
                        ]}
                    >
                        <Text style={styles.avatarText}>{getInitial(pUid)}</Text>
                    </View>
                ))}

                {remainingCount > 0 && (
                    <View style={[styles.avatar, { backgroundColor: "#CBD5E1" }]}>
                        <Text style={styles.avatarText}>+{remainingCount}</Text>
                    </View>
                )}
            </View>

            <Text style={styles.participantsText}>
                {uniqueParticipants.length} participants
            </Text>
        </View>
    );
}

export default function EventCard({
                                      item,
                                      uid,
                                      onOpenChat,
                                      onAccept,
                                      onDecline,
                                  }: Props) {
    const isOwner = item.userId === uid;
    const isAccepted = item.acceptedUserIds?.includes(uid);
    const isInvited =
        item.invitedUserIds?.includes(uid) && !item.acceptedUserIds?.includes(uid);

    const status = getEventStatus(item, uid);

    // username map для аватарок
    const [usersMap, setUsersMap] = useState<Record<string, string>>({});

    useEffect(() => {
        const participants = Array.from(
            new Set([item.userId, ...(item.acceptedUserIds || [])])
        );

        const loadUsers = async () => {
            const map: Record<string, string> = {};

            await Promise.all(
                participants.map(async (pUid) => {
                    const ref = doc(db, "usernames", pUid);
                    const snap = await getDoc(ref);
                    if (snap.exists()) {
                        map[pUid] = snap.data().username;
                    }
                })
            );

            setUsersMap(map);
        };

        loadUsers();
    }, [item.userId, item.acceptedUserIds]);

    return (
        <View style={styles.card}>
            {/* Header */}
            <View style={styles.eventHeader}>
                <Text style={styles.eventName}>{item.name}</Text>

                <View
                    style={[
                        styles.statusBadge,
                        status === "Invitation" && styles.statusInvitation,
                        status === "Past" && styles.statusPast,
                        status === "Upcoming" && styles.statusUpcoming,
                    ]}
                >
                    <Text
                        style={[
                            styles.statusText,
                            status === "Invitation" && styles.statusTextInvitation,
                            status === "Past" && styles.statusTextPast,
                            status === "Upcoming" && styles.statusTextUpcoming,
                        ]}
                    >
                        {status}
                    </Text>
                </View>
            </View>

            {/* Date */}
            <View style={styles.row}>
                <Ionicons name="calendar-outline" size={18} color="#555" />
                <Text style={styles.eventDate}>
                    {item.date} at {item.time}
                </Text>
            </View>

            {/* Location / details */}
            <View style={[styles.row, { marginTop: 6 }]}>
                <Ionicons name="location-outline" size={18} color="#555" />
                <Text style={styles.eventLocation}>
                    {item.details || "TBD"}
                </Text>
            </View>

            {/* Invitation buttons */}
            {isInvited && (
                <View style={styles.inviteActions}>
                    <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={() => onAccept(item.id)}
                    >
                        <Text style={styles.acceptText}>Accept</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.declineBtn}
                        onPress={() => onDecline(item.id)}
                    >
                        <Text style={styles.declineText}>Decline</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Open chat */}
            {(isOwner || isAccepted) && (
                <TouchableOpacity
                    style={styles.chatButton}
                    onPress={() => onOpenChat(item)}
                >
                    <Text style={styles.chatButtonText}>Open chat</Text>
                </TouchableOpacity>
            )}

            {/* Participants */}
            <ParticipantsRow item={item} usersMap={usersMap} />
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: "#fff",
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        marginHorizontal: 16,
        borderWidth: 0.5,
        borderColor: "#E2E8F0",
    },

    eventHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    eventName: {
        fontSize: 18,
        fontWeight: "700",
        color: "#111",
        flexShrink: 1,
        paddingRight: 8,
    },

    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
    },
    statusText: {
        fontSize: 12,
        fontWeight: "600",
    },
    statusInvitation: { backgroundColor: "#FEF3C7" },
    statusPast: { backgroundColor: "#F3F4F6" },
    statusUpcoming: { backgroundColor: "#DCFCE7" },

    statusTextInvitation: { color: "#B45309" },
    statusTextPast: { color: "#6B7280" },
    statusTextUpcoming: { color: "#166534" },

    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    eventDate: { fontSize: 14, color: "#6E7D93" },
    eventLocation: { fontSize: 14, color: "#555" },

    inviteActions: {
        flexDirection: "row",
        marginTop: 14,
        gap: 10,
    },
    acceptBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: "#4E8D63",
        alignItems: "center",
    },
    acceptText: { color: "#fff", fontWeight: "600", fontSize: 14 },

    declineBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#E11D48",
        alignItems: "center",
    },
    declineText: { color: "#E11D48", fontWeight: "600", fontSize: 14 },

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

    participantRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 14,
        gap: 8,
    },
    avatars: {
        flexDirection: "row",
        alignItems: "center",
    },
    avatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
        marginRight: -6,
        borderWidth: 1,
        borderColor: "#fff",
    },
    avatarText: {
        fontSize: 12,
        fontWeight: "700",
        color: "#111",
    },
    participantsText: {
        color: "#555",
        fontSize: 14,
    },
});
