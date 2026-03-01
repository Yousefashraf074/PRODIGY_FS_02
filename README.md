<p align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/Keycloak-4D4D4D?style=for-the-badge&logo=keycloak&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" />
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" />
</p>

# 👥 Employee Management System

> **Prodigy InfoTech — Full Stack Development Internship — Task 02**
>
> A full-stack Employee Management System featuring complete CRUD operations, secure authentication & authorization via Keycloak, a modern dark-themed dashboard UI, and a RESTful API backend.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [API Endpoints](#-api-endpoints)
- [Authentication Flow](#-authentication-flow)
- [Environment Variables](#-environment-variables)
- [Screenshots](#-screenshots)
- [License](#-license)

---

## 🔍 Overview

This project is a complete **Employee Management System (EMS)** built as part of the Prodigy InfoTech Full Stack Development Internship (Task 02). It allows authenticated administrators to manage employee records through an intuitive web dashboard. Authentication and authorization are handled externally by **Keycloak**, an industry-standard open-source Identity and Access Management (IAM) solution, ensuring enterprise-grade security without rolling custom auth.

---

## ✨ Features

### 🔐 Authentication & Security
- **Keycloak SSO Integration** — Single Sign-On via OpenID Connect
- **JWT Token Verification** — Backend validates tokens using JWKS with RSA signature verification
- **Role-Based Access Control** — `ems-admin` realm role for administrators
- **Token Caching** — JWKS keys cached for 5 minutes to optimize performance
- **Automatic Realm Setup** — One-command script to configure the Keycloak realm, client, roles, and default user

### 👤 Employee Management (Full CRUD)
- **Create** — Add new employees with validation (name, email, phone, department, position, salary, hire date, status)
- **Read** — View all employees in a paginated, sortable data table with search and filters
- **Update** — Edit any employee record with pre-populated forms
- **Delete** — Remove employees with confirmation dialog

### 📊 Dashboard & Analytics
- **Overview Stats** — Total employees, active count, department count, average salary
- **Department Breakdown** — Visual bar chart showing employees per department
- **Status Distribution** — Donut chart of Active / Inactive / On Leave employee counts

### 🎨 User Interface
- **Modern Dark Theme** — Sleek dark UI with gradient accents and glassmorphism effects
- **Responsive Design** — Fully responsive layout with collapsible sidebar for mobile
- **Interactive Tables** — Sortable columns, search-as-you-type, department & status filters
- **Animated Elements** — Floating gradient circles, smooth transitions, hover effects
- **Toast Notifications** — Success/error feedback on every operation

### 🔧 Additional
- **Input Validation** — Both client-side and server-side validation with descriptive error messages
- **Duplicate Detection** — Prevents duplicate employee email entries
- **Pagination** — Configurable page sizes with navigation controls
- **Status Management** — Track employees as Active, Inactive, or On Leave

---

## 🛠 Tech Stack

| Layer          | Technology                                                     |
| -------------- | -------------------------------------------------------------- |
| **Frontend**   | HTML5, CSS3 (custom dark theme), Vanilla JavaScript            |
| **Backend**    | Node.js, Express.js                                            |
| **Database**   | SQLite (via sql.js — in-process, zero-config)                  |
| **Auth**       | Keycloak 26.0 (OpenID Connect, JWT, JWKS)                      |
| **Container**  | Docker & Docker Compose                                        |
| **Fonts/Icons**| Google Fonts (Inter), Font Awesome 6                           |

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      Browser (Client)                    │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  index.html  │  │   app.js     │  │   style.css    │  │
│  │  (Dashboard) │  │  (Frontend   │  │  (Dark Theme)  │  │
│  │              │  │   Logic)     │  │                │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────────┘  │
│         │                 │                               │
│         │    ┌────────────┴────────────┐                  │
│         │    │   Keycloak JS Adapter   │                  │
│         │    │   (SSO / Token Mgmt)    │                  │
│         │    └────────────┬────────────┘                  │
└─────────┼─────────────────┼──────────────────────────────┘
          │                 │
          │  HTTP + Bearer  │  OpenID Connect
          │  Token (JWT)    │
          ▼                 ▼
┌─────────────────┐  ┌──────────────────┐
│   Express.js    │  │    Keycloak      │
│   REST API      │  │    (Docker)      │
│   :4200         │  │    :8080         │
│                 │  │                  │
│  ┌───────────┐  │  │  - ems-realm     │
│  │ Auth      │◄─┼──┤  - ems-app      │
│  │ Middleware │  │  │  - JWKS certs   │
│  │ (JWKS)    │  │  │  - User mgmt    │
│  └─────┬─────┘  │  └──────────────────┘
│        │        │
│  ┌─────▼─────┐  │
│  │  Routes   │  │
│  │ /api/emp  │  │
│  └─────┬─────┘  │
│        │        │
│  ┌─────▼─────┐  │
│  │  SQLite   │  │
│  │  (sql.js) │  │
│  │  ems.db   │  │
│  └───────────┘  │
└─────────────────┘
```

---

## 📁 Project Structure

```
PRODIGY_FS_02/
│
├── server.js               # Express server entry point
├── database.js              # SQLite database initialization & helpers (sql.js)
├── setup-keycloak.js        # Automated Keycloak realm/client/user setup script
├── package.json             # Project metadata and dependencies
├── docker-compose.yml       # Docker Compose config for Keycloak container
│
├── middleware/
│   └── auth.js              # JWT verification middleware (JWKS + RSA signature)
│
├── routes/
│   └── employees.js         # RESTful CRUD routes for employee management
│
└── public/                  # Frontend static assets
    ├── index.html           # Single-page application (dashboard UI)
    ├── app.js               # Frontend logic (API calls, rendering, state)
    ├── style.css            # Dark-themed responsive stylesheet (700+ lines)
    ├── keycloak.min.js      # Keycloak JavaScript adapter
    └── silent-check-sso.html # Keycloak silent SSO check page
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+ (with `fetch` support)
- **Docker** & **Docker Compose**
- A modern web browser

### Installation & Setup

```bash
# 1. Clone the repository
git clone https://github.com/Yousefashraf074/PRODIGY_FS_02.git
cd PRODIGY_FS_02

# 2. Start Keycloak (runs on port 8080)
docker-compose up -d

# 3. Install Node.js dependencies
npm install

# 4. Configure Keycloak realm, client, and default user
#    (Wait ~30 seconds after step 2 for Keycloak to be ready)
node setup-keycloak.js

# 5. Start the application server
npm start
```

### Access the Application

| Service                | URL                          | Credentials          |
| ---------------------- | ---------------------------- | -------------------- |
| **EMS Application**    | http://localhost:4200        | emsadmin / admin123  |
| **Keycloak Admin**     | http://localhost:8080/admin  | admin / admin        |

---

## 📡 API Endpoints

All API endpoints are protected and require a valid Keycloak Bearer token in the `Authorization` header.

| Method   | Endpoint                 | Description                          |
| -------- | ------------------------ | ------------------------------------ |
| `GET`    | `/api/employees`         | List employees (search, filter, sort, paginate) |
| `GET`    | `/api/employees/stats`   | Dashboard statistics & analytics     |
| `GET`    | `/api/employees/:id`     | Get a single employee by ID          |
| `POST`   | `/api/employees`         | Create a new employee                |
| `PUT`    | `/api/employees/:id`     | Update an existing employee          |
| `DELETE` | `/api/employees/:id`     | Delete an employee                   |
| `GET`    | `/api/keycloak-config`   | Get Keycloak connection settings (public) |

### Query Parameters (GET `/api/employees`)

| Parameter    | Type   | Default  | Description                                      |
| ------------ | ------ | -------- | ------------------------------------------------ |
| `search`     | string | —        | Search across name, email, and position           |
| `department` | string | —        | Filter by department                              |
| `status`     | string | —        | Filter by status (Active, Inactive, On Leave)     |
| `page`       | number | 1        | Page number for pagination                        |
| `limit`      | number | 10       | Number of results per page                        |
| `sortBy`     | string | id       | Column to sort by                                 |
| `order`      | string | DESC     | Sort order (ASC or DESC)                          |

### Employee Object Schema

```json
{
  "id": 1,
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@company.com",
  "phone": "+1-555-0100",
  "department": "Engineering",
  "position": "Software Engineer",
  "salary": 85000,
  "hire_date": "2024-01-15",
  "status": "Active",
  "created_at": "2024-01-15T10:30:00",
  "updated_at": "2024-01-15T10:30:00"
}
```

---

## 🔐 Authentication Flow

1. **User visits** `http://localhost:4200` → Frontend loads the Keycloak JS adapter
2. **Keycloak adapter** checks for an existing session (silent SSO check)
3. **If not authenticated** → User is shown a "Sign In with Keycloak" button
4. **User clicks Sign In** → Redirected to Keycloak login page (`ems-realm`)
5. **After login** → Keycloak redirects back with an authorization code
6. **Keycloak adapter** exchanges the code for JWT access & refresh tokens
7. **Frontend** stores the token and attaches it as `Authorization: Bearer <token>` on every API call
8. **Backend middleware** intercepts each request:
   - Extracts the Bearer token from the header
   - Fetches the JWKS (JSON Web Key Set) from Keycloak (cached for 5 min)
   - Verifies the JWT signature using RSA (RSASSA-PKCS1-v1_5 / SHA-256)
   - Validates the issuer (`iss`) and expiration (`exp`) claims
   - Attaches the decoded user info to `req.user`
9. **Route handler** processes the request using the authenticated user context

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory to override defaults:

```env
PORT=4200                          # Application server port
KEYCLOAK_URL=http://localhost:8080 # Keycloak server URL
KEYCLOAK_REALM=ems-realm           # Keycloak realm name
KEYCLOAK_CLIENT_ID=ems-app         # Keycloak client ID
```

---

## 📸 Screenshots

### 🔐 Login Page
> Keycloak-powered authentication with a modern, animated login screen.

<img width="1883" alt="Login Page" src="https://github.com/user-attachments/assets/ca9679b5-4fbb-4e96-9ae9-0056743c08a9" />

---

### 📊 Dashboard Overview
> Real-time statistics with department breakdown bar chart and status donut chart.

<img width="1919" alt="Dashboard Overview" src="https://github.com/user-attachments/assets/26cbbcda-c057-4cdf-8b0c-a03a09ba3359" />

---

### 👥 Employee List
> Paginated data table with search, department & status filters, and sortable columns.

<img width="1914" alt="Employee List" src="https://github.com/user-attachments/assets/7225c32c-866f-4bf6-81aa-336512611a20" />

---

### ➕ Add Employee
> Form with full validation for creating new employee records.

<img width="1895" alt="Add Employee" src="https://github.com/user-attachments/assets/0247f17f-5dc6-49fd-84a4-98809aee7c25" />

---

### ✏️ Edit Employee
> Pre-populated edit form for updating existing employee details.

<img width="1919" alt="Edit Employee" src="https://github.com/user-attachments/assets/b6658855-63b3-4107-834b-5f7a9a53a35d" />

---

## 📄 License

This project was developed as part of the **Prodigy InfoTech Full Stack Development Internship Program** (Task 02).

---

## 👤 Credits

**Yousef Ashraf Mansour** — [@Yousefashraf074](https://github.com/Yousefashraf074)

> Designed, developed, and deployed as part of the **Prodigy InfoTech Full Stack Development Internship**.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/Yousefashraf074">Yousef Ashraf</a>
</p>
