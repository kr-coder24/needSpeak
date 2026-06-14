import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app.pipeline.gemini_client import get_gemini_client

def test():
    try:
        client = get_gemini_client()
        models = client.models.list_models()
        for m in models:
            if "embed" in m.name.lower():
                print(m.name, m.supported_actions)
    except Exception as e:
        print("Error:", str(e))

if __name__ == "__main__":
    test()
