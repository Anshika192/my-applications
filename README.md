

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

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