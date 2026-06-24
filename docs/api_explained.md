# REST API Contract Specifications

This document outlines the API route list, required request parameters, successful response payloads, validation rules, and error states for the **AI Personalized Message Generator**.

---

## 1. Global Standards
*   **Base URL**: `http://localhost:5000/api`
*   **Content-Type**: `application/json`
*   **Standard Success Format**:
    ```json
    {
      "success": true,
      "data": { ... }
    }
    ```
*   **Standard Error Format**:
    ```json
    {
      "success": false,
      "error": "Detailed explanation of what went wrong"
    }
    ```

---

## 2. API Endpoint List

### 1. POST `/api/customers`
*   **Purpose**: Create a new customer profile.
*   **Request Body**:
    ```json
    {
      "name": "Jane Doe",
      "email": "jane@example.com",
      "phone": "+1234567890" // optional
    }
    ```
*   **Response 201 (Created)**:
    ```json
    {
      "success": true,
      "data": {
        "id": 1,
        "name": "Jane Doe",
        "email": "jane@example.com",
        "phone": "+1234567890",
        "created_at": "2026-06-06T11:00:00"
      }
    }
    ```
*   **Error Cases**:
    *   `400 Bad Request`: Missing `name` or `email`, or invalid email format.
    *   `409 Conflict`: Email already exists in the system.

---

### 2. POST `/api/recipients`
*   **Purpose**: Register a recipient contact under a customer.
*   **Request Body**:
    ```json
    {
      "customer_id": 1,
      "name": "Mom",
      "relationship": "Mother",
      "important_date": "1975-08-12" // optional (YYYY-MM-DD)
    }
    ```
*   **Response 201 (Created)**:
    ```json
    {
      "success": true,
      "data": {
        "id": 2,
        "customer_id": 1,
        "name": "Mom",
        "relationship": "Mother",
        "important_date": "1975-08-12",
        "created_at": "2026-06-06T11:05:00"
      }
    }
    ```
*   **Error Cases**:
    *   `400 Bad Request`: Missing fields, customer_id not an integer, or invalid date format.
    *   `404 Not Found`: The parent `customer_id` does not exist in the database.

---

### 3. GET `/api/tones` & GET `/api/occasions`
*   **Purpose**: Fetch all seeded lookups to populate frontend dropdown selectors.
*   **Response 200 (Success)**:
    ```json
    {
      "success": true,
      "data": [
        { "id": 1, "name": "Warm", "description": "Friendly and personal" }
      ]
    }
    ```

---

### 4. POST `/api/messages/generate` (Aliases: `/api/messages/create`, `/api/create`)
*   **Purpose**: Create a greeting message via AI or fallback templates.
*   **Request Body**:
    ```json
    {
      "customer_id": 1,
      "recipient_id": 2,
      "occasion_id": 1,
      "tone_id": 1,
      "relationship": "Mother",
      "extra_note": "She loves gardening" // optional
    }
    ```
*   **Response 201 (Created)**:
    ```json
    {
      "success": true,
      "data": {
        "id": 45,
        "customer_id": 1,
        "recipient_id": 2,
        "occasion_id": 1,
        "tone_id": 1,
        "relationship": "Mother",
        "message_text": "Wishing the best mom a wonderful birthday! May your garden always bloom beautifully.",
        "status": "generated",
        "ai_used": true,
        "gift_order_id": null,
        "greeting_card_id": null,
        "version_number": 1,
        "created_at": "2026-06-06T11:10:00",
        "updated_at": "2026-06-06T11:10:00"
      }
    }
    ```
*   **Error Cases**:
    *   `400 Bad Request`: Missing required parameters or invalid types.
    *   `404 Not Found`: Customer, recipient, occasion, or tone ID not found.

---

### 5. GET `/api/messages` (Aliases: `/api/messages/list`, `/api/list`)
*   **Purpose**: Pull messages with optional pagination and filters.
*   **Query Parameters**:
    *   `status` (string, optional: `generated`, `saved`, `edited`, `linked`)
    *   `customer_id` (integer, optional)
    *   `occasion_id` (integer, optional)
    *   `page` (integer, default `1`)
    *   `limit` (integer, default `10`)
*   **Response 200 (Success)**:
    ```json
    {
      "success": true,
      "data": [
        { "id": 45, "message_text": "...", "status": "generated" }
      ],
      "total": 12,
      "page": 1,
      "limit": 10
    }
    ```

---

### 6. GET `/api/messages/<id>` (Aliases: `/api/messages/detail/<id>`, `/api/detail/<id>`)
*   **Purpose**: Fetch message details along with its version history stack.
*   **Response 200 (Success)**:
    ```json
    {
      "success": true,
      "data": {
        "id": 45,
        "message_text": "Active greeting",
        "status": "edited",
        "version_number": 2,
        "version_history": [
          {
            "id": 1,
            "message_id": 45,
            "version_number": 1,
            "message_text": "Original generated draft text",
            "edited_by": "customer",
            "created_at": "2026-06-06T11:10:00"
          }
        ]
      }
    }
    ```

---

### 7. PUT `/api/messages/<id>`
*   **Purpose**: Update active greeting text (automatically archives old text in history log).
*   **Request Body**:
    ```json
    {
      "message_text": "This is my custom updated message text",
      "edited_by": "customer" // optional: 'customer', 'designer', 'admin'
    }
    ```
*   **Response 200 (Success)**:
    ```json
    {
      "success": true,
      "data": {
        "id": 45,
        "message_text": "This is my custom updated message text",
        "status": "edited",
        "version_number": 2
      }
    }
    ```

---

### 8. POST `/api/messages/<id>/save`
*   **Purpose**: Mark message status as `saved`.
*   **Response 200 (Success)**:
    ```json
    {
      "success": true,
      "data": {
        "id": 45,
        "status": "saved"
      }
    }
    ```

---

### 9. POST `/api/messages/process` (Aliases: `/api/messages/<id>/process`, `/api/process`)
*   **Purpose**: Process and transition message state. Can link to an order or greeting card.
*   **Request Body**:
    ```json
    {
      "message_id": 45, // optional if ID is in path
      "status": "linked",
      "gift_order_id": 15, // optional
      "greeting_card_id": 2 // optional
    }
    ```
*   **Response 200 (Success)**:
    ```json
    {
      "success": true,
      "data": {
        "id": 45,
        "status": "linked",
        "gift_order_id": 15,
        "greeting_card_id": 2
      }
    }
    ```

---

### 10. GET `/api/dashboard/stats` (Alias: `/api/dashboard`)
*   **Purpose**: Fetch aggregated summary metrics for statistics dashboards.
*   **Response 200 (Success)**:
    ```json
    {
      "success": true,
      "data": {
        "total_messages": 120,
        "messages_today": 8,
        "messages_by_status": {
          "generated": 20,
          "saved": 80,
          "edited": 15,
          "linked": 5
        },
        "messages_by_occasion": [
          { "occasion": "Birthday", "count": 55 }
        ],
        "messages_by_tone": [
          { "tone": "Warm", "count": 60 }
        ]
      }
    }
    ```
