# Employee Management System

An Employee Management System with CRUD operations and Keycloak authentication.

## Project Structure

- `server.js`: Main Express server entry point.
- `database.js`: In-memory database initialization (using sql.js).
- `setup-keycloak.js`: Script to automatically configure the Keycloak realm, client, and user.
- `public/`: Frontend static files (HTML, CSS, JavaScript).
- `routes/`: API route definitions.
- `middleware/`: Express middleware, including Keycloak authentication.
- `docker-compose.yml`: Docker setup for the Keycloak service.

## Setup and Running

1.  **Start Keycloak:**
    ```bash
    docker-compose up -d
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Keycloak:**
    (Wait for Keycloak to be fully running before this step)
    ```bash
    node setup-keycloak.js
    ```

4.  **Start the Application:**
    ```bash
    npm start
    ```

The application will be available at [http://localhost:4200](http://localhost:4200).
