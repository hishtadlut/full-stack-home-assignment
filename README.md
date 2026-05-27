# Task Manager - Full Stack Home Assignment

A full-stack Task Management application built with React, TypeScript, Node.js, and Express.

> **📋 Assignment Instructions**: For complete assignment details, requirements, and submission guidelines, please see [ASSIGNMENT.md](./ASSIGNMENT.md).

## Overview

This is a Task Management application that allows users to:

- Register and authenticate
- Create and manage tasks
- Add comments to tasks
- Assign tasks to team members
- Tag tasks for better organization

## Tech Stack

### Frontend

- React 18
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Fetch API

### Backend

- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL (via Docker)
- JWT Authentication
- bcrypt

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v18 or higher)
- npm or yarn
- Git
- Docker and Docker Compose (for PostgreSQL database)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd full-stack-home-assignment
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Update .env with your configuration. JWT_SECRET is required in production.
# DATABASE_URL="postgresql://taskmanager:taskmanager123@localhost:5432/taskmanager?schema=public"
# JWT_SECRET="<generate-a-long-random-secret>"
# NODE_ENV=development
# PORT=3000

# Set NODE_ENV=production in deployed environments so unsafe JWT secrets fail startup.

# Start PostgreSQL database with Docker and setup database (migrate + seed)
npm run db:setup

# Or manually:
# Start PostgreSQL Docker container
# npm run db:docker:up

# Generate Prisma client
# npm run db:generate

# Run database migrations
# npm run db:migrate

# Seed the database with sample data
# npm run db:seed

# Start the development server
npm run dev
```

**Note**: The `db:setup` script will:

1. Start the PostgreSQL Docker container
2. Wait for the database to be ready
3. Generate Prisma client
4. Run migrations
5. Seed the database with sample data

The backend server will run on `http://localhost:3000`

### 3. Frontend Setup

Open a new terminal window:

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will run on `http://localhost:5173`

## Project Structure

```
full-stack-home-assignment/
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API service layer
│   │   ├── types/          # TypeScript type definitions
│   │   └── App.tsx         # Main app component
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── routes/         # Express routes
│   │   ├── controllers/    # Route controllers
│   │   ├── middleware/     # Express middleware
│   │   ├── services/       # Business logic
│   │   ├── db/             # Database schema
│   │   └── server.ts       # Express server
│   └── package.json
└── README.md
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get the authenticated user from the current token

### Tasks

- `GET /api/tasks` - Get all tasks (optional `search`, `status`, and `priority` filters)
- `GET /api/tasks/:id` - Get task by ID
- `POST /api/tasks` - Create a new task
- `PATCH /api/tasks/:id` - Update task fields
- `DELETE /api/tasks/:id` - Delete a task

### Comments

- `GET /api/comments?taskId=:id` - Get comments for a task
- `POST /api/comments` - Create a comment
- `DELETE /api/comments/:id` - Delete a comment

### Assistant

- `GET /api/assistant/chats` - List assistant chats
- `POST /api/assistant/chats` - Create a new assistant chat
- `GET /api/assistant/chats/:chatId` - Get chat messages and drafts
- `POST /api/assistant/chats/:chatId/messages` - Send a user message
- `PATCH /api/assistant/drafts/:draftId` - Execute or discard a pending draft

## UI Routes

- `/dashboard` - Metrics, URL-backed search/status/priority filters, board view, and table view
- `/tasks/:taskId` - Task detail, edit form, comments, assignments, and delete flow
- `/assistant` - Full assistant workspace with chat history and draft review

## Default Test Users

After seeding, you can login with:

- Email: `john@example.com`, Password: `password123`
- Email: `jane@example.com`, Password: `password123`
- Email: `bob@example.com`, Password: `password123`

## Development

### Backend

- Development: `npm run dev` (uses tsx for hot reload)
- Build: `npm run build`
- Start: `npm start`

### Frontend

- Development: `npm run dev` (Vite dev server)
- Build: `npm run build`
- Test: `npm test`
- Preview: `npm run preview`
- Visual capture: `npm run visual:capture`
- Visual baseline: `npm run visual:baseline`
- Visual check: `npm run visual:check`

The visual workflow starts a Vite server, mocks the API in the browser, and captures dashboard, task detail, and assistant screens under `output/playwright/`. Run `npx playwright install chromium` once if Chromium is not installed.

## Database

The application uses PostgreSQL running in a Docker container. The database is automatically set up when you run `npm run db:setup`.

### Docker Commands

- Start database: `npm run db:docker:up`
- Stop database: `npm run db:docker:down`
- Restart database: `npm run db:docker:restart`
- Full setup (start + migrate + seed): `npm run db:setup`

### Database Connection

Default connection details (from docker-compose.yml):

- Host: `localhost`
- Port: `5432`
- Database: `taskmanager`
- Username: `taskmanager`
- Password: `taskmanager123`

Connection string: `postgresql://taskmanager:taskmanager123@localhost:5432/taskmanager?schema=public`

## Notes

- The application is set up for development. For production, ensure proper environment variables and security configurations.
- The database is seeded with sample data for testing purposes.
- CORS is enabled for development. Adjust for production needs.

## Troubleshooting

**Database issues:**

- Ensure Docker is running: `docker ps`
- Ensure PostgreSQL container is up: `npm run db:docker:up`
- Check container logs: `docker logs task-manager-db`
- Reset database: `npm run db:docker:down && npm run db:docker:up && npm run db:migrate`
- Ensure Prisma client is generated: `npm run db:generate`

**Port conflicts:**

- Backend default: 3000 (change in `.env`)
- Frontend default: 5173 (change in `vite.config.ts`)

**Module not found errors:**

- Run `npm install` in both frontend and backend directories
- Ensure Prisma client is generated in backend
