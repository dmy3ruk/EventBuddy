import React, { useState } from "react";
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
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../FirebaseConfig";

type ModalScreenProps = {
    visible: boolean;
    closeModal: () => void;
};

export default function ModalScreen({ visible, closeModal }: ModalScreenProps) {
    const [name, setName] = useState("");
    const [date, setDate] = useState(new Date());
    const [time, setTime] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [friends, setFriends] = useState("");
    const [details, setDetails] = useState("");

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
                friends,
                details,
                userId: user.uid,
                createdAt: serverTimestamp(),
            });
            alert("Подія додана!");
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

                    {/* Інші поля */}
                    <TextInput
                        style={[styles.input, { marginTop: 10 }]}
                        placeholder="Invite friends"
                        value={friends}
                        onChangeText={setFriends}
                    />
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
});
