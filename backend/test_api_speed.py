# backend/test_api_speed.py
import requests
import time
import sys

URL = "http://localhost:5000/api/messages/generate"
payload = {
    "customer_id": 1,
    "recipient_id": 1,
    "occasion_id": 1,
    "tone_id": 1,
    "relationship": "Aunt",
    "extra_note": "pastries, retired last week"
}

def test_generation():
    print("Sending generation request to API...")
    start_time = time.time()
    try:
        response = requests.post(URL, json=payload, timeout=10)
        elapsed = time.time() - start_time
        print(f"Status Code: {response.status_code}")
        print(f"Elapsed Time: {elapsed:.2f} seconds")
        
        if response.status_code == 201:
            data = response.json()
            message_text = data['data']['message_text']
            ai_used = data['data']['ai_used']
            print(f"\nAI Used: {ai_used}")
            print("\nGenerated Message:")
            print("-" * 50)
            print(message_text)
            print("-" * 50)
            
            lines = message_text.strip().split('\n')
            num_lines = len(lines)
            print(f"Total Lines count: {num_lines}")
            
            # Check constraints
            if 5 <= num_lines <= 10:
                print("SUCCESS: Line count is strictly between 5 and 10 lines!")
            else:
                print(f"FAILURE: Line count {num_lines} is NOT between 5 and 10 lines!")
                sys.exit(1)
                
            # Check keywords if fallback
            if not ai_used:
                # Fallback path
                keywords = ["pastries", "retired last week"]
                has_keywords = any(kw.lower() in message_text.lower() for kw in keywords)
                if has_keywords:
                    print("SUCCESS: Keywords integrated in fallback mode!")
                else:
                    print("WARNING: Keywords NOT found in fallback message!")
            else:
                print("AI was used, check message context for keywords integration.")
        else:
            print(f"ERROR: {response.text}")
            sys.exit(1)
    except Exception as e:
        print(f"Request failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    test_generation()
