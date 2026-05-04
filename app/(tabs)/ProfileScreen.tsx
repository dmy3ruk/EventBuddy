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
import {
    doc,
    onSnapshot,
    collection,
    updateDoc,
    getDoc,
    query,
    where
} from "firebase/firestore";
import * as ImagePicker from 'expo-image-picker';

import {
    subscribeToOwnerEvents,
    subscribeToInvitedEvents,
    calculateProfileStats,
} from "../../utils/firestoreService";
import { EventFull } from "../../utils/types";
import {useNavigation} from "@react-navigation/native";
import {white} from "colorette";

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
    // 1. СТАН (States)
    const [currentUid, setCurrentUid] = useState<string | null>(null);
    const [email, setEmail] = useState<string | null>(null);
    const [username, setUsername] = useState<string>("");
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    const [ownerEvents, setOwnerEvents] = useState<EventFull[]>([]);
    const [invitedEvents, setInvitedEvents] = useState<EventFull[]>([]);
    const [upcomingCount, setUpcomingCount] = useState(0);
    const [totalAttendees, setTotalAttendees] = useState(0);
    const [friendsConected, setFriendsConected] = useState(0);

    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        if (!currentUid) return;

        getDoc(doc(db, "users", currentUid)).then((snap) => {
            if (snap.exists() && snap.data().role === "admin") {
                setIsAdmin(true);
            }
        });
    }, [currentUid]);

    const navigation = useNavigation<any>();
    // 2. ЕФЕКТ: Слухаємо зміну стану авторизації
    useEffect(() => {
        const unsubscribeAuth = getAuth().onAuthStateChanged((u) => {
            if (!u) {
                router.replace("/SignIn");
                return;
            }
            setCurrentUid(u.uid);
            setEmail(u.email);
        });
        return () => unsubscribeAuth();
    }, []);

    // 3. ЕФЕКТ: Завантаження даних (тільки коли currentUid вже є)
    useEffect(() => {
        if (!currentUid) return; // Чекаємо, поки з'явиться UID

        // Завантаження профілю
        getDoc(doc(db, "usernames", currentUid)).then((snap) => {
            if (snap.exists()) {
                setUsername(snap.data().username || "No username");
                setAvatarUrl(snap.data().avatarUrl || null);
            }
        }).catch(err => console.error("Profile load error:", err));

        // Підписки на події
        const unsubOwner = subscribeToOwnerEvents(currentUid, (evs) => setOwnerEvents(evs as EventFull[]));
        const unsubInvited = subscribeToInvitedEvents(currentUid, (evs) => setInvitedEvents(evs as EventFull[]));

        // Підписка на друзів (нова логіка через userA/userB)
        const friendsListRef = collection(db, "friends", currentUid, "list");

        const unsubFriends = onSnapshot(
            friendsListRef,
            (snap) => {
                setFriendsConected(snap.size);
            },
            (err) => console.log("Friends error:", err)
        );

        return () => {
            unsubOwner();
            unsubInvited();
            unsubFriends();
        };
    }, [currentUid]);

    // 4. ЕФЕКТ: Розрахунок статистики
    useEffect(() => {
        if (!currentUid) return;
        const stats = calculateProfileStats(ownerEvents, invitedEvents, currentUid);
        setUpcomingCount(stats.upcomingCount);
        setTotalAttendees(stats.totalAttendees);
    }, [ownerEvents, invitedEvents, currentUid]);

    // --- ФУНКЦІЇ ---

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

        if (!result.canceled && currentUid) {
            handleUpload(result.assets[0].uri);
        }
    };

    const handleUpload = async (uri: string) => {
        if (!currentUid) return;
        setUploading(true);
        // ... ваша логіка Cloudinary ...
        setUploading(false);
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

                <View style={styles.avatarWrapper}>
                    <View style={styles.avatar}>
                        {uploading ? (
                            <ActivityIndicator color={COLORS.white} />
                        ) : avatarUrl ? (
                            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                        ) : (
                            <Text style={styles.avatarText}>
                                {username ? username[0]?.toUpperCase() : "A"}
                            </Text>
                        )}
                    </View>

                    {/* ✏️ кнопка редагування */}
                    <TouchableOpacity style={styles.editIcon} onPress={pickImage}>
                        <Ionicons name="pencil" size={16} color="#fff" />
                    </TouchableOpacity>
                </View>

                <View style={styles.statsContainer}>
                    <View style={styles.statsRow}>
                        <StatCard label="Events" value={ownerEvents.length} icon="calendar-star" color={COLORS.primary} />
                        <StatCard label="Attended" value={totalAttendees} icon="check-decagram" color="#16A34A" />
                    </View>
                    <View style={styles.statsRow}>
                        <StatCard label="Friends" value={friendsConected} icon="account-group" color="#0EA5E9" />
                        <StatCard label="Upcoming" value={upcomingCount} icon="clock-fast" color="#F59E0B" />
                    </View>
                </View>
                {isAdmin && (
                    <TouchableOpacity
                        style={styles.button}
                        onPress={() => navigation.navigate("Admin")}
                    >
                        <Text style={styles.text}>Admin Panel</Text>
                    </TouchableOpacity>
                )}
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

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.surface },
    scrollContent: { paddingBottom: 40, paddingHorizontal: 20 },
    topActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 20, marginBottom: 30 },
    topTitle: { fontSize: 28, fontWeight: "900", color: COLORS.onSurface },
    logoutBtn: { padding: 10, backgroundColor: COLORS.white, borderRadius: 14, elevation: 2 },
    profileHeader: { alignItems: "center", marginBottom: 30 },
    avatarWrapper: {
        position: "relative",
        marginBottom: 16,
        width: 100,
        height: 100,
        alignSelf: "center",
    },
    avatar: { width: 100, height: 100, borderRadius: 35, backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center" },
    avatarImage: { width: "100%", height: "100%", borderRadius: 35 },
    avatarText: { fontSize: 40, fontWeight: "bold", color: COLORS.white },
    nameText: { fontSize: 24, fontWeight: "800", color: COLORS.onSurface },
    emailText: { fontSize: 14, color: COLORS.outline, marginTop: 4 },
    statsContainer: { gap: 12 },
    statsRow: { flexDirection: "row", gap: 12 },
    statCard: { flex: 1, backgroundColor: COLORS.white, padding: 16, borderRadius: 24, alignItems: "center", elevation: 3 },
    iconCircle: { padding: 10, borderRadius: 16, marginBottom: 8 },
    statValue: { fontSize: 22, fontWeight: "900" },
    statLabel: { fontSize: 12, color: COLORS.outline },
    button: {
        backgroundColor: '#007bff',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    text: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    editIcon: {
        position: "absolute",
        bottom: -2,
        right: -4,
        backgroundColor: "#505BEB",
        width: 30,
        height: 30,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
        elevation: 4,

        // 👇 робить вигляд як в Instagram
        borderWidth: 2,
        borderColor: "#fff",
    },
});