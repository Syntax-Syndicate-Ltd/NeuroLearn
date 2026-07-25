"""Quick TTS test to verify edge-tts works."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from utils.tts_engine import generate_chapter_audio

test_chapter = {
    "chapter_id": "test",
    "narration_script": "Welcome to NeuroLearn. This is a test of the text to speech engine. If you can hear this, audio is working correctly.",
    "narrator_voice": "en-US-AriaNeural",
    "tts_rate": "+0%",
    "tts_pitch": "+0Hz"
}

print("Starting TTS test...")
result = generate_chapter_audio(test_chapter)
if result:
    path = os.path.join("static/audio", result)
    size = os.path.getsize(path) if os.path.exists(path) else 0
    print(f"\n✅ SUCCESS! File: {result}, Size: {size} bytes")
    # Clean up test file
    if os.path.exists(path):
        os.remove(path)
        print("Test file cleaned up.")
else:
    print("\n❌ FAILED! No audio file generated.")
