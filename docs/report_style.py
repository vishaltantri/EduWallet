#!/usr/bin/env python3
"""Shared formatting for the EduWallet report, matching the department template."""

from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.shared import Cm, Inches, Pt, RGBColor

BODY_FONT = "Times New Roman"
BODY_SIZE = Pt(12)

MAROON = RGBColor(0x42, 0x0C, 0x1C)
DEEP = RGBColor(0x2A, 0x07, 0x10)
TEAL = "2EC4B6"
HEADER_FILL = "420C1C"
BAND_FILL = "FFF7EF"


def configure(doc):
    """A4 page, 1 inch margins, Times New Roman body, maroon headings."""
    for section in doc.sections:
        section.page_width = Cm(21.0)
        section.page_height = Cm(29.7)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(0.9)

    normal = doc.styles["Normal"]
    normal.font.name = BODY_FONT
    normal.font.size = BODY_SIZE
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), BODY_FONT)
    normal.paragraph_format.space_after = Pt(6)

    for name, size, colour, before, after in [
        ("Heading 1", 17, MAROON, 14, 8),
        ("Heading 2", 14, MAROON, 12, 5),
        ("Heading 3", 12.5, DEEP, 9, 4),
    ]:
        style = doc.styles[name]
        style.font.name = BODY_FONT
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = colour
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True


def shade(cell, colour):
    shading = OxmlElement("w:shd")
    shading.set(qn("w:val"), "clear")
    shading.set(qn("w:fill"), colour)
    cell._tc.get_or_add_tcPr().append(shading)


def rule(paragraph, colour=TEAL):
    """The teal accent rule used under title-page lines."""
    borders = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "12")
    bottom.set(qn("w:space"), "6")
    bottom.set(qn("w:color"), colour)
    borders.append(bottom)
    paragraph._p.get_or_add_pPr().append(borders)


def no_borders(table):
    """Strip every border, so a layout table is invisible."""
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        element = OxmlElement(f"w:{edge}")
        element.set(qn("w:val"), "none")
        element.set(qn("w:sz"), "0")
        borders.append(element)
    table._tbl.tblPr.append(borders)


def centred(doc, text, size=12, bold=False, after=6, colour=None):
    paragraph = doc.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph.paragraph_format.space_after = Pt(after)
    run = paragraph.add_run(text)
    run.font.size = Pt(size)
    run.bold = bold
    if colour is not None:
        run.font.color.rgb = colour
    return paragraph


def body(doc, text):
    paragraph = doc.add_paragraph(text)
    paragraph.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    return paragraph


def bullets(doc, items):
    for item in items:
        doc.add_paragraph(str(item), style="List Bullet")


def steps(doc, items):
    """Numbered instructions for the demonstration chapter."""
    for item in items:
        paragraph = doc.add_paragraph(str(item), style="List Number")
        paragraph.paragraph_format.space_after = Pt(4)


def code(doc, text):
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.left_indent = Inches(0.3)
    paragraph.paragraph_format.space_after = Pt(10)
    run = paragraph.add_run(text)
    run.font.name = "Consolas"
    run.font.size = Pt(9.5)
    return paragraph


def page_break(doc):
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
