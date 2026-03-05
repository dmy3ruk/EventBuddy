export type EventType = {
    id: string;
    name: string;
    date: string;
    time: string;
    friends?: string;
    details?: string;
    userId: string;
    createdAt: any;
    invitedUserIds?: string[];
    acceptedUserIds?: string[];
    location: undefined,
};
