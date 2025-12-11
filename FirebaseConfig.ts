// FirebaseConfig.ts

import { initializeApp, getApps, getApp } from "firebase/app";
import {
    initializeAuth,
    getReactNativePersistence,
    getAuth,
    Auth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
    apiKey: "AIzaSyCRZPLbe1Fjvr2Hg3yBLx-LEdKE26MvdGU",
    authDomain: "eventbuddy-81cbc.firebaseapp.com",
    projectId: "eventbuddy-81cbc",
    storageBucket: "eventbuddy-81cbc.firebasestorage.app",
    messagingSenderId: "836562128145",
    appId: "1:836562128145:web:bcbe8ebd6197da7a75d0b0",
    measurementId: "G-MELT46KQFD",
};

let app;
let auth: Auth;

// ✅ Якщо ще немає жодного ініціалізованого Firebase app — ініціалізую
if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);

    // І тут же один раз ініціалізую Auth з persistence для React Native
    auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
    });
} else {
    // ♻️ Якщо app вже створений — просто беру існуючий
    app = getApp();
    // А Auth — через getAuth, без повторного initializeAuth
    auth = getAuth(app);
}

const db = getFirestore(app);

export { app, db, auth };
