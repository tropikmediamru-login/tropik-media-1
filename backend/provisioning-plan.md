# Tropik Media — Wix Backend Provisioning Plan

STATUS: EXECUTED (Gate 1 approved 2026-06-18; seed option A). Backend provisioned — see backend-spec.md. Awaiting Gate 2 review.

> This follows the **Wix Backend Agent protocol** (two human gates, every call grounded
> in live Wix MCP docs, idempotent, no fabricated content, a written contract) but is
> **adapted to this repo's actual stack**. `tropik-media` is a no-build **static HTML site
> on Vercel**, not the Vite + `@wix/sdk` pipeline the agent assumes. So the frontend
> integrates with Wix the way this repo already does it — **server-side serverless
> functions (`api/*.js`) calling the Wix REST API with an admin API key** — instead of a
> browser `@wix/sdk` OAuth client. No `VITE_WIX_CLIENT_ID`, no `backend/` SDK layer.

---

## 1. Backend scope

The static site needs Wix for two things, both already implied by the repo:

| Site feature | Backend need | Why |
|---|---|---|
| **Blog** (NEW page) | **Wix Blog app** on a new Wix project | Client authors posts in the Wix dashboard; the site reads published posts via REST and renders them on `tropikmedialtd.com/blog`. |
| **Booking form** (`book.html` → `api/lead.js`) | **CRM / Contacts** (built into every Wix site) + one **extended field** | The form already POSTs to Wix Contacts; it just needs a live project + key. The code writes `custom.project-details`, which must exist as an extended field. |

Everything else on the site (hero, services, work, pricing, CTA) stays **static HTML** — no backend.

No Wix **Stores** / e-commerce. No **Members/Bookings**. No CMS data collections (the blog is the Blog app; leads are CRM contacts).

## 2. Wix project

- **Create new** project named **`Tropik Media`** (idempotent — `ListWixSites` shows no existing "Tropik Media"; the account already holds the client sites Tacos And Co, Lolivia, Baie, Home Avenue, so this is the right Tropik Media agency account).
- Role: **content backend consumed headlessly** by the external Vercel site over REST. The client logs into the Wix dashboard of this project to (a) write blog posts and (b) view incoming leads in the CRM.
- Capture `WIX_SITE_ID` after creation (needed by the Vercel functions).
- **Note on "headless":** we are *not* using the Wix CLI / Next.js headless starter (that contradicts "no Next.js"). A standard Wix project + Blog app, read over REST with a server-side API key, gives the same headless outcome with zero build step.

## 3. Apps & data model

| Item | Action | Permissions / scope | Seed source |
|---|---|---|---|
| **Wix Blog** app | Install on the new project | n/a (app install) | Empty, or **one clearly-labeled starter post** in Tropik Media's own voice (see §5) |
| **CRM Contacts** | Built in; no provisioning | reads/writes via API key (`CONTACTS.MODIFY`) | Real leads only, created at runtime by the form |
| **Extended field** `custom.project-details` (TEXT) | Create via Contacts Extended Fields API | `CONTACTS.MODIFY` | n/a — populated per submission |
| Contact label e.g. `Website Lead` *(optional)* | Create + apply on submit | `CONTACTS.MODIFY` | n/a |

No custom CMS collections. (If you later want the *full* submission — including the long message — stored as records rather than only on the contact, we can add a `ContactSubmissions` CMS collection; not needed for the stated ask.)

## 4. Grounded API endpoints (confirmed against live Wix MCP docs)

- Read blog list — `GET https://www.wixapis.com/blog/v3/posts` (List Posts) / `POST https://www.wixapis.com/blog/v3/posts/query` (Query Posts) — scope `BLOG.READ-PUBLICATION`.
- Read one post — `GET https://www.wixapis.com/blog/v3/posts/slugs/{slug}` (Get Post By Slug) — scope `BLOG.READ-PUBLICATION`.
- Create lead — `POST https://www.wixapis.com/contacts/v4/contacts` (Create Contact) — scope `CONTACTS.MODIFY`. (Already used by `api/lead.js`.)
- Auth — API key in `Authorization` header + `wix-site-id` header for site-level calls (Wix "Make API Calls with an API Key").

Exact request/response shapes (cover image, rich content → HTML, fieldsets) will be re-read from the full method articles at EXECUTE time before any frontend code is written — never coded from memory.

## 5. Seed content (no fabrication)

There are **no real client blog posts** yet. Per the no-fabrication rule I will **not** invent articles, authors, or dates. Two options for Gate 1 to choose:

- **(A — recommended)** Seed **one** honest starter post — "Welcome to the Tropik Media Blog" — written in the agency's own factual voice (who they are, what they do, drawn from the existing site copy), **clearly marked as a starter** the client edits or deletes. Lets the new `/blog` page render real content immediately.
- **(B)** Leave the blog **empty**; `/blog` shows a styled empty state until the client writes their first post in Wix.

## 6. Headless OAuth client ID

**Not required.** The static frontend never calls Wix from the browser — all Wix traffic goes through the Vercel serverless functions using the server-side API key. So there is no public `VITE_WIX_CLIENT_ID` to mint.

## 7. Manual steps NOT done by this agent (your one handoff)

Wix **API keys can only be generated in the dashboard** (`manage.wix.com/account/api-keys`) — the MCP cannot mint one. After provisioning you will:

1. Create an API key for the **Tropik Media** project with scopes **Manage Contacts** + **Read Blog** (or "All account permissions").
2. Add to the **Vercel** project env (Settings → Environment Variables) and redeploy:
   - `WIX_API_KEY=<the key>`
   - `WIX_SITE_ID=<provided at Gate 2>`

That is the only thing that can't be automated. Everything else (project, Blog app, extended field, optional starter post, the contract) is provisioned for you and is idempotent.

## 8. Frontend changes that follow (Step 3, after Gate 2 — for context, not provisioning)

- `api/posts.js` — serverless proxy: reads published Wix Blog posts (and one-by-slug), returns clean JSON. Holds the API key server-side, like `api/lead.js`.
- `blog.html` (listing) + `post.html` (single post) — match the site's existing Bebas Neue / Montserrat / `#F5C400` design + clip-path buttons.
- `vercel.json` — rewrites `/blog` → `/blog.html`, `/blog/:slug` → `/post.html` for clean URLs.
- `robots.txt`, `llm.txt`, `sitemap.xml` — each including the blog URL.
- Confirm `api/lead.js` works unchanged against the new project once the key/site-id are set.

---

### Gate 1 decision needed
1. Approve creating the **Tropik Media** Wix project + installing **Blog** + creating the `project-details` extended field?
2. Seed option **A (one starter post)** or **B (empty)**?

Nothing is provisioned until you approve.
