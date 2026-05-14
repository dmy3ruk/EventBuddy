import React, { useEffect, useState, useRef } from "react";
import * as SystemUI from "expo-system-ui";
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
    StatusBar,
    Alert,
    Dimensions,
    ActivityIndicator,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons, Feather } from "@expo/vector-icons";
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
    updateDoc,
    setDoc,
    writeBatch,
    arrayUnion,
    deleteDoc,
    getDocs,
    getDoc,
} from "firebase/firestore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import ImageZoomRaw from "react-native-image-pan-zoom";
import { sendPushNotification } from "@/utils/Notification";

const ImageZoom = ImageZoomRaw as any;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

const COLORS = {
    primary: "#505BEB",
    bg: "#F1F5F9",
    white: "#FFFFFF",
    textMain: "#1A1A1A",
    textMuted: "#64748B",
    bubbleMine: "#505BEB",
    bubbleOther: "#FFFFFF",
    borderOther: "#E2E8F0",
    destructive: "#EF4444",
};

SystemUI.setBackgroundColorAsync("#FFFFFF");

export default function ChatScreen() {
    const insets = useSafeAreaInsets();
    const route = useRoute<any>();
    const { eventId, name, time, date, participantsCount } = route.params || {};

    const [messages, setMessages] = useState<any[]>([]);
    const [pinnedMsg, setPinnedMsg] = useState<any>(null);
    const [inputText, setInputText] = useState("");
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [menuMessage, setMenuMessage] = useState<any | null>(null);
    const [isMenuVisible, setIsMenuVisible] = useState(false);
    const [isInfoVisible, setIsInfoVisible] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});

    const listRef = useRef<FlatList<any> | null>(null);
    const navigation = useNavigation<any>();
    const authUser = getAuth().currentUser;
    const currentUserName = authUser?.displayName || "User";

    useEffect(() => {
        if (!authUser || !eventId) return;

        const statusDocRef = doc(db, "users", authUser.uid, "chatStatus", eventId);

        updateDoc(statusDocRef, { lastRead: serverTimestamp() }).catch(() => {
            setDoc(statusDocRef, { lastRead: serverTimestamp() });
        });
    }, [authUser, eventId]);

    useEffect(() => {
        if (!eventId || !authUser) return;

        const q = query(
            collection(db, "events", eventId, "messages"),
            orderBy("createdAt", "asc")
        );

        const unsubscribeMessages = onSnapshot(q, async (snapshot) => {
            const fetchedMessages = snapshot.docs.map((d) => ({
                id: d.id,
                ...d.data(),
            }));

            setMessages(fetchedMessages);

            const batch = writeBatch(db);
            let needsUpdate = false;

            snapshot.docs.forEach((d) => {
                const data = d.data();

                if (
                    data.userId !== authUser.uid &&
                    !(data.readBy || []).includes(authUser.uid)
                ) {
                    batch.update(d.ref, { readBy: arrayUnion(authUser.uid) });
                    needsUpdate = true;
                }
            });

            if (needsUpdate) {
                await batch.commit();
            }
        });

        const unsubscribeEvent = onSnapshot(doc(db, "events", eventId), (docSnap) => {
            if (docSnap.exists()) {
                setPinnedMsg(docSnap.data().pinnedMessage || null);
            }
        });

        return () => {
            unsubscribeMessages();
            unsubscribeEvent();
        };
    }, [eventId, authUser]);

    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [messages]);

    const sendChatNotifications = async (messageText: string) => {
        if (!authUser || !eventId) return;

        try {
            const eventDoc = await getDoc(doc(db, "events", eventId));

            if (!eventDoc.exists()) return;

            const eventData = eventDoc.data();

            const participantIds = [
                eventData.organizerId,
                ...(eventData.acceptedUserIds || []),
                ...(eventData.joinedUserIds || []),
            ];

            const uniqueParticipantIds = [...new Set(participantIds)].filter(
                (uid) => uid && uid !== authUser.uid
            );

            console.log("Sending notifications to:", uniqueParticipantIds.length, "users");

            const truncatedMessage =
                messageText.length > 100
                    ? messageText.substring(0, 100) + "..."
                    : messageText;

            // Паралельна відправка — значно швидше при багатьох учасниках
            const results = await Promise.allSettled(
                uniqueParticipantIds.map(async (uid) => {
                    const userDoc = await getDoc(doc(db, "users", uid));

                    if (!userDoc.exists()) {
                        console.log("User document not found:", uid);
                        return;
                    }

                    const userData = userDoc.data();

                    if (userData?.eventNotifications === false) {
                        console.log("User disabled notifications:", uid);
                        return;
                    }

                    const token = userData?.pushToken;

                    if (!token) {
                        console.log("No token for user:", uid);
                        return;
                    }

                    await sendPushNotification(
                        token,
                        `New message in "${name}"`,
                        `${currentUserName}: ${truncatedMessage}`
                    );

                    console.log("Notification sent to:", uid);
                })
            );

            const successCount = results.filter((r) => r.status === "fulfilled").length;
            const failCount = results.filter((r) => r.status === "rejected").length;

            console.log(`Notifications: ${successCount} sent, ${failCount} failed`);
        } catch (error) {
            console.log("Chat notification error:", error);
        }
    };

    const handleSendMessage = async () => {
        if (!inputText.trim() || !authUser || !eventId) return;

        const textToSend = inputText.trim();
        setInputText("");

        try {
            if (editingMessageId) {
                await updateDoc(doc(db, "events", eventId, "messages", editingMessageId), {
                    text: textToSend,
                    editedAt: serverTimestamp(),
                });

                setEditingMessageId(null);
            } else {
                await addDoc(collection(db, "events", eventId, "messages"), {
                    text: textToSend,
                    userId: authUser.uid,
                    authorName: currentUserName,
                    createdAt: serverTimestamp(),
                    readBy: [authUser.uid],
                    type: "text",
                });

                await sendChatNotifications(textToSend);
            }

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (e) {
            console.error("Error sending message:", e);
            Alert.alert("Error", "Failed to send message");
        }
    };

    const pickImageAndSend = async () => {
        if (isUploadingImage || !authUser || !eventId) return;

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== "granted") {
            Alert.alert("Permission denied", "We need access to your gallery");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.25,
            allowsEditing: false,
        });

        if (result.canceled || !result.assets?.[0]?.uri) return;

        setIsUploadingImage(true);

        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
                Alert.alert("Error", "Cloudinary env variables are missing");
                return;
            }

            const asset = result.assets[0];

            const data = new FormData();
            data.append("file", {
                uri: asset.uri,
                name: `chat_${Date.now()}.jpg`,
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
                console.error("Cloudinary upload error:", json);
                Alert.alert("Error", "Failed to upload image");
                return;
            }

            await addDoc(collection(db, "events", eventId, "messages"), {
                userId: authUser.uid,
                authorName: currentUserName,
                createdAt: serverTimestamp(),
                readBy: [authUser.uid],
                type: "image",
                imageUrl: json.secure_url.replace(
                    "/upload/",
                    "/upload/f_auto,q_auto,w_900/"
                ),
            });

            await sendChatNotifications("Sent a photo");

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {
            console.error("Image upload error:", e);
            Alert.alert("Error", "Failed to upload image");
        } finally {
            setIsUploadingImage(false);
        }
    };

    const saveImageToGallery = async (url: string) => {
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();

            if (status !== "granted") {
                Alert.alert("No access", "Grant media library access to save photos");
                return;
            }

            const fileUri = `${FileSystem.cacheDirectory}event_${Date.now()}.jpg`;
            const downloadRes = await FileSystem.downloadAsync(url, fileUri);
            const asset = await MediaLibrary.createAssetAsync(downloadRes.uri);

            await MediaLibrary.createAlbumAsync("EventBuddy", asset, false);

            Alert.alert("Success", "Photo saved to gallery");
        } catch (e) {
            Alert.alert("Error", "Failed to save photo");
        }
    };

    const handleDeleteMessage = async (messageId: string) => {
        Alert.alert("Delete message?", "Removed for everyone.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    await deleteDoc(doc(db, "events", eventId, "messages", messageId));

                    await addDoc(collection(db, "events", eventId, "messages"), {
                        text: `${currentUserName} deleted a message`,
                        type: "system",
                        createdAt: serverTimestamp(),
                    });

                    setIsMenuVisible(false);
                },
            },
        ]);
    };

    const handlePinMessage = async (message: any) => {
        await updateDoc(doc(db, "events", eventId), {
            pinnedMessage: {
                id: message.id,
                text: message.type === "image" ? "📷 Photo" : message.text,
                authorName: message.authorName,
            },
        });

        await addDoc(collection(db, "events", eventId, "messages"), {
            text: `${currentUserName} pinned a message`,
            type: "system",
            createdAt: serverTimestamp(),
        });

        setIsMenuVisible(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const clearChat = async () => {
        Alert.alert("Clear chat?", "This will delete all messages for everyone.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Clear",
                style: "destructive",
                onPress: async () => {
                    const snap = await getDocs(collection(db, "events", eventId, "messages"));
                    const batch = writeBatch(db);

                    snap.forEach((d) => batch.delete(d.ref));

                    await batch.commit();
                    setIsInfoVisible(false);
                },
            },
        ]);
    };

    const renderMessageItem = ({ item, index }: { item: any; index: number }) => {
        const isMine = item.userId === authUser?.uid;
        const prevMessage = messages[index - 1];
        const isSameAuthor =
            prevMessage?.userId === item.userId && prevMessage?.type !== "system";

        const isImage = item.type === "image";

        if (item.type === "system") {
            return (
                <View style={styles.systemRow}>
                    <Text style={styles.systemText}>{item.text.toUpperCase()}</Text>
                </View>
            );
        }

        return (
            <View
                style={[
                    styles.msgRow,
                    isMine ? styles.rowMine : styles.rowOther,
                    isSameAuthor && { marginTop: -8 },
                ]}
            >
                {!isMine && !isSameAuthor && (
                    <View style={styles.avatarSmall}>
                        <Text style={styles.avatarTextSmall}>{item.authorName?.[0]}</Text>
                    </View>
                )}

                {!isMine && isSameAuthor && <View style={{ width: 38 }} />}

                <TouchableOpacity
                    activeOpacity={0.8}
                    onLongPress={() => {
                        Haptics.selectionAsync();
                        setMenuMessage(item);
                        setIsMenuVisible(true);
                    }}
                    onPress={() => {
                        if (isImage && item.imageUrl) {
                            setPreviewImage(item.imageUrl);
                            setIsPreviewVisible(true);
                        }
                    }}
                    style={[
                        styles.bubble,
                        isMine ? styles.bubbleMine : styles.bubbleOther,
                        isImage && styles.bubbleImage,
                    ]}
                >
                    {!isMine && !isSameAuthor && !isImage && (
                        <Text style={styles.authorName}>{item.authorName}</Text>
                    )}

                    {isImage ? (
                        <View style={styles.imageWrapper}>
                            {loadingImages[item.id] !== false && (
                                <View style={styles.imageLoader}>
                                    <ActivityIndicator color="#FFFFFF" />
                                    <Text style={styles.imageLoaderText}>Loading...</Text>
                                </View>
                            )}

                            <Image
                                source={{ uri: item.imageUrl }}
                                style={styles.msgImage}
                                resizeMode="cover"
                                onLoadStart={() =>
                                    setLoadingImages((prev) => ({ ...prev, [item.id]: true }))
                                }
                                onLoadEnd={() =>
                                    setLoadingImages((prev) => ({ ...prev, [item.id]: false }))
                                }
                                onError={(e) => {
                                    console.log("Image load error:", e.nativeEvent.error);
                                    setLoadingImages((prev) => ({ ...prev, [item.id]: false }));
                                }}
                            />
                        </View>
                    ) : (
                        <Text style={[styles.msgText, isMine && { color: "#FFF" }]}>
                            {item.text}
                        </Text>
                    )}

                    <View style={styles.msgFooter}>
                        <Text style={[styles.msgTime, isMine && { color: "rgba(255,255,255,0.7)" }]}>
                            {item.createdAt
                                ? new Date(
                                    item.createdAt.toDate?.() || item.createdAt
                                ).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })
                                : ""}
                        </Text>

                        {isMine && (
                            <Ionicons
                                name="checkmark-done"
                                size={14}
                                color="rgba(255,255,255,0.6)"
                                style={{ marginLeft: 4 }}
                            />
                        )}
                    </View>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={styles.mainContainer}>
            <StatusBar barStyle="dark-content" />

            <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
                        <Feather name="chevron-left" size={28} color={COLORS.primary} />
                    </TouchableOpacity>

                    <View style={styles.headerInfo}>
                        <Text style={styles.headerTitle} numberOfLines={1}>
                            {name}
                        </Text>
                        <Text style={styles.headerSubtitle}>
                            {participantsCount} members • {time}
                        </Text>
                    </View>

                    <TouchableOpacity style={styles.iconButton} onPress={() => setIsInfoVisible(true)}>
                        <Feather name="more-vertical" size={22} color={COLORS.textMuted} />
                    </TouchableOpacity>
                </View>
            </View>

            {pinnedMsg && (
                <TouchableOpacity
                    style={styles.pinnedContainer}
                    activeOpacity={0.8}
                    onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
                >
                    <Ionicons name="pin" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />

                    <View style={{ flex: 1 }}>
                        <Text style={styles.pinnedLabel}>Pinned Message</Text>
                        <Text style={styles.pinnedText} numberOfLines={1}>
                            {pinnedMsg.text}
                        </Text>
                    </View>

                    <TouchableOpacity onPress={() => updateDoc(doc(db, "events", eventId), { pinnedMessage: null })}>
                        <Ionicons name="close" size={20} color={COLORS.textMuted} />
                    </TouchableOpacity>
                </TouchableOpacity>
            )}

            {isUploadingImage && (
                <View style={styles.uploadBanner}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.uploadBannerText}>Uploading photo...</Text>
                </View>
            )}

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <FlatList
                    ref={listRef}
                    data={messages}
                    renderItem={renderMessageItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />

                <View style={{ backgroundColor: COLORS.white }}>
                    {editingMessageId && (
                        <View style={styles.editBar}>
                            <Feather name="edit-2" size={14} color={COLORS.primary} />
                            <Text style={styles.editText}>Editing message...</Text>

                            <TouchableOpacity
                                onPress={() => {
                                    setEditingMessageId(null);
                                    setInputText("");
                                }}
                            >
                                <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={styles.footerContainer}>
                        <View style={styles.inputRow}>
                            <TouchableOpacity
                                style={[styles.attachBtn, isUploadingImage && styles.attachBtnDisabled]}
                                onPress={pickImageAndSend}
                                disabled={isUploadingImage}
                            >
                                {isUploadingImage ? (
                                    <ActivityIndicator size="small" color={COLORS.primary} />
                                ) : (
                                    <Feather name="image" size={22} color={COLORS.primary} />
                                )}
                            </TouchableOpacity>

                            <TextInput
                                style={styles.input}
                                placeholder={isUploadingImage ? "Uploading photo..." : "Message..."}
                                value={inputText}
                                onChangeText={setInputText}
                                multiline
                                editable={!isUploadingImage}
                            />

                            {inputText.trim().length > 0 && (
                                <TouchableOpacity
                                    style={styles.sendBtn}
                                    onPress={handleSendMessage}
                                    disabled={isUploadingImage}
                                >
                                    <Ionicons
                                        name={editingMessageId ? "checkmark" : "arrow-up"}
                                        size={22}
                                        color={COLORS.white}
                                    />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    <View style={{ height: insets.bottom, backgroundColor: COLORS.white }} />
                </View>
            </KeyboardAvoidingView>

            <Modal visible={isMenuVisible} transparent animationType="fade">
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsMenuVisible(false)}
                >
                    <View style={styles.menuCard}>
                        {menuMessage?.type === "text" && (
                            <TouchableOpacity
                                style={styles.menuItem}
                                onPress={() => {
                                    Clipboard.setStringAsync(menuMessage.text);
                                    setIsMenuVisible(false);
                                }}
                            >
                                <Text style={styles.menuText}>Copy</Text>
                                <Feather name="copy" size={18} color={COLORS.textMain} />
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[styles.menuItem, styles.menuBorder]}
                            onPress={() => handlePinMessage(menuMessage)}
                        >
                            <Text style={styles.menuText}>Pin</Text>
                            <Feather name="map-pin" size={18} color={COLORS.textMain} />
                        </TouchableOpacity>

                        {menuMessage?.userId === authUser?.uid && (
                            <>
                                {menuMessage?.type === "text" && (
                                    <TouchableOpacity
                                        style={[styles.menuItem, styles.menuBorder]}
                                        onPress={() => {
                                            setEditingMessageId(menuMessage.id);
                                            setInputText(menuMessage.text);
                                            setIsMenuVisible(false);
                                        }}
                                    >
                                        <Text style={styles.menuText}>Edit</Text>
                                        <Feather name="edit-3" size={18} color={COLORS.textMain} />
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                    style={[styles.menuItem, styles.menuBorder]}
                                    onPress={() => handleDeleteMessage(menuMessage.id)}
                                >
                                    <Text style={[styles.menuText, { color: COLORS.destructive }]}>
                                        Delete
                                    </Text>
                                    <Feather name="trash-2" size={18} color={COLORS.destructive} />
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>

            <Modal visible={isInfoVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.infoCard}>
                        <Text style={styles.infoTitle}>Chat Settings</Text>

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Event:</Text>
                            <Text style={styles.infoValue}>{name}</Text>
                        </View>

                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Time:</Text>
                            <Text style={styles.infoValue}>
                                {date} {time}
                            </Text>
                        </View>

                        <TouchableOpacity style={styles.clearBtn} onPress={clearChat}>
                            <Text style={styles.clearBtnText}>Clear Chat History</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.closeBtn} onPress={() => setIsInfoVisible(false)}>
                            <Text style={styles.closeBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={isPreviewVisible} transparent animationType="fade">
                <View style={styles.previewContainer}>
                    <View style={styles.previewHeader}>
                        <TouchableOpacity onPress={() => setIsPreviewVisible(false)}>
                            <Ionicons name="close" size={32} color="#FFF" />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => saveImageToGallery(previewImage!)}>
                            <Ionicons name="download-outline" size={28} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    <ImageZoom
                        cropWidth={SCREEN_WIDTH}
                        cropHeight={SCREEN_HEIGHT}
                        imageWidth={SCREEN_WIDTH}
                        imageHeight={SCREEN_HEIGHT}
                    >
                        <Image
                            source={{ uri: previewImage || "" }}
                            style={{ width: "100%", height: "100%" }}
                            resizeMode="contain"
                        />
                    </ImageZoom>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: COLORS.bg },
    headerWrapper: {
        backgroundColor: COLORS.white,
        borderBottomWidth: 1,
        borderColor: COLORS.borderOther,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        height: 56,
    },
    headerInfo: { flex: 1, alignItems: "center" },
    headerTitle: { fontSize: 17, fontWeight: "600", color: COLORS.textMain },
    headerSubtitle: { fontSize: 11, color: COLORS.textMuted },
    iconButton: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
    },
    pinnedContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.white,
        padding: 12,
        borderBottomWidth: 1,
        borderColor: COLORS.borderOther,
    },
    pinnedLabel: {
        fontSize: 10,
        fontWeight: "800",
        color: COLORS.primary,
        textTransform: "uppercase",
    },
    pinnedText: { fontSize: 13, color: COLORS.textMain },
    uploadBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: COLORS.white,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderColor: COLORS.borderOther,
    },
    uploadBannerText: {
        color: COLORS.primary,
        fontWeight: "700",
        fontSize: 13,
    },
    listContent: { padding: 16, paddingBottom: 32 },
    msgRow: {
        flexDirection: "row",
        marginBottom: 12,
        alignItems: "flex-end",
    },
    rowMine: { justifyContent: "flex-end" },
    rowOther: { justifyContent: "flex-start" },
    avatarSmall: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: COLORS.primary,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 8,
    },
    avatarTextSmall: { fontSize: 12, fontWeight: "700", color: "#FFF" },
    bubble: { maxWidth: "80%", padding: 12, borderRadius: 20 },
    bubbleMine: {
        backgroundColor: COLORS.bubbleMine,
        borderBottomRightRadius: 4,
    },
    bubbleOther: {
        backgroundColor: COLORS.bubbleOther,
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: COLORS.borderOther,
    },
    bubbleImage: { padding: 4, borderRadius: 16 },
    imageWrapper: {
        width: SCREEN_WIDTH * 0.7,
        height: SCREEN_WIDTH * 0.7,
        borderRadius: 14,
        overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.15)",
    },
    imageLoader: {
        position: "absolute",
        width: SCREEN_WIDTH * 0.7,
        height: SCREEN_WIDTH * 0.7,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 2,
    },
    imageLoaderText: {
        marginTop: 8,
        color: "#FFFFFF",
        fontSize: 12,
        fontWeight: "700",
    },
    msgImage: {
        width: SCREEN_WIDTH * 0.7,
        height: SCREEN_WIDTH * 0.7,
        borderRadius: 14,
    },
    authorName: {
        fontSize: 11,
        fontWeight: "700",
        color: COLORS.primary,
        marginBottom: 2,
    },
    msgText: { fontSize: 15, color: COLORS.textMain },
    msgFooter: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-end",
        marginTop: 4,
    },
    msgTime: { fontSize: 10, color: COLORS.textMuted },
    systemRow: {
        width: "100%",
        alignItems: "center",
        marginVertical: 10,
    },
    systemText: {
        fontSize: 10,
        fontWeight: "800",
        color: COLORS.textMuted,
        letterSpacing: 1,
        textAlign: "center",
    },
    footerContainer: {
        borderTopWidth: 1,
        borderColor: COLORS.borderOther,
        padding: 12,
    },
    inputRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#F1F5F9",
        borderRadius: 24,
        paddingHorizontal: 4,
    },
    input: {
        flex: 1,
        paddingHorizontal: 12,
        fontSize: 16,
        maxHeight: 100,
        paddingVertical: 10,
    },
    attachBtn: { padding: 10 },
    attachBtnDisabled: { opacity: 0.6 },
    sendBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.primary,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 4,
    },
    editBar: {
        flexDirection: "row",
        alignItems: "center",
        padding: 8,
        paddingHorizontal: 16,
        backgroundColor: COLORS.white,
    },
    editText: {
        flex: 1,
        fontSize: 12,
        color: COLORS.textMuted,
        marginLeft: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
    },
    menuCard: {
        width: "75%",
        backgroundColor: COLORS.white,
        borderRadius: 20,
        overflow: "hidden",
    },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 18,
    },
    menuBorder: { borderTopWidth: 1, borderColor: "#F1F5F9" },
    menuText: {
        fontSize: 16,
        fontWeight: "600",
        color: COLORS.textMain,
    },
    infoCard: {
        width: "85%",
        backgroundColor: COLORS.white,
        borderRadius: 28,
        padding: 24,
    },
    infoTitle: {
        fontSize: 22,
        fontWeight: "800",
        marginBottom: 20,
        color: COLORS.primary,
    },
    infoRow: { flexDirection: "row", marginBottom: 12 },
    infoLabel: {
        width: 60,
        fontWeight: "700",
        color: COLORS.textMuted,
    },
    infoValue: {
        flex: 1,
        color: COLORS.textMain,
        fontWeight: "600",
    },
    clearBtn: {
        backgroundColor: COLORS.destructive + "15",
        padding: 16,
        borderRadius: 16,
        marginTop: 20,
        alignItems: "center",
    },
    clearBtnText: {
        color: COLORS.destructive,
        fontWeight: "800",
    },
    closeBtn: {
        marginTop: 12,
        padding: 16,
        alignItems: "center",
    },
    closeBtnText: {
        color: COLORS.textMuted,
        fontWeight: "700",
    },
    previewContainer: { flex: 1, backgroundColor: "#000" },
    previewHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 50,
        zIndex: 10,
    },
});