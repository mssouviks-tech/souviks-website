#!/usr/bin/env python3
import argparse, concurrent.futures, html, io, os, re, sys, textwrap
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

from PIL import Image
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import LongTable, TableStyle, Paragraph, SimpleDocTemplate, Spacer, PageBreak, KeepTogether

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Inches, Pt

NAVY = "102A43"
ORANGE = "EF7D22"
PALE = "E9EFF5"
INK = "17283D"
MUTED = "5E7185"
DATE = "08 November 2026"
SECTIONS_ORDER = [
    "LCV / SCV & Smaller Vehicles",
    "MHCV",
    "Tata LPT Family - Variant to Confirm",
    "Universal Items",
    "Lubricants",
    "Hardware & Fasteners",
    "Air Sockets",
]
ROOT = Path(__file__).resolve().parent
IMG_DIR = None
LOGO_PATH = None

def clean_text(fragment):
    fragment = re.sub(r"<[^>]+>", " ", fragment or "")
    fragment = html.unescape(fragment)
    return re.sub(r"\s+", " ", fragment).strip()

def parse_catalogue(path):
    source = Path(path).read_text(encoding="utf-8")
    rows, section, category = [], "", ""
    rx = re.compile(r'<h2\b[^>]*>(.*?)</h2>|<h3\b[^>]*>(.*?)</h3>|<article\b[^>]*class="item"[^>]*>(.*?)</article>', re.I | re.S)
    for match in rx.finditer(source):
        if match.group(1) is not None:
            section = clean_text(re.sub(r"<span\b.*?</span>", "", match.group(1), flags=re.I | re.S))
        elif match.group(2) is not None:
            category = clean_text(re.sub(r"<span\b.*?</span>", "", match.group(2), flags=re.I | re.S))
        else:
            article = match.group(3)
            name = clean_text((re.search(r"<h4\b[^>]*>(.*?)</h4>", article, re.I | re.S) or [None, ""])[1])
            part_line = clean_text((re.search(r'<div class="part"[^>]*>(.*?)</div>', article, re.I | re.S) or [None, ""])[1])
            smalls = [clean_text(x) for x in re.findall(r'<div class="small"[^>]*>(.*?)</div>', article, re.I | re.S)]
            brand, part_no = "", part_line
            brand_match = re.match(r"^(.+?)\s*[·|]\s*Part No\.?\s*(.*)$", part_line, re.I)
            if brand_match:
                brand, part_no = brand_match.group(1).strip(), brand_match.group(2).strip()
            img_match = re.search(r'<img\b[^>]*src="([^"]+)"', article, re.I)
            mrp_match = re.search(r"MRP:</b>\s*([^<&]+)", article, re.I)
            price_match = re.search(r"Our Price:</b>\s*([^<&]+)", article, re.I)
            application = smalls[1] if len(smalls) > 1 else ""
            application = re.sub(r"^Application:\s*", "", application, flags=re.I).strip()
            rows.append({
                "section": section, "category": category, "name": name,
                "brand": brand, "part_no": part_no,
                "application": application,
                "mrp": clean_text(mrp_match.group(1)) if mrp_match else "",
                "price": clean_text(price_match.group(1)) if price_match else "",
                "fitment": bool(re.search(r"FITMENT\s*/\s*VARIANT\s+CHECK\s+REQUIRED", article, re.I)),
                "image_url": img_match.group(1) if img_match else "",
            })
    if len(rows) != 871:
        raise RuntimeError("Expected 871 product cards from the approved catalogue source; parsed %s" % len(rows))
    seen = set()
    deduped = []
    for row in rows:
        key = (row["brand"].casefold(), row["part_no"].casefold(), row["name"].casefold())
        if key in seen:
            # Preserve distinct application/fitment records by merging their application text.
            previous = next(x for x in deduped if (x["brand"].casefold(), x["part_no"].casefold(), x["name"].casefold()) == key)
            if row["application"] and row["application"] not in previous["application"]:
                previous["application"] += " | " + row["application"]
            previous["fitment"] = previous["fitment"] or row["fitment"]
            continue
        seen.add(key)
        deduped.append(row)
    if len(deduped) != 871:
        raise RuntimeError("Deduplication changed the expected catalogue count; review source keys: %s" % len(deduped))
    return deduped

def fetch_bytes(url, timeout=14):
    if not url:
        return None
    try:
        req = Request(url, headers={"User-Agent": "Souviks-Print-Catalogue/1.0"})
        with urlopen(req, timeout=timeout) as response:
            data = response.read()
        if len(data) > 8 * 1024 * 1024:
            return None
        return data
    except (HTTPError, URLError, TimeoutError, OSError):
        return None

def prepare_image(data, path):
    if not data:
        return None
    try:
        im = Image.open(io.BytesIO(data))
        im.load()
        # Preserve source pixel dimensions; convert only container format for PPT/PDF compatibility.
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGBA" if "transparency" in im.info else "RGB")
        out = Path(path)
        out.parent.mkdir(parents=True, exist_ok=True)
        im.save(out, format="PNG", optimize=True)
        return str(out)
    except Exception:
        return None

def download_images(rows, outdir):
    global IMG_DIR, LOGO_PATH
    IMG_DIR = Path(outdir) / "images"
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    unique = {}
    for index, row in enumerate(rows):
        row["image_path"] = None
        if row["image_url"]:
            unique.setdefault(row["image_url"], []).append(index)
    def one(item):
        url, indexes = item
        data = fetch_bytes(url)
        path = IMG_DIR / ("%04d.png" % indexes[0])
        return url, indexes, prepare_image(data, path)
    with concurrent.futures.ThreadPoolExecutor(max_workers=14) as pool:
        for url, indexes, path in pool.map(one, unique.items()):
            if path:
                for index in indexes:
                    rows[index]["image_path"] = path
    logo_url = "https://www.souviks.co.in/assets/logo/souviks-logo.webp?v=a5300f9e16e9"
    LOGO_PATH = prepare_image(fetch_bytes(logo_url), Path(outdir) / "souviks-logo.png")
    return sum(1 for x in rows if x.get("image_path"))

def register_fonts():
    normal = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    if os.path.exists(normal):
        pdfmetrics.registerFont(TTFont("DV", normal))
        pdfmetrics.registerFont(TTFont("DV-Bold", bold))
        return "DV", "DV-Bold"
    return "Helvetica", "Helvetica-Bold"

def wrap_lines(text, max_width, font, size):
    words = (text or "").split()
    lines, current = [], ""
    for word in words:
        candidate = (current + " " + word).strip()
        if pdfmetrics.stringWidth(candidate, font, size) <= max_width or not current:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines

def draw_wrapped(c, text, x, y, width, font="Helvetica", size=7, leading=9, max_lines=None, color=colors.HexColor("#17283D")):
    c.setFont(font, size)
    c.setFillColor(color)
    lines = wrap_lines(text, width, font, size)
    if max_lines and len(lines) > max_lines:
        lines = lines[:max_lines]
        if lines:
            while lines[-1] and pdfmetrics.stringWidth(lines[-1] + "...", font, size) > width:
                lines[-1] = lines[-1][:-1]
            lines[-1] += "..."
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y

def pdf_watermark(c, page_w, page_h, regular_font):
    c.saveState()
    if LOGO_PATH and os.path.exists(LOGO_PATH):
        try:
            c.setFillAlpha(0.055)
            c.drawImage(LOGO_PATH, page_w * 0.29, page_h * 0.34, width=page_w * 0.42,
                        height=page_h * 0.30, preserveAspectRatio=True, anchor="c", mask="auto")
        except Exception:
            pass
    else:
        c.setFillAlpha(0.055)
        c.setFillColor(colors.HexColor("#8394A7"))
        c.setFont("Helvetica-Bold", 46)
        c.translate(page_w / 2, page_h / 2)
        c.drawCentredString(0, 0, "SOUVIKS")
    c.restoreState()

def draw_pdf_header(c, title, page_no, page_w, page_h, regular_font, bold_font):
    pdf_watermark(c, page_w, page_h, regular_font)
    c.setFillColor(colors.HexColor("#102A43"))
    c.rect(0, page_h - 33, page_w, 33, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont(bold_font, 13)
    c.drawString(28, page_h - 22, "SOUVIKS")
    c.setFillColor(colors.HexColor("#EF7D22"))
    c.rect(98, page_h - 33, 4, 33, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont(regular_font, 9)
    c.drawRightString(page_w - 28, page_h - 21, title[:110])
    c.setStrokeColor(colors.HexColor("#D5DEE8"))
    c.line(28, 25, page_w - 28, 25)
    c.setFillColor(colors.HexColor("#6B7B8D"))
    c.setFont(regular_font, 7)
    c.drawString(28, 14, "Souviks | Commercial Vehicle Parts | Shop Edition | %s" % DATE)
    c.drawRightString(page_w - 28, 14, "Page %s" % page_no)

def draw_cover_pdf(c, title, subtitle, rows, page_size, regular_font, bold_font, price_only=False):
    w, h = page_size
    pdf_watermark(c, w, h, regular_font)
    c.setFillColor(colors.HexColor("#102A43"))
    c.rect(0, h - 18, w, 18, fill=1, stroke=0)
    c.setFillColor(colors.HexColor("#EF7D22"))
    c.rect(0, h - 24, w, 6, fill=1, stroke=0)
    if LOGO_PATH and os.path.exists(LOGO_PATH):
        try:
            c.drawImage(LOGO_PATH, w/2 - 55, h - 150, width=110, height=60, preserveAspectRatio=True, anchor="c", mask="auto")
        except Exception:
            pass
    c.setFillColor(colors.HexColor("#102A43"))
    c.setFont(bold_font, 29 if not price_only else 28)
    c.drawCentredString(w/2, h - 205, title)
    c.setFillColor(colors.HexColor("#EF7D22"))
    c.setFont(bold_font, 12)
    c.drawCentredString(w/2, h - 231, "SOUVIKS  |  COMMERCIAL VEHICLE PARTS")
    c.setFillColor(colors.HexColor("#526579"))
    c.setFont(regular_font, 11)
    c.drawCentredString(w/2, h - 255, subtitle)
    counts = []
    for section in SECTIONS_ORDER:
        n = sum(1 for r in rows if r["section"] == section)
        if n:
            counts.append((section, n))
    # Summary tiles
    total = len(rows)
    tata_specific = sum(1 for r in rows if r["section"] in SECTIONS_ORDER[:3])
    universal = sum(1 for r in rows if r["section"] in SECTIONS_ORDER[3:])
    tiles = [("871", "PRODUCTS"), (str(tata_specific), "TATA-SPECIFIC"), (str(universal), "UNIVERSAL / GENERAL"), ("59", "BRANDS")]
    tile_w, gap = min(150, (w - 90 - 3*12)/4), 12
    start_x = (w - (tile_w*4 + gap*3))/2
    for i,(big,small) in enumerate(tiles):
        x = start_x + i*(tile_w+gap)
        y = h - 315
        c.setFillColor(colors.HexColor("#F5F7FA"))
        c.roundRect(x, y, tile_w, 45, 6, fill=1, stroke=0)
        c.setFillColor(colors.HexColor("#102A43"))
        c.setFont(bold_font, 17)
        c.drawCentredString(x+tile_w/2, y+25, big)
        c.setFillColor(colors.HexColor("#637487"))
        c.setFont(bold_font, 6.5)
        c.drawCentredString(x+tile_w/2, y+11, small)
    y = h - 385
    c.setFillColor(colors.HexColor("#102A43"))
    c.setFont(bold_font, 10)
    c.drawString(55, y, "CATALOGUE SECTIONS")
    y -= 17
    col_w = (w-120)/2
    for idx,(section,n) in enumerate(counts):
        col = idx % 2
        row = idx // 2
        x = 60 + col*col_w
        yy = y - row*20
        c.setFillColor(colors.HexColor("#EF7D22"))
        c.circle(x+3, yy+3, 2.3, fill=1, stroke=0)
        c.setFillColor(colors.HexColor("#24384B"))
        c.setFont(regular_font, 8.5)
        c.drawString(x+12, yy, section)
        c.setFont(bold_font, 8.5)
        c.drawRightString(x+col_w-16, yy, str(n))
    c.setFillColor(colors.HexColor("#526579"))
    c.setFont(regular_font, 8)
    c.drawCentredString(w/2, 55, "Match part number, variant, engine, axle, gearbox and chassis/VIN before fitment.")
    c.drawCentredString(w/2, 40, "Prices shown in INR. Blank price fields indicate price confirmation is required.")
    c.setFillColor(colors.HexColor("#102A43"))
    c.setFont(bold_font, 8)
    c.drawCentredString(w/2, 23, DATE)
    c.showPage()

def build_catalogue_pdf(rows, outpath, regular_font, bold_font):
    page_size = landscape(A4)
    w,h = page_size
    c = canvas.Canvas(str(outpath), pagesize=page_size, pageCompression=1)
    draw_cover_pdf(c, "Tata-Compatible Parts Catalogue",
                   "Cross-brand parts mapped to Tata commercial-vehicle applications", rows,
                   page_size, regular_font, bold_font, False)
    page_no = 2
    groups = []
    for section in SECTIONS_ORDER:
        group = [r for r in rows if r["section"] == section]
        if group:
            groups.append((section, group))
    for section, group in groups:
        for start in range(0, len(group), 6):
            batch = group[start:start+6]
            draw_pdf_header(c, section, page_no, w, h, regular_font, bold_font)
            y_top = h - 47
            card_w, card_h, gap_x, gap_y = (w - 56 - 2*12)/3, 253, 12, 10
            for j,row in enumerate(batch):
                col, rrow = j % 3, j // 3
                x = 28 + col*(card_w+gap_x)
                y = y_top - (rrow+1)*card_h - rrow*gap_y
                c.setFillColor(colors.HexColor("#FBFCFD"))
                c.setStrokeColor(colors.HexColor("#D6E0E9"))
                c.roundRect(x,y,card_w,card_h,5,fill=1,stroke=1)
                c.setFillColor(colors.HexColor("#EF7D22"))
                c.rect(x,y+card_h-4,card_w,4,fill=1,stroke=0)
                # Product image
                img_x, img_y, img_box = x+10, y+card_h-113, 96
                if row.get("image_path") and os.path.exists(row["image_path"]):
                    try:
                        c.drawImage(row["image_path"],img_x,img_y,width=img_box,height=img_box,
                                    preserveAspectRatio=True,anchor="c",mask="auto")
                    except Exception:
                        pass
                else:
                    c.setFillColor(colors.HexColor("#F0F3F6"))
                    c.roundRect(img_x,img_y,img_box,img_box,3,fill=1,stroke=0)
                    c.setFillColor(colors.HexColor("#9AA8B7"))
                    c.setFont(bold_font,7)
                    c.drawCentredString(img_x+img_box/2,img_y+49,"IMAGE")
                    c.drawCentredString(img_x+img_box/2,img_y+38,"NOT")
                    c.drawCentredString(img_x+img_box/2,img_y+27,"AVAILABLE")
                text_x = img_x+img_box+10
                text_w = card_w-(text_x-x)-10
                ty = y+card_h-22
                ty = draw_wrapped(c,row["name"],text_x,ty,text_w,bold_font,9,11,3,colors.HexColor("#102A43"))
                ty -= 4
                brand_part = (row["brand"] or "Brand not listed") + "  |  " + (row["part_no"] or "Part no. not listed")
                ty = draw_wrapped(c,brand_part,text_x,ty,text_w,bold_font,6.6,8,4,colors.HexColor("#D96815"))
                ty -= 5
                c.setFillColor(colors.HexColor("#6B7D90")); c.setFont(bold_font,6.3)
                c.drawString(text_x,ty,"SUBCATEGORY")
                ty -= 9
                ty = draw_wrapped(c,row["category"],text_x,ty,text_w,regular_font,7.2,9,3)
                ty -= 4
                c.setFillColor(colors.HexColor("#6B7D90")); c.setFont(bold_font,6.3)
                c.drawString(text_x,ty,"APPLICATION")
                ty -= 9
                ty = draw_wrapped(c,row["application"],text_x,ty,text_w,regular_font,6.5,8,6)
                # Lower detail block uses full card width.
                by = y+45
                c.setStrokeColor(colors.HexColor("#E0E6ED")); c.line(x+10,by+28,x+card_w-10,by+28)
                c.setFillColor(colors.HexColor("#64748B")); c.setFont(bold_font,7)
                c.drawString(x+12,by+17,"MRP")
                c.drawString(x+card_w/2,by+17,"SOUVIKS PRICE")
                c.setFillColor(colors.HexColor("#102A43")); c.setFont(bold_font,11)
                c.drawString(x+12,by+3,("Rs. "+row["mrp"]) if row["mrp"] else "")
                c.drawString(x+card_w/2,by+3,("Rs. "+row["price"]) if row["price"] else "")
                if row["fitment"]:
                    c.setFillColor(colors.HexColor("#FFF2DF"))
                    c.roundRect(x+10,y+7,card_w-20,15,3,fill=1,stroke=0)
                    c.setFillColor(colors.HexColor("#995000"))
                    c.setFont(bold_font,6.5)
                    c.drawCentredString(x+card_w/2,y+12,"FITMENT / VARIANT CHECK REQUIRED")
            c.showPage()
            page_no += 1
    c.save()

def build_price_pdf(rows, outpath, regular_font, bold_font):
    page_size = landscape(A4)
    w,h = page_size
    styles = getSampleStyleSheet()
    body = ParagraphStyle("body", fontName=regular_font, fontSize=6.6, leading=8, textColor=colors.HexColor("#24384B"), spaceAfter=0)
    small = ParagraphStyle("small", parent=body, fontSize=6.1, leading=7.3)
    bold = ParagraphStyle("bold", parent=body, fontName=bold_font, fontSize=7, leading=8, textColor=colors.HexColor("#102A43"))
    header = ParagraphStyle("header", parent=bold, fontSize=7, textColor=colors.white)
    story = []
    story.append(Paragraph("TATA-COMPATIBLE PARTS | PRICE LIST", ParagraphStyle("ttl", fontName=bold_font, fontSize=16, leading=19, textColor=colors.HexColor("#102A43"), spaceAfter=5)))
    story.append(Paragraph("Souviks shop edition - segmented by vehicle class and subcategory | 08 November 2026", ParagraphStyle("sub", fontName=regular_font, fontSize=8, textColor=colors.HexColor("#637487"), spaceAfter=10)))
    data = [[Paragraph("PART NUMBER",header),Paragraph("NAME",header),Paragraph("APPLICATION",header),Paragraph("MRP (INR)",header),Paragraph("SOUVIKS PRICE (INR)",header)]]
    row_types = ["header"]
    for section in SECTIONS_ORDER:
        group = [r for r in rows if r["section"] == section]
        if not group: continue
        data.append([Paragraph(html.escape(section.upper()),bold),"","","",""])
        row_types.append("section")
        current_cat = None
        for r in group:
            if r["category"] != current_cat:
                current_cat = r["category"]
                data.append([Paragraph("SUBCATEGORY - "+html.escape(current_cat.upper()),bold),"","","",""])
                row_types.append("category")
            data.append([
                Paragraph(html.escape(r["part_no"]),small),
                Paragraph(html.escape(r["name"]),body),
                Paragraph(html.escape(r["application"]),small),
                Paragraph(html.escape(r["mrp"]),body),
                Paragraph(html.escape(r["price"]),body),
            ])
            row_types.append("product")
    widths = [108, 160, 356, 76, 91]
    table = LongTable(data, colWidths=widths, repeatRows=1, hAlign="LEFT", splitByRow=1)
    style_cmds = [
        ("BACKGROUND",(0,0),(-1,0),colors.HexColor("#102A43")),
        ("TEXTCOLOR",(0,0),(-1,0),colors.white),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("LEFTPADDING",(0,0),(-1,-1),5),("RIGHTPADDING",(0,0),(-1,-1),5),
        ("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),3),
        ("LINEBELOW",(0,0),(-1,0),1,colors.HexColor("#EF7D22")),
        ("GRID",(0,0),(-1,-1),0.25,colors.HexColor("#D7DFE7")),
    ]
    for idx, kind in enumerate(row_types[1:], start=1):
        if kind == "section":
            style_cmds += [("SPAN",(0,idx),(-1,idx)),("BACKGROUND",(0,idx),(-1,idx),colors.HexColor("#102A43")),("TEXTCOLOR",(0,idx),(-1,idx),colors.white),("TOPPADDING",(0,idx),(-1,idx),5),("BOTTOMPADDING",(0,idx),(-1,idx),5)]
        elif kind == "category":
            style_cmds += [("SPAN",(0,idx),(-1,idx)),("BACKGROUND",(0,idx),(-1,idx),colors.HexColor("#E9EFF5")),("TOPPADDING",(0,idx),(-1,idx),4),("BOTTOMPADDING",(0,idx),(-1,idx),4)]
        elif idx % 2 == 0:
            style_cmds += [("BACKGROUND",(0,idx),(-1,idx),colors.HexColor("#FAFBFC"))]
    table.setStyle(TableStyle(style_cmds))
    story.append(table)
    def page(c, doc):
        pdf_watermark(c,w,h,regular_font)
        c.saveState()
        c.setFillColor(colors.HexColor("#102A43")); c.rect(0,h-24,w,24,fill=1,stroke=0)
        c.setFillColor(colors.white); c.setFont(bold_font,9); c.drawString(28,h-16,"SOUVIKS")
        c.setFillColor(colors.HexColor("#EF7D22")); c.rect(83,h-24,3,24,fill=1,stroke=0)
        c.setFillColor(colors.HexColor("#6B7B8D")); c.setFont(regular_font,6.5)
        c.line(28,22,w-28,22); c.drawString(28,12,"Souviks | Shop Edition | INR")
        c.drawRightString(w-28,12,"Page %s" % doc.page)
        c.restoreState()
    doc = SimpleDocTemplate(str(outpath), pagesize=page_size, rightMargin=28, leftMargin=28, topMargin=34, bottomMargin=30, title="Souviks Tata-Compatible Price List", author="Souviks")
    doc.build(story,onFirstPage=page,onLaterPages=page)

def pptx_rgb(hex_value):
    return RGBColor.from_string(hex_value)

def set_text(shape, text, size=9, color=INK, bold=False, font="Arial", align=None):
    tf = shape.text_frame
    tf.clear()
    tf.word_wrap = True
    tf.margin_left = Inches(0.03)
    tf.margin_right = Inches(0.03)
    tf.margin_top = Inches(0.01)
    tf.margin_bottom = Inches(0.01)
    p = tf.paragraphs[0]
    if align is not None: p.alignment = align
    run = p.add_run()
    run.text = str(text or "")
    run.font.name = font
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = pptx_rgb(color)
    return shape

def add_bg_and_header(slide, title, number, total, watermark_path=None):
    slide.background.fill.solid()
    slide.background.fill.fore_color.rgb = pptx_rgb("FFFFFF")
    # watermark behind all content
    if watermark_path and os.path.exists(watermark_path):
        try:
            slide.shapes.add_picture(watermark_path, Inches(4.3), Inches(2.55), width=Inches(4.7))
        except Exception:
            pass
    else:
        wm = slide.shapes.add_textbox(Inches(3.8), Inches(3.0), Inches(6), Inches(1))
        set_text(wm,"SOUVIKS",42,"E9EEF3",True,align=PP_ALIGN.CENTER)
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE,0,0,Inches(13.333),Inches(.48))
    bar.fill.solid(); bar.fill.fore_color.rgb = pptx_rgb(NAVY); bar.line.fill.background()
    brand = slide.shapes.add_textbox(Inches(.3), Inches(.07), Inches(1.7), Inches(.3))
    set_text(brand,"SOUVIKS",15,"FFFFFF",True)
    stripe=slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(2.1), Inches(.0), Inches(.045), Inches(.48))
    stripe.fill.solid(); stripe.fill.fore_color.rgb = pptx_rgb(ORANGE); stripe.line.fill.background()
    titlebox=slide.shapes.add_textbox(Inches(2.28), Inches(.1), Inches(9.6), Inches(.27))
    set_text(titlebox,title,10,"FFFFFF",False)
    foot=slide.shapes.add_textbox(Inches(.35), Inches(7.22), Inches(12.6), Inches(.18))
    set_text(foot,"Souviks | Commercial Vehicle Parts | Shop Edition | %s" % DATE,7,"738295")
    pn=slide.shapes.add_textbox(Inches(12.4), Inches(7.22), Inches(.55), Inches(.18))
    set_text(pn,"%s / %s"%(number,total),7,"738295",align=PP_ALIGN.RIGHT)

def add_cover_slide(prs, title, subtitle, rows, deck_type, wm_path=None):
    slide=prs.slides.add_slide(prs.slide_layouts[6])
    slide.background.fill.solid(); slide.background.fill.fore_color.rgb=pptx_rgb("FFFFFF")
    if wm_path and os.path.exists(wm_path):
        try: slide.shapes.add_picture(wm_path, Inches(4.6), Inches(2.2), width=Inches(4.2))
        except Exception: pass
    else:
        wm=slide.shapes.add_textbox(Inches(3.5), Inches(2.7), Inches(6.4), Inches(1.0)); set_text(wm,"SOUVIKS",46,"E9EEF3",True,align=PP_ALIGN.CENTER)
    bar=slide.shapes.add_shape(MSO_SHAPE.RECTANGLE,0,0,Inches(13.333),Inches(.5))
    bar.fill.solid(); bar.fill.fore_color.rgb=pptx_rgb(NAVY); bar.line.fill.background()
    stripe=slide.shapes.add_shape(MSO_SHAPE.RECTANGLE,0,Inches(.5),Inches(13.333),Inches(.07))
    stripe.fill.solid(); stripe.fill.fore_color.rgb=pptx_rgb(ORANGE); stripe.line.fill.background()
    t=slide.shapes.add_textbox(Inches(.8), Inches(1.55), Inches(11.7), Inches(.85)); set_text(t,title,26,NAVY,True,align=PP_ALIGN.CENTER)
    s=slide.shapes.add_textbox(Inches(1.2), Inches(2.42), Inches(10.9), Inches(.45)); set_text(s,subtitle,12,MUTED,False,align=PP_ALIGN.CENTER)
    counts=[(x,sum(1 for r in rows if r["section"]==x)) for x in SECTIONS_ORDER]
    counts=[x for x in counts if x[1]]
    total=len(rows); tata=sum(n for sec,n in counts if sec in SECTIONS_ORDER[:3]); universal=total-tata
    tiles=[("871","PRODUCTS"),(str(tata),"TATA-SPECIFIC"),(str(universal),"UNIVERSAL / GENERAL"),("59","BRANDS")]
    for i,(val,label) in enumerate(tiles):
        x=Inches(1.2+i*2.83)
        box=slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE,x,Inches(3.35),Inches(2.45),Inches(.8))
        box.fill.solid(); box.fill.fore_color.rgb=pptx_rgb("F5F7FA"); box.line.color.rgb=pptx_rgb("D7DFE7")
        a=slide.shapes.add_textbox(x,Inches(3.45),Inches(2.45),Inches(.33));set_text(a,val,20,NAVY,True,align=PP_ALIGN.CENTER)
        b=slide.shapes.add_textbox(x,Inches(3.82),Inches(2.45),Inches(.18));set_text(b,label,7,MUTED,True,align=PP_ALIGN.CENTER)
    listbox=slide.shapes.add_textbox(Inches(1.6), Inches(4.55), Inches(10.1), Inches(1.1))
    tf=listbox.text_frame; tf.clear()
    for idx,(section,n) in enumerate(counts):
        p=tf.paragraphs[0] if idx==0 else tf.add_paragraph()
        p.text="%s   |   %s products"%(section,n);p.font.name="Arial";p.font.size=Pt(10);p.font.color.rgb=pptx_rgb(INK)
        p.space_after=Pt(3)
    note=slide.shapes.add_textbox(Inches(.9), Inches(6.4), Inches(11.6), Inches(.35))
    set_text(note,"Match part number, variant, engine, axle, gearbox and chassis/VIN before fitment.",8,MUTED,False,align=PP_ALIGN.CENTER)
    return slide

def add_product_card(slide, row, x, y, w, h):
    card=slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE,x,y,w,h)
    card.fill.solid(); card.fill.fore_color.rgb=pptx_rgb("FBFCFD")
    card.line.color.rgb=pptx_rgb("D7DFE7"); card.line.width=Pt(.8)
    stripe=slide.shapes.add_shape(MSO_SHAPE.RECTANGLE,x,y,w,Inches(.045))
    stripe.fill.solid(); stripe.fill.fore_color.rgb=pptx_rgb(ORANGE); stripe.line.fill.background()
    ix=x+Inches(.12); iy=y+Inches(.38); maxw=Inches(1.05); maxh=Inches(1.05)
    image_path=row.get("image_path")
    if image_path and os.path.exists(image_path):
        try:
            im=Image.open(image_path); iw,ih=im.size; scale=min(maxw/iw,maxh/ih)
            pw,ph=iw*scale,ih*scale
            slide.shapes.add_picture(image_path,ix+(maxw-pw)/2,iy+(maxh-ph)/2,width=pw,height=ph)
        except Exception:
            pass
    else:
        ph=slide.shapes.add_shape(MSO_SHAPE.RECTANGLE,ix,iy,maxw,maxh)
        ph.fill.solid();ph.fill.fore_color.rgb=pptx_rgb("F0F3F6");ph.line.fill.background()
        tx=slide.shapes.add_textbox(ix,iy+Inches(.43),maxw,Inches(.2));set_text(tx,"IMAGE N/A",7,"9AA8B7",True,align=PP_ALIGN.CENTER)
    tx=x+Inches(1.28); tw=w-Inches(1.4)
    tb=slide.shapes.add_textbox(tx,y+Inches(.25),tw,Inches(.55));set_text(tb,row["name"],10,NAVY,True)
    br=(row["brand"] or "Brand not listed")+"  |  "+(row["part_no"] or "Part no. not listed")
    bb=slide.shapes.add_textbox(tx,y+Inches(.82),tw,Inches(.34));set_text(bb,br,7,ORANGE,True)
    cat=slide.shapes.add_textbox(tx,y+Inches(1.18),tw,Inches(.22));set_text(cat,row["category"],7,MUTED,True)
    app=slide.shapes.add_textbox(x+Inches(.14),y+Inches(1.5),w-Inches(.28),Inches(.74));set_text(app,row["application"],7,INK,False)
    price=slide.shapes.add_textbox(x+Inches(.14),y+h-Inches(.43),w-Inches(.28),Inches(.2))
    set_text(price,("MRP: Rs. "+row["mrp"] if row["mrp"] else "MRP: ")+"     "+("SOUVIKS PRICE: Rs. "+row["price"] if row["price"] else "SOUVIKS PRICE: "),8,NAVY,True)
    if row["fitment"]:
        flag=slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE,x+Inches(.12),y+h-Inches(.19),w-Inches(.24),Inches(.14))
        flag.fill.solid();flag.fill.fore_color.rgb=pptx_rgb("FFF2DF");flag.line.fill.background()
        ft=slide.shapes.add_textbox(x+Inches(.12),y+h-Inches(.185),w-Inches(.24),Inches(.12));set_text(ft,"FITMENT / VARIANT CHECK REQUIRED",6,"995000",True,align=PP_ALIGN.CENTER)

def build_catalogue_pptx(rows, outpath, image_count):
    prs=Presentation();prs.slide_width=Inches(13.333);prs.slide_height=Inches(7.5)
    add_cover_slide(prs,"Tata-Compatible Parts Catalogue","Cross-brand parts mapped to Tata commercial-vehicle applications",rows,"catalogue",LOGO_PATH)
    groups=[(sec,[r for r in rows if r["section"]==sec]) for sec in SECTIONS_ORDER]
    batches=[]
    for sec,group in groups:
        for start in range(0,len(group),6): batches.append((sec,group[start:start+6]))
    total=len(batches)+1
    for num,(section,batch) in enumerate(batches,start=2):
        slide=prs.slides.add_slide(prs.slide_layouts[6])
        add_bg_and_header(slide,"TATA-COMPATIBLE PARTS  |  "+section,num,total,LOGO_PATH)
        left,top=Inches(.35),Inches(.72)
        cw,ch=Inches(4.12),Inches(2.93)
        gx,gy=Inches(.16),Inches(.16)
        for j,row in enumerate(batch):
            col,rw=j%3,j//3
            add_product_card(slide,row,left+col*(cw+gx),top+rw*(ch+gy),cw,ch)
    prs.core_properties.title="Souviks Tata-Compatible Parts Catalogue"
    prs.core_properties.author="Souviks"
    prs.core_properties.subject="Cross-brand Tata-compatible commercial-vehicle parts"
    prs.save(outpath)

def build_price_pptx(rows, outpath):
    prs=Presentation();prs.slide_width=Inches(13.333);prs.slide_height=Inches(7.5)
    add_cover_slide(prs,"Tata-Compatible Parts Price List","Five-column price list, separated by vehicle segment and subcategory",rows,"price")
    batches=[]
    per_slide=15
    for section in SECTIONS_ORDER:
        group=[r for r in rows if r["section"]==section]
        cats=[]
        for row in group:
            if not cats or cats[-1][0] != row["category"]:
                cats.append((row["category"],[row]))
            else: cats[-1][1].append(row)
        for cat,items in cats:
            for start in range(0,len(items),per_slide):
                batches.append((section,cat,items[start:start+per_slide]))
    total=len(batches)+1
    for number,(section,category,items) in enumerate(batches,start=2):
        slide=prs.slides.add_slide(prs.slide_layouts[6])
        add_bg_and_header(slide,"PRICE LIST  |  "+section+"  |  "+category,number,total)
        heading=slide.shapes.add_textbox(Inches(.38), Inches(.68), Inches(12.5), Inches(.38))
        set_text(heading,section+"   /   "+category,15,NAVY,True)
        table=slide.shapes.add_table(len(items)+1,5,Inches(.38),Inches(1.18),Inches(12.55),Inches(5.6)).table
        widths=[1.55,2.45,5.7,1.25,1.6]
        for col,width in enumerate(widths): table.columns[col].width=Inches(width)
        headings=["PART NUMBER","NAME","APPLICATION","MRP (INR)","SOUVIKS PRICE (INR)"]
        for cidx,label in enumerate(headings):
            cell=table.cell(0,cidx);cell.text=label
            cell.fill.solid();cell.fill.fore_color.rgb=pptx_rgb(NAVY)
            cell.margin_left=Inches(.05);cell.margin_right=Inches(.05)
            for p in cell.text_frame.paragraphs:
                p.font.name="Arial";p.font.size=Pt(8);p.font.bold=True;p.font.color.rgb=pptx_rgb("FFFFFF")
        for ridx,row in enumerate(items,start=1):
            vals=[row["part_no"],row["name"],row["application"],row["mrp"],row["price"]]
            table.rows[ridx].height=Inches(.35)
            for cidx,val in enumerate(vals):
                cell=table.cell(ridx,cidx);cell.text=str(val or "")
                cell.fill.solid();cell.fill.fore_color.rgb=pptx_rgb("F8FAFC" if ridx%2==0 else "FFFFFF")
                cell.margin_left=Inches(.05);cell.margin_right=Inches(.04);cell.margin_top=Inches(.02);cell.margin_bottom=Inches(.02)
                for p in cell.text_frame.paragraphs:
                    p.font.name="Arial";p.font.size=Pt(7.2);p.font.color.rgb=pptx_rgb(INK)
        if any(r["fitment"] for r in items):
            flag=slide.shapes.add_textbox(Inches(.45), Inches(6.84), Inches(12.2), Inches(.18))
            set_text(flag,"Some items on this page require part-number and vehicle-variant confirmation.",7,"995000")
    prs.core_properties.title="Souviks Tata-Compatible Parts Price List"
    prs.core_properties.author="Souviks"
    prs.core_properties.subject="LCV/SCV and MHCV segmented five-column price list"
    prs.save(outpath)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--source",required=True)
    ap.add_argument("--out",required=True)
    args=ap.parse_args()
    outdir=Path(args.out);outdir.mkdir(parents=True,exist_ok=True)
    rows=parse_catalogue(args.source)
    image_count=download_images(rows,outdir)
    normal,bold=register_fonts()
    catalogue_pdf=outdir/"Souviks_Tata-Compatible_Parts_Catalogue.pdf"
    price_pdf=outdir/"Souviks_Tata-Compatible_Price_List.pdf"
    catalogue_ppt=outdir/"Souviks_Tata-Compatible_Parts_Catalogue_Editable.pptx"
    price_ppt=outdir/"Souviks_Tata-Compatible_Price_List_Editable.pptx"
    build_catalogue_pdf(rows,catalogue_pdf,normal,bold)
    build_price_pdf(rows,price_pdf,normal,bold)
    build_catalogue_pptx(rows,catalogue_ppt,image_count)
    build_price_pptx(rows,price_ppt)
    import json
    report={
        "products":len(rows),
        "brands":len(set(r["brand"] for r in rows if r["brand"])),
        "fitment_flags":sum(1 for r in rows if r["fitment"]),
        "missing_mrp":sum(1 for r in rows if not r["mrp"]),
        "missing_price":sum(1 for r in rows if not r["price"]),
        "images_embedded":image_count,
        "sections":{s:sum(1 for r in rows if r["section"]==s) for s in SECTIONS_ORDER},
        "files":[x.name for x in [catalogue_pdf,price_pdf,catalogue_ppt,price_ppt]],
    }
    (outdir/"build_report.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    print(json.dumps(report,indent=2))

if __name__=="__main__":
    main()
