# Database Structure Explained

This document describes the physical database schema, tables, indices, and seeding strategy used by the **AI Personalized Message Generator**.

---

## 1. Table Glossary

The application relies on 8 tables defined inside the MySQL database:

1.  **`customers`**: Profiles of gift buyers. Stores name, email (unique index), phone number, and account creation timestamp.
2.  **`recipients`**: Profiles of individuals receiving cards/gifts. Each recipient must belong to a parent customer profile.
3.  **`occasions`**: Read-only lookup values (Birthday, Anniversary, Thank You, Corporate Gift, Festival).
4.  **`tones`**: Read-only lookup values representing emotions (Warm, Formal, Funny, Heartfelt, Professional).
5.  **`messages`**: The core bridge table storing generated card greetings and metadata.
6.  **`message_versions`**: Audit log recording historical drafts of messages when edited.
7.  **`gift_orders`**: Operational product orders, linked to a customer and occasion.
8.  **`greeting_cards`**: Card layout design choices and approval statuses.

---

## 2. Table Schemas, Column Constraints, and SQL Definition

### `customers`
*   `id` (INT, Primary Key, Auto-Increment)
*   `name` (VARCHAR(100), Not Null)
*   `email` (VARCHAR(150), Unique Index, Not Null)
*   `phone` (VARCHAR(20), Nullable)
*   `created_at` (DATETIME, Default: Current Timestamp)

### `recipients`
*   `id` (INT, Primary Key, Auto-Increment)
*   `customer_id` (INT, Foreign Key referencing `customers.id`, Cascade Delete, Not Null)
*   `name` (VARCHAR(100), Not Null)
*   `relationship` (VARCHAR(50), Not Null)
*   `important_date` (DATE, Nullable)
*   `created_at` (DATETIME, Default: Current Timestamp)

### `occasions` & `tones` (Seeded Lookups)
*   `id` (INT, Primary Key, Auto-Increment)
*   `name` (VARCHAR(50), Unique, Not Null)
*   `description` (VARCHAR(200), Nullable)

### `messages`
*   `id` (INT, Primary Key, Auto-Increment)
*   `customer_id` (INT, Foreign Key referencing `customers.id`, Restrict Delete, Not Null)
*   `recipient_id` (INT, Foreign Key referencing `recipients.id`, Restrict Delete, Not Null)
*   `occasion_id` (INT, Foreign Key referencing `occasions.id`, Restrict Delete, Not Null)
*   `tone_id` (INT, Foreign Key referencing `tones.id`, Restrict Delete, Not Null)
*   `relationship` (VARCHAR(50), Not Null)
*   `message_text` (TEXT, Not Null)
*   `status` (ENUM('generated', 'saved', 'edited', 'linked'), Default: 'generated')
*   `ai_used` (BOOLEAN, Default: True)
*   `gift_order_id` (INT, Nullable)
*   `greeting_card_id` (INT, Nullable)
*   `version_number` (INT, Default: 1)
*   `created_at` (DATETIME, Default: Current Timestamp)
*   `updated_at` (DATETIME, Default: Current Timestamp, updates on write)

### `message_versions`
*   `id` (INT, Primary Key, Auto-Increment)
*   `message_id` (INT, Foreign Key referencing `messages.id`, Cascade Delete, Not Null)
*   `version_number` (INT, Not Null)
*   `message_text` (TEXT, Not Null)
*   `edited_by` (VARCHAR(100), Default: 'customer')
*   `created_at` (DATETIME, Default: Current Timestamp)

---

## 3. Relational Map (Foreign Keys & Cascades)

Relational links are structured using explicit constraint rules:

*   **Cascade Delete (`ON DELETE CASCADE`)**:
    *   Applied from `customers` to `recipients`. If a customer removes their account, their recipient contacts must be removed automatically.
    *   Applied from `messages` to `message_versions` and `greeting_cards`. If a message is deleted, its draft version logs and card designs are cleaned up.
*   **Restrict Delete (`ON DELETE RESTRICT`)**:
    *   Applied from lookups (`occasions`, `tones`) to `messages`. This prevents deleting an occasion type if there are active greetings linked to it.
    *   Applied from `customers`/`recipients` to `messages`. Restricts deleting user profiles until their historical messages are addressed, avoiding orphaned audit trails.

---

## 4. Seeding Strategy
Lookup data must be populated once upon database setup. The [schema.sql](file:///e:/Ai%20personalized%20message%20generator/backend/database/schema.sql) file uses `ON DUPLICATE KEY UPDATE` to safely inject these defaults. Python seed files under `app/seed/` utilize SQLAlchemy sessions to perform identical lookups and commits, ensuring compatibility during deployment tests.
