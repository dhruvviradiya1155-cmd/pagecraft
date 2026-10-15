# Pagecraft – free online PDF tools

A complete PDF website with 26 tools. Most run in the visitor's browser (fast, private, no server cost). The conversions that need real office software run on your server.

| Runs in the browser (18) | Runs on the server (8) |
|---|---|
| Merge, Split, Remove pages, Extract pages, Organize, Compress, OCR, JPG to PDF, HTML to PDF, PDF to JPG, PDF to Text, Rotate, Page numbers, Watermark, Crop, Unlock, Protect, Sign | Word to PDF, Excel to PDF, PowerPoint to PDF, PDF to Word, PDF to Excel, PDF to PowerPoint, PDF to PDF/A, Repair PDF |

Each tool has its own address (for example `/merge-pdf`, `/pdf-to-word`) so Google can list every tool separately.

---

## Launch it (Render, about 15 minutes)

You need a free **GitHub** account and a free **Render** account.

1. **Put the code on GitHub**
   - Go to github.com → **New repository** → name it `pagecraft` → **Create**.
   - Click **uploading an existing file**, drag in everything inside this folder (the `app`, `static`, `templates` folders and all other files) and click **Commit changes**.

2. **Deploy on Render**
   - Go to dashboard.render.com → **New +** → **Blueprint**.
   - Connect your GitHub and pick the `pagecraft` repository. Render reads `render.yaml` and sets everything up.
   - Fill in `CONTACT_EMAIL` (shown on your privacy page). Leave `SITE_URL` empty for now.
   - Click **Apply**. The first build takes about 10 minutes (it installs LibreOffice).

3. **Open your site** at the `https://pagecraft-xxxx.onrender.com` address Render shows you.

4. **Before going public, switch the plan to Starter** (about $7/month). The free plan sleeps after 15 minutes without visitors, and the next visitor then waits about a minute.

### Use your own domain (for example pagecraft.in)
1. Buy the domain (GoDaddy, Hostinger, Namecheap, Cloudflare…).
2. In Render: your service → **Settings** → **Custom Domains** → add it, then copy the DNS records Render shows into your domain provider's DNS page.
3. In Render → **Environment**, set `SITE_URL` to `https://yourdomain.com` and save.

### Get found on Google
Open search.google.com/search-console, add your domain, and submit `https://yourdomain.com/sitemap.xml`.

---

## Settings (Render → Environment)

| Name | What it does | Default |
|---|---|---|
| `SITE_NAME` | Name shown in the header, titles and pages | `Pagecraft` |
| `SITE_URL` | Your public address, used by Google and the sitemap | auto |
| `CONTACT_EMAIL` | Shown on the privacy, terms and footer | `contact@example.com` |
| `MAX_UPLOAD_MB` | Largest file a visitor may upload for server tools | `50` |
| `MAX_PAGES` | Largest PDF (pages) for server tools | `200` |
| `MAX_CONCURRENT` | Server conversions at the same time. Use 1 on 512 MB plans, 2–3 on 2 GB | `2` |
| `RATE_LIMIT` | Server conversions per visitor per 10 minutes | `30` |
| `CONVERT_TIMEOUT` | Seconds before a stuck conversion is stopped | `180` |

To rename the site, change `SITE_NAME` – no code changes needed.

---

## Run it on your own computer

With Docker Desktop installed, open a terminal in this folder and run:

```
docker compose up --build
```

Then open http://localhost:8000.

Without Docker (Linux/macOS, needs LibreOffice, Ghostscript and qpdf installed):

```
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

## Other hosts
The `Dockerfile` works anywhere that runs Docker: Railway, Fly.io, DigitalOcean App Platform, Google Cloud Run, or any VPS (Hostinger, DigitalOcean, AWS Lightsail). Give it at least 1 GB of memory for comfortable use.

---

## How it's built

```
app/
  main.py      web server: pages, sitemap, upload limits, rate limits, conversion queue
  convert.py   server conversions (LibreOffice, Ghostscript, qpdf)
  worker.py    PDF to Word / Excel / PowerPoint, run in a separate process with a time limit
  tools.json   the list of tools (names, descriptions, web addresses) used by server and browser
  config.py    settings from environment variables
templates/     page layout plus About, Privacy and Terms pages
static/        styles, browser code (all browser tools), favicon
```

- Uploaded files are stored in a temporary folder and deleted as soon as the result is sent back (or on error).
- Each conversion runs with a time limit, so one bad file can't freeze the server.
- Files are checked by their contents, not just their name, before conversion.
- To add or rename a tool's text, edit `app/tools.json`.

## Good to know
- **PDF to Word** keeps text, images and tables that have lines. Tables without lines come out as neatly aligned text rather than a Word table.
- **PDF to Excel** works best on computer-made PDFs (bank statements, invoices, reports). Scanned pages need OCR PDF first.
- **Compress** turns pages into optimized images; best for scans. Text in the result can't be selected.
- **HTML to PDF** can split a line of text across a page break.
