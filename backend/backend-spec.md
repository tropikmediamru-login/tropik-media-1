# Wix Integration Reference

How the static Tropik Media site (plain HTML on Vercel) talks to Wix.

The site is **static** and has **no build step**. The two dynamic features — the blog
and the booking form — are powered by Wix and reached through two small server-side
functions in `api/`. The browser never calls Wix directly; the Wix admin API key lives
only on the server, so it is never exposed to visitors.

```
Visitor ──▶ blog.html / book.html ──▶ /api/posts, /api/lead (Vercel functions)
                                          │  Authorization: WIX_API_KEY
                                          ▼
                                    Wix REST API  (Blog + CRM Contacts)
```

## Wix project

| | |
|---|---|
| **Project name** | `Tropik Media` |
| **Site ID** (`WIX_SITE_ID`) | `a895c48f-6677-4005-994f-aa58f23d2206` |
| **Dashboard / editor** | https://editor.wix.com/edit/od/9070e40e-dd83-4a0d-9442-86e3e98a64fd?metaSiteId=a895c48f-6677-4005-994f-aa58f23d2206 |
| **Wix preview URL** | https://yadav360.wixsite.com/tropik-media |

The public site runs on Vercel at `tropik-media.com`. The Wix project is used purely
as the **content backend**: you log into the Wix dashboard to write blog posts and to see
incoming leads. The `Site ID` is not secret; the API key is.

## What's set up in Wix

| Entity | Detail | Scope used at runtime |
|---|---|---|
| **Blog** app | Installed. One published starter post — *"Welcome to the Tropik Media Blog"* (slug `welcome-to-the-tropik-media-blog`). Edit or delete it in the dashboard and add your own. | Read Blog (`BLOG.READ-PUBLICATION`) |
| **CRM / Contacts** | Built in. Receives leads from the booking form. | Manage Contacts (`CONTACTS.MODIFY`) |
| **Contact field** `Project Details` (text) | Stores the booking form's message. Key: `custom.project-details-kcttddyvagvlqryswyt` (Wix adds a unique suffix — use this exact key). | written on contact create |

## How each feature is wired

### Blog — `/blog` listing and `/blog/<slug>` post
Served by `api/posts.js`, which holds the API key server-side and returns clean JSON:

- `GET /api/posts` → `{ posts: [ { title, slug, excerpt, date, minutesToRead, coverImage } ] }`
- `GET /api/posts?slug=<slug>` → `{ post: { …, html } }`

Under the hood it calls the Wix Blog REST API and converts Wix's rich-content (Ricos)
format into HTML. The page renders loading / empty / success / error states, so it stays
friendly even before any posts exist or if Wix is briefly unreachable.

### Booking form — `book.html` → `api/lead.js`
The form POSTs `{ firstName, lastName, email, phone, company, message }` to `/api/lead`,
which creates a contact in the Wix CRM (`POST /contacts/v4/contacts`) with the message
stored in the `Project Details` field. If the Wix env vars aren't set yet, the function
still returns success and logs the lead so nothing is lost.

## Environment variables

Set both in the Vercel project (**Settings → Environment Variables**), then redeploy.
A local template is in [`.env.example`](.env.example).

| Variable | Value | Notes |
|---|---|---|
| `WIX_API_KEY` | *(secret)* | API key with **Manage Contacts** + **Read Blog** scopes. Server-side only — never shipped to the browser. |
| `WIX_SITE_ID` | `a895c48f-6677-4005-994f-aa58f23d2206` | Not secret. |

### Generating the API key
API keys can only be created from the Wix dashboard:

1. Go to https://manage.wix.com/account/api-keys.
2. Create a key for the **Tropik Media** account with **Manage Contacts** + **Read Blog**
   permissions (or "All account permissions").
3. Add `WIX_API_KEY` and `WIX_SITE_ID` to Vercel's environment variables and redeploy.

That's the only step that can't be done from code. Everything else (the project, the Blog
app, the contact field, the starter post) is already provisioned.

## Dependencies

**None.** No npm packages, no bundler. The Vercel functions use the built-in `fetch`
(Node 18+ runtime).

## Files

- `api/posts.js` — blog read proxy (list + single post, Ricos → HTML).
- `api/lead.js` — booking form → Wix contact.
- `schema/collections.json` — machine-readable summary of the Wix setup above.
- `.env.example` — environment variable template.

## Reference docs
- Create Contact — https://dev.wix.com/docs/rest/crm/contacts/contacts/create-contact
- List Blog Posts — https://dev.wix.com/docs/api-reference/business-solutions/blog/posts-stats/list-posts
- Get Post By Slug — https://dev.wix.com/docs/api-reference/business-solutions/blog/posts-stats/get-post-by-slug
- Make API calls with an API key — https://dev.wix.com/docs/rest/articles/getting-started/api-keys
