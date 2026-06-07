// 1. Координати та опис локації
export type EventLocation = {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
};

// 2. Базовий інтерфейс події (БЕЗ id)
export interface EventType {
    name: string;
    date: string;
    time: string;
    userId: string;
    isPublic: boolean;
    category: string;
    details: string;
    invitedUserIds?: string[];
    acceptedUserIds?: string[];
    location?: EventLocation | null;
    createdAt?: string;
    organizerId?: string;
    eventDateTime?: Date; // ← додано
}

// Повна модель події (З обов'язковим ID)
export interface EventFull extends EventType {
    id: string;
}

export type Report = {
    id: string;
    type: "event" | "message" | "user";
    targetId: string;
    eventId?: string;
    messageId?: string;
    reportedUserId?: string;
    reporterId: string;
    reporters?: string[];
    reasons: string[];
    details?: string;
    status: "open" | "reviewed" | "dismissed" | "resolved";
    createdAt?: any;
};



export type UserItem = { uid: string; username: string; avatarUrl?: string | null };
export type FriendItem = { uid: string; username: string; avatarUrl?: string | null };
export type FriendRequest = {
    id: string;
    fromUid: string;
    fromUsername: string;
    fromAvatarUrl?: string | null;
    toUid: string;
    toUsername: string;
};
export type TabType = "Search" | "Requests" | "My friends";