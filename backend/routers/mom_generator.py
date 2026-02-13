# routers/mom_generator.py
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse, FileResponse
import os
import uuid
import shutil
from pydub import AudioSegment
import speech_recognition as sr
from fpdf import FPDF

router = APIRouter()

TEMP_DIR = "temp_mom"

def extract_audio_from_video(video_path, audio_path):
    """Convert video to WAV audio"""
    try:
        video = AudioSegment.from_file(video_path)
        video.export(audio_path, format="wav")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio extraction failed: {e}")

def transcribe_audio(audio_path):
    """Offline speech-to-text using speech_recognition"""
    recognizer = sr.Recognizer()
    with sr.AudioFile(audio_path) as source:
        audio = recognizer.record(source)
    try:
        text = recognizer.recognize_sphinx(audio)  # offline using CMU Sphinx
        return text
    except sr.UnknownValueError:
        return ""
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {e}")

def generate_mom_text(transcript):
    """Generate a mock MOM from transcript"""
    if not transcript.strip():
        transcript = """
        Project discussion happened.
        Frontend completed.
        Backend APIs in progress.
        Release delayed by one week.
        """

    mom_text = f"""
    MEETING TITLE: Project Status Meeting

    AGENDA:
    - Project updates
    - Risks
    - Timelines

    DISCUSSION:
    {transcript}

    DECISIONS:
    - Release postponed by 1 week

    ACTION ITEMS:
    - Backend APIs completion (Owner: Backend Team)
    - Testing start after backend completion
    """
    return mom_text.strip()

def create_pdf(mom_text, output_path):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_font("Arial", size=12)
    for line in mom_text.split("\n"):
        pdf.multi_cell(0, 8, line)
    pdf.output(output_path)

@router.post("/meeting-mom")
async def meeting_mom(
    video: UploadFile | None = File(None),
    transcript: str | None = Form(None)
):
    os.makedirs(TEMP_DIR, exist_ok=True)
    temp_id = str(uuid.uuid4())
    temp_path = os.path.join(TEMP_DIR, temp_id)
    os.makedirs(temp_path, exist_ok=True)

    final_transcript = transcript or ""

    try:
        # Step 1: if video uploaded, extract audio and transcribe
        if video:
            video_path = os.path.join(temp_path, video.filename)
            audio_path = os.path.join(temp_path, "audio.wav")
            with open(video_path, "wb") as f:
                shutil.copyfileobj(video.file, f)

            extract_audio_from_video(video_path, audio_path)
            audio_transcript = transcribe_audio(audio_path)
            if audio_transcript.strip():
                final_transcript = audio_transcript

        # Step 2: generate MOM text
        mom_text = generate_mom_text(final_transcript)

        # Step 3: create PDF
        pdf_path = os.path.join(temp_path, "meeting_mom.pdf")
        create_pdf(mom_text, pdf_path)

        return {
            "mom": mom_text,
            "pdf_path": pdf_path  # can be used to download if needed
        }

    except Exception as e:
        shutil.rmtree(temp_path, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(e))