# EventBuddy 📅👋

**EventBuddy** is a mobile application for planning and organizing various events and gatherings. The project is built on top of the cross-platform Expo (React Native) framework, utilizing Firebase for authentication, real-time data storage, and chat management, alongside Cloudinary for media uploads.

---

## 🚀 Key Features
* **Event Management:** Create public and private events, view details, and interact with a map layout.
* **Event Calendar:** Track scheduled events and plans seamlessly in a calendar view.
* **Group Chats:** Automatic creation of discussion rooms for each event to facilitate attendee communication.
* **Friend System:** Add users as friends to quickly invite them to your events.
* **Gamification & Achievements:** A badge and reward system tracking user activity (`AchievementWatcher`).
* **Admin Panel:** Ability to review reports and moderate application content.

---

## 🛠 Tech Stack
* **Framework:** React Native (Expo)
* **Navigation:** Expo Router (file-based routing)
* **Backend/Database:** Firebase Auth, Firestore, Firebase Storage
* **Media Hosting:** Cloudinary
* **Language:** TypeScript
* **Tooling:** ESLint, EAS (Expo Application Services).

---

## 📋 Step-by-Step Setup Guide

### 1. Prerequisites
Ensure you have the following installed on your machine:
* **Node.js** (LTS version recommended)
* **npm** or **yarn** package manager
* **Expo Go** app on your smartphone OR a configured **Android Emulator** / **iOS Simulator**.

---

### 2. Install Dependencies
Open your terminal in the project root directory and run:

npm install

---

### 3. Environment Variables Configuration (.env)
Create a file named `.env` in the root directory of your project. Copy the template below and replace the placeholder values with your actual service credentials.

> ⚠️ **Important:** Ensure that `.env` is added to your `.gitignore` file so your private API keys are never pushed to GitHub.

```env
# ---------------------------------------------------------------------------
# 1. CLOUDINARY (Media Storage) | Website: [https://cloudinary.com/](https://cloudinary.com/)
# ---------------------------------------------------------------------------
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_preset_name

# ---------------------------------------------------------------------------
# 2. FIREBASE CORE (Database & Web App Configuration) | Website: [https://console.firebase.google.com/](https://console.firebase.google.com/)
# ---------------------------------------------------------------------------
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# ---------------------------------------------------------------------------
# 3. GOOGLE AUTHENTICATION CLIENT IDS | Website: [https://console.cloud.google.com/](https://console.cloud.google.com/)
# ---------------------------------------------------------------------------
EXPO_PUBLIC_FIREBASE_WEB_CLIENT_ID=your_web_client_id
EXPO_PUBLIC_FIREBASE_IOS_CLIENT_ID & EXPO_PUBLIC_FIREBASE_ANDROID_CLIENT_ID:
EXPO_PUBLIC_FIREBASE_IOS_CLIENT_ID=your_ios_client_id
EXPO_PUBLIC_FIREBASE_ANDROID_CLIENT_ID=your_android_client_id

---
```

### 4. Start the Development Server

Launch the Expo local development server (Metro Bundler) using:

`npx expo start`

Scan the generated **QR code** using your device camera (iOS) or the Expo Go app (Android). Alternatively, press `a` to open on an Android Emulator or `i` for an iOS Simulator.