# SV Mailer

Email campaigns for socialvelocityy.com — Next.js frontend (`frontend/`, port 3100) and NestJS + Prisma API (`backend/`, port 4000).

## Setup

1. Copy `backend/.env.example` to `backend/.env` and set Postgres + JWT (do not commit `.env`).
2. `cd backend && npm install && npx prisma db push && npm run start:dev`
3. Copy `frontend/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:4000/api`
4. `cd frontend && npm install && npm run dev`

Do not commit AWS keys, mailbox passwords, or `.env` files.
