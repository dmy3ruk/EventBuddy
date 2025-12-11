import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { getAuth } from "firebase/auth";
import { router } from "expo-router";
import { auth } from "../../FirebaseConfig";

import {
    fetchUsername,
    subscribeToOwnerEvents,
    subscribeToInvitedEvents,
    calculateProfileStats,
} from "../../utils/firestoreHelpers";

type EventType = {
    id: string;
    date?: string;              // "YYYY-MM-DD"
    acceptedUserIds?: string[];
    invitedUserIds?: string[];
    [key: string]: any;
};

export default function ProfileScreen() {
    const [modalVisible, setModalVisible] = useState(false);
    const [username, setUsername] = useState<string>("");

    const [ownerEvents, setOwnerEvents] = useState<EventType[]>([]);
    const [invitedEvents, setInvitedEvents] = useState<EventType[]>([]);

    const [upcomingCount, setUpcomingCount] = useState(0);
    const [pendingInvitesCount, setPendingInvitesCount] = useState(0);
    const [totalAttendees, setTotalAttendees] = useState(0);

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

    // перерахунок статистики при зміні списків подій
    useEffect(() => {
        const uid = getAuth().currentUser?.uid;
        if (!uid) return;

        const stats = calculateProfileStats(ownerEvents, invitedEvents, uid);

        setUpcomingCount(stats.upcomingCount);
        setPendingInvitesCount(stats.pendingInvitesCount);
        setTotalAttendees(stats.totalAttendees);
    }, [ownerEvents, invitedEvents]);

    const handleLogout = async () => {
        try {
            await auth.signOut();
            setModalVisible(false);
        } catch (e) {
            console.log("Logout error", e);
        }
    };

    return (
        <View style={styles.container}>
            {/* кнопка налаштувань */}
            <View
                style={{
                    backgroundColor: "#fff",
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    borderWidth: 0.5,
                    borderColor: "#E5E7EB",
                    justifyContent: "center",
                    alignItems: "center",
                    position: "absolute",
                    right: 15,
                    top: 60,
                }}
            >
                <TouchableOpacity onPress={() => setModalVisible(true)}>
                    <Image
                        source={require("../../assets/images/Setting.svg")}
                        style={{
                            width: 24,
                            height: 24,
                        }}
                    />
                </TouchableOpacity>
            </View>

            {/* Modal Screen */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity
                            style={[styles.closeBtn, { marginBottom: 12 }]}
                            onPress={handleLogout}
                        >
                            <Text style={{ color: "#fff" }}>Log Out</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.closeBtn}
                            onPress={() => setModalVisible(false)}
                        >
                            <Text style={{ color: "#fff" }}>Закрити</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Profile */}
            <View style={styles.header}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {username ? username[0]?.toUpperCase() : "A"}
                    </Text>
                </View>
                <Text style={styles.username}>{username}</Text>
                <Text style={styles.handle}>@{username}</Text>
            </View>

            {/* Cards */}
            <View style={styles.cards}>
                <View style={styles.card}>
                    <View style={styles.cardName}>
                        <Image
                            source={require("../../assets/images/arrow.svg")}
                            style={{ width: 40, height: 40 }}
                        />
                        <Text style={styles.cardTitle}>Upcoming Events</Text>
                    </View>
                    <Text style={styles.cardNumber}>{upcomingCount}</Text>
                    <Text style={styles.cardSub}>Events this month</Text>
                </View>

                <View style={styles.card}>
                    <View style={styles.cardName}>
                        <Image
                            source={require("../../assets/images/mail.svg")}
                            style={{ width: 40, height: 40 }}
                        />
                        <Text style={styles.cardTitle}>Pending Invites</Text>
                    </View>
                    <Text style={styles.cardNumber}>{pendingInvitesCount}</Text>
                    <Text style={styles.cardSub}>Awaiting response</Text>
                </View>

                <View style={[styles.card, styles.cardFull]}>
                    <View style={styles.cardName}>
                        <Image
                            source={require("../../assets/images/group.svg")}
                            style={{ width: 40, height: 40 }}
                        />
                        <Text style={styles.cardTitle}>Total Attendees</Text>
                    </View>
                    <Text style={styles.cardNumber}>{totalAttendees}</Text>
                    <Text style={styles.cardSub}>Across all events</Text>
                </View>
            </View>

            {/* List */}
            <View style={styles.list}>
                <TouchableOpacity
                    style={styles.listItem}
                    onPress={() => {
                        // router.push("/LastEvents");
                    }}
                >
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <Image
                            source={require("../../assets/images/time.svg")}
                            style={{ width: 24, height: 24 }}
                        />
                        <Text style={styles.listText}>Last events</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.listItem}
                    onPress={() => {
                        // router.push("/CreatedByMe");
                    }}
                >
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <Image
                            source={require("../../assets/images/Award 3.svg")}
                            style={{ width: 24, height: 24 }}
                        />
                        <Text style={styles.listText}>Created by me</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.listItem}
                    onPress={() => {
                        // router.push("/Participant");
                    }}
                >
                    <View
                        style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <Image
                            source={require("../../assets/images/Group 1.svg")}
                            style={{ width: 24, height: 24 }}
                        />
                        <Text style={styles.listText}>Participant</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F9F9F9",
        alignItems: "center",
    },
    header: {
        alignItems: "center",
        marginTop: 40,
    },
    avatar: {
        marginTop: 50,
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: "#EB7C50",
        justifyContent: "center",
        alignItems: "center",
    },
    avatarText: {
        color: "#fff",
        fontSize: 36,
        fontWeight: "600",
    },
    username: {
        marginTop: 12,
        fontSize: 20,
        fontWeight: "600",
        color: "#000",
    },
    handle: {
        fontSize: 14,
        color: "#666",
    },
    cards: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        width: "90%",
        marginTop: 24,
        gap: 4,
    },
    card: {
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 16,
        padding: 16,
        width: "49%",
        height: "auto",
        alignItems: "center",
        marginBottom: 4,
    },
    cardFull: {
        width: "100%",
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 4,
        color: "black",
        flexShrink: 1,
    },
    cardNumber: {
        fontSize: 24,
        fontWeight: "700",
        color: "#000",
    },
    cardSub: {
        fontSize: 12,
        color: "#666",
    },
    list: {
        marginTop: 24,
        width: "90%",
    },
    listItem: {
        backgroundColor: "#fff",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        paddingVertical: 12,
        paddingHorizontal: 12,
        marginBottom: 8,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    listText: {
        fontSize: 16,
        color: "#000",
    },
    cardName: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
    },
    modalContent: {
        width: "80%",
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 20,
        alignItems: "center",
    },
    closeBtn: {
        backgroundColor: "#505AEB",
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
});
