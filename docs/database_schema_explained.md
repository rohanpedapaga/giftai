# Database Schema Explained

This document explains the database structure, relationships, data flows, and prepares you for review questions concerning the database schema of the **AI Personalized Message Generator**.

---

## 1. Module Summary
The database layer serves as the persistent storage system for Paper Plane's personalized message generator. By using a relational database (**MySQL**), we enforce structural rules (data integrity, foreign keys, unique constraints) to ensure that customers, their recipients, generated messages, and physical gift orders are connected without data loss or corruption.

---

## 2. Files Created
*   [backend/database/schema.sql](file:///e:/Ai%20personalized%20message%20generator/backend/database/schema.sql): Contains SQL DDL (Data Definition Language) commands to initialize the 8 tables and DML (Data Manipulation Language) commands to seed lookup data.

---

## 3. Database Tables Involved
1.  `customers`: Core profiles of buyers.
2.  `recipients`: The intended targets of the gift greetings.
3.  `occasions`: Lookups representing events (Birthday, Anniversary, etc.).
4.  `tones`: Lookups representing emotional styles (Warm, Formal, etc.).
5.  `messages`: Primary log of all generated text and parameter references.
6.  `message_versions`: Audit logs capturing historic revisions of message texts.
7.  `gift_orders`: Physical orders requiring message attachments.
8.  `greeting_cards`: Configuration of printed cards containing the message text.

---

## 4. API Endpoints Involved
This database schema directly supports all 14 endpoints. Specifically:
*   `POST /api/messages/generate` reads from `recipients`, `occasions`, `tones`, and writes to `messages`.
*   `PUT /api/messages/:id` writes to `messages` and inserts a revision record into `message_versions`.
*   `GET /api/tones` and `GET /api/occasions` query `tones` and `occasions` lookup data.
*   `POST /api/customers` inserts a record into `customers`.

---

## 5. Key Concepts to Learn
*   **Relational Database (RDBMS)**: Storing data in structured tables linked by keys instead of standalone documents.
*   **Data Integrity & Constraints**:
    *   `NOT NULL`: Ensures columns cannot be empty.
    *   `UNIQUE`: Ensures data like email cannot be registered twice.
    *   `FOREIGN KEY`: Enforces referential integrity (e.g., you cannot create a message for a customer ID that doesn't exist).
*   **On Delete Cascade vs. Restrict**:
    *   `CASCADE`: If a customer is deleted, their list of `recipients` is automatically deleted.
    *   `RESTRICT`: You cannot delete a lookup item (like an occasion) if there are active `messages` referencing it. This prevents database corruption.
*   **Lookup Table Seeding**: Pre-populating configuration tables with read-only records that the system requires to operate.

---

## 6. The ER Diagram in Words
1.  **A Customer-centric Universe**: The system starts with the `customers` table. A single customer sits at the top and branches out to `recipients` (who they shop for), `gift_orders` (what products they buy), and `messages` (what greeting card text they generate).
2.  **Lookup Integrations**: The `occasions` and `tones` tables act as standardized descriptors. When a message is created, it points to one occasion and one tone. This prevents freeform text discrepancies (e.g., someone typing "Bday" instead of "Birthday").
3.  **Core Transaction (`messages`)**: The `messages` table acts as a bridge. It connects:
    *   The creator (`customer_id`)
    *   The target (`recipient_id`)
    *   The event configuration (`occasion_id` and `tone_id`)
4.  **Downstream Audit Tracking**: The `message_versions` table monitors the `messages` table. If the customer edits a message, the active message updates its text, and a snapshot of the text is archived in `message_versions` with an incremental version index.

---

## 7. How Data Flows Through the System

```
  [1. Customer Registers] ---> Writes to `customers` table
                                    |
                                    v
  [2. Recipient Added] -------> Writes to `recipients` table (linked to `customer_id`)
                                    |
                                    v
  [3. Message Requested] -----> Reads `occasions` and `tones` Lookups
                                AI generates text or uses Fallback Templates
                                Writes output to `messages` table
                                    |
            +-----------------------+-----------------------+
            |                                               |
            v                                               v
  [4. User Edits Message]                         [5. Order Placed]
  Writes to `message_versions`                    Writes to `gift_orders`
  Updates text in `messages`                      Links message to order/greeting card
```

1.  **Registration Flow**: A user registers $\rightarrow$ creates a row in `customers`.
2.  **Contact Flow**: User adds their mother's name and birthday $\rightarrow$ creates a row in `recipients` containing `customer_id = 1` and `relationship = 'Mother'`.
3.  **Generation Flow**: User requests a "Warm Birthday" greeting. The backend fetches tone ID for 'Warm' and occasion ID for 'Birthday' $\rightarrow$ generates message text $\rightarrow$ inserts a row into `messages`.
4.  **Revision Flow**: The user clicks edit to change a sentence in the greeting $\rightarrow$ backend updates the row in `messages` and writes the old text to `message_versions`.
5.  **Fulfillment Flow**: The user proceeds to purchase a gift $\rightarrow$ a record is created in `gift_orders` and the message status is updated to `linked`.

---

## 8. Review 2 & 3 Preparation: 10 Interview Questions & Model Answers

### Q1: What is the purpose of database constraints and which ones did you use here?
*   **Technical Explanation**: Constraints enforce domain-level business rules directly at the engine level, maintaining database consistency.
*   **Beginner Explanation**: Constraints are rules that stop invalid data from entering our tables (like preventing empty name columns or duplicate email addresses).
*   **Model Answer**: We used `PRIMARY KEY` to uniquely identify rows, `UNIQUE` on customer emails and lookup names to prevent duplicates, `NOT NULL` to verify required inputs, and `FOREIGN KEY` constraints to ensure relational consistency.

### Q2: Why did you separate `messages` and `message_versions` into two different tables?
*   **Technical Explanation**: This separation avoids data redundancy and adheres to normalization principles. Keeping version history in a separate table keeps queries on the primary `messages` table highly performant.
*   **Beginner Explanation**: We put them in separate tables so the database stays fast. The main table only stores the latest message, while the second table stores older drafts like a backup log.
*   **Model Answer**: The `messages` table holds the active, latest version of a generated greeting. The `message_versions` table acts as a historical audit log. This normalizes our data and ensures that retrieving current messages doesn't require filtering out historical edits.

### Q3: What is the difference between `ON DELETE CASCADE` and `ON DELETE RESTRICT` in your schema?
*   **Technical Explanation**: Referential integrity rules define what happens to child records when a parent record is deleted. `CASCADE` propagates deletes; `RESTRICT` prevents deletion if dependent records exist.
*   **Beginner Explanation**: `CASCADE` means "if you delete the parent, delete the children too". `RESTRICT` means "you cannot delete the parent as long as children exist."
*   **Model Answer**: We used `ON DELETE CASCADE` on `recipients` and `message_versions` because if a customer or primary message is deleted, their dependent recipient files or edits have no meaning. However, we used `ON DELETE RESTRICT` on lookups (`occasions` and `tones`) so you cannot delete a lookup item if it is currently referenced by a generated message.

### Q4: Why did you choose MySQL and SQLAlchemy rather than a NoSQL database like MongoDB?
*   **Technical Explanation**: Our data is highly structured, strongly relational, and requires multi-table consistency (ACID transactions), making an RDBMS with an ORM ideal.
*   **Beginner Explanation**: Our data has clear links (customers have orders, orders have messages). SQL databases are excellent at connecting tables, whereas NoSQL is better for unstructured, independent documents.
*   **Model Answer**: The project requires connecting entities (customers, recipients, orders, cards) with strict constraints. A relational database like MySQL guarantees ACID compliance. Using SQLAlchemy ORM allows us to write Python objects instead of hardcoding raw SQL queries.

### Q5: What are lookup tables and why are they seeded?
*   **Technical Explanation**: Lookup tables contain predefined, static category records that form the domain values of the application. Seeding ensures the database is initialized with this configuration data.
*   **Beginner Explanation**: Lookup tables are pre-populated lists (like a dropdown menu of tones and occasions) that the app needs to function correctly from day one.
*   **Model Answer**: `occasions` and `tones` are lookup tables. We seed them with initial configurations (e.g. Birthday, Anniversary, Warm, Funny) so that the application has standard references to build prompts and UI selectors immediately upon deployment.

### Q6: How do you track if a message was generated by AI or using a fallback template?
*   **Technical Explanation**: We use a boolean field `ai_used` in the `messages` table which defaults to `TRUE`. If the external AI API request fails and we run the fallback template service, this flag is updated to `FALSE` before saving.
*   **Beginner Explanation**: We added a checkbox column called `ai_used`. If the AI works, it is checked (True). If the AI fails and we use our pre-written backup scripts, we save it as unchecked (False).
*   **Model Answer**: The `messages` table has an `ai_used` BOOLEAN column. When generating a message, the backend service sets this flag to `TRUE` if the Gemini API returned a successful response, or `FALSE` if the server caught an error and loaded a pre-seeded static text template.

### Q7: What are the status ENUM values in the `messages` table and what do they represent?
*   **Technical Explanation**: An ENUM is a string object with a value chosen from a list of allowed values. It enforces state machines at the database level.
*   **Beginner Explanation**: An ENUM is a restricted list of options. It makes sure message status can only ever be set to 'generated', 'saved', 'edited', or 'linked'.
*   **Model Answer**: The `status` field is an ENUM:
    *   `generated`: Message has been generated but not explicitly saved by the customer.
    *   `saved`: The user marked the message to keep.
    *   `edited`: The user revised the message.
    *   `linked`: The message has been attached to a card or order.

### Q8: What database engine did you select and why?
*   **Technical Explanation**: We explicitly configured `ENGINE=InnoDB` for all tables. InnoDB supports transactional operations, foreign key constraints, and row-level locking.
*   **Beginner Explanation**: We chose `InnoDB` because it supports foreign keys, which make sure that our data connections (like linking a message to a customer) remain unbreakable.
*   **Model Answer**: We specified the `InnoDB` storage engine because, unlike MyISAM, it supports transactional safety (ACID compliance), foreign key referential integrity constraints, and row-level locking for better write performance.

### Q9: Why is the `email` column in the `customers` table marked as `UNIQUE`?
*   **Technical Explanation**: Marking the column as `UNIQUE` creates a database index constraint that prevents duplicate inserts, ensuring field integrity.
*   **Beginner Explanation**: We mark it `UNIQUE` so that two different people cannot sign up with the exact same email address.
*   **Model Answer**: The `email` column is set to `UNIQUE` to prevent duplicate customer profiles. If an API request attempts to register an email that already exists, the database rejects the write operation, throwing a constraint violation which the backend handles.

### Q10: How does the `message_versions` table track who made a change?
*   **Technical Explanation**: The `message_versions` table includes an `edited_by` string column which stores the name or role of the modifier (defaulting to `'customer'`).
*   **Beginner Explanation**: The history table has an `edited_by` box. When someone edits a message, we write down who did it (like "customer" or "admin").
*   **Model Answer**: The `message_versions` table uses the `edited_by` VARCHAR column. When a message is updated, the update handler accepts the user context (e.g., customer, admin, designer) and stores it in the audit record alongside the snapshot of the message.

---

## 9. Suggested Revision Notes

*   **MySQL Command to Import Schema**: `mysql -u root -p paper_plane_db < backend/database/schema.sql`
*   **SQLAlchemy Equivalence**: In Phase 3, we will write SQLAlchemy classes that mirror this SQL schema. Every column defined in this `schema.sql` must have a matching `db.Column` declaration in the ORM.
*   **Lookups are Read-Only**: Make sure to highlight to reviewers that tones and occasions cannot be created, deleted, or updated by general customer APIs. They are read-only lookup databases.
