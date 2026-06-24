# backend/test_gemini.py
# Test if request_options timeout works to abort hanging requests.

import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-1.5-flash')

try:
    print("Testing generate_content with no timeout...")
    response = model.generate_content(
        "Write a short, single sentence greeting."
    )
    print("Success: " + response.text)
except Exception as e:
    import traceback
    print("Failed:")
    traceback.print_exc()
