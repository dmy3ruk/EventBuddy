import React, { useEffect, useMemo, useState } from "react";
import {
    View,
    StyleSheet,
    Text,
    FlatList,
    SafeAreaView,
    TouchableOpacity,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { getAuth } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../FirebaseConfig";
import { useNavigation } from "@react-navigation/native";
import { EventType } from "../../utils/types";
type DayPress = {
    dateString: string;
    day: number;
    month: number;
    year: number;
    timestamp: number;
};

type EventsByDate = {
    [date: string]: EventType[];
};

export default function CalendarScreen() {
    const [selectedDate, setSelectedDate] = useState<string>("");
    const [eventsByDate, setEventsByDate] = useState<EventsByDate>({});
    const [loading, setLoading] = useState(false);
    const navigation = useNavigation<any>();

    useEffect(() => {
        const fetchEvents = async () => {
            try {
                setLoading(true);
                const user = getAuth().currentUser;
                if (!user) return;

                const snapshot = await getDocs(collection(db, "events"));

                const allEvents: EventType[] = snapshot.docs.map((docSnap) => {
                    const data = docSnap.data() as any;
                    return {
                        id: docSnap.id,
                        name: data.name,
                        date: data.date,
                        time: data.time,
                        details: data.details,
                        userId: data.userId,
                        invitedUserIds: data.invitedUserIds || [],
                    };
                });

                const currentUid = user.uid;
                const myRelevantEvents = allEvents.filter(
                    (ev) =>
                        ev.userId === currentUid ||
                        ev.invitedUserIds?.includes(currentUid)
                );

                const grouped: EventsByDate = {};
                myRelevantEvents.forEach((ev) => {
                    if (!ev.date) return;
                    if (!grouped[ev.date]) grouped[ev.date] = [];
                    grouped[ev.date].push(ev);
                });

                setEventsByDate(grouped);
            } catch (e) {
                console.log("Error loading events for calendar:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchEvents();
    }, []);

    const markedDates = useMemo(() => {
        const marks: { [date: string]: any } = {};

        Object.keys(eventsByDate).forEach((date) => {
            marks[date] = {
                ...(marks[date] || {}),
                marked: true,
                dotColor: "#505BEB",
            };
        });

        if (selectedDate) {
            marks[selectedDate] = {
                ...(marks[selectedDate] || {}),
                selected: true,
                selectedColor: "#505BEB",
            };
        }

        return marks;
    }, [eventsByDate, selectedDate]);

    const eventsForSelectedDate = selectedDate
        ? eventsByDate[selectedDate] || []
        : [];

    const openChat = (event: EventType) => {
        navigation.navigate("Chat", {
            eventId: event.id,
            name: event.name,
            date: event.date,
            time: event.time,
            participantsCount: 1,
        });
    };

    const renderEventItem = ({ item }: { item: EventType }) => (
        <TouchableOpacity
            style={styles.eventCard}
            onPress={() => openChat(item)}
        >
            <Text style={styles.eventName}>{item.name}</Text>
            <Text style={styles.eventMeta}>
                {item.time} {item.details ? `• ${item.details}` : ""}
            </Text>

                <TouchableOpacity
                    style={styles.chatButton}
                    onPress={() => openChat(item)}
                >
                <Text style={styles.chatButtonText}>Open chat</Text>
            </TouchableOpacity>
        </TouchableOpacity>
    );

    const handleDayPress = (day: DayPress) => {
        setSelectedDate(day.dateString);
    };


    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.container}>
                <Calendar
                    style={styles.calendar}
                    onDayPress={(day: DayPress) => handleDayPress(day)}
                    markedDates={markedDates}
                    theme={{
                        todayTextColor: "#505BEB",
                        arrowColor: "#505BEB",
                        monthTextColor: "#505BEB",
                        selectedDayBackgroundColor: "#505BEB",
                        selectedDayTextColor: "#FFFFFF",
                    }}
                />

                <View style={styles.eventsContainer}>
                    {loading && (
                        <Text style={styles.infoText}>Loading events...</Text>
                    )}

                    {!loading && !selectedDate && (
                        <Text style={styles.infoText}>
                            Tap on a date to see events.
                        </Text>
                    )}

                    {!loading && selectedDate && eventsForSelectedDate.length === 0 && (
                        <Text style={styles.infoText}>
                            No events for {selectedDate}.
                        </Text>
                    )}

                    {!loading && eventsForSelectedDate.length > 0 && (
                        <>
                            <Text style={styles.eventsTitle}>
                                Events on {selectedDate}
                            </Text>
                            <FlatList
                                data={eventsForSelectedDate}
                                keyExtractor={(item) => item.id}
                                renderItem={renderEventItem}
                                contentContainerStyle={{ paddingVertical: 8 }}
                            />
                        </>
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: "#F9F9F9",
    },
    container: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 24,
    },
    calendar: {
        borderWidth: 1,
        padding: 8,
        borderColor: "#E2E8F0",
        borderRadius: 16,
        width: "100%",
        backgroundColor: "#FFFFFF",
    },
    eventsContainer: {
        marginTop: 16,
        flex: 1,
    },
    infoText: {
        textAlign: "center",
        color: "#6E7D93",
        marginTop: 8,
    },
    eventsTitle: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 8,
        color: "#000",
    },
    eventCard: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        padding: 12,
        borderWidth: 0.5,
        borderColor: "#E2E8F0",
        marginBottom: 8,
    },
    eventName: {
        fontSize: 15,
        fontWeight: "600",
        marginBottom: 2,
        color: "#000",
    },
    eventMeta: {
        fontSize: 13,
        color: "#6E7D93",
    },
    chatButton: {
        marginTop: 8,
        alignSelf: "flex-start",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 0.5,
        borderColor: "#505BEB",
        backgroundColor: "#EEF2FF",
    },
    chatButtonText: {
        color: "#505BEB",
        fontSize: 13,
        fontWeight: "500",
    },
});
