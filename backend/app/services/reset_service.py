# backend/app/services/reset_service.py
# Reusable reset OTP service.
# Supports SHA-256 secure hashing, Brevo API sending, rate limiting, and database validation.

import os
import secrets
import string
import hashlib
import urllib.request
import urllib.error
import json
from datetime import datetime, timedelta
from app.models import db, Customer
from app.models.otp_verification import OTPVerification
from werkzeug.security import generate_password_hash

def hash_otp(otp_str):
    """Hashes the OTP using SHA-256 before storing or comparing."""
    return hashlib.sha256(otp_str.encode('utf-8')).hexdigest()

def cleanup_expired_otps(user_id=None):
    """Deletes expired OTP records from the database to prevent accumulation."""
    try:
        now = datetime.utcnow()
        if user_id:
            db.session.query(OTPVerification).filter(
                OTPVerification.user_id == user_id,
                OTPVerification.expires_at < now
            ).delete()
        else:
            db.session.query(OTPVerification).filter(
                OTPVerification.expires_at < now
            ).delete()
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print(f"[CLEANUP ERROR] Failed to clean expired OTPs: {str(e)}", flush=True)

def send_otp_email(email, otp):
    """
    Sends the 6-digit OTP to the customer's email using the Brevo API.
    Verifies that the API key and Sender Email are loaded from environment variables.
    Logs HTTP response status and body, and logs any HTTPError or URLError.
    """
    brevo_api_key = os.getenv("BREVO_API_KEY")
    sender_email = os.getenv("BREVO_SENDER_EMAIL")
    sender_name = os.getenv("BREVO_SENDER_NAME", "WishForge")
    
    missing_vars = []
    if not brevo_api_key:
        missing_vars.append("BREVO_API_KEY")
    if not sender_email:
        missing_vars.append("BREVO_SENDER_EMAIL")
        
    if missing_vars:
        error_msg = f"[EMAIL ERROR] Missing environment variable(s) for Brevo: {', '.join(missing_vars)}."
        print(error_msg, flush=True)
        return False, error_msg
        
    print(f"[EMAIL INFO] Executing Brevo request to send OTP to {email}...", flush=True)
    
    subject = "WishForge Password Reset Code"
    body_text = f"""Hello,

Your WishForge verification code is:

{otp}

This code expires in 10 minutes.

If you did not request this password reset, simply ignore this email.

Regards,
WishForge Team"""

    body_html = f"""<p>Hello,</p>
<p>Your WishForge verification code is:</p>
<p><strong>{otp}</strong></p>
<p>This code expires in 10 minutes.</p>
<p>If you did not request this password reset, simply ignore this email.</p>
<p>Regards,<br>WishForge Team</p>"""

    payload = {
        "sender": {
            "email": sender_email,
            "name": sender_name
        },
        "to": [
            {
                "email": email
            }
        ],
        "subject": subject,
        "htmlContent": body_html,
        "textContent": body_text
    }
    
    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "api-key": brevo_api_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "WishForge-App"
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            status_code = response.status
            response_body = response.read().decode("utf-8")
            print(f"[EMAIL SUCCESS] Brevo HTTP {status_code}", flush=True)
            return True, "Email sent successfully."
            
    except urllib.error.HTTPError as e:
        import traceback
        print("[EMAIL ERROR] Brevo HTTPError traceback during email sending:", flush=True)
        traceback.print_exc()
        status_code = e.code
        try:
            error_body = e.read().decode("utf-8")
            error_json = json.loads(error_body)
            brevo_message = error_json.get("message", error_body)
        except Exception:
            error_body = "Could not read error response body."
            brevo_message = error_body
        
        error_msg = f"Brevo API HTTP Error {status_code}: {brevo_message}"
        print(f"[BREVO HTTPError] {error_msg}", flush=True)
        return False, error_msg
        
    except urllib.error.URLError as e:
        import traceback
        print("[EMAIL ERROR] Brevo URLError traceback during email sending:", flush=True)
        traceback.print_exc()
        error_msg = f"Brevo API Connection Error: {e.reason}"
        print(f"[BREVO URLError] {error_msg}", flush=True)
        return False, error_msg
        
    except Exception as e:
        import traceback
        print("[EMAIL ERROR] Brevo Unexpected Exception traceback during email sending:", flush=True)
        traceback.print_exc()
        error_msg = f"Unexpected Email Service Error: {str(e)}"
        print(f"[BREVO EXCEPTION] {error_msg}", flush=True)
        return False, error_msg



def generate_and_send_otp(customer):
    """
    Validates rate limits, generates a cryptographically secure 6-digit OTP,
    hashes it, stores it, and sends the raw OTP via Brevo.
    """
    now = datetime.utcnow()

    # Detect environment mode (development/debug vs production)
    _flask_env = os.getenv('FLASK_ENV', 'development').lower()
    _flask_debug = os.getenv('FLASK_DEBUG', 'False').lower() in ['true', '1', 't'] or os.getenv('DEBUG', 'False').lower() in ['true', '1', 't']
    is_dev = (_flask_env == 'development') or _flask_debug

    # Set rate limit thresholds dynamically
    max_hourly = 100 if is_dev else 5
    cooldown_sec = 5 if is_dev else 60

    # 1. Enforce rate limiting: Max OTP requests per hour
    one_hour_ago = now - timedelta(hours=1)

    hourly_count = OTPVerification.query.filter(
        OTPVerification.user_id == customer.id,
        OTPVerification.created_at >= one_hour_ago
    ).count()
    if hourly_count >= max_hourly:
        return False, f"Rate limit exceeded. Maximum {max_hourly} OTP requests per hour."

    # 2. Enforce rate limiting: resend cooldown
    last_record = OTPVerification.query.filter_by(
        user_id=customer.id
    ).order_by(OTPVerification.created_at.desc()).first()
    if last_record and (now - last_record.created_at < timedelta(seconds=cooldown_sec)):
        return False, f"Please wait {cooldown_sec} seconds before requesting another code."


    # 3. Clean up expired OTPs for this user
    cleanup_expired_otps(customer.id)

    # 4. Invalidate any previous active OTPs for the user
    OTPVerification.query.filter_by(user_id=customer.id, used=False).update({"used": True})
    db.session.commit()

    # 5. Generate secure 6-digit OTP
    otp = ''.join(secrets.choice(string.digits) for _ in range(6))
    hashed_otp = hash_otp(otp)

    # 6. Save OTP record to database
    otp_record = OTPVerification(
        user_id=customer.id,
        otp=hashed_otp,
        expires_at=now + timedelta(minutes=10)
    )
    db.session.add(otp_record)
    db.session.commit()

    # 7. Send the email using send_otp_email helper
    email_success, email_msg = send_otp_email(customer.email, otp)
    if not email_success:
        return False, email_msg

    return True, otp




def verify_otp_record(email, otp_val):
    """
    Verifies if the OTP record exists, matches, is not expired,
    and has not breached attempts limit.
    """
    if not email or not otp_val:
        return False, "Email and verification code are required."

    email_clean = email.strip().lower()
    customer = Customer.query.filter_by(email=email_clean).first()
    if not customer:
        return False, "Invalid email address or verification code."

    # Clean up expired records
    cleanup_expired_otps(customer.id)

    # Find the latest active unused record
    otp_record = OTPVerification.query.filter_by(
        user_id=customer.id,
        used=False
    ).order_by(OTPVerification.created_at.desc()).first()

    if not otp_record:
        return False, "No active verification code found."

    # Check lock limits
    if otp_record.attempts >= 5:
        return False, "Verification locked. Too many failed attempts. Please request a new code."

    # Check expiration
    if datetime.utcnow() > otp_record.expires_at:
        return False, "Verification code has expired. Please request a new one."

    # Check OTP hash
    hashed_input = hash_otp(otp_val.strip())
    if otp_record.otp != hashed_input:
        otp_record.attempts += 1
        db.session.commit()
        remaining = 5 - otp_record.attempts
        if remaining <= 0:
            return False, "Verification locked. Too many failed attempts. Please request a new code."
        return False, f"Invalid verification code. {remaining} attempts remaining."

    return True, otp_record

def validate_password_strength(password):
    """Enforces minimum 8 chars, uppercase, lowercase, and numeric complexity."""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter."
    if not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter."
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one number."
    return True, ""

def reset_user_password(email, otp_val, new_password):
    """Verifies OTP, validates password strength, updates password, and consumes OTP."""
    # 1. Verify OTP
    is_valid, result = verify_otp_record(email, otp_val)
    if not is_valid:
        return False, result

    otp_record = result
    
    # 2. Validate Password Strength
    pass_ok, pass_msg = validate_password_strength(new_password)
    if not pass_ok:
        return False, pass_msg

    # 3. Update Password
    customer = Customer.query.get(otp_record.user_id)
    if not customer:
        return False, "Customer profile not found."

    customer.password_hash = generate_password_hash(new_password)
    customer.password_reset_required = False
    
    # Consume OTP and invalidate all other pending codes for the user
    OTPVerification.query.filter_by(user_id=customer.id, used=False).update({"used": True})
    db.session.commit()

    return True, "Password reset successfully."
