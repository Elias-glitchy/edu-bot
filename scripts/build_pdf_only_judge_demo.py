from pathlib import Path
from shutil import rmtree
from zipfile import ZIP_DEFLATED, ZipFile

from reportlab.lib import colors
from reportlab import rl_config
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ROOT = Path(__file__).resolve().parents[1]
TEMP = ROOT / "tmp" / "pdfs" / "melsoft_judge_demo"
OUTPUT = ROOT / "artifacts" / "EDU_BOT_MELSOFT_JUDGES_LIVE_DEMO_TEACHER_SCENARIO.zip"
CHARCOAL = colors.HexColor("#111318")
PANEL = colors.HexColor("#1C2028")
GOLD = colors.HexColor("#F2AA2B")
WHITE = colors.HexColor("#F7F7F8")
MUTED = colors.HexColor("#B7BDC8")
rl_config.useA85 = 0

STUDENTS = [
    ("STU-001", "Amina Jacobs", "Digital citizenship means making responsible choices online. I use a strong password and privacy settings. I respect classmates, ask consent before sharing a photo, and check an official source and its date before repeating information."),
    ("STU-002", "Kabelo Mokoena", "Responsible digital citizenship protects people and information. My example uses a different password for every account, multi-factor authentication, privacy permissions and phishing checks. Respectful communication requires consent before posting a classmate photo and reporting harassment. I verify a claim by comparing an official source, evidence and publication date."),
    ("STU-003", "Lerato Ndlovu", "Online safety is important. People should use passwords, keep information private and be kind. Before sharing a headline I check the source. This helps students use the internet responsibly."),
    ("STU-004", "Thabo Naidoo", "Digital citizenship combines security, respect and critical thinking. For account security I use a password manager, multi-factor authentication, privacy settings and limited app permissions. I ask consent before sharing photos, communicate kindly and report bullying. I verify information against an official source, author, evidence and date before sharing it."),
    ("STU-005", "Naledi Khumalo", "A responsible learner protects privacy and treats classmates with respect. I secure each account with a strong password and authentication. I ask for consent before sharing a photo. I check dates and compare evidence with an official source so that false information is not repeated."),
    ("STU-006", "Yusuf Daniels", "Online safety requires responsible decisions. My example checks account permissions, uses multi-factor authentication and recognises phishing. Respect and consent guide communication with every classmate. I verify the source, date and supporting evidence before trusting information, then explain why the official source is more reliable."),
]

RUBRIC = [
    ("thesis", "Understanding of digital citizenship", 20),
    ("privacy", "Privacy and account security", 20),
    ("respect", "Respectful online participation", 20),
    ("critical", "Source verification and critical thinking", 20),
    ("structure", "Structure, evidence and examples", 20),
]

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="Brand", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=GOLD, spaceAfter=8))
styles.add(ParagraphStyle(name="TitleWhite", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=24, leading=28, textColor=WHITE, spaceAfter=8))
styles.add(ParagraphStyle(name="SubtitleMuted", parent=styles["Normal"], fontSize=10, leading=15, textColor=MUTED, spaceAfter=14))
styles.add(ParagraphStyle(name="HeadingGold", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=17, textColor=GOLD, spaceBefore=6, spaceAfter=7))
styles.add(ParagraphStyle(name="BodyWhite", parent=styles["BodyText"], fontSize=10, leading=16, textColor=WHITE, spaceAfter=8))
styles.add(ParagraphStyle(name="Meta", parent=styles["Normal"], fontSize=9, leading=13, textColor=MUTED, spaceAfter=4))
styles.add(ParagraphStyle(name="CenterSmall", parent=styles["Normal"], alignment=TA_CENTER, fontSize=8, textColor=MUTED))


def page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(CHARCOAL)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(1)
    canvas.line(18 * mm, A4[1] - 18 * mm, A4[0] - 18 * mm, A4[1] - 18 * mm)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(18 * mm, 12 * mm, "FICTIONAL HACKATHON DATA - EDUCATOR REVIEW REQUIRED")
    canvas.setFillColor(GOLD)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawRightString(A4[0] - 18 * mm, 12 * mm, f"{doc.page}")
    canvas.restoreState()


def build_pdf(path, title, subtitle, story):
    doc = SimpleDocTemplate(str(path), pagesize=A4, rightMargin=20 * mm, leftMargin=20 * mm, topMargin=25 * mm, bottomMargin=20 * mm, title=title, author="EDU BOT", pageCompression=0)
    content = [Paragraph("EDU BOT | MELSOFT ACADEMY HACKATHON", styles["Brand"]), Paragraph(title, styles["TitleWhite"]), Paragraph(subtitle, styles["SubtitleMuted"]), *story]
    doc.build(content, onFirstPage=page, onLaterPages=page)


def cell(text, bold=False, color=WHITE):
    return Paragraph(str(text), ParagraphStyle(name=f"Cell{bold}{color}", parent=styles["BodyWhite"], fontName="Helvetica-Bold" if bold else "Helvetica", fontSize=8.5, leading=11, textColor=color, spaceAfter=0))


def main():
    if TEMP.exists():
        rmtree(TEMP)
    TEMP.mkdir(parents=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    roster_path = TEMP / "01_fictional_class_roster.pdf"
    roster_data = [[cell("Student ID", True, GOLD), cell("Student name", True, GOLD), cell("Course", True, GOLD), cell("Assignment", True, GOLD)]]
    roster_data += [[cell(student_id), cell(name), cell("DIG-101"), cell("PRACTICAL-01")] for student_id, name, _ in STUDENTS]
    roster_table = Table(roster_data, colWidths=[28 * mm, 58 * mm, 28 * mm, 38 * mm], repeatRows=1)
    roster_table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), PANEL), ("BACKGROUND", (0, 1), (-1, -1), CHARCOAL), ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#3A404B")), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    build_pdf(roster_path, "Fictional Class Roster", "DIG-101 Digital Citizenship | Practical 01 | Six fictional learners", [Paragraph("Teacher scenario", styles["HeadingGold"]), Paragraph("Ms Lerato Maseko must assess six submissions consistently, preserve evidence and remain the final decision-maker before any academic record changes.", styles["BodyWhite"]), Spacer(1, 5 * mm), roster_table])

    rubric_path = TEMP / "02_digital_citizenship_100_point_rubric.pdf"
    rubric_data = [[cell("Rubric key", True, GOLD), cell("Criterion", True, GOLD), cell("Maximum", True, GOLD)]] + [[cell(key), cell(title), cell(points)] for key, title, points in RUBRIC]
    rubric_data.append([cell("TOTAL", True, GOLD), cell("Maximum points", True, GOLD), cell("100", True, GOLD)])
    rubric_table = Table(rubric_data, colWidths=[30 * mm, 102 * mm, 28 * mm], repeatRows=1)
    rubric_table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), PANEL), ("BACKGROUND", (0, 1), (-1, -1), CHARCOAL), ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#3A404B")), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]))
    machine_reference = "; ".join(f"{key}={points}" for key, _, points in RUBRIC)
    build_pdf(rubric_path, "Digital Citizenship Practical Rubric", "Rubric ID: DIGCIT-100 | Maximum points: 100", [Paragraph("Assessment standard", styles["HeadingGold"]), Paragraph("Apply each criterion to evidence found in the learner submission. Feedback remains a draft until a qualified educator reviews it.", styles["BodyWhite"]), Spacer(1, 4 * mm), rubric_table, Spacer(1, 6 * mm), Paragraph(f"Rubric keys: {machine_reference}", styles["Meta"])])

    submission_paths = []
    for index, (student_id, name, submission) in enumerate(STUDENTS, start=3):
        filename = f"{index:02d}_submission_{student_id.lower().replace('-', '_')}_{name.lower().replace(' ', '_')}.pdf"
        path = TEMP / filename
        build_pdf(path, "Student Practical Submission", "DIG-101 Digital Citizenship | Practical 01", [Paragraph(f"Student ID: {student_id}", styles["HeadingGold"]), Paragraph(f"Student name: {name}", styles["Meta"]), Spacer(1, 5 * mm), Paragraph("Submission:", styles["HeadingGold"]), Paragraph(submission, styles["BodyWhite"]), Spacer(1, 12 * mm), Paragraph("This submission is fictional and exists only for the EDU BOT hackathon demonstration.", styles["Meta"])])
        submission_paths.append(path)

    pdfs = [roster_path, rubric_path, *submission_paths]
    with ZipFile(OUTPUT, "w", ZIP_DEFLATED) as archive:
        for pdf in pdfs:
            archive.write(pdf, pdf.name)
    print(f"{OUTPUT}\n{OUTPUT.stat().st_size} bytes\n{len(pdfs)} PDF files")


if __name__ == "__main__":
    main()
