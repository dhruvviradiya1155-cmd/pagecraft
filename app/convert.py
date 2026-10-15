"""Server-side conversions. Each function takes an input path and a work directory
and returns the path of the finished file, or raises ConvertError with a message
that is safe to show to the visitor."""
import glob
import json
import os
import shutil
import signal
import subprocess
import sys
from pathlib import Path

from .config import settings


class ConvertError(Exception):
    def __init__(self, message: str, status: int = 422):
        super().__init__(message)
        self.message = message
        self.status = status


def run(cmd, timeout=None, env=None, cwd=None):
    """Run a command in its own process group so a timeout kills every child."""
    timeout = timeout or settings.timeout
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            start_new_session=True, env=env, cwd=cwd)
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        proc.communicate()
        raise ConvertError("The conversion took too long and was stopped. Try a smaller file.", 504)
    return proc.returncode, out.decode(errors="replace"), err.decode(errors="replace")


def check_pdf(path: Path):
    import pymupdf
    try:
        doc = pymupdf.open(path)
    except Exception:
        raise ConvertError("This file couldn't be read as a PDF. If it is damaged, try Repair PDF first.")
    with doc:
        if doc.needs_pass:
            raise ConvertError("This PDF is password-protected. Remove the password with Unlock PDF, then try again.")
        if doc.page_count == 0:
            raise ConvertError("This PDF has no pages.")
        if doc.page_count > settings.max_pages:
            raise ConvertError(f"This PDF has {doc.page_count} pages. The limit is {settings.max_pages} pages per file.", 413)
        return doc.page_count


# ---------- Office -> PDF (LibreOffice) ----------

def soffice_convert(src: Path, outdir: Path, profile: Path, target: str, infilter: str | None = None) -> Path:
    cmd = ["soffice", f"-env:UserInstallation=file://{profile}", "--headless", "--norestore",
           "--nologo", "--nodefault", "--nolockcheck"]
    if infilter:
        cmd.append(f"--infilter={infilter}")
    cmd += ["--convert-to", target, "--outdir", str(outdir), str(src)]
    env = dict(os.environ, HOME=str(profile))
    run(cmd, env=env)
    ext = target.split(":")[0]
    out = outdir / f"{src.stem}.{ext}"
    if not out.exists() or out.stat().st_size == 0:
        raise ConvertError("This file couldn't be converted. It may be damaged, password-protected, or not a real Office file.")
    return out


def office_to_pdf(src: Path, work: Path, profile: Path, opts: dict) -> Path:
    target = "pdf"
    if src.suffix.lower() in (".xls", ".xlsx", ".ods", ".csv") and opts.get("fit") == "1":
        target = 'pdf:calc_pdf_Export:{"SinglePageSheets":{"type":"boolean","value":"true"}}'
    out = work / "out"
    out.mkdir()
    return soffice_convert(src, out, profile, target)


# ---------- PDF -> Office (child process worker) ----------

def worker(job: str, src: Path, dst: Path, opts: dict) -> Path:
    code, _, err = run([sys.executable, "-m", "app.worker", job, str(src), str(dst), json.dumps(opts)],
                       cwd=str(Path(__file__).resolve().parent.parent))
    if code == 3:
        raise ConvertError(err.strip() or "This file couldn't be converted.")
    if code != 0 or not dst.exists():
        raise ConvertError("This PDF couldn't be converted. It may be damaged or use features we can't read.", 500)
    return dst


def pdf_to_word(src, work, profile, opts):
    check_pdf(src)
    return worker("pdf2word", src, work / "result.docx", {})


def pdf_to_excel(src, work, profile, opts):
    check_pdf(src)
    return worker("pdf2excel", src, work / "result.xlsx", {"layout": opts.get("layout", "pages")})


def pdf_to_ppt(src, work, profile, opts):
    check_pdf(src)
    if opts.get("mode") == "edit":
        out = work / "out"
        out.mkdir()
        return soffice_convert(src, out, profile, "pptx", infilter="impress_pdf_import")
    return worker("pdf2ppt_images", src, work / "result.pptx", {})


# ---------- Repair (qpdf, then Ghostscript) ----------

def repair(src, work, profile, opts):
    import pymupdf
    head = src.read_bytes()[:2048]
    if b"%PDF" not in head:
        raise ConvertError("This file isn't a PDF, so it can't be repaired.")
    out = work / "repaired.pdf"
    code, _, _ = run(["qpdf", "--object-streams=generate", str(src), str(out)])
    ok = code in (0, 3) and out.exists()
    if ok:
        try:
            with pymupdf.open(out) as d:
                ok = d.page_count > 0
        except Exception:
            ok = False
    if not ok:
        out.unlink(missing_ok=True)
        run(["gs", "-q", "-dBATCH", "-dNOPAUSE", "-dSAFER", "-sDEVICE=pdfwrite", f"-sOutputFile={out}", str(src)])
        try:
            with pymupdf.open(out) as d:
                if d.page_count == 0:
                    raise ValueError
        except Exception:
            raise ConvertError("This PDF is too badly damaged to recover any pages.")
    return out


# ---------- PDF/A (Ghostscript) ----------

def _icc_profile():
    for pattern in ("/usr/share/ghostscript/*/iccprofiles/default_rgb.icc",
                    "/usr/share/color/icc/ghostscript/default_rgb.icc",
                    "/usr/share/color/icc/ghostscript/srgb.icc"):
        found = glob.glob(pattern)
        if found:
            return found[0]
    return None


def pdfa(src, work, profile, opts):
    check_pdf(src)
    level = opts.get("level", "2") if opts.get("level") in ("1", "2", "3") else "2"
    icc = _icc_profile()
    if not icc:
        raise ConvertError("PDF/A conversion isn't set up on this server (missing color profile).", 500)
    defs = work / "pdfa_def.ps"
    defs.write_text(
        "%!\n"
        f"/ICCProfile ({icc}) def\n"
        "[/_objdef {icc_PDFA} /type /stream /OBJ pdfmark\n"
        "[{icc_PDFA} <</N 3>> /PUT pdfmark\n"
        "[{icc_PDFA} ICCProfile (r) file /PUT pdfmark\n"
        "[/_objdef {OutputIntent_PDFA} /type /dict /OBJ pdfmark\n"
        "[{OutputIntent_PDFA} << /Type /OutputIntent /S /GTS_PDFA1 /DestOutputProfile {icc_PDFA} "
        "/OutputConditionIdentifier (sRGB) >> /PUT pdfmark\n"
        "[{Catalog} << /OutputIntents [ {OutputIntent_PDFA} ] >> /PUT pdfmark\n")
    out = work / "pdfa.pdf"
    cmd = ["gs", "-q", "-dBATCH", "-dNOPAUSE", "-dNOSAFER", f"-dPDFA={level}", "-dPDFACompatibilityPolicy=1",
           "-sColorConversionStrategy=RGB", "-sDEVICE=pdfwrite", f"--permit-file-read={icc}",
           f"-sOutputFile={out}", str(defs), str(src)]
    run(cmd)
    if not out.exists() or out.stat().st_size == 0:
        raise ConvertError("This PDF couldn't be converted to PDF/A.")
    return out


# tool id -> (function, kind of input expected, output extension)
CONVERTERS = {
    "word2pdf":  (office_to_pdf, "office", "pdf"),
    "excel2pdf": (office_to_pdf, "office", "pdf"),
    "ppt2pdf":   (office_to_pdf, "office", "pdf"),
    "pdf2word":  (pdf_to_word,   "pdf",    "docx"),
    "pdf2excel": (pdf_to_excel,  "pdf",    "xlsx"),
    "pdf2ppt":   (pdf_to_ppt,    "pdf",    "pptx"),
    "repair":    (repair,        "anypdf", "pdf"),
    "pdfa":      (pdfa,          "pdf",    "pdf"),
}


def engines():
    return {"libreoffice": bool(shutil.which("soffice")), "ghostscript": bool(shutil.which("gs")),
            "qpdf": bool(shutil.which("qpdf")), "color_profile": bool(_icc_profile())}
