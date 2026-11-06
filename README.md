# Syllo

> **Student productivity, reimagined.**

Syllo is a student productivity application designed to bring classes, notes, assignments, deadlines, reminders, and AI-powered academic assistance into one connected experience.

Instead of switching between multiple tools to manage academic life, Syllo aims to provide students with a single focused environment for their everyday academic workflow.

---

## 📱 Download Syllo

The Android build is available for testing.

### Download APK

[**⬇️ Download Syllo for Android**](https://drive.google.com/file/d/10wjEtDwG-XQ09JsnVjyyFcbfuL8SiJeq/view?usp=drivesdk)

> Open the Google Drive link and download the latest APK to install Syllo on your Android device.

**Note:** You may need to allow installation from unknown sources when installing the APK outside the Google Play Store.

---

## ✨ Features

### 📅 Timetable & Classes

Manage your academic schedule and keep track of upcoming classes from one place.

- View scheduled classes
- Organize your timetable
- Access upcoming classes
- Receive class-related reminders

### 📝 Notes

Capture and organize academic information digitally.

- Create and manage notes
- Keep study material organized
- Quickly access important information

### 🤖 AI Note Summarization

Turn longer notes into concise, easier-to-review information.

**Write → Summarize → Review**

The AI layer is designed to reduce the friction between capturing information and reviewing it.

### 📚 Assignment Management

Keep track of academic tasks and deadlines.

- Create assignments
- Set deadlines
- Track pending work
- Manage upcoming tasks
- Receive reminders

### ✍️ AI Assignment Helper

Syllo includes an AI-powered assignment assistance workflow.

Provide an assignment prompt and generate structured assistance that can be reviewed and edited before use.

The system also supports generating a **handwritten-style PDF** from the resulting content.

### 🔔 Notifications

Stay aware of important academic events such as upcoming classes and assignment deadlines.

### 🔐 Authentication

Syllo uses secure authentication to manage user accounts and sessions.

---

## 🛠️ Tech Stack

### Frontend

- React Native
- Expo
- TypeScript

### Backend

- Supabase
- PostgreSQL
- Supabase Authentication

### AI

- AI-powered summarization
- AI assignment assistance

### Mobile / Native

- Expo Notifications
- Expo Secure Store
- Expo Audio
- Expo SQLite

### Build & Deployment

- Expo EAS
- Android APK

---

## 🏗️ Project Architecture

```text
                    SYLLO
                      │
                      ▼
              React Native + Expo
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
    Timetable       Notes       Assignments
        │             │             │
        └─────────────┼─────────────┘
                      │
                      ▼
                  Supabase
              ┌───────┼───────┐
              │       │       │
              ▼       ▼       ▼
            Auth   Database  Storage
                      │
                      ▼
                   AI Layer
```

---

## 🎯 Product Vision

Syllo started with a simple question:

> **What if your academic life lived in one place?**

The long-term goal is to evolve Syllo beyond a basic productivity application into a more intelligent academic companion.

Future possibilities include:

- VTOP / academic data integration
- Smart study planning
- Exam preparation planning
- Attendance intelligence
- AI academic assistant
- Campus events and opportunities
- Student collaboration
- Context-aware academic notifications
- Academic analytics

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- Node.js
- npm
- Git
- Expo CLI / Expo tooling
- Android Studio or an Android device

### Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/syllo.git
cd syllo
```

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npx expo start
```

You can then run the application using an Android emulator or a connected physical device.

---

## 🔑 Environment Variables

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Never commit your actual environment variables or private credentials to GitHub.

---

## 📸 Screenshots


| Dashboard | Timetable |
|---|---|
| <img width="716" height="1600" alt="WhatsApp Image 2026-11-06 at 20 50 45" src="https://github.com/user-attachments/assets/6b251aca-b6f5-49b6-8b34-8d161cfba6b7" /> | <img width="716" height="1600" alt="WhatsApp Image 2026-11-06 at 20 50 46" src="https://github.com/user-attachments/assets/7744bd09-f5a2-41dc-98d9-30f25003586b" /> |

| Notes | Assignments |
|---|---|
| <img width="716" height="1600" alt="WhatsApp Image 2026-11-06 at 20 50 46 (1)" src="https://github.com/user-attachments/assets/0cb579ea-63aa-41b5-bfa0-34cdb202eaa2" /> | <img width="716" height="1600" alt="WhatsApp Image 2026-11-06 at 20 50 46 (2)" src="https://github.com/user-attachments/assets/f60e1135-135c-4551-b9cf-8f3fb4afc70e" /> |


---

## 🧪 Project Status

**Current Status:** Active Development

The current version focuses on establishing the core student productivity workflow and mobile application foundation.

Features and UI are actively evolving.

---

## 🗺️ Roadmap

- [x] Authentication
- [x] Student account system
- [x] Initial mobile application
- [x] Timetable foundation
- [x] Notes
- [x] Assignment management
- [x] AI integration foundation
- [x] Android build
- [ ] VTOP integration
- [ ] Smart study planner
- [ ] Attendance intelligence
- [ ] Exam planner
- [ ] AI academic assistant
- [ ] Campus intelligence
- [ ] Student collaboration
- [ ] iOS release
- [ ] Production release

---

## 👨‍💻 Developer

**Himanshu Ranjan**

B.Tech CSE — Cybersecurity  
VIT Bhopal University

Developer · Designer · Builder

---

## 📄 License

This project is currently intended for educational, experimental, and portfolio purposes.

License details may be added as the project moves toward public release.

---

## ⭐ Support

If you find Syllo interesting, consider giving the repository a ⭐ on GitHub.

Feedback, ideas, and contributions are welcome.

---

### Syllo

**Plan better. Learn smarter. Stay ahead.**
