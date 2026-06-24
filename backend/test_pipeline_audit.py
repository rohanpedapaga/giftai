# backend/test_pipeline_audit.py
import requests
import sys

URL_GENERATE = "http://localhost:5000/api/messages/generate"
URL_CONFIG = "http://localhost:5000/api/config/check"
URL_HEALTH = "http://localhost:5000/api/health"

def test_diagnostics():
    print("Sending configuration check request...")
    try:
        response = requests.get(URL_CONFIG, timeout=5)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Config Response JSON: {data}")
            if data["success"] and "prefix" in data["data"]:
                print("SUCCESS: Config check endpoint is functioning and returning key configuration metadata!")
            else:
                print("FAILURE: Invalid config check response format!")
                sys.exit(1)
        else:
            print(f"FAILURE: Status code {response.status_code}")
            sys.exit(1)
    except Exception as e:
        print(f"Request failed: {str(e)}")
        sys.exit(1)

def test_health():
    print("\nSending health check request...")
    try:
        response = requests.get(URL_HEALTH, timeout=5)
        print(f"Status Code: {response.status_code}")
        if response.status_code in [200, 429, 502, 503]:
            data = response.json()
            print(f"Health Response JSON: {data}")
            if "status" in data:
                print("SUCCESS: Health check endpoint is functioning and returning health diagnostic metadata!")
            else:
                print("FAILURE: Invalid health check response format!")
                sys.exit(1)
        else:
            print(f"FAILURE: Status code {response.status_code}")
            sys.exit(1)
    except Exception as e:
        print(f"Request failed: {str(e)}")
        sys.exit(1)

def test_debug_metadata():
    print("\nSending generation request to test audit metadata...")
    payload = {
        "customer_id": 1,
        "recipient_id": 1,
        "occasion_id": 1,
        "tone_id": 1,
        "relationship": "Grandpa",
        "extra_note": "Grandpa won the IPL auction and bought a cricket stadium on the moon"
    }
    try:
        response = requests.post(URL_GENERATE, json=payload, timeout=30)
        print(f"Status Code: {response.status_code}")
        if response.status_code in [201, 429, 503]:
            res_json = response.json()
            print("Response Extra Metadata Keys:", res_json.get("extra", {}).keys())
            if "ai_debug" in res_json.get("extra", {}):
                debug = res_json["extra"]["ai_debug"]
                print("\nAI Debug Panel Output:")
                print(f"- Status: {debug.get('status')}")
                print(f"- Fallback Used: {debug.get('fallback_used')}")
                print(f"- Prompt Sent to AI:\n{debug.get('prompt')[:150]}...")
                print(f"- Raw response:\n{debug.get('raw_response')}")
                print(f"- Logs:\n" + "\n".join(debug.get('error_logs', [])[:5]))
                print("\nNew Debug Fields:")
                print(f"- AI Provider: {debug.get('ai_provider')}")
                print(f"- Request Sent:\n{debug.get('request_sent')[:150]}...")
                print(f"- Response Status: {debug.get('response_status')}")
                print(f"- Error: {debug.get('error_msg')}")
                print(f"- Fallback Triggered: {debug.get('fallback_triggered')}")
                
                # Verify new keys exist
                required_keys = ['ai_provider', 'request_sent', 'response_status', 'error_msg', 'fallback_triggered']
                missing_keys = [k for k in required_keys if k not in debug]
                if missing_keys:
                    print(f"FAILURE: Missing keys in ai_debug: {missing_keys}")
                    sys.exit(1)
                print("\nSUCCESS: All new AI debug metadata keys verified successfully!")
            else:
                print("FAILURE: extra.ai_debug missing from response JSON!")
                sys.exit(1)
        else:
            print(f"FAILURE: Status code {response.status_code} - {response.text}")
            sys.exit(1)
    except Exception as e:
        print(f"Request failed: {str(e)}")
        sys.exit(1)

def test_detailed_diagnostics():
    print("\nSending detailed diagnostics check request...")
    URL_DIAG = "http://localhost:5000/api/diagnostics"
    try:
        response = requests.get(URL_DIAG, timeout=5)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Detailed Diagnostics Response JSON: {data}")
            required_keys = ["active_key_prefix", "active_model_name", "sdk_version", "endpoint_url", "raw_provider_response"]
            missing_keys = [k for k in required_keys if k not in data]
            if missing_keys:
                print(f"FAILURE: Missing keys in detailed diagnostics: {missing_keys}")
                sys.exit(1)
            print("SUCCESS: Detailed diagnostics endpoint is functioning and returning all requested parameters!")
        else:
            print(f"FAILURE: Status code {response.status_code}")
            sys.exit(1)
    except Exception as e:
        print(f"Request failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    test_diagnostics()
    test_health()
    test_detailed_diagnostics()
    test_debug_metadata()

