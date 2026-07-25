# NeuroLearn: The Future of Synthetic Specialized Education

## 1. Vision & Identity
**NeuroLearn** is a cutting-edge, AI-driven educational platform that transforms static, dense information (PDFs or raw text) into immersive, multi-sensory learning experiences. By merging Large Language Models (LLMs) with Neural Text-to-Speech (TTS) and interactive game mechanics, it creates a "Synthetic Learning Environment" tailored to a student's specific cognitive style.

---

## 2. Technology Stack
- **Backend**: Python 3.x with Flask (3.0.2)
- **AI Engine**: OpenRouter & Groq API (Google Gemini, DeepSeek, Meta Llama 3)
- **Audio Engine**: edge-tts (Microsoft Neural Voices)
- **Frontend**: HTML5, CSS3 (Vanilla), JavaScript (ES6+)
- **Data Handling**: PyPDF2 for document ingestion, JSON for state management.

---

## 3. The Core Ecosystem (File Map)

### 📂 Root Directory
*   `app.py`: The central orchestrator. Manages routing, session state, and integration between AI/TTS utilities and the frontend templates.
*   `requirements.txt`: Environment configuration for Python dependencies.
*   `.env`: Sensitive configuration (API keys).
*   `models.json`: A dynamic registry of AI model metadata provided by OpenRouter.

### 📂 utils/ (Logic Layer)
*   `ai_processor.py`: The intelligent core. 
    *   Extracts text from PDFs.
    *   Generates 7-10 chapter syllabi from source material.
    *   Synthesizes 400-600 word narration scripts (Focus or Energy style).
    *   Generates interactive game data and context-aware quizzes.
*   `tts_engine.py`: The voice layer. 
    *   Converts synthesized scripts into neural audio files (.mp3).
    *   Maps student personas to specific regional accents.

### 📂 templates/ (User Interface)
*   `base.html`: Common layout with premium navigation and styling hooks.
*   `index.html`: The ingestion hub (PDF Upload / Text Input).
*   `onboarding.html`: Personality profiling (Name, Style, Gender).
*   `chapters.html`: The dynamic syllabus roadmap.
*   `learn.html`: Cinematic immersion module with audio player and synchronized visuals.
*   `game.html`: The interactive canvas for "Knowledge Checks."
*   `quiz.html`: The final assessment module.
*   `results.html`: Achievement dashboard with XP and Leaderboards.

### 📂 static/ (Assets & Client Scripts)
*   `css/styles.css`: The "Neuro-Futuristic" design system (Dark mode, Glassmorphism, CSS Grids).
*   `js/game_engine.js`: A custom vanilla JS canvas engine for interactive mini-games.
*   `js/quiz.js`: Logic for grading, animations, and result submission.
*   `js/results.js`: Leaderboard fetching and XP calculations.

---

## 4. Feature Breakdown

### A. Cognitive Style Mapping
Students choose between:
- **Focus Style**: Calm, structured, metaphor-rich prose narration with soothing neural voices.
- **Energy Style**: Upbeat, rhythmic narrations (often as Raps or Song lyrics) with high-energy voices.

### B. Interactive Learning Games
The system dynamically chooses one of 5 mechanics based on the content:
1.  **Sequence Sort**: Drag processes into chronological order.
2.  **Label Match**: Visual diagram labeling.
3.  **True/False Blitz**: A high-speed fact-checking timer game.
4.  **Word Builder**: Vocabulary/Concept unscrambling.
5.  **Concept Connect**: Visual line-drawing between related terms.

### C. Contextual Quizzes
The AI generates 5-15 questions based *strictly* on the generated script, ensuring students are tested exactly on what they just heard/saw.

---

## 5. User Workflow
1.  **Upload**: User provides a PDF or text snippet.
2.  **Profile**: User defines their learning persona.
3.  **Roadmap**: AI generates a multi-chapter syllabus.
4.  **Immerse**: The user "learns" through a cinematic audio-visual session.
5.  **Play**: A customized mini-game reinforces the core concepts.
6.  **Assess**: A graded quiz measures retention.
7.  **Rank**: User earns XP and badges, appearing on the global leaderboard.

---

## 6. Development & Setup
1. Install dependencies: `pip install -r requirements.txt`
2. Configure `.env`: Add `OPENROUTER_API_KEY` and `GROQ_API_KEY`.
3. Run: `python app.py`
4. Access: `http://localhost:8000`
