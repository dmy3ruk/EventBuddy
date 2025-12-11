// services/firestoreService.ts

import {
    doc,
    getDoc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    collection,
    query,
    where,
    onSnapshot,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../FirebaseConfig";

export async function fetchUsername() {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return null;

    const snap = await getDoc(doc(db, "usernames", uid));
    return snap.exists() ? (snap.data().username as string) : null;
}

export async function acceptInvite(eventId: string) {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;

    await updateDoc(doc(db, "events", eventId), {
        acceptedUserIds: arrayUnion(uid),
    });
}

export async function declineInvite(eventId: string) {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;

    await updateDoc(doc(db, "events", eventId), {
        invitedUserIds: arrayRemove(uid),
        acceptedUserIds: arrayRemove(uid),
    });
}

/* ----------------------------- EVENTS -------------------------------- */

export function subscribeToOwnerEvents(callback: (events: any[]) => void) {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return () => {};

    const eventsRef = collection(db, "events");
    const q = query(eventsRef, where("userId", "==", uid));

    return onSnapshot(q, (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
        callback(list);
    });
}

export function subscribeToInvitedEvents(callback: (events: any[]) => void) {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return () => {};

    const eventsRef = collection(db, "events");
    const q = query(eventsRef, where("invitedUserIds", "array-contains", uid));

    return onSnapshot(q, (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
        callback(list);
    });
}

/* ----------------------- PROFILE STATISTICS --------------------------- */

export function calculateProfileStats(
    ownerEvents: any[],
    invitedEvents: any[],
    uid: string
) {
    let upcomingCount = 0;
    let totalAttendees = 0;
    let pendingInvitesCount = 0;

    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    /* події, створені користувачем */
    ownerEvents.forEach((ev) => {
        if (ev.date) {
            const [y, m, d] = ev.date.split("-").map(Number);
            const eventDate = new Date(Number(y), Number(m) - 1, Number(d));

            if (
                eventDate.getFullYear() === thisYear &&
                eventDate.getMonth() === thisMonth
            ) {
                upcomingCount += 1;
            }
        }

        if (ev.acceptedUserIds) {
            totalAttendees += ev.acceptedUserIds.length;
        }
    });

    /* запрошення */
    invitedEvents.forEach((ev) => {
        const accepted = ev.acceptedUserIds || [];
        if (!accepted.includes(uid)) pendingInvitesCount += 1;
    });

    return {
        upcomingCount,
        totalAttendees,
        pendingInvitesCount,
    };
}
