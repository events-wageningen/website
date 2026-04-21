# Evenementen Wageningen

Static events listing website for Wageningen, built with [Astro](https://astro.build) + TypeScript + Tailwind CSS, deployed automatically to GitHub Pages.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Astro (static output) |
| Language | TypeScript (strictest) |
| Styling | Tailwind CSS |
| Hosting | GitHub Pages |
| Deployment | GitHub Actions |
| Data | JSON files in `src/data/events/` |

---

## Adding an event

1. Create a new `.json` file in `src/data/events/` (filename can be anything descriptive, e.g. `my-event-2026.json`).
2. Use this schema:

```json
{
  "date": "2026-07-04",
  "title": "Name of the event",
  "location": "Venue, Wageningen"
}
```

**`date`** must be an ISO 8601 date string (`YYYY-MM-DD`).

3. Commit and push to `main`.  
   The GitHub Actions workflow will automatically build and deploy the updated site within ~1 minute.

---

## Local development

```bash
# Install dependencies
npm install

# Start the dev server at http://localhost:4321
npm run dev

# Build for production (output → dist/)
npm run build

# Preview the production build locally
npm run preview
```

---

## Deployment setup (first time)

Follow these steps once to connect the repository to GitHub Pages and your custom domain.

### 1. Create the GitHub repository

```bash
git init
git add .
git commit -m "chore: initial project setup"
git remote add origin https://github.com/events-wageningen/website.git
git branch -M main
git push -u origin main
```

### 2. Enable GitHub Pages via Actions

1. Go to your repository on GitHub.
2. Click **Settings** → **Pages** (left sidebar).
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Save.

The first push to `main` will trigger the workflow. The site will be live at:  
`https://events-wageningen.github.io/website/` (before the custom domain is set up).

### 3. Configure the custom domain in GitHub

1. Still in **Settings** → **Pages**, scroll to **Custom domain**.
2. Type `events-wageningen.nl` and click **Save**.  
   GitHub will attempt a DNS check. It may show a warning until the DNS records propagate.
3. Once the check passes, tick **Enforce HTTPS**.

> The `public/CNAME` file already contains the domain, so it will be included in every build automatically.

### 4. Configure DNS at your registrar

Add or update the following records at your domain registrar (e.g. Transip, Hostnet, GoDaddy):

**For an apex domain (`events-wageningen.nl`) — use four A records:**

| Type | Host / Name | Value |
|------|-------------|-------|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |

**Optionally add a `www` redirect — use a CNAME:**

| Type | Host / Name | Value |
|------|-------------|-------|
| CNAME | `www` | `events-wageningen.github.io` |

DNS propagation typically takes a few minutes up to 48 hours.  
You can verify with: `dig events-wageningen.nl +noall +answer`

### 5. Verify everything works

- Visit `https://events-wageningen.nl` — the site should load with a valid HTTPS certificate.
- Add a new JSON event file, push to `main`, watch the **Actions** tab for a green deploy, then refresh the site.

---

## Repository structure

```
.
├── .github/
│   └── workflows/
│       └── deploy.yml          # Build & deploy on push to main
├── public/
│   ├── CNAME                   # Custom domain
│   └── favicon.svg
├── src/
│   ├── components/
│   │   └── EventCard.astro     # Single event card UI
│   ├── data/
│   │   └── events/             # ← Drop new event JSON files here
│   │       ├── koningsdag-2026.json
│   │       └── zomerfestival-2026.json
│   ├── layouts/
│   │   └── Layout.astro        # Base HTML shell
│   ├── lib/
│   │   └── events.ts           # JSON loader & date formatter
│   ├── pages/
│   │   └── index.astro         # Main events page
│   └── types/
│       └── event.ts            # TypeScript Event interface
├── astro.config.mjs
├── package.json
├── tailwind.config.mjs
└── tsconfig.json
```