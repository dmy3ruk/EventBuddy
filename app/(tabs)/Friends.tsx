import React, { useEffect, useState } from "react";
import { Alert } from "react-native";
import {View, ScrollView, Text, TouchableOpacity, TextInput, StyleSheet,} from "react-native";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";

import { getAuth } from "firebase/auth";
import {collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp, deleteDoc, addDoc,} from "firebase/firestore";
import { db } from "../../FirebaseConfig";
import { SafeAreaView } from "react-native-safe-area-context";

type UserItem = { uid: string; username: string; };
type FriendItem = { uid: string; username: string; };

type FriendRequest = {
    id: string;
    fromUid: string;
    fromUsername: string;
    toUid: string;
    toUsername: string;
};

type TabType = "Search" | "Requests" | "My friends";

export default function FriendsScreen() {
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState<TabType>("Search");

    const [searchResults, setSearchResults] = useState<UserItem[]>([]);
    const [myFriends, setMyFriends] = useState<FriendItem[]>([]);
    const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
    const [sentRequests, setSentRequests] = useState<string[]>([]); // список uid, кому вже надіслала запит

    const [loading, setLoading] = useState(false);
    const [myUsername, setMyUsername] = useState<string>("");

    const auth = getAuth();

    // свій username
    useEffect(() => {
        const fetchMyUsername = async () => {
            const user = auth.currentUser;
            if (!user) return;

            const docRef = doc(db, "usernames", user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setMyUsername(docSnap.data().username);
            }
        };

        fetchMyUsername();
    }, []);

    // мої друзі
    const fetchMyFriends = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        try {
            setLoading(true);
            const snapshot = await getDocs(
                collection(db, "friends", currentUser.uid, "list")
            );

            const friendsData: FriendItem[] = snapshot.docs.map((d) => ({
                uid: d.id,
                username: d.data().username as string,
            }));

            setMyFriends(friendsData);
        } catch (e) {
            console.log("Error loading friends:", e);
        } finally {
            setLoading(false);
        }
    };

    // вхідні запити
    const fetchIncomingRequests = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        try {
            setLoading(true);
            const q = query(
                collection(db, "friendRequests"),
                where("toUid", "==", currentUser.uid)
            );
            const snapshot = await getDocs(q);

            const requests: FriendRequest[] = snapshot.docs.map((d) => ({
                id: d.id,
                fromUid: d.data().fromUid,
                fromUsername: d.data().fromUsername,
                toUid: d.data().toUid,
                toUsername: d.data().toUsername,
            }));

            setIncomingRequests(requests);
        } catch (e) {
            console.log("Error loading incoming requests:", e);
        } finally {
            setLoading(false);
        }
    };

    // надіслані запити
    const fetchSentRequests = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        try {
            const q = query(
                collection(db, "friendRequests"),
                where("fromUid", "==", currentUser.uid)
            );
            const snapshot = await getDocs(q);

            const toUids = snapshot.docs.map((d) => d.data().toUid as string);
            setSentRequests(toUids);
        } catch (e) {
            console.log("Error loading sent requests:", e);
        }
    };

    const handleRemoveFriend = (friend: FriendItem) => {
        Alert.alert(
            "Remove Friend",
            `Are you sure you want to remove ${friend.username}?`,
            [
                {
                    text: "Cancel",
                    style: "cancel",
                },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                        const currentUser = auth.currentUser;
                        if (!currentUser) return;

                        try {
                            setLoading(true);

                            await deleteDoc(
                                doc(db, "friends", currentUser.uid, "list", friend.uid)
                            );
                            await deleteDoc(
                                doc(db, "friends", friend.uid, "list", currentUser.uid)
                            );

                            setMyFriends((prev) =>
                                prev.filter((f) => f.uid !== friend.uid)
                            );
                        } catch (e) {
                            console.log("Error removing friend:", e);
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    // коли перемикаю вкладку
    useEffect(() => {
        if (activeTab === "My friends") {
            fetchMyFriends();
        } else if (activeTab === "Requests") {
            fetchIncomingRequests();
        }
        fetchSentRequests();
    }, [activeTab]);

    // пошук друзів
    const handleSearchChange = async (text: string) => {
        setSearch(text);

        const trimmed = text.trim().toLowerCase();
        if (!trimmed) {
            setSearchResults([]);
            return;
        }

        try {
            setLoading(true);

            const q = query(
                collection(db, "usernames"),
                where("usernameLower", ">=", trimmed),
                where("usernameLower", "<=", trimmed + "\uf8ff")
            );

            const snapshot = await getDocs(q);
            const currentUser = auth.currentUser;

            const users: UserItem[] = snapshot.docs
                .map((d) => ({
                    uid: d.id,
                    username: d.data().username as string,
                }))
                .filter((u) => u.uid !== currentUser?.uid);

            setSearchResults(users);
        } catch (e) {
            console.log("Error searching users:", e);
        } finally {
            setLoading(false);
        }
    };

    const isAlreadyFriend = (uid: string) => {
        return myFriends.some((f) => f.uid === uid);
    };

    const isRequestAlreadySent = (uid: string) => {
        return sentRequests.includes(uid);
    };

    // Add Friend
    const handleAddFriend = async (userToAdd: UserItem) => {
        const currentUser = auth.currentUser;
        if (!currentUser || !myUsername) {
            alert("You need to be logged in");
            return;
        }

        if (isAlreadyFriend(userToAdd.uid)) {
            alert("You are already friends");
            return;
        }

        if (isRequestAlreadySent(userToAdd.uid)) {
            alert("Friend request already sent");
            return;
        }

        try {
            setLoading(true);

            const requestId = `${currentUser.uid}_${userToAdd.uid}`;

            const requestRef = doc(db, "friendRequests", requestId);
            await setDoc(requestRef, {
                fromUid: currentUser.uid,
                fromUsername: myUsername,
                toUid: userToAdd.uid,
                toUsername: userToAdd.username,
                status: "pending",
                createdAt: serverTimestamp(),
            });

            setSentRequests((prev) => [...prev, userToAdd.uid]);

            alert(`Friend request sent to ${userToAdd.username}`);
        } catch (e) {
            console.log("Error sending friend request:", e);
        } finally {
            setLoading(false);
        }
    };

    // Accept
    const handleAcceptRequest = async (request: FriendRequest) => {
        const currentUser = auth.currentUser;
        if (!currentUser || !myUsername) return;

        try {
            setLoading(true);

            const myFriendRef = doc(
                collection(db, "friends", currentUser.uid, "list"),
                request.fromUid
            );
            await setDoc(myFriendRef, {
                uid: request.fromUid,
                username: request.fromUsername,
                createdAt: serverTimestamp(),
            });

            const hisFriendRef = doc(
                collection(db, "friends", request.fromUid, "list"),
                currentUser.uid
            );
            await setDoc(hisFriendRef, {
                uid: currentUser.uid,
                username: myUsername,
                createdAt: serverTimestamp(),
            });

            await deleteDoc(doc(db, "friendRequests", request.id));

            setIncomingRequests((prev) => prev.filter((r) => r.id !== request.id));
            fetchMyFriends();
        } catch (e) {
            console.log("Error accepting request:", e);
        } finally {
            setLoading(false);
        }
    };

    // Decline
    const handleDeclineRequest = async (request: FriendRequest) => {
        try {
            setLoading(true);
            await deleteDoc(doc(db, "friendRequests", request.id));
            setIncomingRequests((prev) => prev.filter((r) => r.id !== request.id));
        } catch (e) {
            console.log("Error declining request:", e);
        } finally {
            setLoading(false);
        }
    };

    // Invite → генеруємо силку
    const handleInvitePress = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            Alert.alert("Error", "You need to be logged in");
            return;
        }

        try {
            setLoading(true);

            const inviteRef = await addDoc(collection(db, "friendInviteLinks"), {
                ownerUid: currentUser.uid,
                ownerUsername: myUsername || null,
                createdAt: serverTimestamp(),
            });

            const inviteId = inviteRef.id;
            const inviteLink = `https://eventbuddy.app/invite/friend/${inviteId}`;

            await Clipboard.setStringAsync(inviteLink);

            Alert.alert(
                "Invite link created",
                `Link copied to clipboard:\n${inviteLink}`
            );
        } catch (e) {
            console.log("Error generating invite link:", e);
            Alert.alert("Error", "Failed to create invite link");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scroll}>
                {/* header */}
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

                    <TouchableOpacity
                        style={styles.inviteBtn}
                        onPress={handleInvitePress}
                    >
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
                    <TouchableOpacity
                        style={[
                            styles.toggle,
                            activeTab === "Search" && styles.toggleActive,
                        ]}
                        onPress={() => setActiveTab("Search")}
                    >
                        <Text
                            style={[
                                styles.toggleText,
                                activeTab === "Search" && styles.toggleActiveText,
                            ]}
                        >
                            Search
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.toggle,
                            activeTab === "Requests" && styles.toggleActive,
                        ]}
                        onPress={() => setActiveTab("Requests")}
                    >
                        <Text
                            style={[
                                styles.toggleText,
                                activeTab === "Requests" && styles.toggleActiveText,
                            ]}
                        >
                            Requests
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.toggle,
                            activeTab === "My friends" && styles.toggleActive,
                        ]}
                        onPress={() => setActiveTab("My friends")}
                    >
                        <Text
                            style={[
                                styles.toggleText,
                                activeTab === "My friends" && styles.toggleActiveText,
                            ]}
                        >
                            My friends
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* search bar */}
                <View style={styles.searchBar}>
                    <TextInput
                        placeholder="Search for friends..."
                        value={search}
                        onChangeText={handleSearchChange}
                        style={styles.searchInput}
                        placeholderTextColor="#B7BFCA"
                    />
                    <Image
                        source={require("../../assets/images/search.svg")}
                        resizeMode="stretch"
                        style={{ width: 20, height: 20, tintColor: "#6E7D93" }}
                    />
                </View>

                {/* Search tab */}
                {activeTab === "Search" && (
                    <View style={styles.friendsList}>
                        {loading && (
                            <Text style={{ textAlign: "center", marginBottom: 8 }}>
                                Loading...
                            </Text>
                        )}

                        {searchResults.map((user) => {
                            const alreadyFriend = isAlreadyFriend(user.uid);
                            const requestSent = isRequestAlreadySent(user.uid);

                            let buttonText = "Add Friend";
                            let disabled = false;

                            if (alreadyFriend) {
                                buttonText = "Already friends";
                                disabled = true;
                            } else if (requestSent) {
                                buttonText = "Request sent";
                                disabled = true;
                            }

                            return (
                                <View key={user.uid} style={styles.friendCard}>
                                    <View style={{ flexDirection: "row" }}>
                                        <View style={styles.avatar}>
                                            <Text style={styles.avatarText}>
                                                {user.username?.charAt(0)?.toUpperCase()}
                                            </Text>
                                        </View>
                                        <View
                                            style={{
                                                flexDirection: "column",
                                                gap: 4,
                                                justifyContent: "center",
                                            }}
                                        >
                                            <Text style={styles.friendName}>
                                                {user.username}
                                            </Text>
                                            <Text style={styles.subText}>
                                                0 mutual friends
                                            </Text>
                                        </View>
                                    </View>

                                    <TouchableOpacity
                                        style={[
                                            styles.AddFriendBtn,
                                            disabled && { opacity: 0.6 },
                                        ]}
                                        disabled={disabled}
                                        onPress={() => handleAddFriend(user)}
                                    >
                                        <Text style={{ color: "white" }}>{buttonText}</Text>
                                    </TouchableOpacity>
                                </View>
                            );
                        })}

                        {!loading &&
                            search.trim().length > 0 &&
                            searchResults.length === 0 && (
                                <Text
                                    style={{
                                        textAlign: "center",
                                        color: "#6E7D93",
                                        marginTop: 16,
                                    }}
                                >
                                    No users found
                                </Text>
                            )}
                    </View>
                )}

                {/* Requests tab */}
                {activeTab === "Requests" && (
                    <View style={styles.friendsList}>
                        {loading && (
                            <Text style={{ textAlign: "center", marginBottom: 8 }}>
                                Loading...
                            </Text>
                        )}

                        {incomingRequests.map((request) => (
                            <View key={request.id} style={styles.friendCard}>
                                <View style={{ flexDirection: "row" }}>
                                    <View style={styles.avatar}>
                                        <Text style={styles.avatarText}>
                                            {request.fromUsername
                                                ?.charAt(0)
                                                ?.toUpperCase()}
                                        </Text>
                                    </View>
                                    <View
                                        style={{
                                            flexDirection: "column",
                                            gap: 4,
                                            justifyContent: "center",
                                        }}
                                    >
                                        <Text style={styles.friendName}>
                                            {request.fromUsername}
                                        </Text>
                                        <Text style={styles.subText}>
                                            wants to add you as a friend
                                        </Text>
                                    </View>
                                </View>

                                <View style={{ flexDirection: "row", gap: 8 }}>
                                    <TouchableOpacity
                                        style={[
                                            styles.AddFriendBtn,
                                            { backgroundColor: "#4E8D63" },
                                        ]}
                                        onPress={() => handleAcceptRequest(request)}
                                    >
                                        <Text style={{ color: "white" }}>Accept</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.AddFriendBtn,
                                            { backgroundColor: "#E53E3E" },
                                        ]}
                                        onPress={() => handleDeclineRequest(request)}
                                    >
                                        <Text style={{ color: "white" }}>Decline</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}

                        {!loading && incomingRequests.length === 0 && (
                            <Text
                                style={{
                                    textAlign: "center",
                                    color: "#6E7D93",
                                    marginTop: 16,
                                }}
                            >
                                You don't have any friend requests
                            </Text>
                        )}
                    </View>
                )}

                {/* My friends tab */}
                {activeTab === "My friends" && (
                    <View style={styles.friendsList}>
                        {loading && (
                            <Text style={{ textAlign: "center", marginBottom: 8 }}>
                                Loading...
                            </Text>
                        )}

                        {myFriends.map((friend) => (
                            <View key={friend.uid} style={styles.friendCard}>
                                <View style={{ flexDirection: "row" }}>
                                    <View style={styles.avatar}>
                                        <Text style={styles.avatarText}>
                                            {friend.username?.charAt(0)?.toUpperCase()}
                                        </Text>
                                    </View>
                                    <View
                                        style={{
                                            flexDirection: "column",
                                            gap: 4,
                                            justifyContent: "center",
                                        }}
                                    >
                                        <Text style={styles.friendName}>
                                            {friend.username}
                                        </Text>
                                        <Text style={styles.subText}>Friend</Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    onPress={() => handleRemoveFriend(friend)}
                                    style={{ padding: 6 }}
                                >
                                    <Image
                                        source={require("../../assets/images/trash.png")}
                                        style={{
                                            width: 20,
                                            height: 25,
                                            tintColor: "#E53E3E",
                                        }}
                                    />
                                </TouchableOpacity>
                            </View>
                        ))}

                        {!loading && myFriends.length === 0 && (
                            <Text
                                style={{
                                    textAlign: "center",
                                    color: "#6E7D93",
                                    marginTop: 16,
                                }}
                            >
                                You don't have any friends yet
                            </Text>
                        )}
                    </View>
                )}
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
        paddingTop: 20,
        paddingBottom: 12,
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
        paddingHorizontal: 24,
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
        fontWeight: "400",
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
        color: "#6E7D93",
        fontSize: 12,
    },
    AddFriendBtn: {
        flexDirection: "column",
        alignItems: "flex-start",
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: "#4E8D63",
        borderRadius: 8,
    },
});
