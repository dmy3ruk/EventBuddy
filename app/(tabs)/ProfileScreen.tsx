import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { getAuth } from "firebase/auth";
import { router } from "expo-router";
import { auth, db } from "../../FirebaseConfig";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, onSnapshot } from "firebase/firestore";

import {
  fetchUsername,
  subscribeToOwnerEvents,
  subscribeToInvitedEvents,
  calculateProfileStats,
} from "../../utils/firestoreHelpers";
import { EventType } from "../../utils/types";

// Палітра адаптована під твій фірмовий #505BEB
const COLORS = {
  primary: "#505BEB",
  primaryContainer: "rgba(80, 91, 235, 0.1)",
  surface: "#F8FAFC",
  onSurface: "#1A1A1A",
  outline: "#64748B",
  error: "#EF4444",
  white: "#FFFFFF",
  cardBg: "#FFFFFF",
};

export default function ProfileScreen() {
  const [username, setUsername] = useState<string>("");
  const [ownerEvents, setOwnerEvents] = useState<EventType[]>([]);
  const [invitedEvents, setInvitedEvents] = useState<EventType[]>([]);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [totalAttendees, setTotalAttendees] = useState(0);
  const [friendsConected, setFriendsConected] = useState(0);

  const user = getAuth().currentUser;
  const uid = user?.uid;
  const email = user?.email;

  useEffect(() => {
    const loadUsername = async () => {
      const name = await fetchUsername();
      setUsername(name || "No username");
    };
    loadUsername();
  }, []);

  useEffect(() => {
    const unsubscribe = getAuth().onAuthStateChanged((u) => {
      if (!u) router.replace("/SignIn");
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubOwner = subscribeToOwnerEvents((evs) => setOwnerEvents(evs as EventType[]));
    const unsubInvited = subscribeToInvitedEvents((evs) => setInvitedEvents(evs as EventType[]));
    return () => { unsubOwner(); unsubInvited(); };
  }, []);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, "users", uid), (docSnap) => {
      if (docSnap.exists()) {
        setFriendsConected(docSnap.data().friends?.length || 0);
      }
    });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const stats = calculateProfileStats(ownerEvents, invitedEvents, uid);
    setUpcomingCount(stats.upcomingCount);
    setTotalAttendees(stats.totalAttendees);
  }, [ownerEvents, invitedEvents, uid]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.replace("/SignIn");
    } catch (e) { console.log(e); }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Header with Logout */}
        <View style={styles.topActions}>
          <Text style={styles.topTitle}>Profile</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <MaterialCommunityIcons name="logout-variant" size={22} color={COLORS.error} />
          </TouchableOpacity>
        </View>

        {/* Profile Header Section */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{username ? username[0]?.toUpperCase() : "A"}</Text>
            </View>
            <TouchableOpacity style={styles.editFab}>
              <Ionicons name="camera" size={16} color={COLORS.white} />
            </TouchableOpacity>
          </View>
          <Text style={styles.nameText}>{username}</Text>
          <Text style={styles.emailText}>{email}</Text>
        </View>

        {/* Statistics Grid */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <StatCard label="My Events" value={ownerEvents.length} icon="calendar-star" color={COLORS.primary} />
            <StatCard label="Attended" value={totalAttendees} icon="check-decagram" color="#16A34A" />
          </View>
          <View style={styles.statsRow}>
            <StatCard label="Friends" value={friendsConected} icon="account-group" color="#0EA5E9" />
            <StatCard label="Upcoming" value={upcomingCount} icon="clock-fast" color="#F59E0B" />
          </View>
        </View>

        {/* Settings Section */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionLabel}>Preferences</Text>
          
          <SettingsItem 
            icon="bell-outline" 
            title="Notifications" 
            sub="Manage alerts for events" 
            action={<Text style={styles.actionText}>On</Text>} 
          />
          <SettingsItem 
            icon="shield-lock-outline" 
            title="Privacy" 
            sub="Visibility and data control" 
            showChevron
          />
          <SettingsItem 
            icon="account-check-outline" 
            title="Verification" 
            sub="Member since March 2023" 
            action={
                <View style={styles.badge}><Text style={styles.badgeText}>Active</Text></View>
            }
          />
        </View>

        <Text style={styles.footerText}>EventBuddy v1.0.4</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- SUB-COMPONENTS ---

const StatCard = ({ label, value, icon, color }: any) => (
  <View style={styles.statCard}>
    <View style={[styles.iconCircle, { backgroundColor: color + '15' }]}>
      <MaterialCommunityIcons name={icon} size={24} color={color} />
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const SettingsItem = ({ icon, title, sub, action, showChevron }: any) => (
  <TouchableOpacity style={styles.settingsRow}>
    <View style={styles.settingsIconBg}>
      <MaterialCommunityIcons name={icon} size={24} color={COLORS.primary} />
    </View>
    <View style={styles.settingsTextContent}>
      <Text style={styles.settingsTitle}>{title}</Text>
      <Text style={styles.settingsSubText}>{sub}</Text>
    </View>
    {action}
    {showChevron && <Ionicons name="chevron-forward" size={20} color={COLORS.outline} />}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  scrollContent: {
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  topActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 30,
  },
  topTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.onSurface,
    letterSpacing: -0.5,
  },
  logoutBtn: {
    padding: 10,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: 30,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 35, // Squircle
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
    elevation: 10,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 6 }
  },
  avatarText: {
    fontSize: 40,
    fontWeight: "bold",
    color: COLORS.white,
  },
  editFab: {
    position: "absolute",
    bottom: -5,
    right: -5,
    backgroundColor: COLORS.primary,
    padding: 8,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: COLORS.surface,
  },
  nameText: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.onSurface,
  },
  emailText: {
    fontSize: 14,
    color: COLORS.outline,
    marginTop: 4,
    fontWeight: "500"
  },
  statsContainer: {
    gap: 12,
    marginBottom: 30,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 24,
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }
  },
  iconCircle: {
    padding: 10,
    borderRadius: 16,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.onSurface,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.outline,
    marginTop: 2,
    fontWeight: "600"
  },
  settingsSection: {
    backgroundColor: COLORS.white,
    borderRadius: 28,
    padding: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.primary,
    marginLeft: 12,
    marginVertical: 10,
    textTransform: "uppercase",
    letterSpacing: 1.2
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 20,
  },
  settingsIconBg: {
    padding: 10,
    backgroundColor: COLORS.primaryContainer,
    borderRadius: 14,
    marginRight: 15,
  },
  settingsTextContent: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.onSurface,
  },
  settingsSubText: {
    fontSize: 12,
    color: COLORS.outline,
    fontWeight: "500"
  },
  actionText: {
    color: COLORS.primary,
    fontWeight: "800",
  },
  badge: {
    backgroundColor: COLORS.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.primary,
  },
  footerText: {
    textAlign: "center",
    marginTop: 25,
    color: COLORS.outline,
    fontSize: 11,
    fontWeight: "600"
  },
});