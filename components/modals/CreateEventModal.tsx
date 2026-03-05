import React, { useEffect, useMemo, useState } from "react";
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
import CategoryModal from "./CategoryModal";
import MapModal from "./MapModal";
import { EventLocation } from "../../utils/types";
import { EVENT_CATEGORIES } from "../../utils/categories";

type Props = {
  visible: boolean;
  closeModal: () => void;
};

type FriendItem = {
  uid: string;
  username: string;
};

export default function CreateEventModal({ visible, closeModal }: Props) {
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
    const loadFriends = async () => {
      const user = auth.currentUser;
      if (!user || !visible) return;

      const snap = await getDocs(collection(db, "friends", user.uid, "list"));

      setAvailableFriends(
        snap.docs.map((d) => ({
          uid: d.id,
          username: d.data().username,
        }))
      );
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
    const q = friendsSearch.toLowerCase();
    return availableFriends.filter((f) =>
      f.username.toLowerCase().includes(q)
    );
  }, [friendsSearch, availableFriends]);

  const handleSave = async () => {
    if (!name.trim() || !selectedCategory) return;

    await createEventWithChat({
      name: name.trim(),
      date: date.toISOString().split("T")[0],
      time: time.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      details,
      category: selectedCategory,
      invitedUserIds: eventType === "private" ? selectedFriendIds : [],
      isPublic: eventType === "public",
      location: location ?? undefined,
    });

    setName("");
    setDetails("");
    setSelectedCategory(null);
    closeModal();
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
              style={[
                styles.toggleBtn,
                eventType === "public" && styles.toggleBtnActive,
              ]}
              onPress={() => setEventType("public")}
            >
              <Text
                style={[
                  styles.toggleText,
                  eventType === "public" && styles.toggleTextActive,
                ]}
              >
                🌐 Public
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.toggleBtn,
                eventType === "private" && styles.toggleBtnActive,
              ]}
              onPress={() => setEventType("private")}
            >
              <Text
                style={[
                  styles.toggleText,
                  eventType === "private" && styles.toggleTextActive,
                ]}
              >
                🔒 Private
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 12 }}
          >
            <Text style={styles.label}>Event Title</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter event title"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              multiline
              value={details}
              onChangeText={setDetails}
            />

            <Text style={styles.label}>Date & Time</Text>
            <View style={styles.row}>
            <TouchableOpacity
              style={[styles.input, styles.half]}
              onPress={() => setPickerMode("date")}
            >
                <Text>
                  {date.toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.input, styles.half]}
                onPress={() => setPickerMode("time")}
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
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={pickerMode === "date" ? date : time}
                  mode={pickerMode}
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(_event: any, selected?: Date) => {
                    if (!selected) {
                      setPickerMode(null);
                      return;
                    }

                    if (pickerMode === "date") setDate(selected);
                    else setTime(selected);

                    setPickerMode(null);
                  }}
                />
              </View>
            )}

            <Text style={styles.label}>Category</Text>
            <TouchableOpacity
              style={styles.selectInput}
              onPress={() => setCategoryModalVisible(true)}
            >
              <Text
                style={[
                  styles.selectText,
                  selectedCategory && styles.selectTextSelected,
                ]}
              >
                {selectedCategory || "Choose category"}
              </Text>
              <Text>▾</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Location</Text>
            <TouchableOpacity
              style={styles.selectInput}
              onPress={() => setMapVisible(true)}
            >
              <Text style={styles.selectText}>
                {location
                  ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
                  : "Choose location on map"}
              </Text>
              <Text>📍</Text>
            </TouchableOpacity>

            {eventType === "private" && (
              <>
                <Text style={styles.label}>Invite Friends</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Search friends..."
                  value={friendsSearch}
                  onChangeText={setFriendsSearch}
                />

                <View style={styles.friendBox}>
                  <ScrollView>
                    {filteredFriends.map((f) => {
                      const selected = selectedFriendIds.includes(f.uid);
                      return (
                        <TouchableOpacity
                          key={f.uid}
                          style={[
                            styles.friendRow,
                            selected && styles.friendSelected,
                          ]}
                          onPress={() => toggleFriend(f.uid)}
                        >
                          <View style={styles.friendAvatar}>
                            <Text style={styles.friendAvatarText}>
                              {f.username[0].toUpperCase()}
                            </Text>
                          </View>
                          <Text style={{ flex: 1 }}>{f.username}</Text>
                          <Text>{selected ? "✓" : ""}</Text>
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
              <Text>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.createBtn}
              onPress={handleSave}
              disabled={!name.trim() || !selectedCategory}
            >
              <Text style={{ color: "#fff" }}>Create Event</Text>
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
        onChangeLocation={setLocation}
        onClose={() => setMapVisible(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 12,
  },
  container: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 16,
    maxHeight: "90%",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: "700" },
  closeIcon: { fontSize: 18 },
  toggleRow: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    padding: 4,
    marginBottom: 12,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: "center",
  },
  toggleBtnActive: { backgroundColor: "#fff", elevation: 2 },
  toggleText: { color: "#6B7280" },
  toggleTextActive: { color: "#4F46E5", fontWeight: "600" },
  label: {
    fontSize: 13,
    color: "#4B5563",
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#F9FAFB",
  },
  textArea: { height: 80, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 8 },
  half: { flex: 1 },
  selectInput: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#F3F4F6",
  },
  selectText: { fontSize: 14, color: "#9CA3AF" },
  selectTextSelected: { color: "#111827", fontWeight: "500" },
  friendBox: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    maxHeight: 200,
    marginTop: 6,
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
  },
  friendSelected: { backgroundColor: "#EEF2FF" },
  friendAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#505BEB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  friendAvatarText: { color: "#fff", fontWeight: "600" },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  cancelBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  createBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 999,
    backgroundColor: "#505BEB",
    alignItems: "center",
  },
  pickerContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
});

