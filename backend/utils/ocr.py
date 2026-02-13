import easyocr

reader = easyocr.Reader(['en'])

def image_to_text(image_path: str) -> str:
    results = reader.readtext(image_path)
    text = " ".join([res[1] for res in results])
    return text