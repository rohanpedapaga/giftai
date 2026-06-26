# backend/app/config.py
# This file defines the configuration class for our Flask application.
# It reads configuration variables (DB credentials, API keys) from environment variables.

import os
from dotenv import load_dotenv

# Load environment variables from .env file in the backend directory
# (relative to this config.py file, which is located in backend/app/config.py)
dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
load_dotenv(dotenv_path=dotenv_path)

class Config:
    # Secret Key for signing cookies and sessions
    SECRET_KEY = os.getenv('SECRET_KEY', 'default-paperplane-key-1234')

    # Administrator Account Credentials
    ADMIN_EMAIL = os.getenv('ADMIN_EMAIL')
    ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD')

    # Rate Limiting Configuration
    LIMIT_AI_GENERATION = os.getenv('LIMIT_AI_GENERATION', '10 per minute')
    LIMIT_AUTH = os.getenv('LIMIT_AUTH', '10 per 5 minutes')
    LIMIT_ADMIN = os.getenv('LIMIT_ADMIN', '30 per minute')

    # Detect if we are in development/debug mode
    _flask_env = os.getenv('FLASK_ENV', 'development').lower()
    _flask_debug = os.getenv('FLASK_DEBUG', 'False').lower() in ['true', '1', 't']
    _is_dev = (_flask_env == 'development') or _flask_debug

    if _is_dev:
        LIMIT_FORGOT_PASSWORD = os.getenv('LIMIT_FORGOT_PASSWORD', '50 per minute')
        LIMIT_LOGIN = os.getenv('LIMIT_LOGIN', '50 per minute')
        LIMIT_VALIDATE_OTP = os.getenv('LIMIT_VALIDATE_OTP', '100 per minute')
        LIMIT_RESET_PASSWORD = os.getenv('LIMIT_RESET_PASSWORD', '100 per minute')
    else:
        LIMIT_FORGOT_PASSWORD = os.getenv('LIMIT_FORGOT_PASSWORD', '5 per 15 minutes')
        LIMIT_LOGIN = os.getenv('LIMIT_LOGIN', '5 per 15 minutes')
        LIMIT_VALIDATE_OTP = os.getenv('LIMIT_VALIDATE_OTP', '20 per 15 minutes')
        LIMIT_RESET_PASSWORD = os.getenv('LIMIT_RESET_PASSWORD', '10 per 15 minutes')



    # Database Configuration
    DB_USER = os.getenv('DB_USER', 'root')
    DB_PASSWORD = os.getenv('DB_PASSWORD', '')
    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_PORT = os.getenv('DB_PORT', '3306')
    DB_NAME = os.getenv('DB_NAME', 'paper_plane_db')

    # Build SQLAlchemy Database URI dynamically using pymysql driver
    SQLALCHEMY_DATABASE_URI = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Configure SQLAlchemy with pool_pre_ping=True and pool_recycle=300 for Aiven MySQL compatibility
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300
    }

    # AI Service Credentials
    GROQ_API_KEY = os.getenv('GROQ_API_KEY')

    