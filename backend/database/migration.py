# backend/database/migration.py
import os
import secrets
import string
import pymysql
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash

def generate_temp_password(length=12):
    # Generates a secure random password starting with Temp_
    alphabet = string.ascii_letters + string.digits
    rand_part = ''.join(secrets.choice(alphabet) for _ in range(length - 5))
    return f"Temp_{rand_part}"

def run_migration():
    # Load env vars
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dotenv_path = os.path.join(base_dir, '.env')
    load_dotenv(dotenv_path)

    user = os.getenv('DB_USER', 'root')
    password = os.getenv('DB_PASSWORD', '')
    host = os.getenv('DB_HOST', 'localhost')
    port = int(os.getenv('DB_PORT', '3306'))
    db_name = os.getenv('DB_NAME', 'paper_plane_db')

    print(f"Connecting to MySQL database {db_name} on {host}:{port} as {user}...")
    conn = pymysql.connect(host=host, user=user, password=password, database=db_name, port=port)
    cursor = conn.cursor()

    # 1. Alter table to add password_hash if not exists
    cursor.execute("DESCRIBE customers")
    columns = [col[0] for col in cursor.fetchall()]

    if 'password_hash' not in columns:
        print("Adding 'password_hash' column to 'customers' table...")
        cursor.execute("ALTER TABLE customers ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL")
        conn.commit()

    if 'password_reset_required' not in columns:
        print("Adding 'password_reset_required' column to 'customers' table...")
        cursor.execute("ALTER TABLE customers ADD COLUMN password_reset_required TINYINT(1) NOT NULL DEFAULT 0")
        conn.commit()

    # 2. Select all customers to identify legacy users requiring passwords
    cursor.execute("SELECT id, name, email, password_hash FROM customers")
    customers = cursor.fetchall()

    legacy_users = []
    for c in customers:
        c_id, c_name, c_email, c_pwd_hash = c
        if c_pwd_hash is None:
            legacy_users.append((c_id, c_name, c_email))

    if not legacy_users:
        print("No legacy users requiring password migration found.")
        conn.close()
        return

    print(f"Found {len(legacy_users)} legacy users requiring migration.")

    # 3. Generate unique temporary passwords and update DB
    migration_records = []
    for uid, uname, uemail in legacy_users:
        temp_pwd = generate_temp_password()
        hashed_pwd = generate_password_hash(temp_pwd)
        
        cursor.execute(
            "UPDATE customers SET password_hash = %s, password_reset_required = 1 WHERE id = %s",
            (hashed_pwd, uid)
        )
        migration_records.append({
            "id": uid,
            "name": uname,
            "email": uemail,
            "temp_password": temp_pwd
        })
    
    conn.commit()
    print("Database updated with hashed temporary passwords.")

    # 4. Generate migration_passwords.md outside the repository root
    artifacts_dir = r"C:\Users\rohan\.gemini\antigravity\brain\3f272b1b-9461-4039-9163-f676dc91487a"
    if not os.path.exists(artifacts_dir):
        os.makedirs(artifacts_dir, exist_ok=True)
    
    migration_file = os.path.join(artifacts_dir, "migration_passwords.md")
    
    with open(migration_file, "w") as f:
        f.write("# Legacy User Migration Passwords\n\n")
        f.write("> [!WARNING]\n")
        f.write("> This file contains sensitive temporary passwords for migrated users.\n")
        f.write("> It MUST be securely destroyed immediately after successful migration verification.\n\n")
        f.write("| ID | Name | Email | Temporary Password |\n")
        f.write("|---|---|---|---|\n")
        for record in migration_records:
            f.write(f"| {record['id']} | {record['name']} | {record['email']} | `{record['temp_password']}` |\n")
            
    print(f"Generated migration_passwords.md at: {migration_file}")
    conn.close()

if __name__ == "__main__":
    run_migration()
