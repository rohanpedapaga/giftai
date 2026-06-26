# WishForge

**AI-Powered Personalized Greeting Message Generator**

WishForge is a full-stack, AI-powered web application designed to generate highly personalized, context-aware greeting messages. By combining large language model intelligence with robust role mapping and structured validation, WishForge addresses the shortcomings of generic greeting templates, eliminates robotic cliché language, and resolves relationship perspective errors to produce authentic, human-like messages.

---

## Project Overview

WishForge was developed to bring personalization and emotional depth to digital greetings. The application leverages AI and structured metadata to build custom-tailored messages for a variety of relationships and occasions.

- **What WishForge is:** A web platform where users can generate, save, edit, and organize greeting card messages.
- **The Problem It Solves:** Traditional greeting card generator tools write generic, cliché statements, and often reverse the perspective between sender and recipient (e.g., writing *from* a parent rather than *to* a parent). WishForge enforces deterministic role mapping to guarantee correct perspective and natural addressing.
- **How AI is Used:** WishForge integrates with the **Groq API** (utilizing the high-performance `llama-3.3-70b-versatile` model) to construct customized cards on a single-request cycle. Prompt engineering prevents AI clichés (like *"I cherish our bond"*) and ensures natural, warm language.
- **Who Can Use the Application:** General users who want to craft meaningful messages for family, friends, colleagues, or managers; and Administrators who need to manage users, monitor database operations, track global stats, and view live API diagnostics.

---

## Project Highlights

- **AI-Powered Personalized Greeting Generation:** Tailors messages in real time based on recipient name, occasion, tone, and extra context notes.
- **Context-Aware Prompt Engineering:** Restructures perspective logic to prevent robotic repetition of names and ban generic card clichés.
- **Secure JWT Authentication:** Secures frontend-backend API requests with JSON Web Tokens and HTTP-only session mechanics.
- **Email OTP Password Recovery:** Facilitates secure, out-of-band account recovery using OTP codes sent via Brevo.
- **Role-Based Dashboards:** Offers dedicated interfaces for general users and system administrators.
- **Persistent Favorites Folder:** Allows users to persistent-heart cards, search, sort, copy, or download them in text format.
- **Sleek, Responsive UI:** Styled with premium CSS variables, glassmorphic effects, and fluid grid layouts optimized down to 320px width.
- **Production Deployment:** Configured for cloud hosting with separate frontend and backend pipelines.

---

## Key Features

- **AI-Powered Personalized Message Generation:** Instantly crafts high-quality greetings using selected parameters.
- **Context-Aware Message Creation:** Integrates user-supplied custom notes directly into the generated message.
- **Multiple Occasions:** Pre-seeded with options like Birthdays, Anniversaries, Festivals, Achievements, and more.
- **Multiple Emotional Tones:** Generates messages in Warm, Heartfelt, Funny, Formal, Professional, or Inspirational tones.
- **Secure User Authentication:** Implements JWT-secured session validation, register, and login flows.
- **Forgot Password with Email OTP:** Provides automated password reset using email-delivered numeric codes via Brevo.
- **Admin Dashboard:** Enables administrators to monitor live API logs, view active statistics, and filter system-wide activity logs.
- **User Dashboard:** Empowers users to view their generation history, manage saved cards, and configure presets.
- **Favorites Folder:** Persistent database storage for favored messages with options to edit, copy, or download.
- **Saved Messages:** Automatic history logging of all successfully generated greeting messages.
- **Message History:** Easy access to previously generated messages, searchable by recipient or occasion.
- **Responsive Design:** Designed with a fluid layout that fits gracefully on desktops, tablets, and phones.
- **Mobile-Friendly Interface:** Tailored UI with collapsible sidebar menus and touch-friendly controls.
- **Role-Based Access:** Enforces permission checks separating general users and system administrators.
- **AI-Generated Unique Messages:** Guarantees that every message generated is fresh and unique.

---

## System Architecture

The following diagram illustrates the flow of data through WishForge:

```
Frontend (React / Preact)
          ↓ (REST API / JWT)
   REST API (Flask)
    ↓            ↓
MySQL DB     Groq AI & Brevo SMTP
```

- **Frontend (React):** Built on Preact and HTM to enable a lightweight React component architecture with zero compile-time overhead. Renders the interactive forms, manages route states, and communicates with the backend via fetch requests.
- **REST API (Flask):** The Python web backend that serves API endpoints. It validates JWT tokens, implements rate limits using Flask-Limiter, resolves relationships, and coordinates service layers.
- **MySQL Database:** Relational database storage holding users, customer profiles, generated messages, and seeded lookup values (occasions and tones).
- **Groq AI:** LLM inference API used to generate greetings. Receives structured prompts containing relationship contexts and outputs clean greeting card text.
- **Brevo Email Service:** Transactional email provider sending verification OTP codes to users for the security recovery sequence.

---

## Technology Stack

### Frontend
- **React** (Preact/HTM for zero-bundling lightweight component structure)
- **JavaScript** (ES6+ client-side logic)
- **HTML5** (Semantic structure)
- **CSS3** (Custom properties, dark/light theme tokens, and glassmorphism)

### Backend
- **Python** (Core backend runtime)
- **Flask** (Micro web framework)
- **SQLAlchemy** (Object-Relational Mapping database wrapper)

### Database
- **MySQL** (Relational SQL engine)

### AI
- **Groq API** (`llama-3.3-70b-versatile` model)

### Email Service
- **Brevo** (SMTP / transactional email API)

### Deployment
- **Render** (Backend API hosting)
- **Vercel** (Frontend client hosting)

---

## API Overview

### Authentication
- `POST /api/auth/register` - Registers a new user account.
- `POST /api/auth/login` - Authenticates user credentials and returns a secure session.
- `POST /api/auth/logout` - Terminates active session.
- `POST /api/auth/forgot-password` - Sends a numeric OTP code via Brevo to the user's email.
- `POST /api/auth/verify-otp` - Verifies the correctness of the recovery OTP.
- `POST /api/auth/reset-password` - Updates the user's password following successful verification.

### Messages
- `POST /api/messages/generate` - Resolves relationship direction and fetches greeting from Groq AI.
- `GET /api/messages/history` - Returns previously generated messages for the user.
- `PUT /api/messages/favorite/<id>` - Toggles the favorite heart status of a saved message.
- `GET /api/messages/favorites` - Returns all marked favorite cards.
- `DELETE /api/messages/<id>` - Removes a greeting card from the database.

### Admin
- `GET /api/admin/stats` - Compiles counts, active users, and API utilization statistics.
- `GET /api/admin/logs` - Retrieves filtered logs of all database actions and audit trails.
- `GET /api/admin/diagnostics` - Exposes raw JSON parameters from the latest Groq API requests.

---

## Project Structure

```
├── Frontend/                           # Frontend Client Assets
│   ├── index.html                      # Main HTML Entrypoint (semantic markup)
│   ├── script.js                       # React component definitions, state, and router
│   └── style.css                       # Global design design system, animations, variables
├── backend/                            # Flask Server Application
│   ├── app/                            # Backend Core Package
│   │   ├── models/                     # SQLAlchemy Relational Models (User, Message, Recipient, Tone)
│   │   ├── routes/                     # Flask REST API Controller blueprints
│   │   ├── services/                   # Service wrappers (Groq AI client, Brevo SMTP client)
│   │   ├── seed/                       # Database lookups data populations scripts
│   │   ├── utils/                      # Helper tools (prompt builders, validators)
│   │   └── __init__.py                 # Flask App creation and plugin setup
│   ├── database/                       # Schema SQL definitions and migration files
│   ├── run.py                          # Server starter, database sync, and seed executor
│   ├── requirements.txt                # Python package list
│   └── venv/                           # Python Virtual Environment (ignored)
├── LICENSE                             # MIT License
├── README.md                           # Project Documentation
└── .gitignore                          # Exclusions for version control
```

---

## Installation Guide

### 1. Clone the Repository
```bash
git clone https://github.com/rohanpedapaga/giftai.git
cd giftai
```

### 2. Configure Backend
Navigate to the `backend/` directory, create a Python virtual environment, and install dependencies:
```bash
cd backend
python -m venv venv

# Activate Virtual Environment:
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install requirements:
pip install -r requirements.txt
```

### 3. Set Up Environment Variables
Create a file named `.env` in the `backend/` directory using the template shown in the [Environment Variables](#environment-variables) section below.

### 4. Initialize Database & Run Backend
Ensure your local MySQL server is running. The backend script will automatically inspect, create missing database tables, seed lookup items, and start the development server on `http://127.0.0.1:5000`:
```bash
python run.py
```

### 5. Run Frontend
The frontend requires no compilation or packaging. It can be opened directly or served with a local web server:
- Option A: Open `Frontend/index.html` directly in a browser.
- Option B: Serve locally from the project root:
  ```bash
  npx serve ./Frontend
  ```

---

## Environment Variables

Create a file named `.env` in the `backend/` directory. Use the following placeholders:

```ini
# Application Configurations
SECRET_KEY=your_secret_key
FLASK_ENV=development
FLASK_DEBUG=True
PORT=5000

# Database Configuration (MySQL)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_PORT=3306
DB_NAME=wishforge_db

# Admin User Initialization Credentials
ADMIN_EMAIL=admin@wishforge.com
ADMIN_PASSWORD=your_admin_password

# Groq LLM API Credentials
GROQ_API_KEY=gsk_your_groq_api_key

# Brevo (Sendinblue) Transactional Email Credentials
BREVO_API_KEY=xkeysib-your_brevo_api_key
BREVO_SENDER_EMAIL=sender@wishforge.com
BREVO_SENDER_NAME=WishForge
```

---

## Deployment

WishForge is configured for production deployments:
- **Frontend:** Hosted on **Vercel** as a static single-page application.
- **Backend:** Hosted on **Render** (Python/Flask web service instance).
- **Database:** Hosted on a managed **MySQL** database cluster.
- **Email Delivery:** Transactional emails and authentication OTPs are routed through **Brevo**.
- **AI Engine:** Prompt evaluations and text inferences are executed by **Groq**.

---

## Usage Guide

### Register & Login
1. Navigate to the app in your browser.
2. Sign up on the registration tab by providing an email and a password.
3. Access the main interface by logging in.

### Generate & Save Messages
1. Go to the Generator tab.
2. Fill in the recipient's name.
3. Choose the relationship from the **"Recipient is my..."** dropdown (e.g., *Dad*, *Mom*, *Boss*).
4. Select the occasion, tone, and optionally input custom notes.
5. Click **Generate**. The animated loader will track processing steps.
6. The created greeting card is saved to your account history automatically.

### Favorite Messages
1. Click the heart icon on any generated or saved card.
2. Visit the Favorites tab to view, search, sort, copy, or download your favorited greetings.

### Password Reset
1. Click "Forgot Password" on the login screen.
2. Provide your email. The app will trigger an OTP email using Brevo.
3. Enter the numeric OTP to verify identity, then provide a new password.

### Admin Dashboard
1. Log in with an account having admin privileges.
2. Use the navigation links to access statistics, system activity audits, and raw Groq prompt diagnostic panels.

---

## Screenshots

- **Login Screen:** Glassmorphic card login container.  
  *(Placeholder for login.png)*
- **User Dashboard:** Workspace with generator form and history records.  
  *(Placeholder for dashboard.png)*
- **AI Generation:** Output card showing generated content and action triggers.  
  *(Placeholder for ai_generation.png)*
- **Favorites Library:** Persistent folder showing loved greeting cards.  
  *(Placeholder for favorites.png)*
- **Admin Dashboard:** Activity audits, log filters, and API diagnostics.  
  *(Placeholder for admin_dashboard.png)*
- **Forgot Password:** Email input and OTP input forms.  
  *(Placeholder for forgot_password.png)*
- **Mobile View:** Collapsed side navigation drawer and fluid card sizing.  
  *(Placeholder for mobile_view.png)*

---

## Future Enhancements

- **Multi-language Support:** Translation capabilities to render greetings in multiple languages.
- **Voice Greeting Generation:** Audio narration of greeting cards using text-to-speech models.
- **More AI Providers:** Integrations with Google Gemini and OpenAI.
- **Smart Recommendations:** Recommending occasions or tones based on the time of year.
- **Team Collaboration:** Enabling team members to share cards and collaborative notes.

---

## Author

**Rohan Pedapaga**  
[GitHub Profile](https://github.com/rohanpedapaga)

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
