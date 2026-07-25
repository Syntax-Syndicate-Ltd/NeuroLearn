# 🧠 NeuroLearn AI — Adaptive Learning & Arcade Battle Engine

> **Empowering Neurodivergent & Neurotypical Learners through AI-Driven Content, Emotional Intelligence, and HTML5 Arcade Challenge Games.**

---

## 🌟 Overview

**NeuroLearn AI** is a state-of-the-art, neuro-adaptive learning platform designed to personalize educational content for students of all cognitive styles (ADHD, Dyslexia, Dyscalculia, Autism, Anxiety, and Processing Speed variations).

By leveraging real-time LLM narration generation, EdgeTTS streaming audio, face-api emotion detection, and **60fps HTML5 Canvas arcade games**, NeuroLearn transforms static textbooks and PDFs into immersive, multi-sensory interactive modules.

---

## 🔥 Key Features

### 1. 📖 AI-Powered Adaptive Syllabus & Content Generation
- **PDF & Text Ingestion**: Instantly transforms raw notes, slides, and textbooks into structured learning modules.
- **Multilingual Support**: Supports syllabus and audio narration across global languages.
- **Personalized Narrations**: Adapts explanation depth, reading pace, and sentence complexity based on learner profile flags (e.g. dyslexia tracking, anxiety reduction, ADHD hyperfocus).

### 2. 🎮 60fps HTML5 Canvas Arcade Engine
Pure interactive gameplay with zero quiz-like text buttons — animated physics, particle bursts, screen shake, and trail effects:
- 🌟 **METEOR BLAST (`true_false_blitz`)**: Floating glowing orbs with physics — blast TRUE facts before they escape!
- 🍬 **CANDY MATCH (`concept_connect`)**: Memory grid matching terms with definitions.
- ⚡ **GRAVITY SORT (`label_match`)**: Sort falling items into category buckets before they hit the ground.
- 🔗 **CHAIN REACTOR (`sequence_sort`)**: Interactive node chain — figure out the order of concepts and connect lightning beams!
- 💻 **CODE DROP (`code_drop`)**: Catch falling code snippets to complete syntax gaps.

### 3. 📝 Interactive Adaptive Quizzes
- Multiple-choice questions tagged by difficulty (Easy, Medium, Hard) and concept tags.
- Instant 3D card interaction, answer rationale explanations, and bonus XP rewards.

### 4. 🔊 EdgeTTS Multilingual Audio Streaming
- Real-time chunked audio streaming (`edge-tts`) with customizable regional voices, pitch, and speed adjustments.

### 5. 🧬 Progress DNA & Parent Dashboard
- Comprehensive metrics: Total XP, chapter completion progress, dominant emotion tracking, average quiz scores, and badge collections.

### 6. 🔥 Firebase Live Firestore & Auth Panel Sync
- Direct live sync with **Google Firebase Firestore REST API** and **Firebase Authentication Panel** (`neurolearn-d9491`).

---

## 🛠️ Technology Stack

- **Backend**: Python 3.10+, Flask, `requests`, `firebase-admin`, `edge-tts`
- **Database**: Firebase Firestore REST API + Local Resilient Cache
- **Authentication**: Firebase Authentication REST API (`identitytoolkit.googleapis.com`)
- **Frontend**: Vanilla JavaScript (ES6+), HTML5 Canvas 2D Engine, TailwindCSS
- **AI Models**: Groq (`llama-3.3-70b-versatile`, `llama-3.1-8b-instant`), OpenRouter
- **Accessibility & Vision**: `face-api.js` (Emotion & Distress Detection), SpeechRecognition Web API

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.10 or higher
- Git

### 2. Installation

Clone the repository and install the dependencies:
```bash
# Clone repository
git clone https://github.com/YourOrg/NeuroLearn.git
cd NeuroLearn

# Install dependencies
pip install -r requirements.txt
```

### 3. Environment Configuration (`.env`)
Create a `.env` file in the root directory:
```env
OPENROUTER_API_KEY="your-openrouter-key"
GROQ_API_KEY="your-groq-key"
SECRET_KEY="super_secret_flask_session_key_neurolearn"

SYLLABUS_MODEL="llama-3.3-70b-versatile"
CHAPTER_MODEL="llama-3.3-70b-versatile"
FALLBACK_MODEL="llama-3.1-8b-instant"

# Firebase Configuration
FIREBASE_API_KEY="AIzaSyA_82lrODFlAby8lfF2TXW45-9dGBt_ZUE"
FIREBASE_AUTH_DOMAIN="neurolearn-d9491.firebaseapp.com"
FIREBASE_PROJECT_ID="neurolearn-d9491"
FIREBASE_STORAGE_BUCKET="neurolearn-d9491.firebasestorage.app"
FIREBASE_MESSAGING_SENDER_ID="188637252995"
FIREBASE_APP_ID="1:188637252995:web:db3777a0322ed00fc13ab6"
FIREBASE_MEASUREMENT_ID="G-2SWCNG7RWJ"
```

### 4. Running the Application
```bash
python app.py
```
Open your browser and navigate to: `http://localhost:8000`

---

## 📂 Project Structure

```
output_project_modified/
├── app.py                     # Main Flask Application & Firebase REST Controller
├── requirements.txt           # Python Package Dependencies
├── .env                       # Environment Credentials
├── static/
│   ├── css/
│   │   └── styles.css         # Glassmorphism & Custom UI Rules
│   └── js/
│       ├── game_engine.js     # HTML5 Canvas 60fps Arcade Game Engine
│       ├── learn.js           # Learn Manager & Dynamic Generation Poller
│       ├── quiz.js            # Interactive Quiz Engine
│       ├── emotion_detector.js# Face-api.js Distress Intervention Engine
│       └── dna_card.js        # Progress DNA Component
├── templates/
│   ├── base.html              # Base Layout & Firebase SDK Init
│   ├── index.html             # Landing Page
│   ├── chapters.html          # Interactive Chapter Level Map
│   ├── learn.html             # Bite-Sized Learning View
│   ├── quiz.html              # Quiz Interface
│   ├── game.html              # Arcade Canvas Container
│   ├── dashboard.html         # Student Dashboard
│   └── parent_dashboard.html  # Parent Analytics Dashboard
└── utils/
    ├── ai_processor.py        # Groq/OpenRouter Prompts & Course Builder
    └── tts_engine.py          # EdgeTTS Multilingual Audio Streaming Engine
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
