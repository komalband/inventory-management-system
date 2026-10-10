# Inventory Management System

Full-stack CRUD app: HTML/CSS/JavaScript frontend, Python Flask backend, SQLite database.

## Features
- Add, list, search (name/ID/category), update stock/price, delete products
- Input validation (frontend, backend, database constraints)
- Low-stock alerts, no page reloads (Fetch API)

## Run
**Backend**
    cd backend
    python -m venv venv
    venv\Scripts\activate
    pip install -r requirements.txt
    python app.py

**Frontend** (new terminal)
    cd frontend
    npx live-server

Backend: http://127.0.0.1:5000 | Frontend: http://127.0.0.1:8080