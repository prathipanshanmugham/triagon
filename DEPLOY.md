# Triagon ERP — hosting on a Hostinger VPS

The ERP is now a web app. It runs on your VPS, everyone signs in from a browser (PC, tablet or phone), and changes show live on every screen. It can also be installed like an app from Chrome or Edge.

## What you need

- A Hostinger **VPS** (KVM 2 or higher: 2 vCPU, 8 GB RAM is comfortable; KVM 1 works for a small team). Shared or cloud web hosting will not run it.
- OS: **Ubuntu 24.04** (the “Ubuntu 24.04 with Docker” template is ideal).
- The domain for the ERP: `triagonventures.cloud` (a subdomain such as `erp.triagonventures.cloud` works the same way).

## 1. Point the domain at the VPS

In hPanel › Domains › `triagonventures.cloud` › DNS / Nameservers, set these records (edit the existing ones; delete any other A, AAAA or CNAME records on `@` and `www`, which point to Hostinger’s parking page):

| Type | Name | Points to | TTL |
|---|---|---|---|
| A | `@` | your VPS IP (hPanel › VPS › Overview) | 300 |
| A | `www` | your VPS IP | 300 |

Wait 5–15 minutes, then check from your PC: `nslookup triagonventures.cloud` should show the VPS IP.

## 2. Get the code onto the VPS

Connect (hPanel › VPS › Browser terminal, or `ssh root@YOUR_VPS_IP` from PowerShell/Terminal) and run:

```
apt-get update && apt-get install -y git
git clone https://github.com/prathipanshanmugham/triagon.git /opt/triagon
cd /opt/triagon
```

## 3. Install

```
printf 'DOMAIN=triagonventures.cloud\nACME_EMAIL=you@example.com\n' > .env   # use your email
sudo bash deploy/install.sh
```

It installs Docker if needed, checks the DNS, opens ports 80/443, builds the app and starts it with a free HTTPS certificate (Caddy + Let’s Encrypt). The first build takes about 3–5 minutes. (Without a `.env` file it asks for the domain and email instead.)

If you turned on the firewall in hPanel › VPS › Security › Firewall, allow TCP 22, 80 and 443 there too.

## 4. First sign-in

Open `https://triagonventures.cloud`.

- **Fresh start**: create the CEO account (name, username, password). Tick “Load demo data” if you want to explore first; remove it later from the banner.
- **Moving from the Windows desktop app**: in the desktop app open *Users & permissions › Company & audit* and click *Save a backup copy…*, then choose “Import a desktop backup” on the setup screen and pick that file. Your records, employees and PINs come across.

Then add your team in *Users & permissions* (each person gets a username and password).

## Everyday use

- **Install as an app**: in Chrome/Edge open the ERP and click the install icon in the address bar (on Android: menu › *Add to Home screen*).
- **Check-in kiosk**: on the tablet at the entrance, go to *Attendance › Office hours & holidays › Check-in kiosk devices › Make this device a kiosk* (sign in once as a manager to do this; the kiosk then works signed out). Or create a kiosk link and open it on the device.
- **Daily PDF**: the server saves the daily report automatically at the time set in *Daily report*, even when nobody has the ERP open. Missed days are caught up.
- **AI agents**: *Users & permissions › AI & API access* creates keys for Claude (custom connector) or scripts. Each key acts as one team member and every change is logged.

## Backups

- The server makes a full backup every night at 02:15 and keeps 30 days in `/opt/triagon/data/backups/`.
- The CEO can download a full backup any time from *Users & permissions › Company & audit › Download a full backup*.
- Turn on Hostinger’s weekly VPS snapshots too, and now and then copy `data/backups/` off the server:
  `scp -r root@YOUR_VPS_IP:/opt/triagon/data/backups ./erp-backups`
- Uploaded bills and documents are in `data/files/`, saved daily reports in `data/reports/`.

## Updating to a new version

Your `data/` folder and `.env` are never in git, so pulling a new version doesn’t touch them:

```
cd /opt/triagon && git pull && sudo bash deploy/update.sh
```

It takes a backup first, rebuilds and restarts. Sessions stay signed in.

## Useful commands

| What | Command (run in `/opt/triagon`) |
|---|---|
| See if it’s running | `docker compose ps` |
| Live logs | `docker compose logs -f erp` |
| Restart | `docker compose restart erp` |
| Reset a forgotten password | `docker compose exec erp node server/cli.js reset-password <username>` |
| List usernames | `docker compose exec erp node server/cli.js users` |
| Stop / start | `docker compose down` / `docker compose up -d` |

## Troubleshooting

- **Browser shows a certificate error right after install**: the DNS record wasn’t live yet. Check it resolves to the VPS (`getent hosts triagonventures.cloud`), then `docker compose restart caddy`.
- **PDFs fail**: run `docker compose logs erp | grep -i pdf`. The server needs about 300 MB of free RAM to render a PDF.
- **“Too many attempts” at sign-in**: wait 15 minutes, or reset the password with the command above.
- **Port 80/443 already used**: another web server (Apache/Nginx) is running. Stop it (`systemctl disable --now apache2 nginx`) or put the ERP on its own VPS.

## Security notes

- The ERP holds HR and bank details. Keep it on HTTPS (the installer does this), give every person their own login, and use strong passwords.
- Only ports 80 and 443 need to be open. The app itself listens on 127.0.0.1:8080 and is reached only through Caddy.
- Revoke AI/API keys and kiosk devices you no longer use.
