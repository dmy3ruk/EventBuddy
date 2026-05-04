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
            name: payload.location.name || "Somewhere",
        };
    }

    const eventRef = await addDoc(collection(db, "events"), eventData);

    await addDoc(collection(db, "events", eventRef.id, "messages"), {
        text: "Чат створено",
        type: "system",
        createdAt: serverTimestamp(),
    });

    await setDoc(doc(db, "users", user.uid, "chatStatus", eventRef.id), {
        lastRead: serverTimestamp(),
    });

    return eventRef.id;
}