# UCF Bulk Creditor Search — Vercel Deployment

## Project Structure
```
ucf-vercel/
├── api/
│   ├── search.js      ← Serverless function (proxies UCF requests)
│   └── health.js      ← Health check endpoint
├── public/
│   └── index.html     ← The web app UI
├── vercel.json        ← Routing config
├── package.json
└── .gitignore
```

---

## Deploy in 5 Steps

### 1. Create a GitHub repo
- Go to https://github.com/new
- Name it something like `ucf-creditor-search`
- Keep it Private
- Click "Create repository"

### 2. Push these files to GitHub
Open a terminal in this folder and run:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ucf-creditor-search.git
git push -u origin main
```

### 3. Connect to Vercel
- Go to https://vercel.com and sign in with GitHub
- Click "Add New Project"
- Import your `ucf-creditor-search` repo
- Leave all settings as default — Vercel auto-detects everything
- Click "Deploy"

### 4. Done!
Vercel gives you a URL like:
  https://ucf-creditor-search.vercel.app

### 5. Every future update
Just push to GitHub and Vercel auto-deploys:
```bash
git add .
git commit -m "your change"
git push
```

---

## How It Works on Vercel
- `public/index.html` → served as the frontend at `/`
- `api/search.js` → serverless function at `/api/search`
- `api/health.js` → serverless function at `/api/health`
- No server to manage, no Docker, no config — Vercel handles everything

## API Endpoints
- `GET /api/health` — check if API is running
- `GET /api/search?name=COMPANY&court=njb&min_amount=0&all_pages=true`

## Usage
1. Open your Vercel URL in any browser
2. Paste or upload your creditor list
3. Select courts and run — works from any device, anywhere
