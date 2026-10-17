# Collab Docs

A lightweight collaborative document editor (Google Docs-inspired): rich-text editing, file import, sharing with
permissions, and persistence. One Node process serves both the API and the built React app.

**Live demo:** _<paste deployed URL here>_  ·  **Walkthrough video:** see `VIDEO_URL.txt`

## Demo accounts (no passwords, mocked auth)

| User | Email |
| --- | --- |
| Alice Johnson | `alice@example.com` |
| Bob Martinez | `bob@example.com` |
| Carol Singh | `carol@example.com` |

Click a user on the login screen. To see sharing, sign in as Alice in one tab and Bob in another tab. Sessions are stored per tab (`sessionStorage`), so you can sign in as different users in two tabs of the same browser. A login survives refresh but not closing the tab.

## Run locally

Requires **Node 22+**.

```bash
npm run install:all     # server + client dependencies
npm run build           # builds the React client into client/dist
npm start               # http://localhost:3001  (API + UI)
```

Hot-reload development (two terminals):

```bash
npm run dev:server      # API on :3001
npm run dev:client      # Vite on :5173, proxies /api to :3001
```

Data is stored in `./data/docs.sqlite` (override the folder with `DATA_DIR`). Delete that folder to reset.

### Tests

```bash
npm test
```

8 API tests (node:test, in-memory SQLite, real HTTP) cover: auth required, create/rename/edit/reopen, HTML sanitizing,
validation, sharing (owner-only management, viewer vs editor, owned vs shared lists, revoke, hidden-doc 404s), and file import
(`.md` structure, `.txt` escaping, unsupported / empty / corrupt files), and Markdown export (structure, headers, viewer access, hidden-doc 404).

### Docker

```bash
docker build -t collab-docs . && docker run -p 3001:3001 -v collab-data:/data collab-docs
```

## Features

- **Documents:** create, rename (click the title), edit, autosave (800 ms debounce, with Saved / Saving / Failed status and retry), reopen.
- **Formatting:** bold, italic, underline, headings 1-3, bulleted and numbered lists, undo/redo (Tiptap / ProseMirror). Stored as sanitized HTML.
- **File upload / import:** upload a **`.txt`, `.md`, or `.docx`** file and it becomes a new editable document (title taken from the filename).
  Supported types and the 5 MB limit are shown on the dashboard; anything else is rejected with a clear message.
  `.docx` imports keep headings, bold/italic/underline, and lists; images, tables, and comments are dropped.
- **Sharing:** owner shares by email as **Can edit** or **View only**, changes a role, or removes access. Dashboard splits
  **My documents** (Owner badge, share count) from **Shared with me** (role badge and who shared it). Viewers get a read-only editor and a banner.
  Only owners can delete or manage sharing. Users without access get a 404, so the existence of a document is not leaked.
- **Export (stretch feature):** the **Export** menu in the editor downloads the document as **Markdown** (headings, bold, italic, lists; underline is kept as inline `<u>` because Markdown has no underline) or produces a **PDF** through the browser's print dialog (choose "Save as PDF"; a print stylesheet hides the app chrome). Anyone with access, including view-only users, can export.
- **Persistence:** SQLite (documents, shares, users, sessions). Everything survives refresh and server restart.

## Known limitations

- Auth is mocked (seeded users, bearer-token sessions). Not for production use.
- No real-time collaboration: saves are last-write-wins, so two people editing the same document at once can overwrite each other.
- Free-tier hosting usually has an ephemeral disk, so a deployed instance may reset its data on redeploy or restart (seeded users come back automatically).
- `.docx` import is best-effort (see above); PDF export relies on the browser's print dialog rather than server-side rendering.
# Collab-docs
