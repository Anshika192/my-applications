# mom_utils.py

import os
from moviepy.editor import VideoFileClip
from pydub import AudioSegment
import speech_recognition as sr
import openai

def extract_audio_from_video(video_path: str, output_path: str):
    clip = VideoFileClip(video_path)
    clip.audio.write_audiofile(output_path)
    clip.close()

def audio_to_text(audio_path: str) -> str:
    recognizer = sr.Recognizer()
    with sr.AudioFile(audio_path) as source:
        audio_data = recognizer.record(source)
    try:
        text = recognizer.recognize_google(audio_data)
    except sr.UnknownValueError:
        text = ""
    return text

def generate_mom_from_text(transcript: str) -> str:
    openai.api_key = os.getenv("OPENAI_API_KEY")
    prompt = f"""
    You are a project assistant. Convert the following meeting transcript into a clear and structured Minutes of Meeting (MOM):
    
    Transcript:
    {transcript}

    Return the MOM with sections: TITLE, AGENDA, DISCUSSION, DECISIONS, ACTION ITEMS.
    """
    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=800
    )
    return response['choices'][0]['message']['content'].strip()