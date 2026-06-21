# Tropik Media — Website

The marketing website for **Tropik Media**, a creative content and growth marketing
agency based in Mauritius. It's a fast, static site with a Wix-powered blog and booking
form, deployed on Vercel.

**Live site:** https://www.tropikmedialtd.com

---

## What this is

A **static HTML website** — no framework, no build step. Just HTML, CSS, and a little
JavaScript that you can open straight in a browser. Two features are dynamic and powered
by Wix through small serverless functions:

- **Blog** (`/blog`) — posts are written in the Wix dashboard and shown on the site.
- **Booking form** (`/book.html`) — submissions land in the Wix CRM as contacts.

Everything else (home page, services, portfolio, pricing) is plain HTML you can edit
directly.

## Tech stack

| Layer | What it uses |
|---|---|
| Pages | Static HTML + CSS (Bebas Neue / Montserrat fonts, brand yellow `#F5C400`) |
| Dynamic features | Two Vercel serverless functions in `api/` |
| Content backend | Wix (Blog app + CRM Contacts) |
| Hosting | Vercel |
| Build step | **None** — files are served as-is |

## Project structure

```
.
├── index.html              Home page
├── book.html               "Book a Meeting" page (booking form)
├── blog.html               Blog listing  → served at /blog
├── post.html               Single blog post → served at /blog/<slug>
│
├── api/                    Vercel serverless functions (server-side only)
│   ├── posts.js            Reads published Wix Blog posts
│   └── lead.js             Sends booking-form submissions to Wix CRM
│
├── backend/                Integration docs (not deployed)
│   ├── backend-spec.md     Full Wix integration reference  ← read this for Wix setup
│   ├── .env.example        Environment variable template
│   └── schema/             Machine-readable summary of the Wix setup
│
├── logos/                  Brand logos & favicons
├── gifs/                   Animated previews of client sites (portfolio section)
├── *.jpg                   Service / section photos
│
├── robots.txt
├── sitemap.xml
├── llms.txt / llm.txt      Summaries for AI search engines
└── vercel.json             Hosting config + clean-URL rewrites for the blog
```

## Running locally

No install needed. Any static file server works:

```bash
# Python (built in on most machines)
python -m http.server 8000
# then open http://localhost:8000
```

To also run the `/api` functions locally, use the Vercel CLI:

```bash
npm i -g vercel
vercel dev
```

> The blog and booking form only return live data when the Wix environment variables are
> set (see below). Without them the pages still load — the blog shows an empty state and
> the form accepts submissions gracefully.

## Deployment

The site is hosted on **Vercel** and deploys automatically when you push to the `main`
branch of the connected GitHub repository.

Key config lives in [`vercel.json`](vercel.json):
- No build command (`buildCommand: null`) — files are served directly.
- Clean URLs for the blog: `/blog` → `blog.html`, `/blog/<slug>` → `post.html`.
- `.vercelignore` keeps the `backend/` docs out of the deploy.

To deploy manually: `vercel --prod`.

## Environment variables

Set these in the Vercel project (**Settings → Environment Variables**), then redeploy.
Both are read **server-side only** and never exposed to the browser.

| Variable | What it is |
|---|---|
| `WIX_API_KEY` | Secret API key for the Wix project (scopes: Manage Contacts + Read Blog). |
| `WIX_SITE_ID` | The Wix site ID. Value is in [`backend/.env.example`](backend/.env.example). |

See **[`backend/backend-spec.md`](backend/backend-spec.md)** for how to generate the API
key and the full integration details.

## Managing content (Wix)

You don't need to touch code for day-to-day content.

**Blog posts** — Log in to the Wix dashboard (link in `backend/backend-spec.md`), open
the Blog, and write/edit/delete posts. Published posts appear on `/blog` automatically.

**Leads** — Booking-form submissions show up as contacts in the Wix CRM. Each contact's
*Project Details* field holds the message the visitor typed.

## Editing the website

The home page, services, portfolio, and pricing are plain HTML in `index.html` (and the
other `.html` files). Edit the text directly, commit, and push — Vercel redeploys. Shared
styling (colours, fonts) is defined in the `:root` CSS block near the top of each page.

Brand assets:
- **Logos & favicons** — `logos/` (the navbar mark is `logos/tropik-mark.png`).
- **Fonts** — Bebas Neue (headings) + Montserrat (body), loaded from Google Fonts.
- **Brand yellow** — `#F5C400`.

## SEO & discoverability

- `sitemap.xml` and `robots.txt` are kept in sync with the site's pages.
- `llms.txt` / `llm.txt` give AI search engines a clean summary of the site.
- Each page sets its own title, description, and social-share (`og:`) tags.

## Custom domain

The production domain is `www.tropikmedialtd.com`. Point it at the Vercel project under
**Settings → Domains** and follow Vercel's DNS instructions.

## Transferring this project

This project is made up of **three separate assets** — the GitHub repo is only one of
them. Hand over all three for the site to keep working.

| Asset | What it holds | How it transfers |
|---|---|---|
| **GitHub repo** | All the code & docs. **No secrets are stored here.** | Transfer the repository to the new owner's GitHub account. |
| **Vercel project** | Hosting + the environment variables. | New owner imports the repo into their Vercel account (no build step needed), then re-adds the env vars below and redeploys. **Env vars do *not* travel with a GitHub transfer.** |
| **Wix project** | Blog content + incoming leads, and the API key. | Hand over the Wix project (or the new owner creates their own), then generate a fresh API key under the owning account. |

### Environment variables needed after transfer

Only **two**, both set in the **Vercel** project (Settings → Environment Variables) — never
in the repo. A template is in [`backend/.env.example`](backend/.env.example).

| Variable | Secret? | Value |
|---|---|---|
| `WIX_API_KEY` | **Yes** | API key from the Wix account, scopes **Manage Contacts** + **Read Blog**. Generate at https://manage.wix.com/account/api-keys. |
| `WIX_SITE_ID` | No | The Wix site ID — see [`backend/.env.example`](backend/.env.example). Changes if the new owner uses their own Wix site. |

If either variable is missing the site still runs — the blog shows an empty state and the
booking form accepts submissions gracefully — so a missing key never takes the site down.

### Handoff checklist

1. Transfer the **GitHub repo** to the new owner.
2. New owner imports it into **Vercel** (static site + `/api`, no build command — already
   configured in [`vercel.json`](vercel.json)).
3. Decide who owns the **Wix** project; generate an API key under that account.
4. Add `WIX_API_KEY` + `WIX_SITE_ID` in the Vercel project, then **redeploy**.
5. Point the domain (`www.tropikmedialtd.com`) at the new Vercel project (see above).

See [`backend/backend-spec.md`](backend/backend-spec.md) for the full Wix integration
details.
