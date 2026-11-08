#!/usr/bin/env python3
import json, os, re, math
from collections import defaultdict
from datetime import datetime
from xml.sax.saxutils import escape

from PIL import Image
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, LongTable,
    TableStyle, KeepTogether
)
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics

ROOT = os.getcwd()
DATA = os.path.join(ROOT, "assets", "data", "products.json")
LOGO_DARK = os.path.join(ROOT, "assets", "logo", "souviks-logo.webp")
LOGO_WHITE = os.path.join(ROOT, "assets", "logo", "souviks-logo-white.webp")
OUT = os.path.join(ROOT, "dist")
os.makedirs(OUT, exist_ok=True)

NAVY = colors.HexColor("#172B46")
NAVY2 = colors.HexColor("#223D5D")
ORANGE = colors.HexColor("#F39A28")
PALE = colors.HexColor("#F2F5F8")
PALE2 = colors.HexColor("#E8EDF2")
INK = colors.HexColor("#1C2B3A")
MUTED = colors.HexColor("#65778A")
WHITE = colors.white
PAGE_W, PAGE_H = landscape(A4)

# Concise, customer-usable model/family applications taken from the latest
# product application records. Evidence citations and internal reconciliation
# language are deliberately excluded from the PDFs.
APPLICATION_OVERRIDES = {
    "SVKS000280": "Tata Prima / Tata 3118 (front brake lining; 14-hole standard)",
    "SVKS000282": "Tata LPT 2523 TC BS IV (12-hole brake-lining set)",
    "SVKS000288": "Tata 3718 / 4923 BS IV (separator-assembly application)",
    "SVKS000463": "Tata 1512 LP/LPO TC BS III; Tata Signa 2818.T / 3518.S / 4018.S BS IV; Tata LPO 1613 CNG; Tata LPT 3718 BS IV; Tata 2515EX / 2516 / 3015 / 3516 / 4018 (Cummins B-series); Ashok Leyland 2516",
    "SVKS000486": "Tata 1210 / 1312 / 1313 / 1510 / 1512 / 1612 / 1613 / 1615 / 1616 (with hub)",
    "SVKS000488": "Volvo Eicher Pro-5000; Tata LPK 1615 / 1616",
    "SVKS000489": "Volvo Eicher VE1102; Tata 352 push-type clutch applications",
    "SVKS000513": "Tata trucks; Isuzu trucks (make-level application; individual models not specified)",
    "SVKS000539": "Tata 3118 / 2518 (RSB type)",
    "SVKS000541": "Tata 1210 / 1312 / 1313 / 1510 / 1512 / 1612 / 1613 / 1615 / 1616 (with hub)",
    "SVKS000543": "Tata 1312 / 1516 / 1510 / 2516 / 1513 / 1613 / 2515",
    "SVKS000544": "Tata 1312 / 1516 / 1510 / 2515 / 1613",
    "SVKS000545": "Tata 1312 / 1516 / 1510 / 1612 / 2515",
    "SVKS000546": "Tata 1312 / 1516 / 1510 / 1612 / 2515 (1st oversize)",
    "SVKS000547": "Tata 1312 / 1516 / 1510 / 2515 / 1613 (2nd oversize)",
    "SVKS000548": "Tata 1312 / 1516 / 1510 / 2515 / 1613 (3rd oversize)",
    "SVKS000569": "Tata commercial vehicles (make-level; 24V relay)",
    "SVKS000584": "Tata commercial vehicles (704 cc twin-cylinder flange-mounted compressor family)",
    "SVKS000772": "Tata 1616 / LPT 1613 / 1210 series",
    "SVKS000791": "Tata / Ashok Leyland / DICV / VECV commercial vehicles (make-level)",
    "SVKS000796": "Tata 2724 / 2540 heavy commercial vehicles (clutch-cover application)",
    "SVKS000810": "Tata / Ashok Leyland commercial vehicles (air-brake drain-valve application)",
    "SVKS000812": "Tata vehicles (common wheel-fastener application; individual models not specified)",
    "SVKS000814": "Tata commercial vehicles (common transmission-fastener application)",
    "SVKS000823": "Tata Cargo (rear brake lining; 410 x 180 mm, 4-piece riveted set)",
    "SVKS000864": "Tata / Ashok Leyland / Volvo Eicher commercial vehicles (24V stop-light switch)",
    "SVKS000865": "Tata commercial vehicles (make-level; pressure-reducing valve)",
    "SVKS000866": "Tata commercial vehicles (make-level; foot brake valve)",
    "SVKS000867": "Tata commercial vehicles (make-level; dual brake valve)",
    "SVKS000868": "Tata / MAN commercial vehicles (make-level; diaphragm)",
    "SVKS000869": "Tata / Ashok Leyland commercial vehicles (make-level; diaphragm)",
    "SVKS000870": "Tata commercial vehicles (make-level; relay-valve repair kit)",
    "SVKS000873": "Tata commercial vehicles (make-level; pressure-reduction valve)",
    "SVKS000908": "Tata 1510 TC / Tata 1109 BS III",
    "SVKS000939": "Tata commercial vehicles (make-level; drying and distribution unit)",
    "SVKS000987": "Tata diesel commercial vehicles meeting BS III / BS IV (oil-specification application)",
    "SVKS000988": "Tata diesel commercial vehicles meeting BS III / BS IV (oil-specification application)",
    "SVKS000989": "Tata diesel commercial vehicles meeting BS III / BS IV (oil-specification application)",
    "SVKS001008": "Tata vehicles (common fastener application; individual models not specified)",
    "SVKS001010": "Tata TC commercial-vehicle application (make-level)",
    "SVKS001018": "Tata / Ashok Leyland commercial vehicles (spring brake actuator)",
    "SVKS001019": "Tata commercial vehicles (make-level; relay valve)",
    "SVKS001022": "Tata commercial vehicles (make-level; protection valve)",
    "SVKS001144": "Tata / Ashok Leyland / Volvo Eicher / Bharat Benz / MAN commercial vehicles (make-level)",
    "SVKS001150": "Tata LPO 1618 (specific application)",
}

def clean(s):
    if s is None:
        return ""
    s = str(s).replace("\u00a0", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s

def fmt_money(v):
    if v is None or v == "":
        return "On request"
    try:
        return "INR {:,.2f}".format(float(v))
    except Exception:
        return "On request"

def is_tata_vehicle(v):
    return clean(v).lower().startswith("tata ")

def build_rows():
    with open(DATA, "r", encoding="utf-8") as f:
        products = json.load(f)
    rows = []
    seen = set()
    for p in products:
        if not p.get("active", False):
            continue
        pid = clean(p.get("id"))
        vehicles = [clean(v) for v in (p.get("vehicles") or []) if clean(v)]
        has_tata = any(is_tata_vehicle(v) for v in vehicles)
        override = APPLICATION_OVERRIDES.get(pid, "")
        if not has_tata and not override:
            continue
        if pid and pid in seen:
            continue
        seen.add(pid)

        # Do not expose generic buckets as if they were vehicle model names.
        public_vehicles = [v for v in vehicles if v.lower() not in {"universal", "tractors"}]
        apps = []
        for v in public_vehicles:
            if v not in apps:
                apps.append(v)
        # Combine family/model references from the current public application
        # mapping with the concise model/family note where a named one exists.
        if override:
            # Retain the supplier's exact family wording, but avoid duplicate
            # app phrases already covered by the structured vehicle list.
            if override not in apps:
                apps.append(override)
        app_text = "; ".join(apps) if apps else "Tata commercial-vehicle application; confirm model and variant"

        part_no = clean(p.get("part_number"))
        if not part_no:
            part_no = clean(p.get("manufacturer_part_number"))
        if not part_no:
            part_numbers = [clean(x) for x in (p.get("manufacturer_part_numbers") or []) if clean(x)]
            if part_numbers:
                part_no = " / ".join(part_numbers)
        if not part_no:
            part_no = "Reference not listed"

        name = clean(p.get("product_name") or p.get("name") or "Part name not listed")
        category = clean(p.get("category_name") or p.get("category") or "Other parts")
        rows.append({
            "id": pid,
            "part_number": part_no,
            "part_name": name,
            "applications": app_text,
            "mrp": fmt_money(p.get("mrp")),
            "out_price": fmt_money(p.get("selling_price")),
            "category": category,
            "raw_mrp": p.get("mrp"),
            "raw_out": p.get("selling_price"),
        })
    # Deterministic category and alphabetical ordering for reproducible editions.
    rows.sort(key=lambda r: (r["category"].casefold(), r["part_number"].casefold(), r["part_name"].casefold()))
    return rows

def make_transparent_logo(src, dst, alpha=46, color=(23,43,70)):
    from PIL import ImageOps
    im = Image.open(src).convert("RGB")
    # Repository logo art is rendered to a transparent, single-colour mark.
    # The inverse luminance becomes the logo alpha; the white canvas is removed.
    gray = ImageOps.grayscale(im)
    mask = gray.point(lambda p: int((255-p) * alpha / 255))
    rgba = Image.new("RGBA", im.size, color + (0,))
    rgba.putalpha(mask)
    bbox = rgba.getbbox()
    if bbox:
        rgba = rgba.crop(bbox)
    rgba.save(dst, "PNG")
    return dst

def build_styles():
    styles = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=27, leading=32, textColor=WHITE, alignment=TA_LEFT, spaceAfter=8),
        "sub": ParagraphStyle("CoverSub", parent=styles["Normal"], fontName="Helvetica", fontSize=11, leading=16, textColor=colors.HexColor("#DDE6EF"), alignment=TA_LEFT),
        "section": ParagraphStyle("Section", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=10, leading=13, textColor=WHITE, alignment=TA_LEFT),
        "cell": ParagraphStyle("Cell", parent=styles["Normal"], fontName="Helvetica", fontSize=7.1, leading=9.2, textColor=INK, alignment=TA_LEFT, wordWrap="CJK"),
        "cell_small": ParagraphStyle("CellSmall", parent=styles["Normal"], fontName="Helvetica", fontSize=6.8, leading=8.2, textColor=INK, alignment=TA_LEFT, wordWrap="CJK"),
        "part": ParagraphStyle("Part", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=7.2, leading=9, textColor=NAVY, alignment=TA_LEFT, wordWrap="CJK"),
        "money": ParagraphStyle("Money", parent=styles["Normal"], fontName="Helvetica", fontSize=7, leading=9, textColor=INK, alignment=TA_RIGHT),
        "tablehead": ParagraphStyle("TableHead", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=7.2, leading=8.5, textColor=WHITE, alignment=TA_LEFT),
        "category": ParagraphStyle("Category", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=10, leading=12, textColor=WHITE),
        "small": ParagraphStyle("Small", parent=styles["Normal"], fontName="Helvetica", fontSize=8.5, leading=12, textColor=MUTED),
        "contact": ParagraphStyle("Contact", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=16, leading=20, textColor=WHITE),
    }

def draw_white_page(canv, doc, watermark_path):
    canv.saveState()
    # Full-page transparent logo watermark, centered behind all table text.
    iw, ih = Image.open(watermark_path).size
    w = PAGE_W * 0.64
    h = w * ih / iw
    canv.drawImage(watermark_path, (PAGE_W-w)/2, (PAGE_H-h)/2, width=w, height=h, mask="auto")
    # Header
    canv.setFillColor(NAVY)
    canv.rect(0, PAGE_H-17*mm, PAGE_W, 17*mm, stroke=0, fill=1)
    canv.setFillColor(ORANGE)
    canv.rect(0, PAGE_H-18*mm, PAGE_W, 1.4*mm, stroke=0, fill=1)
    canv.setFillColor(WHITE)
    canv.setFont("Helvetica-Bold", 9)
    canv.drawString(13*mm, PAGE_H-10.5*mm, "SOUVIKS")
    canv.setFont("Helvetica", 7.5)
    canv.drawRightString(PAGE_W-13*mm, PAGE_H-10.5*mm, "TATA VEHICLE PARTS  |  CUSTOMER EDITION")
    # Footer
    canv.setStrokeColor(PALE2)
    canv.setLineWidth(0.6)
    canv.line(13*mm, 11*mm, PAGE_W-13*mm, 11*mm)
    canv.setFillColor(MUTED)
    canv.setFont("Helvetica", 6.5)
    canv.drawString(13*mm, 6.5*mm, "SOUVIKS  |  www.souviks.co.in  |  India")
    canv.drawRightString(PAGE_W-13*mm, 6.5*mm, f"Page {doc.page}")
    canv.restoreState()

def add_cover(story, rows, title, subtitle, styles):
    story.append(Spacer(1, 1))
    # Page callback paints the navy cover and draws the large transparent logo mark.
    story.append(Spacer(1, 72*mm))
    story.append(Paragraph(escape(title), styles["title"]))
    story.append(Paragraph(escape(subtitle), styles["sub"]))
    story.append(Spacer(1, 15*mm))
    priced = sum(1 for r in rows if r["raw_out"] is not None and r["raw_out"] != "")
    stats = [
        [Paragraph(f"<b>{len(rows):,}</b><br/><font size='8'>Tata-linked listings</font>", ParagraphStyle("s1",fontName="Helvetica",fontSize=21,leading=26,textColor=WHITE,alignment=TA_CENTER)),
         Paragraph(f"<b>{priced:,}</b><br/><font size='8'>With out price</font>", ParagraphStyle("s2",fontName="Helvetica",fontSize=21,leading=26,textColor=WHITE,alignment=TA_CENTER)),
         Paragraph(f"<b>{len(set(r['category'] for r in rows))}</b><br/><font size='8'>Product categories</font>", ParagraphStyle("s3",fontName="Helvetica",fontSize=21,leading=26,textColor=WHITE,alignment=TA_CENTER))]]
    t = Table(stats, colWidths=[PAGE_W/3-18*mm]*3, rowHeights=[24*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),NAVY2),("BOX",(0,0),(-1,-1),0.5,colors.HexColor("#47607C")),
        ("INNERGRID",(0,0),(-1,-1),0.5,colors.HexColor("#47607C")),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),("LEFTPADDING",(0,0),(-1,-1),6),("RIGHTPADDING",(0,0),(-1,-1),6),
    ]))
    story.append(t)
    story.append(Spacer(1, 13*mm))
    story.append(Paragraph("MRP and Out Price shown in INR. Product applications combine listed vehicle models and supported vehicle-family references. Please confirm the exact part number, variant and specification before ordering.", styles["sub"]))
    story.append(PageBreak())

def cover_page(canvas, doc, light_watermark):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0,0,PAGE_W,PAGE_H,stroke=0,fill=1)
    canvas.setFillColor(ORANGE)
    canvas.rect(0,0,7*mm,PAGE_H,stroke=0,fill=1)
    # Oversized transparent Souviks mark, behind the cover copy.
    iw, ih = Image.open(light_watermark).size
    w = PAGE_W*0.63; h = w*ih/iw
    canvas.drawImage(light_watermark,(PAGE_W-w)/2,(PAGE_H-h)/2,width=w,height=h,mask="auto")
    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica-Bold",13)
    canvas.drawString(19*mm,PAGE_H-27*mm,"SOUVIKS")
    canvas.setStrokeColor(colors.HexColor("#47607C"))
    canvas.setLineWidth(0.7)
    canvas.line(18*mm,PAGE_H-37*mm,PAGE_W-18*mm,PAGE_H-37*mm)
    canvas.setFillColor(ORANGE)
    canvas.setFont("Helvetica-Bold",8)
    canvas.drawString(19*mm,27*mm,"CUSTOMER EDITION  |  NOVEMBER 2026")
    canvas.setFillColor(colors.HexColor("#DDE6EF"))
    canvas.setFont("Helvetica",7)
    canvas.drawRightString(PAGE_W-17*mm,27*mm,"SOUVIKS.CO.IN")
    canvas.restoreState()

def back_page(canvas, doc, white_logo):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0,0,PAGE_W,PAGE_H,stroke=0,fill=1)
    canvas.setFillColor(ORANGE)
    canvas.rect(0,0,7*mm,PAGE_H,stroke=0,fill=1)
    iw, ih = Image.open(white_logo).size
    w=PAGE_W*0.68; h=w*ih/iw
    canvas.drawImage(white_logo,(PAGE_W-w)/2,(PAGE_H-h)/2,width=w,height=h,mask="auto",preserveAspectRatio=True)
    canvas.setStrokeColor(colors.HexColor("#47607C"))
    canvas.line(18*mm,37*mm,PAGE_W-18*mm,37*mm)
    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica-Bold",10)
    canvas.drawString(20*mm,27*mm,"SOUVIKS  |  Andal More, Andal, West Bengal, India")
    canvas.setFont("Helvetica",8)
    canvas.drawString(20*mm,18*mm,"+91 94343 31896  |  +91 79082 15701  |  info@souviks.co.in")
    canvas.setFillColor(ORANGE)
    canvas.drawRightString(PAGE_W-18*mm,18*mm,"www.souviks.co.in")
    canvas.restoreState()

def row_cells(r, styles, compact=False):
    cs = styles["cell_small"] if compact else styles["cell"]
    return [
        Paragraph(escape(r["part_number"]), styles["part"]),
        Paragraph(escape(r["part_name"]), styles["cell"]),
        Paragraph(escape(r["applications"]), cs),
        Paragraph(escape(r["mrp"]), styles["money"]),
        Paragraph(escape(r["out_price"]), styles["money"]),
    ]

def make_table(rows, styles, compact=False, with_category=False):
    headers = ["PART NUMBER", "PART NAME", "APPLICATIONS", "MRP (INR)", "OUT PRICE (INR)"]
    data = [[Paragraph(h, styles["tablehead"]) for h in headers]]
    data.extend(row_cells(r, styles, compact=compact) for r in rows)
    widths = [32*mm, 55*mm, 110*mm, 37*mm, 37*mm]
    t = LongTable(data, colWidths=widths, repeatRows=1, hAlign="LEFT", splitByRow=1)
    font = 6.8 if compact else 7.1
    pad = 3 if compact else 4
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0),NAVY2),
        ("TEXTCOLOR",(0,0),(-1,0),WHITE),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("LINEBELOW",(0,1),(-1,-1),0.35,colors.HexColor("#D7DEE6")),
        ("LINEAFTER",(0,0),(-1,-1),0.25,colors.HexColor("#D7DEE6")),
        ("LEFTPADDING",(0,0),(-1,-1),pad),
        ("RIGHTPADDING",(0,0),(-1,-1),pad),
        ("TOPPADDING",(0,0),(-1,-1),4 if compact else 5),
        ("BOTTOMPADDING",(0,0),(-1,-1),4 if compact else 5),
    ]))
    return t

def build_catalogue(rows, styles, wm, white_logo, path):
    story=[]
    add_cover(story, rows, "TATA VEHICLE PARTS CATALOGUE", "Commercial vehicle components, parts references and applications", styles)
    grouped=defaultdict(list)
    for r in rows: grouped[r["category"]].append(r)
    for cat in sorted(grouped, key=str.casefold):
        header = Table([[Paragraph(escape(cat.upper()), styles["category"]), "","","",""]],
                       colWidths=[32*mm,55*mm,110*mm,37*mm,37*mm], rowHeights=[9*mm])
        header.setStyle(TableStyle([
            ("SPAN",(0,0),(-1,-1)),("BACKGROUND",(0,0),(-1,-1),NAVY),
            ("LEFTPADDING",(0,0),(-1,-1),7),("VALIGN",(0,0),(-1,-1),"MIDDLE"),
            ("LINEBELOW",(0,0),(-1,-1),1.2,ORANGE)
        ]))
        story.append(header)
        story.append(make_table(grouped[cat], styles, compact=False))
        story.append(Spacer(1,5*mm))
    doc=SimpleDocTemplate(path,pagesize=landscape(A4),rightMargin=13*mm,leftMargin=13*mm,topMargin=22*mm,bottomMargin=16*mm,
                          title="Souviks Tata Vehicle Parts Catalogue",author="Souviks")
    doc.build(story,onFirstPage=lambda c,d: cover_page(c,d,white_logo),onLaterPages=lambda c,d: draw_white_page(c,d,wm))

def build_price_list(rows, styles, wm, white_logo, path):
    story=[]
    # Keep price list cover customer-ready; no export language or internal instructions.
    add_cover(story, rows, "TATA PARTS PRICE LIST", "Customer price list | MRP and Out Price in INR", styles)
    # A compact, part-number-first lookup list; same five requested columns.
    sorted_rows=sorted(rows,key=lambda r:(r["part_number"].casefold(),r["part_name"].casefold()))
    story.append(make_table(sorted_rows, styles, compact=True))
    doc=SimpleDocTemplate(path,pagesize=landscape(A4),rightMargin=13*mm,leftMargin=13*mm,topMargin=22*mm,bottomMargin=16*mm,
                          title="Souviks Tata Vehicle Parts Price List",author="Souviks")
    doc.build(story,onFirstPage=lambda c,d: cover_page(c,d,white_logo),onLaterPages=lambda c,d: draw_white_page(c,d,wm))

def main():
    rows=build_rows()
    if not rows:
        raise RuntimeError("No Tata-associated active products were found.")
    wm=make_transparent_logo(LOGO_DARK,"/tmp/souviks-watermark-dark.png",alpha=46,color=(23,43,70))
    light_wm=make_transparent_logo(LOGO_DARK,"/tmp/souviks-watermark-light.png",alpha=28,color=(255,255,255))
    cat=os.path.join(OUT,"Souviks_Tata_Customer_Catalogue.pdf")
    price=os.path.join(OUT,"Souviks_Tata_Customer_Price_List.pdf")
    styles=build_styles()
    build_catalogue(rows,styles,wm,light_wm,cat)
    build_price_list(rows,styles,wm,light_wm,price)
    report={
        "product_count":len(rows),
        "priced_count":sum(1 for r in rows if r["raw_out"] is not None and r["raw_out"]!=""),
        "price_on_request_count":sum(1 for r in rows if r["raw_out"] is None or r["raw_out"]==""),
        "category_count":len(set(r["category"] for r in rows)),
        "missing_part_number_count":sum(1 for r in rows if r["part_number"]=="Reference not listed"),
        "application_override_count":sum(1 for r in rows if r["id"] in APPLICATION_OVERRIDES),
        "catalogue_pdf":os.path.basename(cat),
        "price_list_pdf":os.path.basename(price),
        "source_data":"assets/data/products.json",
        "price_snapshot":"2026-11-08",
        "columns":["Part Number","Part Name","Applications","MRP (INR)","Out Price (INR)"],
        "export_column":False,
        "internal_ai_instructions_included":False,
        "watermark_every_page":True
    }
    with open(os.path.join(OUT,"validation.json"),"w",encoding="utf-8") as f:
        json.dump(report,f,indent=2)
    print(json.dumps(report,indent=2))

if __name__=="__main__":
    main()
