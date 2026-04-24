import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Platform,
    Alert,
    ActivityIndicator,
    Image,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { getAuth } from "firebase/auth";
import { router } from "expo-router";
import { auth, db } from "../../FirebaseConfig";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, onSnapshot, collection, updateDoc, getDoc } from "firebase/firestore";
import * as ImagePicker from 'expo-image-picker';

import {
    fetchUsername,
    subscribeToOwnerEvents,
    subscribeToInvitedEvents,
    calculateProfileStats,
} from "../../utils/firestoreHelpers";
import { EventFull } from "../../utils/types";

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

const EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export default function ProfileScreen() {
    const [username, setUsername] = useState<string>("");
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    const [ownerEvents, setOwnerEvents] = useState<EventFull[]>([]);
    const [invitedEvents, setInvitedEvents] = useState<EventFull[]>([]);
    const [upcomingCount, setUpcomingCount] = useState(0);
    const [totalAttendees, setTotalAttendees] = useState(0);
    const [friendsConected, setFriendsConected] = useState(0);

    const user = getAuth().currentUser;
    const uid = user?.uid; // Має тип string | undefined
    const email = user?.email;

    useEffect(() => {
        // Перевірка для TypeScript: якщо uid немає, нічого не робимо
        if (!uid) return;

        const loadUserData = async () => {
            try {
                const userDoc = await getDoc(doc(db, "usernames", uid));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    setUsername(data.username || "No username");
                    setAvatarUrl(data.avatarUrl || null);
                }
            } catch (error) {
                console.error("Error loading user data:", error);
            }
        };
        loadUserData();
    }, [uid]);

    useEffect(() => {
        const unsubscribeAuth = getAuth().onAuthStateChanged((u) => {
            if (!u) router.replace("/SignIn");
        });

        const unsubOwner = subscribeToOwnerEvents((evs) => setOwnerEvents(evs as EventFull[]));
        const unsubInvited = subscribeToInvitedEvents((evs) => setInvitedEvents(evs as EventFull[]));

        let unsubFriends = () => {};
        if (uid) {
            const friendsRef = collection(db, "friends", uid, "list");
            unsubFriends = onSnapshot(friendsRef, (snapshot) => {
                setFriendsConected(snapshot.size);
            });
        }

        return () => {
            unsubscribeAuth();
            unsubOwner();
            unsubInvited();
            unsubFriends();
        };
    }, [uid]);

    useEffect(() => {
        if (!uid) return;
        const stats = calculateProfileStats(ownerEvents, invitedEvents, uid);
        setUpcomingCount(stats.upcomingCount);
        setTotalAttendees(stats.totalAttendees);
    }, [ownerEvents, invitedEvents, uid]);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Error', 'Permissions needed.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled && uid) {
            handleUpload(result.assets[0].uri);
        }
    };

    const handleUpload = async (uri: string) => {
        // КРИТИЧНО: Перевірка uid для усунення помилки doc()
        if (!uid) {
            Alert.alert("Error", "User not authenticated.");
            return;
        }

        if (!EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || !EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET) {
            Alert.alert("Config Error", "Cloudinary credentials missing.");
            return;
        }

        setUploading(true);
        try {
            const data = new FormData();
            const fileToUpload = {
                uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
                type: 'image/jpeg',
                name: `avatar_${uid}.jpg`,
            };

            // @ts-ignore
            data.append('file', fileToUpload);
            data.append('upload_preset', EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET);
            data.append('cloud_name', EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME);

            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
                {
                    method: 'POST',
                    body: data,
                    headers: { 'Accept': 'application/json' },
                }
            );

            const result = await response.json();

            if (result.secure_url) {
                // Тепер TypeScript знає, що uid точно string завдяки перевірці вище
                await updateDoc(doc(db, "usernames", uid), {
                    avatarUrl: result.secure_url
                });
                setAvatarUrl(result.secure_url);
                Alert.alert("Success", "Avatar updated!");
            } else {
                throw new Error("Upload failed");
            }
        } catch (error) {
            console.error("Upload error:", error);
            Alert.alert("Error", "Cloudinary upload failed.");
        } finally {
            setUploading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await auth.signOut();
            router.replace("/SignIn");
        } catch (e) {
            console.log(e);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <View style={styles.topActions}>
                    <Text style={styles.topTitle}>Profile</Text>
                    <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                        <MaterialCommunityIcons name="logout-variant" size={22} color={COLORS.error} />
                    </TouchableOpacity>
                </View>

                <View style={styles.profileHeader}>
                    <View style={styles.avatarWrapper}>
                        <TouchableOpacity
                            style={styles.avatar}
                            onPress={pickImage}
                            disabled={uploading}
                            activeOpacity={0.8}
                        >
                            {uploading ? (
                                <ActivityIndicator color={COLORS.white} />
                            ) : avatarUrl ? (
                                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                            ) : (
                                <Text style={styles.avatarText}>{username ? username[0]?.toUpperCase() : "A"}</Text>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.editFab} onPress={pickImage}>
                            <Ionicons name="camera" size={16} color={COLORS.white} />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.nameText}>{username}</Text>
                    <Text style={styles.emailText}>{email}</Text>
                </View>

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

                <View style={styles.settingsSection}>
                    <Text style={styles.sectionLabel}>Preferences</Text>
                    <SettingsItem icon="bell-outline" title="Notifications" sub="Manage alerts for events" action={<Text style={styles.actionText}>On</Text>} />
                    <SettingsItem icon="shield-lock-outline" title="Privacy" sub="Visibility and data control" showChevron />
                </View>

                <Text style={styles.footerText}>EventBuddy v1.0.4</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

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
    <TouchableOpacity style={styles.settingsRow} activeOpacity={0.7}>
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
    container: { flex: 1, backgroundColor: COLORS.surface },
    scrollContent: { paddingBottom: 40, paddingHorizontal: 20 },
    topActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 30 },
    topTitle: { fontSize: 28, fontWeight: "900", color: COLORS.onSurface, letterSpacing: -0.5 },
    logoutBtn: { padding: 10, backgroundColor: COLORS.white, borderRadius: 14, elevation: 2 },
    profileHeader: { alignItems: "center", marginBottom: 30 },
    avatarWrapper: { position: "relative", marginBottom: 16 },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 35,
        backgroundColor: COLORS.primary,
        justifyContent: "center",
        alignItems: "center",
        elevation: 10,
        overflow: "hidden"
    },
    avatarImage: { width: "100%", height: "100%", resizeMode: "cover" },
    avatarText: { fontSize: 40, fontWeight: "bold", color: COLORS.white },
    editFab: { position: "absolute", bottom: -5, right: -5, backgroundColor: COLORS.primary, padding: 8, borderRadius: 12, borderWidth: 3, borderColor: COLORS.surface },
    nameText: { fontSize: 24, fontWeight: "800", color: COLORS.onSurface },
    emailText: { fontSize: 14, color: COLORS.outline, marginTop: 4, fontWeight: "500" },
    statsContainer: { gap: 12, marginBottom: 30 },
    statsRow: { flexDirection: "row", gap: 12 },
    statCard: { flex: 1, backgroundColor: COLORS.white, padding: 16, borderRadius: 24, alignItems: "center", elevation: 3 },
    iconCircle: { padding: 10, borderRadius: 16, marginBottom: 8 },
    statValue: { fontSize: 22, fontWeight: "900", color: COLORS.onSurface },
    statLabel: { fontSize: 12, color: COLORS.outline, marginTop: 2, fontWeight: "600" },
    settingsSection: { backgroundColor: COLORS.white, borderRadius: 28, padding: 12, elevation: 3 },
    sectionLabel: { fontSize: 12, fontWeight: "800", color: COLORS.primary, marginLeft: 12, marginVertical: 10, textTransform: "uppercase", letterSpacing: 1.2 },
    settingsRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 20 },
    settingsIconBg: { padding: 10, backgroundColor: COLORS.primaryContainer, borderRadius: 14, marginRight: 15 },
    settingsTextContent: { flex: 1 },
    settingsTitle: { fontSize: 16, fontWeight: "700", color: COLORS.onSurface },
    settingsSubText: { fontSize: 12, color: COLORS.outline, fontWeight: "500" },
    actionText: { color: COLORS.primary, fontWeight: "800" },
    footerText: { textAlign: "center", marginTop: 25, color: COLORS.outline, fontSize: 11, fontWeight: "600" },
});