export const getBadges = ({
                              ownerEventsCount,
                              friendsCount,
                              totalAttendees,
                          }: {
    ownerEventsCount: number;
    friendsCount: number;
    totalAttendees: number;
}) => {
    const badges = [
        {
            id: "creator",
            title: "Creator",
            icon: "calendar-star",
            color: "#505BEB",
            unlocked: ownerEventsCount >= 1,
        },
        {
            id: "organizer",
            title: "Organizer",
            icon: "crown",
            color: "#A855F7",
            unlocked: ownerEventsCount >= 5,
        },
        {
            id: "social",
            title: "Social",
            icon: "account-group",
            color: "#0EA5E9",
            unlocked: friendsCount >= 3,
        },
        {
            id: "active",
            title: "Active",
            icon: "fire",
            color: "#F59E0B",
            unlocked: totalAttendees >= 5,
        },
        {
            id: "legend",
            title: "Legend",
            icon: "star-four-points",
            color: "#F43F5E",
            unlocked:
                ownerEventsCount >= 10 &&
                friendsCount >= 10 &&
                totalAttendees >= 20,
        },
    ];

    return badges.filter((badge) => badge.unlocked);
};