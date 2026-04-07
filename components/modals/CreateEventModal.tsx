import React, { useEffect, useMemo, useState } from "react";
import {StyleSheet, Text, TextInput, View, TouchableOpacity, Modal, Platform, ScrollView, Alert,} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { getAuth } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../FirebaseConfig";
import { createEventWithChat } from "../../utils/createEventWithChat";
import CategoryModal from "./CategoryModal";
import MapModal from "./MapModal";
import { EventLocation } from "../../utils/types";
import { EVENT_CATEGORIES } from "../../utils/categories";
import * as Haptics from "expo-haptics";

interface CreateEventModalProps {
  visible: boolean;
  closeModal: () => void;
  initialDate?: string;
}

type FriendItem = {
  uid: string;
  username: string;
};

export default function CreateEventModal({ visible, closeModal, initialDate }: CreateEventModalProps) {
  const [loading, setLoading] = useState(false);
  const [eventType, setEventType] = useState<"public" | "private">("public");
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");

  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());

  const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);
  const [availableFriends, setAvailableFriends] = useState<FriendItem[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [friendsSearch, setFriendsSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [location, setLocation] = useState<EventLocation | null>(null);
  const [mapVisible, setMapVisible] = useState(false);

  const auth = getAuth();

  useEffect(() => {
    if (visible) {
      loadFriends();
      setSelectedFriendIds([]);
      setFriendsSearch("");
      setLocation(null);
      setName("");
      setDetails("");
      setSelectedCategory(null);

      if (initialDate) {
        const parsedDate = new Date(initialDate);
        if (!isNaN(parsedDate.getTime())) {
          setDate(parsedDate);
        }
      } else {
        setDate(new Date());
      }
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
      console.error("Error loading friends:", e);
    }
  };

  const toggleFriend = (uid: string) => {
    setSelectedFriendIds((prev) =>
        prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const filteredFriends = useMemo(() => {
    const q = friendsSearch.toLowerCase();
    return availableFriends.filter((f) =>
        f.username.toLowerCase().includes(q)
    );
  }, [friendsSearch, availableFriends]);

  const handleSave = async () => {
    if (!name.trim() || !selectedCategory) {
      Alert.alert("Обов'язкові поля", "Будь ласка, введіть назву та оберіть категорію.");
      return;
    }

    // Створюємо об'єкт повної дати для перевірки
    const combinedDateTime = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        time.getHours(),
        time.getMinutes()
    );

    // Перевірка, щоб подія не була в минулому
    if (combinedDateTime <= new Date()) {
      Alert.alert("Невірна дата", "Ви не можете створити подію в минулому.");
      return;
    }

    setLoading(true);
    try {
      // Формуємо об'єкт даних
      const eventData: any = {
        name: name.trim(),
        date: date.toISOString().split("T")[0],
        time: time.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        details: details.trim() || "",
        category: selectedCategory,
        invitedUserIds: eventType === "private" ? selectedFriendIds : [],
        isPublic: eventType === "public",
      };

      // Обробка локації (твоя логіка з "Somewhere")
      if (location && location.latitude && location.longitude) {
        eventData.location = {
          latitude: location.latitude,
          longitude: location.longitude,
          name: location.name || "Somewhere"
        };
      } else {
        eventData.location = {
          latitude: 0,
          longitude: 0,
          name: "Somewhere"
        };
      }

      // Очистка від можливих undefined
      const cleanData = Object.fromEntries(
          Object.entries(eventData).filter(([_, v]) => v !== undefined)
      );

      await createEventWithChat(cleanData as any);

      // Успіх
      if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeModal();
    } catch (e) {
      console.error("Save Error:", e);
      Alert.alert("Помилка", "Не вдалося зберегти дані. Перевірте з'єднання.");
    } finally {
      setLoading(false);
    }
  };

  const onPickerChange = (event: any, selected?: Date) => {
    setPickerMode(null);
    if (!selected) return;
    if (pickerMode === "date") setDate(selected);
    else setTime(selected);
  };

  return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.container}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Create Event</Text>
              <TouchableOpacity onPress={closeModal}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.toggleRow}>
              <TouchableOpacity
                  style={[styles.toggleBtn, eventType === "public" && styles.toggleBtnActive]}
                  onPress={() => setEventType("public")}
              >
                <Text style={[styles.toggleText, eventType === "public" && styles.toggleTextActive]}>🌐 Public</Text>
              </TouchableOpacity>

              <TouchableOpacity
                  style={[styles.toggleBtn, eventType === "private" && styles.toggleBtnActive]}
                  onPress={() => setEventType("private")}
              >
                <Text style={[styles.toggleText, eventType === "private" && styles.toggleTextActive]}>🔒 Private</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
              <Text style={styles.label}>Event Title</Text>
              <TextInput
                  style={styles.input}
                  placeholder="Give it a name..."
                  value={name}
                  onChangeText={setName}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                  style={[styles.input, styles.textArea]}
                  multiline
                  placeholder="What's the plan?"
                  value={details}
                  onChangeText={setDetails}
              />

              <Text style={styles.label}>Date & Time</Text>
              <View style={styles.row}>
                <TouchableOpacity
                    style={[styles.input, styles.half]}
                    onPress={() => setPickerMode("date")}
                >
                  <Text style={styles.dateDisplayText}>
                    {date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.input, styles.half]}
                    onPress={() => setPickerMode("time")}
                >
                  <Text style={styles.dateDisplayText}>
                    {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </TouchableOpacity>
              </View>

              {pickerMode && (
                  <View style={styles.pickerContainer}>
                    <DateTimePicker
                        value={pickerMode === "date" ? date : time}
                        mode={pickerMode}
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        minimumDate={pickerMode === "date" ? new Date() : undefined}
                        onChange={onPickerChange}
                    />
                  </View>
              )}

              <Text style={styles.label}>Category</Text>
              <TouchableOpacity
                  style={styles.selectInput}
                  onPress={() => setCategoryModalVisible(true)}
              >
                <Text style={[styles.selectText, selectedCategory && styles.selectTextSelected]}>
                  {selectedCategory || "Select category"}
                </Text>
                <Text>▾</Text>
              </TouchableOpacity>

              <Text style={styles.label}>Location (Optional)</Text>
              <TouchableOpacity
                  style={styles.selectInput}
                  onPress={() => setMapVisible(true)}
              >
                <Text style={[styles.selectText, location && styles.selectTextSelected]}>
                  {location
                      ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
                      : "Pick a place on map"}
                </Text>
                <Text>📍</Text>
              </TouchableOpacity>

              {eventType === "private" && (
                  <>
                    <Text style={styles.label}>Invite Friends</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Find friends..."
                        value={friendsSearch}
                        onChangeText={setFriendsSearch}
                    />

                    <View style={styles.friendBox}>
                      <ScrollView nestedScrollEnabled>
                        {filteredFriends.map((f) => {
                          const isSelected = selectedFriendIds.includes(f.uid);
                          return (
                              <TouchableOpacity
                                  key={f.uid}
                                  style={[styles.friendRow, isSelected && styles.friendSelected]}
                                  onPress={() => toggleFriend(f.uid)}
                              >
                                <View style={styles.friendAvatar}>
                                  <Text style={styles.friendAvatarText}>{f.username[0].toUpperCase()}</Text>
                                </View>
                                <Text style={{ flex: 1, color: "#1A1A1A" }}>{f.username}</Text>
                                <Text>{isSelected ? "✓" : ""}</Text>
                              </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </>
              )}
            </ScrollView>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                <Text style={{ color: "#6B7280", fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                  style={[styles.createBtn, loading && { opacity: 0.5 }]}
                  onPress={handleSave}
                  disabled={loading || !name.trim() || !selectedCategory}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>
                  {loading ? "Processing..." : "Create Event"}
                </Text>
              </TouchableOpacity>
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
          </View>
        </View>

        <MapModal
            visible={mapVisible}
            location={location}
            onChangeLocation={(loc: EventLocation) => setLocation(loc)}
            onClose={() => setMapVisible(false)}
        />
      </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 12 },
  container: { backgroundColor: "#fff", borderRadius: 28, padding: 20, maxHeight: "90%", elevation: 20 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "800", color: "#0F172A" },
  closeIcon: { fontSize: 20, color: "#64748B" },
  toggleRow: { flexDirection: "row", backgroundColor: "#F1F5F9", borderRadius: 16, padding: 4, marginBottom: 16 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center" },
  toggleBtnActive: { backgroundColor: "#fff", elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4 },
  toggleText: { color: "#64748B", fontWeight: "600" },
  toggleTextActive: { color: "#505BEB", fontWeight: "700" },
  label: { fontSize: 11, color: "#505BEB", fontWeight: "800", letterSpacing: 0.5, marginBottom: 6, marginTop: 12, textTransform: "uppercase" },
  input: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 14, padding: 12, backgroundColor: "#F8FAFC", color: "#1E293B" },
  textArea: { height: 90, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  dateDisplayText: { fontSize: 14, color: "#1E293B", fontWeight: "600" },
  selectInput: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 14, padding: 14, backgroundColor: "#F8FAFC" },
  selectText: { fontSize: 14, color: "#94A3B8" },
  selectTextSelected: { color: "#1E293B", fontWeight: "600" },
  friendBox: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 14, maxHeight: 180, marginTop: 8, overflow: "hidden" },
  friendRow: { flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  friendSelected: { backgroundColor: "#F0F2FF" },
  friendAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#505BEB", justifyContent: "center", alignItems: "center", marginRight: 10 },
  friendAvatarText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  actions: { flexDirection: "row", gap: 12, marginTop: 20 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center" },
  createBtn: { flex: 1.5, padding: 14, borderRadius: 16, backgroundColor: "#505BEB", alignItems: "center", elevation: 4 },
  pickerContainer: { marginTop: 10, backgroundColor: "#F1F5F9", borderRadius: 16, overflow: "hidden" },
});