# backend/app/config.py
# This file defines the configuration class for our Flask application.
# It reads configuration variables (DB credentials, API keys) from environment variables.

import os

class Config:
    # Secret Key for signing cookies and sessions
    SECRET_KEY = os.getenv('SECRET_KEY', 'default-paperplane-key-1234')

    # Administrator Account Credentials
    ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', 'admin@giftai.com')
    ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', 'admin123')

    # Rate Limiting Configuration
    LIMIT_AI_GENERATION = os.getenv('LIMIT_AI_GENERATION', '10 per minute')
    LIMIT_AUTH = os.getenv('LIMIT_AUTH', '10 per 5 minutes')
    LIMIT_ADMIN = os.getenv('LIMIT_ADMIN', '30 per minute')

    # Database Configuration
    DB_USER = os.getenv('DB_USER', 'root')
    DB_PASSWORD = os.getenv('DB_PASSWORD', '')
    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_PORT = os.getenv('DB_PORT', '3306')
    DB_NAME = os.getenv('DB_NAME', 'paper_plane_db')

    # Build SQLAlchemy Database URI dynamically using pymysql driver
    SQLALCHEMY_DATABASE_URI = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # AI Service Credentials
    GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
    GROQ_API_KEY = os.getenv('GROQ_API_KEY')
    OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
