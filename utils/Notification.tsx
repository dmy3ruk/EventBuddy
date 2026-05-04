import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../FirebaseConfig';

export async function registerForPushNotificationsAsync(uid: string) {
    // 1. Якщо це симулятор або веб - ми просто виходимо відразу
    // Використовуємо Platform.isPad як непряму перевірку або просто ігноруємо помилку
    if (Platform.OS === 'web') return null;

    try {
        // Використовуємо require замість import, щоб симулятор не ламався при завантаженні файлу
        const Device = require('expo-device');

        if (!Device.isDevice) {
            console.log("Це симулятор: реєстрація пропущена.");
            return null;
        }

        const Notifications = require('expo-notifications');

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#505BEB',
            });
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') return null;

        const token = (await Notifications.getExpoPushTokenAsync({
            projectId: "643f517e-fd55-4c5d-93d7-101c7580e791"
        })).data;

        if (uid) {
            await updateDoc(doc(db, "usernames", uid), {
                pushToken: token
            });
        }

        return token;
    } catch (error) {
        // Якщо нативна бібліотека не знайдена (симулятор), просто ігноруємо
        return null;
    }
}

export const sendPushNotification = async (targetToken: string, title: string, body: string) => {
    const message = {
        to: targetToken,
        sound: 'default',
        title: title,
        body: body,
    };

    await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
    });
};

export const scheduleEventReminder = async (eventTitle: string, eventDate: string) => {
    try {
        const Device = require('expo-device');
        if (!Device.isDevice) return;

        const Notifications = require('expo-notifications');
        const triggerDate = new Date(eventDate);
        triggerDate.setHours(triggerDate.getHours() - 1);

        if (triggerDate <= new Date()) return;

        await Notifications.scheduleNotificationAsync({
            content: {
                title: "Наближається подія! 📅",
                body: `Подія "${eventTitle}" розпочнеться рівно за годину.`,
            },
            trigger: { date: triggerDate } as any,
        });
    } catch (e) {
        // Ігноруємо на симуляторі
    }
};