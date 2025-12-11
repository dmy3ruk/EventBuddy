import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { db } from "../../../FirebaseConfig";
import { getAuth } from "firebase/auth";
import {
    collection,
    addDoc,
    query,
    onSnapshot,
    orderBy,
    serverTimestamp,
} from "firebase/firestore";

type Message = {
    id: string;
    text: string;
    userId: string;
    createdAt: any;
};

export default function ChatScreen() {
    const { eventId } = useLocalSearchParams<{ eventId: string }>();
    const [messages, setMessages] = useState<Message[]>([]);
    const [text, setText] = useState("");
    const auth = getAuth();
    const user = auth.currentUser;

    useEffect(() => {
        if (!eventId) return;

        const q = query(
            collection(db, "events", eventId, "messages"),
            orderBy("createdAt", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: Message[] = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...(doc.data() as any),
            }));
            setMessages(list);
        });

        return () => unsubscribe();
    }, [eventId]);

    const sendMessage = async () => {
        if (!text.trim() || !user || !eventId) return;

        await addDoc(collection(db, "events", eventId, "messages"), {
            text: text.trim(),
            userId: user.uid,
            createdAt: serverTimestamp(),
        });

        setText("");
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isMine = item.userId === user?.uid;
        return (
            <View
                style={[
                    styles.message,
                    isMine ? styles.myMessage : styles.otherMessage,
                ]}
            >
                <Text style={styles.messageText}>{item.text}</Text>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <FlatList
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.messagesList}
            />

            <View style={styles.inputRow}>
                <TextInput
                    style={styles.input}
                    placeholder="Message..."
                    value={text}
                    onChangeText={setText}
                />
                <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
                    <Text style={styles.sendText}>Send</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F9F9F9" },
    messagesList: { padding: 12, paddingBottom: 4 },
    message: {
        padding: 10,
        borderRadius: 10,
        marginVertical: 4,
        maxWidth: "75%",
    },
    myMessage: {
        alignSelf: "flex-end",
        backgroundColor: "#505BEB",
    },
    otherMessage: {
        alignSelf: "flex-start",
        backgroundColor: "#E2E8F0",
    },
    messageText: { color: "#000" },
    inputRow: {
        flexDirection: "row",
        padding: 8,
        borderTopWidth: 0.5,
        borderColor: "#E2E8F0",
        backgroundColor: "#FFFFFF",
    },
    input: {
        flex: 1,
        backgroundColor: "#FFF",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
    },
    sendBtn: {
        backgroundColor: "#505BEB",
        paddingHorizontal: 16,
        borderRadius: 20,
        justifyContent: "center",
    },
    sendText: { color: "#fff", fontWeight: "600" },
});
