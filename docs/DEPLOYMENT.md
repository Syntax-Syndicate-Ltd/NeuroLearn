<div align="center">

# 🚀 Deployment Guide

### NeuroLearn AI — Production Deployment

---

</div>

<br />

## 📑 Table of Contents

- [Prerequisites](#-prerequisites)
- [Local Development](#-local-development)
- [Cloud Platforms](#-cloud-platforms)
- [Environment Setup](#-environment-setup)
- [Health Checks](#-health-checks)
- [Troubleshooting](#-troubleshooting)

<br />

---

## ✅ Prerequisites

| Requirement        | Version | Purpose                        |
| ------------------ | ------- | ------------------------------ |
| Python             | 3.10+   | Runtime                        |
| pip                | latest  | Package management             |
| Git                | any     | Source control                 |
| Groq API Key       | —       | LLM inference (required)       |
| Firebase Project   | —       | Auth + Firestore (required)    |
| OpenRouter API Key | —       | LLM model diversity (optional) |

<br />

---

## 💻 Local Development

### 1. Clone & Install

```bash
git clone https://github.com/Syntax-Syndicate-Ltd/NeuroLearn.git
cd NeuroLearn

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate        # Linux/Mac
venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your actual API keys and Firebase config
```

See [ENVIRONMENT.md](ENVIRONMENT.md) for detailed variable documentation.

### 3. Run Development Server

```bash
python app.py
```

The app starts on **http://localhost:8000** with debug mode enabled.

> [!WARNING]
> The development server (`flask run` / `python app.py`) is **not suitable for production**. It runs single-threaded and is not designed to handle concurrent users. Use Gunicorn for production.

<br />

---

## ☁️ Production Deployment — Render

NeuroLearn is deployed on **[Render](https://render.com)** and is live at:

> 🌐 **https://neurolearn.syntaxsyndicate.co.in**

### Render Setup

1. Create a new **Web Service** on [render.com](https://render.com)
2. Connect your GitHub repository (`Syntax-Syndicate-Ltd/NeuroLearn`)
3. Configure:

| Setting            | Value                                                                         |
| ------------------ | ----------------------------------------------------------------------------- |
| **Runtime**        | Python                                                                        |
| **Build Command**  | `pip install -r requirements.txt`                                             |
| **Start Command**  | `gunicorn app:app --bind 0.0.0.0:$PORT --workers 4 --threads 2 --timeout 120` |
| **Python Version** | 3.11                                                                          |

4. Add all environment variables from `.env.example` in the Render dashboard → Environment tab
5. Deploy

> [!IMPORTANT]
> Set `--timeout 120` in the start command. LLM-based chapter generation involves multiple sequential API calls that can take 30–90 seconds. The default timeout will kill workers mid-generation.

### Custom Domain

To use a custom domain (like `neurolearn.syntaxsyndicate.co.in`):

1. Go to your Render service → Settings → Custom Domains
2. Add your domain
3. Configure DNS — add a CNAME record pointing to your Render service URL
4. Render automatically provisions an SSL certificate

<br />

---

## 🔧 Environment Setup

All environment variables are documented in [ENVIRONMENT.md](ENVIRONMENT.md).

**Quick checklist before deploying:**

- [ ] `GROQ_API_KEY` is set and valid
- [ ] `FIREBASE_API_KEY` and `FIREBASE_PROJECT_ID` are set
- [ ] `FLASK_SECRET_KEY` is changed from default to a random string
- [ ] Firebase Auth is enabled (Email/Password provider) in Firebase Console
- [ ] Firestore database is created in Firebase Console

> [!CAUTION]
> Never commit your `.env` file. The `.gitignore` already excludes it. Use `.env.example` as a template and set real values via your platform's environment variable management.

<br />

---

## ❤️‍🩹 Health Checks

| Endpoint           | Method | Expected | Purpose             |
| ------------------ | ------ | -------- | ------------------- |
| `GET /`            | HTTP   | 200 OK   | App is running      |
| `GET /favicon.ico` | HTTP   | 200 OK   | Static files served |
| `GET /login`       | HTTP   | 200 OK   | Auth system working |

For deeper health validation, check the console logs for:

```

[FIREBASE] Live Firestore Client connected!

```

or

```

[FIREBASE] Connecting to live Firestore REST API for project '...'

```

Both indicate the database layer is operational.

<br />

---

## 🔍 Troubleshooting

### LLM calls timing out

```

CRITICAL LLM ERROR (Groq | llama-3.3-70b-versatile): ReadTimeout

```

**Fix:** Increase Gunicorn `--timeout` to `180`. Ensure your API key has sufficient quota.

---

### Firebase connection failing

```

⚠️ [FIRESTORE REST] Get error: ConnectionError

```

**Fix:** The app auto-falls back to in-memory cache. Verify `FIREBASE_API_KEY` and `FIREBASE_PROJECT_ID`. Ensure Firestore is created (not just the project) in Firebase Console.

---

### Edge TTS failing

```

✗ [TTS-STREAM] Async Error: ...

```

**Fix:** Edge TTS requires outbound HTTPS access to Microsoft's TTS service. The app auto-falls back to Google Translate TTS. Ensure your server allows outbound HTTPS connections.

---

### Session data lost between requests

**Fix:** Ensure the `flask_session/` directory exists and is writable. In Docker, mount it as a volume. If using multiple Gunicorn workers, sessions are filesystem-based and must share the same storage.

<br />

---

<div align="center">

_Part of the [NeuroLearn AI](../README.md) documentation._

</div>
```
