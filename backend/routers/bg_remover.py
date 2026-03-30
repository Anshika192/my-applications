from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from PIL import Image
import io

router = APIRouter(tags=["Background Remover"])

@router.post("/image/bg-remove")
async def remove_background(
    file: UploadFile = File(...),
    tolerance: int = Form(30)
):
    try:
        image_bytes = await file.read()
        img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
        pixels = img.load()

        width, height = img.size

        # ✅ Sample background pixels from corners
        bg_samples = [
            pixels[0, 0],
            pixels[width - 1, 0],
            pixels[0, height - 1],
            pixels[width - 1, height - 1],
        ]

        def is_background(pixel):
            r, g, b, _ = pixel
            for bg in bg_samples:
                if (
                    abs(r - bg[0]) <= tolerance and
                    abs(g - bg[1]) <= tolerance and
                    abs(b - bg[2]) <= tolerance
                ):
                    return True
            return False

        # ✅ Remove background by making pixels transparent
        for y in range(height):
            for x in range(width):
                if is_background(pixels[x, y]):
                    pixels[x, y] = (0, 0, 0, 0)

        # ✅ Return PNG with transparency
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)

        return {"image": buf.getvalue().hex()}

    except Exception as e:
        raise HTTPException(500, str(e))