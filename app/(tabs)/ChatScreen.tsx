import React, { useEffect, useState, useRef } from "react";
import * as SystemUI from 'expo-system-ui';

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
} from "react-native";

import * as Clipboard from "expo-clipboard";
import ImageZoom from 'react-native-image-pan-zoom';
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
} from "firebase/firestore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

// на початку компонента або в useEffect
SystemUI.setBackgroundColorAsync('#FFFFFF');

export default function ChatScreen() {
    const insets = useSafeAreaInsets();
    const route = useRoute<any>();
    const { eventId, name, time, participantsCount } = route.params || {};

    const [messages, setMessages] = useState<any[]>([]);
    const [pinnedMsg, setPinnedMsg] = useState<any>(null);
    const [inputText, setInputText] = useState("");
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [menuMessage, setMenuMessage] = useState<any | null>(null);
    const [isMenuVisible, setIsMenuVisible] = useState(false);

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
        const messagesQuery = query(collection(db, "events", eventId, "messages"), orderBy("createdAt", "asc"));
        const unsubscribeMessages = onSnapshot(messagesQuery, async (snapshot) => {
            const fetchedMessages = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
            setMessages(fetchedMessages);
            
            const batch = writeBatch(db);
            let needsUpdate = false;
            snapshot.docs.forEach(d => {
                const data = d.data();
                if (data.userId !== authUser.uid && !(data.readBy || []).includes(authUser.uid)) {
                    batch.update(d.ref, { readBy: arrayUnion(authUser.uid) });
                    needsUpdate = true;
                }
            });
            if (needsUpdate) await batch.commit();
        });

        const unsubscribeEvent = onSnapshot(doc(db, "events", eventId), (doc) => {
            if (doc.exists()) setPinnedMsg(doc.data().pinnedMessage || null);
        });

        return () => { unsubscribeMessages(); unsubscribeEvent(); };
    }, [eventId, authUser]);

    useEffect(() => {
        if (messages.length > 0) {
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        }
    }, [messages]);

    const handleSendMessage = async () => {
        if (!inputText.trim() || !authUser || !eventId) return;
        const textToSend = inputText.trim();
        setInputText("");
        
        try {
            if (editingMessageId) {
                await updateDoc(doc(db, "events", eventId, "messages", editingMessageId), { 
                    text: textToSend, editedAt: serverTimestamp() 
                });
                setEditingMessageId(null);
            } else {
                await addDoc(collection(db, "events", eventId, "messages"), { 
                    text: textToSend, userId: authUser.uid, authorName: currentUserName,
                    createdAt: serverTimestamp(), readBy: [authUser.uid], type: "text" 
                });
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (e) { Alert.alert("Error", "Failed to send message"); }
    };

    const handleDeleteMessage = async (messageId: string) => {
        Alert.alert("Delete message?", "This message will be removed for everyone.", [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Delete", 
                style: "destructive", 
                onPress: async () => {
                    try {
                        await deleteDoc(doc(db, "events", eventId, "messages", messageId));
                        await addDoc(collection(db, "events", eventId, "messages"), {
                            text: `${currentUserName} deleted a message`,
                            type: "system",
                            createdAt: serverTimestamp()
                        });
                        setIsMenuVisible(false);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    } catch (e) { Alert.alert("Error", "Could not delete message"); }
                } 
            }
        ]);
    };

    const handlePinMessage = async (message: any) => {
        try {
            await updateDoc(doc(db, "events", eventId), {
                pinnedMessage: {
                    id: message.id,
                    text: message.type === 'image' ? "📷 Photo" : message.text,
                    authorName: message.authorName
                }
            });
            await addDoc(collection(db, "events", eventId, "messages"), {
                text: `${currentUserName} pinned a message`,
                type: "system",
                createdAt: serverTimestamp()
            });
            setIsMenuVisible(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) { Alert.alert("Error", "Could not pin message"); }
    };

    const handleUnpinMessage = async () => {
        await updateDoc(doc(db, "events", eventId), { pinnedMessage: null });
    };

    const renderMessageItem = ({ item, index }: { item: any, index: number }) => {
        const isMine = item.userId === authUser?.uid;
        const prevMessage = messages[index - 1];
        const isSameAuthor = prevMessage?.userId === item.userId;
        const isImage = item.type === "image";

        if (item.type === "system") {
            return (
                <View style={styles.systemRow}>
                    <Text style={styles.systemText}>{item.text.toUpperCase()}</Text>
                </View>
            );
        }

        return (
            <View style={[styles.msgRow, isMine ? styles.rowMine : styles.rowOther, isSameAuthor && { marginTop: -8 }]}>
                {!isMine && !isSameAuthor && (
                    <View style={styles.avatarSmall}>
                        <Text style={styles.avatarTextSmall}>{item.authorName?.[0]}</Text>
                    </View>
                )}
                {!isMine && isSameAuthor && <View style={{ width: 38 }} />}

                <TouchableOpacity 
                    activeOpacity={0.8}
                    onLongPress={() => { Haptics.selectionAsync(); setMenuMessage(item); setIsMenuVisible(true); }}
                    onPress={() => isImage && (setPreviewImage(item.imageUrl), setIsPreviewVisible(true))}
                    style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther, isImage && styles.bubbleImage]}
                >
                    {!isMine && !isSameAuthor && !isImage && <Text style={styles.authorName}>{item.authorName}</Text>}
                    {isImage ? (
                        <Image source={{ uri: item.imageUrl }} style={styles.msgImage} />
                    ) : (
                        <Text style={[styles.msgText, isMine && { color: '#FFF' }]}>{item.text}</Text>
                    )}
                    <View style={styles.msgFooter}>
                        <Text style={[styles.msgTime, isMine && { color: 'rgba(255,255,255,0.7)' }]}>
                            {item.createdAt ? new Date(item.createdAt.toDate?.() || item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                        </Text>
                        {isMine && <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.6)" style={{ marginLeft: 4 }} />}
                    </View>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <View style={styles.mainContainer}>
            
            <StatusBar barStyle="dark-content" />
            
            {/* Header */}
            <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()}>
                        <Feather name="chevron-left" size={28} color={COLORS.primary} />
                    </TouchableOpacity>
                    <View style={styles.headerInfo}>
                        <Text style={styles.headerTitle} numberOfLines={1}>{name}</Text>
                        <Text style={styles.headerSubtitle}>{participantsCount} members • {time}</Text>
                    </View>
                    <TouchableOpacity style={styles.iconButton}>
                        <Feather name="more-vertical" size={22} color={COLORS.textMuted} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Pinned Message */}
            {pinnedMsg && (
                <View style={styles.pinnedContainer}>
                    <Ionicons name="pin" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.pinnedLabel}>Pinned</Text>
                        <Text style={styles.pinnedText} numberOfLines={1}>{pinnedMsg.text}</Text>
                    </View>
                    <TouchableOpacity onPress={handleUnpinMessage}>
                        <Ionicons name="close" size={20} color={COLORS.textMuted} />
                    </TouchableOpacity>
                </View>
            )}

            {/* Головний контент з KeyboardAvoidingView */}
            <KeyboardAvoidingView 
                style={{ flex: 1 }} 
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={0}
            >
                <FlatList 
                    ref={listRef} 
                    data={messages} 
                    renderItem={renderMessageItem} 
                    keyExtractor={item => item.id} 
                    contentContainerStyle={styles.listContent} 
                    showsVerticalScrollIndicator={false}
                />
                
                <View style={{ backgroundColor: COLORS.white }}>
                    {editingMessageId && (
                        <View style={styles.editBar}>
                            <Feather name="edit-2" size={14} color={COLORS.primary} />
                            <Text style={styles.editText} numberOfLines={1}>Editing message...</Text>
                            <TouchableOpacity onPress={() => { setEditingMessageId(null); setInputText(""); }}>
                                <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
                            </TouchableOpacity>
                        </View>
                    )}
                    <View style={styles.footerContainer}>
                        <View style={styles.inputRow}>
                            <TouchableOpacity style={styles.attachBtn}>
                                <Feather name="image" size={22} color={COLORS.primary} />
                            </TouchableOpacity>
                            <TextInput 
                                style={styles.input} 
                                placeholder="Message..." 
                                value={inputText} 
                                onChangeText={setInputText} 
                                multiline 
                            />
                            {inputText.trim().length > 0 && (
                                <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage}>
                                    <Ionicons name={editingMessageId ? "checkmark" : "arrow-up"} size={22} color={COLORS.white} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                    <View style={{ height: insets.bottom, backgroundColor: COLORS.white }} />
                </View>

            </KeyboardAvoidingView>

            {/* Modals */}
            <Modal visible={isMenuVisible} transparent animationType="fade">
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsMenuVisible(false)}>
                    <View style={styles.menuCard}>
                        {menuMessage?.type === 'text' && (
                            <TouchableOpacity style={styles.menuItem} onPress={() => { Clipboard.setStringAsync(menuMessage?.text || ""); setIsMenuVisible(false); }}>
                                <Text style={styles.menuText}>Copy</Text>
                                <Feather name="copy" size={18} color={COLORS.textMain} />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={[styles.menuItem, styles.menuBorder]} onPress={() => handlePinMessage(menuMessage)}>
                            <Text style={styles.menuText}>Pin</Text>
                            <Feather name="pin" size={18} color={COLORS.textMain} />
                        </TouchableOpacity>
                        {menuMessage?.userId === authUser?.uid && (
                            <>
                                {menuMessage?.type === 'text' && (
                                    <TouchableOpacity style={[styles.menuItem, styles.menuBorder]} onPress={() => { setEditingMessageId(menuMessage.id); setInputText(menuMessage.text); setIsMenuVisible(false); }}>
                                        <Text style={styles.menuText}>Edit</Text>
                                        <Feather name="edit-3" size={18} color={COLORS.textMain} />
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity style={[styles.menuItem, styles.menuBorder]} onPress={() => handleDeleteMessage(menuMessage.id)}>
                                    <Text style={[styles.menuText, { color: COLORS.destructive }]}>Delete</Text>
                                    <Feather name="trash-2" size={18} color={COLORS.destructive} />
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>

            <Modal visible={isPreviewVisible} transparent animationType="fade">
                <View style={styles.previewContainer}>
                    <TouchableOpacity style={styles.closePreview} onPress={() => setIsPreviewVisible(false)}>
                        <Ionicons name="close-circle" size={32} color="#FFF" />
                    </TouchableOpacity>
                    <ImageZoom cropWidth={SCREEN_WIDTH} cropHeight={SCREEN_HEIGHT} imageWidth={SCREEN_WIDTH} imageHeight={SCREEN_HEIGHT}>
                        <Image source={{ uri: previewImage || "" }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                    </ImageZoom>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: COLORS.bg },
    headerWrapper: { backgroundColor: COLORS.white, borderBottomWidth: 1, borderColor: COLORS.borderOther },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 56 },
    headerInfo: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 17, fontWeight: "600", color: COLORS.textMain },
    headerSubtitle: { fontSize: 11, color: COLORS.textMuted },
    iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    pinnedContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderColor: COLORS.borderOther },
    pinnedLabel: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
    pinnedText: { fontSize: 13, color: COLORS.textMain },
    listContent: { padding: 16, paddingBottom: 32 },
    msgRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
    rowMine: { justifyContent: 'flex-end' },
    rowOther: { justifyContent: 'flex-start' },
    avatarSmall: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    avatarTextSmall: { fontSize: 12, fontWeight: "700", color: "#FFF" },
    bubble: { maxWidth: '80%', padding: 12, borderRadius: 20 },
    bubbleMine: { backgroundColor: COLORS.bubbleMine, borderBottomRightRadius: 4 },
    bubbleOther: { backgroundColor: COLORS.bubbleOther, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: COLORS.borderOther },
    bubbleImage: { padding: 4, borderRadius: 16 },
    msgImage: { width: SCREEN_WIDTH * 0.7, height: SCREEN_WIDTH * 0.7, borderRadius: 14 },
    authorName: { fontSize: 12, fontWeight: '600', color: COLORS.primary, marginBottom: 2 },
    msgText: { fontSize: 15, color: COLORS.textMain },
    msgFooter: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', marginTop: 4 },
    msgTime: { fontSize: 10, color: COLORS.textMuted },
    systemRow: { width: '100%', alignItems: 'center', marginVertical: 14 },
    systemText: { fontSize: 10, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 1.5, textAlign: 'center' },
    
    // Оновлений футтер
    footerContainer: { 
        backgroundColor: COLORS.white, 
        borderTopWidth: 1, 
        borderColor: COLORS.borderOther, 
        paddingHorizontal: 12, 
        paddingTop: 12,
        paddingBottom: 12,
    },    inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: "#F1F5F9", borderRadius: 24, paddingHorizontal: 4 },
    input: { flex: 1, paddingHorizontal: 12, fontSize: 16, maxHeight: 100, paddingVertical: 10 },
    attachBtn: { padding: 10 },
    sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
    bottomFill: { backgroundColor: COLORS.white, width: '100%' }, // Та сама біла заплатка

    editBar: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8, paddingHorizontal: 12 },
    editText: { flex: 1, fontSize: 12, color: COLORS.textMuted, marginLeft: 8 },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: 'center', alignItems: 'center' },
    menuCard: { width: '70%', backgroundColor: COLORS.white, borderRadius: 16, overflow: 'hidden' },
    menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
    menuBorder: { borderTopWidth: 1, borderColor: '#F1F5F9' },
    menuText: { fontSize: 16, color: COLORS.textMain },
    previewContainer: { flex: 1, backgroundColor: "#000", justifyContent: 'center' },
    closePreview: { position: 'absolute', top: 50, left: 20, zIndex: 10 },
});