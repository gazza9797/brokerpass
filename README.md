# BrokerPass.ca — Marketing site + product mockups

Static HTML prototype. No build step, no dependencies. Every page is a self-contained file.

## Pages
- `index.html` — homepage (interactive upload-to-report demo)
- `faq.html` — FAQ
- `about.html` — About / who built this
- `dashboard.html` — logged-in Broker of Record dashboard
- `team-roles.html` — Team & Roles / access model

The navigation is wired: the marketing pages link to each other, "Sign in" opens the dashboard, and the app sidebar moves between Dashboard and Settings. The logo returns to the homepage.

## Put it on GitHub

**Option A — GitHub Desktop (easiest, no command line)**
1. Open GitHub Desktop, File → New Repository, or drag this folder in.
2. Name it `brokerpass-site`, choose this folder as the location.
3. Publish repository (keep it private if you want).

**Option B — GitHub website (no git at all)**
1. Go to github.com, click New repository, name it `brokerpass-site`, create it.
2. On the repo page, "uploading an existing file", drag every file from this folder in, commit.

**Option C — command line**
```
cd brokerpass-site
git init
git add .
git commit -m "BrokerPass site + mockups"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/brokerpass-site.git
git push -u origin main
```

## Connect Netlify
1. netlify.com → Add new site → Import an existing project → GitHub.
2. Pick the `brokerpass-site` repo.
3. Build command: leave blank. Publish directory: leave as the root (`.`).
4. Deploy. You get a `something.netlify.app` link. Rename it under Site settings → Domain.
5. Every push to `main` now auto-deploys.

Point a `brokerpass.ca` subdomain at it later from Netlify → Domain settings when you are ready.
