# Internship Review Q&A Guide

This guide compiles potential questions, explanations, and model answers to prepare you for **Review 2** and **Review 3** evaluations.

---

## Part 1: Review 2 Milestones (Architecture, Schema, & Initial Setup)

### Q1: Can you explain the folder structure pattern you implemented?
*   **Technical Answer**: We used the **Application Factory pattern** using Flask Blueprints, segregating controllers (`routes/`), business services (`services/`), database entities (`models/`), and validator checkers (`utils/`).
*   **Beginner Answer**: We separated our folders so that the route files only handle URLs, the models only handle database tables, and the service files handle the heavy-duty code (like database saves and AI calculations).

### Q2: What storage engine did you configure in MySQL and why does it matter?
*   **Technical Answer**: We specified `ENGINE=InnoDB`. InnoDB supports ACID transactions, row-level locking, and foreign key integrity constraints.
*   **Beginner Answer**: We chose `InnoDB` because it enforces our foreign keys. This guarantees that tables remain connected and doesn't allow invalid database writes.

### Q3: What is the purpose of the `message_versions` table and how does it relate to normalization?
*   **Technical Answer**: The `message_versions` table acts as a historical audit trail. Keeping it separate normalizes the `messages` table by preventing multi-valued columns or repeating groups, ensuring fast retrieval speeds.
*   **Beginner Answer**: We split them so the main `messages` table only stores the latest message text. Older drafts are archived into `message_versions` so the active tables remain small and fast.

### Q4: Why did you implement input validation in a separate utility rather than inside the routes?
*   **Technical Answer**: Separation of concerns. Writing checks inside route files clutters the controllers. Keeping validators in `utils/validators.py` enables reusability and cleaner testing.
*   **Beginner Answer**: It keeps our code organized. Route files should only manage sending and receiving requests. All security and formatting checks are grouped into one validators helper file.

### Q5: How did you configure CORS in your Flask app?
*   **Technical Answer**: We used `Flask-CORS` configured globally in `app/__init__.py` to inject standard headers allowing cross-origin requests.
*   **Beginner Answer**: We enabled CORS so that our React frontend running on a different port can communicate with this Flask backend without security errors.

---

## Part 2: Review 3 Milestones (Full Integration & Deployment)

### Q6: How does the AI Message Generation service handle failures or missing API credentials?
*   **Technical Answer**: The generation module uses a try/except try block wrapping the Gemini SDK execution. If a connection exception is raised or `GEMINI_API_KEY` is undefined, it automatically defaults to a local lookup table of pre-written templates.
*   **Beginner Answer**: We set up a backup template engine. If the internet fails or we run out of AI API credits, our code grabs a matching pre-written card message from our templates list instead of crashing.

### Q7: Why is it important that database queries are kept out of route files and run in service files?
*   **Technical Answer**: Adheres to the **Service Layer Pattern**. Separation of business logic from transport logic (HTTP) keeps the codebase clean, modular, and easier to write unit tests for.
*   **Beginner Answer**: If we decide to swap MySQL for PostgreSQL in the future, we only have to change the code inside our service files, rather than editing dozens of API routes.

### Q8: What does the `/dashboard/stats` endpoint return and how does it calculate metrics?
*   **Technical Answer**: It uses SQLAlchemy aggregation functions (`db.func.count`) combined with SQL `join()` and `group_by()` filters to calculate count metrics on the database server, returning them in a single REST request.
*   **Beginner Answer**: It runs count queries in the database to get total messages generated, today's count, and groups them by event occasions and tones to show statistics on the frontend.

### Q9: How does the versioning system increment the version number of a message?
*   **Technical Answer**: During a `PUT` edit request, the message service reads the current version number, writes the old message text into `message_versions`, increments the main message's `version_number` by 1, and commits.
*   **Beginner Answer**: When you edit a message, we take a screenshot of the old text and save it to the versions table. Then we add 1 to the message's version counter and update the active text.

### Q10: How does the `/process` API endpoint link a greeting message to an order?
*   **Technical Answer**: The endpoint parses `gift_order_id` and updates the `messages` table columns. It changes the message `status` ENUM value to `'linked'`, establishing the relationship.
*   **Beginner Answer**: The `/process` endpoint changes the status of a message to "linked" and writes down the specific card or gift order ID it belongs to.
