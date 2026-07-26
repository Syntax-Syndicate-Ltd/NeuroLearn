<div align="center">

# 🏗️ Architecture

### NeuroLearn AI — System Design & Technical Architecture

---

</div>

<br />

## Overview

NeuroLearn AI follows a **monolithic Flask architecture** with a layered separation of concerns. The backend orchestrates AI content generation, authentication, data persistence, and audio streaming — while the frontend is a multi-page server-rendered application powered by Jinja2 templates and vanilla JavaScript.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                            │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │  Jinja2  │  │  Canvas  │  │ face-api │  │  Edge TTS Audio   │  │
│  │ Templates│  │  Arcade  │  │ Emotion  │  │  Stream Player    │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬──────────┘  │
│       │              │             │                  │             │
└───────┼──────────────┼─────────────┼──────────────────┼─────────────┘
        │              │             │                  │
   HTTP │         fetch│        POST │            GET   │ (chunked)
        │              │             │                  │
┌───────┼──────────────┼─────────────┼──────────────────┼─────────────┐
│       ▼              ▼             ▼                  ▼             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Flask Application (app.py)               │   │
│  │                                                             │   │
│  │  ┌───────────┐  ┌──────────┐  ┌───────────┐  ┌──────────┐ │   │
│  │  │   Auth    │  │  Routes  │  │  Session   │  │ Streaming│ │   │
│  │  │  Helpers  │  │ (20+ EP) │  │  Manager   │  │  (SSE)   │ │   │
│  │  └───────────┘  └──────────┘  └───────────┘  └──────────┘ │   │
│  └──────────┬──────────────┬──────────────┬────────────────────┘   │
│             │              │              │                         │
│  ┌──────────▼──┐  ┌───────▼────────┐  ┌──▼──────────────┐        │
│  │ ai_processor│  │ story_generator│  │   tts_engine    │        │
│  │    .py      │  │      .py       │  │      .py        │        │
│  └──────┬──────┘  └───────┬────────┘  └──┬──────────────┘        │
│         │                 │              │                         │
│         │     BACKEND     │              │                         │
└─────────┼─────────────────┼──────────────┼─────────────────────────┘
          │                 │              │
          ▼                 ▼              ▼
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │  Groq API    │  │ HuggingFace  │  │  Edge TTS    │
  │  OpenRouter  │  │  Inference   │  │  (Microsoft) │
  └──────────────┘  └──────────────┘  └──────────────┘
          │
          │
  ┌──────────────────────────┐
  │   Firebase Firestore     │
  │   (REST API + Cache)     │
  │                          │
  │  ┌────────────────────┐  │
  │  │  users             │  │
  │  │  user_topics       │  │
  │  │  chapters          │  │
  │  │  emotion_logs      │  │
  │  │  leaderboard       │  │
  │  └────────────────────┘  │
  └──────────────────────────┘
```

<br />

---

## 📂 Directory Structure

```text
NeuroLearn/
├── app.py                          # Main Flask application & routes
├── requirements.txt                # Python dependencies
├── .env.example                    # Template for environment variables
├── .gitignore                      # Git ignore rules
│
├── docs/                           # Project Documentation
│   ├── API.md                      # Complete endpoint reference
│   ├── ARCHITECTURE.md             # System design and data models (this file)
│   ├── DEPLOYMENT.md               # Production deployment guides
│   └── ENVIRONMENT.md              # Env variables and Firebase setup
│
├── utils/                          # Backend Modules
│   ├── ai_processor.py             # LLM orchestration, prompts, cognitive adaptations
│   ├── tts_engine.py               # Edge TTS streaming & voice mapping
│   └── story_generator.py          # Manga story & Simple mode generation
│
├── static/                         # Frontend Assets
│   ├── favicon.svg                 # SVG favicon
│   ├── favicon.png                 # PNG favicon
│   ├── css/                        # Stylesheets
│   │   ├── styles.css              # Main glassmorphism styles
│   │   └── style.css               # Supplementary styles
│   └── js/                         # Vanilla JS Modules
│       ├── main.js                 # Landing page & file upload
│       ├── engine.js               # Shared UI engine
│       ├── learn.js                # Narration & TTS controls
│       ├── game_engine.js          # HTML5 Canvas arcade engine (60fps)
│       ├── quiz.js                 # Quiz rendering & XP calculation
│       ├── emotion_detector.js     # face-api.js webcam integration
│       ├── story_mode.js           # Manga panel display
│       ├── simple_mode.js          # Simplified content cards
│       ├── accessibility_engine.js # Font scaling & contrast
│       ├── dna_card.js             # Progress DNA component
│       ├── results.js              # Chapter completion view
│       └── socratic_tutor.js       # Socratic AI Tutor UI
│
├── templates/                      # Jinja2 HTML Views
│   ├── base.html                   # Base layout & global scripts
│   ├── index.html                  # Landing page
│   ├── signup.html                 # Registration
│   ├── login.html                  # Login
│   ├── onboarding.html             # Profile creation
│   ├── parent_form.html            # 20+ field cognitive assessment
│   ├── loading.html                # Pipeline loading animation
│   ├── chapters.html               # Level map
│   ├── learn.html                  # Narration view
│   ├── game.html                   # Arcade container
│   ├── quiz.html                   # Quiz view
│   ├── results.html                # XP & Badge summary
│   ├── dashboard.html              # Student dashboard
│   └── parent_dashboard.html       # Parent analytics
│
└── cpp_games/                      # Experimental C++ arcade module
    └── neuro_arcade_engine.cpp     
```

<br />

---

## 🧩 Component Breakdown

### 1. Flask Application — `app.py`

The central orchestrator. Handles all HTTP routing, authentication, session management, and coordinates the AI pipeline.

| Responsibility | Details |
| --- | --- |
| **Authentication** | Firebase Auth REST API for signup/login, Werkzeug password hashing as secondary verification |
| **Session Management** | Server-side filesystem sessions via `flask-session` |
| **Route Handling** | 20+ endpoints — pages, API, streaming |
| **Firestore Client** | Custom `ResilientRESTFirestore` class with in-memory cache fallback |
| **Pipeline Orchestration** | Coordinates syllabus generation → chapter processing → game/quiz assembly |

> [!NOTE]
> The Firestore client (`ResilientRESTFirestore`) implements a full document/collection API that mirrors the official `google-cloud-firestore` SDK. It uses REST calls with an in-memory cache layer, so the app continues working even during network interruptions.

---

### 2. AI Processor — `utils/ai_processor.py`

The LLM orchestration layer. Handles all AI model calls, prompt engineering, and response parsing.

| Function | Purpose |
| --- | --- |
| `call_llm()` | Universal LLM caller with automatic Groq/OpenRouter routing, exponential backoff, model rotation on 429s |
| `generate_syllabus()` | Produces a structured 7–10 chapter curriculum from raw text |
| `process_chapter()` | Generates personalized narration, game items, quiz questions — applies 15+ cognitive adaptation modifiers |
| `extract_text_from_pdf()` | PDF text extraction via PyPDF2 |
| `clean_ai_json()` | Deep-cleans malformed JSON from LLM responses (handles escaped characters, raw newlines, etc.) |

**Model Routing Logic:**

```
┌──────────────────────┐
│   call_llm(model)    │
└──────────┬───────────┘
           │
     ┌─────▼─────┐
     │ "/" in     │──── Yes ──▶ OpenRouter API
     │ model name?│
     └─────┬─────┘
           │ No
           ▼
       Groq API
           │
     ┌─────▼──────────┐
     │ 429 Rate Limit? │──── Yes ──▶ Rotate between llama-3.3-70b / llama-3.1-8b
     └─────┬──────────┘
           │ Exhausted
           ▼
     Fallback to Groq (if was OpenRouter)
```

**Cognitive Adaptation System:**

The `process_chapter()` function builds a dynamic prompt modifier string based on the learner's profile. Each flag appends specific instructions to the LLM system prompt:

| Profile Flag | Prompt Modifier |
| --- | --- |
| `has_adhd` | Short paragraphs, pattern-breaks, checkpoint summaries |
| `has_dyslexia` | Simple words, ≤15-word sentences, concrete examples |
| `has_autism` | Literal language, no metaphors, explicit transitions |
| `has_anxiety` | Calming tone, small steps, frequent encouragement |
| `slow_processing` | Measured pace, shorter sentences, repeated key points |
| `working_memory` | Numbered lists, mnemonics, mini-summaries |
| `sensory_sensitive` | Calm tone, no sudden shifts, no exclamation marks |
| `adhd_hyperfocus` | Analogies from special interests |
| `adhd_severe` | Maximum pattern-breaking, ⚡ QUICK CHECK callouts |
| `has_dysgraphia` | MCQ only, drag/drop games, voice-first framing |
| `irlen_syndrome` | Audio-first delivery, tinted overlay support |
| `confidence: low` | Extra encouragement, easiest concepts first |
| `confidence: high` | Deeper insights, advanced vocabulary, critical thinking |

---

### 3. TTS Engine — `utils/tts_engine.py`

Real-time text-to-speech streaming with zero file I/O.

```
Text ──▶ edge-tts (async) ──▶ Queue ──▶ Sync Generator ──▶ HTTP chunked response
                                │
                         Falls back to:
                         1. en-US-AriaNeural (default voice)
                         2. Google Translate TTS (last resort)
```

- Runs the async `edge-tts` library in a background thread
- Yields audio chunks via a `queue.Queue` bridge to Flask's synchronous response
- Supports 5 languages with gender-specific voice mapping

---

### 4. Story Generator — `utils/story_generator.py`

Generates manga-style illustrated story panels and simplified content cards.

| Function | Purpose |
| --- | --- |
| `generate_manga_story()` | Converts chapter narration into 4–6 manga panel scripts via Groq |
| `generate_manga_images_batch()` | Generates panel illustrations via Hugging Face Inference API |
| `generate_simplified_content()` | Creates simplified content cards (emoji + heading + short explanation) |

---

### 5. Frontend Layer

Server-rendered Jinja2 templates with vanilla JavaScript modules.

| Module | Responsibility |
| --- | --- |
| `main.js` | Landing page — file upload, drag-drop, text paste, role selection |
| `engine.js` | Shared UI engine across pages |
| `learn.js` | Learning view — narration display, TTS playback controls, mode switching (Story/Simple) |
| `game_engine.js` | HTML5 Canvas arcade — 5 game types, physics simulation, particle effects, screen shake |
| `quiz.js` | Quiz engine — question rendering, scoring, XP calculation |
| `emotion_detector.js` | face-api.js webcam integration — emotion classification, distress intervention |
| `story_mode.js` | Manga panel display and navigation |
| `simple_mode.js` | Simplified content card rendering |
| `accessibility_engine.js` | Font scaling, contrast adjustments, overlays |
| `dna_card.js` | Progress DNA card component |
| `results.js` | Chapter completion — badge display, XP summary |

---

## 🗃️ Data Model

### Firestore Collections

```
users/
├── {user_id}
│   ├── username: string
│   ├── email: string
│   ├── password_hash: string
│   ├── display_name: string
│   ├── user_type: "child" | "parent"
│   ├── age_range: string
│   ├── firebase_uid: string
│   ├── learning_profile_json: string (JSON)
│   ├── student_name: string
│   └── created_at: number (epoch)

user_topics/
├── {topic_id}
│   ├── user_id: string
│   ├── topic_title: string
│   ├── subject_domain: string
│   ├── syllabus_json: string (JSON)
│   ├── raw_content: string
│   ├── learning_profile_json: string (JSON)
│   ├── cognitive_style: string
│   ├── gender: string
│   ├── emotion: string
│   ├── chapter_progress_json: string (JSON)
│   ├── chapters_generated_json: string (JSON)
│   ├── total_xp: number
│   ├── created_at: number (epoch)
│   └── last_accessed: number (epoch)

chapters/
├── {chapter_id}
│   ├── topic_id: string
│   └── data_json: string (JSON — contains narration, game_items,
│                    quiz_questions, story_data, simple_data, etc.)

emotion_logs/
├── {auto_id}
│   ├── user_id: string
│   ├── topic_id: string
│   ├── chapter_id: string
│   ├── emotion_state: string
│   ├── confidence: number
│   └── timestamp: server timestamp

leaderboard/
├── {auto_id}
│   ├── name: string
│   ├── topic: string
│   ├── score: number
│   ├── xp: number
│   ├── badge: string
│   └── created_at: server timestamp
```

---

## 🔄 Request Lifecycle

### Content Generation Pipeline

```
1. User uploads PDF/text
       │
2. POST /upload
       │ ──▶ Extract text (PyPDF2 or raw)
       │ ──▶ Store in session
       │
3. Onboarding (name, style, voice, emotion, language)
       │
4. POST /api/init-pipeline
       │ ──▶ call_llm() → generate_syllabus()
       │ ──▶ Save syllabus to session + Firestore user_topics
       │
5. GET /chapters (render chapter map)
       │
6. POST /api/generate-chapter/{id}
       │ ──▶ call_llm() → process_chapter()
       │ ──▶ Apply cognitive modifiers
       │ ──▶ Generate: narration + game_items + quiz_questions
       │ ──▶ Save to Firestore chapters collection
       │
7. GET /learn/{id}  →  GET /quiz/{id}  →  GET /game/{id}  →  GET /results/{id}
```

### Audio Streaming

```
GET /api/audio/stream/{chapter_id}
       │
       ▼
  Read narration_script from Firestore
       │
       ▼
  edge-tts async stream → Queue → Flask chunked response
       │
       ▼
  Browser <audio> plays chunks as they arrive (zero-latency)
```

---

<div align="center">

_Part of the [NeuroLearn AI](../README.md) documentation._

</div>
