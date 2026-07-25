import os
import requests
from dotenv import load_dotenv

load_dotenv(override=True)
groq_key = os.getenv("GROQ_API_KEY", "")

response = requests.post(
    url="https://api.groq.com/openai/v1/chat/completions",
    headers={"Authorization": f"Bearer {groq_key}"},
    json={
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "say hi"}
        ]
    },
    timeout=10
)
print("Status:", response.status_code)
print("Response:", response.text)
