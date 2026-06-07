import {
    addDoc,
    collection,
    doc,
    setDoc,
    serverTimestamp,
    getDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../FirebaseConfig";
import { EventType } from "./types";
import { scheduleEventReminder } from "@/utils/Notification";

export async function createEventWithChat(payload: EventType) {
    const user = getAuth().currentUser;

    if (!user) {
        throw new Error("Користувач не авторизований");
    }

    const eventData: any = {
        name: payload.name,
        date: payload.date,
        time: payload.time,
        category: payload.category,
        details: payload.details || "",
        organizerId: user.uid,
        isPublic: payload.isPublic,
        invitedUserIds: payload.invitedUserIds || [],
        acceptedUserIds: [user.uid],
        createdAt: serverTimestamp(),
    };

    if (payload.location) {
        eventData.location = {
            latitude: payload.location.latitude,
            longitude: payload.location.longitude,
            name: payload.location.name || "Click to see location",
        };
    }

    const eventRef = await addDoc(collection(db, "events"), eventData);

    await addDoc(collection(db, "events", eventRef.id, "messages"), {
        text: "Chat created",
        type: "system",
        createdAt: serverTimestamp(),
    });

    await setDoc(doc(db, "users", user.uid, "chatStatus", eventRef.id), {
        lastRead: serverTimestamp(),
    });

    let reminderMinutes = 60;
    let eventNotifications = true;

    const userSnap = await getDoc(doc(db, "users", user.uid));

    if (userSnap.exists()) {
        const data = userSnap.data();
        reminderMinutes = data.reminderMinutes ?? 60;
        eventNotifications = data.eventNotifications ?? true;
    }

    // ✅ Використовуємо готовий Date якщо переданий, інакше парсимо рядки
    let eventDateTime: Date;

    if (payload.eventDateTime instanceof Date) {
        eventDateTime = payload.eventDateTime;
    } else {
        const [year, month, day] = payload.date.split("-").map(Number);
        const [hours, minutes] = payload.time.split(":").map(Number);
        eventDateTime = new Date(year, month - 1, day, hours, minutes);
    }

    console.log("eventDateTime:", eventDateTime.toISOString());
    console.log("now:", new Date().toISOString());
    console.log("diff minutes:", (eventDateTime.getTime() - Date.now()) / 60000);

    await scheduleEventReminder({
        eventTitle: payload.name,
        eventDate: eventDateTime,
        reminderMinutes,
        eventNotifications,
    });

    return eventRef.id;
}