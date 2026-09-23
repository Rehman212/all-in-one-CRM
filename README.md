# SV Mailer (Social Velocityy)

Next.js frontend (`frontend/`) + NestJS API (`backend/`).

## Local

```bash
# Terminal 1
cd backend
cp .env.example .env   # edit DATABASE_URL, JWT, etc.
npm install
npx prisma migrate deploy
npm run start:dev

# Terminal 2
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

- App: http://localhost:3100  
- API: http://localhost:4000/api  

Do not commit `.env` / `.env.local` / AWS keys / mailbox passwords.

## Production (Vercel + AWS)

### Backend (AWS Lightsail / EC2, always-on)

1. RDS Postgres (ap-south-1) → set `DATABASE_URL`
2. Ubuntu server: Node 20, clone repo, `cd backend`
3. `.env` with production values + `FRONTEND_URL=https://your-app.vercel.app`
4. `npm install && npx prisma migrate deploy && npm run build`
5. `pm2 start dist/main.js --name sv-api`
6. Nginx + HTTPS on `api.yourdomain.com` → `127.0.0.1:4000`
7. DNS A record → server IP

### Frontend (Vercel)

1. Import GitHub repo, **Root Directory = `frontend`**
2. Env: `NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api`
3. Deploy
4. Put the Vercel URL into backend `FRONTEND_URL`, then `pm2 restart sv-api`

### After go-live

- Deliverability: IAM Access Key + Secret (SES)
- IMAP: Hostinger mailbox password for Inbox sync
