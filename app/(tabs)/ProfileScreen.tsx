import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image, Switch, Modal, TextInput,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { getAuth } from "firebase/auth";
import { router } from "expo-router";
import { auth, db } from "../../FirebaseConfig";
import { SafeAreaView } from "react-native-safe-area-context";
import { doc, onSnapshot, collection, updateDoc, getDoc, setDoc, deleteDoc, query, where, getDocs,
} from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import { subscribeToOwnerEvents, subscribeToInvitedEvents, calculateProfileStats,
} from "../../utils/firestoreService";
import { EventFull } from "../../utils/types";
import { useNavigation } from "@react-navigation/native";
import { getBadges } from "@/utils/badges";

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
    const [currentUid, setCurrentUid] = useState<string | null>(null);
    const [email, setEmail] = useState<string | null>(null);
    const [username, setUsername] = useState<string>("");
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [isUsernameModalVisible, setIsUsernameModalVisible] = useState(false);
    const [newUsername, setNewUsername] = useState("");
    const [usernameError, setUsernameError] = useState("");
    const [isCheckingUsername, setIsCheckingUsername] = useState(false);
    const [savingUsername, setSavingUsername] = useState(false);
    const [ownerEvents, setOwnerEvents] = useState<EventFull[]>([]);
    const [invitedEvents, setInvitedEvents] = useState<EventFull[]>([]);
    const [upcomingCount, setUpcomingCount] = useState(0);
    const [totalAttendees, setTotalAttendees] = useState(0);
    const [friendsConected, setFriendsConected] = useState(0);
    const [isAdmin, setIsAdmin] = useState(false);
    const [eventNotifications, setEventNotifications] = useState(true);
    const [defaultPrivateEvent, setDefaultPrivateEvent] = useState(false);
    const [reminderMinutes, setReminderMinutes] = useState(60);
    const [autoJoinChat, setAutoJoinChat] = useState(true);

    const navigation = useNavigation<any>();

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

    useEffect(() => {
        if (!currentUid) return;

        getDoc(doc(db, "users", currentUid)).then((snap) => {
            if (snap.exists() && snap.data().role === "admin") {
                setIsAdmin(true);
            }
        });
    }, [currentUid]);

    useEffect(() => {
        if (!currentUid) return;

        getDoc(doc(db, "users", currentUid))
            .then((snap) => {
                if (snap.exists()) {
                    const data = snap.data();

                    setUsername(data.username || "No username");
                    setAvatarUrl(data.avatarUrl || null);

                    setEventNotifications(data.eventNotifications ?? true);
                    setDefaultPrivateEvent(data.defaultPrivateEvent ?? false);
                    setReminderMinutes(data.reminderMinutes ?? 60);
                    setAutoJoinChat(data.autoJoinChat ?? true);
                }
            })
            .catch((err) => console.error("Profile load error:", err));

        const unsubOwner = subscribeToOwnerEvents(currentUid, (evs) =>
            setOwnerEvents(evs as EventFull[])
        );

        const unsubInvited = subscribeToInvitedEvents(currentUid, (evs) =>
            setInvitedEvents(evs as EventFull[])
        );

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

    useEffect(() => {
        if (!currentUid) return;

        const stats = calculateProfileStats(ownerEvents, invitedEvents, currentUid);

        setUpcomingCount(stats.upcomingCount);
        setTotalAttendees(stats.totalAttendees);
    }, [ownerEvents, invitedEvents, currentUid]);

    // Ефект дебаунсу для перевірки унікальності нікнейму
    useEffect(() => {
        if (!newUsername.trim()) {
            setUsernameError("");
            return;
        }

        const trimName = newUsername.trim();

        // Якщо користувач ввів свій же поточний нікнейм — не сваримось
        if (trimName.toLowerCase() === username.toLowerCase()) {
            setUsernameError("");
            return;
        }

        if (trimName.length < 2) {
            setUsernameError("Minimum 2 characters");
            return;
        }

        if (!/^[a-zA-Zа-яА-ЯіІїЇєЄ0-9_]+$/.test(trimName)) {
            setUsernameError("Only letters, numbers, and _ allowed");
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setIsCheckingUsername(true);
            try {
                const q = query(
                    collection(db, "usernames"),
                    where("usernameLower", "==", trimName.toLowerCase())
                );
                const snap = await getDocs(q);

                if (!snap.empty) {
                    setUsernameError("This username is already taken");
                } else {
                    setUsernameError("");
                }
            } catch (err) {
                console.error("Error checking username:", err);
            } finally {
                setIsCheckingUsername(false);
            }
        }, 600);

        return () => clearTimeout(delayDebounceFn);
    }, [newUsername, username]);

    const allEvents = useMemo(() => {
        return [...ownerEvents, ...invitedEvents];
    }, [ownerEvents, invitedEvents]);

    const nextEvent = useMemo(() => {
        const now = new Date();

        return allEvents
            .filter((event) => {
                if (!event.date) return false;
                const eventDate = new Date(event.date);
                return eventDate >= now;
            })
            .sort(
                (a, b) =>
                    new Date(a.date).getTime() - new Date(b.date).getTime()
            )[0];
    }, [allEvents]);

    const badges = getBadges({
        ownerEventsCount: ownerEvents.length,
        friendsCount: friendsConected,
        totalAttendees,
    });

    const reminderTimeLabel =
        reminderMinutes === 1
            ? "1 minute"
            : reminderMinutes === 15
                ? "15 minutes"
                : reminderMinutes === 60
                    ? "1 hour"
                    : "1 day";

    const openEditUsername = () => {
        setNewUsername(username);
        setUsernameError("");
        setIsUsernameModalVisible(true);
    };

    const handleSaveUsername = async () => {
        if (!currentUid || usernameError || isCheckingUsername) return;

        const finalName = newUsername.trim();
        if (!finalName) {
            setUsernameError("Username cannot be empty");
            return;
        }

        if (finalName.toLowerCase() === username.toLowerCase()) {
            setIsUsernameModalVisible(false);
            return;
        }

        setSavingUsername(true);

        try {
            // 1. Займаємо новий нікнейм першим (якщо вже зайнятий — впадемо тут)
            await setDoc(doc(db, "usernames", finalName.toLowerCase()), {
                uid: currentUid,
                usernameLower: finalName.toLowerCase(),
            });

            // 2. Оновлюємо документ користувача
            await updateDoc(doc(db, "users", currentUid), {
                username: finalName,
                usernameLower: finalName.toLowerCase(),
            });

            // 3. Звільняємо старий нікнейм
            if (username && username !== "No username") {
                try {
                    const oldRef = doc(db, "usernames", username.toLowerCase());
                    const oldSnap = await getDoc(oldRef);
                    if (oldSnap.exists() && oldSnap.data().uid === currentUid) {
                        await deleteDoc(oldRef);
                    }
                } catch (err) {
                    console.warn("Could not delete old username doc:", err);
                }
            }

            // 4. Оновлюємо нікнейм у списках друзів
            try {
                const friendsSnap = await getDocs(
                    collection(db, "friends", currentUid, "list")
                );
                const friendUpdates = friendsSnap.docs.map((friendDoc) =>
                    updateDoc(
                        doc(db, "friends", friendDoc.id, "list", currentUid),
                        { username: finalName }
                    )
                );
                await Promise.all(friendUpdates);
            } catch (err) {
                console.warn("Could not update username in friends lists:", err);
            }

            // 5. Оновлюємо нікнейм у відправлених запитах дружби
            try {
                const sentSnap = await getDocs(
                    query(
                        collection(db, "friendRequests"),
                        where("fromUid", "==", currentUid)
                    )
                );
                const sentUpdates = sentSnap.docs.map((d) =>
                    updateDoc(doc(db, "friendRequests", d.id), {
                        fromUsername: finalName,
                    })
                );
                await Promise.all(sentUpdates);
            } catch (err) {
                console.warn("Could not update pending requests:", err);
            }

            setUsername(finalName);
            setIsUsernameModalVisible(false);
            Alert.alert("Success", "Username updated successfully!");
        } catch (error: any) {
            console.error("Save username error:", error);
            Alert.alert("Error", "Failed to update username: " + error.message);
        } finally {
            setSavingUsername(false);
        }
    };

    const updateSetting = async (
        key: "eventNotifications" | "defaultPrivateEvent" | "autoJoinChat",
        value: boolean
    ) => {
        if (!currentUid) return;

        const oldEventNotifications = eventNotifications;
        const oldDefaultPrivateEvent = defaultPrivateEvent;
        const oldAutoJoinChat = autoJoinChat;

        if (key === "eventNotifications") setEventNotifications(value);
        if (key === "defaultPrivateEvent") setDefaultPrivateEvent(value);
        if (key === "autoJoinChat") setAutoJoinChat(value);

        try {
            await updateDoc(doc(db, "users", currentUid), {
                [key]: value,
            });
        } catch (error) {
            console.error("Settings update error:", error);

            setEventNotifications(oldEventNotifications);
            setDefaultPrivateEvent(oldDefaultPrivateEvent);
            setAutoJoinChat(oldAutoJoinChat);

            Alert.alert("Помилка", "Не вдалося оновити налаштування");
        }
    };

    const saveReminderTime = async (minutes: number) => {
        if (!currentUid) return;

        const oldReminderMinutes = reminderMinutes;
        setReminderMinutes(minutes);

        try {
            await updateDoc(doc(db, "users", currentUid), {
                reminderMinutes: minutes,
            });
        } catch (error) {
            console.error("Reminder time update error:", error);

            setReminderMinutes(oldReminderMinutes);

            Alert.alert("Помилка", "Не вдалося оновити час нагадування");
        }
    };

    const changeReminderTime = () => {
        Alert.alert(
            "Reminder time",
            "Choose when you want to be reminded",
            [
                { text: "1 minute", onPress: () => saveReminderTime(1) },
                { text: "1 hour", onPress: () => saveReminderTime(60) },
                { text: "1 day", onPress: () => saveReminderTime(1440) },
                { text: "Cancel", style: "cancel" },
            ]
        );
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== "granted") {
            Alert.alert("Error", "Permissions needed.");
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

        // Беремо твої змінні оточення (перевір, щоб назви в .env збігалися)
        const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
        const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

        if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
            Alert.alert("Error", "Cloudinary env variables are missing in ProfileScreen");
            return;
        }

        setUploading(true);

        try {
            // Створюємо FormData для відправки бінарного файлу в Cloudinary
            const data = new FormData();
            data.append("file", {
                uri: uri,
                name: `avatar_${currentUid}.jpg`,
                type: "image/jpeg",
            } as any);
            data.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

            console.log("⏳ [Profile] Uploading image to Cloudinary...");

            // Робимо fetch-запит до Cloudinary API
            const res = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
                {
                    method: "POST",
                    body: data,
                }
            );

            const json = await res.json();

            if (!res.ok) {
                console.error("🔴 Cloudinary profile upload error:", json);
                Alert.alert("Error", "Failed to upload image to Cloudinary");
                return;
            }

            // Оптимізуємо посилання під аватарку (авто-формат, авто-якість, розмір 400х400 з обрізкою по центру)
            const secureUrl = json.secure_url.replace(
                "/upload/",
                "/upload/f_auto,q_auto,w_400,h_400,c_fill/"
            );

            console.log("🍏 [Profile] Cloudinary URL received:", secureUrl);

            // ЗБЕРІГАЄМО САМЕ ЦЕ HTTPS ПОСИЛАННЯ В FIRESTORE
            await updateDoc(doc(db, "users", currentUid), {
                avatarUrl: secureUrl,
            });

            setAvatarUrl(secureUrl);
            Alert.alert("Success", "Avatar updated successfully!");
        } catch (error) {
            console.error("🔴 Profile upload handler error:", error);
            Alert.alert("Error", "Failed to upload avatar");
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
        <SafeAreaView style={styles.container} edges={["top"]}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                <View style={styles.topActions}>
                    <Text style={styles.topTitle}>Profile</Text>

                    <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                        <MaterialCommunityIcons
                            name="logout-variant"
                            size={22}
                            color={COLORS.error}
                        />
                    </TouchableOpacity>
                </View>

                <View style={styles.profileCard}>
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

                        <TouchableOpacity style={styles.editIcon} onPress={pickImage}>
                            <Ionicons name="pencil" size={16} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {/* Тепер клік на ім'я теж відкриває редагування */}
                    <TouchableOpacity style={styles.usernameRow} onPress={openEditUsername}>
                        <Text style={styles.nameText}>{username}</Text>
                        <Ionicons name="create-outline" size={18} color={COLORS.outline} style={{ marginLeft: 6 }} />
                    </TouchableOpacity>

                    <Text style={styles.emailText}>{email}</Text>

                    <View style={styles.bioBox}>
                        <Text style={styles.bioText}>
                            ✨ Event lover • planning memories with friends
                        </Text>
                    </View>
                </View>

                <View style={styles.statsContainer}>
                    <View style={styles.statsRow}>
                        <StatCard
                            label="Events"
                            value={ownerEvents.length}
                            icon="calendar-star"
                            color={COLORS.primary}
                        />
                        <StatCard
                            label="Attended"
                            value={totalAttendees}
                            icon="check-decagram"
                            color="#16A34A"
                        />
                    </View>

                    <View style={styles.statsRow}>
                        <StatCard
                            label="Friends"
                            value={friendsConected}
                            icon="account-group"
                            color="#0EA5E9"
                        />
                        <StatCard
                            label="Upcoming"
                            value={upcomingCount}
                            icon="clock-fast"
                            color="#F59E0B"
                        />
                    </View>
                </View>

                {badges.length > 0 && (
                    <>
                        <SectionTitle title="Badges" />
                        <View style={styles.badgesRow}>
                            {badges.map((badge) => (
                                <View key={badge.title} style={styles.badgeCard}>
                                    <View style={[styles.badgeIcon, { backgroundColor: badge.color + "18" }]}>
                                        <MaterialCommunityIcons name={badge.icon as any} size={22} color={badge.color} />
                                    </View>
                                    <Text style={styles.badgeText}>{badge.title}</Text>
                                </View>
                            ))}
                        </View>
                    </>
                )}

                <SectionTitle title="Event Preferences" />

                <View style={styles.settingsCard}>
                    <SettingRow
                        icon="notifications-outline"
                        title="Event reminders"
                        subtitle="Receive reminders before upcoming events"
                        value={eventNotifications}
                        onValueChange={(value) => updateSetting("eventNotifications", value)}
                    />

                    <View style={styles.divider} />

                    <TouchableOpacity
                        style={styles.settingsLink}
                        onPress={() => updateSetting("defaultPrivateEvent", !defaultPrivateEvent)}
                    >
                        <View style={styles.settingIconBox}>
                            <Ionicons name="lock-closed-outline" size={20} color={COLORS.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingTitle}>Default event type</Text>
                            <Text style={styles.settingSubtitle}>
                                {defaultPrivateEvent ? "Private events by default" : "Public events by default"}
                            </Text>
                        </View>
                        <Text style={styles.settingValue}>{defaultPrivateEvent ? "Private" : "Public"}</Text>
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    <TouchableOpacity style={styles.settingsLink} onPress={changeReminderTime}>
                        <View style={styles.settingIconBox}>
                            <Ionicons name="time-outline" size={20} color={COLORS.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.settingTitle}>Reminder time</Text>
                            <Text style={styles.settingSubtitle}>Notify me {reminderTimeLabel} before event</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={COLORS.outline} />
                    </TouchableOpacity>

                    <View style={styles.divider} />

                    <SettingRow
                        icon="chatbubble-ellipses-outline"
                        title="Auto-join event chat"
                        subtitle="Join the event chat automatically after accepting"
                        value={autoJoinChat}
                        onValueChange={(value) => updateSetting("autoJoinChat", value)}
                    />
                </View>

                {isAdmin && (
                    <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("Admin")}>
                        <Text style={styles.text}>Admin Panel</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            {/* --- СУЧАСНИЙ МОДАЛ ДЛЯ ЗМІНИ ЮЗЕРНЕЙМУ --- */}
            <Modal visible={isUsernameModalVisible} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalContainer}>
                        <Text style={styles.modalTitle}>Edit Username</Text>

                        <View style={styles.modalInputWrapper}>
                            <TextInput
                                style={[styles.modalInput, usernameError ? styles.modalInputError : null]}
                                value={newUsername}
                                onChangeText={setNewUsername}
                                placeholder="Enter username..."
                                placeholderTextColor="#94A3B8"
                                autoCapitalize="none"
                                autoCorrect={false}
                                maxLength={25}
                            />
                            {isCheckingUsername && (
                                <ActivityIndicator style={styles.modalInputLoader} color={COLORS.primary} size="small" />
                            )}
                        </View>

                        {usernameError ? (
                            <Text style={styles.modalErrorText}>{usernameError}</Text>
                        ) : (
                            <Text style={styles.modalHintText}>Only letters, numbers, and _ are allowed.</Text>
                        )}

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setIsUsernameModalVisible(false)}
                                disabled={savingUsername}
                            >
                                <Text style={styles.modalCancelBtnText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.modalSaveBtn,
                                    (!!usernameError || isCheckingUsername || savingUsername) && { opacity: 0.5 }
                                ]}
                                onPress={handleSaveUsername}
                                disabled={!!usernameError || isCheckingUsername || savingUsername}
                            >
                                {savingUsername ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.modalSaveBtnText}>Save</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const SectionTitle = ({ title }: { title: string }) => (
    <Text style={styles.sectionTitle}>{title}</Text>
);

const StatCard = ({ label, value, icon, color }: any) => (
    <View style={styles.statCard}>
        <View style={[styles.iconCircle, { backgroundColor: color + "15" }]}>
            <MaterialCommunityIcons name={icon} size={24} color={color} />
        </View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
);

const SettingRow = ({
                        icon,
                        title,
                        subtitle,
                        value,
                        onValueChange,
                    }: {
    icon: any;
    title: string;
    subtitle: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
}) => (
    <View style={styles.settingRow}>
        <View style={styles.settingIconBox}>
            <Ionicons name={icon} size={20} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={styles.settingTitle}>{title}</Text>
            <Text style={styles.settingSubtitle}>{subtitle}</Text>
        </View>
        <Switch
            value={value}
            onValueChange={onValueChange}
            trackColor={{ false: "#CBD5E1", true: "#C7D2FE" }}
            thumbColor={value ? COLORS.primary : "#F8FAFC"}
        />
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.surface },
    scrollContent: { paddingBottom: 40, paddingHorizontal: 20 },
    topActions: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 20,
        marginBottom: 20,
    },
    topTitle: { fontSize: 28, fontWeight: "900", color: COLORS.onSurface },
    logoutBtn: {
        padding: 10,
        backgroundColor: COLORS.white,
        borderRadius: 14,
        elevation: 2,
    },
    profileCard: {
        backgroundColor: COLORS.white,
        borderRadius: 28,
        paddingVertical: 24,
        paddingHorizontal: 18,
        alignItems: "center",
        marginBottom: 18,
        elevation: 3,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    avatarWrapper: {
        position: "relative",
        marginBottom: 16,
        width: 104,
        height: 104,
        alignSelf: "center",
    },
    avatar: {
        width: 104,
        height: 104,
        borderRadius: 52,
        backgroundColor: COLORS.primary,
        justifyContent: "center",
        alignItems: "center",
    },
    avatarImage: { width: "100%", height: "100%", borderRadius: 52 },
    avatarText: { fontSize: 40, fontWeight: "bold", color: COLORS.white },
    editIcon: {
        position: "absolute",
        bottom: -2,
        right: -4,
        backgroundColor: COLORS.primary,
        width: 32,
        height: 32,
        borderRadius: 11,
        justifyContent: "center",
        alignItems: "center",
        elevation: 4,
        borderWidth: 2,
        borderColor: "#fff",
    },
    usernameRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 4,
    },
    nameText: { fontSize: 22, fontWeight: "800", color: COLORS.onSurface },
    emailText: { fontSize: 13, color: COLORS.outline, marginTop: 4 },
    bioBox: {
        marginTop: 14,
        backgroundColor: COLORS.primaryContainer,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 18,
    },
    bioText: { fontSize: 13, color: COLORS.primary, fontWeight: "600", textAlign: "center" },
    statsContainer: { gap: 12 },
    statsRow: { flexDirection: "row", gap: 12 },
    statCard: {
        flex: 1,
        backgroundColor: COLORS.white,
        padding: 16,
        borderRadius: 24,
        elevation: 3,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 8,
        alignItems: "center",
    },
    iconCircle: { padding: 10, borderRadius: 16, marginBottom: 8 },
    statValue: { fontSize: 22, fontWeight: "900" },
    statLabel: { fontSize: 12, color: COLORS.outline },
    sectionTitle: { fontSize: 18, fontWeight: "800", color: COLORS.onSurface, marginTop: 24, marginBottom: 12 },
    badgesRow: { flexDirection: "row", gap: 10 },
    badgeCard: {
        flex: 1,
        backgroundColor: COLORS.white,
        borderRadius: 20,
        paddingVertical: 14,
        alignItems: "center",
        elevation: 2,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 6,
    },
    badgeIcon: { width: 42, height: 42, borderRadius: 16, justifyContent: "center", alignItems: "center", marginBottom: 8 },
    badgeText: { fontSize: 12, fontWeight: "700", color: COLORS.onSurface },
    settingsCard: {
        backgroundColor: COLORS.white,
        borderRadius: 24,
        padding: 16,
        elevation: 2,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 6,
        marginBottom: 96,
    },
    settingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    settingsLink: { flexDirection: "row", alignItems: "center", gap: 12 },
    settingIconBox: {
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: COLORS.primaryContainer,
        justifyContent: "center",
        alignItems: "center",
    },
    settingTitle: { fontSize: 14, fontWeight: "800", color: COLORS.onSurface },
    settingSubtitle: { fontSize: 12, color: COLORS.outline, marginTop: 2 },
    settingValue: { fontSize: 13, fontWeight: "800", color: COLORS.primary },
    divider: { height: 1, backgroundColor: "#E2E8F0", marginVertical: 14 },
    button: {
        backgroundColor: "#007bff",
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: "center",
        marginTop: 24,
    },
    text: { color: "#fff", fontSize: 16, fontWeight: "600" },

    // СТИЛІ ДЛЯ МОДАЛУ РЕДАГУВАННЯ ЮЗЕРНЕЙМУ
    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    modalContainer: {
        width: "100%",
        backgroundColor: COLORS.white,
        borderRadius: 24,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 6,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: "800",
        color: COLORS.onSurface,
        marginBottom: 16,
    },
    modalInputWrapper: {
        position: "relative",
        justifyContent: "center",
    },
    modalInput: {
        height: 52,
        borderWidth: 1,
        borderColor: "#E2E8F0",
        backgroundColor: "#F8FAFC",
        borderRadius: 14,
        paddingHorizontal: 16,
        fontSize: 16,
        color: COLORS.onSurface,
    },
    modalInputError: {
        borderColor: COLORS.error,
        backgroundColor: "#FEF2F2",
    },
    modalInputLoader: {
        position: "absolute",
        right: 16,
    },
    modalErrorText: {
        fontSize: 13,
        color: COLORS.error,
        fontWeight: "500",
        marginTop: 6,
    },
    modalHintText: {
        fontSize: 12,
        color: COLORS.outline,
        marginTop: 6,
    },
    modalActions: {
        flexDirection: "row",
        gap: 12,
        marginTop: 24,
    },
    modalCancelBtn: {
        flex: 1,
        height: 50,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#F1F5F9",
    },
    modalCancelBtnText: {
        fontSize: 15,
        fontWeight: "700",
        color: COLORS.outline,
    },
    modalSaveBtn: {
        flex: 1,
        height: 50,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: COLORS.primary,
    },
    modalSaveBtnText: {
        fontSize: 15,
        fontWeight: "700",
        color: COLORS.white,
    },
});