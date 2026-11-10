# Triagon ERP — web edition (v2.0)

Browser-based ERP for Triagon Ventures: a CEO report with a 0–100 business health score, catalogue and per-channel listings, inventory in any unit (pieces, sq ft, metres…), purchasing and vendor bills, custom-size sales orders, returns and platform claims, finance and bank accounts, marketing offers, listing ratings, attendance with a check-in kiosk, HR and payroll, daily PDF reports, and an MCP endpoint for AI agents.

- **Host it**: see [DEPLOY.md](DEPLOY.md) — clone this repo on a Hostinger VPS and run one script (Docker + Caddy HTTPS). Live at https://triagonventures.cloud once deployed.
- **Run it on a PC to try** (Node.js 22.13 or newer):
  ```
  npm ci
  npm run build
  npm start            # http://localhost:8080
  ```
  Data goes to `./data` (set `DATA_DIR` to change). PDFs need Chromium: `npx playwright-core install chromium` once.
- **AI agents**: `POST /mcp` (Streamable HTTP, Bearer key) or `/mcp/<key>`; REST at `/api/v1/<collection>`. Create keys in *Users & permissions › AI & API access*.

Works on phones, tablets and PCs: on narrow screens wide tables turn into one card per row and line-item editors stack their fields.

**CEO report** (Overview › CEO report, CEO only by default; grant it per role in Users & permissions): 29 measures in 7 areas — sales growth, profitability, cash & collections, inventory health, customers & fulfilment, listings & purchasing, people. Each measure scores 0 at its *poor* mark and 100 at its *good* mark; areas average their measures and the overall score is the weighted average of areas with data. It lists what to fix first (ranked by points gained), a brand scorecard, a copyable summary and a PDF. Marks and weights are editable in *Scoring targets*.

Folders: `server/` (Node, SQLite via `node:sqlite`, no other database to run), `client/` (the app; `client/build.js` bundles it), `shared/` (modules and permissions used by both), `deploy/` (install and update scripts).
