<div align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/YouTube_play_buttom_icon_%282013-2017%29.svg" alt="KidTube Logo" width="120" height="120">
  <h1 align="center">KidTube Platform</h1>
  
  <p align="center">
    <strong>A totally secure, distraction-free YouTube sandbox built for absolute parental control.</strong>
  </p>

  <p align="center">
    <a href="#features">Features</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#deployment">Deployment</a>
  </p>

  <p align="center">
    <img src="https://img.shields.io/badge/React_Native-Expo-000020?style=for-the-badge&logo=react" alt="Expo" />
    <img src="https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js" alt="Next.js" />
    <img src="https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=nodedotjs" alt="Node" />
    <img src="https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=for-the-badge&logo=firebase" alt="Firebase" />
    <img src="https://img.shields.io/badge/TensorFlow-JS-FF6F00?style=for-the-badge&logo=tensorflow" alt="TensorFlow" />
  </p>
</div>

---

## 📖 Overview

**KidTube** is a complete ecosystem that empowers parents to curate a 100% safe video-watching experience for their children. By stripping away YouTube's addictive recommendation algorithm, hiding comments, and utilizing localized AI vision models for thumbnail safety, KidTube ensures children are protected from digital "brain-rot" and inappropriate content.

Unlike standard parental controls, KidTube is a fully isolated **whitelist-only** ecosystem. If a parent hasn't explicitly approved a channel, it does not exist in the child's universe.

---

## ✨ Core Features

### 🛡️ For Parents (Dashboard)
- **Granular Whitelisting**: Approve entire YouTube channels via URL or `@handle`.
- **Micro-Level Blocking**: Hide specific videos from approved channels that you still don't want your child to see.
- **Child Profiles**: Support for multiple children. Each child gets their own isolated feed, watch history, and screen time rules.
- **Screen Time & Bedtime Limits**: Set maximum daily minutes and strict bedtimes. Once hit, the app securely locks down.
- **Real-time Analytics**: View exactly what your child is watching, when they watched it, and for how long.
- **Global Toggles**: Disable all YouTube Shorts system-wide with a single click.

### 🎮 For Kids (Mobile App)
- **Distraction-Free UI**: Clean, engaging interface without sidebar recommendations, auto-playing next videos, or comments.
- **Sandbox Player**: Custom video player that physically blocks the hidden YouTube watermarks and end-screen cards, preventing accidental "escapes" to the native YouTube app.
- **Gamification (Learn to Earn)**: An "Educational Tollbooth" pauses viewing after every 3 videos, requiring the child to solve a math problem to earn 🌟 Stars and unlock more screen time.
- **Offline Resiliency**: Heavily cached architecture means the UI stays snappy even on poor network connections.

---

## 🏗️ Architecture

KidTube relies on a decoupled, three-tier architecture:

1. **📱 Mobile App (Frontend)**
   - Built with **React Native (Expo)**.
   - Handles the child's viewing experience, video playback (via `react-native-youtube-iframe`), and local screen time tracking.
2. **💻 Parent Dashboard (Frontend)**
   - Built with **Next.js 14** (App Router) and **Tailwind CSS**.
   - Serves as the mission control for parents to manage profiles, authenticate devices, and curate content.
3. **⚙️ Backend API (Middleware)**
   - Built with **Node.js** and **Express**.
   - Acts as the orchestrator. It queries the YouTube Data API v3, caches metadata in Firebase Firestore, and runs **TensorFlow.js** (`nsfwjs`) on the server to automatically reject inappropriate thumbnails.

---

## 🚀 Getting Started

### Prerequisites
Before you begin, ensure you have the following API keys and services set up:
- **Node.js** (v18 or higher)
- **Firebase Project**: (Requires Authentication and Firestore Database enabled)
- **Google Cloud Console**: YouTube Data API v3 Key

### 1. Backend Setup

The backend handles all heavy lifting, including AI processing and database transactions.

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:
```env
PORT=8080
JWT_SECRET=your_super_secret_jwt_key
YOUTUBE_API_KEY=your_google_cloud_youtube_api_key
```

You must also place your Firebase Admin SDK Service Account JSON file inside `backend/src/` and link it in `firebase.js`.

Start the development server:
```bash
npm start
```
*Note: The backend runs an internal cron job every 14 minutes to prevent Render free-tier spin downs.*

### 2. Parent Dashboard Setup

The dashboard is the parent's control center.

```bash
cd parent-dashboard
npm install
```

Create a `.env.local` file in the `parent-dashboard/` directory:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
```

Start the Next.js development server:
```bash
npm run dev
```
Navigate to `http://localhost:3000` to create your Parent account.

### 3. Child App Setup

The React Native application for the child's device.

```bash
cd child-app
npm install
```

Update the backend URL:
Open `child-app/App.tsx` and change `baseUrl` to point to your backend:
```typescript
const baseUrl = 'http://YOUR_LOCAL_IP:8080'; // or your Render production URL
```

Start Expo:
```bash
npx expo start
```
Scan the QR code with the **Expo Go** app on your physical device.

---

## 🧠 AI Thumbnail Moderation

When a parent adds a new channel, the backend retrieves the channel's 20 most recent videos. Before committing them to the database, it downloads the highest resolution thumbnail available and processes it locally using **TensorFlow.js** and the `nsfwjs` model. 

If the model detects inappropriate content (`Porn`, `Sexy`, or `Hentai`) with high confidence, the video is instantly rejected and never makes it to the child's feed. To ensure stability on low-memory servers (like Render free-tier), the AI evaluation enforces a strict 1.5-second processing timeout per image.

---

## 📦 Deployment

### Parent Dashboard 
The web application is highly optimized for **Vercel**. Push your code to GitHub, import the repository to Vercel, configure your `.env.local` variables, and deploy instantly.

### Backend API
The Express backend is optimized for **Render**. 
- Connect your GitHub repository to a new Render Web Service.
- Build Command: `npm install`
- Start Command: `npm start`
- *Pro Tip: Add your deployed Render URL to the `PING_URL` variable in `index.js` so the server pings itself and stays awake.*

### Child Mobile App
Use **Expo Application Services (EAS)** to compile the raw APK/IPA.
```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```
Download the resulting `.apk` file and install it directly onto the child's Android tablet.

---

## 🔒 Security & Privacy
- **No Trackers**: KidTube contains absolutely no ad-trackers or analytics engines.
- **Isolated Authentication**: Child devices authenticate using a custom JWT linked to the parent's account. The child device never holds the parent's actual Firebase credentials.
- **Data Ownership**: All watch history and settings are stored entirely in your private Firebase Firestore instance.

---
<div align="center">
  <i>Built with ❤️ for parents who want their kids to learn, not just scroll.</i>
</div>
