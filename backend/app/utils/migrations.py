# backend/app/utils/migrations.py
# This module implements safety checks to inspect the database schema using SQLAlchemy 
# Inspector and dynamically add the 'is_favorite' column and performance indexes without blocking startup.

from sqlalchemy import inspect
from app.models import db

def run_migrations(app):
    """Inspects the messages table and adds the 'is_favorite' column and indexes if missing."""
    print("[MIGRATION] Starting database migration check...")
    with app.app_context():
        try:
            # Instantiate database schema inspector
            inspector = inspect(db.engine)
            
            # Ensure the messages table exists before inspecting columns
            tables = inspector.get_table_names()
            if 'messages' not in tables:
                print("[MIGRATION] 'messages' table does not exist yet. It will be created by db.create_all().")
                return
                
            # Inspect columns on 'messages' table
            columns = [c['name'] for c in inspector.get_columns('messages')]
            
            # 1. Add is_favorite column if missing
            if 'is_favorite' not in columns:
                print("[MIGRATION] Column 'is_favorite' is missing in 'messages' table. Adding it now...")
                db.session.execute(db.text("ALTER TABLE messages ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT FALSE"))
                db.session.commit()
                print("[MIGRATION] Column 'is_favorite' successfully added.")
            else:
                print("[MIGRATION] Column 'is_favorite' check: already exists.")
                
            # Inspect indexes on 'messages' table
            indexes = inspector.get_indexes('messages')
            index_names = [idx['name'] for idx in indexes]
            
            # 2. Add idx_messages_created_at index if missing
            if 'idx_messages_created_at' not in index_names:
                print("[MIGRATION] Index 'idx_messages_created_at' is missing. Creating index...")
                try:
                    db.session.execute(db.text("CREATE INDEX idx_messages_created_at ON messages (created_at)"))
                    db.session.commit()
                    print("[MIGRATION] Index 'idx_messages_created_at' successfully created.")
                except Exception as e:
                    db.session.rollback()
                    print(f"[MIGRATION] Warning: Failed to create idx_messages_created_at: {e}")
            else:
                print("[MIGRATION] Index 'idx_messages_created_at' check: already exists.")
                
            # 3. Add idx_messages_is_favorite index if missing
            if 'idx_messages_is_favorite' not in index_names:
                print("[MIGRATION] Index 'idx_messages_is_favorite' is missing. Creating index...")
                try:
                    db.session.execute(db.text("CREATE INDEX idx_messages_is_favorite ON messages (is_favorite)"))
                    db.session.commit()
                    print("[MIGRATION] Index 'idx_messages_is_favorite' successfully created.")
                except Exception as e:
                    db.session.rollback()
                    print(f"[MIGRATION] Warning: Failed to create idx_messages_is_favorite: {e}")
            else:
                print("[MIGRATION] Index 'idx_messages_is_favorite' check: already exists.")
                
            print("[MIGRATION] Database schema is up-to-date.")
        except Exception as e:
            # NEVER block application startup due to migrations
            db.session.rollback()
            print(f"[MIGRATION ERROR] Dynamic migration failed: {str(e)}. Proceeding with application startup anyway.")
