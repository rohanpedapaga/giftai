# Backend Architecture Explained

This document explains the technical architecture, design patterns, folder structure, and execution flow of the **AI Personalized Message Generator** backend.

---

## 1. Core Architecture Overview
The backend is built as a RESTful JSON API using **Python Flask** and **MySQL**. It is designed with modularity, scalability, and clean separation of concerns in mind. The architecture is split into five distinct layers:

```
[Client / React App] 
       | (JSON Requests over HTTP)
       v
[1. Routing Controllers (app/routes/)] 
       | (Extracts payloads, runs schema validations)
       v
[2. Validation Layer (app/utils/validators.py)]
       | (Secures input parameters)
       v
[3. Business Logic (app/services/)]
       | (Coordinates algorithms, prompt assembly, and external AI calls)
       v
[4. External Integrations (app/services/ai_service.py)] ---> Calls Gemini API
       |
       v
[5. Database Layer (app/models/)] ---> Writes to MySQL Server
```

---

## 2. Key Technology Choices
1.  **Python Flask**: A lightweight, micro web framework. Flask was selected because it offers extreme flexibility for structuring small-to-medium APIs without forcing a rigid directory structure (unlike Django).
2.  **Flask-SQLAlchemy**: Wraps the SQLAlchemy Object-Relational Mapper (ORM) to provide pythonic database transactions, connection pooling, and object mapping.
3.  **google-generativeai**: The official Google API SDK used to connect to `gemini-1.5-flash` for high-speed, cost-effective greeting card content generation.
4.  **python-dotenv**: Decouples config settings and secrets (like database passwords and API keys) from the code, loading them into standard system environment variables.
5.  **Flask-CORS**: Enables Cross-Origin Resource Sharing so our React frontend teammate can query the backend from a different local port (e.g., `localhost:3000`) without browser security blocks.

---

## 3. Design Patterns Implemented

### Application Factory Pattern
Instead of initializing a global `app` variable inside files, we declare a single `create_app()` factory inside [app/__init__.py](file:///e:/Ai%20personalized%20message%20generator/backend/app/__init__.py).
*   **Why**: It prevents circular dependencies, allows dynamic configurations, and enables spawning multiple test instances of the app.

### Service Layer Pattern
We separate route definitions (controllers) from direct database querying. 
*   **Routes** ([app/routes/](file:///e:/Ai%20personalized%20message%20generator/backend/app/routes/)) only handle parsing incoming JSON requests, triggering validations, calling services, and responding with JSON.
*   **Services** ([app/services/](file:///e:/Ai%20personalized%20message%20generator/backend/app/services/)) contain all business queries, database commits, calculations, and external API requests.
*   **Why**: If we ever decide to switch our database ORM or change how the AI is called, we only update the service file. The route files remain completely untouched.

### Response Helper Pattern
All endpoints format their output using `success_response()` or `error_response()` from [app/utils/response_helper.py](file:///e:/Ai%20personalized%20message%20generator/backend/app/utils/response_helper.py).
*   **Why**: Guarantees that the frontend teammate always receives JSON in the exact same format (`{ "success": true, "data": ... }` or `{ "success": false, "error": ... }`), making client-side error handling straightforward.

---

## 4. Directory Structure Purpose

*   `app/models/`: Holds the ORM definitions. Each file maps directly to a MySQL database table.
*   `app/routes/`: Contains Flask Blueprints. Each file groups routes by resource area (e.g., `customer_routes.py`, `message_routes.py`).
*   `app/services/`: Implements the transactional and external services of the application.
*   `app/utils/`: Standardizes formatting helpers, prompt builders, and input check functions.
*   `app/seed/`: Programmatic backup script configurations for loading lookup tables.
*   `database/`: Holds the raw SQL DDL file to initialize the physical database.
*   `run.py`: The single executable entry point that starts the server.
