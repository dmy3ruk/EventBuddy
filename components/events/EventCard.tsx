import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  Linking, Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../FirebaseConfig";
import { EventFull } from "../../utils/types"; // Використовуємо повний тип з ID

type Props = {
  item: EventFull; // Тепер ми впевнені, що id існує
  uid: string;
  onOpenChat?: (event: EventFull) => void;
  onAccept?: (eventId: string) => void;
  onDecline?: (eventId: string) => void;
  onJoinToggle?: (eventId: string) => void;
  onDelete?: (eventId: string) => void;
  mode?: 'my-events' | 'discover';
};

// --- Допоміжні функції ---
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
  if (cat.includes("sport"))  return { primary: "#10B981", bg: "#F0FDF4" };
  if (cat.includes("music"))  return { primary: "#8B5CF6", bg: "#F5F3FF" };
  if (cat.includes("food"))   return { primary: "#F59E0B", bg: "#FFFBEB" };
  if (cat.includes("study"))  return { primary: "#3B82F6", bg: "#EFF6FF" };
  if (cat.includes("party"))  return { primary: "#EC4899", bg: "#FDF2F8" };
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
        <Text style={styles.participantsCount}>{uniqueParticipants.length} піде</Text>
      </View>
  );
}

export default function EventCard({ item, uid, onOpenChat, onAccept, onDecline, onJoinToggle, onDelete, mode = 'my-events' }: Props) {
  const isOwner = item.userId === uid;
  const isAccepted = item.acceptedUserIds?.includes(uid);
  const isInvited = item.invitedUserIds?.includes(uid) && !isAccepted;
  const theme = getCategoryTheme(item.category);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});

  // Завантаження імен учасників для аватарок
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
    Alert.alert("Видалити подію", `Ви впевнені, що хочете видалити "${item.name}"?`, [
      { text: "Скасувати", style: "cancel" },
      {
        text: "Видалити",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "events", item.id)); // Тепер item.id валідний для TS
            onDelete?.(item.id);
          } catch (e) { Alert.alert("Помилка", "Не вдалося видалити"); }
        },
      },
    ]);
  };

  const hasLocation = !!(item.location?.latitude && item.location?.longitude);

  return (
      <View style={[styles.card, { borderLeftColor: theme.primary }]}>
        <View style={styles.eventHeader}>
          <View style={{ flex: 1 }}>
            <View style={[styles.badge, { backgroundColor: theme.bg }]}>
              <Text style={[styles.badgeText, { color: theme.primary }]}>
                {item.category ? `#${item.category}` : "#загальне"}
              </Text>
            </View>
            <Text style={styles.eventName} numberOfLines={1}>{item.name}</Text>
          </View>

          <View style={[styles.typeBadge, item.isPublic ? styles.publicBadge : styles.privateBadge]}>
            <Ionicons
                name={item.isPublic ? "globe-outline" : "lock-closed-outline"}
                size={10}
                color={item.isPublic ? "#059669" : "#6366F1"}
            />
            <Text style={[styles.typeText, { color: item.isPublic ? "#059669" : "#6366F1" }]}>
              {item.isPublic ? "Публічна" : "Приватна"}
            </Text>
          </View>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={14} color="#64748B" />
            <Text style={styles.infoText}>{item.date} • {item.time}</Text>
          </View>

          {hasLocation && (
              <TouchableOpacity
                  onPress={() => openMap(item.location!.latitude, item.location!.longitude, item.name)}
                  style={styles.infoRow}
              >
                <Ionicons name="location-outline" size={14} color={theme.primary} />
                <Text style={[styles.infoText, { color: theme.primary, fontWeight: '700' }]} numberOfLines={1}>
                  {/* Використовуємо item.location.name відповідно до твоїх типів */}
                  {item.location?.name || "Десь"}
                </Text>
              </TouchableOpacity>
          )}
        </View>

        {/* Кнопки запрошення */}
        {mode === 'my-events' && isInvited && (
            <View style={styles.inviteActions}>
              <TouchableOpacity style={styles.declineBtn} onPress={() => onDecline?.(item.id)}>
                <Text style={styles.declineText}>Відхилити</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: theme.primary }]} onPress={() => onAccept?.(item.id)}>
                <Text style={styles.acceptText}>Прийняти</Text>
              </TouchableOpacity>
            </View>
        )}

        {/* Кнопка приєднання (Discover) */}
        {mode === 'discover' && !isOwner && (
            <TouchableOpacity
                style={[styles.mainBtn, isAccepted ? styles.btnJoined : { backgroundColor: theme.primary }]}
                onPress={() => onJoinToggle?.(item.id)}
            >
              <Text style={[styles.mainBtnText, isAccepted && { color: "#64748B" }]}>
                {isAccepted ? "Ви йдете ✓" : "Приєднатися"}
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
            {isOwner && (
                <TouchableOpacity onPress={handleDelete} style={styles.iconBtn}>
                  <Ionicons name="trash-outline" size={22} color="#F87171" />
                </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    marginHorizontal: 16,
    borderLeftWidth: 5,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 10 },
      android: { elevation: 3 },
    }),
  },
  eventHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  eventName: { fontSize: 19, fontWeight: "800", color: "#1E293B", marginTop: 4 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  typeBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  publicBadge: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  privateBadge: { backgroundColor: "#EEF2FF", borderColor: "#C7D2FE" },
  typeText: { fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
  infoSection: { gap: 6, marginBottom: 14 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoText: { fontSize: 13, color: "#475569", fontWeight: "600" },
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