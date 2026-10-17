# 3-5 minute walkthrough outline

1. **0:00 Intro (20s):** goal, stack (React + Tiptap, Express, SQLite), one deployable app.
2. **0:20 Main flow (90s):** sign in as Alice, new document, rename, type with heading / bold / italic / underline / lists, watch "Saved", refresh to show persistence.
3. **1:50 Upload (30s):** import a `.md` or `.docx`, show it become an editable doc; try a `.pdf` to show the clear error. Point out supported types on the dashboard.
4. **2:20 Sharing (60s):** share with Bob as View only; in a second profile, sign in as Bob: "Shared with me", read-only banner, no toolbar. Back as Alice, change to Can edit, Bob edits, Alice sees it on reopen.
5. **3:20 Decisions (45s):** server-enforced access, sanitized HTML storage, SQLite, mocked auth, last-write-wins; what I deprioritized and why.
6. **4:05 AI usage (40s):** what Claude sped up, what I rejected/fixed, how I verified (tests, restart check).
7. **4:45 Wrap (10s):** what I'd build next: version history and conflict detection.
