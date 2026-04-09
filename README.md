# 📁 ToolNest – PDF & Image Tools Suite

ToolNest is a full‑stack web application that provides a unified platform for multiple productivity tools related to PDF, Image, and Document processing.

The project focuses on integrating commonly used utilities into a single, user‑friendly interface with reliable backend APIs and an administrative control panel.

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
- PDF Toolkit  

### 🔸 Image & Document Tools
- Image to PDF  
- PDF to Image  
- Image Compressor  
- Image Format Converter  
- Image to Text (OCR)  
- Word to PDF  
- PDF to Word  
- Image Toolkit (Resize, Crop, Metadata)  
- Background Remover  

### 🔸 MOM & Utility Tools
- Automatic Meeting MOM (Minutes of Meeting) Generator  
- Audio / Video to Text  
- PPT to Excel  
- QR Code Generator  

---

## 🧑‍💼 Admin Panel

The project includes a **secure Admin Panel** for managing the platform and monitoring usage.

### Admin Panel Features
- Admin authentication (JWT‑based login)
- Dashboard with platform statistics:
  - Total users
  - Tool usage metrics
  - Feedback and suggestions overview
- User management and tracking
- Feedback management with status updates
- User suggestions review and moderation
- Tool management (enable/disable tools)
- Detailed analytics (usage trends, active users)
- Audit logs for admin actions
- Export data as CSV
- Theme and settings management

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

## 🌐 Live Deployment
- Frontend: https://my-applications-frontend.vercel.app
- Backend API: https://my-applications-backend.onrender.com
