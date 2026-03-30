from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from PIL import Image
import io

router = APIRouter(tags=["Image Toolkit"])


@router.post("/image/toolkit")
async def image_toolkit(
    action: str = Form(...),
    file: UploadFile = File(...),

    # Resize
    width: int = Form(None),
    height: int = Form(None),

    # Crop (must match frontend)
    left: int = Form(None),
    top: int = Form(None),
    crop_width: int = Form(None),
    crop_height: int = Form(None),
):
    try:
        image_bytes = await file.read()
        img = Image.open(io.BytesIO(image_bytes))
        img = img.convert("RGB")

        # -------- METADATA --------
        if action == "metadata":
            return {
                "filename": file.filename,
                "format": img.format,
                "mode": img.mode,
                "width": img.width,
                "height": img.height,
                "size_kb": round(len(image_bytes) / 1024, 2),
            }

        # -------- RESIZE --------
        if action == "resize":
            if not width and not height:
                raise HTTPException(400, "Width or height required")

            if width and not height:
                height = int(img.height * (width / img.width))
            if height and not width:
                width = int(img.width * (height / img.height))

            img = img.resize((int(width), int(height)), Image.LANCZOS)

        # -------- CROP --------
        if action == "crop":
            # ✅ Defensive validation (NO 500s)
            if left is None or top is None or crop_width is None or crop_height is None:
                raise HTTPException(400, "All crop values required")

            if crop_width <= 0 or crop_height <= 0:
                raise HTTPException(400, "Invalid crop size")

            left = max(0, left)
            top = max(0, top)
            right = min(left + crop_width, img.width)
            bottom = min(top + crop_height, img.height)

            if right <= left or bottom <= top:
                raise HTTPException(400, "Invalid crop coordinates")

            img = img.crop((left, top, right, bottom))

        # -------- RETURN IMAGE --------
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return {"image": buf.getvalue().hex()}

    except HTTPException:
        raise
    except Exception as e:
        # ✅ Catch‑all protection
        raise HTTPException(500, f"Server error: {str(e)}")