#  वाणीSetu (Vaani-Setu) — Vernacular Pedagogy Platform

> **Offline-First Multilingual Edge AI for Foundational Literacy & Numeracy (FLN)**
> Designed for NIPUN Bharat Mission & NEP 2020 Guidelines.

---

##  Overview

**वाणीSetu (Vaani-Setu)** is an offline-first, edge-powered vernacular pedagogy application designed to bridge language barriers in primary classrooms across India. Built to run seamlessly on low-cost hardware (e.g., 2 GB RAM Android tablets / single-board devices) with **100% offline capabilities**, Vaani-Setu enables real-time speech translation, native Ol Chiki script rendering for Santali, interactive FLN activities, and teacher-led classroom management without requiring an internet connection.

---

##  Key Features

### 1.  Vernacular & Native Ol Chiki Script Integration
- **Primary Languages**: Hindi (Devanagari), Santali (Ol Chiki script — ᱥᱟᱱᱛᱟᱲᱤ), and English.
- **Regional Support**: Expandable architecture supporting Bengali, Marathi, Tamil, Telugu, Gujarati, and Kannada.
- **Native Script Rendering**: Complete UI, flashcards, quizzes, and speech outputs translated and displayed in native scripts (including Ol Chiki).

### 2. ⚡ 100% Offline Edge AI Engine
- **Voice Activity Detection (VAD)**: Silero VAD for low-latency speech detection.
- **Automatic Speech Recognition (ASR)**: Whisper-based offline transcription with fine-tuned Santali Ol Chiki speech models.
- **Neural Text-to-Speech (TTS)**: Piper VITS neural speech synthesis providing realistic voice output.
- **Machine Translation**: IndicTrans2 INT8 quantized models for fast local translation.
- **Low Memory Footprint**: Asynchronous model swapping optimized to run under **500 MB RAM**.

### 3.  Teacher Console
- **Local Account Management**: Offline teacher sign-up and login using name and password credentials stored in local SQLite database.
- **Live Classroom Broadcast**: Transmit spoken instruction in real-time with automatic translation for students.
- **AI Activity Generator**: Instant offline generation of FLN quizzes, flashcards, and worksheets aligned with NCERT Class 1–3 curricula (Maths, EVS, Hindi, English).
- **Hands-Free Speech Controls**: Voice shortcut parser (*"Generate Quiz"*, *"Mute all"*).

### 4.  Student Interactive Console
- **Auto-Discovery & Peer-to-Peer Mesh**: Connect to local classroom edge server automatically.
- **Live Multilingual Audio**: Hear teacher instructions translated into the student's native language.
- **FLN Learning Games**: Interactive phonics, counting, and Ol Chiki letter recognition games.
- **Audio-Visual Flashcards & Quizzes**: Engaging visual cues with tap-to-listen pronunciation.
- **Live Mic Waveform Visualizer**: Interactive canvas visualizer for voice responses and hand-raising.

### 5.  Android Mobile App (Capacitor)
- Packaged as a native Android app via Capacitor JS for instant deployment on Android smartphones and classroom tablets.

---

## Architecture & Tech Stack

```
             ┌──────────────────────────────────────────────┐
             │            Next.js / React Frontend          │
             │     (Tailwind CSS, Lucide, Capacitor JS)     │
             └──────────────────────┬───────────────────────┘
                                    │ HTTP / WebSockets
             ┌──────────────────────▼───────────────────────┐
             │              FastAPI Edge Server             │
             │           (Python, SQLite Database)          │
             └──────┬──────────────────────┬─────────┬──────┘
                    │                      │         │
     ┌──────────────▼──────┐      ┌────────▼──┐   ┌──▼────────────────┐
     │   Silero / Whisper  │      │ IndicTrans│   │   Piper VITS TTS  │
     │   Offline ASR       │      │ Translation│   │ Speech Synthesis  │
     └─────────────────────┘      └───────────┘   └───────────────────┘
```

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, Lucide React, Capacitor JS.
- **Backend Edge Server**: FastAPI (Python), SQLite (`edge_classroom.db`), Uvicorn.
- **AI Stack**: PyTorch (CPU), ONNX Runtime, Sherpa-ONNX, Piper VITS TTS.

---

## Getting Started

### Prerequisites
- **Node.js**: v18.0 or higher
- **Python**: v3.10 or higher
- **Android Studio**: (Optional, for building native Android APK)

---

### 1. Backend Edge Server Setup

```bash
# Navigate to server directory
cd server

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Start the edge server
python main.py
```
The edge server runs locally on `http://localhost:8000`.

---

### 2. Frontend Web App Setup

```bash
# In the root project directory
npm install

# Start development server
npm run dev
```
Open `http://localhost:3000` in your web browser.

---

### 3. Building for Android (Capacitor)

```bash
# Build static web export
npm run build

# Sync build assets to Capacitor Android project
npx cap sync android
```
Open the `android/` directory in **Android Studio** and click **Run 'app'** to deploy to a connected Android device or emulator.

---

## 📁 Directory Structure

```
Vernacular-Pedagogy/
├── app/                      # Next.js 15 App Router pages
│   ├── page.tsx              # Onboarding & Language / Role Selection
│   ├── teacher/page.tsx      # Teacher Console
│   └── student/page.tsx      # Student Console
├── components/               # UI components (Mic waveform, Language switch, etc.)
├── lib/                      # API client, translations, audio recorder, NIPUN data
├── server/                   # FastAPI Edge AI Backend
│   ├── main.py               # API Endpoints & WebSockets
│   ├── database.py           # SQLite schema & database manager
│   ├── ai_engine.py          # Silero VAD, Whisper, Piper TTS engine
│   └── models/               # Quantized ONNX & PyTorch models
├── android/                  # Capacitor Android Native Project
├── capacitor.config.json     # Capacitor configuration
└── README.md                 # Project documentation
```

---

## License & Acknowledgments
Built with ❤️ for inclusive vernacular primary education under NIPUN Bharat Mission.
