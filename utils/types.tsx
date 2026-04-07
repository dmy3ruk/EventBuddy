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
}

// 3. Повна модель події (З обов'язковим ID)
export interface EventFull extends EventType {
    id: string;
}