# Tropik Media — Wix Headless Backend Contract

Authoritative contract between the Wix backend and the **static** Tropik Media site
(plain HTML on Vercel). The frontend integrates **server-side**: Vercel functions in
`api/*.js` call the Wix REST API with a server-side API key. The browser never talks to
Wix directly, so there is **no public OAuth client / `VITE_WIX_CLIENT_ID`**.

> Adapted from the Wix Backend Agent protocol for this repo's no-build static stack.
> Provisioning was grounded in live Wix MCP docs; the two human gates were honoured.

## 0. Status

- **Wix project:** `Tropik Media`
- **Site ID:** `a895c48f-6677-4005-994f-aa58f23d2206`  → this is `WIX_SITE_ID`
- **Editor / dashboard:** https://editor.wix.com/edit/od/9070e40e-dd83-4a0d-9442-86e3e98a64fd?metaSiteId=a895c48f-6677-4005-994f-aa58f23d2206
- **Wix preview URL:** https://yadav360.wixsite.com/tropik-media (the public site stays on Vercel; this Wix site is the content backend / dashboard)
- **Backend mode:** Wix **Blog** (client-authored posts) + **CRM Contacts** (booking form). No CMS collections, no Stores.
- **Auth:** API key in `Authorization` header + `wix-site-id: <WIX_SITE_ID>` header (Wix "Make API Calls with an API Key").
- **`BACKEND-READY`:** NO — pending `WIX_API_KEY` (dashboard-only; see §6). Everything else is provisioned and verified.

## 1. Provisioned entities (live)

| Entity | Detail | Permissions / scope used at runtime |
|---|---|---|
| **Wix Blog** app | Installed. **1 published post** seeded — `Welcome to the Tropik Media Blog` (slug `welcome-to-the-tropik-media-blog`, id `2010b095-22dc-4ec2-995a-018d9f883e8f`). Starter content in the agency's own voice — client edits/deletes in the dashboard. | `BLOG.READ-PUBLICATION` (read) |
| **CRM / Contacts** | Built in; ready to receive leads from the booking form. | `CONTACTS.MODIFY` (create) |
| **Contact extended field** | `Project Details` (TEXT). **Key = `custom.project-details-kcttddyvagvlqryswyt`** (Wix appended a suffix — use this exact key). | written on contact create |

## 2. Frontend wiring — per dynamic feature

### Blog (NEW `/blog` listing + `/blog/<slug>` post)
- **List published posts** — `GET https://www.wixapis.com/blog/v3/posts?paging.limit=<n>&fieldsets=URL`
  - Returns `{ posts: [...], metaData: { total } }`. Each post: `id`, `title`, `excerpt`, `slug`, `firstPublishedDate`, `minutesToRead`, `media` (cover; `wixMedia.image` when a cover image is set), `url { base, path }`.
- **One post by slug** — `GET https://www.wixapis.com/blog/v3/posts/slugs/{slug}?fieldsets=URL&fieldsets=RICH_CONTENT`
  - Returns `{ post: { ... , richContent: { nodes: [...] } } }`. `richContent` is **Ricos** node format (PARAGRAPH/HEADING/TEXT with decorations/IMAGE/lists). The proxy renders nodes → HTML.
- **States to render:** loading · empty (no posts yet → styled empty state) · success · error (502 from Wix → friendly retry message).
- **Served by:** `api/posts.js` (server-side proxy holding the key). Frontend calls `/api/posts` (list) and `/api/posts?slug=<slug>` (single).

### Booking form (`book.html` → `api/lead.js`)
- **Create contact** — `POST https://www.wixapis.com/contacts/v4/contacts`
  - Body: `{ info: { name:{first,last}, emails:{items:[{email,tag:"MAIN"}]}, phones?, company?, extendedFields:{ items:{ "custom.project-details-kcttddyvagvlqryswyt": <message> } } } }`
  - ⚠️ The existing `api/lead.js` uses the key `custom.project-details` — **update it to `custom.project-details-kcttddyvagvlqryswyt`** (the real provisioned key) or the message won't persist.
- **States:** success (contact created → confirmation) · 400 (validation) · 502 (Wix unreachable).

## 3. npm dependencies
**None.** Static site, no build. The Vercel functions use the built-in `fetch` (Node 18+ runtime).

## 4. Import path / where code lives
- `api/posts.js` — NEW serverless proxy (blog read).
- `api/lead.js` — EXISTING serverless proxy (contact create); update the extended-field key.
- No bundler, no alias. Functions read `process.env.WIX_API_KEY` and `process.env.WIX_SITE_ID`.

## 5. Environment variables (set in the Vercel project, then redeploy)
- `WIX_API_KEY` — **secret**, server-side only. Manage Contacts + Read Blog scopes. Never exposed to the browser.
- `WIX_SITE_ID` — `a895c48f-6677-4005-994f-aa58f23d2206` (not secret).

No `VITE_`-prefixed vars; nothing Wix-related ships in the browser bundle.

## 6. Manual steps NOT done by this agent
1. **Generate the API key** (only possible in the Wix dashboard): go to `https://manage.wix.com/account/api-keys`, create a key with **Manage Contacts** + **Read Blog** permissions (or "All account permissions") for the `Tropik Media` account/site.
2. In **Vercel** → the tropik-media project → Settings → Environment Variables, add `WIX_API_KEY` (the key) and `WIX_SITE_ID` (`a895c48f-6677-4005-994f-aa58f23d2206`), then redeploy.
3. (Optional) Add a **cover image** to the starter post and write the first real article in the Wix dashboard Blog editor.

Payments / custom domain: not applicable to this backend.
