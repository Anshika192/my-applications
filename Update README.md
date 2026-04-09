# 📁 ToolNest – PDF, Image & Document Tools (Full‑Stack Project)

A feature‑rich full‑stack productivity application built with **FastAPI (Python)** and **React + Vite**.  
This project provides smart tools for **PDF manipulation**, **image conversion**, **OCR**, **document processing**, **MOM (Minutes of Meeting) generation**, and more — all inside one clean web interface.

---

## 🚀 Features

### 🔸 PDF Tools
- 📄 Merge PDFs  
- ✂️ Split PDFs  
- 🔢 Add page numbers  
- 🔐 Lock / Unlock PDF  
- 🖼 Convert PDF ↔ Image  
- 💧 Add watermark  
- 🔤 PDF → Text extraction  

---

### 🔸 Image & Document Tools
- 🖼 Image → PDF  
- 📄 PDF → Image  
- 🗜 Image Compressor  
- 🔄 Image Format Converter  
- 🔠 Image → Text (OCR using Tesseract)  
- 📝 Word → PDF  
- 📄 PDF → Word  

---

### 🔸 Productivity Tools
- 🧾 Automated MOM Generator  
- 🎙 Audio/Video → Text  
- 📊 PPT → Excel  
- 🔳 QR Code Generator  

---

## 🛠 Tech Stack

### 🖥 Backend – FastAPI
- Python 3.10  
- FastAPI  
- PostgreSQL  
- SQLAlchemy ORM  
- PyPDF2, PyMuPDF, pdf2docx  
- OpenCV + Pytesseract (OCR)  
- python‑pptx  
- python-jose (JWT Auth)  
- bcrypt (Password hashing)  
- python‑multipart (file uploads)

### 🎨 Frontend – React + Vite
- React JS  
- Vite  
- Tailwind CSS / CSS Modules  
- Axios (API requests)  

---

## 📁 Folder Structure

```
My_Applications/
│── backend/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── routers/
│   ├── utils/
│   ├── schemas.py
│   └── requirements.txt
│
│── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
│── README.md
│── .gitignore
│── render.yaml
