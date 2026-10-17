# Architecture note

## Shape

```
React (Vite) + Tiptap  <-- JSON/HTTP -->  Express API  <-->  SQLite (better-sqlite3)
   served as static files by the same Express process
```

One deployable unit: `npm run build` produces `client/dist`, and the Express server serves it plus `/api/*`. This avoids CORS, a second
service, and a second deploy, which matters when the goal is a link a reviewer can open in one click.

## What I prioritized, and why

1. **Access logic that is actually enforced on the server.** Every document route goes through one `access()` function that returns
   `owner | editor | viewer` or a 404. The UI hides buttons, but the API is the source of truth (and the tests assert 403/404 behavior).
2. **An editing experience that feels coherent.** Tiptap gives real rich text (undo/redo, shortcuts, lists) instead of a hand-rolled
   `contentEditable`. Autosave with visible status and retry, flush on tab close, and a read-only mode for viewers.
3. **A product-relevant upload.** Import turns `.txt`/`.md`/`.docx` into editable documents. That matches how people actually start
   documents and exercises the storage format end to end.
4. **Persistence that survives restarts**, including sessions, so demoing sharing isn't fragile.

## Key decisions and trade-offs

| Decision | Why | Cost |
| --- | --- | --- |
| Store content as **sanitized HTML** (allowlist of ~15 tags, no attributes) | Simple, preserves formatting, safe against stored XSS since every write is sanitized server-side | Not a structured doc model; harder to diff or merge later |
| **SQLite** | Zero setup for reviewers, transactional, plenty for this scope | Single node; ephemeral disk on free hosts |
| **Mocked auth**: seeded users + bearer session tokens | Demonstrates sharing without building auth | Not secure; swap for real auth/SSO |
| **Roles (editor/viewer)** instead of a single "has access" flag | Small extra cost, much clearer sharing semantics | Only two roles, no link sharing or groups |
| **Last-write-wins** saves | Real-time collaboration (CRDT/OT) is a project of its own | Concurrent editors can overwrite each other |
| 404 (not 403) for documents you can't see | Doesn't reveal which IDs exist | Slightly harder debugging |
| Hash routing (`#/doc/1`) | No server rewrite rules needed anywhere | Less pretty URLs (an SPA fallback exists if switched later) |
| Markdown converter written by hand (headings, bold/italic, lists) | Avoids a heavy dependency for a small subset; output is sanitized anyway | Tables, links, code blocks are not converted |

## Stretch feature: export

I picked export over the other optional items because it is self-contained, low-risk to the core flows, and immediately useful. Markdown is generated on the server (`server/exporters.js`, using Turndown) from the already-sanitized stored HTML, behind the same `access()` check as reading, so anyone who can read a document can export it and nobody else can. PDF uses the browser's print pipeline with a print stylesheet: zero extra dependencies and real text (selectable, searchable) in the PDF, at the cost of depending on the user's print dialog. Role-based sharing (editor/viewer) was already part of the core sharing model.

## Deliberately deprioritized

Real-time collaboration and presence, comments/suggestions, version history, real authentication, link sharing, image support,
and a Playwright UI test suite. Each is a natural next step; none was needed to show the core loop working.

## What I'd build next (2-4 hours)

1. Version history: store snapshots on save (throttled) and add restore; also fixes the accidental-overwrite risk.
2. Optimistic concurrency: send `updated_at` with saves and return 409 on conflict, with a "reload latest" prompt.
3. Server-side PDF export (headless rendering) for consistent output across browsers.
4. Browser-level tests (Playwright) for the editor and share dialog.
5. Postgres (or a persistent volume) for a durable hosted deployment.

## Code map

- `server/db.js`: schema and seeded users
- `server/app.js`: routes, access control, validation, sanitizing, error handling
- `server/importers.js`: `.txt` / `.md` / `.docx` to HTML
- `server/exporters.js`: HTML to Markdown
- `server/test/api.test.js`: API tests
- `client/src/components/`: `Login`, `Dashboard`, `EditorPage`, `Toolbar`, `ShareDialog`, `ExportMenu`
