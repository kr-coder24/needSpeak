import base64
from app.ingestion.image_input import extract_text_from_image

with open('c:/needSpeak3/backend/requirements.txt', 'rb') as f:
    data = f.read() + b' ' * 1000  # Pad to meet 500 bytes requirement
    print(extract_text_from_image(data, 'image/jpeg'))
