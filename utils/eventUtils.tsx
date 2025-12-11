import { getAuth } from "firebase/auth";
import { EventType } from "./types";

// якщо ти імпортуєш Timestamp з firestore – можна явно типізувати
// import type { Timestamp } from "firebase/firestore";

type AnyDate = string | Date | { toDate?: () => Date } | null | undefined;

export function getUID() {
    const user = getAuth().currentUser;
    return user?.uid || "";
}

function normalizeDate(raw: AnyDate) {
    if (!raw) return null;

    let d: Date;

    if (raw instanceof Date) {
        d = raw;
    } else if (typeof raw === "object" && (raw as any).toDate) {
        // Firestore Timestamp
        d = (raw as any).toDate();
    } else {
        d = new Date(raw as string);
    }

    if (isNaN(d.getTime())) return null;

    d.setHours(0, 0, 0, 0);
    return d;
}

function todayDate() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
}

export function isToday(dateRaw: AnyDate) {
    const d = normalizeDate(dateRaw);
    if (!d) return false;
    return d.getTime() === todayDate().getTime();
}

export function getTodayEvent(events: EventType[]) {
    const uid = getUID();
    return (
        events.find(
            (ev) =>
                (ev.userId === uid || ev.acceptedUserIds?.includes(uid)) &&
                isToday(ev.date as any)
        ) || null
    );
}

export function getParticipants(event: EventType) {
    const participants = [event.userId, ...(event.acceptedUserIds || [])];
    return Array.from(new Set(participants));
}

export function getEventStatus(event: EventType, uid: string) {
    const today = todayDate();
    const eventDate = normalizeDate(event.date as any);

    const isInvited =
        event.invitedUserIds?.includes(uid) &&
        !event.acceptedUserIds?.includes(uid);

    if (isInvited) return "Invitation";
    if (!eventDate) return "Upcoming"; // якщо дата крива – хай буде як майбутня
    if (eventDate < today) return "Past";
    return "Upcoming";
}

export function filterEventsByTab(
    events: EventType[],
    tab: "Upcoming" | "Invitings" | "My Events",
    uid: string
) {
    const today = todayDate();

    return events.filter((event) => {
        const eventDate = normalizeDate(event.date as any);

        switch (tab) {
            case "Upcoming": {
                // якщо дата не валідна – вважаю, що івент майбутній
                const isFuture = !eventDate || eventDate >= today;
                const isOwner = event.userId === uid;
                const isAccepted = event.acceptedUserIds?.includes(uid);

                return isFuture && (isOwner || isAccepted);
            }

            case "Invitings": {
                const isInvited =
                    event.userId !== uid &&
                    event.invitedUserIds?.includes(uid) &&
                    !event.acceptedUserIds?.includes(uid);
                const isFuture = !eventDate || eventDate >= today;
                return isInvited && isFuture;
            }

            case "My Events": {
                const isOwner = event.userId === uid;
                const isFuture = !eventDate || eventDate >= today;
                return isOwner && isFuture;
            }

            default:
                return false;
        }
    });
}
