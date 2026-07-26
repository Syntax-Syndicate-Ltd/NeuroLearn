<div align="center">

# 🧠 NeuroLearn AI

### _Adaptive Learning Platform for Every Kind of Mind_

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com)

<br />

**NeuroLearn AI** transforms any PDF, textbook, or raw text into a fully personalized,  
multi-sensory learning experience — tailored for neurodivergent and neurotypical learners alike.

_AI Narrations_ &nbsp;•&nbsp; _Arcade Games_ &nbsp;•&nbsp; _Emotion Tracking_ &nbsp;•&nbsp; _Multilingual TTS_ &nbsp;•&nbsp; _Parent Analytics_

<br />

🌐 **Live Demo:** [neurolearn.syntaxsyndicate.co.in](https://neurolearn.syntaxsyndicate.co.in/)

<br />

[Get Started](#-quick-start) · [Features](#-features) · [Architecture](docs/ARCHITECTURE.md)

---

</div>

<br />

## 🎯 What is NeuroLearn?

NeuroLearn is an **AI-powered adaptive learning platform** that takes static educational content and converts it into interactive, gamified learning modules. It is built to support students with **ADHD, Dyslexia, Dyscalculia, Autism, Anxiety, Dysgraphia, Irlen Syndrome, and processing speed variations** — while being equally engaging for neurotypical learners.

A parent or child uploads a PDF or pastes text → NeuroLearn's AI pipeline generates a structured syllabus → Each chapter includes personalized narrations, arcade games, adaptive quizzes, and progress tracking — all adapted to the learner's cognitive profile.

<br />

## ✨ Features

### 📖 AI-Powered Adaptive Content Engine

| Capability                  | Description                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **PDF & Text Ingestion**    | Instantly parses PDFs via `PyPDF2` or accepts raw pasted text                                                                                                |
| **Syllabus Generation**     | LLM auto-structures content into 7–10 progressive chapters                                                                                                   |
| **Personalized Narrations** | Adapts tone, complexity, sentence length, and pacing to learner profile                                                                                      |
| **Multilingual Support**    | Generates content and TTS audio in English, Hindi, Marathi, Tamil, and Telugu                                                                                |
| **Cognitive Adaptations**   | 15+ profile flags (ADHD subtype, dyslexia tracking, anxiety reassurance, working memory, sensory sensitivity, etc.) dynamically modify all generated content |

### 🎮 HTML5 Canvas Arcade Engine — 60fps

Pure interactive gameplay — animated physics, particle systems, screen shake, and trail effects.  
No quiz-like text buttons. Every game is a real game.

| Game                 | Type               | Mechanic                                                                               |
| -------------------- | ------------------ | -------------------------------------------------------------------------------------- |
| 🌟 **Meteor Blast**  | `true_false_blitz` | Floating glowing orbs with physics — blast TRUE facts before they escape               |
| 🍬 **Candy Match**   | `concept_connect`  | Memory grid — match terms with their definitions                                       |
| ⚡ **Gravity Sort**  | `label_match`      | Catch falling items and sort them into the correct category buckets                    |
| 🔗 **Chain Reactor** | `sequence_sort`    | Build concept chains — figure out the order and connect lightning beams                |
| 💻 **Code Drop**     | `code_drop`        | Catch falling code snippets to complete syntax gaps (auto-enabled for coding subjects) |

### 📝 Adaptive Quizzes

- Multiple-choice questions tagged by difficulty (`Easy` / `Medium` / `Hard`) and concept
- XP rewards scaled by performance: **350 XP** for mastery (90%+), down to scaled minimums
- Instant answer rationale explanations

### 🔊 Real-Time Text-to-Speech

- Chunked audio streaming via `edge-tts` — zero-latency playback
- Customizable voice, rate, and pitch per learner profile
- Regional voice mapping for Hindi, Marathi, Tamil, Telugu
- Automatic fallback chain: Edge TTS → Google Translate TTS

### 👁️ Emotion Detection & Cognitive Load Intervention

- Real-time webcam-based emotion analysis via `face-api.js`
- Tracks: focused, bored, distracted, stressed, anxious states
- **Automatic intervention**: When sustained distress is detected, content is dynamically simplified mid-lesson with a calming message

### 💬 Socratic AI Tutor

- In-lesson Q&A powered by Groq LLMs
- Answers strictly from chapter context — never hallucinates external information
- Adapts tone based on learner profile (dyslexia-friendly language, anxiety reassurance, age-appropriate)

### 📖 Story Mode

- Transforms chapter content into manga-style illustrated story panels
- Text generation via Groq + image generation via Hugging Face
- Cached after first generation for instant replay

### 📋 Simple Mode

- One-tap simplified content cards for overwhelmed or tired learners
- Generated on-demand and cached in Firestore

### 🧬 Progress DNA & Dashboard

- **Student Dashboard**: Total XP, topic history, chapter completion, continue/delete topics
- **Parent Dashboard**: Emotion distribution charts, disorder-level indicators (anxiety, attention, stress, engagement), learning profile summary
- **Progress DNA Card**: Per-topic summary with badges, dominant emotion, quiz averages, and learning style
- **Leaderboard**: Global XP ranking

### 🔐 Authentication & Data Persistence

- Firebase Authentication REST API (`identitytoolkit.googleapis.com`) — users appear in Firebase Console
- Firestore REST API with in-memory resilient cache (auto-fallback on connection issues)
- Guest mode with automatic topic transfer on signup/login
- Server-side Flask sessions (`flask-session`, filesystem-backed)

### 🧑‍👨‍👦 Parent Onboarding Flow

- Comprehensive 20+ field assessment form covering:
  - ADHD subtypes (mild, severe, hyperfocus) with special interest mapping
  - Dyslexia variants (decoding, tracking, Irlen syndrome)
  - Dysgraphia (motor, organisation, voice-first preference)
  - Dyscalculia (quantity sense, sequencing)
  - Processing speed with TTS rate and quiz time multipliers
  - Working memory severity
  - Autism traits (literal language, routine, predictability, sensory)
  - Anxiety variants (test, overwhelm, reassurance, avoidance)
  - Sensory sensitivities (visual, auditory, clutter)
  - Confidence level (1–5 scale mapped to low/medium/high)

<br />

## 🏗️ Architecture

> 📖 **Full Details:** See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the complete system design, data model, and cognitive adaptation logic.

```
NeuroLearn/
│
├── app.py                          # Flask application — all routes, Firebase REST client,
│                                   #   auth helpers, session management, streaming endpoints
├── requirements.txt                # Python dependencies
├── .env                            # Environment variables (API keys, model config)
├── .gitignore                      # Git ignore rules
│
├── docs/                           # Project Documentation
│   ├── API.md                      # Complete endpoint reference
│   ├── ARCHITECTURE.md             # System design and data models
│   ├── DEPLOYMENT.md               # Production deployment guides
│   └── ENVIRONMENT.md              # Env variables and Firebase setup
│
├── utils/
│   ├── ai_processor.py             # LLM orchestration — Groq & OpenRouter routing,
│   │                               #   syllabus generation, chapter processing,
│   │                               #   15+ cognitive adaptation modifiers, PDF extraction
│   ├── tts_engine.py               # Edge TTS streaming engine — multilingual voice mapping,
│   │                               #   async chunked audio generation, Google TTS fallback
│   └── story_generator.py          # Manga story panel generation (Groq text + HuggingFace images),
│                                   #   simplified content engine for Simple Mode
│
├── static/
│   ├── favicon.svg                 # SVG favicon
│   ├── favicon.png                 # PNG favicon
│   ├── css/
│   │   ├── styles.css              # Primary stylesheet — glassmorphism, animations, responsive
│   │   └── style.css               # Supplementary styles
│   └── js/
│       ├── main.js                 # Landing page logic — file upload, drag-drop, text paste
│       ├── engine.js               # Core UI engine shared across pages
│       ├── learn.js                # Learn view — narration display, TTS controls, mode switching
│       ├── game_engine.js          # HTML5 Canvas arcade engine — all 5 game types,
│       │                           #   physics, particles, screen shake, trail effects
│       ├── quiz.js                 # Quiz engine — difficulty tags, scoring, XP calculation
│       ├── results.js              # Chapter results view — badge display, XP summary
│       ├── emotion_detector.js     # face-api.js integration — webcam emotion tracking,
│       │                           #   distress intervention triggers
│       ├── dna_card.js             # Progress DNA card component
│       ├── story_mode.js           # Story Mode UI — manga panel display and navigation
│       ├── simple_mode.js          # Simple Mode UI — simplified content card display
│       ├── accessibility_engine.js # Accessibility features — font scaling, contrast, overlays
│       ├── socratic_tutor.js       # Socratic Tutor chat interface
│       └── cpp_arcade_bridge.js    # Bridge for experimental C++ arcade module
│
├── templates/
│   ├── base.html                   # Base layout — nav, Firebase SDK init, global scripts
│   ├── index.html                  # Landing page — upload zone, role selection
│   ├── signup.html                 # User registration (child / parent roles)
│   ├── login.html                  # User login
│   ├── onboarding.html             # Student onboarding — name, style, voice, emotion, language
│   ├── parent_form.html            # Parent assessment form — 20+ cognitive profile fields
│   ├── loading.html                # Pipeline loading screen — progress animation
│   ├── chapters.html               # Chapter map — level-style progression
│   ├── learn.html                  # Learning view — narration, TTS, Story/Simple mode toggles
│   ├── game.html                   # Arcade game container
│   ├── quiz.html                   # Quiz interface
│   ├── results.html                # Chapter completion results — badge, XP, DNA card
│   ├── dashboard.html              # Student dashboard — topic list, XP, continue/delete
│   └── parent_dashboard.html       # Parent analytics — emotion charts, disorder indicators
│
└── cpp_games/
    └── neuro_arcade_engine.cpp     # Experimental C++ arcade engine prototype
```

<br />

## 🛠️ Tech Stack

| Layer                 | Technology                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| **Backend**           | Python 3.10+, Flask 3.0, Gunicorn                                                                 |
| **Database**          | Firebase Firestore (REST API + in-memory resilient cache)                                         |
| **Authentication**    | Firebase Auth REST API (`identitytoolkit.googleapis.com`)                                         |
| **AI / LLM**          | Groq (`llama-3.3-70b-versatile`, `llama-3.1-8b-instant`), OpenRouter (dynamic free model routing) |
| **Text-to-Speech**    | `edge-tts` (primary), Google Translate TTS (fallback)                                             |
| **Image Generation**  | Hugging Face Inference API (manga panels)                                                         |
| **Frontend**          | Vanilla JavaScript (ES6+), HTML5 Canvas 2D, TailwindCSS                                           |
| **Emotion Detection** | `face-api.js` — webcam-based real-time emotion analysis                                           |
| **PDF Parsing**       | `PyPDF2`                                                                                          |

<br />

## 🚀 Quick Start

### Prerequisites

- **Python 3.10** or higher
- A [Groq API key](https://console.groq.com) (free tier available)
- _(Optional)_ An [OpenRouter API key](https://openrouter.ai) for model diversity

### 1. Clone & Install

```bash
git clone https://github.com/Syntax-Syndicate-Ltd/NeuroLearn.git
cd NeuroLearn
pip install -r requirements.txt
```

### 2. Configure Environment

Create a `.env` file in the project root:

```env
# --- AI API Keys ---
GROQ_API_KEY="your-groq-api-key"
OPENROUTER_API_KEY="your-openrouter-api-key"      # Optional

# --- Model Configuration ---
SYLLABUS_MODEL="llama-3.3-70b-versatile"
CHAPTER_MODEL="llama-3.3-70b-versatile"
FALLBACK_MODEL="llama-3.1-8b-instant"
TUTOR_MODEL="llama-3.3-70b-versatile"

# --- Flask ---
FLASK_SECRET_KEY="your-secret-key"

# --- Firebase ---
FIREBASE_API_KEY="your-firebase-api-key"
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"
FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
FIREBASE_APP_ID="your-app-id"
```

### 3. Run

```bash
python app.py
```

Open **http://localhost:8000** in your browser.

<br />

## 🔌 API Endpoints

| Method     | Endpoint                      | Description                                           |
| ---------- | ----------------------------- | ----------------------------------------------------- |
| `POST`     | `/upload`                     | Upload PDF or paste text to start pipeline            |
| `POST`     | `/api/init-pipeline`          | Generate syllabus from uploaded content               |
| `GET`      | `/api/pipeline-status`        | SSE stream for syllabus generation progress           |
| `POST`     | `/api/generate-chapter/<id>`  | Generate full chapter content (narration, game, quiz) |
| `GET`      | `/api/audio/stream/<id>`      | Stream TTS audio for a chapter                        |
| `GET`      | `/api/game-data/<id>`         | Fetch game items for arcade engine                    |
| `POST`     | `/api/game-complete`          | Submit game score                                     |
| `GET`      | `/api/quiz-data/<id>`         | Fetch quiz questions                                  |
| `POST`     | `/api/submit-quiz`            | Submit quiz results, calculate XP                     |
| `POST`     | `/api/generate-story`         | Generate manga story panels                           |
| `POST`     | `/api/generate-simple`        | Generate simplified content cards                     |
| `POST`     | `/api/ask-tutor`              | Socratic AI tutor Q&A                                 |
| `POST`     | `/api/emotion-log`            | Log emotion reading from webcam                       |
| `POST`     | `/api/emotion-intervention`   | Trigger cognitive load intervention                   |
| `GET`      | `/api/emotion-analytics/<id>` | Get emotion analytics for a topic                     |
| `GET`      | `/api/dna-card/<id>`          | Generate Progress DNA card data                       |
| `POST`     | `/api/continue-topic/<id>`    | Restore a previous learning topic                     |
| `POST`     | `/api/delete-topic/<id>`      | Delete a learning topic                               |
| `GET/POST` | `/api/leaderboard`            | Fetch or submit leaderboard entries                   |

<br />

## 🌍 Supported Languages

| Language   | TTS Voice (Female)    | TTS Voice (Male)          |
| ---------- | --------------------- | ------------------------- |
| 🇺🇸 English | `en-US-AriaNeural`    | `en-US-ChristopherNeural` |
| 🇮🇳 Hindi   | `hi-IN-SwaraNeural`   | `hi-IN-MadhurNeural`      |
| 🇮🇳 Marathi | `mr-IN-AarohiNeural`  | `mr-IN-ManoharNeural`     |
| 🇮🇳 Tamil   | `ta-IN-PallaviNeural` | `ta-IN-ValluvarNeural`    |
| 🇮🇳 Telugu  | `te-IN-ShrutiNeural`  | `te-IN-MohanNeural`       |

<br />

## 🧩 Learning Flow

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Upload PDF │────▶│  Onboarding  │────▶│  AI Generates    │────▶│  Chapter Map │
│  or Text    │     │  (Profile)   │     │  Syllabus (LLM)  │     │  (7-10 ch.)  │
└─────────────┘     └──────────────┘     └──────────────────┘     └──────┬───────┘
                                                                         │
                    ┌────────────────────────────────────────────────────┘
                    ▼
         ┌─────────────────┐     ┌────────────────┐     ┌───────────────┐
         │  📖 Learn       │────▶│  📝 Quiz       │────▶│  🎮 Arcade    │
         │  (Narration+TTS)│     │  (Adaptive)    │     │  Game         │
         └────────┬────────┘     └────────────────┘     └──────┬────────┘
                  │                                            │
                  │  ┌──────────────┐                          │
                  ├──│ 📖 Story Mode│                          │
                  │  └──────────────┘                          │
                  │  ┌──────────────┐         ┌────────────────┘
                  ├──│ 📋 Simple    │         │
                  │  └──────────────┘         ▼
                  │  ┌──────────────┐  ┌──────────────┐
                  └──│ 💬 AI Tutor  │  │  🏆 Results  │
                     └──────────────┘  │  + DNA Card  │
                                       └──────────────┘
```

<br />

---

<div align="center">

**Built for every kind of learner by Syntax Syndicate.**

_NeuroLearn AI — because the way you think is your superpower._

</div>
