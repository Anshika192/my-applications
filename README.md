

# 📁 My Applications – PDF & Image Tools Suite

This is a full‑stack web application that provides multiple productivity tools such as:
PDF operations, Image conversion, MOM (Minutes of Meeting) generator, OCR, and many more.

## 🚀 Features

### 🔸 PDF Tools
- PDF Merge  
- PDF Split  
- PDF to Image  
- PDF to Text  
- PDF Watermark  
- PDF Page Numbering  
- PDF Lock / Unlock  

### 🔸 Image & Document Tools
- Image → PDF  
- PDF → Image  
- Image Compressor  
- Image Format Converter  
- Image → Text (OCR)  
- Word → PDF  
- PDF → Word  

### 🔸 MOM & Utility Tools
- Auto Meeting MOM Generator  
- Audio/Video → Text  
- PPT → Excel  
- QR Code Generator  

---

## 🖥️ Tech Stack

### Backend
- Python  
- FastAPI  
- PostgreSQL  
- SQLAlchemy  
- PyPDF2, PyMuPDF, pdf2docx  
- OpenCV, pytesseract  
- python‑pptx  
- JWT Auth (python‑jose + bcrypt)  

### Frontend
- React  
- Vite  
- JavaScript  
- Tailwind / CSS  
- API integration with FastAPI  

---

## ▶️ Run Backend

```bash
cd backend
py -3 -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --reload


# Team discussed the progress of API-3. The backend work is delayed by 4 days because the integration tests are failing. QA is waiting for a stable build. The frontend team has completed their tasks. Deployment is expected by next Monday. Ankit will handle the remaining backend fixes and Priya will take care of documentation. Risk of further delay if API-3 issues are not resolved today.