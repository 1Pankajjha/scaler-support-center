# Scaler Support Center

A modern, production-ready Full-Stack Support Center application tailored to Scaler Academy's robust standards.

## 🚀 Features

### **User Portal (Frontend)**
- Minimalistic, pristine homepage design emphasizing "Fast Support Access" with a central search bar.
- Interactive Chat Widget mock (prepared for internal AI/API integration) for real-time support.
- Clear escalation rules explicitly visible directly on the main page.
  
### **Admin Dashboard (Frontend)**
- Mocked secure Google authentication.
- Access strictly restricted to `@scaler.com` emails to protect internal tools.
- Dynamic layout with Ticket Insights, FAQ Management, Team Performance, and Reporting modules.

### **Backend Server (API)**
- Built with Node.js, Express, and SQLite.
- Fully RESTful application programming interface.
- Zero-configuration local database using `better-sqlite3`. Contains sample ticketing API and analytics.

---

## 💻 Tech Stack
- Frontend: React (Vite setup), React Router, Lucide React Icons.
- Styling: Custom premium Vanilla CSS design system via CSS modules/variables.
- Backend: Node.js, Express.js, better-sqlite3 (SQL database).

---

## 🛠 Setup Instructions

The application requires two separate terminal windows to run both ends concurrently.

### 1. Backend Setup (Terminal 1)

Navigate to the project directory and into the backend folder:
```bash
cd backend
npm install
node seed.js  # Runs the seeder to populate dummy FAQs and Tickets
npm run start
```
The backend API server will listen on `http://localhost:5001`.

### 2. Frontend Setup (Terminal 2)

Navigate to the project's frontend folder:
```bash
cd frontend
npm install
npm run dev
```
The React frontend local server will start (typically accessible via `http://localhost:5173`).

---

## 🧪 Testing Guidelines
- **End-User Flow**: Open the Web Dashboard. Click "Contact Support via Chatbot" to test the UI interactions. Read the clear Escalation system constraints.
- **Admin Authentication**: Click the `Admin` hyperlink on the top right. The authentication system requires an `@scaler.com` address. Try logging in with `user@gmail.com` — it will explicitly deny access. Retry with `test@scaler.com` to see the success state routing you to the restricted Admin Panel.
- **Admin Usage**: View the pre-seeded metrics on the dashboard (24 total open, etc.) simulated via the frontend.

Designed with clean aesthetics per the custom architecture brief.
