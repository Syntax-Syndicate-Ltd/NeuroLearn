def call_llm(prompt, max_tokens=800):
    import requests
    import time
    
    # Try multiple free models exactly. Openrouter/free changes dynamically and fails.
    working_models = ["openrouter/auto", "openrouter/free", "google/gemini-2.0-pro-exp-02-05:free", "sophosympatheia/rogue-rose-103b-v0.2:free"]
    
    for model in working_models:
        try:
            headers = {"Authorization": f"Bearer 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", "HTTP-Referer": "http://localhost:5000", "X-Title": "Synesthesia Engine", "Content-Type": "application/json"}
            data = { "model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.7, "max_tokens": max_tokens }
            resp = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=data)
            resp_json = resp.json()
            if "error" in resp_json:
                continue # Try next model
            
            content = resp_json.get("choices", [{}])[0].get("message", {}).get("content", "")
            if content:
                # Validate it contains valid JSON structure roughly
                if "{" in content and "}" in content:
                    return str(content).replace('```json', '').replace('```', '').strip()
        except:
            pass

    # If all openrouter ones fail, try Grok standard
    try:
        headers_grok = {"Authorization": "Bearer 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", "Content-Type": "application/json"}
        data_grok = { "model": "grok-2-latest", "messages": [{"role": "user", "content": prompt}], "temperature": 0.7, "max_tokens": max_tokens }
        resp2 = requests.post("https://api.x.ai/v1/chat/completions", headers=headers_grok, json=data_grok)
        resp2_json = resp2.json()
        if "error" not in resp2_json:
            content = resp2_json.get("choices", [{}])[0].get("message", {}).get("content", "")
            if content: return str(content).replace('```json', '').replace('```', '').strip()
    except:
        pass

    raise Exception("ALL APIs exhausted and failed. Grok and Openrouter rejected the requests. Please check your API Keys.")
