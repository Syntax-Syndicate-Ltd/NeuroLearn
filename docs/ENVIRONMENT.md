<div align="center">

# ⚙️ Environment Variables

### NeuroLearn AI — Configuration Reference

---

</div>

<br />

## Quick Setup

```bash
cp .env.example .env
```

Edit `.env` with your actual values. **Never commit this file** — it is excluded via `.gitignore`.

<br />

---

## 📑 Variable Reference

### 🤖 AI / LLM Configuration

These control which AI models power content generation.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `GROQ_API_KEY` | ✅ | — | API key from [console.groq.com](https://console.groq.com). Free tier available. Powers syllabus, chapter, and tutor generation. |
| `OPENROUTER_API_KEY` | ❌ | — | API key from [openrouter.ai](https://openrouter.ai). Enables access to 200+ models. Used as primary when model name contains `/`. |
| `GROQ_BASE_URL` | ❌ | `https://api.groq.com/openai/v1` | Groq API base URL. Override for proxies or custom endpoints. |
| `OPENROUTER_BASE_URL` | ❌ | `https://openrouter.ai/api/v1` | OpenRouter API base URL. Override for proxies or custom endpoints. |

<br />

### 🧠 Model Selection

Fine-tune which models handle each task.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `SYLLABUS_MODEL` | ❌ | `llama-3.3-70b-versatile` | Model for syllabus generation. Needs strong JSON output. |
| `CHAPTER_MODEL` | ❌ | `llama-3.3-70b-versatile` | Model for chapter content (narration, games, quizzes). |
| `FALLBACK_MODEL` | ❌ | `llama-3.1-8b-instant` | Fallback model when primary hits rate limits or errors. Also used by story generator. |
| `TUTOR_MODEL` | ❌ | `llama-3.3-70b-versatile` | Model for the Socratic AI tutor. |
| `PRIMARY_MODEL` | ❌ | `openrouter/free` | Default OpenRouter model when none specified. `openrouter/free` auto-selects the best free model. |

> [!TIP]
> **Model routing rule:** If a model name contains `/` (e.g., `meta-llama/llama-3-70b`), it routes to OpenRouter. Bare names (e.g., `llama-3.3-70b-versatile`) route to Groq.

**Recommended configurations:**

```bash
# Budget-friendly (free tier only)
SYLLABUS_MODEL="llama-3.1-8b-instant"
CHAPTER_MODEL="llama-3.1-8b-instant"
FALLBACK_MODEL="llama-3.1-8b-instant"

# Balanced (default)
SYLLABUS_MODEL="llama-3.3-70b-versatile"
CHAPTER_MODEL="llama-3.3-70b-versatile"
FALLBACK_MODEL="llama-3.1-8b-instant"

# OpenRouter diversity
SYLLABUS_MODEL="google/gemini-2.5-flash-preview"
CHAPTER_MODEL="google/gemini-2.5-flash-preview"
FALLBACK_MODEL="llama-3.1-8b-instant"
```

<br />

### 🔐 Flask Configuration

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `FLASK_SECRET_KEY` | ⚠️ | `neurolearn_super_secret_key_123` | Secret key for Flask session signing. **Change this in production.** |

> [!CAUTION]
> The default `FLASK_SECRET_KEY` is hardcoded and public. Always override this with a strong random string in production:
> ```bash
> python -c "import secrets; print(secrets.token_hex(32))"
> ```

<br />

### 🔥 Firebase Configuration

All Firebase values come from your [Firebase Console](https://console.firebase.google.com) → Project Settings → General.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `FIREBASE_API_KEY` | ✅ | — | Web API key from Firebase project settings |
| `FIREBASE_PROJECT_ID` | ✅ | `neurolearn-d9491` | Firebase project ID |
| `FIREBASE_AUTH_DOMAIN` | ❌ | — | Auth domain (e.g., `your-project.firebaseapp.com`) |
| `FIREBASE_STORAGE_BUCKET` | ❌ | — | Storage bucket URL |
| `FIREBASE_MESSAGING_SENDER_ID` | ❌ | — | Cloud Messaging sender ID |
| `FIREBASE_APP_ID` | ❌ | — | Firebase app ID |
| `FIREBASE_MEASUREMENT_ID` | ❌ | — | Google Analytics measurement ID |

<br />

### 🔑 Firebase Admin SDK (Optional)

For direct Firestore client access instead of REST API.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | ❌ | — | Path to `serviceAccountKey.json` file. When set, enables the native Firestore SDK client instead of REST API. |

> [!NOTE]
> If `FIREBASE_SERVICE_ACCOUNT_PATH` is not set, the app uses the REST API with the resilient in-memory cache layer (`ResilientRESTFirestore`). This works well for development and small deployments. For production with high concurrency, the native SDK is recommended.

**How to get a service account key:**

1. Go to [Firebase Console](https://console.firebase.google.com) → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Save the JSON file securely (never commit it)
4. Set the path in `.env`:
   ```
   FIREBASE_SERVICE_ACCOUNT_PATH="./serviceAccountKey.json"
   ```
5. Add `serviceAccountKey.json` to `.gitignore`

<br />

---

## 🔒 Security Checklist

Before deploying to production, verify:

- [ ] **`FLASK_SECRET_KEY`** — Changed from default to a random 64-char hex string
- [ ] **`.env` file** — Not committed to git (check with `git status`)
- [ ] **`serviceAccountKey.json`** — Not committed to git (if using Admin SDK)
- [ ] **Firebase API Key** — Restricted in Google Cloud Console (HTTP referrers, API restrictions)
- [ ] **Groq/OpenRouter keys** — Usage limits configured on provider dashboards
- [ ] **Firebase Auth** — Email/Password sign-in enabled in Firebase Console
- [ ] **Firestore Rules** — Configured to restrict direct client access (the app uses server-side REST calls, but rules add defense-in-depth)

<br />

---

## 🏗️ Firebase Project Setup

If starting from scratch:

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add Project" → Name it → Disable Google Analytics (optional)
3. Go to Project Settings → copy the config values into `.env`

### 2. Enable Authentication

1. Go to Authentication → Sign-in method
2. Enable **Email/Password** provider
3. (Optional) Configure authorized domains

### 3. Create Firestore Database

1. Go to Firestore Database → Create database
2. Choose **production mode** (or test mode for development)
3. Select a region close to your users

### 4. Required Collections

The app creates collections automatically on first use. No manual setup needed.

| Collection | Created When |
| --- | --- |
| `users` | First user signup |
| `user_topics` | First content upload |
| `chapters` | First chapter generation |
| `emotion_logs` | First emotion reading |
| `leaderboard` | First leaderboard submission |

<br />

---

## 📋 Complete `.env` Template

```bash
# AI API Keys
GROQ_API_KEY="your-groq-api-key"
OPENROUTER_API_KEY=""

# Model Configuration
SYLLABUS_MODEL="llama-3.3-70b-versatile"
CHAPTER_MODEL="llama-3.3-70b-versatile"
FALLBACK_MODEL="llama-3.1-8b-instant"
TUTOR_MODEL="llama-3.3-70b-versatile"

# Flask
FLASK_SECRET_KEY="generate-a-random-secret-here"

# Firebase
FIREBASE_API_KEY="your-firebase-api-key"
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
FIREBASE_STORAGE_BUCKET="your-project.firebasestorage.app"
FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
FIREBASE_APP_ID="your-app-id"
FIREBASE_MEASUREMENT_ID="your-measurement-id"

# Firebase Admin SDK (Optional)
# FIREBASE_SERVICE_ACCOUNT_PATH="./serviceAccountKey.json"
```

<br />

---

<div align="center">

_Part of the [NeuroLearn AI](../README.md) documentation._

</div>
