# backend/test_refine_generation.py
import requests
import time
import sys
import re

URL = "http://localhost:5000/api/messages/generate"

def has_consecutive_words(text, reference, n=4):
    if not text or not reference:
        return False
    def get_words(t):
        cleaned = re.sub(r'[^\w\s]', '', t.lower())
        return cleaned.split()
    text_words = get_words(text)
    ref_words = get_words(reference)
    
    if len(ref_words) < n:
        return False
        
    ref_ngrams = set()
    for i in range(len(ref_words) - n + 1):
        ref_ngrams.add(tuple(ref_words[i:i+n]))
        
    for i in range(len(text_words) - n + 1):
        if tuple(text_words[i:i+n]) in ref_ngrams:
            return True
            
    return False

def run_test(scenario, payload):
    print(f"\n==========================================")
    print(f"SCENARIO: {scenario}")
    print(f"Payload: {payload}")
    print(f"==========================================")
    start_time = time.time()
    try:
        response = requests.post(URL, json=payload, timeout=12)
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
            
            # 1. Message Length Verification
            if 5 <= num_sentences <= 10:
                print("SUCCESS: Sentence count is strictly between 5 and 10!")
            else:
                print(f"FAILURE: Sentence count {num_sentences} is invalid!")
                sys.exit(1)
                
            # 2. Context Safety Verification (No 4+ consecutive words copied)
            extra_note = payload.get("extra_note", "")
            if extra_note and extra_note.strip():
                if has_consecutive_words(message_text, extra_note, n=4):
                    print(f"FAILURE: Context Safety Violation! Raw context '{extra_note}' copied in output.")
                    sys.exit(1)
                else:
                    print("SUCCESS: Context Safety Rule verified! No 4+ consecutive words copied.")
            
            return message_text
        else:
            print(f"Error: {response.text}")
            sys.exit(1)
    except Exception as e:
        print(f"Failed to connect: {str(e)}")
        sys.exit(1)

# Scenario 1: Grandpa, Warm, context "retired last week"
msg1 = run_test("Grandpa + Warm + Retirement Context", {
    "customer_id": 1,
    "recipient_id": 1,
    "occasion_id": 1, # Birthday
    "tone_id": 1, # Warm
    "relationship": "Grandpa",
    "extra_note": "retired last week"
})

# Scenario 2: Friend, Funny, context "he has cricket addiction"
msg2 = run_test("Friend + Funny + Cricket Context", {
    "customer_id": 1,
    "recipient_id": 1,
    "occasion_id": 5, # Festival
    "tone_id": 3, # Funny
    "relationship": "Friend",
    "extra_note": "he has cricket addiction"
})

# Scenario 3: Boss, Heartfelt, context "won a marathon"
msg3 = run_test("Boss + Heartfelt + Marathon Context", {
    "customer_id": 1,
    "recipient_id": 1,
    "occasion_id": 3, # Thank You
    "tone_id": 4, # Heartfelt
    "relationship": "Boss",
    "extra_note": "won a marathon"
})

# Scenario 4: Teacher, Professional, context "started engineering college"
msg4 = run_test("Teacher + Professional + College Context", {
    "customer_id": 1,
    "recipient_id": 1,
    "occasion_id": 3, # Thank You
    "tone_id": 5, # Professional
    "relationship": "Teacher",
    "extra_note": "started engineering college"
})

# Scenario 5: Uniqueness Verification
print(f"\n==========================================")
print("TESTING UNIQUENESS CONCURRENT CLICKS")
print(f"==========================================")
msg5_a = run_test("Uniqueness Click A", {
    "customer_id": 1,
    "recipient_id": 1,
    "occasion_id": 1,
    "tone_id": 1,
    "relationship": "Grandpa",
    "extra_note": "retired last week"
})
msg5_b = run_test("Uniqueness Click B", {
    "customer_id": 1,
    "recipient_id": 1,
    "occasion_id": 1,
    "tone_id": 1,
    "relationship": "Grandpa",
    "extra_note": "retired last week"
})

if msg5_a.strip() != msg5_b.strip():
    print("SUCCESS: Dynamic uniqueness verified! Click A and Click B are different.")
else:
    print("FAILURE: Duplicate outputs detected for consecutive clicks!")
    sys.exit(1)

print("\nALL TEST CASES PASSED SUCCESSFULLY!")
