import os
from dotenv import load_dotenv
import requests

load_dotenv(override=True)
openrouter_key = os.getenv("OPENROUTER_API_KEY")
print(f"Loaded key: {openrouter_key[:10] if openrouter_key else 'None'}...")

response = requests.post(
    url="https://openrouter.ai/api/v1/chat/completions",
    headers={"Authorization": f"Bearer {openrouter_key}"},
    json={
        "model": "openrouter/auto",
        "messages": [
            {"role": "user", "content": "Say hello world in json"}
        ],
        "response_format": {"type": "json_object"}
    },
    timeout=10 
)
print("Status OpenRouter:", response.status_code)
if response.status_code != 200:
    print(response.text)
