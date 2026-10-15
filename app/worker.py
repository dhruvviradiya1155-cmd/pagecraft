"""Heavy PDF conversions, run in a child process so they can be time-limited and
can't take the web server down with them.

Usage: python -m app.worker <job> <input> <output> [json-options]
Exit code 0 = success. Exit code 3 = a message for the user is printed on stderr.
"""
import json
import logging
import re
import sys

logging.disable(logging.CRITICAL)


class UserError(Exception):
    pass


def pdf_to_word(src, dst, opts):
    from pdf2docx import Converter
    cv = Converter(src)
    try:
        # Tables with ruling lines become real Word tables. Borderless "tables" are kept as
        # tab-aligned text, which is accurate, instead of being guessed (and often scrambled).
        cv.convert(dst, multi_processing=False, parse_stream_table=False)
    finally:
        cv.close()


NUM_RE = re.compile(r"^[-+]?(\d{1,3}(,\d{2,3})+|\d+)(\.\d+)?$")


def to_cell(value):
    if value is None:
        return None
    s = " ".join(str(value).split())
    if not s:
        return None
    if NUM_RE.match(s):
        plain = s.replace(",", "")
        digits = plain.lstrip("+-")
        # keep IDs and phone numbers like 007 or 9876543210123 as text
        if not (digits.startswith("0") and len(digits) > 1 and "." not in digits) and len(digits.replace(".", "")) <= 15:
            return float(plain) if "." in plain else int(plain)
    return s


def table_from_words(page):
    """Rebuild a table from word positions, for tables drawn without grid lines."""
    from collections import Counter
    from statistics import median
    words = page.extract_words(x_tolerance=1.5, y_tolerance=2)
    if not words:
        return None
    words.sort(key=lambda w: (w["top"], w["x0"]))
    lines = []
    for w in words:
        if lines and abs(lines[-1][0]["top"] - w["top"]) <= 3:
            lines[-1].append(w)
        else:
            lines.append([w])
    chunked = []
    for ln in lines:
        ln.sort(key=lambda w: w["x0"])
        em = median(w["bottom"] - w["top"] for w in ln) or 8
        chunks = []
        for w in ln:  # words closer than ~half a letter height belong to the same cell
            if chunks and w["x0"] - chunks[-1]["x1"] < em * 0.6:
                chunks[-1]["text"] += " " + w["text"]
                chunks[-1]["x1"] = w["x1"]
                chunks[-1]["words"].append(w)
            else:
                chunks.append({"text": w["text"], "x0": w["x0"], "x1": w["x1"], "words": [w]})
        chunked.append(chunks)
    counts = Counter(len(c) for c in chunked if len(c) > 1)
    if not counts:
        return [[c["text"] for c in ch] for ch in chunked]
    typical = counts.most_common(1)[0][0]
    regular = [ch for ch in chunked if len(ch) == typical]
    # column k = the k-th cell of every regular row; median edges ignore odd overflowing cells
    cols = [[median(ch[k]["x0"] for ch in regular), median(ch[k]["x1"] for ch in regular)] for k in range(typical)]

    def col_of(x):
        return min(range(len(cols)), key=lambda k: 0 if cols[k][0] <= x <= cols[k][1] else min(abs(x - cols[k][0]), abs(x - cols[k][1])))

    rows = []
    for ch in chunked:
        if len(ch) == typical:
            rows.append([c["text"] for c in ch])
            continue
        row = [None] * len(cols)
        for c in ch:
            parts, ws_ = [c], c["words"]
            if len(ws_) > 1 and col_of((ws_[0]["x0"] + ws_[0]["x1"]) / 2) != col_of((ws_[-1]["x0"] + ws_[-1]["x1"]) / 2):
                parts = ws_  # this cell spans two columns: place each word on its own
            for p in parts:
                j = col_of((p["x0"] + p["x1"]) / 2)
                row[j] = p["text"] if row[j] is None else row[j] + " " + p["text"]
        rows.append(row)
    return rows


def pdf_to_excel(src, dst, opts):
    import pdfplumber
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    from openpyxl.utils import get_column_letter

    single = opts.get("layout") == "single"
    wb = Workbook()
    wb.remove(wb.active)
    bold = Font(bold=True)
    head_fill = PatternFill("solid", fgColor="E8EDFB")
    page_font = Font(bold=True, italic=True, color="666666")
    next_row = {}
    found = 0

    def write(ws, values, font=None, fill=None):
        r = next_row.get(ws.title, 1)
        for j, v in enumerate(values, 1):
            cell = ws.cell(row=r, column=j, value=v)
            if font and v is not None:
                cell.font = font
            if fill:
                cell.fill = fill
        next_row[ws.title] = r + 1

    ws_all = wb.create_sheet("Tables") if single else None
    with pdfplumber.open(src) as pdf:
        for pno, page in enumerate(pdf.pages, 1):
            tables = [t for t in page.extract_tables() if t]
            if not tables:
                t = table_from_words(page)
                tables = [t] if t else []
            tables = [[[to_cell(c) for c in row] for row in t if row and any(c not in (None, "") for c in row)] for t in tables]
            tables = [t for t in tables if t]
            if not tables:
                continue
            ws = ws_all if single else wb.create_sheet(f"Page {pno}")
            for t in tables:
                found += 1
                if single:
                    write(ws, [f"Page {pno}"], font=page_font)
                write(ws, t[0], font=bold, fill=head_fill)
                for row in t[1:]:
                    write(ws, row)
                next_row[ws.title] += 1  # blank row between tables

    if not found:
        raise UserError("No tables or text were found in this PDF. If it is a scan, run OCR PDF on it first, then try again.")

    for ws in wb.worksheets:
        widths = {}
        for row in ws.iter_rows():
            for c in row:
                if c.value is not None:
                    widths[c.column] = max(widths.get(c.column, 0), min(60, len(str(c.value))))
        for col, w in widths.items():
            ws.column_dimensions[get_column_letter(col)].width = max(8, w + 2)
    wb.save(dst)


def pdf_to_ppt_images(src, dst, opts):
    import io
    import pymupdf
    from pptx import Presentation
    from pptx.util import Emu

    doc = pymupdf.open(src)
    first = doc[0].rect
    # PowerPoint allows slides up to 56 inches (4032 pt) on a side
    scale = min(1.0, 4032 / max(first.width, first.height))
    prs = Presentation()
    prs.slide_width = Emu(int(first.width * scale * 12700))
    prs.slide_height = Emu(int(first.height * scale * 12700))
    blank = prs.slide_layouts[6]
    for page in doc:
        pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False)
        slide = prs.slides.add_slide(blank)
        r = page.rect
        sw, sh = prs.slide_width, prs.slide_height
        fit = min(sw / (r.width * 12700), sh / (r.height * 12700))
        w, h = int(r.width * 12700 * fit), int(r.height * 12700 * fit)
        slide.shapes.add_picture(io.BytesIO(pix.tobytes("png")), (sw - w) // 2, (sh - h) // 2, w, h)
    prs.save(dst)


JOBS = {"pdf2word": pdf_to_word, "pdf2excel": pdf_to_excel, "pdf2ppt_images": pdf_to_ppt_images}

if __name__ == "__main__":
    job, src, dst = sys.argv[1:4]
    opts = json.loads(sys.argv[4]) if len(sys.argv) > 4 else {}
    try:
        JOBS[job](src, dst, opts)
    except UserError as e:
        sys.stderr.write(str(e))
        sys.exit(3)
