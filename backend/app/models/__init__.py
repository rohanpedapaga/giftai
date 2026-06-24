# backend/app/models/__init__.py
# This file initializes the SQLAlchemy database object and imports all models.
# It registers all models with SQLAlchemy and makes imports clean throughout the app.

from flask_sqlalchemy import SQLAlchemy

# Create the database instance
db = SQLAlchemy()

# Import all models so that SQLAlchemy registers their metadata.
# This prevents circular import errors in model relations.
from app.models.customer import Customer
from app.models.recipient import Recipient
from app.models.occasion import Occasion
from app.models.tone import Tone
from app.models.message import Message
from app.models.message_version import MessageVersion
from app.models.gift_order import GiftOrder
from app.models.greeting_card import GreetingCard
