from fastapi import FastAPI, Depends, HTTPException, File, UploadFile, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List, Optional
import os, io, uuid, shutil
import google.generativeai as genai
import asyncio


from PyPDF2 import PdfMerger, PdfReader, PdfWriter
from pdf2docx import Converter
from pptx import Presentation
import pandas as pd

import models, schemas, database
from routers.pdf_to_image import router as pdf_image_router
from routers.auth import router as auth_router
from routers.user_data import router as user_data_router

def get_supported_model():
    """
    Try a few model identifiers in order.
    Some environments require `models/` prefix,
    some have 1.5-flash-8b available, etc.
    """
    candidates = [
        "gemini-1.5-flash",
        "models/gemini-1.5-flash",
        "gemini-1.5-flash-8b",
        "models/gemini-1.5-flash-8b",
        "gemini-1.5-pro",
        "models/gemini-1.5-pro",
    ]
    last_err = None
    for name in candidates:
        try:
            return genai.GenerativeModel(name)
        except Exception as e:
            last_err = e
            continue
    # If none worked, raise a clean, actionable error
    raise HTTPException(
        status_code=500,
        detail=f"Gemini model not available. Last error: {last_err}"
    )

# --- Gemini config ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)
if not GEMINI_API_KEY:
    print("[WARN] GEMINI_API_KEY not set. /ai/mom-generator will fail until configured.")


# Create required dirs (Render's file system starts empty each deploy)
for d in ["uploads", "output", "temp_uploads", "temp_mom"]:
    os.makedirs(d, exist_ok=True)


# ------------------ app ------------------
app = FastAPI()


# Safe mounts (won't crash if dir is temporarily missing)
app.mount("/uploads",      StaticFiles(directory="uploads",      check_dir=False), name="uploads")
app.mount("/output",       StaticFiles(directory="output",       check_dir=False), name="output")
app.mount("/temp_uploads", StaticFiles(directory="temp_uploads", check_dir=False), name="temp_uploads")
app.mount("/temp_mom",     StaticFiles(directory="temp_mom",     check_dir=False), name="temp_mom")

# DB tables
models.Base.metadata.create_all(bind=database.engine)

# Routers
app.include_router(pdf_image_router)
app.include_router(auth_router)
app.include_router(user_data_router)

# CORS
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "https://my-applications-mocha.vercel.app",
    "https://minapplications-frontend.onrender.com",
    "https://my-applications-mnstsyh9g-anshika192s-projects.vercel.app",  # <-- new exact domain
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Share the DB session dependency
get_db = database.get_db

# ---- Health check (useful for Render) ----
@app.get("/health")
def health():
    return {"status": "ok"}

# ------------------ CRUD sample ------------------
@app.get("/applications", response_model=List[schemas.ApplicationRead])
def read_applications(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Application).offset(skip).limit(limit).all()

# in backend/main.py (near other routes)
@app.get("/")
def root():
    return {"status": "ok", "service": "my-applications"}

@app.post("/applications", response_model=schemas.ApplicationRead)
def create_application(application: schemas.ApplicationCreate, db: Session = Depends(get_db)):
    db_application = models.Application(**application.dict())
    db.add(db_application)
    db.commit()
    db.refresh(db_application)
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

# ------------------ MEETING MOM (demo) ------------------
@app.post("/meeting-mom")
async def generate_meeting_mom(
    video: Optional[UploadFile] = File(None),
    image: Optional[UploadFile] = File(None),
    transcript: Optional[str] = Form(None)
):
    if not video and not image and not transcript:
        raise HTTPException(status_code=400, detail="Video, image or transcript required")

    final_transcript = transcript or """
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
    {final_transcript}

    DECISIONS:
    - Release postponed by 1 week

    ACTION ITEMS:
    - Backend APIs completion (Owner: Backend Team)
    - Testing start after backend completion
    """.strip()

    return {"mom": mom_text}

# ------------------ PPT TO EXCEL ------------------
@app.post("/convert/ppt-to-excel")
async def ppt_to_excel(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if not file.filename.endswith((".ppt", ".pptx")):
        raise HTTPException(status_code=400, detail="Only PPT or PPTX files allowed")

    temp_dir = f"temp_ppt_{uuid.uuid4()}"
    os.makedirs(temp_dir, exist_ok=True)

    ppt_path = os.path.join(temp_dir, file.filename)
    excel_path = os.path.join(temp_dir, "converted.xlsx")

    try:
        with open(ppt_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        prs = Presentation(ppt_path)
        rows = []
        slide_no = 1
        for slide in prs.slides:
            for shape in slide.shapes:
                if getattr(shape, "has_text_frame", False):
                    text = shape.text.strip()
                    if text:
                        rows.append({"Slide No": slide_no, "Content": text})
            slide_no += 1

        if not rows:
            raise HTTPException(status_code=400, detail="No text found in PPT")

        df = pd.DataFrame(rows)
        df.to_excel(excel_path, index=False)

        background_tasks.add_task(shutil.rmtree, temp_dir, ignore_errors=True)
        return FileResponse(
            excel_path,
            filename="ppt_content.xlsx",
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/ai/mom-generator")
async def ai_mom_generator(transcript: str = Form(...)):
    if not os.getenv("GEMINI_API_KEY"):
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured on server.")
    if not transcript or not transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript is required")

    # Prompt (use plain '&', not HTML entity)
    prompt = f"""
You are an expert corporate assistant. Convert the following meeting transcript
into a clean, structured Minutes of Meeting (MOM). Be concise, factual, and avoid inventing details.

Transcript:
\"\"\"{transcript.strip()}\"\"\"

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

    try:
        # Auto-fallback to a supported model for your key/region
        model = get_supported_model()

        loop = asyncio.get_running_loop()
        try:
            resp = await asyncio.wait_for(
                loop.run_in_executor(None, model.generate_content, prompt),
                timeout=30,
            )
        except asyncio.TimeoutError:
            raise HTTPException(status_code=504, detail="AI generation timed out. Try again.")

        # Extract and normalize any HTML entities (&amp; → &)
        text = (getattr(resp, "text", None) or "").strip()
        text = html.unescape(text)

        if not text:
            raise HTTPException(status_code=502, detail="AI returned empty response")

        return {"mom": text}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))