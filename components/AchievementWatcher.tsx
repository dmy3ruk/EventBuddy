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
            },
            (error) => {
                console.log("Friends badge watcher error:", error);
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
        let cancelled = false;

        const checkBadges = async () => {
            if (!uid || badges.length === 0 || visible) return;

            try {
                const storageKey = `shownBadges_${uid}`;
                const shownRaw = await AsyncStorage.getItem(storageKey);

                const shownBadges: string[] = shownRaw
                    ? JSON.parse(shownRaw)
                    : [];

                const newBadge = badges.find(
                    (badge) => badge.id && !shownBadges.includes(badge.id)
                );

                if (!newBadge || cancelled) return;

                await AsyncStorage.setItem(
                    storageKey,
                    JSON.stringify([...shownBadges, newBadge.id])
                );

                if (cancelled) return;

                setAchievement(newBadge);
                setVisible(true);
            } catch (error) {
                console.log("Achievement watcher error:", error);
            }
        };

        checkBadges();

        return () => {
            cancelled = true;
        };
    }, [badges, uid, visible]);

    const handleClose = () => {
        setVisible(false);
        setAchievement(null);
    };

    if (!achievement) return null;

    return (
        <AchievementModal
            visible={visible}
            title={achievement.title || ""}
            icon={achievement.icon || "star"}
            color={achievement.color || "#505BEB"}
            onClose={handleClose}
        />
    );
}