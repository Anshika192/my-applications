from fastapi import FastAPI, Depends, HTTPException, File, UploadFile, BackgroundTasks, Form, Query, Body, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List, Optional
import os, io, uuid, shutil, asyncio, tempfile, wave, struct, time
from pathlib import Path
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func as sa_func      
from sqlalchemy import func, and_ , desc 
from routers.auth import get_current_user
from routers.image_toolkit import router as image_toolkit_router
        
import google.generativeai as genai
from faster_whisper import WhisperModel
from PyPDF2 import PdfMerger, PdfReader, PdfWriter
from pdf2docx import Converter
from pptx import Presentation  
import pandas as pd
from jose import JWTError, jwt
from datetime import datetime, timedelta, date
from datetime import datetime as dt, timedelta, date, time as dtime
from pydantic import BaseModel

import models, schemas, database
from routers.pdf_to_image import router as pdf_image_router
from routers.auth import router as auth_router
from routers.user_data import router as user_data_router
from utils.security import SECRET_KEY, ALGORITHM
from routers.pdf_toolkit import router as pdf_toolkit_router
from routers.image_toolkit import router as image_toolkit_router
from routers.bg_remover import router as bg_remover_router

from passlib.context import CryptContext

from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.cors import CORSMiddleware

def get_current_admin(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        role = payload.get("role")
        if role not in ("admin", "superadmin", "superuser"):
            raise HTTPException(status_code=403, detail="Forbidden")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception:
        # Final guard so we never leak a 500 from auth
        raise HTTPException(status_code=401, detail="Invalid token")

# Bcrypt setup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)

def create_audit_log(db, admin_email, action, target):
    new_log = models.AuditLog(
        admin_email=admin_email,
        action=action,
        target=target
    )
    db.add(new_log)
    db.commit()
    

def _enrich_suggestions_for_admin(db, rows: list[models.UserSuggestion]):
    if not rows:
        return []

    # Like counts per suggestion
    ids = [r.id for r in rows]
    counts = dict(
        db.query(
            models.UserSuggestionLike.suggestion_id,
            sa_func.count(models.UserSuggestionLike.id)
        )
        .filter(models.UserSuggestionLike.suggestion_id.in_(ids))
        .group_by(models.UserSuggestionLike.suggestion_id)
        .all()
    )

    # Build a users cache once (user_id -> (name, email))
    user_ids = list({r.user_id for r in rows})
    users_map = {}
    if user_ids:
        # Query only what we need to avoid pulling whole User model if heavy
        user_rows = (
            db.query(models.User.id, models.User.name, models.User.email)
              .filter(models.User.id.in_(user_ids))
              .all()
        )
        users_map = {uid: (name, email) for (uid, name, email) in user_rows}

    enriched = []
    for r in rows:
        uname, uemail = users_map.get(r.user_id, (None, None))

        enriched.append({
            "id": r.id,
            "tool_idea": r.tool_idea,
            "note": r.note,
            "created_at": r.created_at,
            "likes": int(counts.get(r.id, 0)),
            "liked_by_me": False,

            # Admin workflow
            "status": r.status or "pending",
            "admin_note": r.admin_note,

            # NEW: author info
            "user_name": uname,
            "user_email": uemail,
        })

    enriched.sort(key=lambda x: (x["likes"], x["created_at"]), reverse=True)
    return enriched


class ToolCreateSchema(BaseModel):
    name: str
    category: str | None = None
    status: str = "active"

class AdminSuggestionStatusUpdate(BaseModel):
    status: str  # 'approved' | 'working' | 'rejected' | 'pending'
    admin_note: Optional[str] = None

VALID_STATUSES = {"pending", "approved", "working", "rejected"}

# ------------------------ Environment Variables ------------------------
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "tiny.en")
WHISPER_BEAM = int(os.getenv("WHISPER_BEAM", "1"))
WHISPER_COMPUTE = os.getenv("WHISPER_COMPUTE", "cpu")  # "cpu" or "cuda"

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("[WARN] GEMINI_API_KEY not set. Gemini endpoints will return 500 unless provided.")

# ------------------------ FastAPI App ------------------------
app = FastAPI(
    title="My Applications API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# ---- CORS registered EARLY ----
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    # "https://my-applications-mocha.vercel.app",  # optional fixed prod
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# COEP-friendly: CORP on all responses
# COEP-friendly: CORP + CORS headers on ALL responses (incl. 401/500)
@app.middleware("http")
async def cors_and_corp(request, call_next):
    print("[CORS] Origin:", request.headers.get("origin"))
    resp = await call_next(request)

    # Add CORS for every response so browser doesn't hide 401/500 as CORS
    origin = request.headers.get("origin") or "*"
    resp.headers["Access-Control-Allow-Origin"] = origin
    resp.headers["Access-Control-Allow-Headers"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "*"
    resp.headers["Vary"] = "Origin"

    # COEP-friendly header
    resp.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
    return resp

# ------------------------ Whisper Init (single, low-power CPU safe) ------------------------
whisper_model: Optional[WhisperModel] = None
try:
    whisper_kwargs = {"device": WHISPER_COMPUTE, "compute_type": "int8"}
    # On CPU, use conservative threads/workers to reduce memory/locks
    if WHISPER_COMPUTE.lower() == "cpu":
        whisper_kwargs.update(cpu_threads=1, num_workers=1)
    whisper_model = WhisperModel(WHISPER_MODEL, **whisper_kwargs)
    print(f"[Whisper] Loaded model='{WHISPER_MODEL}' device='{WHISPER_COMPUTE}'")
except Exception as e:
    whisper_model = None
    print(f"[WARN] Faster-Whisper init failed: {e}")

# ------------------------ Helpers ------------------------
def _write_silence_wav(path: str, duration_sec: float = 0.5, rate: int = 16000) -> None:
    """Write a silent mono 16-bit PCM WAV file."""
    nframes = int(duration_sec * rate)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)  # 16-bit
        w.setframerate(rate)
        # Little-endian 16-bit zero samples
        w.writeframes(struct.pack("<h", 0) * nframes)

def _safe_remove(path: str, retries: int = 10, delay: float = 0.2) -> None:
    """Try to remove a file with retries to handle Windows transient locks."""
    for _ in range(retries):
        try:
            if os.path.exists(path):
                os.remove(path)
            return
        except PermissionError:
            time.sleep(delay)
    # Last attempt; if it still fails, log and continue
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception as e:
        print(f"[WARN] Could not remove temp file '{path}': {e}")

# ------------------------ Startup: Whisper warm-up ------------------------
@app.on_event("startup")
async def preload_whisper():
    if whisper_model is None:
        return

    # Create a real temp file and immediately close OS handle (Windows-safe)
    fd, tmp_path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    try:
        _write_silence_wav(tmp_path, 0.5)
        # Run warm-up and fully materialize segments to ensure file handle is released
        segments, _ = whisper_model.transcribe(tmp_path, beam_size=WHISPER_BEAM)
        _ = "".join(seg.text for seg in segments)
        print("[Whisper preload] Warm-up done")
    finally:
        _safe_remove(tmp_path)

# ------------------------ Mounts, DB, Routers ------------------------
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
app.include_router(pdf_toolkit_router)
app.include_router(image_toolkit_router)
app.include_router(image_toolkit_router)
app.include_router(bg_remover_router)

get_db = database.get_db

# ------------------------ Gemini helpers ------------------------
def pick_gemini_model():
    model_name = os.getenv("GEMINI_MODEL", "models/gemini-2.5-flash")
    return genai.GenerativeModel(model_name)

def _upload_to_gemini(upload: UploadFile):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured")
    suffix = Path(upload.filename or "").suffix
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(upload.file, tmp)
        tmp_path = tmp.name
    try:
        return genai.upload_file(path=tmp_path)
    finally:
        _safe_remove(tmp_path)

# ------------------------ Routes ------------------------
@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"status": "ok", "service": "my-applications"}

@app.get("/applications")
def read_applications(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    rows = db.query(models.Application).filter(models.Application.status == "active").offset(skip).limit(limit).all()
    # Return only ACTUAL columns that exist on your model/table
    out = []
    for r in rows:
        out.append({
            "id": r.id,
            "name": getattr(r, "name", None),
            "category": getattr(r, "category", None),
            "status": getattr(r, "status", None),
            "created_at": getattr(r, "created_at", None),
        })
    return out

@app.post("/applications", response_model=schemas.ApplicationRead)
def create_application(application: schemas.ApplicationCreate, db: Session = Depends(get_db)):
    db_application = models.Application(**application.dict())
    db.add(db_application)
    db.commit()
    db.refresh(db_application)
    return db_application

@app.post("/transcribe/local")
async def transcribe_local(file: UploadFile = File(...)):
    if whisper_model is None:
        raise HTTPException(status_code=500, detail="Whisper not loaded")

    # Save to a real temp file (Windows-safe) then transcribe
    fd, tmp_path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    try:
        with open(tmp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        segments, _ = whisper_model.transcribe(tmp_path, beam_size=WHISPER_BEAM, vad_filter=True)
        text = "".join(seg.text for seg in segments).strip()
        return {"text": text}
    finally:
        _safe_remove(tmp_path)

# ------------------ PDF SPLIT ------------------
@app.post("/convert/pdf-split")
def split_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    pages: str = Form(...),
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

        selected_pages: set[int] = set()
        for part in pages.split(","):
            part = part.strip()
            if not part:
                continue
            try:
                if "-" in part:
                    start_s, end_s = part.split("-")
                    start, end = int(start_s), int(end_s)
                    if start > end:
                        start, end = end, start
                    for i in range(start, end + 1):
                        selected_pages.add(i)
                else:
                    selected_pages.add(int(part))
            except ValueError:
                # Ignore invalid specs gracefully
                continue

        for page_num in sorted(selected_pages):
            if 1 <= page_num <= len(reader.pages):
                writer.add_page(reader.pages[page_num - 1])

        if len(writer.pages) == 0:
            raise HTTPException(status_code=400, detail="No valid pages selected")

        with open(output_path, "wb") as f:
            writer.write(f)

        background_tasks.add_task(shutil.rmtree, temp_dir, ignore_errors=True)
        return FileResponse(output_path, filename="split.pdf", media_type="application/pdf")

    except HTTPException:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(e))

# ------------------ PDF LOCK ------------------
@app.post("/convert/pdf-lock")
async def lock_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    password: str = Form(...),
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
        background_tasks.add_task(_safe_remove, output_path)
        return FileResponse(output_path, filename="locked.pdf", media_type="application/pdf")
    except Exception as e:
        _safe_remove(output_path)
        raise HTTPException(status_code=500, detail=str(e))

# ------------------ PDF UNLOCK ------------------
@app.post("/convert/pdf-unlock")
async def unlock_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    password: str = Form(...),
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
        background_tasks.add_task(_safe_remove, output_path)
        return FileResponse(output_path, filename="unlocked.pdf", media_type="application/pdf")
    except HTTPException:
        _safe_remove(output_path)
        raise
    except Exception:
        _safe_remove(output_path)
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
    files: List[UploadFile] = File(...),
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
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured")

    prompt = "Convert the following into a clean corporate MOM with Headers: TITLE, AGENDA, SUMMARY, DECISIONS, ACTION ITEMS."
    parts = [prompt]
    if transcript:
        parts.append(f"Transcript: {transcript}")

    uploaded_files = []
    try:
        if image:
            img = _upload_to_gemini(image)
            parts.append(img)
            uploaded_files.append(img)
        if video:
            vid = _upload_to_gemini(video)
            parts.append(vid)
            uploaded_files.append(vid)

        model = pick_gemini_model()
        # Increased timeout to 120s for large transcripts
        resp = await asyncio.wait_for(asyncio.to_thread(model.generate_content, parts), timeout=120)
        return {"mom": resp.text}
    finally:
        # Best-effort cleanup
        for f in uploaded_files:
            try:
                genai.delete_file(f.name)
            except Exception as e:
                print(f"[WARN] Failed to delete uploaded Gemini file {getattr(f, 'name', 'unknown')}: {e}")

# ------------------------ AI Models Catalog (debug) ------------------------
@app.get("/ai/models")
def ai_models():
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured")
    try:
        models_list = [
            m.name
            for m in genai.list_models()
            if "generateContent" in getattr(m, "supported_generation_methods", [])
        ]
        return {"models": models_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
 
# Login Route
@app.post("/api/admin/login")
def admin_login(payload: dict, db: Session = Depends(get_db)):
    email = payload.get("email")
    password = payload.get("password")
    
    # Database se admin ko dhoondo
    admin = db.query(models.AdminUser).filter(models.AdminUser.email == email).first()
    
    # Password check (Abhi simple text match, baad mein hash verify karenge)
    if not admin or not verify_password (password, admin.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid Credentials")
    
    # Token generate karein
    access_token = jwt.encode({
        "sub": admin.email, 
        "role": admin.role,
        "exp": datetime.utcnow() + timedelta(hours=24)
    }, SECRET_KEY, algorithm=ALGORITHM)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "admin": {"id": admin.id, "email": admin.email, "role": admin.role}
    }    


@app.get("/api/admin/feedbacks")
def get_all_feedbacks(db: Session = Depends(get_db)):
    # Saare feedbacks database se uthao
    feedbacks = db.query(models.Feedback).order_by(models.Feedback.created_at.desc()).all()
    return feedbacks   

@app.get("/api/admin/stats")
def get_admin_stats(db: Session = Depends(get_db)):
    total = db.query(models.Feedback).count()
    pending = db.query(models.Feedback).filter(models.Feedback.status == "pending").count()
    
    # Calculate Real Average Rating
    all_ratings = db.query(models.Feedback.rating).all()
    if all_ratings:
        avg = sum([r[0] for r in all_ratings]) / len(all_ratings)
    else:
        avg = 0
        
    return {
        "total": total, 
        "pending": pending, 
        "avg_rating": round(avg, 1)
    }

# Feedback status update karne ke liye
@app.patch("/api/admin/feedbacks/{fb_id}")
def update_feedback_status(
    fb_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    admin = Depends(get_current_admin)   # ← get admin email/role from token
):
    fb = db.query(models.Feedback).filter(models.Feedback.id == fb_id).first()
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")

    old_status = fb.status or "pending"
    new_status = (payload.get("status") or "reviewed").strip().lower()

    fb.status = new_status
    db.commit()

    # 🔹 Log the action
    try:
        admin_email = admin.get("sub") or admin.get("email") or "unknown@admin"
        # Example target includes ID, old → new and a tiny context (tool, category)
        target = f"Feedback ID: {fb_id} [{old_status} -> {new_status}] | tool={fb.tool_name or '-'} | category={fb.category or '-'}"
        create_audit_log(db, admin_email, "UPDATE_FEEDBACK_STATUS", target)
    except Exception as e:
        # Best‑effort logging; don’t break the API if logging fails
        print("[WARN] audit log failed:", e)

    return {"status": "updated", "old": old_status, "new": new_status}


# Feedback delete karne ke liye
@app.delete("/api/admin/feedbacks/{id}")
def delete_feedback(id: int, db: Session = Depends(get_db)):
    fb = db.query(models.Feedback).filter(models.Feedback.id == id).first()
    if fb:
        # 🚩 LOGGING YAHAN HOTI HAI
        create_audit_log(db, "anshika@admin.com", "DELETE_FEEDBACK", f"Feedback ID: {id}")
        
        db.delete(fb)
        db.commit()
        return {"message": "Deleted"}

# --- User Feedback Submission Route ---
@app.post("/api/user/feedback")
def submit_feedback(payload: dict, db: Session = Depends(get_db)):
    try:
        # Naya feedback object banayein
        new_fb = models.Feedback(
            tool_name=payload.get("tool_name", "General"),
            category=payload.get("category", "Feedback"),
            rating=payload.get("rating", 5),
            message=payload.get("message", ""),
            status="pending" # Default status jab user bhejta hai
        )
        db.add(new_fb)
        db.commit() # Database mein save karein
        db.refresh(new_fb)
        return {"message": "Feedback submitted successfully!", "id": new_fb.id}
    except Exception as e:
        db.rollback()
        print(f"❌ Error saving feedback: {e}")
        raise HTTPException(status_code=500, detail="Database Error")
    
# Analytics Endpoint
@app.get("/api/admin/analytics")
def get_analytics(db: Session = Depends(get_db)):
    # Example data: Tool usage distribution
    data = {
        "labels": ["PDF Tools", "AI MOM", "Image Tools"],
        "values": [45, 30, 25]
    }
    return data

# Audit Logs Endpoint
@app.get("/api/admin/logs")
def get_logs(db: Session = Depends(get_db)):
    return db.query(models.AuditLog).order_by(models.AuditLog.timestamp.desc()).limit(50).all()   

@app.get("/api/admin/users")
def get_admin_users(db: Session = Depends(get_db)):
    return db.query(models.User).all()

# 2. Audit Logs ko dekhne ke liye

@app.get("/api/admin/logs")
def get_admin_logs(
    db: Session = Depends(get_db),
    q: Optional[str] = None,
    action: Optional[str] = None,
    frm: Optional[str] = None,  # ISO date string: "2026-03-10"
    to: Optional[str] = None,
    offset: int = 0,
    limit: int = 100
):
    qy = db.query(models.AuditLog)

    if q:
        like = f"%{q}%"
        qy = qy.filter(
            (models.AuditLog.admin_email.ilike(like)) |
            (models.AuditLog.action.ilike(like)) |
            (models.AuditLog.target.ilike(like))
        )
    if action:
        qy = qy.filter(models.AuditLog.action == action)

    if frm:
        try:
            start = dt.fromisoformat(frm)
            qy = qy.filter(models.AuditLog.timestamp >= start)
        except Exception:
            pass
    if to:
        try:
            end = dt.fromisoformat(to)
            qy = qy.filter(models.AuditLog.timestamp <= end)
        except Exception:
            pass

    rows = (
        qy.order_by(models.AuditLog.timestamp.desc())
          .offset(max(0, offset))
          .limit(min(500, limit))
          .all()
    )
    return rows


@app.get("/api/admin/dashboard-stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    try:
        # ---- Total users ----
        total_users = db.query(models.User).count()

        # ---- Daily uses: last 24 hours rolling (UTC safe) ----
        now = dt.utcnow()
        last24 = now - timedelta(hours=24)
        daily_uses = (
            db.query(models.UserToolUsage)
              .filter(models.UserToolUsage.updated_at >= last24)
              .count()
        )

        # ---- Total tools (from Application master) ----
        total_tools = db.query(models.Application).count()

        # ---- Top-used tools (lifetime) ----
        # SUM(count) per tab, order DESC and take top 5
        top_rows = (
            db.query(
                models.UserToolUsage.tab,
                func.sum(models.UserToolUsage.count).label("total")
            )
            .group_by(models.UserToolUsage.tab)
            .order_by(desc("total"))
            .limit(5)
            .all()
        )
        # [{"tool": "pdf-to-text", "count": 33}, ...]
        top_tools = [{"tool": r[0], "count": int(r[1] or 0)} for r in top_rows]

        # ---- Total feedbacks ----
        total_feedbacks = db.query(models.Feedback).count()

        return {
            "total_users": int(total_users or 0),
            "daily_uses": int(daily_uses or 0),
            "active_tools": int(len(top_tools)),  # <-- "Most Used Tools (top 5)" ka count
            "total_tools": int(total_tools or 0),
            "total_feedbacks": int(total_feedbacks or 0),
            "top_tools": top_tools,               # <-- FE ko list bhi de rahe hain (modal me use kar sakti ho)
            "as_of": now.isoformat() + "Z",
        }
    except Exception as e:
        print(f"[dashboard-stats] error: {e}")
        return {
            "total_users": 0,
            "daily_uses": 0,
            "active_tools": 0,
            "total_tools": 0,
            "total_feedbacks": 0,
            "top_tools": [],
            "as_of": dt.utcnow().isoformat() + "Z",
        }
        
@app.get("/api/admin/analytics/tools")
def get_tool_analytics(db: Session = Depends(get_db)):
    # Top tools for Bar Chart
    usage = db.query(models.UserToolUsage.tab, func.sum(models.UserToolUsage.count)).group_by(models.UserToolUsage.tab).all()
    return [{"tool": r[0], "count": r[1]} for r in usage]

# ------------------------ Suggestions (public) ------------------------
@app.get("/suggestions", response_model=List[schemas.SuggestionRead])
def list_suggestions(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    return (
        db.query(models.Suggestion)
        .order_by(models.Suggestion.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@app.post("/suggestions", response_model=schemas.SuggestionRead)
def create_suggestion(payload: schemas.SuggestionCreate, db: Session = Depends(get_db)):
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")
    row = models.Suggestion(text=text)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

@app.post("/suggestions/{sid}/vote", response_model=schemas.SuggestionRead)
def vote_suggestion(
    sid: int,
    vote_type: str = Query(..., regex="^(up|down)$"),
    user_id: str = Query(...),
    db: Session = Depends(get_db)
):
    sug = db.query(models.Suggestion).filter(models.Suggestion.id == sid).first()
    if not sug:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    vote = (
        db.query(models.Vote)
        .filter(
            models.Vote.suggestion_id == sid,
            models.Vote.user_id == user_id
        )
        .first()
    )

    # Naya vote
    if not vote:
        db.add(models.Vote(suggestion_id=sid, user_id=user_id, vote_type=vote_type))
        if vote_type == "up":
            sug.upvotes = (sug.upvotes or 0) + 1
        else:
            sug.downvotes = (sug.downvotes or 0) + 1
        db.commit()
        db.refresh(sug)
        return sug

    # Same type -> toggle off
    if vote.vote_type == vote_type:
        if vote_type == "up" and (sug.upvotes or 0) > 0:
            sug.upvotes -= 1
        if vote_type == "down" and (sug.downvotes or 0) > 0:
            sug.downvotes -= 1
        db.delete(vote)
        db.commit()
        db.refresh(sug)
        return sug

    # Opposite type -> switch
    if vote.vote_type == "up":
        if (sug.upvotes or 0) > 0:
            sug.upvotes -= 1
        sug.downvotes = (sug.downvotes or 0) + 1
    else:
        if (sug.downvotes or 0) > 0:
            sug.downvotes -= 1
        sug.upvotes = (sug.upvotes or 0) + 1

    vote.vote_type = vote_type
    db.commit()
    db.refresh(sug)
    return sug

@app.get("/api/admin/suggestions", response_model=List[schemas.SuggestionRead])
def admin_suggestions(
    db: Session = Depends(get_db),
    q: str | None = None
):
    qy = db.query(models.Suggestion)
    if q:
        qy = qy.filter(models.Suggestion.text.ilike(f"%{q}%"))
    return qy.order_by(models.Suggestion.upvotes.desc(), models.Suggestion.created_at.desc()).all()


@app.get("/api/admin/user-suggestions", response_model=List[schemas.UserSuggestionOut])
def list_all_user_suggestions(db: Session = Depends(get_db), skip: int = 0, limit: int = 100, admin=Depends(get_current_admin)):
    rows = (
        db.query(models.UserSuggestion)
        .order_by(models.UserSuggestion.created_at.desc())
        .offset(skip)
        .limit(min(limit, 200))
        .all()
    )
    return _enrich_suggestions_for_admin(db, rows)


@app.patch("/api/admin/user-suggestions/{sid}/status")
def admin_update_user_suggestion_status(
    sid: int,
    payload: AdminSuggestionStatusUpdate = Body(...),
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin)
):
    s = db.query(models.UserSuggestion).filter(models.UserSuggestion.id == sid).first()
    if not s:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    status_norm = (payload.status or "").strip().lower()
    if status_norm not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status: {payload.status}")

    s.status = status_norm
    s.admin_note = (payload.admin_note or None)
    db.commit()
    db.refresh(s)

    # (Optional) log
    try:
        create_audit_log(db, "anshika@admin.com", "UPDATE_SUGGESTION_STATUS", f"Suggestion ID: {sid} -> {status_norm}")
    except Exception:
        pass

    # Reuse your admin list formatter so FE sees consistent shape (likes, etc.)
    return {
        "id": s.id,
        "tool_idea": s.tool_idea,
        "note": s.note,
        "created_at": s.created_at,
        "likes": db.query(models.UserSuggestionLike).filter(
            models.UserSuggestionLike.suggestion_id == sid
        ).count(),
        "liked_by_me": False,
        "status": s.status,
        "admin_note": s.admin_note,
    }

@app.get("/api/admin/analytics/overview")
def analytics_overview(db: Session = Depends(get_db)):
    total_users = db.query(models.User).count()
    total_feedbacks = db.query(models.Feedback).count()
    open_feedbacks = db.query(models.Feedback).filter(models.Feedback.status == "pending").count()
    total_suggestions = db.query(models.UserSuggestion).count()
    working_suggestions = db.query(models.UserSuggestion).filter(models.UserSuggestion.status == "working").count()
    approved_suggestions = db.query(models.UserSuggestion).filter(models.UserSuggestion.status == "approved").count()

    return {
        "total_users": total_users,
        "total_feedbacks": total_feedbacks,
        "open_feedbacks": open_feedbacks,
        "total_suggestions": total_suggestions,
        "working_suggestions": working_suggestions,
        "approved_suggestions": approved_suggestions,
    }


@app.get("/api/admin/analytics/usage-series")
def usage_series(days: int = 14, db: Session = Depends(get_db)):
    """
    Return daily counts of UserToolUsage updates for last N days.
    """
    days = max(1, min(days, 90))
    # For Postgres: date_trunc('day', updated_at)
    rows = (
        db.query(
            func.date_trunc('day', models.UserToolUsage.updated_at).label('day'),
            func.sum(models.UserToolUsage.count).label('total')
        )
        .group_by(func.date_trunc('day', models.UserToolUsage.updated_at))
        .order_by(func.date_trunc('day', models.UserToolUsage.updated_at))
        .all()
    )

    # Normalize to array of {date, total}
    return [{"date": r[0].date().isoformat(), "total": int(r[1] or 0)} for r in rows][-days:] 

@app.get("/api/admin/analytics/tools")
def get_tool_analytics(db: Session = Depends(get_db)):
    usage = db.query(models.UserToolUsage.tab, func.sum(models.UserToolUsage.count)).group_by(models.UserToolUsage.tab).all()
    return [{"tool": r[0], "count": r[1]} for r in usage]

@app.get("/api/admin/analytics/suggestions-status")
def suggestions_status(db: Session = Depends(get_db)):
    # 1) Overall counts by status
    by_status = dict(
        db.query(models.UserSuggestion.status, func.count(models.UserSuggestion.id))
          .group_by(models.UserSuggestion.status)
          .all()
    )
    # Normalize all statuses
    statuses = ["pending", "working", "approved", "rejected"]
    overall = {s: int(by_status.get(s, 0) or 0) for s in statuses}

    # 2) Daily created counts (last 14 days)
    daily = (
        db.query(
            func.date_trunc('day', models.UserSuggestion.created_at).label('day'),
            func.count(models.UserSuggestion.id).label('count')
        )
        .group_by(func.date_trunc('day', models.UserSuggestion.created_at))
        .order_by(func.date_trunc('day', models.UserSuggestion.created_at))
        .all()
    )
    series = [{"date": d[0].date().isoformat(), "count": int(d[1] or 0)} for d in daily][-14:]

    return {"overall": overall, "series": series}

@app.get("/api/admin/analytics/active-users")
def active_users(days: int = 14, db: Session = Depends(get_db)):
    days = max(1, min(days, 90))
    rows = (
        db.query(
            func.date_trunc('day', models.UserToolUsage.updated_at).label('day'),
            func.count(func.distinct(models.UserToolUsage.user_id)).label('active_users')
        )
        .group_by(func.date_trunc('day', models.UserToolUsage.updated_at))
        .order_by(func.date_trunc('day', models.UserToolUsage.updated_at))
        .all()
    )
    return [{"date": r[0].date().isoformat(), "active_users": int(r[1] or 0)} for r in rows][-days:]

@app.delete("/api/admin/user-suggestions/{sid}")
def admin_delete_suggestion(sid: int, db: Session = Depends(get_db), admin=Depends(get_current_admin)):
    row = db.query(models.UserSuggestion).filter(models.UserSuggestion.id == sid).first()

    if not row:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    db.query(models.UserSuggestionLike).filter(
        models.UserSuggestionLike.suggestion_id == sid
    ).delete()

    db.delete(row)
    db.commit()
    return {"ok": True, "deleted_id": sid}

@app.post("/api/admin/tools")
def add_tool(
    data: ToolCreateSchema,
    admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    tool = models.Application(
        name=data.name,
        category=data.category,
        status=data.status
    )
    db.add(tool)
    db.commit()
    db.refresh(tool)
    return tool

@app.delete("/api/admin/tools/{tool_id}")
def disable_tool(
    tool_id: int,
    admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    tool = db.query(models.Application).filter(models.Application.id == tool_id).first()
    if not tool:
        raise HTTPException(404, "Tool not found")

    tool.status = "disabled"
    db.commit()
    return {"success": True, "status": "disabled"}

@app.post("/api/admin/tools/{tool_id}/enable")
def enable_tool(
    tool_id: int,
    admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    tool = db.query(models.Application).filter(models.Application.id == tool_id).first()
    if not tool:
        raise HTTPException(404, "Tool not found")

    tool.status = "active"
    db.commit()
    return {"success": True, "status": "active"}

@app.get("/api/admin/tools")
def get_all_tools(admin = Depends(get_current_admin), db: Session = Depends(get_db)):
    tools = db.query(models.Application).all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "category": t.category,
            "status": t.status
        }
        for t in tools
    ]
    
@app.get("/applications/all")
def get_all_applications(db: Session = Depends(get_db)):
    rows = db.query(models.Application).all()
    return [
        {"id": r.id, "name": r.name, "status": r.status, "category": r.category}
        for r in rows
    ]  