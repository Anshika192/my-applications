from fastapi import FastAPI, Depends, HTTPException, File, UploadFile, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List, Optional
import os, io, uuid, shutil, asyncio, html, tempfile, wave, struct
from pathlib import Path

import google.generativeai as genai
from faster_whisper import WhisperModel
from PyPDF2 import PdfMerger, PdfReader, PdfWriter
from pdf2docx import Converter
from pptx import Presentation
import pandas as pd

import models, schemas, database
from routers.pdf_to_image import router as pdf_image_router
from routers.auth import router as auth_router
from routers.user_data import router as user_data_router

# ---- Environment Variables ----
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "tiny.en")
WHISPER_BEAM = int(os.getenv("WHISPER_BEAM", "1"))
WHISPER_COMPUTE = os.getenv("WHISPER_COMPUTE", "cpu")

genai.configure(api_key=GEMINI_API_KEY)

# ------------------------ FastAPI App ------------------------
app = FastAPI(title="My Applications - MOM API", version="0.1.0")

# ---- CORS registered EARLY ----
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    # "https://my-applications-mocha.vercel.app",  # optional fixed prod
]
# ---- CORS ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For production, you can restrict this to your Vercel URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# COEP-friendly: CORP on all responses
@app.middleware("http")
async def add_corp_header(request, call_next):
    resp = await call_next(request)
    resp.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
    return resp

# (Optional) debug to verify origin reaches the app
@app.middleware("http")
async def log_origin(request, call_next):
    print("[CORS] Origin:", request.headers.get("origin"))
    return await call_next(request)

# Optimized Whisper Load (SIRF EK BAAR)
whisper_model: Optional[WhisperModel] = None
try:
    whisper_model = WhisperModel(
        WHISPER_MODEL, 
        device="cpu", 
        compute_type="int8",
        cpu_threads=1, # Free tier memory protection
        num_workers=1
    )
    print(f"[Whisper] Loaded model='{WHISPER_MODEL}' in Low-Power mode")
except Exception as e:
    print(f"[WARN] Faster-Whisper init failed: {e}")

# ---- Helper functions ----
def _write_silence_wav(path, duration_sec=0.5, rate=16000):
    nframes = int(duration_sec * rate)
    with wave.open(path, "w") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
        w.writeframes(struct.pack("<h", 0) * nframes)

@app.on_event("startup")
async def preload_whisper():
    if whisper_model:
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        _write_silence_wav(tmp.name, 0.5)
        try:
            whisper_model.transcribe(tmp.name, beam_size=WHISPER_BEAM)
            print("[Whisper preload] Warm-up done")
        finally:
            os.remove(tmp.name)

# ---- mounts, DB, routers (NO ellipsis) ----
for d in ["uploads", "output", "temp_uploads", "temp_mom"]:
    os.makedirs(d, exist_ok=True)

app.mount("/uploads",      StaticFiles(directory="uploads",      check_dir=False), name="uploads")
app.mount("/output",       StaticFiles(directory="output",       check_dir=False), name="output")
app.mount("/temp_uploads", StaticFiles(directory="temp_uploads", check_dir=False), name="temp_uploads")
app.mount("/temp_mom",     StaticFiles(directory="temp_mom",     check_dir=False), name="temp_mom")

models.Base.metadata.create_all(bind=database.engine)
app.include_router(pdf_image_router)
app.include_router(auth_router)
app.include_router(user_data_router)
get_db = database.get_db

# ---- Gemini Logic ----
def pick_gemini_model():
    model_name = os.getenv("GEMINI_MODEL", "models/gemini-2.5-flash")
    return genai.GenerativeModel(model_name)

def _upload_to_gemini(upload: UploadFile):
    suffix = Path(upload.filename or "").suffix
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(upload.file, tmp)
        tmp_path = tmp.name
    try:
        return genai.upload_file(path=tmp_path)
    finally:
        os.remove(tmp_path)

# ---- Whisper init ----
whisper_model: Optional[WhisperModel] = None
try:
    whisper_model = WhisperModel(WHISPER_MODEL, device=WHISPER_COMPUTE, compute_type="int8")
    print(f"[Whisper] Loaded model='{WHISPER_MODEL}' device='{WHISPER_COMPUTE}'")
except Exception as e:
    whisper_model = None
    print(f"[WARN] Faster-Whisper init failed: {e}")


# ------------------------ ROUTES ------------------------

@app.get("/health")
def health(): return {"status": "ok"}

@app.get("/")
def root():
    return {"status": "ok", "service": "my-applications"}

@app.get("/applications", response_model=List[schemas.ApplicationRead])
def read_applications(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Application).offset(skip).limit(limit).all()

@app.post("/applications", response_model=schemas.ApplicationRead)
def create_application(application: schemas.ApplicationCreate, db: Session = Depends(get_db)):
    db_application = models.Application(**application.dict())
    db.add(db_application); db.commit(); db.refresh(db_application)
    return db_application

@app.post("/transcribe/local")
async def transcribe_local(file: UploadFile = File(...)):
    if whisper_model is None:
        raise HTTPException(status_code=500, detail="Whisper not loaded")
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    try:
        segments, _ = whisper_model.transcribe(tmp_path, beam_size=WHISPER_BEAM, vad_filter=True)
        text = "".join(seg.text for seg in segments).strip()
        return {"text": text}
    finally:
        os.remove(tmp_path)

# ------------------ PDF SPLIT ------------------
@app.post("/convert/pdf-split")
def split_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    pages: str = Form(...)
):
    if not pages.strip():
        raise HTTPException(status_code=400, detail="Pages are required")

    temp_dir = f"temp_{uuid.uuid4()}"
    os.makedirs(temp_dir, exist_ok=True)

    input_path = os.path.join(temp_dir, file.filename)
    output_path = os.path.join(temp_dir, "split.pdf")

    try:
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        reader = PdfReader(input_path)
        writer = PdfWriter()

        selected_pages = set()
        for part in pages.split(","):
            part = part.strip()
            if not part:
                continue
            if "-" in part:
                start, end = part.split("-")
                for i in range(int(start), int(end) + 1):
                    selected_pages.add(i)
            else:
                selected_pages.add(int(part))

        for page_num in sorted(selected_pages):
            if 1 <= page_num <= len(reader.pages):
                writer.add_page(reader.pages[page_num - 1])

        if len(writer.pages) == 0:
            raise HTTPException(status_code=400, detail="No valid pages selected")

        with open(output_path, "wb") as f:
            writer.write(f)

        background_tasks.add_task(shutil.rmtree, temp_dir, ignore_errors=True)

        return FileResponse(output_path, filename="split.pdf", media_type="application/pdf")

    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(e))

# ------------------ PDF LOCK ------------------
@app.post("/convert/pdf-lock")
async def lock_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    password: str = Form(...)
):
    output_path = f"locked_{uuid.uuid4()}.pdf"
    try:
        reader = PdfReader(file.file)
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
        writer.encrypt(password)
        with open(output_path, "wb") as f:
            writer.write(f)
        background_tasks.add_task(os.remove, output_path)
        return FileResponse(output_path, filename="locked.pdf", media_type="application/pdf")
    except Exception as e:
        try:
            if os.path.exists(output_path):
                os.remove(output_path)
        except:
            pass
        raise HTTPException(status_code=500, detail=str(e))

# ------------------ PDF UNLOCK ------------------
@app.post("/convert/pdf-unlock")
async def unlock_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    password: str = Form(...)
):
    output_path = f"unlocked_{uuid.uuid4()}.pdf"
    try:
        reader = PdfReader(file.file)
        if reader.is_encrypted:
            ok = reader.decrypt(password)
            if ok == 0:
                raise HTTPException(status_code=400, detail="Wrong password or corrupted PDF")
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
        with open(output_path, "wb") as f:
            writer.write(f)
        background_tasks.add_task(os.remove, output_path)
        return FileResponse(output_path, filename="unlocked.pdf", media_type="application/pdf")
    except HTTPException:
        try:
            if os.path.exists(output_path):
                os.remove(output_path)
        except:
            pass
        raise
    except Exception:
        try:
            if os.path.exists(output_path):
                os.remove(output_path)
        except:
            pass
        raise HTTPException(status_code=400, detail="Wrong password or corrupted PDF")

# ------------------ PDF TO TEXT ------------------
@app.post("/convert/pdf-to-text")
async def pdf_to_text(file: UploadFile = File(...)):
    try:
        pdf_bytes = await file.read()
        reader = PdfReader(io.BytesIO(pdf_bytes))
        extracted_text = []
        for page in reader.pages:
            extracted_text.append(page.extract_text() or "")
        return {"text": "\n".join(extracted_text).strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ------------------ PDF MERGE ------------------
@app.post("/convert/pdf-merge")
async def pdf_merge(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...)
):
    if not files or len(files) < 2:
        raise HTTPException(status_code=400, detail="Please upload at least 2 PDF files")

    temp_dir = f"temp_merge_{uuid.uuid4()}"
    os.makedirs(temp_dir, exist_ok=True)

    merger = PdfMerger()
    output_path = os.path.join(temp_dir, "merged.pdf")

    try:
        for f in files:
            if f.content_type != "application/pdf":
                raise HTTPException(status_code=400, detail=f"{f.filename} is not a PDF")

            file_path = os.path.join(temp_dir, f"{uuid.uuid4()}_{f.filename}")
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(f.file, buffer)
            merger.append(file_path)

        with open(output_path, "wb") as out:
            merger.write(out)

        merger.close()
        background_tasks.add_task(shutil.rmtree, temp_dir, ignore_errors=True)

        return FileResponse(output_path, filename="merged.pdf", media_type="application/pdf")

    except HTTPException:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(e))

# ------------------ PDF TO WORD ------------------
@app.post("/convert/pdf-to-word")
async def pdf_to_word(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Please upload a valid PDF file")

    temp_dir = f"temp_pdf2word_{uuid.uuid4()}"
    os.makedirs(temp_dir, exist_ok=True)

    input_pdf_path = os.path.join(temp_dir, file.filename)
    output_docx_path = os.path.join(temp_dir, "converted.docx")

    try:
        with open(input_pdf_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        cv = Converter(input_pdf_path)
        cv.convert(output_docx_path, start=0, end=None)
        cv.close()

        background_tasks.add_task(shutil.rmtree, temp_dir, ignore_errors=True)
        return FileResponse(
            output_docx_path,
            filename="converted.docx",
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(e))

# ------------------------ AI MOM (Gemini) ------------------------
@app.post("/ai/mom-generator")
async def ai_mom_generator(
    transcript: Optional[str] = Form(None),
    video: Optional[UploadFile] = File(None),
    image: Optional[UploadFile] = File(None),
):
    if not (transcript or video or image):
        raise HTTPException(status_code=400, detail="Missing input")

    prompt = "Convert the following into a clean corporate MOM with Headers: TITLE, AGENDA, SUMMARY, DECISIONS, ACTION ITEMS."
    parts = [prompt]
    if transcript: parts.append(f"Transcript: {transcript}")
    
    uploaded_files = []
    try:
        if image: 
            img = _upload_to_gemini(image); parts.append(img); uploaded_files.append(img)
        if video: 
            vid = _upload_to_gemini(video); parts.append(vid); uploaded_files.append(vid)

        model = pick_gemini_model()
        # Increased timeout to 120s for large transcripts
        resp = await asyncio.wait_for(asyncio.to_thread(model.generate_content, parts), timeout=120)
        return {"mom": resp.text}
    finally:
        for f in uploaded_files: genai.delete_file(f.name)

# ------------------------ AI Models Catalog (debug) ------------------------
@app.get("/ai/models")
def ai_models():
    try:
        models = [
            m.name
            for m in genai.list_models()
            if "generateContent" in getattr(m, "supported_generation_methods", [])
        ]
        return {"models": models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
