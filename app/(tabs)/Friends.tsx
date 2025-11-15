import React, { useMemo, useState } from "react";
import {SafeAreaView, View, ScrollView, Text, TouchableOpacity, TextInput, StyleSheet,
} from "react-native";

import {Image} from "expo-image";

export default function FriendsScreen() {
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState("Search");

    type FriendUser = {
        id: string;
        username?: string | null;
        mutualFriends?: number | null;
    };

    const [users] = useState<FriendUser[]>([
        { id: "1", username: "Dmitry", mutualFriends: 0 },
        { id: "2", username: "Olivia", mutualFriends: 3 },
        { id: "3", username: "Luna", mutualFriends: 1 },
        { id: "4", username: null, mutualFriends: 2 },
    ]);

    const filteredUsers = useMemo(() => {
        if (activeTab === "My friends") {
            return users.filter((user) => user.mutualFriends && user.mutualFriends > 0);
        }

        if (!search.trim()) {
            return users;
        }

        const lowerSearch = search.trim().toLowerCase();
        return users.filter((user) => user.username?.toLowerCase().includes(lowerSearch));
    }, [users, search, activeTab]);

    const renderFriendCard = (user: FriendUser) => {
        const firstChar = user.username?.trim()?.charAt(0)?.toUpperCase();
        const initials = firstChar && firstChar.length > 0 ? firstChar : "?";
        const displayName = user.username?.trim() || "Unknown user";
        const mutualFriendsLabel = typeof user.mutualFriends === "number"
            ? `${user.mutualFriends} mutual friend${user.mutualFriends === 1 ? "" : "s"}`
            : "No mutual friends";

        return (
            <View key={user.id} style={styles.friendCard}>
                <View style={{flexDirection:'row'}}>
                    <TouchableOpacity style={styles.avatar} onPress={() => alert("Pressed!")}>
                        <Text style={styles.avatarText}>{initials}</Text>
                    </TouchableOpacity>
                    <View style={{flexDirection:'column', gap:4}}>
                        <Text style={styles.friendName}>{displayName}</Text>
                        <Text style={styles.subText}>{mutualFriendsLabel}</Text>
                    </View>
                </View>

                <TouchableOpacity style={styles.AddFriendBtn}>
                    <Text style={{color:"white"}}>Add Friend</Text>
                </TouchableOpacity>
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
                    {filteredUsers.map(renderFriendCard)}
                    {filteredUsers.length === 0 ? (
                        <Text style={styles.emptyState}>No friends found</Text>
                    ) : null}
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
    emptyState: {
        textAlign: "center",
        color: "#6E7D93",
        fontSize: 14,
        marginTop: 20,
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
    AddFriendBtn:{
        marginRight:0,
        flexDirection: "column",
        alignItems: "flex-start",
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: "#4E8D63",
        borderRadius: 8,
    }
});
