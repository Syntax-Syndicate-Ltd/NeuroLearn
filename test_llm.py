import requests
import json

OPENROUTER_API_KEY = "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"
headers = {"Authorization": f"Bearer {OPENROUTER_API_KEY}", "HTTP-Referer": "http://localhost:5000", "X-Title": "Synesthesia Engine", "Content-Type": "application/json"}

models_to_test = [
    "google/gemini-2.0-flash-lite-preview-02-05:free",
    "google/gemini-2.5-flash-free",
    "google/gemma-2-9b-it:free",
    "meta-llama/llama-3.1-8b-instruct:free",
    "openrouter/free"
]

prompt = "Reply with 'OK'"

for m in models_to_test:
    try:
        data = { "model": m, "messages": [{"role": "user", "content": prompt}], "max_tokens": 10 }
        resp = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=data)
        r = resp.json()
        if "error" in r:
            print(f"{m} ERROR: {r['error'].get('message', r['error'])}")
        else:
            print(f"{m} SUCCESS: {r['choices'][0]['message']['content']}")
    except Exception as e:
        print(f"{m} EXCEPTION: {str(e)}")
