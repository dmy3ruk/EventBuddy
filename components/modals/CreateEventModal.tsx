import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  Modal,
  Platform,
  ScrollView,
  Alert,
  Animated,
} from "react-native";
import { getAuth } from "firebase/auth";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../FirebaseConfig";
import { createEventWithChat } from "../../utils/createEventWithChat";
import CategoryModal from "./CategoryModal";
import MapModal from "./MapModal";
import { EventLocation } from "../../utils/types";
import { EVENT_CATEGORIES } from "../../utils/categories";
import * as Haptics from "expo-haptics";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";

interface CreateEventModalProps {
  visible: boolean;
  closeModal: () => void;
  initialDate?: string;
  onFirstEventCreated?: () => void;
}

export default function CreateEventModal({
                                           visible,
                                           closeModal,
                                           initialDate,
                                           onFirstEventCreated,
                                         }: CreateEventModalProps) {
  const [loading, setLoading] = useState(false);
  const [eventType, setEventType] = useState<"public" | "private">("public");
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [tempDate, setTempDate] = useState(new Date());
  const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);
  const [availableFriends, setAvailableFriends] = useState<any[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [friendsSearch, setFriendsSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [location, setLocation] = useState<EventLocation | null>(null);
  const [mapVisible, setMapVisible] = useState(false);

  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const lastChangeRef = useRef(0);

  const auth = getAuth();

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      loadFriends();
      setSelectedFriendIds([]);
      setFriendsSearch("");
      setLocation(null);
      setName("");
      setDetails("");
      setSelectedCategory(null);

      const start = initialDate ? new Date(initialDate) : new Date();
      setDate(isNaN(start.getTime()) ? new Date() : start);
      setTime(new Date());
    }
  }, [visible, initialDate]);

  const loadFriends = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const snap = await getDocs(collection(db, "friends", user.uid, "list"));
      setAvailableFriends(
          snap.docs.map((d) => ({
            uid: d.id,
            username: d.data().username,
          }))
      );
    } catch (e) {
      console.error("Load friends error:", e);
    }
  };

  const handleAnimatedClose = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      closeModal();
    });
  };

  const showPicker = (mode: "date" | "time") => {
    setTempDate(new Date(mode === "date" ? date : time));
    setPickerMode(mode);
  };

  const onPickerChange = (event: any, selected?: Date) => {
    const now = Date.now();

    if (Platform.OS === "ios") {
      if (selected && now - lastChangeRef.current > 50) {
        lastChangeRef.current = now;
        setTempDate(selected);
      }
    } else {
      if (selected) {
        if (pickerMode === "date") {
          setDate(selected);
        } else {
          setTime(selected);
        }
      }
      setPickerMode(null);
    }
  };

  const confirmIosPicker = () => {
    if (pickerMode === "date") {
      setDate(tempDate);
    } else if (pickerMode === "time") {
      setTime(tempDate);
    }
    setPickerMode(null);
  };

  const handleSave = async () => {
    const user = auth.currentUser;

    if (!user) {
      Alert.alert("Помилка", "Ви не авторизовані.");
      return;
    }

    if (!name.trim() || !selectedCategory) {
      Alert.alert("Помилка", "Введіть назву та оберіть категорію.");
      return;
    }

    // ✅ Будуємо combined Date з локальних date/time об'єктів
    const combined = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        time.getHours(),
        time.getMinutes()
    );

    if (combined <= new Date()) {
      Alert.alert("Помилка", "Подія не може бути в минулому.");
      return;
    }

    setLoading(true);

    try {
      const existingEvents = await getDocs(
          query(
              collection(db, "events"),
              where("organizerId", "==", user.uid)
          )
      );

      const isFirstEvent = existingEvents.size === 0;

      // ✅ Гарантовано правильний формат "HH:MM" без залежності від локалі
      const timeString = `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;

      await createEventWithChat({
        name: name.trim(),
        date: date.toISOString().split("T")[0],
        time: timeString,
        eventDateTime: combined, // ✅ передаємо готовий Date
        details: details.trim(),
        category: selectedCategory,
        invitedUserIds: eventType === "private" ? selectedFriendIds : [],
        isPublic: eventType === "public",
        organizerId: user.uid,
        location: location || {
          latitude: 0,
          longitude: 0,
          name: "Somewhere",
        },
      } as any);

      if (Platform.OS === "ios") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      handleAnimatedClose();

      if (isFirstEvent) {
        setTimeout(() => {
          onFirstEventCreated?.();
        }, 400);
      }
    } catch (e) {
      console.error("Detailed Save Error:", e);
      Alert.alert(
          "Помилка збереження",
          e instanceof Error ? e.message : "Невідома помилка"
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredFriends = useMemo(() => {
    const q = friendsSearch.toLowerCase();
    return availableFriends.filter((f) =>
        f.username?.toLowerCase().includes(q)
    );
  }, [friendsSearch, availableFriends]);

  return (
      <Modal visible={visible} transparent animationType="none">
        <View style={styles.backdrop}>
          <Animated.View
              style={[
                StyleSheet.absoluteFillObject,
                {
                  backgroundColor: "rgba(0,0,0,0.5)",
                  opacity: opacityAnim,
                },
              ]}
          />

          <Animated.View
              style={[
                styles.container,
                {
                  opacity: opacityAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
          >
            <View style={styles.headerRow}>
              <Text style={styles.title}>Create Event</Text>
              <TouchableOpacity onPress={handleAnimatedClose}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.toggleRow}>
              <TouchableOpacity
                  style={[styles.toggleBtn, eventType === "public" && styles.toggleBtnActive]}
                  onPress={() => setEventType("public")}
              >
                <Text style={[styles.toggleText, eventType === "public" && styles.toggleTextActive]}>
                  🌐 Public
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                  style={[styles.toggleBtn, eventType === "private" && styles.toggleBtnActive]}
                  onPress={() => setEventType("private")}
              >
                <Text style={[styles.toggleText, eventType === "private" && styles.toggleTextActive]}>
                  🔒 Private
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                  style={styles.input}
                  placeholder="Name..."
                  value={name}
                  onChangeText={setName}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                  style={[styles.input, styles.textArea]}
                  multiline
                  placeholder="Plan?"
                  value={details}
                  onChangeText={setDetails}
              />

              <Text style={styles.label}>Date & Time</Text>
              <View style={styles.row}>
                <TouchableOpacity
                    style={[styles.input, styles.half]}
                    onPress={() => showPicker("date")}
                >
                  <Text>{date.toLocaleDateString("en-GB")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.input, styles.half]}
                    onPress={() => showPicker("time")}
                >
                  <Text>
                    {time.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </TouchableOpacity>
              </View>

              {pickerMode && (
                  <View style={styles.pickerWrapper}>
                    {Platform.OS === "ios" && (
                        <View style={styles.iosToolbar}>
                          <TouchableOpacity onPress={() => setPickerMode(null)}>
                            <Text style={{ color: "red" }}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={confirmIosPicker}>
                            <Text style={{ color: "#505BEB", fontWeight: "700" }}>Done</Text>
                          </TouchableOpacity>
                        </View>
                    )}
                    <DateTimePicker
                        value={tempDate}
                        mode={pickerMode}
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        onChange={onPickerChange}
                        themeVariant="light"
                    />
                  </View>
              )}

              <Text style={styles.label}>Category</Text>
              <TouchableOpacity
                  style={styles.selectInput}
                  onPress={() => setCategoryModalVisible(true)}
              >
                <Text style={{ color: selectedCategory ? "#000" : "#94A3B8" }}>
                  {selectedCategory || "Select category"}
                </Text>
              </TouchableOpacity>

              <Text style={styles.label}>Location</Text>
              <TouchableOpacity
                  style={styles.selectInput}
                  onPress={() => setMapVisible(true)}
              >
                <Text>{location ? "Location set 📍" : "Pick on map"}</Text>
              </TouchableOpacity>

              {eventType === "private" && (
                  <View style={{ marginTop: 10 }}>
                    <TextInput
                        style={styles.input}
                        placeholder="Search friends..."
                        value={friendsSearch}
                        onChangeText={setFriendsSearch}
                    />
                    <View style={styles.friendBox}>
                      {filteredFriends.map((f) => (
                          <TouchableOpacity
                              key={f.uid}
                              style={[
                                styles.friendRow,
                                selectedFriendIds.includes(f.uid) && styles.friendSelected,
                              ]}
                              onPress={() =>
                                  setSelectedFriendIds((prev) =>
                                      prev.includes(f.uid)
                                          ? prev.filter((id) => id !== f.uid)
                                          : [...prev, f.uid]
                                  )
                              }
                          >
                            <Text style={{ flex: 1 }}>{f.username}</Text>
                            {selectedFriendIds.includes(f.uid) && <Text>✓</Text>}
                          </TouchableOpacity>
                      ))}
                    </View>
                  </View>
              )}
            </ScrollView>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleAnimatedClose}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                  style={styles.createBtn}
                  onPress={handleSave}
                  disabled={loading}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>
                  {loading ? "..." : "Create"}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>

        <CategoryModal
            visible={categoryModalVisible}
            categories={EVENT_CATEGORIES}
            selectedCategory={selectedCategory}
            onSelect={(cat) => {
              setSelectedCategory(cat);
              setCategoryModalVisible(false);
            }}
            onClose={() => setCategoryModalVisible(false)}
        />

        <MapModal
            visible={mapVisible}
            location={location}
            onChangeLocation={setLocation}
            onClose={() => setMapVisible(false)}
        />
      </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", padding: 15 },
  container: { backgroundColor: "#fff", borderRadius: 30, padding: 20, maxHeight: "85%", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 20 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 15 },
  title: { fontSize: 22, fontWeight: "800", color: "#1A1A1A" },
  closeIcon: { fontSize: 20, color: "#94A3B8", padding: 5 },
  toggleRow: { flexDirection: "row", backgroundColor: "#F1F5F9", borderRadius: 14, padding: 4, marginBottom: 15 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 11 },
  toggleBtnActive: { backgroundColor: "#fff", elevation: 2 },
  toggleText: { fontWeight: "700", color: "#64748B", fontSize: 13 },
  toggleTextActive: { color: "#505BEB" },
  label: { fontSize: 11, fontWeight: "800", color: "#505BEB", marginTop: 12, marginBottom: 6, textTransform: "uppercase" },
  input: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 14, padding: 12, backgroundColor: "#F8FAFC" },
  textArea: { height: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1, justifyContent: "center" },
  selectInput: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 14, padding: 14, backgroundColor: "#F8FAFC" },
  friendBox: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 14, maxHeight: 150, marginTop: 8 },
  friendRow: { flexDirection: "row", padding: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", alignItems: "center" },
  friendSelected: { backgroundColor: "#F0F2FF" },
  actions: { flexDirection: "row", gap: 12, marginTop: 25 },
  cancelBtn: { flex: 1, padding: 16, alignItems: "center", borderRadius: 16, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0" },
  createBtn: { flex: 1.5, padding: 16, alignItems: "center", borderRadius: 16, backgroundColor: "#505BEB" },
  pickerWrapper: { backgroundColor: "#F1F5F9", borderRadius: 16, marginTop: 10, overflow: "hidden" },
  iosToolbar: { flexDirection: "row", justifyContent: "space-between", padding: 15, borderBottomWidth: 1, borderBottomColor: "#E2E8F0", backgroundColor: "#FFF" },
});