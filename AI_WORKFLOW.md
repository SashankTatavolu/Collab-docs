# AI-native workflow note

## Tools used

- **Claude (Sonnet 5.5)** in an agentic session with file and shell access: scaffolding, server and client code, tests, docs, and running the app.'
- VS Code for editing and running the app locally; Chrome for manual testing.

## Where AI materially sped things up

- Scaffolding the full stack (Express + SQLite schema, Vite + React + Tiptap) and the boilerplate around it in one pass.
- Writing the API test suite from a list of behaviors I cared about (access control, roles, import edge cases).
- Producing first drafts of the README and architecture note, which I then edited against what was actually built.
- Quick feedback loops: running the server, restarting it, and replaying requests to check persistence.

## What I changed or rejected

- **Rejected a hand-rolled `contentEditable` editor** in favor of Tiptap: formatting, undo/redo, and list behavior are the parts that break.
- **Kept the permission model on the server.** The UI hides actions, but every route re-checks role, and non-visible documents return 404.
- **Fixed AI-generated mistakes caught while running things:**

  - a test-script edit that broke `package.json` quoting (found when `npm test` refused to parse it);
  - a sloppy "revoke access" step in the first draft of the sharing test that deleted an arbitrary user id; I rewrote it to look up the real user id and assert the result;
  - Node 22's test runner doesn't accept a directory argument, so the test script points at the test file.
  - applying a heading to a text selection converted the whole paragraph (found in the browser with an imported document); fixed by splitting the block around the selection, and verified with a headless editor test;
  - login tokens were stored in localStorage, so two tabs shared one account and sign-in as a second user was overwritten on refresh; fixed by switching to per-tab sessionStorage;
  - a new helper file was saved with the wrong extension, which broke the import and the build; fixed by renaming it.
- **Scoped down on purpose:** no real-time collaboration, no real auth, hand-rolled Markdown subset instead of a full parser.

## How I verified correctness, UX, and reliability

- **Automated:** `npm test` runs 8 API tests over real HTTP against in-memory SQLite (all passing at submission).
- **Manual API checks:** persistence across a server restart (document content and session survived), a real `.docx` import (heading and bold preserved), static client and SPA fallback served.
- **Build:** the production client build succeeds.
- **UX:** _Fill in honestly: which flows you clicked through in the browser, in which browsers, and what you fixed. The UI components were generated and built successfully, but confirm them yourself in a browser before recording the video._
