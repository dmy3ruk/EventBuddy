import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar,
    LayoutAnimation } from "react-native";
import { Calendar } from "react-native-calendars";
import { getAuth } from "firebase/auth";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../../FirebaseConfig";
import { EventFull } from "../../utils/types";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from 'expo-haptics';
import EventCard from "../../components/EventCard";
import CreateEventModal from "../../components/modals/CreateEventModal";

const COLORS = {
    primary: "#505BEB",
    bg: "#F8FAFC",
    white: "#FFFFFF",
    textMain: "#0F172A",
    textMuted: "#64748B",
    border: "#F1F5F9",
    success: "#16A34A",
};

export default function CalendarScreen() {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<any>();
    const today = useMemo(() => new Date().toISOString().split('T')[0], []);
    const [selectedDate, setSelectedDate] = useState<string>(today);
    const [eventsByDate, setEventsByDate] = useState<{ [key: string]: EventFull[] }>({});
    const [isModalVisible, setModalVisible] = useState(false);

    const uid = getAuth().currentUser?.uid;

    // Слухаємо зміни в Firestore
    useEffect(() => {
        if (!uid) return;
        const q = query(collection(db, "events"), orderBy("time", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const grouped: { [key: string]: EventFull[] } = {};

            snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data() as EventFull;
                if (data.userId === uid || (data.acceptedUserIds || []).includes(uid)) {
                    const date = data.date;
                    if (!grouped[date]) grouped[date] = [];
                    grouped[date].push({ ...data, id: docSnap.id });
                }
            });

            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setEventsByDate(grouped);
        });
        return () => unsubscribe();
    }, [uid]);

    // Маркування дат для календаря
    const markedDates = useMemo(() => {
        const marks: any = {};
        Object.keys(eventsByDate).forEach((date) => {
            marks[date] = { marked: true, dotColor: COLORS.primary };
        });
        marks[selectedDate] = {
            ...marks[selectedDate],
            selected: true,
            selectedColor: COLORS.primary
        };
        return marks;
    }, [eventsByDate, selectedDate]);

    const eventsForSelectedDate = eventsByDate[selectedDate] || [];

    const handleBack = () => {
        navigation.navigate("Public Events");
    };

    const goToToday = () => {
        setSelectedDate(today);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                        <Feather name="chevron-left" size={28} color={COLORS.textMain} />
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerLabel}>PLAN YOUR</Text>
                        <Text style={styles.headerTitle}>Timeline</Text>
                    </View>
                </View>

                {selectedDate !== today && (
                    <TouchableOpacity style={styles.todayBtn} onPress={goToToday}>
                        <Text style={styles.todayBtnText}>Today</Text>
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={eventsForSelectedDate}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListHeaderComponent={
                    <View style={styles.topSection}>
                        {/* Картка календаря */}
                        <View style={styles.calendarCard}>
                            <Calendar
                                current={selectedDate}
                                onDayPress={(day) => {
                                    setSelectedDate(day.dateString);
                                    Haptics.selectionAsync();
                                }}
                                markedDates={markedDates}
                                theme={{
                                    calendarBackground: 'transparent',
                                    selectedDayBackgroundColor: COLORS.primary,
                                    selectedDayTextColor: COLORS.white,
                                    todayTextColor: COLORS.primary,
                                    dayTextColor: COLORS.textMain,
                                    monthTextColor: COLORS.textMain,
                                    textMonthFontWeight: '800',
                                    arrowColor: COLORS.primary,
                                }}
                                enableSwipeMonths
                            />
                        </View>

                        {/* Інформаційний заголовок списку */}
                        <View style={styles.listHeader}>
                            <View style={styles.titleRow}>
                                <Text style={styles.sectionTitle}>Plans for this day</Text>
                                {eventsForSelectedDate.length > 0 && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>{eventsForSelectedDate.length}</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.dateSub}>
                                {new Date(selectedDate).toLocaleDateString('en-US', {
                                    weekday: 'long', month: 'short', day: 'numeric'
                                })}
                            </Text>
                        </View>
                    </View>
                }
                renderItem={({ item }) => (
                    <EventCard item={item} uid={uid || ""} mode="discover" />
                )}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconCircle}>
                            <MaterialCommunityIcons name="calendar-blank" size={40} color={COLORS.textMuted} />
                        </View>
                        <Text style={styles.emptyTitle}>No plans for this date</Text>
                        <Text style={styles.emptySubText}>Enjoy your free time or tap 'New Event' below</Text>
                    </View>
                }
            />

            {/* CTA Кнопка */}
            <TouchableOpacity
                activeOpacity={0.9}
                style={[styles.fab, { bottom: insets.bottom + 20 }]}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setModalVisible(true);
                }}
            >
                <Feather name="plus" size={24} color={COLORS.white} />
                <Text style={styles.fabText}>New Event</Text>
            </TouchableOpacity>

            {/* Модалка створення події */}
            <CreateEventModal
                visible={isModalVisible}
                closeModal={() => setModalVisible(false)}
                initialDate={selectedDate}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    backBtn: { marginRight: 8, marginLeft: -4 },
    headerTextContainer: { justifyContent: 'center' },
    headerLabel: { fontSize: 10, fontWeight: '800', color: COLORS.primary, letterSpacing: 1 },
    headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textMain, marginTop: -4 },
    todayBtn: {
        backgroundColor: COLORS.white,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    todayBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
    listContent: { paddingHorizontal: 16 },
    topSection: { paddingHorizontal: 0 },
    calendarCard: {
        backgroundColor: COLORS.white,
        borderRadius: 24,
        padding: 10,
        marginVertical: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 3,
    },
    listHeader: {
        marginBottom: 20,
        paddingLeft: 0,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center' },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textMain },
    dateSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2, fontWeight: '500' },
    badge: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 8,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    badgeText: { color: COLORS.white, fontSize: 11, fontWeight: '800' },
    separator: {
        height: 12,
    },

    emptyState: { alignItems: 'center', marginTop: 40, paddingHorizontal: 40 },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        elevation: 2,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 10,
    },
    emptyTitle: { color: COLORS.textMain, fontSize: 18, fontWeight: '800', marginBottom: 4 },
    emptySubText: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center' },

    fab: {
        position: 'absolute',
        right: 20,
        flexDirection: 'row',
        height: 54,
        paddingHorizontal: 20,
        backgroundColor: COLORS.success,
        borderRadius: 27,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 8,
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 }
    },
    fabText: { marginLeft: 10, fontSize: 16, fontWeight: '700', color: COLORS.white },
});