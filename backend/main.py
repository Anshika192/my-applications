
from fastapi import FastAPI, Depends, HTTPException, File, UploadFile, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List, Optional
import os, io, uuid, shutil, asyncio, html
import google.generativeai as genai

from PyPDF2 import PdfMerger, PdfReader, PdfWriter
from pdf2docx import Converter
from pptx import Presentation
import pandas as pd

import models, schemas, database
from routers.pdf_to_image import router as pdf_image_router
from routers.auth import router as auth_router
from routers.user_data import router as user_data_router
import tempfile
from pathlib import Path
from faster_whisper import WhisperModel



# ---------------- Gemini config + model picker ----------------
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)
if not GEMINI_API_KEY:
    print("[WARN] GEMINI_API_KEY not set. /ai/mom-generator will fail until configured.")


# Whisper config (CPU on Render free)
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")   # tiny | base | small | medium (bigger = better but slower)
WHISPER_COMPUTE = os.getenv("WHISPER_COMPUTE", "cpu")  # keep "cpu" on Render free
WHISPER_BEAM = int(os.getenv("WHISPER_BEAM", "1"))     # 1 for speed on free tier

# Load Whisper model once
whisper_model: Optional[WhisperModel] = None
try:
    whisper_model = WhisperModel(WHISPER_MODEL, device=WHISPER_COMPUTE, compute_type="int8")
    print(f"[Whisper] Loaded model='{WHISPER_MODEL}' device='{WHISPER_COMPUTE}'")
except Exception as e:
    whisper_model = None
    print(f"[WARN] Faster-Whisper init failed: {e}")


def pick_gemini_model():
    """
    Prefer 2.5 Flash, else fallback to other available models.
    You can override with env: GEMINI_MODEL="models/gemini-2.5-flash"
    """
    forced = os.getenv("GEMINI_MODEL")
    if forced:
        try:
            return genai.GenerativeModel(forced)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Forced model '{forced}' failed: {e}")

    preferred = [
        "models/gemini-2.5-flash",
        "models/gemini-2.5-pro",
        "models/gemini-2.0-flash",
        "models/gemini-2.0-flash-001",
        "models/gemini-flash-latest",
        "models/gemini-pro-latest",
    ]
    try:
        available = [
            m.name for m in genai.list_models()
            if "generateContent" in getattr(m, "supported_generation_methods", [])
        ]
    except Exception:
        available = []

    for name in preferred:
        if not available or name in available:
            try: return genai.GenerativeModel(name)
            except Exception: continue

    for name in available:
        try: return genai.GenerativeModel(name)
        except Exception: continue

    raise HTTPException(status_code=500, detail="No suitable Gemini model available for generateContent.")


def _upload_to_gemini(upload: UploadFile):
    """
    Save UploadFile to a temp path and upload to Gemini File API.
    Returns the uploaded file handle (contains .name / .uri).
    """
    suffix = Path(upload.filename or "").suffix or ""
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        upload.file.seek(0)
        shutil.copyfileobj(upload.file, tmp)
        tmp_path = tmp.name
    try:
        gfile = genai.upload_file(path=tmp_path, mime_type=upload.content_type or None)
        return gfile
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass
        
        
# ------------------------ FastAPI App ------------------------
app = FastAPI(
    title="My Applications - MOM API",
    version="0.1.0",
    description="Classic MOM + AI MOM (Gemini) + Local Whisper transcription",
)

# ---------------- app + mounts ----------------
for d in ["uploads", "output", "temp_uploads", "temp_mom"]:
    os.makedirs(d, exist_ok=True)

app = FastAPI()

app.mount("/uploads",      StaticFiles(directory="uploads",      check_dir=False), name="uploads")
app.mount("/output",       StaticFiles(directory="output",       check_dir=False), name="output")
app.mount("/temp_uploads", StaticFiles(directory="temp_uploads", check_dir=False), name="temp_uploads")
app.mount("/temp_mom",     StaticFiles(directory="temp_mom",     check_dir=False), name="temp_mom")

models.Base.metadata.create_all(bind=database.engine)

app.include_router(pdf_image_router)
app.include_router(auth_router)
app.include_router(user_data_router)

# ---------------- CORS ----------------

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    # (optional) apna fixed prod domain agar hai to yahan add karo:
    # "https://my-applications-mocha.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https://.*\.vercel\.app$",  # ✅ ALL Vercel previews
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


# COEP-friendly: add CORP on every response
@app.middleware("http")
async def add_corp_header(request, call_next):
    resp = await call_next(request)
    resp.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
    return resp

# (Optional debug) Origin log
@app.middleware("http")
async def log_origin(request, call_next):
    origin = request.headers.get("origin")
    print(f"[CORS] Origin: {origin}")
    return await call_next(request)

# ---- Rest of setup AFTER middleware ----
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

# ---------------- Health + basic routes ----------------
@app.get("/health")
def health():
    return {"status": "ok"}

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
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured on server.")

    # At least one input must be present
    if not (transcript and transcript.strip()) and not video and not image:
        raise HTTPException(status_code=400, detail="Provide transcript or upload video/image")

    # Size guards (tune for your infra)
    if getattr(video, "size", None) and video.size > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Video too large (>25MB)")
    if getattr(image, "size", None) and image.size > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image too large (>10MB)")

    base_prompt = """
You are an expert corporate assistant. Convert the following inputs into a clean, structured Minutes of Meeting (MOM).
Be concise and factual. If both media and transcript are provided, use transcript as primary and media as context.

STRICT FORMAT (use these exact headers):
MEETING TITLE:
AGENDA:
SUMMARY:
KEY POINTS:
DECISIONS:
RISKS:
ACTION ITEMS (with owner & deadline):

Rules:
- Use bullet points where appropriate
- Clear owners and explicit dates
- No extra commentary outside these sections
""".strip()

    parts: List = [base_prompt]

    if transcript and transcript.strip():
        parts.append(f'Transcript:\n"""{transcript.strip()}"""')

    # Upload media to Gemini File API and attach
    uploaded = []
    try:
        if image:
            gimg = _upload_to_gemini(image)
            uploaded.append(gimg)
            parts.append(gimg)
        if video:
            gvid = _upload_to_gemini(video)
            uploaded.append(gvid)
            parts.append(gvid)

        model = pick_gemini_model()
        loop = asyncio.get_running_loop()
        try:
            resp = await asyncio.wait_for(
                loop.run_in_executor(None, model.generate_content, parts),
                timeout=60,  # media + generation
            )
        except asyncio.TimeoutError:
            raise HTTPException(status_code=504, detail="AI generation timed out. Try again.")

        text = (getattr(resp, "text", None) or "").strip()
        text = html.unescape(text)
        if not text:
            raise HTTPException(status_code=502, detail="AI returned empty response")

        return {"mom": text}

    finally:
        # Clean up Gemini storage (quota hygiene)
        for f in uploaded:
            try:
                genai.delete_file(f.name)
            except Exception:
                pass

# ------------------------ Local Whisper Transcription ------------------------
@app.post("/transcribe/local")
async def transcribe_local(file: UploadFile = File(...), language: Optional[str] = Form(None)):
    """
    Accepts ~5-min audio chunk (mp3/m4a/wav) and returns text using local faster-whisper.
    No external API key needed.
    """
    if whisper_model is None:
        raise HTTPException(status_code=500, detail="Local Whisper model not initialized")

    # Save chunk to temp
    suffix = os.path.splitext(file.filename or "chunk.mp3")[1] or ".mp3"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        segments, info = whisper_model.transcribe(
            tmp_path,
            beam_size=WHISPER_BEAM,
            language=language,        # e.g., "en" | "hi" (optional)
            vad_filter=True,
            without_timestamps=True,  # we just need plain text
        )
        text = "".join(seg.text for seg in segments).strip()
        if not text:
            raise HTTPException(status_code=502, detail="Whisper produced empty text")
        return {"text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass

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
