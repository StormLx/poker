# Poker Planning App

A real-time, interactive poker planning application designed for agile development teams to estimate story points or task complexity collaboratively. This app features configurable voting scales, spectator mode, and a responsive UI with light/dark themes.

## Features

*   **Real-time Updates:** Uses Socket.io for instant communication between clients and server.
*   **Room Management:** Create private rooms or join existing ones.
*   **Configurable Voting Scales:** Choose from presets (Fibonacci, T-Shirt, Powers of Two) or define a custom scale.
*   **Interactive Voting:** Clickable cards for vote submission.
*   **Vote Masking & Reveal:** Votes are hidden until the room creator reveals them.
*   **Voting Statistics:** Displays average, mode, vote distribution, highest/lowest votes, and total votes.
*   **Spectator Mode:** Users can join as spectators who cannot vote but can observe the process.
*   **Creator Controls:** Room creator can manage voting scale, reveal votes, and start new voting rounds.
*   **Responsive UI:** Adapts to various screen sizes for usability on desktop and mobile.
*   **Light/Dark Theme:** User-selectable light and dark themes with preference saved to local storage and OS detection.
*   **Connection Status & Rejoin:** Visual indicators for WebSocket connection status and attempts to automatically rejoin a room on reconnection.
*   **Dockerized:** Easy setup and deployment using Docker and Docker Compose.

## Tech Stack

*   **Frontend:** React, Socket.io Client
*   **Backend:** Node.js, Express, Socket.io
*   **Containerization:** Docker, Docker Compose
*   **Serving (Production Client):** Nginx

## Prerequisites

*   Node.js (v18+ recommended)
*   npm (usually comes with Node.js)
*   Docker
*   Docker Compose

## Getting Started

### Using Docker (Recommended)

1.  **Clone the Repository:**
    ```bash
    git clone <repository-url>
    cd poker-planning-app
    ```

2.  **Environment Configuration:**
    *   **Client (Build Time):** The `REACT_APP_SOCKET_URL` is used by the React app to connect to the WebSocket server. It's configured as a build argument in `docker-compose.yml`.
        *   Default: `http://localhost:8080` (assumes the server is accessible on port 8080 of the Docker host).
        *   To change, modify `services.client.build.args.REACT_APP_SOCKET_URL` in `docker-compose.yml`.
    *   **Server (Runtime):** The `PORT` for the server can be set via an environment variable.
        *   Default: `8080` (defined in `server/src/server.js` and matched in `docker-compose.yml`).
        *   To change, modify `services.server.environment.PORT` and the host port mapping in `services.server.ports` in `docker-compose.yml`.

3.  **Build and Run Containers:**
    ```bash
    docker-compose up --build -d
    ```
    The `-d` flag runs the containers in detached mode.

4.  **Access the Application:**
    *   Open your browser and go to `http://localhost:3000` (or the host port you've mapped for the client service).

### Local Development (Without Docker)

#### Server

1.  Navigate to the server directory:
    ```bash
    cd poker-planning-app/server
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  (Optional) Create a `.env` file in the `server` directory to set environment variables:
    ```
    PORT=8081
    ```
    If not set, the server defaults to port `8080`.
4.  Start the development server:
    ```bash
    npm run dev
    ```
    This typically uses `nodemon` for auto-reloading. For a standard start:
    ```bash
    npm start
    ```

#### Client

1.  Navigate to the client directory:
    ```bash
    cd poker-planning-app/client
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  (Optional) Create a `.env` file in the `client` directory to set environment variables for Create React App:
    ```
    REACT_APP_SOCKET_URL=http://localhost:8081
    ```
    Replace `8081` if your server is running on a different port. If not set, it defaults to `http://localhost:8080`.
4.  Start the React development server:
    ```bash
    npm start
    ```
5.  Access the application in your browser, usually at `http://localhost:3000`.

## Project Structure

```
poker-planning-app/
├── client/         # React frontend application
│   ├── public/
│   ├── src/
│   │   ├── components/ # Reusable React components
│   │   ├── socketService.js # WebSocket communication logic
│   │   ├── App.js      # Main application component
│   │   └── index.js    # Entry point for React app
│   ├── Dockerfile      # For building production client image (Nginx)
│   └── package.json
├── server/         # Node.js backend application
│   ├── src/
│   │   ├── roomManager.js # Core room and voting logic
│   │   └── server.js   # Express server and Socket.io setup
│   ├── Dockerfile      # For building server image
│   └── package.json
├── docker-compose.yml # Docker Compose configuration
└── README.md          # This file
```

## Available Scripts

### Client (`poker-planning-app/client`)

*   `npm start`: Runs the app in development mode.
*   `npm test`: Launches the test runner.
*   `npm run build`: Builds the app for production to the `build` folder.
*   `npm run eject`: Removes Create React App's managed configuration.

### Server (`poker-planning-app/server`)

*   `npm start`: Starts the server (e.g., `node src/server.js`).
*   `npm run dev`: Starts the server with `nodemon` for development, enabling auto-restarts on file changes.
*   `npm test`: (If tests are configured) Runs tests.

## Further Enhancements (Potential)

*   Persistent User IDs / Authentication for more robust rejoin and identity.
*   Database integration for room persistence.
*   More detailed error handling and user feedback.
*   Advanced room settings (e.g., timer for voting).
*   Unit and integration tests.
```
