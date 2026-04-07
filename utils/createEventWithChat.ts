// utils/createEventWithChat.ts
import {
    addDoc,
    collection,
    doc,
    setDoc,
    serverTimestamp,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../FirebaseConfig";
import { EventType } from "./types";

export async function createEventWithChat(payload: EventType) {
    const user = getAuth().currentUser;
    if (!user) throw new Error("Користувач не авторизований");

    // Створюємо об'єкт для бази даних на основі EventType
    const eventData = {
        name: payload.name,
        date: payload.date,
        time: payload.time,
        category: payload.category,
        details: payload.details || "",
        userId: user.uid, // Організатор
        isPublic: payload.isPublic,
        invitedUserIds: payload.invitedUserIds || [],
        acceptedUserIds: [user.uid],
        createdAt: serverTimestamp(),
    };

    // Додаємо локацію тільки якщо вона реально є
    if (payload.location) {
        (eventData as any).location = {
            latitude: payload.location.latitude,
            longitude: payload.location.longitude,
            name: payload.location.name || "Somewhere"
        };
    }

    // Створюємо документ події
    const eventRef = await addDoc(collection(db, "events"), eventData);

    // Створюємо перше системне повідомлення в чаті
    await addDoc(collection(db, "events", eventRef.id, "messages"), {
        text: "Чат створено",
        type: "system",
        createdAt: serverTimestamp(),
    });

    // Оновлюємо статус прочитання для творця
    await setDoc(
        doc(db, "users", user.uid, "chatStatus", eventRef.id),
        {
            lastRead: serverTimestamp(),
        }
    );

    return eventRef.id;
}