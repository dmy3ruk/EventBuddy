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
    date: string; // "YYYY-MM-DD"
    time: string; // "HH:MM"
    friends?: string;
    details?: string;
    invitedUserIds?: string[];
};

export async function createEventWithChat(payload: CreateEventPayload) {
    const user = getAuth().currentUser;
    if (!user) throw new Error("No user");

    // 1) створюємо подію
    const eventRef = await addDoc(collection(db, "events"), {
        name: payload.name,
        date: payload.date,
        time: payload.time,
        friends: payload.friends || "",
        details: payload.details || "",
        userId: user.uid,
        invitedUserIds: payload.invitedUserIds || [],
        acceptedUserIds: [user.uid], // організаторка одразу accepted
        createdAt: serverTimestamp(),
    });

    // 2) створюємо підколекцію messages → чат існує одразу
    await addDoc(collection(db, "events", eventRef.id, "messages"), {
        text: "Chat created",
        userId: "system",
        createdAt: serverTimestamp(),
    });

    // 3) lastRead для організаторки
    await setDoc(doc(db, "users", user.uid, "chatStatus", eventRef.id), {
        lastRead: serverTimestamp(),
    });

    return eventRef.id;
}