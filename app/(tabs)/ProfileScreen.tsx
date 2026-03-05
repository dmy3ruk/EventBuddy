import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { getAuth } from "firebase/auth";
import { router } from "expo-router";
import {auth, db} from "../../FirebaseConfig";

import {
    fetchUsername,
    subscribeToOwnerEvents,
    subscribeToInvitedEvents,
    calculateProfileStats,
} from "../../utils/firestoreHelpers";
import { EventType } from "../../utils/types";
import { ScrollView } from "react-native";
import {doc, onSnapshot} from "firebase/firestore";

export default function ProfileScreen() {
    const [modalVisible, setModalVisible] = useState(false);
    const [username, setUsername] = useState<string>("");

    const [ownerEvents, setOwnerEvents] = useState<EventType[]>([]);
    const [invitedEvents, setInvitedEvents] = useState<EventType[]>([]);

    const [upcomingCount, setUpcomingCount] = useState(0);
    const [pendingInvitesCount, setPendingInvitesCount] = useState(0);
    const [totalAttendees, setTotalAttendees] = useState(0);
    const [friendsConected, setFriendsConected ]= useState(0);
    const uid = getAuth().currentUser?.uid;
    const email = getAuth().currentUser?.email;

    // завантаження username через хелпер
    useEffect(() => {
        const loadUsername = async () => {
            const name = await fetchUsername();
            if (name) {
                setUsername(name);
            } else {
                setUsername("No username");
            }
        };

        loadUsername();
    }, []);

    // сторож аутентифікації
    useEffect(() => {
        const unsubscribe = getAuth().onAuthStateChanged((user) => {
            if (!user) {
                router.replace("/SignIn");
            }
        });

        return unsubscribe;
    }, []);

    // підписка на події, створені мною
    useEffect(() => {
        const unsubscribeOwner = subscribeToOwnerEvents((events) => {
            setOwnerEvents(events as EventType[]);
        });

        return unsubscribeOwner;
    }, []);

    // підписка на події, куди мене запросили
    useEffect(() => {
        const unsubscribeInvited = subscribeToInvitedEvents((events) => {
            setInvitedEvents(events as EventType[]);
        });

        return unsubscribeInvited;
    }, []);

    useEffect(() => {
        if (!uid) return;

        const unsubscribeFriends = onSnapshot(doc(db, "users", uid), (docSnap) => {
            if (docSnap.exists()) {
                const friends = docSnap.data().friends || [];
                setFriendsConected(friends.length);
            }
        });

        return unsubscribeFriends();
    }, []);


    // перерахунок статистики при зміні списків подій
    useEffect(() => {
        if (!uid) return;

        const stats = calculateProfileStats(ownerEvents, invitedEvents, uid);

        setUpcomingCount(stats.upcomingCount);
        setPendingInvitesCount(stats.pendingInvitesCount);
        setTotalAttendees(stats.totalAttendees);
    }, [ownerEvents, invitedEvents]);

    const handleLogout = async () => {
        try {
            await auth.signOut();
            router.replace("/SignIn");
        } catch (e) {
            console.log("Logout error", e);
        }
    };


    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
        >


        {/* Profile Card */}
            <View style={styles.profileCard}>
                <View style={styles.avatarWrapper}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {username ? username[0]?.toUpperCase() : "A"}
                        </Text>
                    </View>

                    <TouchableOpacity style={styles.editIcon}>
                        <Ionicons name="pencil" size={14} color="#fff" />
                    </TouchableOpacity>
                </View>

                <View style={styles.description}>
                    <Text style={styles.name}>{username}</Text>
                    <Text style={styles.email}>{email}</Text>
                </View>
            </View>

            {/* Statistics */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Statistics</Text>
                <View style={styles.statsGrid}>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{ownerEvents.length}</Text>
                        <Text style={styles.statLabel}>Events Created</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{totalAttendees}</Text>
                        <Text style={styles.statLabel}>Events Attended</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{friendsConected}</Text>
                        <Text style={styles.statLabel}>Friends Connected</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statNumber}>{upcomingCount}</Text>
                        <Text style={styles.statLabel}>Upcoming Events</Text>
                    </View>
                </View>
            </View>

            {/* Account Settings */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Account Settings</Text>

                <View style={styles.settingsItem}>
                    <Image
                        source={require("../../assets/images/notif.svg")}
                        style={{ width: 40, height: 40, marginRight:8 }}
                        contentFit="contain"
                    />
                    <View style={styles.settingsText}>
                        <Text style={styles.settingsTitle}>Notifications</Text>
                        <Text style={styles.settingsSub}>Manage your notification preferences</Text>
                    </View>
                    <Text style={styles.link}>Configure</Text>
                </View>

                <View style={styles.settingsItem}>
                    <Image
                        source={require("../../assets/images/settings.svg")}
                        style={{ width: 40, height: 40, marginRight:8 }}
                        contentFit="contain"
                    />
                    <View style={styles.settingsText}>
                        <Text style={styles.settingsTitle}>Privacy Settings</Text>
                        <Text style={styles.settingsSub}>Control who can see your profile</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#999" />
                </View>

                {/*<View style={styles.settingsItem}>*/}
                {/*    <Image*/}
                {/*        source={require("../../assets/images/verification.svg")}*/}
                {/*        style={{ width: 40, height: 40, marginRight:8 }}*/}
                {/*        contentFit="contain"*/}
                {/*    />*/}
                {/*    <View style={styles.settingsText}>*/}
                {/*        <Text style={styles.settingsTitle}>Account Verification</Text>*/}
                {/*        <Text style={styles.settingsSub}>Verify your account for added security</Text>*/}
                {/*    </View>*/}
                {/*    <View style={styles.verifiedBadge}>*/}
                {/*        <Text style={styles.verifiedText}>Verified</Text>*/}
                {/*    </View>*/}
                {/*</View>*/}

                <TouchableOpacity style={[styles.settingsItem, { marginBottom: 12 }]} onPress={handleLogout}>
                    <Image
                        source={require("../../assets/images/signout.png")}
                        style={{ width: 40, height: 40, marginRight:8 }}
                        contentFit="contain"
                    />
                    <View style={styles.settingsText}>
                        <Text style={[styles.settingsTitle, { color: "#EF4444" }]}>
                            Sign Out
                        </Text>
                        <Text style={styles.settingsSub}>Sign out of your account</Text>
                </View>

                </TouchableOpacity>
            </View>

            <Text style={styles.memberSince}>Member since March 2023</Text>
        </ScrollView>
    );

}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F5F6FA",
    },

    scrollContent: {
        alignItems: "center",
        paddingBottom: 40,
    },

    /* ===== PROFILE CARD ===== */
    profileCard: {
        marginTop:80,
        marginBottom: 0,
        width: "95%",
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 20,
        alignItems: "center",
    },

    avatarWrapper: {
        position: "relative",
        marginBottom: 12,
        borderRadius: 60, // коло
        borderWidth: 4,
        borderColor: "#FFFFFF",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,

        // shadow (Android)
        elevation: 4,
    },

    description:{
        width: "50%",
        paddingVertical:8,
        alignItems:"center",
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        borderColor: "#E2E8F0",
        borderWidth:1,
        marginBottom:0
    },
    avatar: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: "#4CAF50",
        justifyContent: "center",
        alignItems: "center",
    },

    avatarText: {
        fontSize: 32,
        fontWeight: "700",
        color: "#FFFFFF",
    },

    editIcon: {
        position: "absolute",
        right: 0,
        bottom: 0,
        backgroundColor: "#4F46E5",
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: "center",
        alignItems: "center",
    },

    name: {
        fontSize: 20,
        fontWeight: "600",
        color: "#111827",
        marginTop: 6,
    },

    email: {
        fontSize: 14,
        color: "#6B7280",
        marginTop: 4,
    },

    location: {
        fontSize: 13,
        color: "#9CA3AF",
        marginTop: 2,
    },

    bio: {
        marginTop: 12,
        fontSize: 14,
        color: "#6B7280",
        textAlign: "center",
        lineHeight: 20,
    },

    /* ===== SECTIONS ===== */
    section: {
        width: "95%",
        marginTop: 12,
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        borderColor: "#E2E8F0",
        borderWidth:1
    },

    sectionTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#111827",
        marginLeft:20,
        marginTop:25,
        marginBottom:8,
    },

    /* ===== STATISTICS ===== */
    statsGrid: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        flexDirection: "row",
        flexWrap: "wrap",
        paddingVertical: 16,
    },

    statItem: {
        width: "50%",
        alignItems: "center",
        marginVertical: 12,
    },

    statNumber: {
        fontSize: 22,
        fontWeight: "700",
        color: "#4F46E5",
    },

    statLabel: {
        marginTop: 4,
        fontSize: 13,
        color: "#6B7280",
    },

    /* ===== ACCOUNT SETTINGS ===== */
    settingsItem: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 14,
        marginBottom: 0,
    },

    settingsText: {
        flex: 1,
        marginLeft: 12,
    },

    settingsTitle: {
        fontSize: 15,
        fontWeight: "500",
        color: "#111827",
    },

    settingsSub: {
        fontSize: 12,
        color: "#6B7280",
        marginTop: 2,
    },

    link: {
        fontSize: 13,
        fontWeight: "500",
        color: "#4F46E5",
    },

    verifiedBadge: {
        backgroundColor: "#22C55E",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },

    verifiedText: {
        color: "#FFFFFF",
        fontSize: 12,
        fontWeight: "500",
    },

    /* ===== MEMBER SINCE ===== */
    memberSince: {
        marginTop: 14,
        fontSize: 12,
        color: "#9CA3AF",
    },
});
