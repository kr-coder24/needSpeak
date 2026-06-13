import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
try:
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="Say hello"
    )
    print("API Key is VALID! Response:", response.text)
except Exception as e:
    print("API Key is INVALID or failed. Error:", str(e))
