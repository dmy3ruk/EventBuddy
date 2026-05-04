import {
    doc, getDoc, updateDoc, arrayUnion, arrayRemove,
    collection, query, where, onSnapshot,
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
    await updateDoc(doc(db, "events", eventId), { acceptedUserIds: arrayUnion(uid) });
}

export async function declineInvite(eventId: string) {
    const uid = getAuth().currentUser?.uid;
    if (!uid) return;
    await updateDoc(doc(db, "events", eventId), {
        invitedUserIds: arrayRemove(uid),
        acceptedUserIds: arrayRemove(uid),
    });
}

// ✅ Тепер uid передається як параметр — не береться всередині
export function subscribeToOwnerEvents(uid: string, callback: (events: any[]) => void) {
    const q = query(collection(db, "events"), where("userId", "==", uid));
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (error) => {
        console.log("❌ subscribeToOwnerEvents error:", error.code, "uid:", uid);
    });
}

export function subscribeToInvitedEvents(uid: string, callback: (events: any[]) => void) {
    const q = query(collection(db, "events"), where("invitedUserIds", "array-contains", uid));
    return onSnapshot(q, (snapshot) => {
        callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, (error) => {
        console.log("❌ subscribeToInvitedEvents error:", error.code, "uid:", uid);
    });
}

export function calculateProfileStats(ownerEvents: any[], invitedEvents: any[], uid: string) {
    let upcomingCount = 0;
    let totalAttendees = 0;
    let pendingInvitesCount = 0;
    const now = new Date();

    ownerEvents.forEach((ev) => {
        if (ev.date) {
            const [y, m, d] = ev.date.split("-").map(Number);
            const eventDate = new Date(y, m - 1, d);
            if (eventDate.getFullYear() === now.getFullYear() && eventDate.getMonth() === now.getMonth()) {
                upcomingCount += 1;
            }
        }
        if (ev.acceptedUserIds) totalAttendees += ev.acceptedUserIds.length;
    });

    invitedEvents.forEach((ev) => {
        if (!(ev.acceptedUserIds || []).includes(uid)) pendingInvitesCount += 1;
    });

    return { upcomingCount, totalAttendees, pendingInvitesCount };
}