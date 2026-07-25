# 🧠 NeuroLearn AI + StudyBattle — Complete Project Documentation

> **AI-Powered Adaptive Learning Platform with Neuro-Informed Personalization**
> Every Mind Learns Differently. Now Education Does Too.

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Architecture Diagram](#architecture-diagram)
4. [Directory Structure](#directory-structure)
5. [Database Schema](#database-schema)
6. [Core Features](#core-features)
7. [User Flows](#user-flows)
8. [API Endpoints](#api-endpoints)
9. [AI/LLM Pipeline](#aillm-pipeline)
10. [Frontend Components](#frontend-components)
11. [Accessibility & Neuro-Profiling](#accessibility--neuro-profiling)
12. [Deployment & Configuration](#deployment--configuration)
13. [Environment Variables](#environment-variables)
14. [SDG Alignment](#sdg-alignment)

---

## 🔭 Project Overview

**NeuroLearn AI** is a full-stack, AI-powered adaptive learning platform that transforms any educational content (PDF or pasted text) into a deeply personalized learning experience. It is designed around the **ARCS Motivational Model** (Attention, Relevance, Confidence, Satisfaction) and clinical neurological profiling to support learners with diverse needs including **ADHD, Dyslexia, Autism, Anxiety, Dyscalculia, Dysgraphia**, and sensory sensitivities.

### What It Does

1. **Upload** any educational material (PDF or text)
2. **Profile** the learner (parent-guided neuro-profiling or student self-onboarding)
3. **AI generates** a complete personalized syllabus with 7–10 chapters
4. **Each chapter** includes: narrated lecture, interactive mind-map, gamified activity, adaptive quiz
5. **Real-time** emotion detection (webcam) triggers cognitive load interventions
6. **StudyBattle** mode enables multiplayer peer-vs-peer learning battles via Firebase

### Key Differentiators

- **Neuro-informed**: 30+ learning profile modifiers (ADHD subtypes, dyslexia tracking, Irlen syndrome, etc.)
- **Adaptive**: Content tone, complexity, pacing, and TTS voice dynamically adjust to learner profile
- **Multimodal**: Text narration + TTS audio + visual mind-maps + manga stories + simplified cards
- **Multilingual**: English, Hindi (हिंदी), Marathi (मराठी), Tamil (தமிழ்), Telugu (తెలుగు)
- **Gamified**: 5 game types, XP system, badges, leaderboard, Study Battle multiplayer

---

## 🛠 Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| **Python 3.x** | Core server language |
| **Flask 3.0.2** | Web framework with Jinja2 templating |
| **Flask-Session 0.6.0** | Server-side session management (filesystem) |
| **Firebase Admin SDK & Firestore** | Global cloud database & auth |
| **Werkzeug 3.0.2** | Password hashing, HTTP utilities |
| **python-dotenv 1.0.1** | Environment variable management |

### AI & ML Services
| Service | Usage |
|---|---|
| **Groq API** (LLaMA 3.3 70B Versatile) | Syllabus generation, chapter content, quizzes, games |
| **Groq API** (LLaMA 3.1 8B Instant) | Story generation, simplified content (lighter model) |
| **OpenRouter API** | Fallback LLM routing |
| **Google Gemini 2.0 Flash** | Study Battle curriculum generation |
| **Pollinations.ai** | Free manga-style image generation |
| **Wikimedia/Picsum** | Simple Mode card images |

### TTS (Text-to-Speech)
| Technology | Purpose |
|---|---|
| **edge-tts 6.1.9** | Microsoft Edge Neural TTS — real-time audio streaming |
| **nest_asyncio 1.6.0** | Async compatibility for TTS in sync Flask |

### Frontend
| Technology | Purpose |
|---|---|
| **Tailwind CSS** (CDN) | Utility-first styling |
| **Custom CSS** (styles.css — 41KB) | Design system, themes, glassmorphism, animations |
| **Vanilla JavaScript** (13 JS modules) | All interactive logic |
| **Mermaid.js 10.6.1** | Mind-map visualizations |
| **Tone.js 14.8.49** | Audio/sound effects for games |
| **Canvas Confetti 1.6.0** | Celebration animations |
| **Font Awesome 6.5.1** | Icon library |

### External Services
| Service | Purpose |
|---|---|
| **Firebase Realtime Database** | Study Battle real-time multiplayer sync |
| **Webcam API** (navigator.getUserMedia) | Emotion detection via facial analysis |

---

## 🏗 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ Tailwind  │ │ Mermaid  │ │ Tone.js  │ │  Emotion Detector│   │
│  │   CSS     │ │ MindMaps │ │  Audio   │ │   (Webcam API)   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  13 JavaScript Modules                                  │    │
│  │  main.js | learn.js | game_engine.js | quiz.js | ...    │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  15 Jinja2 HTML Templates                               │    │
│  │  base → index, login, signup, dashboard, onboarding,    │    │
│  │  parent_form, loading, chapters, learn, game, quiz,     │    │
│  │  results, study_battle, parent_dashboard                 │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTP / SSE / Fetch API
┌──────────────────────────────▼──────────────────────────────────┐
│                    FLASK SERVER (app.py — 1775 lines)           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ Auth &   │ │  Topic   │ │ Chapter  │ │  Study Battle    │   │
│  │ Sessions │ │ Pipeline │ │ Generator│ │  (Gemini + FB)   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Utility Modules (utils/)                               │    │
│  │  ai_processor.py (732 lines) — LLM calls, JSON clean   │    │
│  │  story_generator.py (408 lines) — Manga + Simple Mode   │    │
│  │  tts_engine.py (117 lines) — Edge-TTS streaming         │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────────┬──────────────────────────────────┘
                               │
          ┌────────────────────┼─────────────────────┐
          ▼                    ▼                      ▼
┌──────────────┐  ┌───────────────────┐   ┌──────────────────┐
│  SQLite DB   │  │   AI APIs         │   │  External APIs   │
│ neurolearn.db│  │ • Groq (LLaMA)    │   │ • Pollinations   │
│              │  │ • OpenRouter      │   │ • Wikimedia      │
│ 5 Tables     │  │ • Google Gemini   │   │ • Edge-TTS       │
│ (see schema) │  │                   │   │ • Firebase RTDB  │
└──────────────┘  └───────────────────┘   └──────────────────┘
```

---

## 📁 Directory Structure

```
output_project_modified/
│
├── app.py                          # Main Flask application (1,775 lines)
├── .env                            # API keys and configuration
├── requirements.txt                # Python dependencies
├── neurolearn.db                   # SQLite database (auto-created)
├── models.json                     # Pre-cached model data (482KB)
│
├── utils/                          # Backend utility modules
│   ├── ai_processor.py             # LLM calls, PDF extraction, chapter generation (732 lines)
│   ├── story_generator.py          # Manga story + simplified content generation (408 lines)
│   └── tts_engine.py               # Edge-TTS real-time audio streaming (117 lines)
│
├── templates/                      # Jinja2 HTML templates (15 files)
│   ├── base.html                   # Master layout — nav, theme, accessibility toolbar
│   ├── index.html                  # Landing page — role selection, upload zone
│   ├── login.html                  # Login form
│   ├── signup.html                 # Registration form (child/parent roles)
│   ├── dashboard.html              # User dashboard — saved topics, XP overview
│   ├── parent_form.html            # Comprehensive neuro-profiling questionnaire (31KB!)
│   ├── onboarding.html             # 3-step wizard: name → style → voice/mood/language
│   ├── loading.html                # AI pipeline processing screen with progress
│   ├── chapters.html               # Chapter listing grid with progress tracking
│   ├── learn.html                  # Main learning view — narration + mindmap + modes (30KB)
│   ├── game.html                   # Interactive game view
│   ├── quiz.html                   # Adaptive quiz interface
│   ├── results.html                # Chapter completion results & badges
│   ├── study_battle.html           # Multiplayer battle lobby + room
│   └── parent_dashboard.html       # Parent analytics dashboard (22KB)
│
├── static/
│   ├── css/
│   │   ├── styles.css              # Main design system (41KB) — themes, glass, animations
│   │   └── style.css               # Additional styles (1.7KB)
│   └── js/
│       ├── main.js                 # Core app logic (15KB)
│       ├── engine.js               # Learning engine controller (18KB)
│       ├── learn.js                # Learn page — audio, mindmap, modes (35KB)
│       ├── game_engine.js          # 5 game types renderer (20KB)
│       ├── quiz.js                 # Adaptive quiz with difficulty levels (13KB)
│       ├── results.js              # Results page animations (5KB)
│       ├── study_battle.js         # Firebase-powered multiplayer (20KB)
│       ├── emotion_detector.js     # Webcam emotion detection (23KB)
│       ├── socratic_tutor.js       # AI Q&A chatbot panel (10KB)
│       ├── story_mode.js           # Manga story viewer (10KB)
│       ├── simple_mode.js          # Simplified cards viewer (9KB)
│       ├── dna_card.js             # Progress DNA card generator (8KB)
│       └── accessibility_engine.js # Runtime accessibility adaptations (13KB)
│
├── flask_session/                  # Server-side session files (auto-generated)
│
├── *.md                            # Various documentation files
├── test_*.py                       # Test scripts for API/LLM/TTS verification
└── check_db.py                     # Database inspection utility
```

---

## 🗄 Database Schema

### `users` — User accounts
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK AUTO | |
| username | TEXT UNIQUE | Min 3 chars |
| email | TEXT UNIQUE | |
| password_hash | TEXT | Werkzeug pbkdf2 |
| display_name | TEXT | Shown in UI |
| user_type | TEXT | `child` or `parent` |
| age_range | TEXT | e.g., `11-13`, `5-7` |
| created_at | TIMESTAMP | |

### `user_topics` — Persisted learning sessions
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK AUTO | |
| user_id | INTEGER FK → users | |
| topic_title | TEXT | AI-generated |
| subject_domain | TEXT | e.g., Biology, CS |
| syllabus_json | TEXT | Full syllabus JSON |
| raw_content | TEXT | Original uploaded text |
| learning_profile_json | TEXT | 30+ modifier fields |
| cognitive_style | TEXT | `focus` or `energy` |
| gender | TEXT | Voice preference |
| emotion | TEXT | Mood at time of creation |
| chapter_progress_json | TEXT | Per-chapter completion/scores |
| total_xp | INTEGER | Accumulated XP |
| chapters_generated_json | TEXT | Track which chapters are cached |
| created_at / last_accessed | TIMESTAMP | |

### `chapters` — AI-generated chapter content cache
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | Chapter ID string |
| topic_id | TEXT | Always `"current"` |
| data_json | TEXT | Full chapter JSON (narration, quiz, game, etc.) |

### `leaderboard` — Global leaderboard
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK AUTO | |
| name | TEXT | |
| topic | TEXT | |
| score | INTEGER | |
| xp | INTEGER | |
| badge | TEXT | |

### `emotion_logs` — Webcam emotion detection records
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK AUTO | |
| user_id | INTEGER FK | |
| topic_id | INTEGER | |
| chapter_id | INTEGER | |
| emotion_state | TEXT | focused/bored/distressed/anxious/tired |
| confidence | REAL | 0.0–1.0 |
| timestamp | TIMESTAMP | |

---

## 🌟 Core Features

### 1. 📖 AI Content Pipeline
- Upload PDF or paste text → AI generates a 7–10 chapter personalized syllabus
- Each chapter is generated **on-demand** (lazy generation) when clicked
- Content includes: narration (1500–2000 words), mind-map, game items, quiz questions, badges
- All content adapts to 30+ learner profile modifiers

### 2. 🎮 5 Interactive Game Types
| Game Type | Mechanic |
|---|---|
| **True/False Blitz** | Rapid-fire statement verification |
| **Concept Connect** | Match terms to definitions (drag & drop) |
| **Sequence Sort** | Arrange steps in correct order |
| **Label Match** | Categorize items into zones |
| **Code Drop** | Programming challenges (coding topics only) |

### 3. 📝 Adaptive Quizzes
- 4+ questions per chapter with difficulty tags (easy/medium/hard)
- XP rewards scale with performance (50–350 XP)
- Concept tags and explanations for every question

### 4. 🗣️ Real-Time TTS Audio
- Edge-TTS neural voices (Microsoft)
- Zero-latency streaming (chunks sent as generated)
- 4 English voices + 8 regional language voices
- Dynamic rate/pitch adjustment based on learner profile

### 5. 🎭 Emotion Detection & Intervention
- Webcam-based real-time emotion recognition
- Detects: focused, bored, distressed, anxious, tired
- Auto-triggers content simplification when sustained distress detected
- All emotion data logged for parent dashboard analytics

### 6. 💬 Socratic AI Tutor
- In-lesson Q&A chatbot panel
- Answers strictly from chapter content (no hallucination)
- Tone adapts to learner's confidence level and needs

### 7. 📚 Three Learning Modes
| Mode | Description |
|---|---|
| **Standard** | Full narration + mind-map + TTS audio |
| **Story Mode** | Manga-style comic panels with AI-generated art |
| **Simple Mode** | Bite-sized cards with emojis and analogies |

### 8. ⚔️ Study Battle (Multiplayer)
- Create/join rooms with 6-character codes
- AI generates battle curriculum (learn rounds + quiz rounds)
- Real-time sync via Firebase Realtime Database
- Scoring, leaderboard, final challenge round

### 9. 🧬 Progress DNA Card
- Shareable visual summary of learning journey
- Shows: XP, chapters completed, quiz scores, emotion distribution, badges
- Works for both logged-in and guest users

### 10. ♿ Comprehensive Accessibility
- Theme toggle (light/dark)
- High contrast mode
- Reduced motion mode
- Font size scaling (A-, Default, A+)
- Irlen Syndrome tinted overlay
- Profile-driven auto-adaptations via `accessibility_engine.js`

---

## 🔄 User Flows

### Flow A: New Student (Self-Guided)
```
Landing Page → Sign Up (role=child) → Upload Content → Onboarding (3 steps)
→ Loading Screen → Chapter Grid → Learn → Game → Quiz → Results → Next Chapter
```

### Flow B: Parent-Guided Setup
```
Landing Page → Sign Up (role=parent) → Upload Content → Parent Form (neuro-profiling)
→ Onboarding → Loading → Chapter Grid → Learn → Game → Quiz → Results
```

### Flow C: Guest Mode
```
Landing Page → "Continue as Guest" → Select Type → Upload → Onboarding
→ Loading → Chapters → Learn (progress not persisted)
```

### Flow D: Returning User
```
Login → Dashboard (saved topics) → Continue Topic → Chapter Grid → Resume
```

### Flow E: Study Battle
```
Dashboard → Study Battle → Create/Join Room → Firebase Sync → Learn Rounds
→ Quiz Rounds → Final Challenge → Scoreboard
```

---

## 🔌 API Endpoints

### Authentication
| Method | Route | Description |
|---|---|---|
| GET/POST | `/signup` | User registration |
| GET/POST | `/login` | User login |
| GET | `/logout` | Logout + save progress |

### Core Learning Flow
| Method | Route | Description |
|---|---|---|
| POST | `/upload` | Upload PDF or text content |
| GET/POST | `/onboarding` | 3-step student onboarding wizard |
| GET | `/loading` | Loading screen page |
| POST | `/api/init-pipeline` | Generate syllabus (synchronous) |
| GET | `/api/pipeline-status` | SSE stream for pipeline progress |
| POST | `/api/generate-chapter/<id>` | On-demand chapter generation |
| GET | `/chapters` | Chapter listing page |
| GET | `/learn/<id>` | Learn page for a chapter |

### Games & Quizzes
| Method | Route | Description |
|---|---|---|
| GET | `/game/<id>` | Game page |
| GET | `/api/game-data/<id>` | Game items JSON |
| POST | `/api/game-complete` | Submit game score |
| GET | `/quiz/<id>` | Quiz page |
| GET | `/api/quiz-data/<id>` | Quiz questions JSON |
| POST | `/api/submit-quiz` | Submit quiz results + XP |
| GET | `/results/<id>` | Results page |

### Audio
| Method | Route | Description |
|---|---|---|
| GET | `/api/audio/stream/<id>` | Real-time TTS audio stream |

### AI Features
| Method | Route | Description |
|---|---|---|
| POST | `/api/ask-tutor` | Socratic AI tutor Q&A |
| POST | `/api/generate-story` | Manga story generation |
| POST | `/api/generate-simple` | Simplified content cards |
| POST | `/api/emotion-log` | Log webcam emotion reading |
| POST | `/api/emotion-intervention` | Trigger content simplification |
| GET | `/api/emotion-analytics/<id>` | Emotion data for topic |
| GET | `/api/dna-card/<id>` | Progress DNA card data |

### Dashboard & Topics
| Method | Route | Description |
|---|---|---|
| GET | `/dashboard` | User dashboard |
| POST | `/api/continue-topic/<id>` | Restore saved topic to session |
| POST | `/api/delete-topic/<id>` | Delete a saved topic |
| GET | `/parent-dashboard` | Parent analytics view |
| GET/POST | `/api/leaderboard` | Global leaderboard |

### Study Battle
| Method | Route | Description |
|---|---|---|
| GET | `/study-battle` | Battle lobby page |
| POST | `/api/battle/create-room` | Create battle room (Gemini curriculum) |
| GET | `/study-battle/room/<code>` | Battle room page |

---

## 🤖 AI/LLM Pipeline

### Model Routing

```
┌─────────────────────────────────────────────────┐
│              call_llm() Router                   │
│                                                  │
│  Model contains "/"?  ──YES──▶ OpenRouter API    │
│         │                                        │
│         NO                                       │
│         │                                        │
│         ▼                                        │
│    Groq API                                      │
│    ├── llama-3.3-70b-versatile (Primary)         │
│    └── llama-3.1-8b-instant (Fallback)           │
│                                                  │
│  Rate Limit (429)?                               │
│    → Exponential backoff + model rotation         │
│    → Groq fallback chain                         │
│                                                  │
│  All retries exhausted?                          │
│    → Cross-provider fallback (Groq → OpenRouter)  │
└─────────────────────────────────────────────────┘
```

### Content Generation Chain

1. **Syllabus** (`generate_syllabus`) → Groq 70B → 7–10 chapters with content_slices
2. **Chapter** (`process_chapter`) → Groq 70B → narration + mindmap + game + quiz + badge
3. **Story** (`generate_manga_story`) → Groq 8B → 6 manga panels + read-aloud script
4. **Images** (`generate_manga_image`) → Pollinations.ai → base64 PNG per panel
5. **Simple** (`generate_simplified_content`) → Groq 8B → 6–8 emoji cards + Wikipedia images
6. **Tutor** (`ask_tutor`) → Groq 70B → Socratic response from chapter context
7. **Battle** (`generate_battle_curriculum`) → Gemini 2.0 Flash → learn/quiz rounds

### JSON Sanitization

The `clean_ai_json()` function handles:
- Markdown code fence extraction (`\`\`\`json ... \`\`\``)
- Raw newline/tab escaping within JSON strings
- Backslash escape validation
- Character-by-character string state tracking
- Fallback to `{}` for unparseable responses

---

## 🖥 Frontend Components

### JavaScript Modules (13 files, ~200KB total)

| Module | Size | Responsibility |
|---|---|---|
| `learn.js` | 35KB | Audio player, mindmap, mode switching, typewriter |
| `emotion_detector.js` | 23KB | Webcam face detection, emotion classification |
| `study_battle.js` | 20KB | Firebase real-time battle logic |
| `game_engine.js` | 20KB | 5 game type renderers + scoring |
| `main.js` | 15KB | App initialization, navigation |
| `engine.js` | 18KB | Learning engine orchestration |
| `quiz.js` | 13KB | Question rendering, scoring, timer |
| `accessibility_engine.js` | 13KB | Runtime profile-based DOM adaptations |
| `story_mode.js` | 10KB | Manga panel viewer + read-aloud |
| `socratic_tutor.js` | 10KB | Chat panel for AI Q&A |
| `simple_mode.js` | 9KB | Simple cards viewer |
| `dna_card.js` | 8KB | Progress card generator |
| `results.js` | 5KB | Confetti, XP animation, badges |

### Design System (styles.css — 41KB)

- **Dual themes**: Light mode + Dark mode via CSS custom properties
- **Glassmorphism**: `backdrop-filter: blur()` glass panels
- **Color palette**: Coral (#E8505B), Teal (#2DB5A8), Indigo (#5B52E0), Amber (#F0A030), Lavender (#8B7FE8)
- **Typography**: Heading + body font families via CSS variables
- **Animations**: slide-up, fade-in, shimmer, pulse, confetti
- **Responsive**: Mobile-first with md: breakpoints via Tailwind
- **Accessibility**: High-contrast mode, reduced-motion, font scaling

---

## ♿ Accessibility & Neuro-Profiling

### Parent Form Profile Fields (30+ modifiers)

**Identity**: student_name, age_range (5-7 to 16-18), gender, home_language

**ADHD**: has_adhd, adhd_subtype (mild/severe/hyperfocus), session_length_pref, special_interests

**Dyslexia**: has_dyslexia, dyslexia_decoding, dyslexia_tracking, irlen_syndrome

**Dysgraphia**: has_dysgraphia, dysgraphia_motor, dysgraphia_organisation, voice_first_input

**Dyscalculia**: has_dyscalculia, dyscalculia_visual_numbers

**Processing**: slow_processing, processing_speed_raw, quiz_time_multiplier, default_tts_rate

**Memory**: working_memory, working_memory_severity

**Autism**: has_autism, autism_literal, autism_routine, autism_predictability, autism_special_interest

**Anxiety**: has_anxiety, anxiety_tests, anxiety_overwhelm, anxiety_reassurance, hide_leaderboard

**Sensory**: sensory_sensitive, sensory_visual, sensory_auditory, sensory_clutter

**Confidence**: confidence_level (low/medium/high), parent_notes

### How Profiling Affects Content

Each modifier translates to an **active modifier prompt** injected into the LLM system prompt during chapter generation. Examples:

- **ADHD SEVERE**: "Every paragraph must start with a different structural form — question, fact-bomb, story hook..."
- **DYSLEXIA TRACKING**: "Use very short paragraphs (2-3 sentences max). Never use more than 60 characters per sentence."
- **ANXIETY TESTS**: "Frame all quiz elements as 'practice', never as 'test' or 'score'."
- **AUTISM LITERAL**: "Avoid all idioms, metaphors, sarcasm, and implied meanings."

### Runtime Accessibility (accessibility_engine.js)

- Auto-applies font size, contrast, and motion settings based on profile
- Irlen Syndrome: applies tinted overlay to reading areas
- Sensory: disables animations, reduces visual clutter
- Dyslexia: increases line spacing, applies OpenDyslexic-friendly styles

---

## 🚀 Deployment & Configuration

### Local Development

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure .env with API keys
# GROQ_API_KEY, OPENROUTER_API_KEY, HUGGINGFACE_API_KEY

# 3. Run the server
python app.py
# → Runs on http://0.0.0.0:8000

# 4. Access at http://localhost:8000
```

### Production Deployment (Render)

The app runs as a standard Flask WSGI application:
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `python app.py` (or use Gunicorn: `gunicorn app:app --bind 0.0.0.0:$PORT`)
- **Port**: 8000 (or `$PORT` environment variable on Render)
- **Database**: SQLite (local file) — consider PostgreSQL for production
- **Session Storage**: Filesystem — consider Redis for production

### Key Considerations for Production
- SQLite is single-writer — switch to PostgreSQL for concurrent users
- Filesystem sessions won't persist across dyno restarts — switch to Redis
- Static files should be served via CDN for performance
- API keys must be set as Render environment variables (not in .env file)

---

## 🔐 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ | Groq API key for LLaMA models |
| `OPENROUTER_API_KEY` | ✅ | OpenRouter API key (fallback) |
| `HUGGINGFACE_API_KEY` | ⚠️ | HuggingFace key (manga images, currently uses Pollinations instead) |
| `GEMINI_API_KEY` | ⚠️ | Google Gemini key (Study Battle curriculum) |
| `FLASK_SECRET_KEY` | ✅ | Flask session secret |
| `SYLLABUS_MODEL` | ❌ | Override: default `llama-3.3-70b-versatile` |
| `CHAPTER_MODEL` | ❌ | Override: default `llama-3.3-70b-versatile` |
| `FALLBACK_MODEL` | ❌ | Override: default `llama-3.1-8b-instant` |
| `TUTOR_MODEL` | ❌ | Override: default `llama-3.3-70b-versatile` |
| `GROQ_BASE_URL` | ❌ | Override: default `https://api.groq.com/openai/v1` |
| `OPENROUTER_BASE_URL` | ❌ | Override: default `https://openrouter.ai/api/v1` |

---

## 🌍 SDG Alignment

| SDG | Alignment |
|---|---|
| **SDG 4** — Quality Education | Personalized, inclusive learning for all abilities |
| **SDG 8** — Decent Work | Building foundational skills for future workforce |
| **SDG 10** — Reduced Inequalities | Neuro-inclusive design bridging the learning gap |

---

## 📊 Codebase Statistics

| Metric | Value |
|---|---|
| **Total Python** | ~3,032 lines (app.py + utils) |
| **Total JavaScript** | ~200KB across 13 modules |
| **Total CSS** | ~43KB across 2 files |
| **Total Templates** | ~210KB across 15 HTML files |
| **Database Tables** | 5 |
| **API Endpoints** | 28+ |
| **Game Types** | 5 |
| **Supported Languages** | 5 |
| **Learning Profile Modifiers** | 30+ |
| **TTS Voices** | 12 (4 English + 8 regional) |
| **External API Integrations** | 6 |

---

*Built by Syntax Syndicate — NeuroLearn AI v2.0*
*Last updated: July 2026*
