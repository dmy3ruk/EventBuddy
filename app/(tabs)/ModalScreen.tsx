import React, { useEffect, useMemo, useState } from "react";
import {
    StyleSheet,
    Text,
    TextInput,
    View,
    ScrollView,
    TouchableOpacity,
    Modal,
    Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { getAuth } from "firebase/auth";
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../../FirebaseConfig";

type ModalScreenProps = {
    visible: boolean;
    closeModal: () => void;
};

type FriendOption = {
    id: string;
    username: string;
};

export default function ModalScreen({ visible, closeModal }: ModalScreenProps) {
    const [name, setName] = useState("");
    const [date, setDate] = useState(new Date());
    const [time, setTime] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [details, setDetails] = useState("");
    const [friends, setFriends] = useState<FriendOption[]>([]);
    const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);

    useEffect(() => {
        const loadFriends = async () => {
            const auth = getAuth();
            const currentUser = auth.currentUser;
            if (!currentUser) return;

            try {
                const friendsQuery = query(
                    collection(db, "friends"),
                    where("userId", "==", currentUser.uid)
                );
                const snapshot = await getDocs(friendsQuery);
                const friendOptions = await Promise.all(
                    snapshot.docs.map(async (friendDoc) => {
                        const data = friendDoc.data() as { friendId: string; friendUsername?: string };

                        if (data.friendUsername) {
                            return { id: data.friendId, username: data.friendUsername };
                        }

                        const friendUserDoc = await getDoc(doc(db, "usernames", data.friendId));
                        if (!friendUserDoc.exists()) return null;
                        const friendData = friendUserDoc.data() as { username: string };
                        return { id: data.friendId, username: friendData.username };
                    })
                );

                const validFriends = friendOptions.filter((friend): friend is FriendOption => friend !== null);
                setFriends(validFriends);
            } catch (error) {
                console.log("Error loading friends for modal", error);
            }
        };

        if (visible) {
            loadFriends();
        }
    }, [visible]);

    useEffect(() => {
        if (!visible) {
            setSelectedFriendIds([]);
        }
    }, [visible]);

    const toggleFriendSelection = (friendId: string) => {
        setSelectedFriendIds((prev) =>
            prev.includes(friendId)
                ? prev.filter((id) => id !== friendId)
                : [...prev, friendId]
        );
    };

    const selectedFriends = useMemo(
        () => friends.filter((friend) => selectedFriendIds.includes(friend.id)),
        [friends, selectedFriendIds]
    );

    const handleSave = async () => {
        const user = getAuth().currentUser;
        if (!user) return;

        if (!name) {
            alert("Будь ласка, введіть назву події");
            return;
        }

        try {
            await addDoc(collection(db, "events"), {
                name,
                date: date.toISOString().split("T")[0], // YYYY-MM-DD
                time: time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                friends: selectedFriends.map((friend) => friend.username),
                friendIds: selectedFriends.map((friend) => friend.id),
                details,
                userId: user.uid,
                createdAt: serverTimestamp(),
            });
            alert("Подія додана!");
            setName("");
            setDetails("");
            setSelectedFriendIds([]);
            setDate(new Date());
            setTime(new Date());
            setShowDatePicker(false);
            setShowTimePicker(false);
            closeModal();
        } catch (error) {
            console.log(error);
            alert("Помилка додавання події");
        }
    };

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={closeModal}>
            <View style={styles.backdrop}>
                <View style={styles.container}>
                    <Text style={styles.title}>Create Event</Text>

                    {/* Назва події */}
                    <View style={styles.inputWrapper}>
                        <Text style={styles.label}>Event Name</Text>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            placeholder="Party"
                        />
                    </View>

                    {/* Дата */}
                    <TouchableOpacity
                        onPress={() => {
                            setShowDatePicker(true);
                            setShowTimePicker(false);
                        }}
                        style={styles.input}
                    >
                        <Text>{date.toDateString()}</Text>
                    </TouchableOpacity>
                    {showDatePicker && (
                        <DateTimePicker
                            value={date}
                            mode="date"
                            display={Platform.OS === "ios" ? "spinner" : "calendar"}
                            textColor={Platform.OS === "ios" ? "#000" : undefined}
                            onChange={(event, selectedDate) => {
                                if (selectedDate) setDate(selectedDate);
                            }}
                        />
                    )}

                    {/* Час */}
                    <TouchableOpacity
                        onPress={() => {
                            setShowTimePicker(true);
                            setShowDatePicker(false);
                        }}
                        style={styles.input}
                    >
                        <Text>{time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
                    </TouchableOpacity>
                    {showTimePicker && (
                        <DateTimePicker
                            value={time}
                            mode="time"
                            display={Platform.OS === "ios" ? "spinner" : "clock"}
                            textColor={Platform.OS === "ios" ? "#000" : undefined}
                            onChange={(event, selectedTime) => {
                                if (selectedTime) setTime(selectedTime);
                            }}
                        />
                    )}

                    {/* Друзі */}
                    <View style={styles.friendSection}>
                        <Text style={styles.label}>Invite friends</Text>
                        {friends.length === 0 ? (
                            <Text style={styles.emptyFriendsText}>Спочатку додайте друзів на вкладці Friends</Text>
                        ) : (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.friendChipsWrapper}
                            >
                                {friends.map((friend) => {
                                    const isSelected = selectedFriendIds.includes(friend.id);
                                    return (
                                        <TouchableOpacity
                                            key={friend.id}
                                            style={[styles.friendChip, isSelected && styles.friendChipSelected]}
                                            onPress={() => toggleFriendSelection(friend.id)}
                                        >
                                            <Text
                                                style={[styles.friendChipText, isSelected && styles.friendChipTextSelected]}
                                            >
                                                {friend.username}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        )}
                    </View>
                    <TextInput
                        style={[styles.input, { height: 80, textAlignVertical: "top" }]}
                        placeholder="Details"
                        value={details}
                        onChangeText={setDetails}
                        multiline
                    />

                    {/* Кнопки */}
                    <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
                        <Text style={styles.saveText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                        <Text style={styles.closeText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "center",
        alignItems: "center",
    },
    container: {
        width: "90%",
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 20,
    },
    title: { fontSize: 20, fontWeight: "600", marginBottom: 16, textAlign: "center" },
    inputWrapper: { marginBottom: 12 },
    label: { fontSize: 14, marginBottom: 4 },
    input: { borderWidth: 0.5, borderColor: "#ccc", borderRadius: 8, padding: 10, marginBottom: 8 },
    saveButton: { marginTop: 10, padding: 12, backgroundColor: "#28A745", borderRadius: 8 },
    saveText: { color: "#fff", textAlign: "center", fontWeight: "500" },
    closeButton: { marginTop: 10, padding: 12, backgroundColor: "#505BEB", borderRadius: 8 },
    closeText: { color: "#fff", textAlign: "center", fontWeight: "500" },
    friendSection: { marginTop: 10, marginBottom: 8 },
    friendChipsWrapper: { paddingVertical: 4 },
    friendChip: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#505BEB",
        marginRight: 8,
    },
    friendChipSelected: {
        backgroundColor: "#505BEB",
    },
    friendChipText: {
        color: "#505BEB",
        fontWeight: "500",
    },
    friendChipTextSelected: {
        color: "#fff",
    },
    emptyFriendsText: {
        color: "#6E7D93",
        fontSize: 12,
        marginTop: 4,
    },
});
