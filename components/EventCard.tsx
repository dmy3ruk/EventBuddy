import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
  Alert,
  Animated,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  doc,
  getDoc,
  deleteDoc,
  addDoc,
  collection,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";
import { db } from "../FirebaseConfig";
import { EventFull } from "../utils/types";
import { Swipeable } from "react-native-gesture-handler";

type Props = {
  item: EventFull;
  uid: string;
  onOpenChat?: (event: EventFull) => void;
  onAccept?: (eventId: string) => void;
  onDecline?: (eventId: string) => void;
  onJoinToggle?: (eventId: string) => void;
  onDelete?: (eventId: string) => void;
  mode?: "my-events" | "discover";
};

const reportReasons = [
  "Spam or scam",
  "Inappropriate content",
  "Harassment",
  "Fake event",
  "Dangerous activity",
  "Other",
];

const openMap = (lat: number, lng: number, label: string) => {
  const scheme = Platform.select({
    ios: "maps:0,0?q=",
    android: "geo:0,0?q=",
  });

  const url = Platform.select({
    ios: `${scheme}${label}@${lat},${lng}`,
    android: `${scheme}${lat},${lng}(${label})`,
  });

  if (url) Linking.openURL(url);
};

const getCategoryTheme = (category?: string) => {
  const cat = category?.toLowerCase() || "";

  if (cat.includes("work & study")) return { primary: "#334882", bg: "#EFF6FF" };
  if (cat.includes("social")) return { primary: "#EC4899", bg: "#FDF2F8" };
  if (cat.includes("entertaiment")) return { primary: "#8B5CF6", bg: "#F5F3FF" };
  if (cat.includes("health/self-care")) return { primary: "#76cdf3", bg: "#F0FDF4" };
  if (cat.includes("food & drinks")) return { primary: "#F59E0B", bg: "#FFFBEB" };
  if (cat.includes("sport")) return { primary: "#10B981", bg: "#F0FDF4" };
  if (cat.includes("other")) return { primary: "#94A3B8", bg: "#F8FAFC" };

  return { primary: "#64748B", bg: "#F8FAFC" };
};

export default function EventCard({
                                    item,
                                    uid,
                                    onOpenChat,
                                    onAccept,
                                    onDecline,
                                    onJoinToggle,
                                    onDelete,
                                    mode = "my-events",
                                  }: Props) {
  const eventAny = item as any;

  const ownerId = eventAny.organizerId || eventAny.userId;
  const isOwner = ownerId === uid;

  const [isAdmin, setIsAdmin] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  const theme = getCategoryTheme(item.category);

  // type-safe filter from v1
  const acceptedUserIds: string[] = Array.isArray(eventAny.acceptedUserIds)
      ? eventAny.acceptedUserIds.filter(
          (id: unknown): id is string => typeof id === "string"
      )
      : [];

  const invitedUserIds = Array.isArray(eventAny.invitedUserIds)
      ? eventAny.invitedUserIds
      : [];

  const isAccepted = acceptedUserIds.includes(uid);
  const isInvited = invitedUserIds.includes(uid) && !isAccepted;

  const isPublic = item.isPublic;
  const canLeave = isPublic && isAccepted && !isOwner;

  const goingCount = Array.from(new Set([ownerId, ...acceptedUserIds])).filter(
      (pUid): pUid is string =>
          typeof pUid === "string" && pUid.trim().length > 0
  ).length;

  const hasLocation =
      typeof item.location?.latitude === "number" &&
      typeof item.location?.longitude === "number" &&
      item.location.latitude !== 0 &&
      item.location.longitude !== 0;

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!uid) return;
      try {
        const userDoc = await getDoc(doc(db, "users", uid));
        setIsAdmin(userDoc.exists() && userDoc.data().role === "admin");
      } catch (e) {
        console.error("Error checking admin status:", e);
      }
    };

    checkAdminStatus();
  }, [uid]);

  const handleReport = async (reason: string) => {
    if (!uid) {
      Alert.alert("Error", "You must be logged in to report.");
      return;
    }

    try {
      const reportsQuery = query(
          collection(db, "reports"),
          where("type", "==", "event"),
          where("eventId", "==", item.id),
          where("status", "==", "open"),
          limit(1)
      );

      const existing = await getDocs(reportsQuery);

      if (!existing.empty) {
        await updateDoc(doc(db, "reports", existing.docs[0].id), {
          reasons: arrayUnion(reason),
          reporters: arrayUnion(uid),
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "reports"), {
          type: "event",
          targetId: item.id,
          eventId: item.id,
          reportedUserId: ownerId || null,
          reporterId: uid,
          reporters: [uid],
          reason,
          reasons: [reason],
          details: [
            {
              reporterId: uid,
              reason,
              createdAt: new Date().toISOString(),
            },
          ],
          status: "open",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // always hide from reporter (from v1)
      await updateDoc(doc(db, "events", item.id), {
        hiddenFor: arrayUnion(uid),
      });

      setReportModalVisible(false);
      Alert.alert("Report sent", "This event was hidden for you.");
    } catch (e) {
      console.error("Report error:", e);
      Alert.alert("Error", "Failed to send report.");
    }
  };

  const handleDelete = () => {
    const title = isAdmin && !isOwner ? "Admin: Delete Event" : "Delete Event";

    Alert.alert(title, `Are you sure you want to delete "${item.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "events", item.id));
            onDelete?.(item.id);
          } catch (e) {
            Alert.alert("Error", "Failed to delete event. Check your permissions.");
          }
        },
      },
    ]);
  };

  const handleLeave = async () => {
    try {
      await updateDoc(doc(db, "events", item.id), {
        acceptedUserIds: acceptedUserIds.filter((id) => id !== uid),
      });
      onJoinToggle?.(item.id);
    } catch (e) {
      Alert.alert("Error", "Failed to leave event");
    }
  };

  const renderRightActions = (
      progress: Animated.AnimatedInterpolation<number>,
      dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-160, 0],
      outputRange: [1, 0],
      extrapolate: "clamp",
    });

    return (
        <View style={styles.swipeActions}>
          {(isOwner || isAdmin) && (
              <TouchableOpacity onPress={handleDelete} style={styles.deleteSwipeContainer}>
                <Animated.View style={{ transform: [{ scale }], alignItems: "center" }}>
                  <Ionicons name="trash-outline" size={26} color="#FFF" />
                  <Text style={styles.swipeText}>
                    {isAdmin && !isOwner ? "MODERATE" : "DELETE"}
                  </Text>
                </Animated.View>
              </TouchableOpacity>
          )}

          {!isOwner && (
              <TouchableOpacity
                  onPress={() => setReportModalVisible(true)}
                  style={styles.reportSwipeContainer}
              >
                <Animated.View style={{ transform: [{ scale }], alignItems: "center" }}>
                  <Ionicons name="flag-outline" size={26} color="#FFF" />
                  <Text style={styles.swipeText}>REPORT</Text>
                </Animated.View>
              </TouchableOpacity>
          )}

          {canLeave && (
              <TouchableOpacity onPress={handleLeave} style={styles.leaveSwipeContainer}>
                <Animated.View style={{ transform: [{ scale }], alignItems: "center" }}>
                  <Ionicons name="exit-outline" size={26} color="#fff" />
                  <Text style={styles.swipeText}>LEAVE</Text>
                </Animated.View>
              </TouchableOpacity>
          )}
        </View>
    );
  };

  const CardContent = (
      <View style={[styles.card, { borderLeftColor: theme.primary }]}>
        <View style={styles.eventHeader}>
          <View style={{ flex: 1 }}>
            <View style={[styles.badge, { backgroundColor: theme.bg }]}>
              <Text style={[styles.badgeText, { color: theme.primary }]}>
                {item.category ? `#${item.category.toLowerCase()}` : "#general"}
              </Text>
            </View>

            <Text style={styles.eventName} numberOfLines={1}>
              {item.name}
            </Text>
          </View>

          <View
              style={[
                styles.typeBadge,
                item.isPublic ? styles.publicBadge : styles.privateBadge,
              ]}
          >
            <Ionicons
                name={item.isPublic ? "globe-outline" : "lock-closed-outline"}
                size={12}
                color={item.isPublic ? "#059669" : "#6366F1"}
            />
            <Text
                style={[
                  styles.typeText,
                  { color: item.isPublic ? "#059669" : "#6366F1" },
                ]}
            >
              {item.isPublic ? "Public" : "Private"}
            </Text>
          </View>
        </View>

        <View style={styles.infoSection}>
          {item.details && (
              <Text style={styles.infoTextDetails}>{item.details}</Text>
          )}

          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={24} color="#6E7D93" />
            <Text style={styles.infoText}>
              {item.date} • {item.time}
            </Text>
          </View>

          {hasLocation && (
              <TouchableOpacity
                  onPress={() =>
                      openMap(item.location!.latitude, item.location!.longitude, item.name)
                  }
                  style={styles.infoRow}
              >
                <Ionicons name="location-outline" size={24} color={theme.primary} />
                <Text
                    style={[styles.infoText, { color: theme.primary, fontWeight: "700" }]}
                    numberOfLines={1}
                >
                  {item.location?.name || "Somewhere"}
                </Text>
              </TouchableOpacity>
          )}
        </View>

        {mode === "my-events" && isInvited && (
            <View style={styles.inviteActions}>
              <TouchableOpacity
                  style={styles.declineBtn}
                  onPress={() => onDecline?.(item.id)}
              >
                <Text style={styles.declineText}>Decline</Text>
              </TouchableOpacity>

              <TouchableOpacity
                  style={[styles.acceptBtn, { backgroundColor: theme.primary }]}
                  onPress={() => onAccept?.(item.id)}
              >
                <Text style={styles.acceptText}>Accept</Text>
              </TouchableOpacity>
            </View>
        )}

        {mode === "discover" && !isOwner && (
            <TouchableOpacity
                style={[
                  styles.mainBtn,
                  isAccepted ? styles.btnJoined : { backgroundColor: theme.primary },
                ]}
                onPress={() => onJoinToggle?.(item.id)}
            >
              <Text style={[styles.mainBtnText, isAccepted && { color: "#64748B" }]}>
                {isAccepted ? "Going ✓" : "Join Event"}
              </Text>
            </TouchableOpacity>
        )}

        <View style={styles.divider} />

        <View style={styles.bottomRow}>
          <Text style={styles.participantsCount}>{goingCount} going</Text>

          <View style={styles.actionGroup}>
            {(isOwner || isAccepted || isAdmin) && onOpenChat && (
                <TouchableOpacity style={styles.iconBtn} onPress={() => onOpenChat(item)}>
                  <Ionicons name="chatbubble-ellipses-outline" size={22} color="#94A3B8" />
                </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
  );

  return (
      <>
        <Swipeable
            renderRightActions={renderRightActions}
            friction={2}
            rightThreshold={40}
            containerStyle={styles.swipeableContainer}
        >
          {CardContent}
        </Swipeable>

        <Modal
            visible={reportModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setReportModalVisible(false)}
        >
          <View style={styles.reportOverlay}>
            <View style={styles.reportModal}>
              <View style={styles.reportHeader}>
                <View>
                  <Text style={styles.reportTitle}>Report event</Text>
                  <Text style={styles.reportSubtitle} numberOfLines={2}>
                    Why are you reporting "{item.name}"?
                  </Text>
                </View>

                <TouchableOpacity
                    style={styles.reportCloseBtn}
                    onPress={() => setReportModalVisible(false)}
                >
                  <Ionicons name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>

              {reportReasons.map((reason) => (
                  <TouchableOpacity
                      key={reason}
                      style={styles.reportReasonBtn}
                      onPress={() => handleReport(reason)}
                  >
                    <Text style={styles.reportReasonText}>{reason}</Text>
                    <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                  </TouchableOpacity>
              ))}

              <TouchableOpacity
                  style={styles.reportCancelBtn}
                  onPress={() => setReportModalVisible(false)}
              >
                <Text style={styles.reportCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </>
  );
}

const styles = StyleSheet.create({
  swipeableContainer: {
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 16,
    borderLeftWidth: 5,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.07,
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  swipeActions: {
    flexDirection: "row",
    marginRight: 16,
    borderRadius: 20,
    overflow: "hidden",
  },
  deleteSwipeContainer: {
    width: 80,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
  },
  reportSwipeContainer: {
    width: 80,
    backgroundColor: "#F59E0B",
    justifyContent: "center",
    alignItems: "center",
  },
  leaveSwipeContainer: {
    width: 80,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
  },
  swipeText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 9,
    marginTop: 4,
    textAlign: "center",
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  eventName: {
    fontSize: 19,
    fontWeight: "800",
    color: "#1E293B",
    marginTop: 8,
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  typeBadge: {
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
  typeText: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  infoSection: {
    gap: 6,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoText: {
    fontSize: 14,
    color: "#6E7D93",
    fontWeight: "600",
  },
  infoTextDetails: {
    fontSize: 14,
    color: "#6E7D93",
    fontWeight: "600",
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginBottom: 12,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  participantsCount: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  actionGroup: {
    flexDirection: "row",
    gap: 10,
  },
  iconBtn: {
    padding: 4,
  },
  inviteActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  acceptBtn: {
    flex: 2,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  acceptText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
  declineBtn: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  declineText: {
    color: "#64748B",
    fontWeight: "700",
    fontSize: 14,
  },
  mainBtn: {
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  btnJoined: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  mainBtnText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 15,
  },
  reportOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  reportModal: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: 20,
  },
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  reportTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1E293B",
  },
  reportSubtitle: {
    marginTop: 6,
    color: "#64748B",
    fontWeight: "600",
    maxWidth: 260,
  },
  reportCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  reportReasonBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  reportReasonText: {
    color: "#1E293B",
    fontWeight: "700",
    fontSize: 15,
  },
  reportCancelBtn: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  reportCancelText: {
    color: "#64748B",
    fontWeight: "900",
  },
});