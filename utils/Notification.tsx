import { Platform } from "react-native";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../FirebaseConfig";

export async function registerForPushNotificationsAsync(uid: string) {
    if (Platform.OS === "web") return null;

    try {
        const Device = require("expo-device");
        const Notifications = require("expo-notifications");
        const Constants = require("expo-constants");

        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowBanner: true,
                shouldShowList: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
            }),
        });

        if (!Device.isDevice) {
            console.log("Simulator detected: notification registration skipped.");
            return null;
        }

        if (Platform.OS === "android") {
            await Notifications.setNotificationChannelAsync("event-reminders", {
                name: "Event reminders",
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: "#505BEB",
            });
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== "granted") {
            console.log("Push notifications permission not granted.");
            return null;
        }

        const projectId =
            Constants.expoConfig?.extra?.eas?.projectId ||
            Constants.easConfig?.projectId ||
            "643f517e-fd55-4c5d-93d7-101c7580e791";

        const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenResponse.data;

        await setDoc(
            doc(db, "users", uid),
            {
                pushToken: token,
                pushTokenUpdatedAt: new Date(),
            },
            { merge: true }
        );

        console.log("Expo push token saved:", token);
        return token;
    } catch (error) {
        console.log("Push notification registration error:", error);
        return null;
    }
}

export const sendPushNotification = async (
    targetToken: string,
    title: string,
    body: string
) => {
    try {
        if (!targetToken) return null;

        const message = {
            to: targetToken,
            sound: "default",
            title,
            body,
            priority: "high",
            channelId: "event-reminders",
        };

        const response = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Accept-Encoding": "gzip, deflate",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(message),
        });

        const data = await response.json();
        console.log("Expo push response:", data);
        return data;
    } catch (error) {
        console.log("Send push notification error:", error);
        return null;
    }
};

export const scheduleEventReminder = async ({
                                                eventTitle,
                                                eventDate,
                                                reminderMinutes = 60,
                                                eventNotifications = true,
                                            }: {
    eventTitle: string;
    eventDate: Date;
    reminderMinutes?: number;
    eventNotifications?: boolean;
}) => {
    if (!eventNotifications) return null;
    if (Platform.OS === "web") return null;

    try {
        const Notifications = require("expo-notifications");

        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowBanner: true,
                shouldShowList: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
            }),
        });

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== "granted") return null;

        if (Platform.OS === "android") {
            await Notifications.setNotificationChannelAsync("event-reminders", {
                name: "Event reminders",
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: "#505BEB",
            });
        }

        const triggerDate = new Date(
            eventDate.getTime() - reminderMinutes * 60 * 1000
        );

        // ✅ Мінімум 5 хвилин у майбутньому
        const MIN_DELAY_MS = 5 * 60 * 1000;

        if (triggerDate.getTime() - Date.now() < MIN_DELAY_MS) {
            console.log("Reminder too soon or in the past, skipping");
            return null;
        }

        const reminderText =
            reminderMinutes === 1
                ? "in 1 minute"
                : reminderMinutes === 15
                    ? "in 15 minutes"
                    : reminderMinutes === 60
                        ? "in 1 hour"
                        : reminderMinutes === 1440
                            ? "in 1 day"
                            : `in ${reminderMinutes} minutes`;

        const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
                title: "Upcoming Event 📅",
                body: `"${eventTitle}" starts ${reminderText}.`,
                sound: "default",
            },
            trigger: {
                type: "date",
                date: triggerDate,
                channelId: "event-reminders",
            } as any,
        });

        console.log("Scheduled notification:", notificationId);
        return notificationId;
    } catch (error) {
        console.log("Schedule reminder error:", error);
        return null;
    }
};