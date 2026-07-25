import requests

OPENROUTER_API_KEY = "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"
headers = {"Authorization": f"Bearer {OPENROUTER_API_KEY}", "HTTP-Referer": "http://localhost:5000", "X-Title": "Synesthesia Engine", "Content-Type": "application/json"}

prompt = """You are the 'Synesthesia Engine'. Your job is to transcode educational text into highly engaging audio.
Write it as a highly energetic, fast-paced rap or slam poetry script. Make it punchy, aggressive, and fun. Use dynamic slang where appropriate.
(Keep it approx 150-200 words max).
AND you must extract EXACTLY 8 key concepts from this text as single short phrases (1-2 words max) to act as collectible targets in a 3D video game.
    
Input Text:
Machine Learning basics: Neural networks, supervised learning, and backpropagation.

Output strictly valid JSON with this exact schema:
{
  "lyrics": "The spoken word script...",
  "keywords": ["Concept1", "Concept2", "Concept3", "Concept4", "Concept5", "Concept6", "Concept7", "Concept8"],
  "objective": "A short, 3 to 5 word task instruction for the game (e.g. 'Catch the cellular phases')"
}"""

data = { "model": "openrouter/free", "messages": [{"role": "user", "content": prompt}], "temperature": 0.7, "max_tokens": 800 }
resp = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=data)
print("OPENROUTER/FREE:", resp.json())

data2 = { "model": "google/gemma-2-9b-it:free", "messages": [{"role": "user", "content": prompt}], "temperature": 0.7, "max_tokens": 800 }
resp2 = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=data2)
print("GEMMA:", resp2.json())
