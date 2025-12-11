import React, { useEffect, useState, useRef } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    Image,
    Modal,
    ActionSheetIOS,
    Alert,
} from "react-native";

import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";

import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../../FirebaseConfig";
import { getAuth } from "firebase/auth";
import {
    collection,
    addDoc,
    query,
    onSnapshot,
    orderBy,
    serverTimestamp,
    doc,
    getDoc,
    updateDoc,
    setDoc,
    writeBatch,
    arrayUnion,
    deleteDoc,
    getDocs,
} from "firebase/firestore";

type Message = {
    id: string;
    text?: string;
    userId?: string;
    authorName?: string;
    createdAt: any;
    readBy?: string[];
    type?: "text" | "image" | "system";
    imageUrl?: string;
    pinned?: boolean;
};

const CLOUDINARY_CLOUD_NAME = "dxcqqbrpb";
const CLOUDINARY_UPLOAD_PRESET = "eventbuddy_unsigned";

export default function ChatScreen() {
    const route = useRoute<any>();
    const { eventId, name, date, time, participantsCount } = route.params || {};

    const [messages, setMessages] = useState<Message[]>([]);
    const [text, setText] = useState("");
    const [myName, setMyName] = useState<string>("You");

    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);

    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

    const [menuMessage, setMenuMessage] = useState<Message | null>(null);
    const [isMenuVisible, setIsMenuVisible] = useState(false);

    const [isChatInfoVisible, setIsChatInfoVisible] = useState(false);

    const listRef = useRef<FlatList<Message> | null>(null);

    const navigation = useNavigation<any>();
    const auth = getAuth();
    const user = auth.currentUser;

    // lastRead
    useEffect(() => {
        if (!user || !eventId) return;

        const refDoc = doc(db, "users", user.uid, "chatStatus", eventId as string);
        updateDoc(refDoc, { lastRead: serverTimestamp() }).catch(async () => {
            await setDoc(refDoc, { lastRead: serverTimestamp() });
        });
    }, [user, eventId]);

    // моє імʼя
    useEffect(() => {
        const loadMyName = async () => {
            if (!user) return;
            try {
                const snap = await getDoc(doc(db, "usernames", user.uid));
                if (snap.exists()) {
                    setMyName(snap.data().username || "You");
                }
            } catch (e) {
                console.log("Error loading username:", e);
            }
        };
        loadMyName();
    }, [user]);

    // повідомлення + readBy
    useEffect(() => {
        if (!eventId || !user) return;

        const q = query(
            collection(db, "events", eventId as string, "messages"),
            orderBy("createdAt", "asc")
        );

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const list: Message[] = snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...(docSnap.data() as any),
            }));
            setMessages(list);

            const batch = writeBatch(db);
            let hasUpdates = false;

            snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data() as any;
                const isMine = data.userId === user.uid;
                const readBy: string[] = data.readBy || [];

                if (!isMine && !readBy.includes(user.uid)) {
                    batch.update(docSnap.ref, {
                        readBy: arrayUnion(user.uid),
                    });
                    hasUpdates = true;
                }
            });

            if (hasUpdates) {
                try {
                    await batch.commit();
                } catch (e) {
                    console.log("Error marking as read:", e);
                }
            }
        });

        return () => unsubscribe();
    }, [eventId, user]);

    // pinned + editing message
    const pinnedMessage = messages.find((m) => m.pinned);
    const editingMessage = editingMessageId
        ? messages.find((m) => m.id === editingMessageId) || null
        : null;

    const scrollToPinned = () => {
        if (!pinnedMessage) return;
        const index = messages.findIndex((m) => m.id === pinnedMessage.id);
        if (index === -1) return;

        try {
            listRef.current?.scrollToIndex({
                index,
                animated: true,
            });
        } catch (e) {
            console.log("scrollToPinned error", e);
        }
    };

    // створення/редагування текстового повідомлення
    const sendMessage = async () => {
        if (!text.trim() || !user || !eventId) return;

        if (editingMessageId) {
            try {
                const msgRef = doc(
                    db,
                    "events",
                    eventId as string,
                    "messages",
                    editingMessageId
                );

                await updateDoc(msgRef, {
                    text: text.trim(),
                    editedAt: serverTimestamp(),
                });

                setEditingMessageId(null);
                setText("");
            } catch (e) {
                console.log("Error updating message:", e);
                Alert.alert("Помилка", "Не вдалося оновити повідомлення");
            }
            return;
        }

        await addDoc(collection(db, "events", eventId as string, "messages"), {
            text: text.trim(),
            userId: user.uid,
            authorName: myName,
            createdAt: serverTimestamp(),
            readBy: [user.uid],
            type: "text",
            pinned: false,
        });

        setText("");
    };

    // вибір і відправка фото через Cloudinary
    const pickImageAndSend = async () => {
        if (!user || !eventId) return;

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            alert("Доступ до галереї заборонений");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
        });

        if (result.canceled) return;

        try {
            const asset = result.assets[0];

            const data = new FormData();
            data.append("file", {
                uri: asset.uri,
                name: `event_${eventId}_${Date.now()}.jpg`,
                type: "image/jpeg",
            } as any);
            data.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

            const res = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
                {
                    method: "POST",
                    body: data,
                }
            );

            const json = await res.json();

            if (!res.ok) {
                console.log("Cloudinary error:", json);
                alert("Не вдалося завантажити фото");
                return;
            }

            const downloadURL = json.secure_url as string;

            await addDoc(collection(db, "events", eventId as string, "messages"), {
                userId: user.uid,
                authorName: myName,
                createdAt: serverTimestamp(),
                readBy: [user.uid],
                type: "image",
                imageUrl: downloadURL,
                pinned: false,
            });
        } catch (e) {
            console.log("Error sending image via Cloudinary:", e);
            alert("Не вдалося надіслати фото");
        }
    };

    // збереження фото в галерею
    const saveImageToGallery = async (url: string) => {
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== "granted") {
                Alert.alert(
                    "Нема доступу",
                    "Дай доступ до медіатеки, щоб зберігати фото"
                );
                return;
            }

            const dir =
                (FileSystem.documentDirectory ??
                    FileSystem.cacheDirectory ??
                    FileSystem.documentDirectory!) + "";

            const fileUri = `${dir}event_${Date.now()}.jpg`;

            const downloadRes = await FileSystem.downloadAsync(url, fileUri);

            const asset = await MediaLibrary.createAssetAsync(downloadRes.uri);
            await MediaLibrary.createAlbumAsync("EventBuddy", asset, false);

            Alert.alert("Готово", "Фото збережене у галерею");
        } catch (e) {
            console.log("Error saving image:", e);
            Alert.alert("Помилка", "Не вдалося зберегти фото");
        }
    };

    // меню в превʼю картинки (три крапки)
    const openImageMenu = () => {
        if (!previewImage) return;

        if (Platform.OS === "ios") {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: ["Зберегти в галерею", "Скасувати"],
                    cancelButtonIndex: 1,
                },
                async (buttonIndex) => {
                    if (buttonIndex === 0) {
                        await saveImageToGallery(previewImage);
                    }
                }
            );
        } else {
            Alert.alert("Фото", undefined, [
                {
                    text: "Зберегти в галерею",
                    onPress: () => saveImageToGallery(previewImage),
                },
                { text: "Скасувати", style: "cancel" },
            ]);
        }
    };

    // довгий тап по своєму повідомленню (текст або фото)
    const handleLongPressMessage = (msg: Message) => {
        if (!user) return;
        if (msg.userId !== user.uid) return;

        setMenuMessage(msg);
        setIsMenuVisible(true);
    };

    const formatTime = (msg: Message) => {
        const ts: any = msg.createdAt;
        if (!ts) return "";
        let d: Date;
        if (ts.toDate) d = ts.toDate();
        else d = new Date(ts);
        const hh = d.getHours().toString().padStart(2, "0");
        const mm = d.getMinutes().toString().padStart(2, "0");
        return `${hh}:${mm}`;
    };

    // очистка чату
    const clearChatMessages = async () => {
        if (!eventId) return;

        try {
            const messagesRef = collection(
                db,
                "events",
                eventId as string,
                "messages"
            );

            const snapshot = await getDocs(messagesRef);

            if (snapshot.empty) {
                Alert.alert("Чат порожній");
                return;
            }

            const batch = writeBatch(db);
            snapshot.forEach((docSnap) => {
                batch.delete(docSnap.ref);
            });

            await batch.commit();

            Alert.alert("Готово", "Чат очищено");
        } catch (e) {
            console.log("Error clearing chat:", e);
            Alert.alert("Помилка", "Не вдалося очистити чат");
        }
    };

    const confirmClearChat = () => {
        Alert.alert(
            "Очистити чат",
            "Усі повідомлення цього чату будуть видалені для всіх учасників. Продовжити?",
            [
                { text: "Скасувати", style: "cancel" },
                {
                    text: "Очистити",
                    style: "destructive",
                    onPress: async () => {
                        await clearChatMessages();
                        setIsChatInfoVisible(false);
                    },
                },
            ]
        );
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isSystem =
            item.type === "system" || (!item.userId && item.type !== "image");
        const isMine = item.userId === user?.uid;
        const initials =
            (item.authorName || "")
                .trim()
                .charAt(0)
                .toUpperCase() || "?";

        if (isSystem) {
            return (
                <View style={styles.systemRow}>
                    <View style={styles.systemBubble}>
                        {!!item.text && (
                            <Text style={styles.systemText}>{item.text}</Text>
                        )}
                    </View>
                </View>
            );
        }

        // окремий рендер для повідомлення з фото
        if (item.type === "image" && item.imageUrl) {
            return (
                <View
                    style={[
                        styles.messageRow,
                        isMine ? styles.messageRowMine : styles.messageRowOther,
                    ]}
                >
                    {!isMine && (
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{initials}</Text>
                        </View>
                    )}

                    <TouchableOpacity
                        activeOpacity={0.9}
                        delayLongPress={250}
                        onLongPress={() => handleLongPressMessage(item)}
                    >
                        <View
                            style={[
                                styles.imageBubble,
                                isMine ? styles.bubbleMine : styles.bubbleOther,
                            ]}
                        >
                            {item.pinned && (
                                <Text style={styles.pinnedLabel}>Pinned</Text>
                            )}

                            <TouchableOpacity
                                onPress={() => {
                                    setPreviewImage(item.imageUrl!);
                                    setIsPreviewVisible(true);
                                }}
                                activeOpacity={0.9}
                            >
                                <Image
                                    source={{ uri: item.imageUrl }}
                                    style={styles.imageMessage}
                                    resizeMode="cover"
                                />
                            </TouchableOpacity>

                            <Text
                                style={[
                                    styles.messageTimeImage,
                                    isMine && { color: "#E5E7EB" },
                                ]}
                            >
                                {formatTime(item)}
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>
            );
        }

        const bubbleContent = () => (
            <View
                style={[
                    styles.bubble,
                    isMine ? styles.bubbleMine : styles.bubbleOther,
                ]}
            >
                {item.pinned && (
                    <Text style={styles.pinnedLabel}>Pinned</Text>
                )}

                {!isMine && (
                    <Text style={styles.senderName}>
                        {item.authorName || "Participant"}
                    </Text>
                )}

                <Text
                    style={[
                        styles.messageText,
                        isMine && { color: "#FFFFFF" },
                    ]}
                >
                    {item.text}
                </Text>
                <Text
                    style={[
                        styles.messageTime,
                        isMine && { color: "#E5E7EB" },
                    ]}
                >
                    {formatTime(item)}
                </Text>
            </View>
        );

        // текстове повідомлення
        return (
            <View
                style={[
                    styles.messageRow,
                    isMine ? styles.messageRowMine : styles.messageRowOther,
                ]}
            >
                {!isMine && (
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                )}

                <TouchableOpacity
                    activeOpacity={0.9}
                    delayLongPress={250}
                    onLongPress={() => handleLongPressMessage(item)}
                >
                    {bubbleContent()}
                </TouchableOpacity>
            </View>
        );
    };

    const subtitle = [date, time].filter(Boolean).join(" • ");

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            {/* HEADER */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity
                        onPress={() => navigation.navigate("Home")}
                        style={styles.backButton}
                        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                    >
                        <Ionicons name="chevron-back" size={34} color="black" />
                    </TouchableOpacity>
                    <View style={styles.headerIcon}>
                        <Ionicons name="calendar-outline" size={18} color="#505BEB" />
                    </View>
                    <View style={styles.headerTextBlock}>
                        <Text style={styles.eventTitle}>{name || "Event chat"}</Text>
                        {!!subtitle && (
                            <Text style={styles.eventSubtitle}>{subtitle}</Text>
                        )}
                        {typeof participantsCount === "number" && (
                            <Text style={styles.participantsText}>
                                {participantsCount} participants
                            </Text>
                        )}
                    </View>
                </View>
                <TouchableOpacity
                    onPress={() => setIsChatInfoVisible(true)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="ellipsis-vertical" size={18} color="#6E7D93" />
                </TouchableOpacity>
            </View>

            {/* PINNED MESSAGE BAR */}
            {pinnedMessage && (
                <TouchableOpacity
                    style={styles.pinnedBar}
                    activeOpacity={0.8}
                    onPress={scrollToPinned}
                >
                    <View style={styles.pinnedBarLeft}>
                        <Ionicons
                            name="pin-outline"
                            size={20}
                            color="green"
                            style={{ marginRight: 8 }}
                        />
                        <View style={styles.pinnedBarTextBox}>
                            <Text style={styles.pinnedBarTitle}>
                                Pinned message
                            </Text>
                            <Text
                                style={styles.pinnedBarPreview}
                                numberOfLines={1}
                            >
                                {pinnedMessage.text ||
                                    (pinnedMessage.type === "image"
                                        ? "Photo"
                                        : "")}
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity>
            )}

            {/* MESSAGES */}
            <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.messagesList}
                onScrollToIndexFailed={(info) => {
                    setTimeout(() => {
                        listRef.current?.scrollToIndex({
                            index: info.index,
                            animated: true,
                        });
                    }, 50);
                }}
            />

            {/* EDITING BAR (над інпутом) */}
            {editingMessage && (
                <View style={styles.editBar}>
                    <View style={styles.editBarLeft}>
                        <Ionicons
                            name="create-outline"
                            size={20}
                            color="#7ea3e5"
                            style={{ marginRight: 6 }}
                        />
                        <View style={styles.editBarTextBox}>
                            <Text style={styles.editBarTitle}>
                                Редагувати повідомлення
                            </Text>
                            <Text
                                style={styles.editBarPreview}
                                numberOfLines={1}
                            >
                                {editingMessage.text}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={() => {
                            setEditingMessageId(null);
                            setText("");
                        }}
                    >
                        <Ionicons name="close" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                </View>
            )}

            {/* INPUT */}
            <View style={styles.inputBar}>
                <View style={styles.inputContainer}>
                    <TouchableOpacity
                        style={styles.attachBtn}
                        onPress={pickImageAndSend}
                    >
                        <Ionicons name="attach-outline" size={20} color="#6E7D93" />
                    </TouchableOpacity>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Type a message..."
                        value={text}
                        onChangeText={setText}
                        multiline
                    />
                </View>
                <TouchableOpacity style={styles.sendFab} onPress={sendMessage}>
                    <Ionicons name="send" size={18} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* PREVIEW IMAGE MODAL */}
            {previewImage && (
                <Modal
                    visible={isPreviewVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setIsPreviewVisible(false)}
                >
                    <View style={styles.previewBackdrop}>
                        <View style={styles.previewContent}>
                            <View style={styles.previewHeader}>
                                <TouchableOpacity
                                    onPress={() => setIsPreviewVisible(false)}
                                >
                                    <Ionicons
                                        name="close"
                                        size={24}
                                        color="#111827"
                                    />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={openImageMenu}>
                                    <Ionicons
                                        name="ellipsis-vertical"
                                        size={22}
                                        color="#111827"
                                    />
                                </TouchableOpacity>
                            </View>
                            <Image
                                source={{ uri: previewImage }}
                                style={styles.previewImage}
                                resizeMode="contain"
                            />
                        </View>
                    </View>
                </Modal>
            )}

            {/* MESSAGE MENU MODAL */}
            {menuMessage && (
                <Modal
                    visible={isMenuVisible}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setIsMenuVisible(false)}
                >
                    <View style={styles.menuBackdrop}>
                        <View style={styles.menuContainer}>
                            {(menuMessage.text || menuMessage.imageUrl) && (
                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={async () => {
                                        const value =
                                            menuMessage.text ||
                                            menuMessage.imageUrl ||
                                            "";
                                        await Clipboard.setStringAsync(value);
                                        setIsMenuVisible(false);
                                    }}
                                >
                                    <Text style={styles.menuItemText}>
                                        Copy
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {menuMessage.type === "text" && menuMessage.text && (
                                <TouchableOpacity
                                    style={styles.menuItem}
                                    onPress={() => {
                                        setEditingMessageId(menuMessage.id);
                                        setText(menuMessage.text || "");
                                        setIsMenuVisible(false);
                                    }}
                                >
                                    <Text style={styles.menuItemText}>
                                        Edit
                                    </Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={async () => {
                                    if (!eventId || !menuMessage) return;

                                    try {
                                        const messagesRef = collection(
                                            db,
                                            "events",
                                            eventId as string,
                                            "messages"
                                        );

                                        // якщо вже pinned — просто знімаємо
                                        if (menuMessage.pinned) {
                                            const msgRef = doc(
                                                db,
                                                "events",
                                                eventId as string,
                                                "messages",
                                                menuMessage.id
                                            );
                                            await updateDoc(msgRef, {
                                                pinned: false,
                                            });
                                        } else {
                                            // робимо щоб було тільки одне pinned
                                            const snapshot = await getDocs(
                                                messagesRef
                                            );
                                            const batch = writeBatch(db);

                                            snapshot.forEach((docSnap) => {
                                                const data = docSnap.data() as any;
                                                if (docSnap.id === menuMessage.id) {
                                                    batch.update(docSnap.ref, {
                                                        pinned: true,
                                                    });
                                                } else if (data.pinned) {
                                                    batch.update(docSnap.ref, {
                                                        pinned: false,
                                                    });
                                                }
                                            });

                                            await batch.commit();
                                        }
                                    } catch (e) {
                                        console.log("Error pinning message:", e);
                                    } finally {
                                        setIsMenuVisible(false);
                                    }
                                }}
                            >
                                <Text style={styles.menuItemText}>
                                    {menuMessage.pinned ? "Unpin" : "Pin"}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.menuItem, styles.menuItemDestructive]}
                                onPress={async () => {
                                    try {
                                        await deleteDoc(
                                            doc(
                                                db,
                                                "events",
                                                eventId as string,
                                                "messages",
                                                menuMessage.id
                                            )
                                        );
                                    } catch (e) {
                                        console.log("Error deleting message:", e);
                                        Alert.alert(
                                            "Помилка",
                                            "Не вдалося видалити повідомлення"
                                        );
                                    } finally {
                                        setIsMenuVisible(false);
                                    }
                                }}
                            >
                                <Text style={styles.menuItemDestructiveText}>
                                    Delete
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.menuItem, styles.menuItemCancel]}
                                onPress={() => setIsMenuVisible(false)}
                            >
                                <Text style={styles.menuItemText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            )}

            {/* CHAT INFO MODAL */}
            <Modal
                visible={isChatInfoVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsChatInfoVisible(false)}
            >
                <View style={styles.menuBackdrop}>
                    <View style={styles.chatInfoContainer}>
                        {/* Хедер модалки */}
                        <View style={styles.chatInfoHeader}>
                            <Text style={styles.chatInfoTitle}>
                                Chat info
                            </Text>
                            <TouchableOpacity
                                onPress={() => setIsChatInfoVisible(false)}
                            >
                                <Ionicons name="close" size={22} color="#F9FAFB" />
                            </TouchableOpacity>
                        </View>

                        {/* Основна інфа */}
                        <View style={styles.chatInfoBody}>
                            <Text style={styles.chatInfoLabel}>Event name</Text>
                            <Text style={styles.chatInfoValue}>
                                {name || "Event chat"}
                            </Text>

                            {!!subtitle && (
                                <>
                                    <Text style={styles.chatInfoLabel}>
                                        Date & time
                                    </Text>
                                    <Text style={styles.chatInfoValue}>
                                        {subtitle}
                                    </Text>
                                </>
                            )}

                            {typeof participantsCount === "number" && (
                                <>
                                    <Text style={styles.chatInfoLabel}>
                                        Participants
                                    </Text>
                                    <Text style={styles.chatInfoValue}>
                                        {participantsCount} participants
                                    </Text>
                                </>
                            )}
                        </View>

                        {/* Кнопки дій */}
                        <View style={styles.chatInfoActions}>
                            <TouchableOpacity
                                style={styles.chatInfoButtonDestructive}
                                onPress={confirmClearChat}
                            >
                                <Text style={styles.chatInfoButtonDestructiveText}>
                                    Clear chat
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.chatInfoButton}
                                onPress={() => setIsChatInfoVisible(false)}
                            >
                                <Text style={styles.chatInfoButtonText}>
                                    Close
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F9F9F9",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingTop: 70,
        paddingBottom: 10,
        borderBottomWidth: 0.5,
        borderColor: "#E2E8F0",
        backgroundColor: "#FFFFFF",
    },
    headerLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    headerIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#EEF2FF",
        alignItems: "center",
        justifyContent: "center",
    },
    headerTextBlock: {
        flexDirection: "column",
    },
    eventTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#000",
    },
    eventSubtitle: {
        fontSize: 13,
        color: "#6E7D93",
    },
    participantsText: {
        fontSize: 12,
        color: "#6E7D93",
        marginTop: 2,
    },
    messagesList: {
        paddingHorizontal: 0,
        paddingTop: 12,
        paddingBottom: 4,
    },
    systemRow: {
        alignItems: "center",
        marginVertical: 8,
    },
    systemBubble: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: "#E5E7EB",
    },
    systemText: {
        fontSize: 12,
        color: "#4B5563",
    },
    messageRow: {
        width: "100%",
        flexDirection: "row",
        alignItems: "flex-end",
        marginBottom: 8,
    },
    messageRowMine: {
        justifyContent: "flex-end",
        paddingRight: 16,
        paddingLeft: 60,
    },
    messageRowOther: {
        justifyContent: "flex-start",
        paddingLeft: 16,
        paddingRight: 60,
    },
    myMessageWrapper: {
        marginLeft: "auto",
    },
    avatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: "#E2E8F0",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 4,
    },
    avatarText: {
        fontSize: 14,
        fontWeight: "600",
        color: "#4A5568",
    },

    // текстові бульки
    bubble: {
        borderRadius: 18,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    bubbleMine: {
        backgroundColor: "#505BEB",
        borderBottomRightRadius: 4,
    },
    bubbleOther: {
        backgroundColor: "#FFFFFF",
        borderWidth: 0.5,
        borderColor: "#E2E8F0",
        borderBottomLeftRadius: 4,
    },

    // булька з фото
    imageBubble: {
        maxWidth: 260,
        borderRadius: 18,
        paddingHorizontal: 6,
        paddingVertical: 6,
    },

    senderName: {
        fontSize: 12,
        color: "#6E7D93",
        marginBottom: 2,
    },
    messageText: {
        fontSize: 14,
        color: "#111827",
    },
    messageTime: {
        fontSize: 11,
        color: "#A0AEC0",
        alignSelf: "flex-end",
        marginTop: 4,
    },
    imageMessage: {
        width: 230,
        height: 260,
        borderRadius: 12,
        marginTop: 2,
    },
    messageTimeImage: {
        fontSize: 11,
        color: "#A0AEC0",
        alignSelf: "flex-end",
        marginTop: 4,
    },
    inputBar: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderTopWidth: 0.5,
        borderColor: "#E2E8F0",
        backgroundColor: "#FFFFFF",
    },
    inputContainer: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F3F4F6",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    attachBtn: {
        marginRight: 6,
    },
    textInput: {
        flex: 1,
        fontSize: 14,
        maxHeight: 80,
    },
    sendFab: {
        marginLeft: 8,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#505BEB",
        alignItems: "center",
        justifyContent: "center",
    },
    backButton: {
        padding: 0,
    },

    previewBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        alignItems: "center",
    },
    previewContent: {
        width: "90%",
        height: "80%",
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 12,
    },
    previewHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    previewImage: {
        flex: 1,
        borderRadius: 16,
    },

    pinnedLabel: {
        fontSize: 10,
        color: "#FBBF24",
        marginBottom: 2,
        textTransform: "uppercase",
    },
    pinnedBar: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: "rgba(131,238,110,0.3)",
        flexDirection: "row",
        alignItems: "center",
    },
    pinnedBarLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    pinnedBarTextBox: {
        flexShrink: 1,
    },
    pinnedBarTitle: {
        fontSize: 12,
        color: "#134b01",
        marginBottom: 2,
        fontWeight: "600",
    },
    pinnedBarPreview: {
        fontSize: 12,
        color: "#49793d",
    },

    editBar: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: "#1F2937",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    editBarLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    editBarTextBox: {
        flexShrink: 1,
    },
    editBarTitle: {
        fontSize: 12,
        color: "#7ea3e5",
        fontWeight: "600",
        marginBottom: 2,
    },
    editBarPreview: {
        fontSize: 12,
        color: "#E5E7EB",
    },

    menuBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "center",
        alignItems: "center",
    },
    menuContainer: {
        width: "70%",
        backgroundColor: "#2C2533",
        borderRadius: 16,
        paddingVertical: 8,
        overflow: "hidden",
    },
    menuItem: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "rgba(255,255,255,0.08)",
    },
    menuItemText: {
        color: "#F9FAFB",
        fontSize: 14,
    },
    menuItemDestructive: {
        backgroundColor: "#3B1F26",
    },
    menuItemDestructiveText: {
        color: "#FCA5A5",
        fontSize: 14,
    },
    menuItemCancel: {
        borderBottomWidth: 0,
        marginTop: 4,
    },

    chatInfoContainer: {
        width: "85%",
        backgroundColor: "#111827",
        borderRadius: 18,
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    chatInfoHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
    },
    chatInfoTitle: {
        color: "#F9FAFB",
        fontSize: 16,
        fontWeight: "600",
    },
    chatInfoBody: {
        marginBottom: 14,
    },
    chatInfoLabel: {
        fontSize: 12,
        color: "#9CA3AF",
        marginTop: 6,
    },
    chatInfoValue: {
        fontSize: 14,
        color: "#E5E7EB",
        marginTop: 2,
    },
    chatInfoActions: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "rgba(249,250,251,0.08)",
        paddingTop: 10,
        gap: 8,
    },
    chatInfoButton: {
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: "#374151",
        alignItems: "center",
        justifyContent: "center",
    },
    chatInfoButtonText: {
        color: "#F9FAFB",
        fontSize: 14,
        fontWeight: "500",
    },
    chatInfoButtonDestructive: {
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: "#7F1D1D",
        alignItems: "center",
        justifyContent: "center",
    },
    chatInfoButtonDestructiveText: {
        color: "#FCA5A5",
        fontSize: 14,
        fontWeight: "600",
    },
});
