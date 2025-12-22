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

type CreateEventPayload = {
    name: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:MM
    category: string; // ✅ ОБОВʼЯЗКОВО
    friends?: string;
    details?: string;
    invitedUserIds?: string[];
    isPublic: boolean;
};

export async function createEventWithChat(payload: CreateEventPayload) {
    const user = getAuth().currentUser;
    if (!user) throw new Error("No authenticated user");

    // 1️⃣ створюємо подію
    const eventRef = await addDoc(collection(db, "events"), {
        name: payload.name,
        date: payload.date,
        time: payload.time,
        category: payload.category,
        friends: payload.friends || "",
        details: payload.details || "",
        userId: user.uid,
        invitedUserIds: payload.invitedUserIds || [],
        acceptedUserIds: [user.uid],
        isPublic: payload.isPublic,
        createdAt: serverTimestamp(),
    });

    // 2️⃣ створюємо чат
    await addDoc(collection(db, "events", eventRef.id, "messages"), {
        text: "Chat created",
        userId: "system",
        createdAt: serverTimestamp(),
    });

    // 3️⃣ lastRead для організаторки
    await setDoc(
        doc(db, "users", user.uid, "chatStatus", eventRef.id),
        {
            lastRead: serverTimestamp(),
        }
    );

    return eventRef.id;
}
