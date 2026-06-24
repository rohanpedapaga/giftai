# Frontend Integration Guide

This guide helps frontend teammates (building in React/JS) integrate their components with our Python Flask + MySQL backend.

---

## 1. Connection Configurations
*   **Backend Base URL**: `http://localhost:5000/api`
*   **CORS Support**: Cross-Origin Resource Sharing is enabled globally on the backend. You can make fetch or Axios calls directly from your dev environment (e.g., `http://localhost:3000`) without hitting browser block policies.

---

## 2. API Service Setup Example (React/JS)
Create a file named `services/api.js` in your React project and configure the requests:

```javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================================
// 1. Fetching Lookups (for Dropdown Selectors)
// ============================================================
export const getTones = async () => {
  const response = await apiClient.get('/tones');
  return response.data; // Formatted as { success: true, data: [...] }
};

export const getOccasions = async () => {
  const response = await apiClient.get('/occasions');
  return response.data;
};

// ============================================================
// 2. Customer & Recipient Management
// ============================================================
export const createCustomer = async (customerData) => {
  // customerData: { name, email, phone }
  const response = await apiClient.post('/customers', customerData);
  return response.data;
};

export const addRecipient = async (recipientData) => {
  // recipientData: { customer_id, name, relationship, important_date }
  const response = await apiClient.post('/recipients', recipientData);
  return response.data;
};

// ============================================================
// 3. Message Actions
// ============================================================
export const generateMessage = async (params) => {
  /*
    params: {
      customer_id,
      recipient_id,
      occasion_id,
      tone_id,
      relationship,
      extra_note // optional
    }
  */
  const response = await apiClient.post('/messages/generate', params);
  return response.data;
};

export const updateMessageText = async (messageId, text, role = 'customer') => {
  const response = await apiClient.put(`/messages/${messageId}`, {
    message_text: text,
    edited_by: role
  });
  return response.data;
};

export const saveMessage = async (messageId) => {
  const response = await apiClient.post(`/messages/${messageId}/save`);
  return response.data;
};

export const processStatusUpdate = async (params) => {
  /*
    params: {
      message_id,
      status: 'linked',
      gift_order_id: 12,
      greeting_card_id: 3
    }
  */
  const response = await apiClient.post('/messages/process', params);
  return response.data;
};

// ============================================================
// 4. Dashboard Queries
// ============================================================
export const getDashboardStats = async () => {
  const response = await apiClient.get('/dashboard/stats');
  return response.data;
};
```

---

## 3. Integrating with React Components

### Populating Selection Menus on Load
```javascript
import React, { useEffect, useState } from 'react';
import { getOccasions, getTones } from '../services/api';

function MessageForm() {
  const [occasions, setOccasions] = useState([]);
  const [tones, setTones] = useState([]);

  useEffect(() => {
    // Load lookup values on component mount
    getOccasions().then(res => {
      if (res.success) setOccasions(res.data);
    });
    getTones().then(res => {
      if (res.success) setTones(res.data);
    });
  }, []);

  return (
    <form>
      <label>Select Occasion:</label>
      <select name="occasion_id">
        {occasions.map(occ => (
          <option key={occ.id} value={occ.id}>{occ.name}</option>
        ))}
      </select>
      {/* ... Tones list and inputs ... */}
    </form>
  );
}
```

### Submitting Generation Forms
```javascript
const handleGenerate = async (formData) => {
  try {
    const result = await generateMessage(formData);
    if (result.success) {
      // Access the generated message text
      const greetingText = result.data.message_text;
      const messageId = result.data.id;
      // Update your UI state
    } else {
      alert(`Error: ${result.error}`);
    }
  } catch (error) {
    const errorMsg = error.response?.data?.error || "Failed to generate message";
    alert(errorMsg);
  }
};
```

---

## 4. Response & Error Standard Checks
The backend returns error parameters wrapped in a consistent format:
*   Always check the **`success`** flag.
*   If `success === true`, the return model is inside the **`data`** attribute.
*   If `success === false`, the error detail description is inside the **`error`** attribute.
*   Catch blocks will receive HTTP error status codes (like `400`, `404`, `409`, or `500`). Check `error.response.data.error` to render the backend's validation message on your screens.
