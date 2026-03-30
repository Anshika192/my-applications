from fastapi import APIRouter, UploadFile, File
from fastapi.responses import FileResponse
import fitz  # PyMuPDF
import os
import uuid
import zipfile

router = APIRouter()

@router.post("/convert/pdf-to-image")
async def pdf_to_image(file: UploadFile = File(...)):
    temp_id = str(uuid.uuid4())
    temp_dir = f"temp_{temp_id}"
    os.makedirs(temp_dir, exist_ok=True)

    pdf_path = os.path.join(temp_dir, file.filename)

    with open(pdf_path, "wb") as f:
        f.write(await file.read())

    doc = fitz.open(pdf_path)
    image_files = []

    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        pix = page.get_pixmap()
        img_path = os.path.join(temp_dir, f"page_{page_num + 1}.png")
        pix.save(img_path)
        image_files.append(img_path)

    zip_path = os.path.join(temp_dir, "images.zip")
    with zipfile.ZipFile(zip_path, "w") as zipf:
        for img in image_files:
            zipf.write(img, os.path.basename(img))

    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename="pdf_images.zip"
    )