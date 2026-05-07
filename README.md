# Optiplant - Inventory Management System

Optiplant is a comprehensive, role-based Inventory Management and Point-of-Sale (POS) system designed for multi-branch operations. This frontend application provides an intuitive interface for managing branches, tracking inventory, processing sales, and handling inter-branch transfers in real-time.

## 🚀 Key Features

*   **Role-Based Access Control (RBAC):**
    *   **ADMIN:** Full global access to manage branches, users, and the product catalog, as well as accessing global dashboard metrics and generating reports. Restricted from performing daily operations like sales.
    *   **MANAGER:** Branch-specific access to oversee local inventory, approve/deny incoming transfers, handle purchase orders, and monitor branch-level sales.
    *   **OPERATOR:** Day-to-day access for ringing up sales, checking stock availability, and sending/receiving transfer shipments.
*   **Real-Time Data Synchronization:** Utilizes WebSockets (STOMP/SockJS) for instant updates on inter-branch transfers and inventory changes without requiring manual page refreshes.
*   **Comprehensive Modules:**
    *   **Dashboard:** Visual metrics and downloadable PDF reports (for Admins).
    *   **Inventory & Products:** Catalog management and branch-specific stock tracking with adjustment capabilities.
    *   **Sales:** Streamlined POS interface for registering customer purchases.
    *   **Transfers:** Send, receive (full or partial), and cancel inventory transfers between branches.
    *   **Purchase Orders:** Track and receive supplier deliveries.
*   **Security:** Features an automatic session logout mechanism after 5 minutes of inactivity.

## 🛠️ Tech Stack

*   **Framework:** [Next.js](https://nextjs.org/) (App Router)
*   **UI Library:** React 19
*   **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
*   **Icons:** [Lucide React](https://lucide.dev/)
*   **WebSockets:** `@stomp/stompjs` & `sockjs-client`
*   **Containerization:** Docker & Docker Compose

## ⚙️ Getting Started

### Prerequisites
Make sure you have Node.js (v20+) or Docker installed on your machine.

### Environment Variables
Copy the example environment file and configure it:
```bash
cp .env.example .env
```
Ensure that `NEXT_PUBLIC_API_URL` points to your running backend instance (e.g., `http://localhost:8080`).

### Running Locally (Development Mode)

1. Install dependencies:
   ```bash
   npm install
   # or yarn install
   # or pnpm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Running with Docker

Optiplant is containerized and ready to be spun up alongside the backend using Docker Compose.

To run the frontend service:
```bash
docker-compose up -d --build
```
*Note: The `docker-compose.yml` is configured to connect to an external network (`pruebatecnicabackend_default`) to seamlessly integrate with the backend API.*

## 📁 Project Structure

*   `/app`: Contains the Next.js App Router structure, including `(auth)` for login pages and `(dashboard)` for the main application modules.
*   `/lib`: Core utilities, including the AuthContext, API fetch wrappers, and WebSocket clients.
*   `/.env.example`: Template for environment variables.
*   `Dockerfile` & `docker-compose.yml`: Containerization configuration.
