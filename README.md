# Triagon ERP — web edition (v2.0)

Browser-based ERP for Triagon Ventures: catalogue and per-channel listings, inventory in any unit (pieces, sq ft, metres…), purchasing and vendor bills, custom-size sales orders, returns and platform claims, finance and bank accounts, marketing offers, listing ratings, attendance with a check-in kiosk, HR and payroll, daily PDF reports, and an MCP endpoint for AI agents.

- **Host it**: see [DEPLOY.md](DEPLOY.md) — clone this repo on a Hostinger VPS and run one script (Docker + Caddy HTTPS). Live at https://triagonventures.cloud once deployed.
- **Run it on a PC to try** (Node.js 22.13 or newer):
  ```
  npm ci
  npm run build
  npm start            # http://localhost:8080
  ```
  Data goes to `./data` (set `DATA_DIR` to change). PDFs need Chromium: `npx playwright-core install chromium` once.
- **AI agents**: `POST /mcp` (Streamable HTTP, Bearer key) or `/mcp/<key>`; REST at `/api/v1/<collection>`. Create keys in *Users & permissions › AI & API access*.

Folders: `server/` (Node, SQLite via `node:sqlite`, no other database to run), `client/` (the app; `client/build.js` bundles it), `shared/` (modules and permissions used by both), `deploy/` (install and update scripts).
