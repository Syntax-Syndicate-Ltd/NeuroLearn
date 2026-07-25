import os
import json
import requests
import re
from dotenv import load_dotenv

load_dotenv()

def get_ai_client():
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    groq_key = os.getenv("GROQ_API_KEY")
    return openrouter_key, groq_key

def clean_ai_json(raw_text):
    """Deep-clean AI responses for JSON parsing."""
    if not raw_text: 
        return "{}"
    
    # 1. Extract JSON block
    if "```json" in raw_text:
        raw_text = raw_text.split("```json")[-1].split("```")[0]
    elif "```" in raw_text:
        parts = raw_text.split("```")
        raw_text = parts[1] if len(parts) >= 3 else parts[-1]
    
    raw_text = raw_text.strip()
    
    # 2. Remove leading/trailing non-JSON characters
    raw_text = raw_text.lstrip('`\'"')
    raw_text = raw_text.rstrip('`\'"')
    
    # 3. Fix common JSON issues character by character
    result = []
    in_string = False
    prev_char = ''
    
    i = 0
    while i < len(raw_text):
        char = raw_text[i]
        
        # Handle escape sequences
        if char == '\\' and in_string:
            # Valid escape: check next char
            if i + 1 < len(raw_text):
                next_char = raw_text[i + 1]
                if next_char in ['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']:
                    result.append(char)
                    result.append(next_char)
                    i += 2
                    prev_char = next_char
                    continue
                elif next_char in ['\n', '\r']:
                    # Skip escape + newline (malformed)
                    i += 2
                    continue
            result.append(char)
            i += 1
        elif char == '"':
            # Check if it's escaped
            num_backslashes = 0
            for j in range(len(result) - 1, -1, -1):
                if result[j] == '\\':
                    num_backslashes += 1
                else:
                    break
            
            # If even number of backslashes, quote is not escaped
            if num_backslashes % 2 == 0:
                in_string = not in_string
            
            result.append(char)
            i += 1
        elif in_string:
            # Inside string: convert raw newlines
            if char == '\n':
                result.append('\\n')
            elif char == '\r':
                # Skip carriage returns
                if i + 1 < len(raw_text) and raw_text[i + 1] == '\n':
                    result.append('\\n')
                    i += 1
                else:
                    result.append('\\n')
            elif char == '\t':
                result.append('\\t')
            else:
                result.append(char)
            i += 1
            prev_char = char
        else:
            # Outside string
            if char in ['\n', '\r', '\t']:
                # Skip unless it's meaningful spacing
                i += 1
                continue
            result.append(char)
            i += 1
            prev_char = char
    
    cleaned = "".join(result).strip()
    
    # 4. Ensure it's valid JSON start/end
    if not cleaned.startswith('{') and not cleaned.startswith('['):
        cleaned = '{}'
    
    return cleaned

def call_llm(system_prompt, user_prompt, model=None, retries=5):
    import time
    openrouter_key, groq_key = get_ai_client()
    
    # 1. MODEL ROUTING LOGIC
    # OpenRouter models usually contain a "/" 
    # Groq models are bare
    is_groq = model and ("/" not in model)
    
    if is_groq:
        url = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/") + "/chat/completions"
        headers = {"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"}
        api_name = "Groq"
    else:
        url = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/") + "/chat/completions"
        headers = {
            "Authorization": f"Bearer {openrouter_key}",
            "HTTP-Referer": "https://neurolearn.ai",
            "X-Title": "NeuroLearn AI",
            "Content-Type": "application/json"
        }
        api_name = "OpenRouter"
        if not model:
            # DYNAMIC FREE ROUTER: Automatically picks the best current FREE model
            model = os.getenv("PRIMARY_MODEL", "openrouter/free")

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
    }
    
    # Use strict JSON mode ONLY for OpenRouter (it's robust enough), OR for Groq if requested
    if "json" in system_prompt.lower() or "json" in user_prompt.lower():
        payload["response_format"] = {"type": "json_object"}

    last_error = None
    
    # Exponential backoff retry loop
    for attempt in range(retries):
        try:
            print(f"Routing to {api_name} | Model: {model} | Attempt {attempt+1}/{retries}")
            response = requests.post(url, headers=headers, json=payload, timeout=60)
            
            # Explicitly catch rate limits before anything else
            if response.status_code == 429:
                delay = (2 ** attempt) + 1.5
                print(f"⚠️ RATE LIMIT 429 from {api_name}. Retrying in {delay} seconds...")
                time.sleep(delay)
                response.raise_for_status() # Force the exception to go to except block
                
            response.raise_for_status()
            data = response.json()
            content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
            
            if not content or not content.strip():
                raise ValueError(f"Empty response from {api_name}")
            
            return content
            
        except requests.exceptions.HTTPError as e:
            last_error = e
            status_code = getattr(response, 'status_code', None) if 'response' in locals() else None
            print(f"⚠️ HTTP Error ({api_name} | {payload['model']}): {str(e)} | Status: {status_code}")
            
            # Retry on 429, 500, 502, 503
            if status_code in [429, 500, 502, 503, 529]:
                # Rotate among ACTIVE Groq models on Rate Limit (429) to avoid decommissioning 400s
                if is_groq and status_code == 429:
                    if payload["model"] == "llama-3.3-70b-versatile":
                        payload["model"] = "llama-3.1-8b-instant"
                    else:
                        payload["model"] = "llama-3.3-70b-versatile"
                    print(f"🔄 Rotating to Groq active backup model: {payload['model']}")
                    
                delay = (2 ** attempt) + 1.5
                print(f"🔄 Retrying {api_name} in {delay}s...")
                time.sleep(delay)
                continue
            break # Break on 400 Bad Request
            
        except Exception as e:
            last_error = e
            print(f"CRITICAL LLM ERROR ({api_name} | {payload['model']}): {str(e)}")
            time.sleep(1)
            continue
            
    print(f"❌ LLM EXHAUSTED after {retries} retries ({api_name} | {model})")
    
    # For Groq, we just fail gracefully now as user wants strict Groq usage
    if not is_groq and "free" not in model:
        fallback = os.getenv("FALLBACK_MODEL", "llama-3.1-8b-instant")
        print(f"FALLING BACK TO GROQ | Model: {fallback}")
        return call_llm(system_prompt, user_prompt, model=fallback, retries=2)
        
    raise last_error

def extract_text_from_pdf(pdf_file):
    from PyPDF2 import PdfReader
    try:
        reader = PdfReader(pdf_file)
        text = ""
        for page in reader.pages:
            content = page.extract_text()
            if content:
                text += content + " "
        return text.strip()
    except Exception as e:
        raise ValueError(f"Failed to extract PDF: {str(e)}")

def generate_syllabus(raw_text, preferred_language="en"):
    system_prompt = "You are an expert curriculum designer. Return ONLY raw valid JSON with no markdown, no backticks, no explanation."
    
    lang_instruction = ""
    if preferred_language and preferred_language != "en" and preferred_language in LANGUAGE_NAMES:
        lang_name = LANGUAGE_NAMES[preferred_language]
        lang_instruction = f"\nCRITICAL: You must generate all text fields (topic_title, title, subtitle, content_slice, etc) in {lang_name}. The JSON keys must strictly remain in English!"

    user_prompt = f"""
    Analyze the following content and create a structured learning syllabus.
    CRITICAL: You MUST create between 7-10 Chapters to provide comprehensive coverage of the content.
    {lang_instruction}
    
    For EACH chapter, you MUST extract a targeted content_slice (approx 100-200 words) — this should be 
    a highly concentrated summary or excerpt from the source material covering that chapter's topic. 
    It must capture the most essential facts and concepts for that chapter.
    
    Content: {raw_text[:30000]}
    
    Return this exact JSON format:
    {{
      "topic_title": "string — overall topic name",
      "subject_domain": "string — e.g. Biology, History, Mathematics",
      "total_chapters": 10,
      "overall_difficulty": "beginner|intermediate|advanced",
      "chapters": [
        {{
          "id": 1,
          "title": "string",
          "subtitle": "string",
          "key_concepts": ["concept1", "concept2", "concept3"],
          "estimated_minutes": 5,
          "difficulty": "beginner|intermediate|advanced",
          "content_slice": "string — MUST be a concise summary/excerpt of 100-200 words extracted directly from the source material covering this chapter's key facts."
        }}
      ],
      "prerequisite_warning": "string | null"
    }}
    """
    # OPTIMIZED: Using Groq 70B versatile for reliable syllabus/JSON generation
    model = os.getenv("SYLLABUS_MODEL", "llama-3.3-70b-versatile")
    raw_response = call_llm(system_prompt, user_prompt, model=model)
    cleaned = clean_ai_json(raw_response)
    
    try:
        return json.loads(cleaned, strict=False)
    except json.JSONDecodeError as e:
        print(f"JSON Parse Error in generate_syllabus: {str(e)}")
        print(f"Raw Response: {raw_response[:500]}")
        print(f"Cleaned: {cleaned[:500]}")
        # Return a minimal valid syllabus as fallback
        return {
            "topic_title": "Learning Module",
            "subject_domain": "General",
            "total_chapters": 1,
            "overall_difficulty": "beginner",
            "chapters": [{
                "id": 1,
                "title": "Introduction",
                "subtitle": "Getting Started",
                "key_concepts": ["basics"],
                "estimated_minutes": 5,
                "difficulty": "beginner",
                "content_slice": raw_text[:1000]
            }]
        }

LANGUAGE_NAMES = {"hi": "Hindi", "mr": "Marathi", "ta": "Tamil", "te": "Telugu", "en": "English"}

def process_chapter(chapter, cognitive_style, gender, emotion, learning_profile, raw_text="", assigned_game="true_false_blitz", preferred_language="en"):
    """Generate a fully personalized chapter using ALL profile data."""
    
    # === BUILD COMPREHENSIVE PROFILE MODIFIERS ===
    modifiers = []
    
    # Learning Needs
    if learning_profile.get("has_adhd"):
        modifiers.append("ADHD ADAPTATION: Use very short paragraphs (2-3 sentences max). Include pattern-breaks and surprising facts every 3-4 sentences. Use bullet-style thinking. Add 'checkpoint' summaries frequently. Keep energy varied — alternate between calm explanation and exciting reveals.")
    
    if learning_profile.get("has_dyslexia"):
        modifiers.append("DYSLEXIA ADAPTATION: Use simple, phonetically regular words. Keep sentences under 15 words. Avoid complex multi-syllable jargon. Use lots of concrete examples instead of abstract descriptions. Repeat key terms in slightly different ways to reinforce understanding.")
    
    if learning_profile.get("has_autism"):
        modifiers.append("AUTISM ADAPTATION: Use concrete, literal language — avoid metaphors, idioms, and sarcasm. Provide very clear structure with explicit transitions ('First... Next... Finally...'). Be precise and specific. Avoid ambiguous phrasing. Use factual, predictable language patterns.")
    
    if learning_profile.get("has_anxiety"):
        modifiers.append("ANXIETY ADAPTATION: Use a calming, reassuring tone throughout. Break complex ideas into very small, manageable steps. Include frequent encouragements like 'You're doing well' or 'This is completely normal to find challenging'. Never use alarming or pressuring language. Frame mistakes as positive learning opportunities.")
    
    if learning_profile.get("slow_processing"):
        modifiers.append("SLOW PROCESSING ADAPTATION: Speak at a measured, unhurried pace. Use shorter sentences with clear pauses between ideas. Repeat key points using different words. Give the listener time to absorb each concept before moving on. Summarize before introducing new material.")
    
    if learning_profile.get("working_memory"):
        modifiers.append("WORKING MEMORY ADAPTATION: Use numbered lists and clear sequencing. Repeat key terms frequently. Provide mini-summaries after every 2-3 new concepts. Use mnemonics and memory hooks. Keep the thread of the topic very explicit — always connect back to the main idea.")
    
    if learning_profile.get("sensory_sensitive"):
        modifiers.append("SENSORY SENSITIVITY ADAPTATION: Use a calm, even, predictable tone throughout. Avoid sudden shifts in energy or style. No exclamation marks or aggressive language. Keep descriptions gentle and measured. Avoid overwhelming lists of details.")
    
    # Confidence Level
    confidence = learning_profile.get("confidence_level", "medium")
    if confidence == "low":
        modifiers.append("LOW CONFIDENCE: Be extra encouraging and supportive. Celebrate small wins. Use phrases like 'You might already know this...' and 'Great job getting this far!'. Start with the easiest concepts first and build up gradually. Never assume prior knowledge.")
    elif confidence == "high":
        modifiers.append("HIGH CONFIDENCE: Challenge the learner with deeper insights and 'did you know?' facts. Use a slightly more advanced vocabulary. Include extension questions that provoke critical thinking. Be enthusiastic but don't over-explain basics.")
    
    # ADHD SUBTYPE-SPECIFIC MODIFIERS
    adhd_subtype = learning_profile.get("adhd_subtype", "typical")
    if adhd_subtype == "adhd_hyperfocus":
        interests = ", ".join(learning_profile.get("special_interests", [])[:3]) or "technology"
        modifiers.append(f"ADHD HYPERFOCUS: The student hyperfocuses on specific interests ({interests}). Where possible, draw analogies and examples from these interest areas. Build bridges: 'This is like how [interest] works...' Use these topics as entry points into abstract concepts.")

    if adhd_subtype == "adhd_severe":
        modifiers.append("ADHD SEVERE: Use maximum pattern-breaking. Every paragraph must start with a different structural form — question, fact-bomb, story hook, challenge. Include '⚡ QUICK CHECK' callouts every 2-3 paragraphs. Keep each idea to 1-2 sentences. Use dashes and line breaks aggressively.")

    session_length = learning_profile.get("session_length_pref", 10)
    if session_length <= 5:
        modifiers.append(f"MICRO-SESSION MODE: This learner prefers sessions of {session_length} minutes maximum. Make the narration ultra-dense but short. Use bullet-style thinking. Prioritise the 3 most critical concepts only.")

    # DYSLEXIA SUBTYPES
    if learning_profile.get("dyslexia_tracking"):
        modifiers.append("DYSLEXIA TRACKING: The student loses their place while reading. Use very short paragraphs (2-3 sentences max). Add blank lines between every paragraph. Start each new idea on a new line. Avoid long sentences that wrap. Never use more than 60 characters per sentence.")

    if learning_profile.get("irlen_syndrome"):
        modifiers.append("IRLEN SYNDROME: Student is sensitive to high-contrast black-on-white text. The UI will apply a tinted overlay. Narration should be structured to work with audio-first delivery — the visual display is secondary.")

    # DYSGRAPHIA
    if learning_profile.get("has_dysgraphia"):
        modifiers.append("DYSGRAPHIA: This student struggles with writing. ALL quiz questions must be multiple-choice — never open text. Game items must use drag/drop or true-false — never typed input. Use voice-first framing: 'You can say your answer aloud.'")

    if learning_profile.get("dysgraphia_organisation"):
        modifiers.append("DYSGRAPHIA ORGANISATION: Student struggles to organise written thoughts. The narration should model organised thinking explicitly: use numbered lists, clear transitions ('First... The reason for this is... This means that...'), and show how ideas connect.")

    # DYSCALCULIA
    if learning_profile.get("has_dyscalculia"):
        modifiers.append("DYSCALCULIA: Student has difficulty with numbers and sequences. Replace all numerical examples with concrete visual analogies (e.g. 'imagine 10 apples' not 'a quantity of 10'). Show sequences as 'first this happens, then this happens' with explicit ordering language. Never use percentages without a visual metaphor.")

    # AUTISM SUBTYPES
    if learning_profile.get("autism_routine"):
        modifiers.append("AUTISM ROUTINE: Begin every lecture with an explicit 'Today's plan' section listing exactly what will be covered, in order. Use this exact format: 'In this chapter, we will: (1) ... (2) ... (3) ...' Never introduce unexpected topics. Summarise at the end: 'We have now covered: (1) ... (2) ... (3)...'")

    if learning_profile.get("autism_special_interest") and learning_profile.get("special_interests"):
        interests = ", ".join(learning_profile.get("special_interests", [])[:2])
        modifiers.append(f"AUTISM SPECIAL INTEREST: Whenever introducing abstract concepts, connect them to {interests} first. This is highly motivating for this student. Lead with the familiar before the new.")

    if learning_profile.get("autism_literal"):
        modifiers.append("AUTISM LITERAL LANGUAGE: Use ONLY concrete, literal language. Avoid all idioms ('piece of cake', 'on the fence'), metaphors, sarcasm, and implied meanings. If an analogy must be used, explicitly flag it: 'This is a comparison, not literally true: [analogy].' Be precise with numbers, avoid approximations unless labeled as such.")

    # ANXIETY SUBTYPES
    if learning_profile.get("anxiety_overwhelm"):
        modifiers.append("ANXIETY OVERWHELM: Present information in the smallest possible chunks. Never introduce more than ONE new concept per paragraph. After each new concept, pause with a summary: 'So far, all you need to remember is: [one thing].' Before moving to the next concept, explicitly say 'You've got that. Now here's the next piece.'")

    if learning_profile.get("anxiety_tests"):
        modifiers.append("ANXIETY TESTS: Frame all quiz and game elements as 'practice' or 'exploration', never as 'test' or 'score'. Use language like 'Let's try this out' and 'There's no wrong answer here, just checking in.' Quiz questions should use past-tense framing: 'We just talked about...' to anchor the question in safe, known territory.")

    if learning_profile.get("anxiety_reassurance"):
        modifiers.append("ANXIETY REASSURANCE: Include explicit reassurance phrases every 3-4 paragraphs: phrases like 'You are doing brilliantly', 'This is completely normal to find tricky', 'Many people find this part interesting once it clicks.' Never use phrases that imply the student should already know something.")

    # SENSORY SUBTYPES
    if learning_profile.get("sensory_auditory"):
        modifiers.append("SENSORY AUDITORY: Adjust TTS to tts_rate: '-15%' and tts_pitch: '-3Hz' for a lower, calmer audio experience. Avoid exclamatory language that would cause the TTS to raise its inflection. No sound effects or musical stingers should play around this learner's content.")

    if learning_profile.get("sensory_visual"):
        modifiers.append("SENSORY VISUAL: The UI will apply a reduced-stimulation mode — no animations, muted palette. The narration visualization (mermaid diagram) should use minimal branching — no more than 3 levels deep, no more than 4 nodes per level. Simple mindmaps only.")

    # WORKING MEMORY SEVERITY
    wm_severity = learning_profile.get("working_memory_severity", "typical")
    if wm_severity == "significant":
        modifiers.append("WORKING MEMORY SEVERE: Use only 2-step instructions at most. Repeat the chapter's key term in every paragraph — do not assume the reader holds it in mind. After every 2 new pieces of information, add a consolidation line: 'Remember: [concept 1] and [concept 2] — that is all.' Use bold text markers for the single most important term per paragraph.")

    # PARENT NOTES
    parent_notes = learning_profile.get("parent_notes", "").strip()
    if parent_notes:
        modifiers.append(f"PARENT NOTES (from guardian): '{parent_notes}' — incorporate these observations to inform tone and approach where relevant.")

    # Age Range
    age_range = learning_profile.get("age_range", "")
    if age_range:
        if age_range in ["5-7", "6-8"]:
            modifiers.append(f"AGE {age_range}: Use very simple vocabulary suitable for early elementary. Use playful, story-like language. Relate everything to daily activities a young child would understand (school, home, playing, eating).")
        elif age_range in ["8-10", "9-11"]:
            modifiers.append(f"AGE {age_range}: Use clear, age-appropriate vocabulary for upper elementary. Include relatable examples from school life, hobbies, and popular culture appropriate for this age. Can introduce some subject-specific terms with explanation.")
        elif age_range in ["11-13", "12-14"]:
            modifiers.append(f"AGE {age_range}: Use middle-school level vocabulary. Can handle more abstract concepts with concrete examples. Include interesting facts and connections to real-world applications to maintain engagement.")
        elif age_range in ["14-16", "15-17", "16-18"]:
            modifiers.append(f"AGE {age_range}: Use secondary-school level vocabulary. Can handle complex ideas, abstract reasoning, and subject-specific terminology. Be direct and intellectually engaging.")
    
    # Emotional State
    if emotion == "great":
        modifiers.append("MOOD — GREAT: The learner is feeling fantastic! Match their energy with an enthusiastic, upbeat tone. Use exciting language, celebrate the joy of learning, and maintain high engagement. Include fun challenges.")
    elif emotion == "okay":
        modifiers.append("MOOD — OKAY: The learner is in a neutral mood. Use a balanced, steady, warm tone. Be engaging but not overwhelming. Maintain a comfortable pace.")
    elif emotion == "tired":
        modifiers.append("MOOD — TIRED: The learner is tired. Be gentle, supportive, and use a lower-energy but warm tone. Keep sections shorter. Include encouraging pauses like 'Take your time with this one.' Don't demand too much cognitive effort at once.")
    elif emotion == "anxious":
        modifiers.append("MOOD — ANXIOUS: The learner is feeling anxious. Be extra calming and reassuring. Start with something easy and familiar. Use phrases like 'Don't worry, we'll go through this step by step.' Avoid time pressure language. Create a safe learning space through words.")
    
    # Cognitive Style
    if cognitive_style == "focus":
        modifiers.append("STYLE — FOCUS MODE: Use structured, calm, deep-dive prose. Rich explanations with layered detail. Measured pacing. Think 'documentary narrator' style — thoughtful, wise, and clear.")
    elif cognitive_style == "energy":
        modifiers.append("STYLE — ENERGY MODE: Use punchy, fast-paced, energetic language! Short impactful sentences. Think 'hype coach' — exciting, dynamic, with rhythm and drive. Use rhetorical questions to maintain engagement.")
    
    active_modifiers_text = "\n".join(modifiers) if modifiers else "No special adaptations needed. Use a friendly, clear teaching style."

    # === MULTILINGUAL SUPPORT ===
    if preferred_language and preferred_language != "en" and preferred_language in LANGUAGE_NAMES:
        lang_name = LANGUAGE_NAMES[preferred_language]
        active_modifiers_text += f"\nLANGUAGE: Generate the entire narration_script in {lang_name}. All game item statements, quiz questions, options, and explanations must also be in {lang_name}. Only the JSON keys stay in English."
    
    # === VOICE SELECTION ===
    if gender == "male":
        voice_options = "en-GB-RyanNeural or en-US-GuyNeural"
    else:
        voice_options = "en-GB-SoniaNeural or en-AU-NatashaNeural"
    
    # === DETERMINE TTS PARAMETERS FROM PROFILE ===
    tts_guidance = ""
    if learning_profile.get("slow_processing") or emotion == "tired":
        tts_guidance = 'Use tts_rate: "-10%" for slower pace.'
    elif cognitive_style == "energy" and emotion == "great":
        tts_guidance = 'Use tts_rate: "+10%" for energetic pace.'
    else:
        tts_guidance = 'Use tts_rate: "+0%" for balanced pace.'
    
    # === BUILD AI PROMPT ===
    # Use the comprehensive content_slice from syllabus, which is now 500+ words
    content_context = chapter.get('content_slice', chapter.get('subtitle', chapter['title']))
    
    system_prompt = """You are an expert educational AI that creates deeply personalized, comprehensive learning content. 
You MUST create thorough, detailed lectures that fully cover the promised chapter topic—not just brief introductions.
Return ONLY raw valid JSON. No markdown, no backticks, no explanation."""

    if assigned_game == "true_false_blitz":
        game_items_prompt = '''"game_items": [
    {"text": "Statement 1 derived strictly from lecture", "is_target": true, "explanation": "Why this is true"},
    {"text": "Statement 2 derived strictly from lecture", "is_target": false, "explanation": "Why this is false"},
    {"text": "Statement 3 derived strictly from lecture", "is_target": true, "explanation": "Why this is true"}
  ]'''
    elif assigned_game == "concept_connect":
        game_items_prompt = '''"game_items": [
    {"left": "Key Concept 1", "right": "Matching Definition or Example 1"},
    {"left": "Key Concept 2", "right": "Matching Definition or Example 2"},
    {"left": "Key Concept 3", "right": "Matching Definition or Example 3"}
  ]'''
    elif assigned_game == "sequence_sort":
        game_items_prompt = '''"game_items": [
    {"step": 1, "text": "First chronological or logical step"},
    {"step": 2, "text": "Second step"},
    {"step": 3, "text": "Third step"}
  ]'''
    elif assigned_game == "label_match":
        game_items_prompt = '''"game_items": [
    {"text": "Item A", "category": "left"},
    {"text": "Item B", "category": "right"},
    {"text": "Item C", "category": "left"}
  ],
  "category_left": "Category A (e.g. Fact)",
  "category_right": "Category B (e.g. Myth)"'''
    elif assigned_game == "code_drop":
        game_items_prompt = '''"game_items": [
    {"prompt": "Fix this key logic or code gap", "target": "correct_piece", "options": ["correct_piece", "wrong_piece_1", "wrong_piece_2"]}
  ]'''
    else:
        game_items_prompt = '''"game_items": []'''

    user_prompt = f"""Generate a COMPREHENSIVE, in-depth learning module for:
Chapter: "{chapter['title']}"
Key Concepts: {", ".join(chapter.get('key_concepts', [])[:5])}
Difficulty: {chapter.get('difficulty', 'intermediate')}

SOURCE MATERIAL (Use this to build a DETAILED, THOROUGH lecture):
{raw_text[:30000] if raw_text else content_context[:5000]}

=== LEARNER PROFILE (YOU MUST FOLLOW THESE ADAPTATIONS) ===
{active_modifiers_text}

=== VOICE GUIDANCE ===
Select narrator_voice from: {voice_options}
{tts_guidance}

=== VISUALIZATION ===
Create a valid mermaid.js mindmap for this chapter.
CRITICAL MERMAID SYNTAX RULES:
1. The very first line MUST be exactly `mindmap` (no brackets, no parentheses).
2. The second line must be indented and use double parentheses for the root node, exactly like: `  root((Topic Name))`
3. Use strict 2-space nesting. Do not use colons or assignments.
Example format:
mindmap
  root((Machine Learning))
    Supervised
      Labeled Data
    Unsupervised
      Clustering

Return this exact JSON structure:
{{
  "chapter_id": {chapter['id']},
  "narration_script": "string — ⚠️ MANDATORY REQUIREMENT: Generate a COMPREHENSIVE, DETAILED lecture of MINIMUM 1500-2000 words. You MUST strictly adopt the vocabulary, tone, and complexity dictated by the AGE and cognitive modifiers in the LEARNER PROFILE. Provide 2-3 relatable real-world examples that match their age. Write in a conversational tone. Every statement should have supporting detail.",
  "narrator_voice": "exact voice ID from options above",
  "tts_rate": "rate string like -10% or +5% or +0%",
  "tts_pitch": "pitch string like -2Hz or +3Hz or +0Hz",
  "visualization": {{
    "type": "mindmap",
    "title": "string — descriptive title for the diagram",
    "mermaid_code": "string — valid mermaid mindmap code"
  }},
  "game_type": "{assigned_game}",
  "game_title": "string — engaging game title",
  "game_instruction": "string — clear instructions",
  "game_difficulty": "easy|medium|hard",
  "game_note": "CRITICAL: The game_items MUST explicitly test the unique content presented in the narration_script. The language and concepts MUST perfectly match the learner's AGE group.",
  {game_items_prompt},
  "quiz_questions_note": "CRITICAL: All quiz questions & explanations MUST use vocabulary strictly appropriate for the learner's AGE.",
  "quiz_questions": [
    {{
      "question": "string — MUST test specific knowledge taught in the narration_script",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "explanation": "string — reference the lecture"
    }},
    {{
      "question": "string — MUST test specific knowledge taught in the narration_script",
      "options": ["A", "B", "C", "D"],
      "correct": 1,
      "explanation": "string — reference the lecture"
    }},
    {{
      "question": "string — MUST test specific knowledge taught in the narration_script",
      "options": ["A", "B", "C", "D"],
      "correct": 2,
      "explanation": "string — reference the lecture"
    }},
    {{
      "question": "string — MUST test specific knowledge taught in the narration_script",
      "options": ["A", "B", "C", "D"],
      "correct": 3,
      "explanation": "string — reference the lecture"
    }}
  ],
  "xp_reward": 250,
  "badge_name": "string — creative badge name",
  "badge_emoji": "string — single emoji",
  "improvement_tip": "string — personalized tip based on learner profile",
  "key_concepts": ["concept1", "concept2", "concept3"]
}}"""

    print(f"\n📋 [PROCESS-CHAPTER] Chapter: {chapter['title']}")
    print(f"   Profile modifiers: {len(modifiers)} active")
    print(f"   Cognitive style: {cognitive_style}")
    print(f"   Emotion: {emotion}")
    print(f"   Gender: {gender}")
    
    # OPTIMIZED: Using Groq (free) for chapter content - excellent for comprehensive lectures
    # Using reliable model names with env var fallback
    model = os.getenv("CHAPTER_MODEL", "llama-3.3-70b-versatile")
    
    # ⭐ VALIDATION LOOP: Ensure comprehensive content
    max_retries = 2
    retry_count = 0
    data = None
    
    while retry_count <= max_retries and data is None:
        print(f"🔄 [PROCESS-CHAPTER] Generation attempt {retry_count + 1}/{max_retries + 1}...")
        raw_response = call_llm(system_prompt, user_prompt, model=model)
        cleaned = clean_ai_json(raw_response)
        
        try:
            data = json.loads(cleaned, strict=False)
            
            # ⚠️ VALIDATION: Check minimum word count in narration
            narration = data.get("narration_script") or ""
            word_count = len(narration.split())
            
            if word_count < 400:  # Less than 400 words is too short
                print(f"⚠️ [PROCESS-CHAPTER] Narration too short ({word_count} words), retrying...")
                # Force a regeneration with emphasizing longer content
                enhanced_prompt = user_prompt.replace(
                    "MANDATORY REQUIREMENT: Generate a COMPREHENSIVE",
                    "⚠️ ABSOLUTE MUST: You MUST generate a VERY COMPREHENSIVE"
                )
                raw_response = call_llm(system_prompt, enhanced_prompt, model=model)
                cleaned = clean_ai_json(raw_response)
                data = json.loads(cleaned, strict=False)
                narration = data.get("narration_script") or ""
                word_count = len(narration.split())
                print(f"✓ [PROCESS-CHAPTER] Retried - Narration word count: {word_count}")
            else:
                print(f"✓ [PROCESS-CHAPTER] Narration word count: {word_count} (acceptable)")
            
        except json.JSONDecodeError as e:
            import time
            print(f"⚠️ [PROCESS-CHAPTER] JSON Parse Error, attempt {retry_count + 1}: {str(e)}")
            retry_count += 1
            if retry_count <= max_retries:
                print(f"🔄 [PROCESS-CHAPTER] Retrying in 2 seconds...")
                time.sleep(2)
                continue
            else:
                print(f"✗ [PROCESS-CHAPTER] Max retries reached, using fallback")
                data = None
                break
    
    if data is None:
        print(f"JSON Parse Error in process_chapter: {str(e)}")
        print(f"Raw Response: {raw_response[:500]}")
        print(f"Cleaned: {cleaned[:500]}")
        # Return a minimal valid chapter as fallback
        data = {
            "chapter_id": chapter.get('id', 1),
            "narration_script": chapter.get('content_slice', 'Chapter content'),
            "narrator_voice": "en-US-AriaNeural",
            "tts_rate": "0%",
            "tts_pitch": "0Hz",
            "visualization": {"type": "mindmap", "title": "Overview", "mermaid_code": f"mindmap\n  root(({chapter['title']}))\n    Key Concept 1\n    Key Concept 2"},
            "game_type": "true_false_blitz",
            "game_title": "Knowledge Check",
            "game_instruction": "Answer the questions",
            "game_difficulty": "medium",
            "game_items": [],
            "quiz_questions": [],
            "xp_reward": 250,
            "badge_name": "Learner",
            "badge_emoji": "📚",
            "improvement_tip": "Keep learning!",
            "key_concepts": []
        }
    
    # ROBUST FIELD SANITIZATION
    # 1. Voice ID: Extract "en-XX-Name"
    voice = data.get("narrator_voice", "en-US-AriaNeural")
    match_voice = re.search(r'[a-z]{2}-[A-Z]{2}-\w+Neural', voice)
    data["narrator_voice"] = match_voice.group(0) if match_voice else "en-US-AriaNeural"
    
    # 2. TTS Rate/Pitch: Extract numbers and units
    rate = data.get("tts_rate", "0%")
    match_rate = re.search(r'[-+]?\d+%', str(rate))
    data["tts_rate"] = match_rate.group(0) if match_rate else "0%"
    
    pitch = data.get("tts_pitch", "0Hz")
    match_pitch = re.search(r'[-+]?\d+Hz', str(pitch))
    data["tts_pitch"] = match_pitch.group(0) if match_pitch else "0Hz"
    
    # 3. Ensure visualization has valid mermaid_code
    viz = data.get("visualization", {})
    mermaid_code = viz.get("mermaid_code", "")
    
    # Validate mermaid code: must start with 'mindmap' and have valid structure
    if not mermaid_code or not mermaid_code.strip().startswith("mindmap"):
        print(f"⚠️ [PROCESS-CHAPTER] Invalid mermaid code detected, using fallback")
        title_safe = chapter.get('title', 'Learning Topic').replace('"', "'").replace('\n', ' ')
        mermaid_code = f"""mindmap
  root((Learning: {title_safe}))
    Core Concepts
      Main Idea 1
      Main Idea 2
    Key Understanding
      Principle A
      Principle B
    Application
      Practical Use
      Real World Example"""
    
    viz["mermaid_code"] = mermaid_code
    data["visualization"] = viz
    
    # 4. Ensure game_items and quiz_questions are lists
    if not isinstance(data.get("game_items"), list):
        data["game_items"] = []
    
    # FALLBACK: If game_items is empty, create demo items
    if not data["game_items"]:
        print(f"⚠️ [PROCESS-CHAPTER] game_items is empty, creating fallback demo items...")
        data["game_items"] = [
            {"text": f"This chapter covers {chapter.get('title', 'the topic')}.", "is_target": True, "explanation": "This is the main subject of this chapter."},
            {"text": "Understanding core concepts is important for learning.", "is_target": True, "explanation": "This is a fundamental principle of effective learning."},
            {"text": "Passive reading is more effective than active engagement.", "is_target": False, "explanation": "Active engagement leads to better retention and understanding."},
            {"text": f"This topic is part of {chapter.get('subject_domain', 'the curriculum')}.", "is_target": True, "explanation": "This chapter falls within this subject domain."},
            {"text": "Review and repetition help solidify learning.", "is_target": True, "explanation": "Spaced repetition is a proven learning technique."}
        ]
    
    if not isinstance(data.get("quiz_questions"), list):
        data["quiz_questions"] = []
    
    # FALLBACK: If quiz_questions is empty, create demo questions
    if not data["quiz_questions"]:
        print(f"⚠️ [PROCESS-CHAPTER] quiz_questions is empty, creating fallback demo questions...")
        data["quiz_questions"] = [
            {
                "question": f"What is the main topic of this chapter?",
                "options": [chapter.get('title', 'The Topic'), "Alternative A", "Alternative B", "Alternative C"],
                "correct": 0,
                "explanation": f"This chapter focuses on: {chapter.get('title', 'the main topic')}",
                "difficulty": "easy",
                "concept_tag": "Core Concept"
            },
            {
                "question": "What's the best way to learn new concepts?",
                "options": ["Passive reading", "Active engagement", "Ignoring details", "Memorizing"],
                "correct": 1,
                "explanation": "Active engagement with material leads to better learning outcomes.",
                "difficulty": "medium",
                "concept_tag": "Learning Strategy"
            },
            {
                "question": "How can learners retain information better?",
                "options": ["No review", "One-time study", "Spaced repetition", "Cramming"],
                "correct": 2,
                "explanation": "Spaced repetition is the most effective retention technique.",
                "difficulty": "hard",
                "concept_tag": "Memory Science"
            }
        ]
    if not isinstance(data.get("quiz_questions"), list):
        data["quiz_questions"] = []
    if not isinstance(data.get("key_concepts"), list):
        data["key_concepts"] = []
    
    print(f"✓ [PROCESS-CHAPTER] Generated with {len(data.get('narration_script',''))} char narration, {len(data.get('game_items',[]))} game items, {len(data.get('quiz_questions',[]))} quiz questions")
    
    return data

