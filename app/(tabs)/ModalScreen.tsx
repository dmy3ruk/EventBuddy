import React, { useState, useEffect, useMemo } from "react";
import {
    StyleSheet,
    Text,
    TextInput,
    View,
    TouchableOpacity,
    Modal,
    Platform,
    ScrollView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { getAuth } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../FirebaseConfig";
import { createEventWithChat } from "../../utils/createEventWithChat";

type ModalScreenProps = {
    visible: boolean;
    closeModal: () => void;
};

type FriendItem = {
    uid: string;
    username: string;
};

export default function ModalScreen({ visible, closeModal }: ModalScreenProps) {
    const [name, setName] = useState("");
    const [date, setDate] = useState(new Date());
    const [time, setTime] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [details, setDetails] = useState("");

    const [availableFriends, setAvailableFriends] = useState<FriendItem[]>([]);
    const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
    const [loadingFriends, setLoadingFriends] = useState(false);
    const [friendsSearch, setFriendsSearch] = useState("");

    const auth = getAuth();

    useEffect(() => {
        const loadFriends = async () => {
            const user = auth.currentUser;
            if (!user || !visible) return;

            try {
                setLoadingFriends(true);

                const snap = await getDocs(
                    collection(db, "friends", user.uid, "list")
                );

                const list: FriendItem[] = snap.docs.map((d) => ({
                    uid: d.id,
                    username: d.data().username as string,
                }));

                setAvailableFriends(list);
            } catch (e) {
                console.log("Error loading friends:", e);
            } finally {
                setLoadingFriends(false);
            }
        };

        if (visible) {
            loadFriends();
            setSelectedFriendIds([]);
            setFriendsSearch("");
        }
    }, [visible]);

    const toggleFriend = (uid: string) => {
        setSelectedFriendIds((prev) =>
            prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
        );
    };

    const filteredFriends = useMemo(() => {
        const q = friendsSearch.trim().toLowerCase();
        if (!q) return availableFriends;
        return availableFriends.filter((f) =>
            f.username.toLowerCase().includes(q)
        );
    }, [availableFriends, friendsSearch]);

    const handleSave = async () => {
        const user = auth.currentUser;
        if (!user) return;

        if (!name.trim()) {
            alert("Будь ласка, введи назву події");
            return;
        }

        try {
            const invitedFriends = availableFriends.filter((f) =>
                selectedFriendIds.includes(f.uid)
            );
            const friendsNames = invitedFriends.map((f) => f.username).join(", ");

            await createEventWithChat({
                name: name.trim(),
                date: date.toISOString().split("T")[0],
                time: time.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                }),
                friends: friendsNames,
                details,
                invitedUserIds: selectedFriendIds,
            });

            setName("");
            setDetails("");
            setSelectedFriendIds([]);
            closeModal();
        } catch (error) {
            console.log(error);
            alert("Помилка додавання події");
        }
    };

    const renderFriendRow = (friend: FriendItem) => {
        const selected = selectedFriendIds.includes(friend.uid);

        return (
            <TouchableOpacity
                key={friend.uid}
                style={[styles.friendRow, selected && styles.friendRowSelected]}
                onPress={() => toggleFriend(friend.uid)}
                activeOpacity={0.85}
            >
                <View style={styles.friendAvatar}>
                    <Text style={styles.friendAvatarText}>
                        {friend.username?.charAt(0)?.toUpperCase()}
                    </Text>
                </View>

                <Text style={styles.friendName}>{friend.username}</Text>

                <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    {selected && <Text style={styles.checkboxTick}>✓</Text>}
                </View>
            </TouchableOpacity>
        );
    };

    const selectedCount = selectedFriendIds.length;

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            onRequestClose={closeModal}
        >
            <View style={styles.backdrop}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.headerRow}>
                        <Text style={styles.title}>Create event</Text>
                        <TouchableOpacity onPress={closeModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={styles.closeIcon}>✕</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.subtitle}>
                        Plan your meetup, invite friends and start a chat automatically
                    </Text>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {/* Назва */}
                        <View style={styles.inputWrapper}>
                            <Text style={styles.label}>Event name</Text>
                            <TextInput
                                style={styles.input}
                                value={name}
                                onChangeText={setName}
                                placeholder="Movie night 🎬"
                                placeholderTextColor="#9CA3AF"
                            />
                        </View>

                        {/* Date + Time в один ряд */}
                        <View style={styles.row}>
                            <View style={[styles.inputWrapper, styles.half]}>
                                <Text style={styles.label}>Date</Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        setShowDatePicker(true);
                                        setShowTimePicker(false);
                                    }}
                                    style={styles.input}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.inputText}>
                                        {date.toDateString()}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <View style={[styles.inputWrapper, styles.half]}>
                                <Text style={styles.label}>Time</Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        setShowTimePicker(true);
                                        setShowDatePicker(false);
                                    }}
                                    style={styles.input}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.inputText}>
                                        {time.toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {showDatePicker && (
                            <DateTimePicker
                                value={date}
                                mode="date"
                                display={Platform.OS === "ios" ? "spinner" : "calendar"}
                                onChange={(event, selectedDate) => {
                                    setShowDatePicker(false);
                                    if (selectedDate) setDate(selectedDate);
                                }}
                            />
                        )}

                        {showTimePicker && (
                            <DateTimePicker
                                value={time}
                                mode="time"
                                display={Platform.OS === "ios" ? "spinner" : "clock"}
                                onChange={(event, selectedTime) => {
                                    setShowTimePicker(false);
                                    if (selectedTime) setTime(selectedTime);
                                }}
                            />
                        )}

                        {/* Invite friends */}
                        <View style={{ marginTop: 10 }}>
                            <View style={styles.sectionHeaderRow}>
                                <Text style={styles.label}>Invite friends</Text>
                                {selectedCount > 0 && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>
                                            {selectedCount} selected
                                        </Text>
                                    </View>
                                )}
                            </View>

                            <TextInput
                                style={[styles.input, { marginBottom: 6 }]}
                                placeholder="Search friends…"
                                placeholderTextColor="#9CA3AF"
                                value={friendsSearch}
                                onChangeText={setFriendsSearch}
                            />

                            {loadingFriends && (
                                <Text style={styles.helperText}>
                                    Loading friends…
                                </Text>
                            )}

                            {!loadingFriends && availableFriends.length === 0 && (
                                <Text style={styles.helperText}>
                                    You don't have any friends yet
                                </Text>
                            )}

                            {!loadingFriends && availableFriends.length > 0 && (
                                <View style={styles.friendsListBox}>
                                    <ScrollView showsVerticalScrollIndicator>
                                        {filteredFriends.map(renderFriendRow)}
                                    </ScrollView>
                                </View>
                            )}
                        </View>

                        {/* Details */}
                        <View style={{ marginTop: 12 }}>
                            <Text style={styles.label}>Details</Text>
                            <TextInput
                                style={[styles.input, styles.detailsInput]}
                                placeholder="Place, plan, dress code…"
                                placeholderTextColor="#9CA3AF"
                                value={details}
                                onChangeText={setDetails}
                                multiline
                            />
                        </View>
                    </ScrollView>

                    {/* Buttons */}
                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            onPress={closeModal}
                            style={styles.secondaryButton}
                            activeOpacity={0.9}
                        >
                            <Text style={styles.secondaryText}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleSave}
                            style={[
                                styles.primaryButton,
                                !name.trim() && styles.primaryButtonDisabled,
                            ]}
                            activeOpacity={0.9}
                            disabled={!name.trim()}
                        >
                            <Text style={styles.primaryText}>Save event</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 12,
    },
    container: {
        width: "100%",
        maxHeight: "90%",
        backgroundColor: "#FFFFFF",
        borderRadius: 24,
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 12,
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 8,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 4,
    },
    title: {
        fontSize: 20,
        fontWeight: "700",
        color: "#111827",
    },
    closeIcon: {
        fontSize: 18,
        color: "#6B7280",
    },
    subtitle: {
        fontSize: 13,
        color: "#6B7280",
        marginBottom: 12,
    },
    scrollContent: {
        paddingBottom: 12,
    },
    inputWrapper: {
        marginBottom: 8,
    },
    label: {
        fontSize: 13,
        marginBottom: 4,
        color: "#4B5563",
        fontWeight: "500",
    },
    input: {
        borderWidth: 1,
        borderColor: "#E5E7EB",
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: "#F9FAFB",
    },
    inputText: {
        fontSize: 14,
        color: "#111827",
    },
    detailsInput: {
        height: 90,
        textAlignVertical: "top",
    },
    row: {
        flexDirection: "row",
        gap: 8,
    },
    half: {
        flex: 1,
    },
    sectionHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 2,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: "#EEF2FF",
    },
    badgeText: {
        fontSize: 11,
        color: "#4F46E5",
        fontWeight: "500",
    },
    helperText: {
        color: "#6E7D93",
        marginTop: 4,
        fontSize: 12,
    },
    friendsListBox: {
        maxHeight: 220,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: "#FFFFFF",
        paddingHorizontal: 4,
        paddingVertical: 4,
        marginTop: 2,
    },
    friendRow: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 12,
        marginVertical: 2,
    },
    friendRowSelected: {
        backgroundColor: "#EEF2FF",
    },
    friendAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: "#505BEB",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 10,
    },
    friendAvatarText: {
        color: "#FFFFFF",
        fontWeight: "600",
        fontSize: 14,
    },
    friendName: {
        flex: 1,
        fontSize: 14,
        color: "#111827",
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: "#CBD5E1",
        justifyContent: "center",
        alignItems: "center",
    },
    checkboxSelected: {
        backgroundColor: "#505BEB",
        borderColor: "#505BEB",
    },
    checkboxTick: {
        color: "#FFFFFF",
        fontSize: 14,
        fontWeight: "700",
    },
    buttonRow: {
        flexDirection: "row",
        gap: 10,
        marginTop: 8,
    },
    secondaryButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "#E5E7EB",
        backgroundColor: "#F9FAFB",
        justifyContent: "center",
        alignItems: "center",
    },
    secondaryText: {
        color: "#4B5563",
        fontWeight: "500",
        fontSize: 14,
    },
    primaryButton: {
        flex: 1.2,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: "#505BEB",
        justifyContent: "center",
        alignItems: "center",
    },
    primaryButtonDisabled: {
        backgroundColor: "#9CA3AF",
    },
    primaryText: {
        color: "#FFFFFF",
        fontWeight: "600",
        fontSize: 14,
    },
});
