import React, { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/FirebaseConfig";

import {
    subscribeToOwnerEvents,
    subscribeToInvitedEvents,
    calculateProfileStats,
} from "@/utils/firestoreService";

import { EventFull } from "@/utils/types";
import { getBadges } from "@/utils/badges";

import AchievementModal from "@/components/modals/AchievementModal";

type Props = {
    uid: string;
};

export default function AchievementWatcher({ uid }: Props) {
    const [ownerEvents, setOwnerEvents] = useState<EventFull[]>([]);
    const [invitedEvents, setInvitedEvents] = useState<EventFull[]>([]);
    const [friendsCount, setFriendsCount] = useState(0);

    const [visible, setVisible] = useState(false);
    const [achievement, setAchievement] = useState<any>(null);

    useEffect(() => {
        if (!uid) return;

        const unsubOwner = subscribeToOwnerEvents(uid, (evs) =>
            setOwnerEvents(evs as EventFull[])
        );

        const unsubInvited = subscribeToInvitedEvents(uid, (evs) =>
            setInvitedEvents(evs as EventFull[])
        );

        const unsubFriends = onSnapshot(
            collection(db, "friends", uid, "list"),
            (snap) => {
                setFriendsCount(snap.size);
            }
        );

        return () => {
            unsubOwner();
            unsubInvited();
            unsubFriends();
        };
    }, [uid]);

    const stats = useMemo(() => {
        return calculateProfileStats(ownerEvents, invitedEvents, uid);
    }, [ownerEvents, invitedEvents, uid]);

    const badges = useMemo(() => {
        return getBadges({
            ownerEventsCount: ownerEvents.length,
            friendsCount,
            totalAttendees: stats.totalAttendees,
        });
    }, [ownerEvents.length, friendsCount, stats.totalAttendees]);

    useEffect(() => {
        const checkBadges = async () => {
            if (!uid || badges.length === 0) return;

            try {
                const storageKey = `shownBadges_${uid}`;
                // await AsyncStorage.removeItem(`shownBadges_${uid}`);
                const shownRaw = await AsyncStorage.getItem(storageKey);

                const shownBadges: string[] = shownRaw
                    ? JSON.parse(shownRaw)
                    : [];

                const newBadge = badges.find(
                    (badge) => !shownBadges.includes(badge.id)
                );

                if (!newBadge) return;

                setAchievement(newBadge);
                setVisible(true);

                await AsyncStorage.setItem(
                    storageKey,
                    JSON.stringify([...shownBadges, newBadge.id])
                );
            } catch (error) {
                console.log("Achievement watcher error:", error);
            }
        };

        checkBadges();
    }, [badges, uid]);

    return (
        <AchievementModal
            visible={visible}
            title={achievement?.title || ""}
            icon={achievement?.icon || "star"}
            color={achievement?.color || "#505BEB"}
            onClose={() => setVisible(false)}
        />
    );
}