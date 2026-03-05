export type EventLocation = {
    latitude: number;
    longitude: number;
};

// Базовий інтерфейс 
export interface EventType {
    name: string;
    date: string;
    time: string;
    userId: string;
    isPublic: boolean;
    category: string; 
    details?: string;
    acceptedUserIds?: string[];
    location?: EventLocation;
}

// Тип для роботи в додатку (дані + ID)
export interface EventFull extends EventType {
    id: string;
}