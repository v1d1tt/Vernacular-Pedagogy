# Vaani-Setu (Vernacular Pedagogy Platform)

> **Offline-First Multilingual Edge AI for Foundational Literacy and Numeracy (FLN)**
> Designed for Tribal Students lying under the PALASH multi-lingual education program..

---

## Overview

**Vaani-Setu** is an offline-first, edge-powered vernacular pedagogy application designed to bridge language barriers in primary classrooms across India. Built to run seamlessly on low-cost hardware (e.g., 2 GB RAM Android tablets or single-board devices) with **100% offline capabilities**, Vaani-Setu enables real-time speech translation, native Ol Chiki script rendering for Santali, interactive FLN activities, and teacher-led classroom management without requiring an internet connection.

---

## Key Features

### 1. Vernacular and Native Ol Chiki Script Integration
- **Primary Languages**: Hindi (Devanagari script), Santali (Ol Chiki script: ᱥᱟᱱᱛᱟᱲᱤ), and English.
- **Extended Language Support**: Expandable architecture supporting Bengali, Marathi, Tamil, Telugu, Gujarati, and Kannada.
- **Native Script Rendering**: Complete UI, flashcards, quizzes, and speech outputs displayed in native scripts (including Ol Chiki).

### 2. 100% Offline Edge AI Engine
- **Voice Activity Detection (VAD)**: Silero VAD ONNX for low-latency voice detection (0.88 ms per chunk).
- **High-Accuracy Hindi ASR**: AI4Bharat IndicConformer quantized INT8 model returning native Devanagari script.
- **Santali ASR (Ol Chiki)**: Fine-tuned Whisper-Small model for native Ol Chiki speech recognition.
- **Multilingual ASR**: Sherpa-ONNX INT8 Whisper engine for English, Bengali, Marathi, Tamil, and Telugu.
- **Neural Text-to-Speech (TTS)**: Piper VITS neural speech synthesis providing 22 kHz female voice output (`hi_IN-priyamvada-medium`).
- **Neural Machine Translation**: IndicTrans2 ONNX INT8 models (1B and 200M distilled) for fast local translation.
- **On-Demand Small Language Model (SLM)**: SmolLM2-360M ONNX for dynamic quiz and worksheet generation.

### 3. Teacher Console
- **Local Account Management**: Offline teacher sign-up and login using credentials stored in local SQLite database (`edge_classroom.db`).
- **Live Classroom Broadcast**: Transmit spoken instruction in real time with automatic translation for students.
- **AI Activity Generator**: Instant offline generation of FLN quizzes, flashcards, and worksheets aligned with NCERT Class 1 to 3 curricula.
- **Hands-Free Speech Controls**: Voice shortcut parser (*"Generate Quiz"*, *"Mute all"*).
- **Edge Server Diagnostics**: Sleek header status button and settings modal for network configuration and status checks.

### 4. Student Interactive Console
- **Auto-Discovery and P2P Connection**: Connect to local classroom edge server automatically.
- **Live Multilingual Audio**: Hear teacher instructions translated into the student's native language.
- **FLN Learning Games**: Interactive phonics, counting, and Ol Chiki letter recognition games.
- **Audio-Visual Flashcards and Quizzes**: Engaging visual cues with tap-to-listen pronunciation.
- **Live Mic Waveform Visualizer**: Interactive visualizer for student voice responses and hand-raising requests.

### 5. Android Mobile App (Capacitor)
- Packaged as a native Android app via Capacitor JS for instant deployment on Android smartphones and classroom tablets.

---

## Architecture and Tech Stack

```
             ┌──────────────────────────────────────────────┐
             │            Next.js / React Frontend          │
             │     (Vanilla CSS, Lucide, Capacitor JS)      │
             └──────────────────────┬───────────────────────┘
                                    │ HTTP / WebSockets
             ┌──────────────────────▼───────────────────────┐
             │              FastAPI Edge Server             │
             │           (Python, SQLite Database)          │
             └──────┬──────────────────────┬─────────┬──────┘
                    │                      │         │
     ┌──────────────▼──────┐      ┌────────▼──┐   ┌──▼────────────────┐
     │ IndicConformer / VAD│      │ IndicTrans│   │   Piper VITS TTS  │
     │ Whisper Santali ASR │      │ Translation│   │ Speech Synthesis  │
     └─────────────────────┘      └───────────┘   └───────────────────┘
```

- **Frontend**: Next.js 15, TypeScript, Vanilla CSS, Lucide React, Capacitor JS.
- **Backend Edge Server**: FastAPI (Python), SQLite (`edge_classroom.db`), Uvicorn.
- **AI Stack**: PyTorch (CPU), ONNX Runtime, Sherpa-ONNX, IndicTrans2, Piper VITS TTS, SmolLM2.

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
# Build static web export and sync to Android
npm run android
```
Open the `android/` directory in **Android Studio** and click **Run 'app'** to deploy to a connected Android device or emulator.

---

## Directory Structure

```
Vernacular-Pedagogy/
├── app/                      # Next.js 15 App Router pages
│   ├── page.tsx              # Onboarding and Language / Role Selection
│   ├── teacher/page.tsx      # Teacher Console
│   ├── student/page.tsx      # Student Console
│   └── language-dump/        # Crowdsourcing Tool for New Languages
├── components/               # UI components (Mic waveform, Language switch, etc.)
├── lib/                      # API client, translations, audio recorder, NIPUN data
├── server/                   # FastAPI Edge AI Backend
│   ├── main.py               # API Endpoints and WebSockets
│   ├── database.py           # SQLite schema and database manager
│   ├── ai_engine.py          # Silero VAD, IndicConformer ASR, Piper TTS engine
│   ├── model_manager.py      # Edge AI model lifecycle and ONNX runtimes
│   ├── indictrans_onnx.py    # IndicTrans2 ONNX translation helper
│   └── models/               # Quantized ONNX models (ASR, NMT, TTS, SLM)
├── android/                  # Capacitor Android Native Project
├── capacitor.config.json     # Capacitor configuration
└── README.md                 # Project documentation

---

## License and Acknowledgments
Built for inclusive vernacular primary education under NIPUN Bharat Mission.
