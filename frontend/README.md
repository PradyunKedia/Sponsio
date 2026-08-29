# Sponsio Next.js Frontend

The Sponsio web interface uses Next.js App Router and deploys to Vercel. The stateful Express/WebSocket API is deployed separately.

## Local development

```bash
cp .env.example .env
npm install
npm run dev
```

Open <http://localhost:3000>.

## Production environment

Set `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, and `NEXT_PUBLIC_SITE_URL` in Vercel before deploying.
