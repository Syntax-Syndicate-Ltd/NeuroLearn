"""
NeuroLearn AI — Story Generator & Simplified Content Engine
Generates manga-style story panels using Groq (text) + Hugging Face (images)
Also generates simplified content for Simple Mode
"""

import os
import json
import requests
import base64
import re
from dotenv import load_dotenv

load_dotenv()


def call_groq(system_prompt, user_prompt):
    """Call Groq API for text generation."""
    groq_key = os.getenv("GROQ_API_KEY")
    # Use 8b-instant instead of 70b to prevent '429 Too Many Requests' limits
    model = os.getenv("FALLBACK_MODEL", "llama-3.1-8b-instant")
    
    url = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/") + "/chat/completions"
    headers = {"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"}
    
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=60)
        response.raise_for_status()
        data = response.json()
        content = data.get('choices', [{}])[0].get('message', {}).get('content', '')
        return content
    except Exception as e:
        print(f"✗ [STORY-GEN] Groq API Error: {str(e)}")
        raise e


def clean_json(raw_text):
    """Extract valid JSON from AI response."""
    if not raw_text:
        return "{}"
    
    if "```json" in raw_text:
        raw_text = raw_text.split("```json")[-1].split("```")[0]
    elif "```" in raw_text:
        parts = raw_text.split("```")
        raw_text = parts[1] if len(parts) >= 3 else parts[-1]
    
    raw_text = raw_text.strip().lstrip('`\'"').rstrip('`\'"')
    
    # Fix newlines inside strings
    result = []
    in_string = False
    i = 0
    while i < len(raw_text):
        char = raw_text[i]
        if char == '\\' and in_string and i + 1 < len(raw_text):
            next_char = raw_text[i + 1]
            if next_char in ['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']:
                result.append(char)
                result.append(next_char)
                i += 2
                continue
        if char == '"':
            num_bs = 0
            for j in range(len(result) - 1, -1, -1):
                if result[j] == '\\':
                    num_bs += 1
                else:
                    break
            if num_bs % 2 == 0:
                in_string = not in_string
            result.append(char)
        elif in_string and char == '\n':
            result.append('\\n')
        elif in_string and char == '\r':
            pass
        elif in_string and char == '\t':
            result.append('\\t')
        elif not in_string and char in ['\n', '\r', '\t']:
            pass
        else:
            result.append(char)
        i += 1
    
    cleaned = "".join(result).strip()
    if not cleaned.startswith('{') and not cleaned.startswith('['):
        cleaned = '{}'
    return cleaned


def generate_manga_story(chapter_content, chapter_title, key_concepts=None):
    """
    Generate a manga-style story based on chapter content.
    Returns structured panel data for frontend rendering.
    """
    concepts = ", ".join(key_concepts[:5]) if key_concepts else "the main concepts"
    
    system_prompt = """You are a creative manga story writer for educational content. 
You transform educational content into engaging manga-style stories that teach the same concepts.
Return ONLY raw valid JSON. No markdown, no backticks, no explanation."""

    user_prompt = f"""Create an engaging manga-style educational story based on this content:

CHAPTER: "{chapter_title}"
KEY CONCEPTS: {concepts}

CONTENT TO TEACH:
{chapter_content[:3000]}

Create exactly 6 panels for a manga comic that teaches these concepts through an exciting story.
The story should feature a young student character learning these concepts through an adventure.

IMPORTANT RULES:
- Each panel must teach at least one concept from the content
- Story must be exciting and engaging for young learners (ages 11-16)
- Dialogue should be natural and fun
- Include sound effects (SFX) for manga feel
- The story should have a clear beginning, middle, and end

Return this exact JSON format:
{{
    "story_title": "string — catchy manga title",
    "panels": [
        {{
            "panel_number": 1,
            "panel_size": "large",
            "scene_description": "string — detailed visual description for image generation (describe scene, characters, expressions, background, manga style, NO text in image)",
            "dialogue": "string — character dialogue or narration text (2-3 sentences max)",
            "sfx": "string — sound effect text like WHOOSH, BANG, etc. or empty",
            "concept_taught": "string — what concept this panel teaches"
        }},
        {{
            "panel_number": 2,
            "panel_size": "small",
            "scene_description": "...",
            "dialogue": "...",
            "sfx": "...",
            "concept_taught": "..."
        }},
        {{
            "panel_number": 3,
            "panel_size": "small",
            "scene_description": "...",
            "dialogue": "...",
            "sfx": "...",
            "concept_taught": "..."
        }},
        {{
            "panel_number": 4,
            "panel_size": "medium",
            "scene_description": "...",
            "dialogue": "...",
            "sfx": "...",
            "concept_taught": "..."
        }},
        {{
            "panel_number": 5,
            "panel_size": "wide",
            "scene_description": "...",
            "dialogue": "...",
            "sfx": "...",
            "concept_taught": "..."
        }},
        {{
            "panel_number": 6,
            "panel_size": "full",
            "scene_description": "...",
            "dialogue": "...",
            "sfx": "...",
            "concept_taught": "..."
        }}
    ],
    "read_aloud_script": "string — full narration script combining all panel dialogues into a smooth read-aloud story (300-500 words)"
}}

Panel sizes must follow this pattern for the asymmetric bento grid:
- Panel 1: "large" (takes up 2 rows on the left)
- Panel 2: "small" (top right)
- Panel 3: "small" (middle right)
- Panel 4: "medium" (bottom left)
- Panel 5: "wide" (bottom right, wider)
- Panel 6: "full" (full width finale)
"""
    
    try:
        print(f"📖 [STORY-GEN] Generating manga story for: {chapter_title}")
        raw_response = call_groq(system_prompt, user_prompt)
        cleaned = clean_json(raw_response)
        story_data = json.loads(cleaned, strict=False)
        
        # Validate
        if "panels" not in story_data or len(story_data["panels"]) < 4:
            raise ValueError("Insufficient panels generated")
        
        print(f"✓ [STORY-GEN] Generated {len(story_data['panels'])} panels: {story_data.get('story_title', 'Untitled')}")
        return story_data
        
    except Exception as e:
        print(f"✗ [STORY-GEN] Error generating story: {str(e)}")
        # Return fallback story
        return {
            "story_title": f"The Adventure of {chapter_title}",
            "panels": [
                {
                    "panel_number": i + 1,
                    "panel_size": ["large", "small", "small", "medium", "wide", "full"][i],
                    "scene_description": f"A young student discovering {chapter_title} in a magical library",
                    "dialogue": f"Panel {i+1}: Let's explore {chapter_title}! This is going to be amazing!",
                    "sfx": ["WHOOSH!", "SPARKLE!", "ZAP!", "BOOM!", "FLASH!", "SHINE!"][i],
                    "concept_taught": concepts
                } for i in range(6)
            ],
            "read_aloud_script": f"Welcome to the adventure of {chapter_title}! Join our hero as they discover the amazing world of {concepts}. Through exciting challenges and discoveries, we'll learn together!"
        }


def generate_manga_image(scene_description, panel_number=1):
    """
    Generate a manga-style image using Pollinations.ai — completely free, no API key needed.
    Returns base64-encoded image data.
    """
    import urllib.parse, urllib.request

    # Build a manga-styled prompt
    manga_prompt = (
        f"manga style, anime art, educational illustration, vibrant colors, "
        f"clean lines, comic book panel, {scene_description}, "
        f"high quality, detailed, studio ghibli inspired"
    )
    negative = "text, words, letters, watermark, blurry, low quality, realistic photo, 3d render"

    encoded_prompt   = urllib.parse.quote(manga_prompt)
    encoded_negative = urllib.parse.quote(negative)

    # Pollinations free image endpoint — returns a PNG directly
    url = (
        f"https://image.pollinations.ai/prompt/{encoded_prompt}"
        f"?width=512&height=512&nologo=true&negative={encoded_negative}"
        f"&model=flux&seed={panel_number}"
    )

    try:
        print(f"🎨 [IMAGE-GEN] Generating manga image for panel {panel_number} via Pollinations...")
        req = urllib.request.Request(url, headers={"User-Agent": "NeuroLearnAI/1.0"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            image_bytes = resp.read()

        if len(image_bytes) > 1000:          # sanity-check — real image, not an error page
            image_b64 = base64.b64encode(image_bytes).decode("utf-8")
            print(f"✓ [IMAGE-GEN] Panel {panel_number} image generated ({len(image_bytes)} bytes)")
            return image_b64
        else:
            print(f"✗ [IMAGE-GEN] Panel {panel_number} response too small, likely an error")
            return None

    except Exception as e:
        print(f"✗ [IMAGE-GEN] Error for panel {panel_number}: {str(e)}")
        return None


def generate_manga_images_batch(panels):
    """
    Generate images for all panels. Returns panels with image_data field added.
    Generates images sequentially to avoid rate limits.
    """
    for panel in panels:
        image_b64 = generate_manga_image(
            panel.get("scene_description", ""),
            panel.get("panel_number", 0)
        )
        panel["image_data"] = image_b64  # Could be None if generation fails
    
    return panels


def fetch_card_image(query):
    """
    Search Wikimedia Commons for a relevant educational image.
    Returns a dict with 'url' and 'attribution', or None on failure.
    Uses the free Wikimedia API — no key needed.
    """
    import urllib.parse, urllib.request
    try:
        search_query = urllib.parse.quote(query)
        # Search Wikimedia Commons for the term
        search_url = (
            f"https://en.wikipedia.org/w/api.php"
            f"?action=query&titles={search_query}&prop=pageimages&piprop=thumbnail"
            f"&pithumbsize=400&format=json&origin=*"
        )
        req = urllib.request.Request(search_url, headers={"User-Agent": "NeuroLearnAI/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            thumb = page.get("thumbnail", {})
            if thumb.get("source"):
                return {"url": thumb["source"], "attribution": "Wikipedia"}
    except Exception as e:
        print(f"[SIMPLE-IMG] Wikimedia fetch failed for '{query}': {e}")

    # Fallback: Picsum (placeholder, always works, seeded by hash for consistency)
    try:
        seed = abs(hash(query)) % 1000
        return {"url": f"https://picsum.photos/seed/{seed}/400/220", "attribution": "Picsum"}
    except Exception:
        return None


def generate_simplified_content(narration_script, chapter_title, key_concepts=None):
    """
    Generate simplified, visual-friendly content for Simple Mode.
    Breaks complex content into small, digestible cards with emojis.
    """
    concepts = ", ".join(key_concepts[:5]) if key_concepts else "the main topics"
    
    system_prompt = """You are an expert at simplifying complex educational content for learners who need 
a calmer, more accessible learning experience. Return ONLY raw valid JSON."""

    user_prompt = f"""Simplify the following educational content into easy-to-understand cards.

CHAPTER: "{chapter_title}"
KEY CONCEPTS: {concepts}

CONTENT:
{narration_script[:3000]}

Create exactly 6-8 simple cards. Each card teaches ONE concept in the simplest way possible.

RULES:
- Use very simple words (8-year-old reading level)
- Each card should have only 1-2 short sentences
- Include a relevant emoji for each card
- Include a simple analogy or real-world example for each concept
- Make it calming and encouraging

Return this JSON:
{{
    "simplified_title": "string — simple, friendly title",
    "cards": [
        {{
            "emoji": "🌟",
            "heading": "string — short concept name (3-5 words)",
            "content": "string — simple explanation (1-2 sentences, very short)",
            "analogy": "string — real-world comparison (e.g., 'It's like...')",
            "color_hint": "violet|cyan|amber|emerald|rose"
        }}
    ],
    "encouragement": "string — encouraging message for the learner"
}}"""
    
    try:
        print(f"📋 [SIMPLE-GEN] Generating simplified content for: {chapter_title}")
        raw_response = call_groq(system_prompt, user_prompt)
        cleaned = clean_json(raw_response)
        simple_data = json.loads(cleaned, strict=False)
        
        if "cards" not in simple_data or len(simple_data["cards"]) < 3:
            raise ValueError("Insufficient cards generated")
        
        # Enrich each card with a relevant image
        print(f"🖼️ [SIMPLE-GEN] Fetching images for {len(simple_data['cards'])} cards...")
        for card in simple_data["cards"]:
            img_query = f"{chapter_title} {card.get('heading', '')}"
            image = fetch_card_image(img_query)
            card["image"] = image  # {'url': ..., 'attribution': ...} or None
        
        print(f"✓ [SIMPLE-GEN] Generated {len(simple_data['cards'])} simplified cards")
        return simple_data
        
    except Exception as e:
        print(f"✗ [SIMPLE-GEN] Error: {str(e)}")
        return {
            "simplified_title": f"Let's Learn: {chapter_title}",
            "cards": [
                {
                    "emoji": "🌟",
                    "heading": "Welcome!",
                    "content": f"We're going to learn about {chapter_title}. It's going to be fun!",
                    "analogy": "Think of it like exploring a new place.",
                    "color_hint": "violet"
                },
                {
                    "emoji": "🧩",
                    "heading": "Key Idea",
                    "content": f"The main thing to know is about {concepts}.",
                    "analogy": "It's like putting puzzle pieces together.",
                    "color_hint": "cyan"
                },
                {
                    "emoji": "💪",
                    "heading": "You've Got This!",
                    "content": "Take your time and remember — you're doing great!",
                    "analogy": "Learning is like building muscles — it gets easier!",
                    "color_hint": "emerald"
                }
            ],
            "encouragement": "You're doing amazing! Every step counts! 🌈"
        }
