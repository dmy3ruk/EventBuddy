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
    Pressable,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
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

const C = {
    bg: "#F0F2FF",
    headerBg: "#FFFFFF",
    primary: "#505BEB",
    primaryDark: "#3A45D4",
    primaryLight: "rgba(80,91,235,0.12)",
    bubbleMine: "#505BEB",
    bubbleOther: "#FFFFFF",
    bubbleOtherBorder: "#E8EBF8",
    textMain: "#1A1C2E",
    textMuted: "#8890B0",
    white: "#FFFFFF",
    destructive: "#EF4444",
    system: "#A0A8C8",
    inputBg: "#F0F2FF",
    online: "#22C55E",
    reactionBg: "rgba(80,91,235,0.08)",
};

SystemUI.setBackgroundColorAsync(C.headerBg);

const avatarColors = [
    ["#667EEA", "#764BA2"],
    ["#F093FB", "#F5576C"],
    ["#4FACFE", "#00F2FE"],
    ["#43E97B", "#38F9D7"],
    ["#FA709A", "#FEE140"],
    ["#A18CD1", "#FBC2EB"],
];
const getAvatarColor = (name: string) => {
    const idx = (name?.charCodeAt(0) || 0) % avatarColors.length;
    return avatarColors[idx][0];
};

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
    const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
    const [currentUserName, setCurrentUserName] = useState<string>("User");

    const listRef = useRef<FlatList<any> | null>(null);
    const navigation = useNavigation<any>();
    const authUser = getAuth().currentUser;

    // позначити як прочитане
    useEffect(() => {
        if (!authUser || !eventId) return;

        const statusDocRef = doc(
            db,
            "users",
            authUser.uid,
            "chatStatus",
            eventId
        );

        const markRead = async () => {
            await setDoc(
                statusDocRef,
                { lastRead: serverTimestamp() },
                { merge: true }
            );
        };

        markRead();

        return () => {
            markRead();
        };
    }, [authUser, eventId]);

    // Дані користувачів
    useEffect(() => {
        if (!authUser) return;
        const unsub = onSnapshot(doc(db, "users", authUser.uid), (snap) => {
            if (snap.exists()) {
                const d = snap.data();
                setCurrentUserName(d.username || d.name || authUser.displayName || authUser.email?.split("@")[0] || "User");
                setCurrentUserAvatar(d.avatarUrl || null);
            }
        });
        return unsub;
    }, [authUser]);

    // Повідомлення
    useEffect(() => {
        if (!eventId || !authUser) return;
        const q = query(collection(db, "events", eventId, "messages"), orderBy("createdAt", "asc"));
        const unsubMsg = onSnapshot(q, async (snapshot) => {
            setMessages(snapshot.docs.map((d) => ({
                id: d.id,
                ...d.data()
            })));

            await setDoc(
                doc(db, "users", authUser.uid, "chatStatus", eventId),
                { lastRead: serverTimestamp() },
                { merge: true }
            );
        });
        const unsubEvent = onSnapshot(doc(db, "events", eventId), (snap) => {
            if (snap.exists()) setPinnedMsg(snap.data().pinnedMessage || null);
        });
        return () => { unsubMsg(); unsubEvent(); };
    }, [eventId, authUser]);

    useEffect(() => {
        if (messages.length > 0) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }, [messages]);

    // Сповіщення
    const sendChatNotifications = async (messageText: string) => {
        if (!authUser || !eventId) return;
        try {
            const eventDoc = await getDoc(doc(db, "events", eventId));
            if (!eventDoc.exists()) return;
            const eventData = eventDoc.data();
            const ids = [...new Set([eventData.organizerId, ...(eventData.acceptedUserIds || [])])].filter(
                (uid) => uid && uid !== authUser.uid
            );
            const truncated = messageText.length > 100 ? messageText.substring(0, 100) + "..." : messageText;
            await Promise.allSettled(
                ids.map(async (uid) => {
                    const userDoc = await getDoc(doc(db, "users", uid));
                    if (!userDoc.exists()) return;
                    const ud = userDoc.data();
                    if (ud?.eventNotifications === false || !ud?.pushToken) return;
                    await sendPushNotification(ud.pushToken, `New message in "${name}"`, `${currentUserName}: ${truncated}`);
                })
            );
        } catch {}
    };

    // Надіслати
    const handleSendMessage = async () => {
        if (!inputText.trim() || !authUser || !eventId) return;
        const text = inputText.trim();
        setInputText("");
        try {
            if (editingMessageId) {
                await updateDoc(doc(db, "events", eventId, "messages", editingMessageId), { text, editedAt: serverTimestamp() });
                setEditingMessageId(null);
            } else {
                await addDoc(collection(db, "events", eventId, "messages"), {
                    text, userId: authUser.uid, authorName: currentUserName,
                    userAvatar: currentUserAvatar, createdAt: serverTimestamp(),
                    readBy: [authUser.uid], type: "text",
                });
                await sendChatNotifications(text);
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (e) { Alert.alert("Error", "Failed to send message"); }
    };

    // Зображення
    const pickImageAndSend = async () => {
        if (isUploadingImage || !authUser || !eventId) return;
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") { Alert.alert("Permission denied"); return; }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.25 });
        if (result.canceled || !result.assets?.[0]?.uri) return;
        setIsUploadingImage(true);
        try {
            if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) return;
            const asset = result.assets[0];
            const data = new FormData();
            data.append("file", { uri: asset.uri, name: `chat_${Date.now()}.jpg`, type: "image/jpeg" } as any);
            data.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
            const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: "POST", body: data });
            const json = await res.json();
            if (!res.ok) { Alert.alert("Error", "Failed to upload"); return; }
            await addDoc(collection(db, "events", eventId, "messages"), {
                userId: authUser.uid, authorName: currentUserName, userAvatar: currentUserAvatar,
                createdAt: serverTimestamp(), readBy: [authUser.uid], type: "image",
                imageUrl: json.secure_url.replace("/upload/", "/upload/f_auto,q_auto,w_900/"),
            });
            await sendChatNotifications("Sent a photo");
        } catch { Alert.alert("Error", "Failed to upload image"); }
        finally { setIsUploadingImage(false); }
    };

    const saveImageToGallery = async (url: string) => {
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== "granted") { Alert.alert("No access"); return; }
            const fileUri = `${FileSystem.cacheDirectory}event_${Date.now()}.jpg`;
            const dl = await FileSystem.downloadAsync(url, fileUri);
            const asset = await MediaLibrary.createAssetAsync(dl.uri);
            await MediaLibrary.createAlbumAsync("EventBuddy", asset, false);
            Alert.alert("Saved to gallery ✓");
        } catch { Alert.alert("Error", "Failed to save"); }
    };

    const handleDeleteMessage = async (messageId: string) => {
        Alert.alert("Delete message?", "Removed for everyone.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
                    await deleteDoc(doc(db, "events", eventId, "messages", messageId));
                    await addDoc(collection(db, "events", eventId, "messages"), {
                        text: `${currentUserName} deleted a message`, type: "system", createdAt: serverTimestamp(),
                    });
                    setIsMenuVisible(false);
                }},
        ]);
    };

    const handlePinMessage = async (message: any) => {
        await updateDoc(doc(db, "events", eventId), {
            pinnedMessage: { id: message.id, text: message.type === "image" ? "📷 Photo" : message.text, authorName: message.authorName },
        });
        await addDoc(collection(db, "events", eventId, "messages"), {
            text: `${currentUserName} pinned a message`, type: "system", createdAt: serverTimestamp(),
        });
        setIsMenuVisible(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const clearChat = async () => {
        Alert.alert("Clear chat?", "This will delete all messages for everyone.", [
            { text: "Cancel", style: "cancel" },
            { text: "Clear", style: "destructive", onPress: async () => {
                    const snap = await getDocs(collection(db, "events", eventId, "messages"));
                    const batch = writeBatch(db);
                    snap.forEach((d) => batch.delete(d.ref));
                    await batch.commit();
                    setIsInfoVisible(false);
                }},
        ]);
    };

    // Обробка часу
    const formatTime = (createdAt: any) => {
        if (!createdAt) return "";
        return new Date(createdAt.toDate?.() || createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    const formatDateDivider = (createdAt: any) => {
        if (!createdAt) return "";
        const d = new Date(createdAt.toDate?.() || createdAt);
        const today = new Date();
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
        if (d.toDateString() === today.toDateString()) return "Today";
        if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
        return d.toLocaleDateString([], { month: "long", day: "numeric" });
    };

    // Відображення повідомлень
    const renderMessageItem = ({ item, index }: { item: any; index: number }) => {
        const isMine = item.userId === authUser?.uid;
        const prev = messages[index - 1];
        const next = messages[index + 1];
        const isSameAuthor = prev?.userId === item.userId && prev?.type !== "system";
        const isLastInGroup = !next || next.userId !== item.userId || next.type === "system";
        const isImage = item.type === "image";

        // Date divider
        const showDate = !prev || formatDateDivider(item.createdAt) !== formatDateDivider(prev.createdAt);

        if (item.type === "system") {
            return (
                <View style={s.systemRow}>
                    <View style={s.systemPill}>
                        <Text style={s.systemText}>{item.text}</Text>
                    </View>
                </View>
            );
        }
        const topSpacing = !prev
            ? 0
            : isSameAuthor
                ? 2
                : 12;
        return (
            <>
                {showDate && (
                    <View style={s.dateDivider}>
                        <View style={s.dateLine} />
                        <Text style={s.dateText}>{formatDateDivider(item.createdAt)}</Text>
                        <View style={s.dateLine} />
                    </View>
                )}

                <View
                    style={[
                        s.msgRow,
                        isMine ? s.rowMine : s.rowOther,
                        { marginTop: topSpacing },
                    ]}
                >
                    {/* Avatar (other side only, last in group) */}
                    {!isMine && (
                        <View style={s.avatarCol}>
                            {isLastInGroup ? (
                                <View style={[s.avatarSmall, { backgroundColor: getAvatarColor(item.authorName) }]}>
                                    {item.userAvatar
                                        ? <Image source={{ uri: item.userAvatar }} style={s.avatarImg} />
                                        : <Text style={s.avatarLetter}>{item.authorName?.[0]?.toUpperCase()}</Text>}
                                </View>
                            ) : <View style={{ width: 32 }} />}
                        </View>
                    )}

                    <Pressable
                        onLongPress={() => { Haptics.selectionAsync(); setMenuMessage(item); setIsMenuVisible(true); }}
                        onPress={() => { if (isImage && item.imageUrl) { setPreviewImage(item.imageUrl); setIsPreviewVisible(true); } }}
                        style={[
                            s.bubble,
                            isMine ? s.bubbleMine : s.bubbleOther,
                            isImage && s.bubbleImage,
                            isMine
                                ? { borderBottomRightRadius: isLastInGroup ? 4 : 18 }
                                : { borderBottomLeftRadius: isLastInGroup ? 4 : 18 },
                        ]}
                    >
                        {!isMine && !isSameAuthor && !isImage && (
                            <Text style={[s.authorName, { color: getAvatarColor(item.authorName) }]}>
                                {item.authorName}
                            </Text>
                        )}

                        {isImage ? (
                            <View style={s.imageWrapper}>
                                {loadingImages[item.id] !== false && (
                                    <View style={s.imageLoader}><ActivityIndicator color="#FFF" /></View>
                                )}
                                <Image
                                    source={{ uri: item.imageUrl }}
                                    style={s.msgImage}
                                    resizeMode="cover"
                                    onLoadStart={() => setLoadingImages(p => ({ ...p, [item.id]: true }))}
                                    onLoadEnd={() => setLoadingImages(p => ({ ...p, [item.id]: false }))}
                                />
                            </View>
                        ) : (
                            <Text style={[s.msgText, isMine && { color: "#FFF" }]}>{item.text}</Text>
                        )}

                        <View style={s.msgFooter}>
                            {item.editedAt && (
                                <Text style={[s.editedTag, isMine && { color: "rgba(255,255,255,0.5)" }]}>edited</Text>
                            )}
                            <Text style={[s.msgTime, isMine && { color: "rgba(255,255,255,0.6)" }]}>
                                {formatTime(item.createdAt)}
                            </Text>
                            {isMine && (
                                <Ionicons name="checkmark-done" size={13} color="rgba(255,255,255,0.7)" style={{ marginLeft: 3 }} />
                            )}
                        </View>
                    </Pressable>
                </View>
            </>
        );
    };


    return (
        <View style={s.root}>
            <StatusBar barStyle="dark-content" backgroundColor={C.headerBg} />

            {/* ── Header ── */}
            <View style={[s.header, { paddingTop: insets.top }]}>
                <TouchableOpacity
                    style={s.backBtn}
                    onPress={() => navigation.navigate("Chats")}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="chevron-back" size={26} color={C.primary} />
                </TouchableOpacity>

                <View style={s.headerCenter}>
                    <View style={[s.headerAvatar, { backgroundColor: getAvatarColor(name || "E") }]}>
                        <Text style={s.headerAvatarLetter}>{name?.[0]?.toUpperCase()}</Text>
                    </View>
                    <View>
                        <Text style={s.headerTitle} numberOfLines={1}>{name}</Text>
                        <View style={s.headerSubRow}>
                            <View style={s.onlineDot} />
                            <Text style={s.headerSub}>{participantsCount} members</Text>
                        </View>
                    </View>
                </View>

                <TouchableOpacity style={s.moreBtn} onPress={() => setIsInfoVisible(true)}>
                    <MaterialCommunityIcons name="dots-vertical" size={22} color={C.textMuted} />
                </TouchableOpacity>
            </View>

            {/* ── Закріплені ── */}
            {pinnedMsg && (
                <TouchableOpacity
                    style={s.pinned}
                    onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
                >
                    <View style={s.pinnedAccent} />
                    <Ionicons name="pin" size={14} color={C.primary} style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                        <Text style={s.pinnedLabel}>Pinned</Text>
                        <Text style={s.pinnedText} numberOfLines={1}>{pinnedMsg.text}</Text>
                    </View>
                    <TouchableOpacity onPress={() => updateDoc(doc(db, "events", eventId), { pinnedMessage: null })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close" size={18} color={C.textMuted} />
                    </TouchableOpacity>
                </TouchableOpacity>
            )}

            {/* ── Завантаження фото ── */}
            {isUploadingImage && (
                <View style={s.uploadBanner}>
                    <ActivityIndicator size="small" color={C.primary} />
                    <Text style={s.uploadText}>Uploading photo...</Text>
                </View>
            )}

            {/* ── Повідомлення ── */}
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <FlatList
                    ref={listRef}
                    data={messages}
                    renderItem={renderMessageItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={s.listContent}
                    showsVerticalScrollIndicator={false}
                />

                {/* ── Поле для вводу ── */}
                <View style={{ backgroundColor: C.headerBg }}>
                    {editingMessageId && (
                        <View style={s.editBar}>
                            <Feather name="edit-2" size={13} color={C.primary} />
                            <Text style={s.editText}>Editing message</Text>
                            <TouchableOpacity onPress={() => { setEditingMessageId(null); setInputText(""); }}>
                                <Ionicons name="close-circle" size={18} color={C.textMuted} />
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={s.inputArea}>
                        <TouchableOpacity
                            style={[s.attachBtn, isUploadingImage && { opacity: 0.5 }]}
                            onPress={pickImageAndSend}
                            disabled={isUploadingImage}
                        >
                            {isUploadingImage
                                ? <ActivityIndicator size="small" color={C.primary} />
                                : <Ionicons name="image-outline" size={23} color={C.primary} />}
                        </TouchableOpacity>

                        <TextInput
                            style={s.input}
                            placeholder="Message..."
                            placeholderTextColor={C.textMuted}
                            value={inputText}
                            onChangeText={setInputText}
                            multiline
                            editable={!isUploadingImage}
                        />

                        <TouchableOpacity
                            style={[s.sendBtn, !inputText.trim() && s.sendBtnDisabled]}
                            onPress={handleSendMessage}
                            disabled={!inputText.trim() || isUploadingImage}
                        >
                            <Ionicons
                                name={editingMessageId ? "checkmark" : "send"}
                                size={18}
                                color="#FFF"
                                style={editingMessageId ? {} : { marginLeft: 2 }}
                            />
                        </TouchableOpacity>
                    </View>
                    <View style={{ height: insets.bottom, backgroundColor: C.headerBg }} />
                </View>
            </KeyboardAvoidingView>

            {/* ── Контекстне меню повідомлень ── */}
            <Modal visible={isMenuVisible} transparent animationType="fade">
                <Pressable style={s.overlay} onPress={() => setIsMenuVisible(false)}>
                    <View style={s.menuCard}>
                        <View style={s.menuHandle} />

                        {menuMessage?.type === "text" && (
                            <TouchableOpacity style={s.menuItem} onPress={() => { Clipboard.setStringAsync(menuMessage.text); setIsMenuVisible(false); }}>
                                <Feather name="copy" size={18} color={C.textMain} />
                                <Text style={s.menuLabel}>Copy</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={s.menuItem} onPress={() => handlePinMessage(menuMessage)}>
                            <Ionicons name="pin-outline" size={18} color={C.textMain} />
                            <Text style={s.menuLabel}>Pin message</Text>
                        </TouchableOpacity>

                        {menuMessage?.userId === authUser?.uid && menuMessage?.type === "text" && (
                            <TouchableOpacity style={s.menuItem} onPress={() => { setEditingMessageId(menuMessage.id); setInputText(menuMessage.text); setIsMenuVisible(false); }}>
                                <Feather name="edit-3" size={18} color={C.textMain} />
                                <Text style={s.menuLabel}>Edit</Text>
                            </TouchableOpacity>
                        )}

                        {menuMessage?.userId === authUser?.uid && (
                            <TouchableOpacity style={[s.menuItem, s.menuItemDanger]} onPress={() => handleDeleteMessage(menuMessage.id)}>
                                <Feather name="trash-2" size={18} color={C.destructive} />
                                <Text style={[s.menuLabel, { color: C.destructive }]}>Delete</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </Pressable>
            </Modal>

            {/* ── Модалка для інфо чату ── */}
            <Modal visible={isInfoVisible} transparent animationType="slide">
                <View style={s.overlay}>
                    <View style={s.infoCard}>
                        <View style={s.menuHandle} />
                        <Text style={s.infoTitle}>Chat info</Text>

                        <View style={s.infoRow}>
                            <View style={s.infoIcon}><Ionicons name="calendar-outline" size={18} color={C.primary} /></View>
                            <View>
                                <Text style={s.infoRowLabel}>Date & time</Text>
                                <Text style={s.infoRowValue}>{date} • {time}</Text>
                            </View>
                        </View>

                        <View style={s.infoRow}>
                            <View style={s.infoIcon}><Ionicons name="people-outline" size={18} color={C.primary} /></View>
                            <View>
                                <Text style={s.infoRowLabel}>Members</Text>
                                <Text style={s.infoRowValue}>{participantsCount} participants</Text>
                            </View>
                        </View>

                        <TouchableOpacity style={s.clearBtn} onPress={clearChat}>
                            <Feather name="trash-2" size={16} color={C.destructive} />
                            <Text style={s.clearBtnText}>Clear chat history</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={s.closeInfoBtn} onPress={() => setIsInfoVisible(false)}>
                            <Text style={s.closeInfoText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ── Передогляд зображень ── */}
            <Modal visible={isPreviewVisible} transparent animationType="fade">
                <View style={s.previewBg}>
                    <View style={[s.previewHeader, { paddingTop: insets.top + 10 }]}>
                        <TouchableOpacity style={s.previewBtn} onPress={() => setIsPreviewVisible(false)}>
                            <Ionicons name="close" size={24} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity style={s.previewBtn} onPress={() => saveImageToGallery(previewImage!)}>
                            <Ionicons name="download-outline" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                    <ImageZoom cropWidth={SCREEN_WIDTH} cropHeight={SCREEN_HEIGHT} imageWidth={SCREEN_WIDTH} imageHeight={SCREEN_HEIGHT}>
                        <Image source={{ uri: previewImage || "" }} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
                    </ImageZoom>
                </View>
            </Modal>
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    header: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: C.headerBg,
        paddingHorizontal: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderColor: "#ECEEF8",
        gap: 8,
        ...Platform.select({
            ios: { shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12 },
            android: { elevation: 4 },
        }),
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: C.primaryLight,
        alignItems: "center",
        justifyContent: "center",
    },
    headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
    headerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 13,
        justifyContent: "center",
        alignItems: "center",
    },
    headerAvatarLetter: { color: "#FFF", fontWeight: "800", fontSize: 17 },
    headerTitle: { fontSize: 16, fontWeight: "800", color: C.textMain, letterSpacing: -0.3 },
    headerSubRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 },
    onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.online },
    headerSub: { fontSize: 12, color: C.textMuted, fontWeight: "600" },
    moreBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    pinned: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: C.headerBg,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderColor: "#ECEEF8",
    },
    pinnedAccent: { width: 3, height: 32, borderRadius: 2, backgroundColor: C.primary, marginRight: 10 },
    pinnedLabel: { fontSize: 10, fontWeight: "800", color: C.primary, textTransform: "uppercase", letterSpacing: 0.5 },
    pinnedText: { fontSize: 13, color: C.textMain, fontWeight: "500", marginTop: 1 },
    uploadBanner: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: C.primaryLight,
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    uploadText: { color: C.primary, fontWeight: "700", fontSize: 13 },
    listContent: { paddingHorizontal: 12, paddingVertical: 16, paddingBottom: 24 },
    rowMine: { justifyContent: "flex-end" },
    rowOther: { justifyContent: "flex-start" },
    avatarCol: { width: 36, marginRight: 6, alignItems: "center", justifyContent: "flex-end" },
    avatarSmall: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    avatarImg: { width: "100%", height: "100%", borderRadius: 10 },
    avatarLetter: { fontSize: 13, fontWeight: "800", color: "#FFF" },
    bubble: {
        maxWidth: SCREEN_WIDTH * 0.72,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
    },
    bubbleMine: { backgroundColor: C.bubbleMine },
    bubbleOther: {
        backgroundColor: C.bubbleOther,
        borderWidth: 1,
        borderColor: C.bubbleOtherBorder,
        ...Platform.select({
            ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
            android: { elevation: 1 },
        }),
    },
    bubbleImage: { padding: 4, borderRadius: 16 },
    authorName: { fontSize: 11, fontWeight: "800", marginBottom: 3 },
    msgText: { fontSize: 15, color: C.textMain, lineHeight: 21 },
    msgFooter: { flexDirection: "row", alignItems: "center", alignSelf: "flex-end", marginTop: 4, gap: 3 },
    editedTag: { fontSize: 10, color: C.textMuted, fontStyle: "italic" },
    msgTime: { fontSize: 10, color: C.textMuted },
    msgRow: {
        flexDirection: "row",
        marginBottom: 3,
        alignItems: "flex-end",
    },
    imageWrapper: {
        width: SCREEN_WIDTH * 0.65,
        height: SCREEN_WIDTH * 0.65,
        borderRadius: 14,
        overflow: "hidden",
        backgroundColor: "#E0E4F0",
    },
    imageLoader: {
        position: "absolute", width: "100%", height: "100%",
        justifyContent: "center", alignItems: "center", zIndex: 2,
        backgroundColor: "rgba(0,0,0,0.15)",
    },
    msgImage: { width: "100%", height: "100%" },
    dateDivider: { flexDirection: "row", alignItems: "center", marginVertical: 16, gap: 10 },
    dateLine: { flex: 1, height: 1, backgroundColor: "#E0E4F0" },
    dateText: { fontSize: 12, fontWeight: "700", color: C.textMuted, letterSpacing: 0.3 },
    systemRow: { alignItems: "center", marginVertical: 8 },
    systemPill: { backgroundColor: "rgba(160,168,200,0.15)", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
    systemText: { fontSize: 11, color: C.system, fontWeight: "600" },
    inputArea: {
        flexDirection: "row",
        alignItems: "flex-end",
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
        borderTopWidth: 1,
        borderColor: "#ECEEF8",
    },
    attachBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.primaryLight, alignItems: "center", justifyContent: "center" },
    input: {
        flex: 1,
        backgroundColor: C.inputBg,
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 10,
        fontSize: 15,
        color: C.textMain,
        maxHeight: 110,
        borderWidth: 1.5,
        borderColor: "#E0E4F8",
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 13,
        backgroundColor: C.primary,
        alignItems: "center",
        justifyContent: "center",
        ...Platform.select({
            ios: { shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
            android: { elevation: 4 },
        }),
    },
    sendBtnDisabled: { backgroundColor: "#C5C9E8", shadowOpacity: 0 },
    editBar: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: C.primaryLight,
        gap: 8,
    },
    editText: { flex: 1, fontSize: 12, color: C.primary, fontWeight: "600" },
    overlay: { flex: 1, backgroundColor: "rgba(10,12,30,0.5)", justifyContent: "flex-end" },
    menuCard: {
        backgroundColor: C.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 30,
        paddingTop: 8,
        paddingHorizontal: 8,
    },
    menuHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#DDE0F0", alignSelf: "center", marginBottom: 12 },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 14,
    },
    menuItemDanger: { marginTop: 4 },
    menuLabel: { fontSize: 16, fontWeight: "600", color: C.textMain },
    infoCard: {
        backgroundColor: C.white,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingBottom: 40,
        paddingTop: 8,
        paddingHorizontal: 24,
    },
    infoTitle: { fontSize: 22, fontWeight: "900", color: C.textMain, marginBottom: 24, marginTop: 8 },
    infoRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 18 },
    infoIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: C.primaryLight, alignItems: "center", justifyContent: "center" },
    infoRowLabel: { fontSize: 11, color: C.textMuted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
    infoRowValue: { fontSize: 15, color: C.textMain, fontWeight: "600", marginTop: 2 },
    clearBtn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: "rgba(239,68,68,0.08)",
        padding: 16,
        borderRadius: 16,
        marginTop: 12,
    },
    clearBtnText: { color: C.destructive, fontWeight: "800", fontSize: 15 },
    closeInfoBtn: { marginTop: 12, padding: 14, alignItems: "center" },
    closeInfoText: { color: C.textMuted, fontWeight: "700", fontSize: 15 },
    previewBg: { flex: 1, backgroundColor: "#000" },
    previewHeader: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, zIndex: 10 },
    previewBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
});