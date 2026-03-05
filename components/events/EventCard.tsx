import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking } from "react-native";
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

// --- Допоміжні функції (без змін) ---
const openMap = (lat: number, lng: number, label: string) => {
  const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
  const url = Platform.select({
    ios: `${scheme}${label}@${lat},${lng}`,
    android: `${scheme}${lat},${lng}(${label})`
  });
  if (url) Linking.openURL(url);
};

function getEventStatus(event: EventType, uid: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(event.date);
  d.setHours(0, 0, 0, 0);
  const isInvited = event.invitedUserIds?.includes(uid) && !event.acceptedUserIds?.includes(uid);
  if (isInvited) return "Invitation";
  if (d < today) return "Past";
  return "Upcoming";
}

const getCategoryTheme = (category?: string) => {
  const cat = category?.toLowerCase() || "";
  if (cat.includes("sport"))  return { primary: "#059669", bg: "#D1FAE5" }; 
  if (cat.includes("music"))  return { primary: "#7C3AED", bg: "#EDE9FE" }; 
  if (cat.includes("food") || cat.includes("drink")) return { primary: "#D97706", bg: "#FEF3C7" }; 
  if (cat.includes("study") || cat.includes("work")) return { primary: "#4F46E5", bg: "#E0E7FF" }; 
  if (cat.includes("movie"))  return { primary: "#E11D48", bg: "#FFE4E6" }; 
  if (cat.includes("party"))  return { primary: "#C026D3", bg: "#F5D0FE" }; 
  if (cat.includes("games"))  return { primary: "#0891B2", bg: "#CFFAFE" }; 
  if (cat.includes("coffee")) return { primary: "#78350F", bg: "#FEF3C7" }; 
  return { primary: "#475569", bg: "#F1F5F9" }; 
};

// --- Підкомпонент учасників (компактніший) ---
function ParticipantsRow({ item, usersMap }: { item: EventType; usersMap: Record<string, string> }) {
  const participants = [item.userId, ...(item.acceptedUserIds || [])];
  const uniqueParticipants = Array.from(new Set(participants));
  const visible = uniqueParticipants.slice(0, 4);
  const remainingCount = uniqueParticipants.length - visible.length;
  const colors = ["#FFD6D6", "#D6FFDA", "#D6E4FF", "#FFF4D6"];

  return (
    <View style={styles.participantRow}>
      <View style={styles.avatarsGroup}>
        {visible.map((pUid, index) => (
          <View key={pUid} style={[styles.avatar, { backgroundColor: colors[index % colors.length], zIndex: 10 - index }]}>
            <Text style={styles.avatarText}>{usersMap[pUid]?.[0]?.toUpperCase() || "U"}</Text>
          </View>
        ))}
        {remainingCount > 0 && (
          <View style={[styles.avatar, styles.remainingAvatar]}>
            <Text style={styles.remainingText}>+{remainingCount}</Text>
          </View>
        )}
      </View>
      <Text style={styles.participantsCount}>{uniqueParticipants.length} going</Text>
    </View>
  );
}

// --- Основний компонент ---
export default function EventCard({ item, uid, onOpenChat, onAccept, onDecline }: Props) {
  const isOwner = item.userId === uid;
  const isAccepted = item.acceptedUserIds?.includes(uid);
  const isInvited = item.invitedUserIds?.includes(uid) && !item.acceptedUserIds?.includes(uid);
  const isPublic = item.isPublic;
  const status = getEventStatus(item, uid);
  const theme = getCategoryTheme(item.category);

  const [usersMap, setUsersMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const participants = Array.from(new Set([item.userId, ...(item.acceptedUserIds || [])]));
    const loadUsers = async () => {
      const map: Record<string, string> = {};
      await Promise.all(participants.map(async (pUid) => {
        const snap = await getDoc(doc(db, "usernames", pUid));
        if (snap.exists()) map[pUid] = snap.data().username;
      }));
      setUsersMap(map);
    };
    loadUsers();
  }, [item.userId, item.acceptedUserIds]);

  return (
    <View style={[styles.card, isOwner && { borderLeftColor: theme.primary, borderLeftWidth: 4 }]}>
      
      {/* Header */}
      <View style={styles.eventHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eventName} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.categoryLabel, { color: theme.primary }]}>
            {item.category ? `#${item.category}` : "#general"}
          </Text>
        </View>

        <View style={[styles.typeBadge, isPublic ? styles.publicBadge : styles.privateBadge]}>
          <Ionicons 
            name={isPublic ? "globe-outline" : "lock-closed-outline"} 
            size={10} 
            color={isPublic ? "#059669" : "#6366F1"} 
          />
          <Text style={[styles.typeText, { color: isPublic ? "#059669" : "#6366F1" }]}>
            {isPublic ? "Public" : "Private"}
          </Text>
        </View>
      </View>

      {/* Info Section */}
      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <View style={[styles.iconCircle, { backgroundColor: theme.bg }]}>
            <Ionicons name="calendar" size={12} color={theme.primary} />
          </View>
          <Text style={styles.infoText}>{item.date} • {item.time}</Text>
        </View>

        {(item.locationName || item.location) && (
          <View style={styles.infoRow}>
            <View style={[styles.iconCircle, { backgroundColor: theme.bg }]}>
              <Ionicons name="location" size={12} color={theme.primary} />
            </View>
            {item.location && typeof item.location === 'object' ? (
              <TouchableOpacity 
                onPress={() => openMap(item.location!.latitude, item.location!.longitude, item.name)}
                style={styles.locationButton}
                activeOpacity={0.6}
              >
                <Text style={[styles.infoText, { color: theme.primary, textDecorationLine: 'underline' }]} numberOfLines={1}>
                  {item.locationName || "View on Map"}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.infoText} numberOfLines={1}>{item.locationName}</Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.divider} />

      {/* Bottom Row */}
      <View style={styles.bottomRow}>
        <ParticipantsRow item={item} usersMap={usersMap} />
        
        {(isOwner || isAccepted) && (
          <TouchableOpacity 
            style={styles.chatButtonQuiet} 
            onPress={() => onOpenChat(item)}
          >
            <Ionicons 
              name="chatbubble-ellipses-outline" // Контурна іконка легша за залиту
              size={22} 
              color="#94A3B8" // Нейтральний сірий (Slate 400)
            />
          </TouchableOpacity>
        )}
      </View>

      {isInvited && (
        <View style={styles.inviteActions}>
          <TouchableOpacity style={styles.declineBtn} onPress={() => onDecline(item.id)}>
            <Text style={styles.declineText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.acceptBtn, { backgroundColor: theme.primary }]} 
            onPress={() => onAccept(item.id)}
          >
            <Text style={styles.acceptText}>Accept</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === "Past" && (
        <Text style={styles.pastLabel}>Event Ended</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    marginHorizontal: 16,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  eventName: { fontSize: 18, fontWeight: "800", color: "#0F172A", letterSpacing: -0.3 },
  categoryLabel: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", marginTop: 1 },
  typeBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  publicBadge: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  privateBadge: { backgroundColor: "#EEF2FF", borderColor: "#C7D2FE" },
  typeText: { fontSize: 9, fontWeight: "800", textTransform: "uppercase" },

  infoSection: { gap: 8, marginBottom: 14 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconCircle: { width: 26, height: 26, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  infoText: { fontSize: 13, color: "#475569", fontWeight: "600", flexShrink: 1 },
  locationButton: { flex: 1, justifyContent: "center" },
  
  divider: { height: 1, backgroundColor: "#F1F5F9", marginBottom: 12 },
  
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chatButton: { width: 38, height: 38, borderRadius: 12, justifyContent: "center", alignItems: "center", borderWidth: 1.5 },
  participantRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatarsGroup: { flexDirection: "row" },
  avatar: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: "#fff", justifyContent: "center", alignItems: "center", marginRight: -8 },
  avatarText: { fontSize: 10, fontWeight: "800", color: "#1E293B" },
  remainingAvatar: { backgroundColor: "#F8FAFC", zIndex: 0, borderWidth: 1, borderColor: "#E2E8F0" },
  remainingText: { fontSize: 9, fontWeight: "700", color: "#94A3B8" },
  participantsCount: { fontSize: 12, color: "#64748B", marginLeft: 10, fontWeight: "500" },

  inviteActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  acceptBtn: { flex: 2, paddingVertical: 10, borderRadius: 12, alignItems: "center" },
  acceptText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  declineBtn: { flex: 1, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", paddingVertical: 10, borderRadius: 12, alignItems: "center" },
  declineText: { color: "#64748B", fontWeight: "700", fontSize: 14 },
  pastLabel: { marginTop: 8, fontSize: 10, color: "#94A3B8", textAlign: "center", fontWeight: "700", textTransform: "uppercase" },
  chatButtonQuiet: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent", // Жодних фонів
  },
});