import React, { useEffect, useMemo, useState } from "react";
import {SafeAreaView, View, ScrollView, Text, TouchableOpacity, TextInput, StyleSheet,
    ActivityIndicator, Alert,
} from "react-native";
import {Image} from "expo-image";
import { getAuth } from "firebase/auth";
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "../../FirebaseConfig";

type FriendUser = {
    id: string;
    username: string;
};

export default function FriendsScreen() {
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState("Search");
    const [users, setUsers] = useState<FriendUser[]>([]);
    const [friendIds, setFriendIds] = useState<string[]>([]);
    const [friends, setFriends] = useState<FriendUser[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            const auth = getAuth();
            const currentUser = auth.currentUser;
            if (!currentUser) return;

            setLoading(true);
            try {
                const usersSnapshot = await getDocs(collection(db, "usernames"));
                const usersData: FriendUser[] = usersSnapshot.docs.map((userDoc) => ({
                    id: userDoc.id,
                    username: (userDoc.data() as { username: string }).username,
                }));
                setUsers(usersData);

                const friendsQuery = query(
                    collection(db, "friends"),
                    where("userId", "==", currentUser.uid)
                );
                const friendsSnapshot = await getDocs(friendsQuery);
                const fetchedFriendIds = friendsSnapshot.docs.map((friendDoc) => {
                    const data = friendDoc.data() as { friendId: string };
                    return data.friendId;
                });
                setFriendIds(fetchedFriendIds);
                setFriends(usersData.filter((user) => fetchedFriendIds.includes(user.id)));
            } catch (error) {
                console.log("Error loading friends", error);
                Alert.alert("Error", "Не вдалося завантажити список друзів");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleAddFriend = async (user: FriendUser) => {
        const auth = getAuth();
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        if (user.id === currentUser.uid) {
            Alert.alert("Увага", "Ви не можете додати себе у друзі");
            return;
        }

        if (friendIds.includes(user.id)) {
            Alert.alert("Увага", "Користувач вже у списку друзів");
            return;
        }

        try {
            await addDoc(collection(db, "friends"), {
                userId: currentUser.uid,
                friendId: user.id,
                friendUsername: user.username,
                createdAt: serverTimestamp(),
            });

            setFriendIds((prev) => [...prev, user.id]);
            setFriends((prev) => [...prev, user]);
            Alert.alert("Успіх", `${user.username} додано до друзів`);
        } catch (error) {
            console.log("Error adding friend", error);
            Alert.alert("Помилка", "Не вдалося додати друга");
        }
    };

    const getFriendDetails = async (friendId: string) => {
        const friendDoc = await getDoc(doc(db, "usernames", friendId));
        if (!friendDoc.exists()) return null;
        const data = friendDoc.data() as { username: string };
        return { id: friendDoc.id, username: data.username };
    };

    useEffect(() => {
        const syncFriends = async () => {
            if (friendIds.length === 0) {
                setFriends([]);
                return;
            }

            const missingFriends = friendIds.filter((friendId) => !friends.some((friend) => friend.id === friendId));
            if (missingFriends.length === 0) return;

            try {
                const resolvedFriends = await Promise.all(missingFriends.map(getFriendDetails));
                const validFriends = resolvedFriends.filter((friend): friend is FriendUser => friend !== null);
                if (validFriends.length > 0) {
                    setFriends((prev) => [...prev, ...validFriends]);
                }
            } catch (error) {
                console.log("Error syncing friend details", error);
            }
        };

        syncFriends();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [friendIds]);

    const filteredSearchUsers = useMemo(() => {
        const searchValue = search.trim().toLowerCase();
        const currentUserId = getAuth().currentUser?.uid;
        const baseList = activeTab === "Search" ? users : friends;

        return baseList.filter((user) => {
            const matchesSearch = searchValue.length === 0 || user.username.toLowerCase().includes(searchValue);
            if (!matchesSearch) return false;
            if (activeTab === "Search" && user.id === currentUserId) return false;
            return true;
        });
    }, [activeTab, friends, search, users]);

    const renderFriendCard = (user: FriendUser, isFriend: boolean) => {
        const initials = user.username.charAt(0).toUpperCase();

        return (
            <View key={user.id} style={styles.friendCard}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                    <View style={{ flexDirection: "column", gap: 4 }}>
                        <Text style={styles.friendName}>{user.username}</Text>
                        <Text style={styles.subText}>Friend</Text>
                    </View>
                </View>

                {isFriend ? (
                    <View style={styles.addedFriendBtn}>
                        <Text style={styles.addedFriendText}>Added</Text>
                    </View>
                ) : (
                    <TouchableOpacity style={styles.addFriendBtn} onPress={() => handleAddFriend(user)}>
                        <Text style={{ color: "white" }}>Add Friend</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scroll}>
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Image
                            source={{
                                uri: "https://storage.googleapis.com/tagjs-prod.appspot.com/v1/LrSvZWPEL6/d21xw23r_expires_30_days.png",
                            }}
                            resizeMode="stretch"
                            style={styles.headerIcon}
                        />
                        <Text style={styles.headerTitle}>Friends</Text>
                    </View>

                    <TouchableOpacity style={styles.inviteBtn} onPress={() => alert("Pressed!")}>
                        <Image
                            source={{
                                uri: "https://storage.googleapis.com/tagjs-prod.appspot.com/v1/LrSvZWPEL6/w6tp0af3_expires_30_days.png",
                            }}
                            resizeMode="stretch"
                            style={styles.inviteIcon}
                        />
                        <Text style={styles.inviteText}>Invite</Text>
                    </TouchableOpacity>
                </View>

                {/* tabs */}
                <View style={styles.toggleWrapper}>
                    <TouchableOpacity style={[styles.toggle, activeTab==='Search' && styles.toggleActive]} onPress={()=>setActiveTab("Search")}>
                        <Text style={[styles.toggleText, activeTab==='Search' && styles.toggleActiveText]}>Search</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.toggle, activeTab==='My friends' && styles.toggleActive]} onPress={()=> setActiveTab("My friends")}>
                        <Text style={[styles.toggleText, activeTab==='My friends' && styles.toggleActiveText]}>My friends</Text>
                    </TouchableOpacity>
                </View>

                {/* search input */}
                <View style={styles.searchBar}>
                    <TextInput
                        placeholder="Search for friends..."
                        value={search}
                        onChangeText={setSearch}
                        style={styles.searchInput}
                    />
                    <Image
                        source={ require("../../assets/images/search.svg") }
                        resizeMode="stretch"
                        style={{ width: 20, height: 20, tintColor:"#6E7D93"}}
                    />
                </View>

                <View style={styles.friendsList}>
                    {loading ? (
                        <ActivityIndicator size="large" color="#505AEB" />
                    ) : filteredSearchUsers.length === 0 ? (
                        <Text style={styles.emptyStateText}>
                            {activeTab === "Search" ? "Не знайдено користувачів" : "Поки що немає друзів"}
                        </Text>
                    ) : (
                        filteredSearchUsers.map((user) => renderFriendCard(user, friendIds.includes(user.id)))
                    )}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F8F8F8",
    },
    scroll: {
        flex: 1,
        backgroundColor: "#F8F8F8",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: 57,
        paddingBottom: 20,
        paddingHorizontal: 17,
        backgroundColor: "#F9F9F9",
    },
    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
    },
    headerIcon: {
        width: 24,
        height: 24,
        marginRight: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#000",
    },
    inviteBtn: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#505AEB",
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    inviteIcon: {
        width: 16,
        height: 16,
        marginRight: 6,
    },
    inviteText: {
        color: "#FFF",
        fontSize: 12,
        fontWeight: "bold",
    },
    toggleWrapper: {
        flexDirection: "row",
        alignSelf: "center",
        backgroundColor: "#FFF",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 40,
        marginVertical: 20,
    },
    toggleActive: {
        backgroundColor: "#505AEB",
        borderRadius: 40,
        paddingVertical: 10,
        paddingHorizontal: 35,
    },
    toggle: {
        borderRadius: 40,
        paddingVertical: 10,
        paddingHorizontal: 20,
    },
    toggleActiveText: {
        color: "#FFF",
        fontSize: 14,
        fontWeight: "bold",
    },
    toggleText: {
        color: "#505AEB",
        fontSize: 14,
        fontWeight: "regular",
    },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFF",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 16,
        marginHorizontal: 16,
        marginBottom: 20,
        paddingHorizontal: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: "#000",
        paddingVertical: 10,
    },
    searchIcon: {
        width: 20,
        height: 20,
    },
    friendsList: {
        marginHorizontal: 16,
        marginBottom: 40,
    },
    friendCard: {
        justifyContent: "space-between",
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFF",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 16,
        paddingVertical: 15,
        paddingHorizontal: 14,
        marginBottom: 12,
    },
    avatar: {
        backgroundColor: "#505AEB",
        borderRadius: 50,
        paddingVertical: 11,
        paddingHorizontal: 16,
        marginRight: 12,
    },
    avatarText: {
        color: "#FFF",
        fontSize: 18,
        fontWeight: "bold",
    },
    friendName: {
        fontSize: 16,
        fontWeight: "500",
        color: "#000",
    },
    subText: {
        color:"#6E7D93",
        fontSize:12
    },
    addFriendBtn:{
        marginRight:0,
        flexDirection: "column",
        alignItems: "flex-start",
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: "#4E8D63",
        borderRadius: 8,
    },
    addedFriendBtn: {
        marginRight: 0,
        flexDirection: "column",
        alignItems: "flex-start",
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: "#CBD5F5",
        borderRadius: 8,
    },
    addedFriendText: {
        color: "#1A237E",
        fontWeight: "600",
    },
    emptyStateText: {
        textAlign: "center",
        color: "#6E7D93",
        paddingVertical: 40,
    }
});
