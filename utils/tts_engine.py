# TTS Engine for NeuroLearn AI using edge-tts
# Dynamically streams in-memory without saving files.

import asyncio
import edge_tts
import re

# Voice mapping based on user requests (English default)
VOICE_MAP = {
    "standard_female": "en-US-AriaNeural",
    "standard_male": "en-US-ChristopherNeural",
    "fun_female": "en-US-JennyNeural",
    "fun_male": "en-US-EricNeural"
}

# Multilingual voice mapping: language code -> [female, male]
LANGUAGE_VOICE_MAP = {
    "hi": ["hi-IN-SwaraNeural", "hi-IN-MadhurNeural"],
    "mr": ["mr-IN-AarohiNeural", "mr-IN-ManoharNeural"],
    "ta": ["ta-IN-PallaviNeural", "ta-IN-ValluvarNeural"],
    "te": ["te-IN-ShrutiNeural", "te-IN-MohanNeural"],
    "en": None  # Use default VOICE_MAP
}

def get_voice_for_language(preferred_language, gender_key="standard_female"):
    """Get the appropriate TTS voice for a given language and gender."""
    if not preferred_language or preferred_language == "en":
        return None  # Use default English voice
    
    voices = LANGUAGE_VOICE_MAP.get(preferred_language)
    if not voices:
        return None
    
    # Pick female (index 0) or male (index 1) based on gender key
    is_male = "male" in gender_key.lower()
    return voices[1] if is_male else voices[0]

def _parse_rate(rate_str):
    if not rate_str: return "+0%"
    match = re.search(r'([+-]?\d+)', str(rate_str))
    if match:
        num = match.group(1)
        if not num.startswith('+') and not num.startswith('-'): num = f"+{num}"
        return f"{num}%"
    return "+0%"

def _parse_pitch(pitch_str):
    if not pitch_str: return "+0Hz"
    match = re.search(r'([+-]?\d+)', str(pitch_str))
    if match:
        num = match.group(1)
        if not num.startswith('+') and not num.startswith('-'): num = f"+{num}"
        return f"{num}Hz"
    return "+0Hz"

import threading
import queue

def generate_chapter_audio_stream(text, voice_id="standard_female", rate="+0%", pitch="+0Hz"):
    """
    Synchronous generator wrapper that yields edge-tts audio bytes instantly.
    Creates zero-latency playback by streaming chunks as they arrive.
    """
    if not text or len(text.strip()) < 5:
        return
        
    # If voice_id looks like a direct Neural voice name, use it directly
    if "Neural" in voice_id:
        voice = voice_id
    else:
        voice = VOICE_MAP.get(voice_id, "en-US-AriaNeural")
    rate = _parse_rate(rate)
    pitch = _parse_pitch(pitch)
    
    print(f"🎵 [TTS-STREAM] Starting INSTANT stream with voice={voice}")
    
    q = queue.Queue()
    
    def run_async():
        async def fetch():
            try:
                communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch)
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        q.put(chunk["data"])
            except Exception as e:
                print(f"✗ [TTS-STREAM] Async Error: {str(e)}")
                # Try fallback to Edge default
                edge_failed = True
                if voice != "en-US-AriaNeural":
                    try:
                        print(f"🔄 [TTS-STREAM] Retrying with Edge Fallback...")
                        communicate = edge_tts.Communicate(text, "en-US-AriaNeural", rate=rate, pitch=pitch)
                        async for chunk in communicate.stream():
                            if chunk["type"] == "audio":
                                q.put(chunk["data"])
                                edge_failed = False
                    except Exception as e2:
                        print(f"✗ [TTS-STREAM] Edge Fallback failed: {str(e2)}")
                
                if edge_failed:
                    print("🔄 [TTS-STREAM] Falling back to reliable Google TTS API...")
                    import requests
                    import urllib.parse
                    try:
                        # Split text into manageable chunks for Google TTS (max 200 chars)
                        words = text.split()
                        chunks = []
                        curr = ""
                        for w in words:
                            if len(curr) + len(w) < 180:
                                curr += w + " "
                            else:
                                chunks.append(curr.strip())
                                curr = w + " "
                        if curr: chunks.append(curr.strip())
                        
                        lang = "en"
                        if "hi-IN" in voice: lang = "hi"
                        elif "mr-IN" in voice: lang = "mr"
                        elif "ta-IN" in voice: lang = "ta"
                        elif "te-IN" in voice: lang = "te"

                        for c in chunks:
                            enc_text = urllib.parse.quote(c)
                            url = f"https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl={lang}&q={enc_text}"
                            r = requests.get(url, stream=True, timeout=10)
                            if r.status_code == 200:
                                for chunk in r.iter_content(chunk_size=4096):
                                    if chunk: q.put(chunk)
                    except Exception as e3:
                        print(f"✗ [TTS-STREAM] Google TTS Fallback failed: {str(e3)}")
            finally:
                q.put(None) # Signal EOF
                
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(fetch())
        finally:
            loop.close()
            
    # Start generation in background
    threading.Thread(target=run_async, daemon=True).start()
    
    # Yield chunks as they arrive in the queue
    while True:
        chunk = q.get()
        if chunk is None:
            break
        yield chunk
