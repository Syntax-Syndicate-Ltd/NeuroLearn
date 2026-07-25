import sqlite3, json
conn = sqlite3.connect('neurolearn.db')
conn.row_factory = sqlite3.Row
rows = conn.execute('SELECT id, data_json FROM chapters').fetchall()
for r in rows:
    data = json.loads(r["data_json"])
    print(f"Chapter {r['id']}:")
    print(f"  audio_url: {data.get('audio_url')}")
    print(f"  narrator_voice: {data.get('narrator_voice')}")
    print(f"  tts_rate: {data.get('tts_rate')}")
    print(f"  tts_pitch: {data.get('tts_pitch')}")
    print(f"  narration_script length: {len(data.get('narration_script', ''))}")
    print(f"  narration_script (first 200): {data.get('narration_script', '')[:200]}")
