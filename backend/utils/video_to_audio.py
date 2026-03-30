from moviepy.editor import VideoFileClip
import os

def video_to_audio(video_path: str, output_path: str):
    clip = VideoFileClip(video_path)
    clip.audio.write_audiofile(output_path)
    clip.close()