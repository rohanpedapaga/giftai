# Backend Blueprint — AI Personalized Message Generator
## Paper Plane | Student 2 (Backend) | Python Flask + MySQL

---

## 1. BACKEND BLUEPRINT

### Project Summary
Paper Plane needs an AI-powered backend that:
- Accepts occasion, tone, recipient, and relationship as inputs
- Calls an AI API (OpenAI/Gemini) OR falls back to rule-based templates
- Generates and stores personalized gift messages (birthday, anniversary, thank-you, corporate)
- Tracks message versions when edited
- Links messages to gift orders and greeting cards
- Serves dashboard statistics and message history

### Backend Responsibilities
| # | Responsibility |
|---|---------------|
| 1 | Accept and validate message generation requests |
| 2 | Build prompts from input and call AI API |
| 3 | Fall back to rule-based message if AI fails |
| 4 | Save generated messages to MySQL |
| 5 | Support message editing with version history |
| 6 | Serve tone and occasion lookup data |
| 7 | Link messages to gift orders and greeting cards |
| 8 | Return dashboard summary statistics |
| 9 | Manage customers and recipients |
| 10 | Handle errors with meaningful messages |

---

## 2. DATABASE BLUEPRINT

### All Tables
```
customers          → People who place orders
recipients         → People receiving the gift/message
occasions          → Lookup: Birthday, Anniversary, Thank You, Corporate Gift, Festival
tones              → Lookup: Warm, Formal, Funny, Heartfelt, Professional
messages           → Core table: every generated message
message_versions   → Every edit creates a version record
gift_orders        → Orders a message can be linked to
greeting_cards     → Card design linked to a message
```

### Table Definitions

```sql
CREATE TABLE customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(20),
    created_at DATETIME DEFAULT NOW()
);

CREATE TABLE recipients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    relationship VARCHAR(50) NOT NULL,
    important_date DATE,
    created_at DATETIME DEFAULT NOW(),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE occasions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(200)
);

CREATE TABLE tones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(200)
);

CREATE TABLE messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    recipient_id INT NOT NULL,
    occasion_id INT NOT NULL,
    tone_id INT NOT NULL,
    relationship VARCHAR(50) NOT NULL,
    message_text TEXT NOT NULL,
    status ENUM('generated','saved','edited','linked') DEFAULT 'generated',
    ai_used BOOLEAN DEFAULT TRUE,
    gift_order_id INT,
    greeting_card_id INT,
    version_number INT DEFAULT 1,
    created_at DATETIME DEFAULT NOW(),
    updated_at DATETIME ON UPDATE NOW(),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (recipient_id) REFERENCES recipients(id),
    FOREIGN KEY (occasion_id) REFERENCES occasions(id),
    FOREIGN KEY (tone_id) REFERENCES tones(id)
);

CREATE TABLE message_versions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message_id INT NOT NULL,
    version_number INT NOT NULL,
    message_text TEXT NOT NULL,
    edited_by VARCHAR(100),
    created_at DATETIME DEFAULT NOW(),
    FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE TABLE gift_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    product_name VARCHAR(150),
    occasion_id INT,
    status ENUM('pending','processing','dispatched','delivered') DEFAULT 'pending',
    created_at DATETIME DEFAULT NOW(),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (occasion_id) REFERENCES occasions(id)
);

CREATE TABLE greeting_cards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message_id INT NOT NULL,
    card_type VARCHAR(50),
    design_ref VARCHAR(100),
    approved BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT NOW(),
    FOREIGN KEY (message_id) REFERENCES messages(id)
);
```

### Seed Data

```sql
-- Occasions
INSERT INTO occasions (name, description) VALUES
('Birthday', 'Celebrating someone special on their birthday'),
('Anniversary', 'Marking a relationship or work milestone'),
('Thank You', 'Expressing gratitude for a kind act'),
('Corporate Gift', 'Professional gifting for business relationships'),
('Festival', 'Seasonal or cultural celebration greeting');

-- Tones
INSERT INTO tones (name, description) VALUES
('Warm', 'Friendly, affectionate, and personal'),
('Formal', 'Respectful and professional in tone'),
('Funny', 'Light-hearted, humorous, and playful'),
('Heartfelt', 'Deep, emotional, and sincere'),
('Professional', 'Corporate-appropriate and business-focused');
```

---

## 3. API BLUEPRINT

### Base URL
```
Development:  http://localhost:5000/api
Production:   https://your-app.render.com/api
```

### Standard Response Format
```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": "Descriptive error message" }
```

### All Endpoints

| # | Method | Endpoint | Purpose |
|---|--------|----------|---------|
| 1 | POST | /messages/generate | Generate a personalized message |
| 2 | GET | /messages | List all messages (filterable) |
| 3 | GET | /messages/:id | Get message detail + versions |
| 4 | POST | /messages/:id/save | Mark message as saved |
| 5 | PUT | /messages/:id | Edit message (creates version) |
| 6 | GET | /messages/:id/versions | Get version history |
| 7 | GET | /tones | List all tone templates |
| 8 | GET | /occasions | List all occasion types |
| 9 | POST | /customers | Create a customer |
| 10 | GET | /customers | List all customers |
| 11 | GET | /customers/:id | Get one customer |
| 12 | POST | /recipients | Add a recipient |
| 13 | GET | /recipients | List all recipients |
| 14 | GET | /dashboard/stats | Dashboard summary data |

---

### Detailed API Specs

#### POST /api/messages/generate
```
Request Body:
{
  "customer_id": 1,
  "recipient_id": 2,
  "occasion_id": 1,
  "tone_id": 2,
  "relationship": "mother",
  "extra_note": "She loves gardening"    // optional
}

Response 200:
{
  "success": true,
  "data": {
    "message_id": 45,
    "message_text": "Wishing you a wonderful birthday...",
    "status": "generated",
    "ai_used": true,
    "version_number": 1
  }
}

Errors:
- 400: Missing required fields
- 404: customer_id or recipient_id not found
- 500: Unexpected server error (AI failure uses fallback, not 500)
```

#### GET /api/messages
```
Query Params: status, customer_id, occasion_id, page (default 1), limit (default 10)

Response 200:
{
  "success": true,
  "data": [ { "id": 45, "customer_name": "...", "occasion": "...", ... } ],
  "total": 42,
  "page": 1,
  "limit": 10
}
```

#### PUT /api/messages/:id
```
Request Body: { "message_text": "Updated text..." }
Creates new message_version record automatically.
Increments version_number on the message.
Sets status to "edited".
```

#### GET /api/dashboard/stats
```
Response 200:
{
  "success": true,
  "data": {
    "total_messages": 120,
    "messages_today": 8,
    "messages_by_occasion": [ { "occasion": "Birthday", "count": 55 } ],
    "messages_by_tone": [ { "tone": "Warm", "count": 60 } ],
    "messages_by_status": { "generated": 20, "saved": 80, "edited": 15, "linked": 5 }
  }
}
```

---

## 4. FOLDER STRUCTURE

```
backend/
│
├── app/
│   ├── __init__.py                 # Flask app factory
│   ├── config.py                   # DB config, API keys, environment settings
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── customer.py
│   │   ├── recipient.py
│   │   ├── occasion.py
│   │   ├── tone.py
│   │   ├── message.py
│   │   ├── message_version.py
│   │   ├── gift_order.py
│   │   └── greeting_card.py
│   │
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── message_routes.py
│   │   ├── customer_routes.py
│   │   ├── recipient_routes.py
│   │   ├── tone_routes.py
│   │   ├── occasion_routes.py
│   │   └── dashboard_routes.py
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── message_service.py      # Core generate + save + version logic
│   │   ├── ai_service.py           # OpenAI/Gemini + fallback
│   │   ├── customer_service.py
│   │   └── recipient_service.py
│   │
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── response_helper.py      # success_response() and error_response()
│   │   ├── validators.py           # Input validation functions
│   │   └── prompt_builder.py       # Builds AI prompt string
│   │
│   └── seed/
│       ├── seed_tones.py
│       └── seed_occasions.py
│
├── tests/
│   ├── test_messages.py
│   ├── test_customers.py
│   └── test_ai_service.py
│
├── .env                            # NEVER commit - API keys and DB password
├── .env.example                    # Template - safe to commit
├── requirements.txt
├── run.py                          # Entry point
└── README.md
```

---

## 5. DAY-WISE BACKEND PLAN

| Day | Date | Task | Deliverable |
|-----|------|------|-------------|
| 1 | Jun 1 | Read document, write 5 backend questions, understand API list | Questions doc in /docs |
| 2 | Jun 2 | Draft problem statement (technical view), list all backend operations | Problem statement draft |
| 3 | Jun 3 | Write 5 backend objectives, install Flask+MySQL, create /hello route | Working test route |
| 4 | Jun 4 | Use case diagram, endpoint list with request/response fields | API spec doc |
| 5 | Jun 5 | Review 1 slides: problem, proposed system, tech stack | Slides ready |
| 6 | Jun 6 | REVIEW 1 PRESENTATION | Score + feedback |
| 7 | Jun 8 | Apply feedback, research Flask REST patterns | Updated docs |
| 8 | Jun 9 | Existing system analysis, identify the gap | Existing system doc |
| 9 | Jun 10 | Full DB schema all 8 tables, ER diagram, validation rules | Schema + ER diagram |
| 10 | Jun 11 | Set up MySQL, create tables, build POST /api/customers | DB live + 1 API working |
| 11 | Jun 12 | GET /api/messages list route with filters | List API working |
| 12 | Jun 13 | GitHub: push branch, raise PR, merge | Clean repo |
| 13 | Jun 15 | Design AI logic - prompt builder + fallback templates | Core logic doc + tested |
| 14 | Jun 16 | Finalize all docs, Review 2 slides | PPT ready |
| 15 | Jun 17 | Architecture diagram (draw.io), confirm API contracts | Architecture diagram |
| 16 | Jun 18 | POST /api/messages/generate end-to-end with AI + fallback | Generate endpoint live |
| 17 | Jun 19 | REVIEW 2 DAY 1 | Score + feedback |
| 18 | Jun 20 | REVIEW 2 DAY 2 + POST/process status-update route | Status update API |
| 19 | Jun 22 | PUT /api/messages/:id (edit + versioning), notification endpoint | Full CRUD |
| 20 | Jun 23 | GET /api/messages/:id detail + version history | Detail API |
| 21 | Jun 24 | try/except error handling on ALL routes | All routes error-safe |
| 22 | Jun 25 | Deploy to Render/Railway, test live URL | Live backend URL |
| 23 | Jun 26 | Final testing, bug fixes, write implementation chapter | Bug report + chapter |
| 24 | Jun 27 | Conclusion, references, PPT slides, mock presentation | Full backend report |
| 25 | Jun 29 | REVIEW 3 DAY 1 | Final submission |
| 26 | Jun 30 | REVIEW 3 DAY 2 + final logbook entry | Internship closed |

---

## 6. ANTIGRAVITY MASTER PROMPT

Copy everything below the divider line and paste it directly into Antigravity.

---

```
You are a Senior Backend Mentor helping a beginner student (Student 2 - Backend) build
the backend for an internship project. The student is learning backend development for
the first time and needs step-by-step guidance.

============================================================
PROJECT OVERVIEW
============================================================

Project Name: AI Personalized Message Generator
Company: Paper Plane (personalized gifting company)
Duration: 01 June 2026 – 30 June 2026 (26 working days)
Student Role: Student 2 — Backend Developer

What this project does:
- A user fills in: occasion type, tone, recipient name, and relationship
- The backend calls an AI API (OpenAI or Gemini) to generate a personalized message
- If AI fails, a rule-based fallback template is used instead
- The generated message is saved to a MySQL database
- Messages can be edited; each edit creates a version history record
- Messages can be linked to gift orders and greeting cards
- A dashboard shows total counts, messages by occasion, messages by tone

============================================================
TECHNOLOGY STACK
============================================================

Backend Framework: Python Flask
Database: MySQL with SQLAlchemy ORM
API Style: REST (JSON request and response)
AI Integration: OpenAI API OR Gemini API (with rule-based fallback)
Testing Tool: Postman
Deployment: Render or Railway (free tier)
Version Control: GitHub

============================================================
BACKEND RESPONSIBILITIES
============================================================

1. POST /api/messages/generate — accept inputs, call AI, save to DB, return message
2. GET /api/messages — list messages with optional filters
3. GET /api/messages/:id — return message detail plus version history
4. POST /api/messages/:id/save — mark message as saved
5. PUT /api/messages/:id — edit message, create version record, increment version number
6. GET /api/messages/:id/versions — return version history only
7. GET /api/tones — return all tone options (seeded lookup data)
8. GET /api/occasions — return all occasion options (seeded lookup data)
9. POST /api/customers — create a customer
10. GET /api/customers — list customers
11. GET /api/customers/:id — get one customer
12. POST /api/recipients — add a recipient linked to a customer
13. GET /api/recipients — list recipients
14. GET /api/dashboard/stats — return counts by occasion, tone, status, and today

============================================================
FOLDER STRUCTURE (MUST FOLLOW)
============================================================

backend/
├── app/
│   ├── __init__.py            → Flask app factory
│   ├── config.py              → All config (DB URL, API keys, debug)
│   ├── models/
│   │   ├── customer.py
│   │   ├── recipient.py
│   │   ├── occasion.py
│   │   ├── tone.py
│   │   ├── message.py
│   │   ├── message_version.py
│   │   ├── gift_order.py
│   │   └── greeting_card.py
│   ├── routes/
│   │   ├── message_routes.py
│   │   ├── customer_routes.py
│   │   ├── recipient_routes.py
│   │   ├── tone_routes.py
│   │   ├── occasion_routes.py
│   │   └── dashboard_routes.py
│   ├── services/
│   │   ├── message_service.py
│   │   ├── ai_service.py
│   │   ├── customer_service.py
│   │   └── recipient_service.py
│   ├── utils/
│   │   ├── response_helper.py
│   │   ├── validators.py
│   │   └── prompt_builder.py
│   └── seed/
│       ├── seed_tones.py
│       └── seed_occasions.py
├── tests/
├── .env
├── .env.example
├── requirements.txt
└── run.py

============================================================
CODING STANDARDS (MUST FOLLOW)
============================================================

1. Every route must use try/except and return a clean JSON error
2. Never put database queries inside route files — use service files
3. Every response must use success_response() or error_response() from response_helper.py
4. Every model must have a to_dict() method that returns a plain Python dict
5. Never hardcode API keys — always read from .env using os.getenv()
6. Every file must start with a comment explaining what it does and why it exists
7. Variable names must be clear and readable — no single letter variables (except loop counters)
8. All validation logic goes in utils/validators.py — never inside route files

============================================================
API STANDARDS
============================================================

Every API follows this format:

Success Response:
{
    "success": true,
    "data": { ... }
}

Error Response:
{
    "success": false,
    "error": "Clear message explaining what went wrong"
}

HTTP Status Codes:
- 200: Success (GET, PUT)
- 201: Created (POST)
- 400: Bad request / missing field / invalid data
- 404: Record not found
- 409: Conflict (e.g. email already exists)
- 500: Unexpected server error

============================================================
DATABASE STANDARDS
============================================================

Tables: customers, recipients, occasions, tones, messages,
        message_versions, gift_orders, greeting_cards

Rules:
- Every table has an id (INT, AUTO_INCREMENT, PRIMARY KEY)
- Every table has created_at (DATETIME DEFAULT NOW())
- Foreign keys are always defined explicitly in the model
- Lookup tables (occasions, tones) are seeded once and never modified via API
- The messages table has a status ENUM: 'generated', 'saved', 'edited', 'linked'
- Every time a message is edited, a new row is added to message_versions

============================================================
MESSAGE GENERATION LOGIC (CORE FEATURE)
============================================================

Step 1: Receive occasion_id, tone_id, recipient_id, relationship, extra_note
Step 2: Look up occasion name and tone name from database
Step 3: Build a prompt string using prompt_builder.py
Step 4: Try to call OpenAI/Gemini API with the prompt
Step 5: If AI API fails OR key not set, use rule-based fallback from ai_service.py
Step 6: Save the message text + all input fields to messages table
Step 7: Set ai_used = True if AI was used, False if fallback was used
Step 8: Return message_id, message_text, status, ai_used, version_number

Rule-based fallback example structure (in ai_service.py):
TEMPLATES = {
    "Birthday_Warm": "Wishing {recipient_name} a wonderful birthday filled with joy...",
    "Anniversary_Heartfelt": "On this special day, {recipient_name} and {relationship}...",
    "Thank You_Formal": "Dear {recipient_name}, I am sincerely grateful for...",
    "Corporate Gift_Professional": "On behalf of our team, we appreciate {recipient_name}..."
}

============================================================
REVIEW MILESTONE REQUIREMENTS
============================================================

Review 1 (June 6):
- Present: problem statement, proposed system, technology stack
- Show: working /hello route in Postman
- Push to GitHub: README, docs folder, problem statement

Review 2 (June 19-20):
- Present: architecture diagram, database schema, ER diagram, core logic
- Show: POST /api/customers, GET /api/occasions, GET /api/tones working in Postman
- Show: POST /api/messages/generate working end-to-end
- Push to GitHub: all models, routes, services built so far

Review 3 (June 29-30):
- Present: fully working prototype demo
- Show: all 14 APIs working at deployed URL
- Show: message generation with AI + fallback tested
- Deliver: project report PDF, demo video, PPT, GitHub repository

============================================================
HOW TO WORK WITH ME (ANTIGRAVITY RULES)
============================================================

RULE 1: Build ONE feature at a time, ONE file at a time
- Do not generate the entire project in one response
- Do not generate multiple files at once unless I explicitly ask
- After each file, explain: what this file does, why it exists, what it connects to

RULE 2: Always explain before generating code
- Tell me the purpose of the file
- Tell me which other files it connects to
- Tell me what the student will see or test after this step

RULE 3: Follow this exact build order:
Phase 1: Skeleton (run.py, __init__.py, config.py, requirements.txt)
Phase 2: Database connection (config + first model: customer)
Phase 3: First route (POST /api/customers)
Phase 4: Lookup tables (occasions + tones + seed scripts + GET routes)
Phase 5: Remaining models (recipient, message, message_version, gift_order, greeting_card)
Phase 6: Validators (utils/validators.py)
Phase 7: AI service (prompt_builder.py + ai_service.py with fallback first)
Phase 8: Generate endpoint (POST /api/messages/generate — the CORE feature)
Phase 9: Remaining CRUD (list, detail, save, edit, versions)
Phase 10: Dashboard and recipients
Phase 11: Error handling pass (wrap all routes)
Phase 12: Deployment setup

RULE 4: When the student says "next" — give the next file in the build order

RULE 5: Ask for confirmation before making any architectural change

RULE 6: If the student seems confused, simplify the explanation before continuing

RULE 7: Treat every variable name, comment, and folder name as something a beginner
will read — make it clear and readable, not clever

============================================================
START COMMAND
============================================================

When I say "START PHASE 1" — begin with requirements.txt only.
Explain every package and why it is needed.
Wait for my confirmation before generating run.py.

When I say "NEXT" — give the next file in the current phase.
When I say "SKIP TO PHASE X" — jump to that phase.
When I say "EXPLAIN [topic]" — explain that concept in plain language before continuing.
When I say "TEST THIS" — give me the exact Postman steps to test the last file generated.

============================================================
```

---

*Document prepared for: Paper Plane Internship | Student 2 — Backend | June 2026*
