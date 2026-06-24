# backend/test_api_refinement.py
import requests
import time
import sys

URL = "http://localhost:5000/api/messages/generate"

def run_test(scenario, payload):
    print(f"\n==========================================")
    print(f"SCENARIO: {scenario}")
    print(f"Payload: {payload}")
    print(f"==========================================")
    start_time = time.time()
    try:
        response = requests.post(URL, json=payload, timeout=10)
        elapsed = time.time() - start_time
        print(f"Status: {response.status_code} | Elapsed: {elapsed:.2f}s")
        if response.status_code == 201:
            data = response.json()
            message_text = data['data']['message_text']
            ai_used = data['data']['ai_used']
            print(f"AI Used: {ai_used}")
            print("\nGenerated message text:")
            print("-" * 50)
            print(message_text)
            print("-" * 50)
            
            lines = message_text.strip().split('\n')
            num_sentences = len(lines)
            print(f"Sentence count: {num_sentences}")
            
            if 5 <= num_sentences <= 10:
                print("SUCCESS: Sentence count is strictly between 5 and 10!")
            else:
                print(f"FAILURE: Sentence count {num_sentences} is invalid!")
                
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Failed to connect: {str(e)}")

# Test 1: Birthday, Warm, context "retired last week"
run_test("Birthday + Warm + Retirement Context", {
    "customer_id": 1,
    "recipient_id": 1,
    "occasion_id": 1,
    "tone_id": 1, # Warm
    "relationship": "Aunt",
    "extra_note": "retired last week"
})

# Test 2: Anniversary, Heartfelt, context "cute"
run_test("Anniversary + Heartfelt + Cute Context", {
    "customer_id": 1,
    "recipient_id": 1,
    "occasion_id": 2,
    "tone_id": 4, # Heartfelt
    "relationship": "girlfriend",
    "extra_note": "cute"
})

# Test 3: Festival, Inspirational, no context
run_test("Festival + Inspirational (New Tone) + No Context", {
    "customer_id": 1,
    "recipient_id": 1,
    "occasion_id": 5, # Festival
    "tone_id": 6, # Inspirational (seeded ID = 6)
    "relationship": "Brother",
    "extra_note": ""
})
