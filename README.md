<div align="center">

  <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/YouTube_play_buttom_icon_%282013-2017%29.svg" alt="KidTube Logo" width="100" height="100">

  <h1>KidTube Platform</h1>

  <p><strong>A fully isolated, AI-moderated YouTube sandbox built for absolute parental control.</strong></p>

  <p>
    <a href="#-overview">Overview</a> •
    <a href="#-architecture">Architecture</a> •
    <a href="#-features">Features</a> •
    <a href="#-getting-started">Getting Started</a> •
    <a href="#-api-reference">API Reference</a> •
    <a href="#-deployment">Deployment</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/React_Native-Expo-000020?style=flat-square&logo=react" alt="Expo">
    <img src="https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=next.js" alt="Next.js">
    <img src="https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=nodedotjs" alt="Node">
    <img src="https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=flat-square&logo=firebase" alt="Firebase">
    <img src="https://img.shields.io/badge/TensorFlow-JS-FF6F00?style=flat-square&logo=tensorflow" alt="TensorFlow">
  </p>

</div>

---

## 📖 Overview

**KidTube** is a production-grade, three-tier platform that gives parents total control over their children's video-watching experience. It replaces YouTube's addictive recommendation engine with a **whitelist-only** model — if a parent hasn't explicitly approved a channel, it does not exist in the child's universe.

> **Core Philosophy:** KidTube doesn't filter YouTube. It *replaces* it with a fully isolated, parent-curated environment.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         KidTube Platform                          │
│                                                                    │
│  ┌─────────────────┐      ┌──────────────────┐                    │
│  │  Parent         │      │  Child            │                    │
│  │  Dashboard      │      │  Mobile App       │                    │
│  │  (Next.js 14)   │      │  (Expo / RN)      │                    │
│  └────────┬────────┘      └────────┬──────────┘                   │
│           │                        │                               │
│           └──────────┬─────────────┘                              │
│                      │ HTTPS / JWT                                 │
│           ┌──────────▼──────────────────┐                         │
│           │       Backend API           │                          │
│           │    (Express / Node.js)       │                         │
│           │                             │                          │
│           │  ┌───────────┐  ┌────────┐  │                         │
│           │  │ YouTube   │  │nsfwjs  │  │                         │
│           │  │ Data API  │  │  AI    │  │                         │
│           │  └─────┬─────┘  └───┬────┘  │                         │
│           └────────┼────────────┼───────┘                         │
│                    │            │                                  │
│           ┌────────▼────────────▼───────┐                         │
│           │     Firebase Firestore       │                         │
│           └─────────────────────────────┘                         │
└──────────────────────────────────────────────────────────────────┘
```

### Design Patterns Used

| Pattern | Where Applied |
|---|---|
| **Router / Module Pattern** | Backend routes split into dedicated files (`src/routes/`) |
| **Chain of Responsibility** | Auth middleware: tries Firebase token → falls back to JWT |
| **Repository / API Client** | `parent-dashboard/src/lib/api.ts` — single source of truth for all HTTP calls |
| **Custom Hook + Repository** | `child-app/hooks/useApi.ts` — encapsulates all network logic for the mobile app |
| **Factory Pattern** | `src/middleware/validate.js` — produces composable validation middlewares |
| **Observer Pattern** | React state + `useEffect` for reactive data fetching |

---

## ✨ Features

### 🛡️ Parent Dashboard
| Feature | Description |
|---|---|
| **Channel Whitelisting** | Approve channels by URL or `@handle`. Multiple channels can be added at once (comma-separated). |
| **Video-Level Blocking** | See every video from an approved channel and individually hide specific ones. |
| **Multi-Child Profiles** | Each child gets their own isolated feed, history, stars, and screen-time rules. |
| **Screen Time Limits** | Set a daily minute cap. Once reached, the child's app locks down. |
| **Bedtime Lock** | Set a time (e.g. `20:00`) after which the app shows a sleep screen. |
| **Gamification Toggle** | Enable/disable the Educational Tollbooth globally. |
| **Shorts Toggle** | Disable the Shorts tab entirely across all child devices. |
| **Watch History** | See a timestamped log of every video your child has watched. |

### 📱 Child Mobile App
| Feature | Description |
|---|---|
| **Distraction-Free Player** | Custom video player with touch blockers over YouTube watermarks, share buttons, and end-screen recommendations. |
| **Profile Selector** | "Who's Watching?" screen supports multiple children on one device. |
| **Educational Tollbooth** | After every 3 videos, a math problem must be solved to earn ⭐ Stars. |
| **Sleep Screen** | Full-screen lock when the daily limit or bedtime is reached. |
| **Offline Cache** | Video feed is cached in `AsyncStorage` for instant UI on poor connections. |

### 🧠 AI Thumbnail Moderation
When a channel is added, the backend automatically:
1. Fetches the 20 most recent video IDs
2. Downloads each thumbnail
3. Runs **TensorFlow.js** + `nsfwjs` locally in a concurrent `Promise.all` batch
4. Rejects any video classified as `Porn`, `Sexy`, or `Hentai`

> **Performance Note:** The AI screening process utilizes concurrent batch processing to minimize blocking the Node.js event loop, ensuring fast channel onboarding even for large playlists.

### 🛡️ Security Enhancements
- **Strict CORS Origin Filtering:** Backend prevents unauthorized web-client requests.
- **Environment Variable Validation:** Fail-fast mechanisms ensure critical keys (`JWT_SECRET`, `SYNC_SECRET`) are present at startup.
- **Parent Override Mode:** Secure PIN/Password challenges allow temporary overrides on the sleep screen.

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Expo CLI** (`npm install -g expo-cli`)
- **EAS CLI** (`npm install -g eas-cli`)
- A **Firebase Project** with Firestore and Authentication enabled
- A **Google Cloud** YouTube Data API v3 key

---

### 1. Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
# Required
PORT=8080
JWT_SECRET=your-secret-key-change-this-in-production
YOUTUBE_API_KEY=your-youtube-data-api-v3-key
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}  # paste the full JSON as one line

# Optional — for nightly sync job
SYNC_SECRET=a-long-random-secret-string
PING_URL=https://your-render-url.onrender.com/health
```

> **Alternative:** Place `firebase-service-account.json` in `backend/` instead of using the env var.

```bash
npm start
# → ✅ KidTube Backend API listening on port 8080
```

---

### 2. Parent Dashboard

```bash
cd parent-dashboard
npm install
```

Create `parent-dashboard/.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080   # or your Render URL in production
```

```bash
npm run dev
# → Navigate to http://localhost:3000
```

---

### 3. Child App

```bash
cd child-app
npm install
```

```bash
npx expo start
# → Scan the QR code with the Expo Go app
```

---

## 📊 Firestore Data Model

```
accounts/
  {email}/                   ← Parent account with hashed device password

users/
  {uid}/
    settings/
      global/                ← { disableShorts, educationalTollbooth }
    children/
      {childId}/             ← { name, stars, dailyLimitMins, bedtime, hiddenVideos[], history[] }
        subscriptions/
          {channelId}/       ← { channelId, channelTitle, addedAt }

channels/
  {channelId}/               ← Global channel registry { channelId, channelTitle, addedAt }

videos/
  {videoId}/                 ← { videoId, title, channelId, thumbnails, publishedAt, duration }
```

---

## 📡 API Reference

All endpoints (except `/health`, `/api/sync`, and auth endpoints) require:
```
Authorization: Bearer <token>
```

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | Service health check |
| `POST` | `/api/signup` | None | Create a parent account |
| `POST` | `/api/login` | None | Authenticate (returns JWT) |
| `POST` | `/api/device-password` | Token | Set child device password |
| `GET` | `/api/children` | Token | List child profiles |
| `POST` | `/api/children` | Token | Create a child profile |
| `POST` | `/api/children/:id/settings` | Token | Update screen time rules |
| `GET` | `/api/channels?childId=` | Token | List approved channels |
| `POST` | `/api/channels` | Token | Approve a channel (triggers AI scan) |
| `DELETE` | `/api/channels/:id?childId=` | Token | Remove a channel |
| `GET` | `/api/videos?childId=` | Token | Get video feed for a child |
| `POST` | `/api/videos/hide` | Token | Hide a video for a child |
| `POST` | `/api/videos/unhide` | Token | Unhide a video |
| `POST` | `/api/videos/stars` | Token | Award stars to a child |
| `GET` | `/api/settings` | Token | Get global settings |
| `POST` | `/api/settings` | Token | Update global settings |
| `GET` | `/api/history?childId=` | Token | Get watch history |
| `POST` | `/api/history` | Token | Log a watch event |
| `POST` | `/api/sync` | Sync Secret | Nightly video sync (GitHub Actions) |

---

## 📦 Deployment

### Backend → Render

1. Connect your GitHub repo to a new **Render Web Service**
2. Set **Build Command:** `npm install`
3. Set **Start Command:** `npm start`
4. Add all environment variables from the `.env` table above in Render's dashboard

### Parent Dashboard → Vercel

1. Import the GitHub repo to Vercel
2. Set **Root Directory** to `parent-dashboard`
3. Add all `NEXT_PUBLIC_*` environment variables

### Child App → EAS Build

```bash
cd child-app
eas login
eas build -p android --profile production
# Download the .apk and sideload onto the child's device
```

---

## 🔒 Security

- **No ads or trackers** in the child app
- **JWT-based isolation**: child devices never hold parent Firebase credentials
- **AI moderation** runs server-side with a strict per-image timeout
- **Whitelist-only**: zero chance of accidental exposure to unreviewed content
- **Input validation** on all API routes via factory-based middleware
- **Field whitelisting** in settings routes prevents arbitrary data injection

---

## 🌙 Nightly Sync

A GitHub Actions cron job runs daily at 02:00 UTC to keep video feeds fresh.

**Required GitHub Secrets:**

| Secret | Value |
|---|---|
| `BACKEND_URL` | Your Render URL (e.g. `https://kidtube-almy.onrender.com`) |
| `SYNC_SECRET` | Must match `SYNC_SECRET` in your Render environment |

---

<div align="center">
  <i>Built with ❤️ for parents who want their kids to learn, not just scroll.</i>
</div>
