import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  Linking, Alert, Animated
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../FirebaseConfig";
import { EventFull } from "../../utils/types";
// Імпортуємо Swipeable
import { Swipeable } from "react-native-gesture-handler";

type Props = {
  item: EventFull;
  uid: string;
  onOpenChat?: (event: EventFull) => void;
  onAccept?: (eventId: string) => void;
  onDecline?: (eventId: string) => void;
  onJoinToggle?: (eventId: string) => void;
  onDelete?: (eventId: string) => void;
  mode?: 'my-events' | 'discover';
};

// --- Допоміжні функції (Тепер вони тут, помилки не буде) ---
const openMap = (lat: number, lng: number, label: string) => {
  const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
  const url = Platform.select({
    ios: `${scheme}${label}@${lat},${lng}`,
    android: `${scheme}${lat},${lng}(${label})`
  });
  if (url) Linking.openURL(url);
};

const getCategoryTheme = (category?: string) => {
  const cat = category?.toLowerCase() || "";
  if (cat.includes("work & study"))
    return { primary: "#334882", bg: "#EFF6FF" };
  if (cat.includes("social"))
    return { primary: "#EC4899", bg: "#FDF2F8" };
  if (cat.includes("entertaiment"))
    return { primary: "#8B5CF6", bg: "#F5F3FF" };
  if (cat.includes("health & self-care"))
    return { primary: "#76cdf3", bg: "#F0FDF4" };
  if (cat.includes("food & drinks"))
    return { primary: "#F59E0B", bg: "#FFFBEB" };
  if (cat.includes("sport"))
    return { primary: "#10B981", bg: "#F0FDF4" };
  if (cat.includes("other"))
    return { primary: "#94A3B8", bg: "#F8FAFC" };

  return { primary: "#64748B", bg: "#F8FAFC" };
};

// --- Компонент учасників ---
function ParticipantsRow({ item, usersMap }: { item: EventFull; usersMap: Record<string, string> }) {
  const participants = [item.userId, ...(item.acceptedUserIds || [])];
  const uniqueParticipants = Array.from(new Set(participants));
  const visible = uniqueParticipants.slice(0, 4);
  const remainingCount = uniqueParticipants.length - visible.length;
  const colors = ["#FFD6D6", "#D6FFDA", "#D6E4FF", "#FFF4D6"];

  return (
      <View style={styles.participantRow}>
        <View style={styles.avatarsGroup}>
          {visible.map((pUid, index) => (
              <View
                  key={pUid}
                  style={[styles.avatar, { backgroundColor: colors[index % colors.length], zIndex: 10 - index }]}
              >
                <Text style={styles.avatarText}>{usersMap[pUid]?.[0]?.toUpperCase() || "U"}</Text>
              </View>
          ))}
          {remainingCount > 0 && (
              <View style={[styles.avatar, styles.remainingAvatar]}>
                <Text style={styles.remainingText}>+{remainingCount}</Text>
              </View>
          )}
        </View>
        <Text style={styles.participantsCount}>
          {uniqueParticipants.length} {uniqueParticipants.length === 1 ? 'going' : 'going'}
        </Text>
      </View>
  );
}

export default function EventCard({ item, uid, onOpenChat, onAccept, onDecline, onJoinToggle, onDelete, mode = 'my-events' }: Props) {
  const isOwner = item.userId === uid;
  const isAccepted = item.acceptedUserIds?.includes(uid);
  const isInvited = item.invitedUserIds?.includes(uid) && !isAccepted;
  const theme = getCategoryTheme(item.category);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const participants = Array.from(new Set([item.userId, ...(item.acceptedUserIds || [])]));
    const loadUsers = async () => {
      const map: Record<string, string> = {};
      await Promise.all(
          participants.map(async (pUid) => {
            const snap = await getDoc(doc(db, "usernames", pUid));
            if (snap.exists()) map[pUid] = snap.data().username;
          })
      );
      setUsersMap(map);
    };
    loadUsers();
  }, [item.acceptedUserIds, item.userId]);

  const handleDelete = () => {
    Alert.alert("Delete Event", `Are you sure you want to delete "${item.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "events", item.id));
            onDelete?.(item.id);
          } catch (e) { Alert.alert("Error", "Failed to delete event"); }
        },
      },
    ]);
  };

  // Рендер правої дії (видалення)
  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
        <TouchableOpacity onPress={handleDelete} style={styles.deleteSwipeContainer}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <Ionicons name="trash-outline" size={28} color="#FFF" />
            <Text style={styles.deleteSwipeText}>Delete</Text>
          </Animated.View>
        </TouchableOpacity>
    );
  };

  const hasLocation = !!(item.location?.latitude && item.location?.longitude);

  const CardContent = (
      <View style={[styles.card, { borderLeftColor: theme.primary }]}>
        <View style={styles.eventHeader}>
          <View style={{ flex: 1 }}>
            <View style={[styles.badge, { backgroundColor: theme.bg }]}>
              <Text style={[styles.badgeText, { color: theme.primary }]}>
                {item.category ? `#${item.category.toLowerCase()}` : "#general"}
              </Text>
            </View>
            <Text style={styles.eventName} numberOfLines={1}>{item.name}</Text>
          </View>

          <View style={[styles.typeBadge, item.isPublic ? styles.publicBadge : styles.privateBadge]}>
            <Ionicons
                name={item.isPublic ? "globe-outline" : "lock-closed-outline"}
                size={12}
                color={item.isPublic ? "#059669" : "#6366F1"}
            />
            <Text style={[styles.typeText, { color: item.isPublic ? "#059669" : "#6366F1" }]}>
              {item.isPublic ? "Public" : "Private"}
            </Text>
          </View>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={24} color="#6E7D93" />
            <Text style={styles.infoText}>{item.date} • {item.time}</Text>
          </View>

          {hasLocation && (
              <TouchableOpacity
                  onPress={() => openMap(item.location!.latitude, item.location!.longitude, item.name)}
                  style={styles.infoRow}
              >
                <Ionicons name="location-outline" size={24} color={theme.primary} />
                <Text style={[styles.infoText, { color: theme.primary, fontWeight: '700' }]} numberOfLines={1}>
                  {item.location?.name || "Somewhere"}
                </Text>
              </TouchableOpacity>
          )}
        </View>

        {mode === 'my-events' && isInvited && (
            <View style={styles.inviteActions}>
              <TouchableOpacity style={styles.declineBtn} onPress={() => onDecline?.(item.id)}>
                <Text style={styles.declineText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: theme.primary }]} onPress={() => onAccept?.(item.id)}>
                <Text style={styles.acceptText}>Accept</Text>
              </TouchableOpacity>
            </View>
        )}

        {mode === 'discover' && !isOwner && (
            <TouchableOpacity
                style={[styles.mainBtn, isAccepted ? styles.btnJoined : { backgroundColor: theme.primary }]}
                onPress={() => onJoinToggle?.(item.id)}
            >
              <Text style={[styles.mainBtnText, isAccepted && { color: "#64748B" }]}>
                {isAccepted ? "Going ✓" : "Join Event"}
              </Text>
            </TouchableOpacity>
        )}

        <View style={styles.divider} />

        <View style={styles.bottomRow}>
          <ParticipantsRow item={item} usersMap={usersMap} />
          <View style={styles.actionGroup}>
            {(isOwner || isAccepted) && onOpenChat && (
                <TouchableOpacity style={styles.iconBtn} onPress={() => onOpenChat(item)}>
                  <Ionicons name="chatbubble-ellipses-outline" size={22} color="#94A3B8" />
                </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
  );

  if (isOwner) {
    return (
        <Swipeable
            renderRightActions={renderRightActions}
            friction={2}
            rightThreshold={40}
            containerStyle={styles.swipeableContainer}
        >
          {CardContent}
        </Swipeable>
    );
  }

  return CardContent;
}

const styles = StyleSheet.create({
  swipeableContainer: {
    marginBottom: 16, // Переносимо margin сюди, щоб свайп був чітко по картці
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    borderLeftWidth: 5,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 10 },
      android: { elevation: 3 },
    }),
  },
  deleteSwipeContainer: {
    width: 80,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    marginRight: 16,
    // Висота має бути такою ж як у картки без margin
  },
  deleteSwipeText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 10,
    marginTop: 4,
  },
  eventHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  eventName: { fontSize: 19, fontWeight: "800", color: "#1E293B", marginTop: 8 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  typeBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  publicBadge: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  privateBadge: { backgroundColor: "#EEF2FF", borderColor: "#C7D2FE" },
  typeText: { fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
  infoSection: { gap: 6, marginBottom: 16 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoText: { fontSize: 14, color: "#6E7D93", fontWeight: "600" },
  divider: { height: 1, backgroundColor: "#F1F5F9", marginBottom: 12 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  participantRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatarsGroup: { flexDirection: "row" },
  avatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: "#fff", justifyContent: "center", alignItems: "center", marginRight: -10 },
  avatarText: { fontSize: 10, fontWeight: "800", color: "#1E293B" },
  remainingAvatar: { backgroundColor: "#F1F5F9", zIndex: 0, borderWidth: 1, borderColor: "#E2E8F0" },
  remainingText: { fontSize: 9, fontWeight: "700", color: "#94A3B8" },
  participantsCount: { fontSize: 12, color: "#64748B", marginLeft: 12, fontWeight: "600" },
  actionGroup: { flexDirection: "row", gap: 10 },
  iconBtn: { padding: 4 },
  inviteActions: { flexDirection: "row", gap: 10, marginBottom: 14 },
  acceptBtn: { flex: 2, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  acceptText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  declineBtn: { flex: 1, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, justifyContent: "center", alignItems: "center" },
  declineText: { color: "#64748B", fontWeight: "700", fontSize: 14 },
  mainBtn: { height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 14 },
  btnJoined: { backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" },
  mainBtnText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
});