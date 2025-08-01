import speech_recognition as sr
import time
import asyncio
import websocket
import json
import rel
from vosk import SetLogLevel, Model
SetLogLevel(-1)
socket = None
async def listen():
    r = sr.Recognizer()
    print("Initializing Model", flush=True)
    r.vosk_model = Model("model")
    print("Model Initialized", flush=True)
    with sr.Microphone() as source:
        while True:
            audio = r.listen(source)
            try:
                text = r.recognize_vosk(audio)
                text = json.loads(text)['text']
                if len(text) < 1: continue
                print("[data]" + text, flush=True)
            except Exception as error:
                print(error, flush=True)
            time.sleep(1)

if __name__ == "__main__":
    asyncio.run(listen())
    