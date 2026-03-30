# 📁 My Applications – PDF & Image Tools Suite

My Applications is a full‑stack web application that provides a unified platform for multiple productivity tools related to PDF, Image, and Document processing.

The project focuses on integrating commonly used utilities into a single, user‑friendly interface with reliable backend APIs.

---

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
- Image to PDF  
- PDF to Image  
- Image Compressor  
- Image Format Converter  
- Image to Text (OCR)  
- Word to PDF  
- PDF to Word  

### 🔸 MOM & Utility Tools
- Automatic Meeting MOM (Minutes of Meeting) Generator  
- Audio / Video to Text  
- PPT to Excel  
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
- JWT Authentication (python‑jose, bcrypt)  

### Frontend
- React  
- Vite  
- JavaScript  
- CSS  
- REST API integration with FastAPI  

---

## ▶️ Run Backend Locally

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
