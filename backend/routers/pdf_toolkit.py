from fastapi import APIRouter, UploadFile, File, Form, HTTPException
import fitz
import io
from typing import Optional

router = APIRouter(tags=["PDF Toolkit"])

@router.post("/pdf/toolkit")
async def pdf_toolkit(
    action: str = Form(...),
    file: UploadFile = File(...),
    pages: Optional[str] = Form(None),
    rotate: Optional[int] = Form(None),
    password: Optional[str] = Form(None),
):
    try:
        pdf_bytes = await file.read()
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")

        # ------------- ACTIONS BELOW ---------------
        if action == "compress":
            for page in doc:
                pix = page.get_pixmap(matrix=fitz.Matrix(0.7, 0.7))
                page.clean_contents()
                page.insert_image(page.rect, pixmap=pix)

        elif action == "rotate":
            for page in doc:
                page.set_rotation(rotate)

        elif action == "extract":
            new_doc = fitz.open()
            pages_list = [int(p)-1 for p in pages.split(",")]
            for pg in pages_list:
                new_doc.insert_pdf(doc, from_page=pg, to_page=pg)
            doc = new_doc

        elif action == "reorder":
            new_doc = fitz.open()
            orders = [int(p)-1 for p in pages.split(",")]
            for pg in orders:
                new_doc.insert_pdf(doc, from_page=pg, to_page=pg)
            doc = new_doc

        elif action == "protect":
            doc.save("encrypted.pdf", encryption=fitz.PDF_ENCRYPT_AES_256,
                     owner_pw=password, user_pw=password)
            with open("encrypted.pdf", "rb") as f:
                return {"pdf": f.read().hex()}

        elif action == "unlock":
            if not doc.authenticate(password):
                raise HTTPException(400, "Wrong password")
            doc.save("unlocked.pdf", encryption=0)
            with open("unlocked.pdf", "rb") as f:
                return {"pdf": f.read().hex()}

        elif action == "downscale":
            for page in doc:
                pix = page.get_pixmap(matrix=fitz.Matrix(0.5, 0.5))
                page.clean_contents()
                page.insert_image(page.rect, pixmap=pix)

        # return pdf
        buf = io.BytesIO()
        doc.save(buf)
        buf.seek(0)
        return {"pdf": buf.getvalue().hex()}

    except Exception as e:
        raise HTTPException(500, f"PDF Error: {e}")