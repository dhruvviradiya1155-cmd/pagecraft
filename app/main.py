"""Pagecraft web server: serves the website and runs the conversions that need a server."""
import asyncio
import hashlib
import html
import json
import logging
import re
import shutil
import tempfile
import time
from collections import defaultdict, deque
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool

from .config import settings
from .convert import CONVERTERS, ConvertError, engines

log = logging.getLogger("pagecraft")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / "static"
TEMPLATES = ROOT / "templates"
DATA = json.loads((ROOT / "app" / "tools.json").read_text(encoding="utf-8"))
TOOLS = {t["id"]: t for t in DATA["tools"]}
BY_SLUG = {t["slug"]: t for t in DATA["tools"]}
GROUPS = {g["id"]: g for g in DATA["groups"]}
JOBS_DIR = Path(tempfile.gettempdir()) / "pagecraft-jobs"
PROFILES_DIR = Path(tempfile.gettempdir()) / "pagecraft-lo"

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
app.mount("/assets", StaticFiles(directory=STATIC / "assets"), name="assets")


def asset_version(name):
    return hashlib.md5((STATIC / "assets" / name).read_bytes()).hexdigest()[:10]


ASSET_V = {n: asset_version(n) for n in ("styles.css", "app.js")}


@app.middleware("http")
async def security_headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    resp.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    resp.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if request.url.path.startswith("/assets/"):
        resp.headers["Cache-Control"] = "public, max-age=604800"
    return resp


# ---------------------------------------------------------------- pages

def base_url(request: Request) -> str:
    return settings.site_url or str(request.base_url).rstrip("/")


def fill(text: str) -> str:
    return (text.replace("{{SITE_NAME}}", html.escape(settings.site_name))
                .replace("{{CONTACT_EMAIL}}", html.escape(settings.contact_email))
                .replace("{{MAX_UPLOAD_MB}}", str(settings.max_upload_mb)))


def render(request: Request, *, title, description, path, page, content, tool_id="", status=200):
    boot = {"groups": DATA["groups"], "tools": DATA["tools"], "page": page, "toolId": tool_id,
            "siteName": settings.site_name, "maxUploadMb": settings.max_upload_mb}
    out = (TEMPLATES / "base.html").read_text(encoding="utf-8")
    out = (out.replace("{{TITLE}}", html.escape(title))
              .replace("{{DESCRIPTION}}", html.escape(description))
              .replace("{{CANONICAL}}", html.escape(base_url(request) + path))
              .replace("{{CSS_V}}", ASSET_V["styles.css"]).replace("{{JS_V}}", ASSET_V["app.js"])
              .replace("{{BOOT}}", json.dumps(boot).replace("</", "<\\/"))
              .replace("{{CONTENT}}", content))
    return HTMLResponse(fill(out), status_code=status)


def home_content():
    parts = ['<div class="wrap"><section class="hero"><h1>Every PDF tool you need, in one place.</h1>'
             '<p>Merge, split, compress, convert and sign PDFs for free.</p></section>']
    for g in DATA["groups"]:
        links = "".join(f'<li><a href="/{t["slug"]}">{html.escape(t["name"])}</a> – {html.escape(t["desc"])}</li>'
                        for t in DATA["tools"] if t["g"] == g["id"])
        parts.append(f'<section class="group"><h2>{html.escape(g["label"])}</h2><ul>{links}</ul></section>')
    return "".join(parts) + "</div>"


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return render(request, title=f"{settings.site_name} – Free PDF tools: merge, split, compress, convert",
                  description="Free online PDF tools. Merge, split, compress, convert Word, Excel, PowerPoint and JPG to and from PDF, sign, protect and more. No sign-up.",
                  path="/", page="home", content=home_content())


STATIC_PAGES = {
    "privacy": ("Privacy policy", "How {{SITE_NAME}} handles your files and data."),
    "terms": ("Terms of use", "The rules for using {{SITE_NAME}}."),
    "about": ("About", "What {{SITE_NAME}} is and how it works."),
}


@app.get("/robots.txt", response_class=PlainTextResponse)
async def robots(request: Request):
    return f"User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: {base_url(request)}/sitemap.xml\n"


@app.get("/sitemap.xml")
async def sitemap(request: Request):
    b = base_url(request)
    urls = [b + "/"] + [f"{b}/{t['slug']}" for t in DATA["tools"]] + [f"{b}/{p}" for p in STATIC_PAGES]
    body = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    body += "".join(f"  <url><loc>{html.escape(u)}</loc></url>\n" for u in urls) + "</urlset>\n"
    return Response(body, media_type="application/xml")


@app.get("/favicon.svg")
@app.get("/favicon.ico")
async def favicon():
    return FileResponse(STATIC / "favicon.svg", media_type="image/svg+xml")


@app.get("/api/health")
async def health():
    e = engines()
    return {"ok": all(e.values()), "engines": e}


@app.get("/{slug}", response_class=HTMLResponse)
async def page(slug: str, request: Request):
    if slug in BY_SLUG:
        t = BY_SLUG[slug]
        content = (f'<div class="wrap"><div class="tool-head"><div><h1>{html.escape(t["name"])}</h1>'
                   f'<p>{html.escape(t["desc"])}</p></div></div>'
                   '<noscript><p>Please turn on JavaScript to use this tool.</p></noscript></div>')
        return render(request, title=f"{t['name']} – free online | {settings.site_name}",
                      description=f"{t['desc']} Free, fast and no sign-up.",
                      path=f"/{slug}", page="tool", content=content, tool_id=t["id"])
    if slug in STATIC_PAGES:
        title, desc = STATIC_PAGES[slug]
        body = (TEMPLATES / f"{slug}.html").read_text(encoding="utf-8")
        return render(request, title=f"{fill(title)} | {settings.site_name}", description=fill(desc),
                      path=f"/{slug}", page="static", content=f'<div class="wrap prose">{body}</div>')
    return not_found(request)


def not_found(request):
    content = ('<div class="wrap prose center-block"><h1>Page not found</h1>'
               '<p>This page doesn\'t exist. It may have moved.</p><p><a class="btn" href="/">See all PDF tools</a></p></div>')
    return render(request, title=f"Page not found | {settings.site_name}", description="Page not found.",
                  path=request.url.path, page="static", content=content, status=404)


# ---------------------------------------------------------------- conversions

class Limiter:
    def __init__(self, limit, window=600):
        self.limit, self.window, self.hits = limit, window, defaultdict(deque)

    def allow(self, key):
        now, q = time.monotonic(), self.hits[key]
        while q and q[0] < now - self.window:
            q.popleft()
        if len(q) >= self.limit:
            return False
        q.append(now)
        if len(self.hits) > 20000:  # keep memory bounded
            for k in [k for k, v in self.hits.items() if not v][:10000]:
                del self.hits[k]
        return True


limiter = Limiter(settings.rate_limit)
state = {"waiting": 0}
slots: asyncio.Queue = asyncio.Queue()


@app.on_event("startup")
async def startup():
    shutil.rmtree(JOBS_DIR, ignore_errors=True)
    JOBS_DIR.mkdir(parents=True, exist_ok=True)
    PROFILES_DIR.mkdir(parents=True, exist_ok=True)
    for i in range(max(1, settings.max_concurrent)):
        slots.put_nowait(i)
    log.info("engines: %s", engines())


OLE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"


def looks_valid(kind: str, ext: str, head: bytes) -> bool:
    if kind == "pdf":
        return b"%PDF" in head[:1024]
    if kind == "anypdf":
        return b"%PDF" in head[:2048]
    if ext in (".docx", ".xlsx", ".pptx", ".ppsx", ".odt", ".ods", ".odp"):
        return head.startswith(b"PK\x03\x04")
    if ext in (".doc", ".xls", ".ppt", ".pps"):
        return head.startswith(OLE) or head.startswith(b"PK\x03\x04") or head.lstrip()[:5].lower() in (b"<html", b"{\\rtf")
    if ext == ".rtf":
        return head.startswith(b"{\\rtf")
    if ext in (".txt", ".csv"):
        return b"\x00" not in head[:4096]
    return False


def err(message, status=422):
    return JSONResponse({"error": message}, status_code=status)


def safe_stem(name: str) -> str:
    stem = Path(name or "file").stem
    stem = re.sub(r"[\x00-\x1f/\\:*?\"<>|]+", "_", stem).strip(" .") or "file"
    return stem[:120]


@app.post("/api/convert/{tool_id}")
async def convert(tool_id: str, request: Request):
    if tool_id not in CONVERTERS:
        return err("Unknown tool.", 404)
    fn, kind, out_ext = CONVERTERS[tool_id]
    limit = settings.max_upload_mb * 1024 * 1024

    length = request.headers.get("content-length")
    if not length:
        return err("Upload size missing. Please try again.", 411)
    if int(length) > limit + 1024 * 1024:
        return err(f"This file is too large. The limit is {settings.max_upload_mb} MB.", 413)
    ip = request.client.host if request.client else "unknown"
    if not limiter.allow(ip):
        return err("You've reached the limit for conversions. Please wait a few minutes and try again.", 429)

    form = await request.form(max_files=1, max_fields=10)
    upload = form.get("file")
    if upload is None or not hasattr(upload, "filename"):
        return err("No file was received. Choose a file and try again.", 400)
    allowed = [a.strip() for a in TOOLS[tool_id]["accept"].split(",") if a.strip().startswith(".")]
    ext = Path(upload.filename or "").suffix.lower()
    if ext not in allowed:
        return err(f"This tool accepts {', '.join(allowed)} files.", 415)

    work = Path(tempfile.mkdtemp(dir=JOBS_DIR))
    try:
        src = work / f"input{ext}"
        size = 0
        with src.open("wb") as fh:
            while chunk := await upload.read(1024 * 1024):
                size += len(chunk)
                if size > limit:
                    raise ConvertError(f"This file is too large. The limit is {settings.max_upload_mb} MB.", 413)
                fh.write(chunk)
        await upload.close()
        if size == 0:
            raise ConvertError("This file is empty.", 400)
        with src.open("rb") as fh:
            if not looks_valid(kind, ext, fh.read(4096)):
                raise ConvertError(f"This doesn't look like a real {ext} file. It may be damaged or renamed.", 415)

        opts = {k: str(form.get(k, ""))[:20] for k in ("fit", "layout", "mode", "level")}
        if state["waiting"] >= settings.max_queue:
            raise ConvertError("The server is busy right now. Please try again in a minute.", 503)
        state["waiting"] += 1
        try:
            slot = await slots.get()
        finally:
            state["waiting"] -= 1
        try:
            profile = PROFILES_DIR / f"slot-{slot}"
            started = time.monotonic()
            out = await run_in_threadpool(fn, src, work, profile, opts)
            log.info("converted %s %.1f MB in %.1fs", tool_id, size / 1048576, time.monotonic() - started)
        finally:
            slots.put_nowait(slot)

        suffix = {"repair": "_repaired", "pdfa": "_pdfa"}.get(tool_id, "")
        name = f"{safe_stem(upload.filename)}{suffix}.{out_ext}"
        media = {"pdf": "application/pdf",
                 "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                 "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                 "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation"}[out_ext]
        return FileResponse(out, media_type=media, filename=name,
                            background=BackgroundTask(shutil.rmtree, work, ignore_errors=True))
    except ConvertError as e:
        shutil.rmtree(work, ignore_errors=True)
        return err(e.message, e.status)
    except Exception:
        shutil.rmtree(work, ignore_errors=True)
        log.exception("conversion failed for %s", tool_id)
        return err("Something went wrong while converting this file. Please try again.", 500)
