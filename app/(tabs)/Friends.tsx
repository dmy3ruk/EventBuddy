import React, {useEffect, useState} from "react";
import {
    View,
    ScrollView,
    Text,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    Alert,
    ActivityIndicator,
    Platform,
} from "react-native";
import {MaterialCommunityIcons} from "@expo/vector-icons";
import {SafeAreaView} from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as Haptics from 'expo-haptics';
import {getAuth} from "firebase/auth";
import {
    collection, query, where, getDocs, doc, getDoc, setDoc,
    serverTimestamp, deleteDoc, addDoc
} from "firebase/firestore";
import {db} from "../../FirebaseConfig";

type UserItem = { uid: string; username: string };
type FriendItem = { uid: string; username: string };
type FriendRequest = {
    id: string;
    fromUid: string;
    fromUsername: string;
    toUid: string;
    toUsername: string;
};
type TabType = "Search" | "Requests" | "My friends";

const COLORS = {
    primary: "#505BEB",
    primaryContainer: "rgba(80, 91, 235, 0.12)",
    surface: "#F8FAFC",
    onSurface: "#1A1A1A",
    secondary: "#64748B",
    success: "#16A34A",
    error: "#EF4444",
    white: "#FFFFFF",
};

export default function FriendsScreen() {
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState<TabType>("Search");
    const [searchResults, setSearchResults] = useState<UserItem[]>([]);
    const [myFriends, setMyFriends] = useState<FriendItem[]>([]);
    const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
    const [sentRequests, setSentRequests] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [myUsername, setMyUsername] = useState<string>("");

    const auth = getAuth();

    // Отримуємо username поточного користувача при завантаженні
    useEffect(() => {
        const fetchMyUsername = async () => {
            const user = auth.currentUser;
            if (!user) return;
            const docRef = doc(db, "usernames", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) setMyUsername(docSnap.data().username);
        };
        fetchMyUsername();
    }, []);

    // Оновлюємо дані при зміні вкладок
    useEffect(() => {
        if (activeTab === "My friends") fetchMyFriends();
        else if (activeTab === "Requests") fetchIncomingRequests();
        fetchSentRequests();
    }, [activeTab]);

    // Завантаження списку друзів
    const fetchMyFriends = async () => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            setLoading(true);
            const snapshot = await getDocs(collection(db, "friends", user.uid, "list"));
            setMyFriends(snapshot.docs.map(d => ({uid: d.id, username: d.data().username})));
        } finally {
            setLoading(false);
        }
    };

    // Отримання вхідних запитів у друзі
    const fetchIncomingRequests = async () => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            setLoading(true);
            const q = query(collection(db, "friendRequests"), where("toUid", "==", user.uid));
            const snapshot = await getDocs(q);
            setIncomingRequests(snapshot.docs.map(d => ({id: d.id, ...d.data()} as FriendRequest)));
        } finally {
            setLoading(false);
        }
    };

    // Отримання списку ID користувачів, яким ми вже відправили запит
    const fetchSentRequests = async () => {
        const user = auth.currentUser;
        if (!user) return;
        const q = query(collection(db, "friendRequests"), where("fromUid", "==", user.uid));
        const snapshot = await getDocs(q);
        setSentRequests(snapshot.docs.map(d => d.data().toUid));
    };

    // Пошук користувачів за нікнеймом
    const handleSearchChange = async (text: string) => {
        setSearch(text);
        const trimmed = text.trim().toLowerCase();
        if (!trimmed) {
            setSearchResults([]);
            return;
        }
        try {
            setLoading(true);
            // Використовуємо range query для пошуку за початком рядка
            const q = query(collection(db, "usernames"),
                where("usernameLower", ">=", trimmed),
                where("usernameLower", "<=", trimmed + "\uf8ff")
            );
            const snapshot = await getDocs(q);
            const currentUser = auth.currentUser;
            setSearchResults(snapshot.docs
                .map(d => ({uid: d.id, username: d.data().username}))
                .filter(u => u.uid !== currentUser?.uid) // Не показуємо себе в пошуку
            );
        } finally {
            setLoading(false);
        }
    };

    // Відправка запиту у друзі
    const handleAddFriend = async (userToAdd: UserItem) => {
        const user = auth.currentUser;
        if (!user || !myUsername) return;
        try {
            if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setLoading(true);
            const requestId = `${user.uid}_${userToAdd.uid}`;
            await setDoc(doc(db, "friendRequests", requestId), {
                fromUid: user.uid, fromUsername: myUsername,
                toUid: userToAdd.uid, toUsername: userToAdd.username,
                status: "pending", createdAt: serverTimestamp(),
            });
            setSentRequests(prev => [...prev, userToAdd.uid]);
            Alert.alert("Sent", `Friend request sent to ${userToAdd.username}`);
        } finally {
            setLoading(false);
        }
    };

    // Прийняття запиту
    const handleAcceptRequest = async (req: FriendRequest) => {
        const user = auth.currentUser;
        if (!user || !myUsername) return;
        try {
            setLoading(true);
            // Додаємо друга до мого списку
            await setDoc(doc(db, "friends", user.uid, "list", req.fromUid), {
                uid: req.fromUid,
                username: req.fromUsername,
                createdAt: serverTimestamp()
            });
            // Додаємо мене до списку друга
            await setDoc(doc(db, "friends", req.fromUid, "list", user.uid), {
                uid: user.uid,
                username: myUsername,
                createdAt: serverTimestamp()
            });
            // Видаляємо запит
            await deleteDoc(doc(db, "friendRequests", req.id));
            setIncomingRequests(prev => prev.filter(r => r.id !== req.id));
            fetchMyFriends();
        } finally {
            setLoading(false);
        }
    };

    // Видалення друга
    const handleRemoveFriend = (friend: FriendItem) => {
        Alert.alert("Remove Friend", `Are you sure?`, [
            {text: "Cancel", style: "cancel"},
            {
                text: "Remove", style: "destructive", onPress: async () => {
                    const user = auth.currentUser;
                    if (!user) return;
                    // Видаляємо з обох сторін
                    await deleteDoc(doc(db, "friends", user.uid, "list", friend.uid));
                    await deleteDoc(doc(db, "friends", friend.uid, "list", user.uid));
                    setMyFriends(prev => prev.filter(f => f.uid !== friend.uid));
                }
            }
        ]);
    };

    // Генерація лінку-запрошення (просто копіює в буфер обміну)
    const handleInvitePress = async () => {
        const user = auth.currentUser;
        if (!user) return;
        const inviteRef = await addDoc(collection(db, "friendInviteLinks"), {
            ownerUid: user.uid,
            ownerUsername: myUsername,
            createdAt: serverTimestamp()
        });
        const link = `https://eventbuddy.app/invite/${inviteRef.id}`;
        await Clipboard.setStringAsync(link);
        Alert.alert("Link Copied", "Share it with your friends!");
    };

    return (
        <SafeAreaView style={[styles.container, {backgroundColor: COLORS.surface}]} edges={['top']}>
            {/* Секція заголовка */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.welcomeText}>MANAGE YOUR</Text>
                    <Text style={styles.headerTitle}>Social Circle</Text>
                </View>
                <TouchableOpacity style={styles.inviteBadge} onPress={handleInvitePress}>
                    <MaterialCommunityIcons name="link-variant" size={20} color={COLORS.primary}/>
                    <Text style={styles.inviteText}>Invite</Text>
                </TouchableOpacity>
            </View>

            {/* Рядок пошуку */}
            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <MaterialCommunityIcons name="magnify" size={22} color={COLORS.primary}/>
                    <TextInput
                        placeholder="Search by username..."
                        style={styles.searchInput}
                        value={search}
                        onChangeText={handleSearchChange}
                        placeholderTextColor={COLORS.secondary}
                    />
                </View>
            </View>

            {/* Навігація вкладками */}
            <View style={styles.tabBar}>
                {(["Requests", "My friends"] as TabType[]).map((tab) => {
                    const isActive = activeTab === tab;
                    return (
                        <TouchableOpacity
                            key={tab}
                            onPress={() => {
                                setActiveTab(tab);
                                Haptics.selectionAsync();
                            }}
                            style={[styles.tabItem, isActive && {backgroundColor: COLORS.primaryContainer}]}
                        >
                            <Text style={[styles.tabLabel, {color: isActive ? COLORS.primary : COLORS.secondary}]}>
                                {tab === "My friends" ? "List" : tab}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <ScrollView
                contentContainerStyle={styles.listContainer}
                showsVerticalScrollIndicator={false}
            >
                {loading && <ActivityIndicator color={COLORS.primary} style={{marginBottom: 15}}/>}

                {/* Відображення результатів пошуку */}
                {activeTab === "Search" && searchResults.map(user => {
                    const isFriend = myFriends.some(f => f.uid === user.uid);
                    const isSent = sentRequests.includes(user.uid);
                    return (
                        <View key={user.uid} style={styles.card}>
                            <View style={[styles.avatar, {backgroundColor: COLORS.primaryContainer}]}>
                                <Text
                                    style={[styles.avatarText, {color: COLORS.primary}]}>{user.username[0].toUpperCase()}</Text>
                            </View>
                            <View style={styles.cardInfo}>
                                <Text style={styles.cardName}>{user.username}</Text>
                                <Text style={styles.cardSub}>New to EventBuddy</Text>
                            </View>
                            <TouchableOpacity
                                disabled={isFriend || isSent}
                                onPress={() => handleAddFriend(user)}
                                style={[styles.actionBtn, (isFriend || isSent) && {
                                    backgroundColor: COLORS.secondary,
                                    opacity: 0.6
                                }]}
                            >
                                <Text style={styles.actionBtnText}>
                                    {isFriend ? "Friend" : isSent ? "Sent" : "Add"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    );
                })}

                {/* Відображення вхідних запитів */}
                {activeTab === "Requests" && incomingRequests.map(req => (
                    <View key={req.id} style={styles.card}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{req.fromUsername[0].toUpperCase()}</Text>
                        </View>
                        <View style={styles.cardInfo}>
                            <Text style={styles.cardName}>{req.fromUsername}</Text>
                            <Text style={styles.cardSub}>Wants to be friends</Text>
                        </View>
                        <TouchableOpacity onPress={() => handleAcceptRequest(req)}
                                          style={[styles.actionBtn, {backgroundColor: COLORS.success}]}>
                            <Text style={styles.actionBtnText}>Accept</Text>
                        </TouchableOpacity>
                    </View>
                ))}

                {/* Відображення списку друзів */}
                {activeTab === "My friends" && myFriends.map(friend => (
                    <View key={friend.uid} style={styles.card}>
                        <View style={[styles.avatar, {backgroundColor: COLORS.secondary}]}>
                            <Text style={styles.avatarText}>{friend.username[0].toUpperCase()}</Text>
                        </View>
                        <View style={styles.cardInfo}>
                            <Text style={styles.cardName}>{friend.username}</Text>
                            <Text style={styles.cardSub}>Mutual friend</Text>
                        </View>
                        <TouchableOpacity onPress={() => handleRemoveFriend(friend)} style={styles.deleteIconBtn}>
                            <MaterialCommunityIcons name="trash-can-outline" size={22} color={COLORS.error}/>
                        </TouchableOpacity>
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {flex: 1},
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 15
    },
    welcomeText: {
        fontSize: 12,
        fontWeight: "800",
        color: COLORS.primary,
        textTransform: "uppercase",
        letterSpacing: 1.5
    },
    headerTitle: {fontSize: 32, fontWeight: "800", color: COLORS.onSurface, letterSpacing: -0.5},
    inviteBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.primaryContainer,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        gap: 6
    },
    inviteText: {fontWeight: "700", color: COLORS.primary, fontSize: 14},
    searchSection: {paddingHorizontal: 20, marginBottom: 15},
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.white,
        borderRadius: 20,
        paddingHorizontal: 15,
        height: 56,
        elevation: 4,
        shadowColor: COLORS.primary,
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: {width: 0, height: 4}
    },
    searchInput: {flex: 1, marginLeft: 10, fontSize: 16, color: COLORS.onSurface},
    tabBar: {flexDirection: "row", paddingHorizontal: 20, gap: 10, marginBottom: 20},
    tabItem: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 25,
        backgroundColor: "#ffff",
        borderWidth: 1,
        borderColor: COLORS.primaryContainer
    },
    tabLabel: {fontWeight: "700", fontSize: 14},
    listContainer: {paddingHorizontal: 20, paddingBottom: 40},
    card: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.white,
        borderRadius: 24,
        padding: 16,
        marginBottom: 12,
        elevation: 2,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: {width: 0, height: 2}
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.primary
    },
    avatarText: {color: COLORS.white, fontSize: 20, fontWeight: "bold"},
    cardInfo: {flex: 1, marginLeft: 15},
    cardName: {fontSize: 17, fontWeight: "700", color: COLORS.onSurface},
    cardSub: {fontSize: 13, color: COLORS.secondary},
    actionBtn: {
        backgroundColor: COLORS.primary,
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 16
    },
    actionBtnText: {color: COLORS.white, fontWeight: "800", fontSize: 14},
    deleteIconBtn: {
        padding: 10,
        backgroundColor: "rgba(239, 68, 68, 0.08)",
        borderRadius: 12,
    }
});