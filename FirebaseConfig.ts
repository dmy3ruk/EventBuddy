// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import {getFirestore} from "@firebase/firestore";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import AsyncStorage from "@react-native-async-storage/async-storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyCRZPLbe1Fjvr2Hg3yBLx-LEdKE26MvdGU",
    authDomain: "eventbuddy-81cbc.firebaseapp.com",
    projectId: "eventbuddy-81cbc",
    storageBucket: "eventbuddy-81cbc.firebasestorage.app",
    messagingSenderId: "836562128145",
    appId: "1:836562128145:web:bcbe8ebd6197da7a75d0b0",
    measurementId: "G-MELT46KQFD"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db =getFirestore(app)
export const auth = initializeAuth(app, {   persistence: getReactNativePersistence(AsyncStorage) });
