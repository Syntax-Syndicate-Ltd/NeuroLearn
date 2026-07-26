<div align="center">

# 🔌 API Reference

### NeuroLearn AI — Complete Endpoint Documentation

---

</div>

<br />

## Base URL

```
http://localhost:8000
```

All API endpoints return JSON unless otherwise noted. Page routes return server-rendered HTML.

<br />

---

## 📑 Table of Contents

- [Authentication](#-authentication)
- [Content Pipeline](#-content-pipeline)
- [Learning & Content](#-learning--content)
- [Games](#-games)
- [Quizzes](#-quizzes)
- [Audio Streaming](#-audio-streaming)
- [Story & Simple Mode](#-story--simple-mode)
- [Socratic Tutor](#-socratic-tutor)
- [Emotion & Analytics](#-emotion--analytics)
- [Progress & Leaderboard](#-progress--leaderboard)
- [Topic Management](#-topic-management)
- [Page Routes](#-page-routes)

<br />

---

## 🔐 Authentication

> [!NOTE]
> Authentication uses Firebase Auth REST API. Sessions are server-side (filesystem-backed via `flask-session`). Protected endpoints require an active session — unauthenticated requests are redirected to `/login`.

<br />

### `POST /signup`

Create a new user account.

**Content-Type:** `application/x-www-form-urlencoded`

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `username` | string | ✅ | Min 3 characters |
| `email` | string | ✅ | Valid email address |
| `password` | string | ✅ | Min 6 characters |
| `confirm_password` | string | ✅ | Must match `password` |
| `display_name` | string | ❌ | Defaults to username |
| `user_type` | string | ❌ | `child` (default) or `parent` |
| `age_range` | string | ❌ | e.g., `11-13` |

**Response:** Redirect to `/dashboard` on success, re-render form with errors on failure.

---

### `POST /login`

Authenticate an existing user.

**Content-Type:** `application/x-www-form-urlencoded`

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `login_id` | string | ✅ | Username or email |
| `password` | string | ✅ | Account password |

**Response:** Redirect to `/dashboard` on success.

---

### `GET /logout`

Clear session and redirect to landing page.

**Response:** Redirect to `/`

<br />

---

## 🚀 Content Pipeline

### `POST /upload`

Upload educational content to start the learning pipeline.

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `user_type` | string | ✅ | `child` or `parent` |
| `content_type` | string | ✅ | `file` or `text` |
| `file` | file | conditional | PDF file (when `content_type=file`) |
| `text_input` | string | conditional | Raw text (when `content_type=text`) |

**Response:**

```json
{
  "redirect": "/onboarding"
}
```

> For `parent` user_type, redirects to `/parent-form` instead.

---

### `POST /api/init-pipeline`

Generate a structured syllabus from the uploaded content. Called after onboarding.

**Auth Required:** No (works for guests too)

**Request Body:** None (reads from session)

**Response:**

```json
{
  "success": true,
  "chapters_count": 8,
  "message": "Syllabus ready with 8 chapters"
}
```

**Error Response:**

```json
{
  "success": false,
  "error": "No content detected. Please go back and upload a document."
}
```

---

### `GET /api/pipeline-status`

Server-Sent Events (SSE) stream for syllabus generation progress.

**Response:** `text/event-stream`

```
data: {"message": "Building your personalized syllabus...", "progress": 30, "complete": false}

data: {"message": "Syllabus ready! 8 chapters available.", "progress": 80, "complete": false}

data: {"message": "Launching learning experience...", "progress": 100, "complete": true}
```

<br />

---

## 📖 Learning & Content

### `POST /api/generate-chapter/{chapter_id}`

Generate full chapter content including narration, game items, and quiz questions.

**Auth Required:** No

**URL Parameters:**

| Param | Type | Description |
| --- | --- | --- |
| `chapter_id` | int | Chapter ID from syllabus |

**Response:**

```json
{
  "status": "success",
  "message": "Chapter 1 generated successfully",
  "audio_ready": true
}
```

If already cached:

```json
{
  "status": "cached",
  "message": "Chapter already generated"
}
```

---

### `GET /api/debug-chapter/{chapter_id}`

Debug endpoint — inspect chapter data in the database.

**Response:**

```json
{
  "chapter_id": 1,
  "narration_length": 2450
}
```

<br />

---

## 🎮 Games

### `GET /api/game-data/{chapter_id}`

Fetch game configuration and items for the arcade engine.

**Response:**

```json
{
  "game_type": "true_false_blitz",
  "game_title": "Meteor Blast: Cell Biology",
  "game_instruction": "Blast the TRUE facts before they escape!",
  "game_items": [
    {
      "statement": "Mitochondria produce ATP",
      "answer": true
    }
  ],
  "xp_reward": 250
}
```

**Game Types:** `true_false_blitz` · `concept_connect` · `sequence_sort` · `label_match` · `code_drop`

---

### `POST /api/game-complete`

Submit game score.

**Request Body:**

```json
{
  "chapter_id": 1,
  "score": 85
}
```

**Response:**

```json
{
  "status": "saved",
  "chapter_id": "1",
  "score": 85
}
```

<br />

---

## 📝 Quizzes

### `GET /api/quiz-data/{chapter_id}`

Fetch quiz questions for a chapter.

**Response:**

```json
{
  "questions": [
    {
      "question": "What is the powerhouse of the cell?",
      "options": ["Nucleus", "Mitochondria", "Ribosome", "Golgi body"],
      "correct": 1,
      "difficulty": "easy",
      "concept_tag": "Cell Organelles",
      "rationale": "Mitochondria produce ATP through cellular respiration."
    }
  ]
}
```

---

### `POST /api/submit-quiz`

Submit quiz results and receive XP.

**Request Body:**

```json
{
  "chapter_id": 1,
  "score": 90,
  "xp_earned": 350
}
```

**Response:**

```json
{
  "status": "success",
  "redirect": "/game/1",
  "score": 90,
  "xp_earned": 350,
  "achievement": "Master 🏆"
}
```

**XP Scaling:**

| Score | XP Awarded | Achievement |
| --- | --- | --- |
| 90%+ | 350 | Master 🏆 |
| 70–89% | 300 | Good 👍 |
| 50–69% | 250 | Passed ✓ |
| <50% | Scaled (min 50) | Learning 📚 |

<br />

---

## 🔊 Audio Streaming

### `GET /api/audio/stream/{chapter_id}`

Stream TTS audio for a chapter's narration.

**Query Parameters:**

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| `voice` | string | `standard_female` | Voice preset or Neural voice name |

**Response:** `audio/mpeg` chunked stream (direct passthrough)

> [!TIP]
> The audio is generated on-the-fly via Edge TTS — no files are saved to disk. Playback starts within milliseconds as chunks arrive.

**Voice Presets:** `standard_female` · `standard_male` · `fun_female` · `fun_male`

<br />

---

## 📖 Story & Simple Mode

### `POST /api/generate-story`

Generate manga-style story panels for a chapter.

**Request Body:**

```json
{
  "chapter_id": 1
}
```

**Response:**

```json
{
  "title": "The Cell Adventure",
  "panels": [
    {
      "panel_number": 1,
      "scene_description": "A young explorer shrinks down...",
      "dialogue": "Welcome to the cell!",
      "narration": "Our hero enters the membrane...",
      "image_base64": "data:image/png;base64,..."
    }
  ]
}
```

> Results are cached in Firestore after first generation.

---

### `POST /api/generate-simple`

Generate simplified content cards for overwhelmed learners.

**Request Body:**

```json
{
  "chapter_id": 1
}
```

**Response:**

```json
{
  "cards": [
    {
      "emoji": "🔬",
      "heading": "Cells are tiny building blocks",
      "content": "Every living thing is made of cells..."
    }
  ],
  "encouragement": "You're doing great! Take it one step at a time. 💚"
}
```

<br />

---

## 💬 Socratic Tutor

### `POST /api/ask-tutor`

Ask the AI tutor a question about the current chapter.

**Auth Required:** ✅

**Request Body:**

```json
{
  "question": "Why do cells need mitochondria?",
  "chapter_id": 1,
  "topic_id": "abc123"
}
```

**Response:**

```json
{
  "success": true,
  "answer": "Great question! As we learned, mitochondria are like tiny power plants inside cells. They take in nutrients and produce ATP, which is the energy cells need to do everything — from moving to growing."
}
```

> [!IMPORTANT]
> The tutor answers **strictly** from the chapter's narration content. It will never introduce external information.

<br />

---

## 👁️ Emotion & Analytics

### `POST /api/emotion-log`

Log an emotion reading from the webcam detector.

**Request Body:**

```json
{
  "emotion_state": "focused",
  "confidence": 0.87,
  "chapter_id": 1
}
```

**Emotion States:** `focused` · `bored` · `distracted` · `stressed` · `anxious`

---

### `POST /api/emotion-intervention`

Trigger cognitive load intervention when sustained distress is detected.

**Auth Required:** ✅

**Request Body:**

```json
{
  "state": "distressed",
  "chapter_id": 1,
  "topic_id": "abc123"
}
```

**Response (intervention triggered):**

```json
{
  "success": true,
  "intervention": true,
  "simplified_narration": "🔬 Cells: Every living thing is made of cells...",
  "message": "I noticed you might be feeling overwhelmed. Let me simplify things for you. 💚"
}
```

**Response (no intervention needed):**

```json
{
  "success": true,
  "intervention": false
}
```

---

### `GET /api/emotion-analytics/{topic_id}`

Get emotion analytics for a specific topic.

**Auth Required:** ✅

**Response:**

```json
{
  "readings": [...],
  "summary": {
    "focused": 45,
    "bored": 12,
    "distracted": 8,
    "stressed": 3,
    "anxious": 2
  },
  "total": 70
}
```

<br />

---

## 🧬 Progress & Leaderboard

### `GET /api/dna-card/{topic_id}`

Generate a Progress DNA card for a topic.

**Response:**

```json
{
  "success": true,
  "student_name": "Alex",
  "topic_title": "Cell Biology",
  "total_xp": 1750,
  "chapters_completed": 5,
  "total_chapters": 8,
  "emotion_distribution": { "focused": 30, "bored": 5 },
  "avg_quiz_score": 82.5,
  "badge_collection": [
    { "badge_emoji": "🧬", "badge_name": "Cell Explorer" }
  ],
  "dominant_emotion": "focused",
  "learning_style": "Focus"
}
```

---

### `GET /api/leaderboard`

Fetch top 10 leaderboard entries.

**Response:**

```json
[
  {
    "name": "Alex",
    "topic": "Cell Biology",
    "score": 95,
    "xp": 2100,
    "badge": "🧬"
  }
]
```

### `POST /api/leaderboard`

Submit a leaderboard entry.

**Request Body:**

```json
{
  "name": "Alex",
  "topic": "Cell Biology",
  "score": 95,
  "xp": 2100,
  "badge": "🧬"
}
```

<br />

---

## 📂 Topic Management

### `POST /api/continue-topic/{topic_id}`

Restore a previously saved learning topic from Firestore.

**Auth Required:** ✅

**Response:**

```json
{
  "redirect": "/chapters"
}
```

---

### `POST /api/delete-topic/{topic_id}`

Delete a learning topic.

**Auth Required:** ✅

**Response:**

```json
{
  "status": "deleted"
}
```

<br />

---

## 🌐 Page Routes

| Route | Auth | Description |
| --- | --- | --- |
| `GET /` | ❌ | Landing page — upload zone |
| `GET /signup` | ❌ | Registration page |
| `GET /login` | ❌ | Login page |
| `GET /logout` | ❌ | Clear session, redirect home |
| `GET /dashboard` | ✅ | Student dashboard — topic list |
| `GET /parent-form` | ❌ | Parent cognitive assessment form |
| `GET /onboarding` | ❌ | Student onboarding (name, style, voice) |
| `GET /loading` | ❌ | Pipeline loading screen |
| `GET /chapters` | ❌ | Chapter map — level progression |
| `GET /learn/{id}` | ❌ | Learning view — narration + TTS |
| `GET /quiz/{id}` | ❌ | Quiz interface |
| `GET /game/{id}` | ❌ | Arcade game |
| `GET /results/{id}` | ❌ | Chapter completion results |
| `GET /parent-dashboard` | ✅* | Parent analytics (*requires `user_type=parent`) |

<br />

---

<div align="center">

_Part of the [NeuroLearn AI](../README.md) documentation._

</div>
