import { getAuth } from "firebase/auth";
import { EventFull } from "./types";

type AnyDate = string | Date | { toDate?: () => Date } | null | undefined;

/**
 * UID поточного користувача
 */
export function getUID(): string {
    const user = getAuth().currentUser;
    return user?.uid || "";
}

/**
 * Нормалізація дати (без timezone-багів)
 */
function normalizeDate(raw: AnyDate): Date | null {
    if (!raw) return null;

    let d: Date;

    if (raw instanceof Date) {
        d = new Date(raw.getTime());
    } else if (typeof raw === "object" && typeof raw.toDate === "function") {
        d = raw.toDate();
    } else if (typeof raw === "string") {
        // YYYY-MM-DD (без зсуву timezone)
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            const [y, m, d2] = raw.split("-").map(Number);
            d = new Date(y, m - 1, d2);
        } else {
            d = new Date(raw);
        }
    } else {
        return null;
    }

    if (isNaN(d.getTime())) return null;

    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * Сьогодні (00:00:00)
 */
function todayDate(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * Перевірка: сьогодні
 */
export function isToday(dateRaw: AnyDate): boolean {
    const d = normalizeDate(dateRaw);
    if (!d) return false;

    return d.getTime() === todayDate().getTime();
}

/**
 * Перевірка: минуле
 */
function isPast(date: Date): boolean {
    return date < todayDate();
}

/**
 * Гості події
 */
export function getParticipants(event: EventFull) {
    return Array.from(
        new Set([event.organizerId, ...(event.acceptedUserIds || [])].filter(Boolean))
    );
}

/**
 * Головна логіка: сьогоднішня подія користувача
 */
export function getTodayEvent(events: EventFull[], currentUid?: string) {
    const uid = currentUid || getUID();
    if (!uid) return null;

    return (
        events.find((ev) => {
            const date = normalizeDate(ev.date as AnyDate);

            return (
                (ev.organizerId === uid || ev.acceptedUserIds?.includes(uid)) &&
                date &&
                isToday(date)
            );
        }) || null
    );
}

/**
 * Фільтр табів
 */
export function filterEventsByTab(
    events: EventFull[],
    tab: "Upcoming" | "Invitings" | "My Events",
    uid: string
) {
    if (!uid) return [];

    return events.filter((event) => {
        const eventDate = normalizeDate(event.date as AnyDate);
        const isFuture = eventDate ? !isPast(eventDate) : false;

        switch (tab) {
            case "Upcoming": {
                const isOwner = event.organizerId === uid;
                const isAccepted = event.acceptedUserIds?.includes(uid);

                return isFuture && (isOwner || isAccepted);
            }

            case "Invitings": {
                const isInvited =
                    event.organizerId !== uid &&
                    event.invitedUserIds?.includes(uid) &&
                    !event.acceptedUserIds?.includes(uid);

                return isInvited && isFuture;
            }

            case "My Events": {
                return event.organizerId === uid;
            }

            default:
                return false;
        }
    });
}