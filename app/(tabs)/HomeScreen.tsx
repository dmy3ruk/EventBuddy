import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import React, { useEffect, useState } from 'react';
import { Image } from "expo-image";
import { getAuth } from "firebase/auth";
import { collection, getDocs, query, orderBy, doc, getDoc } from "firebase/firestore";
import { db } from "../../FirebaseConfig";
import ModalScreen from "./ModalScreen";

type EventType = {
    id: string;
    name: string;
    date: string;
    time: string;
    friends?: string;
    details?: string;
    userId: string;
    createdAt: any;
};

export default function HomeScreen() {
    const [activeTab, setActiveTab] = useState("Upcoming");
    const [isModalVisible, setModalVisible] = useState(false);
    const [username, setUsername] = useState<string>("");
    const [events, setEvents] = useState<EventType[]>([]);

    const navHeight = 60;

    // Завантаження юзера
    useEffect(() => {
        const fetchUsername = async () => {
            const user = getAuth().currentUser;
            if (!user) return;
            const docRef = doc(db, "usernames", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                setUsername(docSnap.data().username);
            } else {
                setUsername("No username");
            }
        };
        fetchUsername();
    }, []);

    // Завантаження подій
    useEffect(() => {
        const fetchEvents = async () => {
            const user = getAuth().currentUser;
            if (!user) return;

            try {
                const q = query(
                    collection(db, "events"),
                    orderBy("createdAt", "desc")
                );
                const snapshot = await getDocs(q);
                const eventsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EventType));
                setEvents(eventsData);
            } catch (error) {
                console.log("Error loading events:", error);
            }
        };
        fetchEvents();
    }, [isModalVisible]); // оновлюємо після закриття модалки

    // Фільтруємо події під вкладку
    const filteredEvents = events.filter(event => {
        const today = new Date();
        const eventDate = new Date(event.date);
        const user = getAuth().currentUser;

        switch (activeTab) {
            case "Upcoming":
                return event.userId === user?.uid && eventDate >= today;
            case "Invitings":
                return event.userId !== user?.uid && event.friends?.includes(username);
            case "My Events":
                return event.userId === user?.uid;
            default:
                return false;
        }
    });

    const renderEvent = ({ item }: { item: EventType }) => (
        <View style={styles.card}>
            <Text style={styles.eventName}>{item.name}</Text>
            <Text style={styles.eventDate}>{item.date} | {item.time}</Text>
            {item.friends ? <Text style={styles.eventFriends}>Friends: {item.friends}</Text> : null}
            {item.details ? <Text style={styles.eventDetails}>{item.details}</Text> : null}
        </View>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={filteredEvents.length > 0 ? filteredEvents : [{ id: 'empty' }]}
                keyExtractor={(item) => item.id}
                ListHeaderComponent={
                    <>
                        <Text style={styles.greeting}>Hi {username}!</Text>
                        <Text style={styles.subGreeting}>Welcome back, ready to plan your next great moment</Text>

                        <View style={styles.todayCard}>
                            <View style={styles.todayHeader}>
                                <View style={styles.today}>
                                    <Image source={require("../../assets/images/today.svg")} style={{ width: 40, height: 40 }} />
                                    <Text style={styles.todayTitle}>Today</Text>
                                </View>
                            </View>
                            <Text style={styles.todayText}>You don't have any plans for today 😊</Text>
                        </View>

                        {/* Tabs */}
                        <View style={styles.tabs}>
                            {["Upcoming", "Invitings", "My Events"].map(tabName => (
                                <TouchableOpacity
                                    key={tabName}
                                    style={[styles.tab, activeTab === tabName && styles.activeTab]}
                                    onPress={() => setActiveTab(tabName)}
                                >
                                    <Text style={[styles.tabText, activeTab === tabName && styles.activeTabText]}>
                                        {tabName}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </>
                }
                renderItem={({ item }) =>
                    item.id === 'empty' ? (
                        <View style={styles.cardEmpty}>
                            <Text style={styles.emptyText}>You don't have any {activeTab}</Text>
                        </View>
                    ) : (
                        renderEvent({ item })
                    )
                }
                contentContainerStyle={{ paddingBottom: 140 }}
            />

            {/* Плаваюча кнопка */}
            <TouchableOpacity
                style={[styles.addButtonFloating, { bottom: navHeight + 20 }]}
                onPress={() => setModalVisible(true)}
            >
                <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>

            {/* Нижня навігація */}
            <View style={[styles.bottomNavigation, { height: navHeight }]}>
                <Text style={{ textAlign: 'center', padding: 16 }}>Bottom Navigation</Text>
            </View>

            {/* Модалка */}
            <ModalScreen visible={isModalVisible} closeModal={() => setModalVisible(false)} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9F9F9' },
    greeting: { fontSize: 20, fontWeight: '600', color: '#000', marginTop: 50, marginHorizontal: 16 },
    subGreeting: { fontSize: 14, color: '#6E7D93', marginBottom: 20, marginHorizontal: 16 },
    today: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
    todayCard: { backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 20, marginHorizontal: 16, borderWidth: 0.5, borderColor: "#E2E8F0" },
    todayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    todayTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A1A' },
    todayText: { fontSize: 16, color: '#6E7D93', marginTop: 8, textAlign: 'center' },
    tabs: { flexDirection: 'row', backgroundColor: "#fff", justifyContent: 'space-between', marginBottom: 20, borderRadius: 40, borderWidth: 0.5, borderColor: "#E2E8F0", marginHorizontal: 16 },
    tab: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, backgroundColor: '#fff' },
    tabText: { color: "#000" },
    activeTab: { backgroundColor: '#505BEB' },
    activeTabText: { color: '#fff' },
    addButtonFloating: {
        position: 'absolute',
        alignSelf: 'center',
        backgroundColor: 'green',
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.3,
        marginBottom: 20,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 5,
        elevation: 5,
        zIndex: 10
    },
    addButtonText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
    card: { backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 12, borderWidth: 0.5, borderColor: "#E2E8F0" },
    eventName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
    eventDate: { fontSize: 14, color: '#6E7D93' },
    eventFriends: { fontSize: 14, color: '#6E7D93' },
    eventDetails: { fontSize: 14, color: '#6E7D93' },
    cardEmpty: { width: '100%', borderWidth: 0.5, borderColor: "#E2E8F0", backgroundColor: '#fff', padding: 15, borderRadius: 16, marginBottom: 16 },
    emptyText: { color: "#6E7D93", textAlign: "center", paddingVertical: 32 },
    bottomNavigation: { position: 'absolute', bottom: 0, width: '100%', borderTopWidth: 0.5, borderColor: "#E2E8F0", backgroundColor: "#fff", justifyContent: 'center' }
});
