# KidTube - A Safe YouTube Environment for Kids

KidTube is a comprehensive suite designed to give parents complete control over their child's YouTube viewing experience. It strips away the algorithmic rabbit hole, hides comments, and completely blocks the standard YouTube recommendation engine, leaving a safe, isolated viewing sandbox.

## Architecture

The project is divided into three main components:

1. **Child App (`/child-app`)**: A React Native (Expo) mobile application designed specifically for the child's device (tablet or phone). It provides a distraction-free, simplified interface.
2. **Parent Dashboard (`/parent-dashboard`)**: A Next.js web application for the parent. Parents use this portal to manage approved channels, view watch history, and toggle global settings.
3. **Backend API (`/backend`)**: A Node.js/Express server that acts as the bridge. It connects to the YouTube Data API to fetch videos, uses Google's Gemini AI to analyze thumbnails and titles for child safety, and stores data in Firebase Firestore.

## Core Features

- **Algorithmic Isolation**: The child app only ever displays videos from channels explicitly approved by the parent.
- **AI Safety Filter**: When a parent approves a channel, the backend uses AI to scan video titles and thumbnails. Any videos flagged as inappropriate or "brain-rot" are silently dropped.
- **Watch History Logging**: Every video the child taps is logged to the backend and instantly appears on the Parent Dashboard.
- **Educational Tollbooth**: When enabled, the app pauses after every 3 videos and asks the child a simple math question before they can continue watching (Learn-to-Earn).
- **Shorts Toggle**: Parents can completely disable YouTube Shorts across the entire app with a single switch.
- **Touch Blockers**: The video player includes invisible shields over the "Watch on YouTube" watermarks and end-screen recommendation cards to prevent the child from accidentally escaping the safe sandbox.
- **Offline-First Caching**: The child app caches channels and videos locally, allowing for instant load times even if the backend is waking up.
- **Bulk Channel Approval**: Parents can paste comma-separated lists of YouTube channels to approve dozens of safe creators at once.

## Setup Instructions

### Prerequisites
- Node.js installed
- A Firebase Project (with Firestore and Authentication enabled)
- A YouTube Data API v3 Key
- A Google Gemini API Key

### 1. Backend Setup
1. Navigate to `backend/` and run `npm install`.
2. Create a `.env` file with your `YOUTUBE_API_KEY` and `GEMINI_API_KEY`.
3. Set up your Firebase Admin SDK service account in `src/firebase.js`.
4. Run `npm start` to run the server on port 8080.

### 2. Parent Dashboard Setup
1. Navigate to `parent-dashboard/` and run `npm install`.
2. Create a `.env.local` file with your Firebase client configuration.
3. Run `npm run dev` to start the Next.js development server.

### 3. Child App Setup
1. Navigate to `child-app/` and run `npm install`.
2. Update the `baseUrl` variable in `App.tsx` to point to your hosted backend URL.
3. Run `npx expo start` to launch the app via Expo Go on an emulator or physical device.

## Deployment

- **Backend**: Deployed to Render. Includes an internal cron job to ping the `/health` endpoint every 14 minutes to prevent free-tier spin-down.
- **Parent Dashboard**: Deployed to Vercel for continuous integration and hosting.
- **Child App**: Can be built into an APK via EAS Build (`eas build -p android --profile preview`) and installed directly on the child's Android device.
