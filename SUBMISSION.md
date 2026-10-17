# Submission

**Live product URL:** _<paste deployed URL>_
**Walkthrough video:** see `VIDEO_URL.txt`
**Test accounts:** `alice@example.com`, `bob@example.com`, `carol@example.com` (no password; click the user on the login screen)

## Included
| Path | What it is |
| --- | --- |
| `server/` | Express API, SQLite schema, access control, importers, tests |
| `client/` | React + Tiptap frontend (Vite) |
| `README.md` | Setup, run, test, features, limitations |
| `ARCHITECTURE.md` | Architecture note: priorities, trade-offs, next steps |
| `AI_WORKFLOW.md` | AI-native workflow note |
| `SUBMISSION.md` | This file |
| `VIDEO_URL.txt` | Walkthrough video link |
| `VIDEO_OUTLINE.md` | Outline used for the walkthrough |
| `Dockerfile`, `render.yaml` | Deployment config |

## Status
**Working end to end:** create / rename / edit / autosave / reopen documents; bold, italic, underline, headings, bulleted and numbered lists;
import `.txt` / `.md` / `.docx` into a new document; sharing as editor or viewer with owned vs shared lists; persistence across refresh and restart;
validation and error handling; **stretch: export to Markdown and PDF** (plus editor/viewer sharing roles); 8 passing API tests.

**Partial / not built:** real authentication, real-time collaboration (saves are last-write-wins), version history, server-side PDF rendering, rich `.docx` fidelity (tables and images are dropped),
automated browser tests. A free-tier deployment may reset its data on restart.

**Next with 2-4 more hours:** version history, conflict detection (409 on stale saves), Playwright tests, a durable database for hosting.
