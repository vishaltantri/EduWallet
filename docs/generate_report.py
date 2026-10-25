#!/usr/bin/env python3
"""
Generate the EduWallet final project report.

    .venv/bin/python docs/generate_report.py

Figures come from docs/screenshots/, captured from a running instance that is
connected to a live chain, so the report shows the real application.
"""

from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor

from report_style import (
    BAND_FILL, HEADER_FILL, MAROON,
    body, bullets, centred, code, configure, page_break, rule, shade, steps,
)

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "docs" / "screenshots"
OUT = ROOT / "EduWallet_Final_Project_Report.docx"

state = {"figure": 0, "table": 0}


def add_table(doc, caption, headers, rows, widths=None):
    state["table"] += 1
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER

    for i, header in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = str(header)
        for paragraph in cell.paragraphs:
            paragraph.paragraph_format.space_after = Pt(2)
            for run in paragraph.runs:
                run.bold = True
                run.font.size = Pt(10)
                run.font.color.rgb = RGBColor(255, 255, 255)
        shade(cell, HEADER_FILL)

    for r, row in enumerate(rows):
        for c, value in enumerate(row):
            cell = table.rows[r + 1].cells[c]
            cell.text = str(value)
            for paragraph in cell.paragraphs:
                paragraph.paragraph_format.space_after = Pt(2)
                for run in paragraph.runs:
                    run.font.size = Pt(10)
            if r % 2 == 0:
                shade(cell, BAND_FILL)

    if widths:
        for row in table.rows:
            for i, width in enumerate(widths):
                row.cells[i].width = Inches(width)

    centred(doc, f"Table {state['table']}: {caption}", size=9.5, after=12).runs[0].italic = True
    return table


def figure(doc, filename, caption, width=5.6):
    path = SHOTS / filename
    if not path.exists():
        print(f"  ! missing figure: {filename}")
        return
    state["figure"] += 1
    paragraph = doc.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph.paragraph_format.space_after = Pt(4)
    paragraph.add_run().add_picture(str(path), width=Inches(width))
    centred(doc, f"Figure {state['figure']}: {caption}", size=9.5, after=14).runs[0].italic = True


def h1(doc, text):
    page_break(doc)
    doc.add_heading(text, level=1)


def build():
    doc = Document()
    configure(doc)

    # ─────────────── Title page ───────────────
    for _ in range(3):
        doc.add_paragraph()

    centred(doc, "EduWallet", size=34, bold=True, after=6, colour=MAROON)
    rule(centred(doc, "", size=4, after=14))
    centred(
        doc,
        "Tamper-Proof Academic Certificates on Blockchain,",
        size=15, after=2,
    )
    centred(
        doc,
        "with Institutional Recovery for Lost Wallets",
        size=15, after=26,
    )
    centred(doc, "Final Project Report", size=13.5, bold=True, after=40)

    for label in [
        "Submitted by", "Roll number", "Programme",
        "Department", "Institution", "Supervisor",
    ]:
        centred(doc, f"{label}:  ______________________________", size=12, after=12)

    centred(doc, date.today().strftime("%d %B %Y"), size=12, after=0)

    # ─────────────── Contents ───────────────
    h1(doc, "Contents")
    for line in [
        "1.  Abstract",
        "2.  The Problem",
        "3.  What EduWallet Is",
        "4.  Existing Solutions and the Gaps They Leave",
        "5.  How EduWallet Works",
        "6.  Step-by-Step Demonstration",
        "7.  Testing and Results",
        "8.  Security Analysis",
        "9.  Limitations",
        "10. Conclusion and Future Work",
        "11. References",
    ]:
        paragraph = doc.add_paragraph(line)
        paragraph.paragraph_format.space_after = Pt(4)

    # ═══════════ 1. Abstract ═══════════
    h1(doc, "1. Abstract")
    body(
        doc,
        "A printed degree certificate is easy to fake and slow to check. An employer who "
        "wants to confirm it has to email the university and wait, sometimes for weeks. "
        "Putting the certificate in a university database makes checking faster, but the "
        "employer now has to trust whoever runs that database.",
    )
    body(
        doc,
        "EduWallet removes that need for trust. When a university issues a certificate, the "
        "system takes all the facts on it, reduces them to a single fingerprint, and the "
        "university's digital key signs that fingerprint. Anyone checking the certificate can "
        "work backwards from the signature to find out which key signed it. If even one "
        "character of the certificate is changed afterwards, the fingerprint no longer "
        "matches and the check fails.",
    )
    body(
        doc,
        "The certificate is also recorded on the Polygon blockchain as a token that can never "
        "be transferred or sold, so a qualification cannot be bought from someone who earned "
        "it. Importantly, the signature check works even when the blockchain cannot be "
        "reached, so verification never depends on the network being available.",
    )
    body(
        doc,
        "The system also solves the problem that has stopped similar projects being used in "
        "practice: what happens when a student loses access to their account. Instead of "
        "asking students to safeguard a secret key, EduWallet lets them nominate universities "
        "as guardians. If a student loses access, those guardians can move the account to a "
        "new address, but only if enough of them agree and only after a 24-hour delay during "
        "which the student alone can cancel it.",
    )
    body(
        doc,
        "The finished system was checked with 77 smart contract tests, 179 application tests "
        "and a 20-step end-to-end test run against a live blockchain. All of them pass.",
    )

    # ═══════════ 2. The Problem ═══════════
    h1(doc, "2. The Problem")

    doc.add_heading("2.1 How certificates are checked today", level=2)
    body(
        doc,
        "A paper certificate contains nothing that lets an outsider check it. There is no way "
        "for an employer to confirm that the named university actually issued it, that nobody "
        "has altered it since, or that it has not been withdrawn. The only option is to "
        "contact the university and ask.",
    )
    body(
        doc,
        "That takes days. It depends on the university still existing and still holding good "
        "records. Meanwhile, modern printing makes a convincing fake cheap to produce. Recent "
        "work on this subject points to forged engineering degrees and fake diplomas as a "
        "live and growing problem [1].",
    )

    doc.add_heading("2.2 Why a database does not fix it", level=2)
    body(
        doc,
        "The obvious answer is to put certificates in an online database that employers can "
        "search. This makes checking fast, but it moves the trust rather than removing it. "
        "The employer now has to believe that the database operator is honest, has not been "
        "hacked, and has not quietly changed a record. If the operator shuts down, every "
        "certificate in it becomes uncheckable.",
    )

    doc.add_heading("2.3 Why blockchain projects have not caught on", level=2)
    body(
        doc,
        "Blockchain has been proposed as the answer for years, and many systems have been "
        "built. A 2025 systematic review of blockchain work in higher education found that "
        "despite a decade of proposals, adoption remains limited and the same obstacles keep "
        "appearing [1]. A 2025 study of decentralised identity projects in the real world "
        "reached a similar conclusion: the barriers are not technical but practical, to do "
        "with how systems are deployed and used [6].",
    )
    body(
        doc,
        "One obstacle stands out. Blockchain systems normally ask the holder to look after a "
        "private key. If the key is lost, the account is gone forever. A 2023 survey of "
        "recovery methods in this field describes the tension clearly: designers have to "
        "trade off ease of use, security, and the ability to get back in [4]. For a student "
        "holding their degree, losing the key means losing access to their own academic "
        "record, which is not an acceptable outcome.",
    )

    doc.add_heading("2.4 What this project set out to do", level=2)
    steps(
        doc,
        [
            "Make a certificate that anyone can check without trusting the website serving it.",
            "Make that check work even when the blockchain is unreachable.",
            "Stop a certificate being sold or transferred to someone who did not earn it.",
            "Take key management away from students without locking them in.",
            "Give students a safe way back in if they lose access.",
            "Be honest in the interface when part of the system is unavailable.",
        ],
    )

    # ═══════════ 3. What EduWallet Is ═══════════
    h1(doc, "3. What EduWallet Is")

    doc.add_heading("3.1 In plain terms", level=2)
    body(
        doc,
        "EduWallet is a web application with three kinds of user. A university issues "
        "certificates. A student collects them and shares them. An employer checks them, "
        "without creating an account.",
    )
    body(
        doc,
        "Behind the scenes, every certificate gets a digital signature from the university "
        "that issued it, and a copy is recorded on a blockchain. The student never sees a key "
        "or a seed phrase unless they ask for one.",
    )

    doc.add_heading("3.2 The two guarantees", level=2)
    body(
        doc,
        "Every certificate carries two things that an employer can check for themselves.",
    )
    add_table(
        doc,
        "The two guarantees on every certificate",
        ["Guarantee", "What it means", "What it stops"],
        [
            [
                "A fingerprint of the contents",
                "All the facts on the certificate are combined, in a fixed order, into one short code. Changing anything changes the code.",
                "Someone editing a grade, a name or a date after the certificate was issued",
            ],
            [
                "A signature from the university",
                "The university's key signs that code. A checker can work out which key signed it.",
                "Anyone, including the people running EduWallet, inventing a certificate",
            ],
        ],
        widths=[1.5, 2.6, 2.1],
    )
    body(
        doc,
        "Both of these work offline. The blockchain adds a third, independent record, but the "
        "certificate is still provable without it.",
    )

    doc.add_heading("3.3 Who uses it", level=2)
    add_table(
        doc,
        "The three kinds of user",
        ["User", "Needs an account?", "What they do"],
        [
            ["University staff", "Yes", "Issue certificates, singly or a whole year group at once; withdraw mistakes; see who is checking"],
            ["Student or graduate", "Yes", "Keep certificates, share them with employers, control who sees their name"],
            ["Employer or verifier", "No", "Check one certificate, once, in under a minute"],
        ],
        widths=[1.5, 1.3, 3.4],
    )

    # ═══════════ 4. Existing solutions ═══════════
    h1(doc, "4. Existing Solutions and the Gaps They Leave")

    doc.add_heading("4.1 What has been tried before", level=2)
    body(
        doc,
        "Several approaches exist, each better than paper in some way and lacking in another.",
    )
    add_table(
        doc,
        "Comparison of approaches to certificate checking",
        ["Approach", "How it is checked", "Who you must trust", "Main weakness"],
        [
            ["Paper certificate", "Phone or email the university", "The university's records office", "Easy to forge; takes days"],
            ["University database", "Search an online portal", "Whoever runs the portal", "Records can be changed or lost; dies with the operator"],
            ["Signed PDF", "Open it in a reader", "A certificate authority", "No way to show it was later withdrawn"],
            ["Certificate hash on a blockchain", "Compare a hash on the chain", "The blockchain being reachable", "Fails when the network is down; proves a file existed, not who issued it"],
            ["EduWallet", "Check the signature, the fingerprint and the chain", "Only the university's key", "The university must look after its key"],
        ],
        widths=[1.4, 1.6, 1.5, 1.7],
    )
    body(
        doc,
        "Real systems of this kind have been built and published. ShikkhaChain, for example, "
        "is a 2025 system for Bangladesh that issues, verifies and revokes certificates using "
        "smart contracts and distributed file storage [3]. Work of this kind shows that the "
        "basic idea is sound and deployable.",
    )

    doc.add_heading("4.2 What the research says is still missing", level=2)
    body(
        doc,
        "A 2026 study of blockchain credential systems sets out three gaps that most existing "
        "work leaves open. It states that such systems tend to record certificate fingerprints "
        "without tying them to a checkable identity, without any way to establish that the "
        "issuing institution is genuine, and without a way to correct or withdraw a "
        "certificate once it has been issued [2].",
    )
    body(
        doc,
        "Two further gaps come from the wider literature. Surveys of decentralised identity "
        "note that the standards are mature but real deployments are rare, largely because of "
        "practical problems rather than technical ones [5][6]. And the recovery survey makes "
        "the point that losing a key is a normal event that these systems have to plan "
        "for [4].",
    )

    doc.add_heading("4.3 How EduWallet addresses each gap", level=2)
    add_table(
        doc,
        "Gaps identified in the literature and how this project addresses them",
        ["Gap", "Source", "How EduWallet addresses it"],
        [
            [
                "Fingerprints are stored without being tied to a checkable identity",
                "[2]",
                "The student's wallet address is part of the signed fingerprint, and the certificate is minted as a token that is permanently bound to that address",
            ],
            [
                "No way to withdraw or correct a certificate after issue",
                "[2]",
                "A university can withdraw a certificate with a written reason, which appears immediately on every link already shared, on the chain as well as off it",
            ],
            [
                "No way to establish that the issuing institution is genuine",
                "[2]",
                "Partly addressed. A university must be authorised on the contract before it can issue, so not just anyone can mint. Deciding which universities deserve that authorisation is left as future work",
            ],
            [
                "Losing a key means losing the account permanently",
                "[4]",
                "Universities act as guardians and can move an account to a new address, subject to an agreement threshold and a delay the student can cancel within",
            ],
            [
                "Verification stops working when the network is unavailable",
                "[1][6]",
                "The signature and fingerprint checks run entirely offline. The blockchain is an extra record, not the proof",
            ],
            [
                "Systems look reliable while quietly running in a degraded state",
                "[6]",
                "The interface reports what is actually available, including when nothing is being recorded on the chain",
            ],
        ],
        widths=[1.9, 0.6, 3.7],
    )

    # ═══════════ 5. How it works ═══════════
    h1(doc, "5. How EduWallet Works")

    doc.add_heading("5.1 Issuing a certificate", level=2)
    body(
        doc,
        "When a university fills in the issuing form and presses the button, five things "
        "happen in order.",
    )
    steps(
        doc,
        [
            "The student's account is found and checked.",
            "The certificate details are stored on IPFS, a distributed file system. If that is unavailable, the details are kept locally instead and the certificate says so.",
            "The certificate is given a number. The numbering cannot produce duplicates even if two certificates are issued at the same instant.",
            "The fingerprint is calculated and the university's key signs it. This is the step that makes the certificate real.",
            "The certificate is recorded on the blockchain.",
        ],
    )
    body(
        doc,
        "Only the fourth step has to succeed. If file storage or the blockchain is "
        "unavailable, the certificate is still issued, still signed and still checkable, and "
        "the interface says which parts did not complete rather than hiding it.",
    )

    doc.add_heading("5.2 Checking a certificate", level=2)
    body(
        doc,
        "Checking answers three separate questions, and shows each answer on its own rather "
        "than merging them into a single tick.",
    )
    add_table(
        doc,
        "The three checks and what each one proves",
        ["Check", "Question it answers", "How it is done"],
        [
            ["Signature", "Did this university really issue it?", "The signing key is worked out from the signature and compared with the university's published address"],
            ["Contents", "Has anything been changed since?", "The fingerprint is recalculated from the stored certificate and compared with the one that was signed"],
            ["Status", "Has it since been withdrawn?", "The withdrawal record is read, along with the reason given"],
        ],
        widths=[1.1, 1.9, 3.2],
    )
    body(
        doc,
        "The result is one of four answers. Valid means genuine and in force. Withdrawn means "
        "genuinely issued but since cancelled, with the reason shown; the signature still "
        "passes, because the document really was issued. Tampered means the contents no "
        "longer match the signature, which is the most serious answer and takes priority over "
        "everything else. Not found usually means the link was cut short when it was pasted.",
    )

    doc.add_heading("5.3 Why a certificate cannot be sold", level=2)
    body(
        doc,
        "The certificate is recorded as a token that follows the soulbound standard, meaning "
        "it is permanently attached to the person it was issued to. Every method that would "
        "move it to another account is blocked at the contract level, including the methods "
        "that marketplaces use to list items for sale. The token can only be created and, if "
        "necessary, marked as withdrawn. It can never change hands.",
    )

    doc.add_heading("5.4 Getting back in after losing access", level=2)
    body(
        doc,
        "This is the part that most similar systems leave unsolved. A student chooses between "
        "two and five universities as guardians, and decides how many of them must agree "
        "before the account can be moved.",
    )
    add_table(
        doc,
        "The recovery process",
        ["Step", "Who does it", "What happens"],
        [
            ["1", "The student, in advance", "Chooses guardians and sets how many must agree"],
            ["2", "A guardian", "Starts a request naming the student's new address. This counts as the first agreement"],
            ["3", "Other guardians", "Agree, until the required number is reached"],
            ["4", "Nobody", "A 24-hour wait begins"],
            ["5", "The student, if they wish", "Cancels. Only the student can do this"],
            ["6", "A guardian or the student", "Completes the move, once the agreements and the wait are both satisfied"],
        ],
        widths=[0.5, 1.6, 4.1],
    )
    body(
        doc,
        "The 24-hour wait is the safeguard. For its whole duration the request is visible to "
        "the student with a cancel button, and only the student can use it. That is what "
        "stops guardians working together to take an account. A request that nobody completes "
        "expires after seven days.",
    )
    body(
        doc,
        "When the move completes, the account keeps a record of its old address. This matters: "
        "the signature on an existing certificate covers the address it was issued to, so that "
        "address cannot be rewritten. Instead, the system looks up certificates under every "
        "address the account has ever held, so nothing is lost and old links keep working.",
    )

    doc.add_heading("5.5 What is stored where", level=2)
    add_table(
        doc,
        "Division between the blockchain and the application database",
        ["On the blockchain", "In the application database"],
        [
            ["Who owns which certificate", "Names, email addresses and account details"],
            ["Which universities may issue", "Searching, filtering and statistics"],
            ["Whether a certificate is withdrawn", "Share links and their expiry dates"],
            ["Guardian lists and recovery requests", "The record of who checked what, and when"],
        ],
        widths=[3.1, 3.1],
    )
    body(
        doc,
        "The rule followed throughout is that a database entry is never treated as proof that "
        "something happened on the blockchain. The system waits for confirmation and reads the "
        "contract back before reporting a certificate as recorded.",
    )

    # ═══════════ 6. Demonstration ═══════════
    h1(doc, "6. Step-by-Step Demonstration")
    body(
        doc,
        "This chapter walks through the whole system in the order a new user would meet it. "
        "Every image is the working application with a live blockchain connected. The "
        "certificates are genuinely signed and the transaction references are real.",
    )

    doc.add_heading("6.1 Before you start", level=2)
    body(doc, "Start the blockchain, put the contracts on it, and start the application.")
    code(
        doc,
        "npm run contracts:compile\n"
        "npm run contracts:deploy:local\n"
        "npm run dev",
    )
    body(
        doc,
        "Open the address the application prints, normally localhost on port 3000. The badge "
        "beside the logo shows whether the blockchain is connected. If it says off-chain, "
        "everything still works except recording on the chain.",
    )
    figure(doc, "01-landing.png", "The home page. The badge beside the logo reports the live blockchain connection")

    doc.add_heading("6.2 Creating the two accounts", level=2)
    body(doc, "You need one university account and one student account.")
    steps(
        doc,
        [
            "Choose Get Started, then University Staff.",
            "Enter the institution name. This appears on every certificate it issues, so type it carefully.",
            "Enter a name, an email address and a password of at least eight characters.",
            "Submit. You are signed in and a wallet has been created for you automatically.",
            "Sign out, then repeat as a Student with a different email address.",
        ],
    )
    figure(doc, "03-register.png", "Registration starts with the choice of role, which changes the rest of the form")
    figure(doc, "04-register-institution.png", "The university form asks for an institution name")
    body(
        doc,
        "No seed phrase appears, and nothing needs to be installed. The wallet is created and "
        "locked with the password behind the scenes.",
    )

    doc.add_heading("6.3 Issuing a single certificate", level=2)
    steps(
        doc,
        [
            "Sign in as the university.",
            "On the issue tab, enter the student's email address exactly as they registered it.",
            "Enter the student's name, the degree, and the subject. Grade and completion date are optional.",
            "Press issue and confirm.",
        ],
    )
    figure(doc, "11-institution-issue.png", "The issuing form, with the institution's running totals above it")
    body(
        doc,
        "A confirmation appears with the certificate number. If the blockchain is connected "
        "the certificate is recorded on it at the same time. The first time a university "
        "issues anything, the system automatically gives its wallet permission to do so and "
        "provides the small amount of currency needed to pay the network fee. This happens "
        "once and needs no action.",
    )

    doc.add_heading("6.4 Issuing a whole year group", level=2)
    body(
        doc,
        "Issuing hundreds of certificates one at a time is not realistic, so there is a bulk "
        "tab that accepts a spreadsheet file.",
    )
    steps(
        doc,
        [
            "Open the bulk upload tab.",
            "Paste or upload a file with a heading row. Email, name, degree and subject are required; grade and completion date are optional.",
            "Press validate first. This checks the file and reports any problems by row number without issuing anything.",
            "Fix any rows it complains about, then issue.",
        ],
    )
    figure(doc, "13-institution-bulk.png", "Bulk issuing, with a validation pass before anything is issued")
    code(
        doc,
        "email,name,degree,major,grade,completion_date\n"
        "daniel.okafor@student.edu,Daniel Okafor,Bachelor of Science,Physics,Upper Second,2026-06-12\n"
        "sofia.marino@student.edu,Sofia Marino,Bachelor of Arts,Economics,First Class,2026-06-12",
    )
    body(
        doc,
        "If row seven fails, rows one to six are still issued. The report lists exactly which "
        "rows worked and why each failure failed. The limit is 100 rows per upload.",
    )

    doc.add_heading("6.5 Managing and withdrawing certificates", level=2)
    steps(
        doc,
        [
            "Open the credentials tab to see everything the university has issued.",
            "Search by student name or filter by active and withdrawn.",
            "To withdraw one, choose withdraw and type a reason. A reason is required.",
        ],
    )
    figure(doc, "14-institution-manage.png", "Issued certificates, searchable, with a count of how often each has been checked")
    body(
        doc,
        "The reason is shown to anyone who checks the certificate afterwards, including on "
        "links the student has already sent out. There is nothing to recall: the change "
        "appears the next time any of those links is opened.",
    )

    doc.add_heading("6.6 Seeing who is checking", level=2)
    figure(doc, "15-institution-analytics.png", "Certificates issued per month, the mix of qualifications, and recent checking activity")
    body(
        doc,
        "The most useful figure here is usually the checking activity, which shows which "
        "graduates are job-hunting and which qualifications employers actually verify. "
        "Locations are recorded only as a city and country, never as an exact address.",
    )

    doc.add_heading("6.7 The student's view", level=2)
    body(doc, "Sign out and sign in as the student.")
    figure(doc, "18-student-dashboard.png", "The student's certificates, share links and checking history")
    body(
        doc,
        "Each certificate shows whether it is valid, whether its signature checks out, and "
        "whether it is on the blockchain. A certificate can also be downloaded as a standard "
        "credential file that opens in other applications and keeps working even if EduWallet "
        "disappears.",
    )

    doc.add_heading("6.8 Sharing a certificate with an employer", level=2)
    steps(
        doc,
        [
            "Choose share on a certificate.",
            "Give the link a label so you remember who you sent it to.",
            "Choose how long it should last: 24 hours, 7 days, 30 days, or forever.",
            "Decide whether to hide your name and wallet address.",
            "Create the link and copy it.",
        ],
    )
    figure(doc, "19-student-share-dialog.png", "Creating a share link with a label, an expiry and an option to hide your identity", 4.8)
    body(
        doc,
        "Hiding your identity is useful when a recruiter is screening candidates. They see the "
        "degree, the subject, the grade, the university and a valid signature, but not who it "
        "belongs to. Any link can be cancelled instantly, and the dashboard shows how many "
        "times each has been opened.",
    )

    doc.add_heading("6.9 Checking a certificate as an employer", level=2)
    body(
        doc,
        "An employer needs no account. They open the verify page and paste whatever they were "
        "given: a link, a certificate number, or the student's wallet address.",
    )
    figure(doc, "05-verify-landing.png", "The checking page accepts a link, a certificate number or a wallet address")
    figure(doc, "06-verify-valid.png", "A certificate that passes. The three checks are listed separately, with the fingerprint and the blockchain record", 4.6)
    body(
        doc,
        "Read it from the top. The answer comes first, then the details of the qualification, "
        "then the evidence. The three checks are shown one by one so a reader can see exactly "
        "what passed. Below them is the blockchain record, which links out to a public "
        "explorer, and a count of how many times the certificate has been checked before.",
    )
    body(
        doc,
        "If the blockchain cannot be reached, the three checks still pass and only the "
        "blockchain line changes. That is a weaker claim, not a failure, and the page says so "
        "in those words.",
    )

    doc.add_heading("6.10 A withdrawn certificate", level=2)
    figure(doc, "07-verify-revoked.png", "A withdrawn certificate, showing the university's stated reason", 4.6)
    body(
        doc,
        "Notice that the signature still passes. The document genuinely was issued and later "
        "withdrawn, which is a different thing from a forgery, and the page lets a reader tell "
        "them apart.",
    )

    doc.add_heading("6.11 A certificate shared without a name", level=2)
    figure(doc, "08-verify-share-anonymised.png", "A link that proves the qualification without naming the holder", 4.6)

    doc.add_heading("6.12 A student's public page", level=2)
    figure(doc, "09-public-profile.png", "A public page listing a student's valid certificates")
    body(
        doc,
        "Every student has a public page at their wallet address that works like a verifiable "
        "CV. Only certificates that are both in force and cryptographically sound appear on "
        "it. Their email address never does.",
    )

    doc.add_heading("6.13 Setting up recovery guardians", level=2)
    steps(
        doc,
        [
            "As the student, open the recovery page.",
            "Add the email addresses of between two and five university accounts.",
            "Choose how many of them must agree before the account can be moved.",
            "Save. The guardian list is recorded in the application and on the blockchain.",
        ],
    )
    figure(doc, "20-student-recovery.png", "Choosing guardians and setting how many must agree")

    doc.add_heading("6.14 Recovering a lost account", level=2)
    body(doc, "Suppose the student loses access. A guardian starts the process.")
    steps(
        doc,
        [
            "As a guardian university, open the guardianship tab and start a request, giving the student's email address and their new wallet address.",
            "Sign in as a second guardian and approve it.",
            "Wait. A 24-hour delay now runs, and the complete button stays disabled throughout.",
            "After the delay, any guardian or the student can complete the move.",
        ],
    )
    figure(doc, "16-institution-guardianship.png", "The guardian's queue. Completing stays unavailable until enough guardians agree and the delay has passed")
    figure(doc, "21-student-recovery-pending.png", "What the student sees during the delay, including the cancel button only they can use")
    body(
        doc,
        "If the student did not ask for this, they cancel it and nothing happens. A guardian "
        "cannot cancel. After a successful move the account uses the new address, and all the "
        "old certificates still check out because the system remembers the previous address.",
    )

    doc.add_heading("6.15 Taking your wallet with you", level=2)
    figure(doc, "22-student-wallet-export.png", "Revealing the wallet key, after re-entering the password", 4.8)
    body(
        doc,
        "A common objection to systems that hold keys for users is that the user never really "
        "owns anything. This is the way out. The student re-enters their password and the key "
        "is shown once. It is not emailed, logged or stored anywhere after that. With it they "
        "control the wallet holding their certificates, independently of this application.",
    )

    doc.add_heading("6.16 On a phone", level=2)
    body(
        doc,
        "Students usually open the application on a phone, and employers often open a link "
        "from an email on one.",
    )
    figure(doc, "24-mobile-verify.png", "Checking a certificate on a phone", 2.4)
    figure(doc, "25-mobile-student-dashboard.png", "The student's certificates on a phone", 2.4)

    # ═══════════ 7. Testing ═══════════
    h1(doc, "7. Testing and Results")

    doc.add_heading("7.1 How it was tested", level=2)
    body(
        doc,
        "Testing was done at three levels. The smart contracts were tested directly on a local "
        "blockchain. The application was tested through its own interfaces against a real "
        "database rather than imitations, so the storage, permissions and cryptography all "
        "genuinely ran. Finally, a complete run drove the live application against a real "
        "blockchain and then read the contracts back, to confirm that what the application "
        "reported had actually happened.",
    )
    add_table(
        doc,
        "Test results",
        ["Level", "Number", "What it covers", "Result"],
        [
            ["Smart contracts", "77", "Permissions, state changes, rejections, events, random inputs, and properties that must always hold", "All pass"],
            ["Application logic", "89", "Fingerprinting, signing, validation, file parsing, the recovery rules, limits", "All pass"],
            ["Application end to end", "65", "Every interface against a real database", "All pass"],
            ["Storage and integrations", "25", "The shared database, file storage, host detection", "All pass"],
            ["Live blockchain run", "20 steps", "Issuing, recording, withdrawing and a full recovery", "All pass"],
        ],
        widths=[1.4, 0.8, 2.8, 1.2],
    )

    doc.add_heading("7.2 Beyond ordinary tests", level=2)
    body(
        doc,
        "The contract tests include runs with randomly generated inputs, and checks on "
        "properties that must hold no matter what order things happen in. For example: the "
        "lists of certificates per student and per university must always add up to the total "
        "issued; withdrawing a certificate must never change who issued it, who holds it or "
        "when; and the number of guardian agreements must only ever go up and never exceed the "
        "number of guardians.",
    )

    doc.add_heading("7.3 Problems found and fixed", level=2)
    body(
        doc,
        "Testing found several real faults, two of which made whole features silently useless.",
    )
    add_table(
        doc,
        "Significant faults found during testing",
        ["Fault", "Effect", "Fix"],
        [
            [
                "Nothing ever gave a university permission to issue on the blockchain",
                "Every attempt to record a certificate failed, and it was quietly logged as pending forever. The blockchain side of the system did nothing at all",
                "Universities are now given permission and the fee money automatically on their first issue",
            ],
            [
                "Consecutive blockchain transactions clashed with each other",
                "The registry entry for each certificate silently failed to be written",
                "Transactions are now queued and numbered correctly",
            ],
            [
                "The history of who checked a certificate was capped across the whole system",
                "One frequently checked certificate pushed every other student's history out, and the statistics undercounted",
                "The limit now applies per certificate",
            ],
            [
                "Only one hosting provider was recognised as having temporary storage",
                "On other providers the system claimed data was safe while every update wiped it",
                "Detection extended, and a mounted disk can now be named explicitly",
            ],
            [
                "A file storage reply with no reference was accepted as success",
                "An empty reference would be put on the certificate and signed into it",
                "Now treated as a failure, falling back to local storage",
            ],
            [
                "A first-time guardian setup reported itself as an update",
                "The wrong event was published on the blockchain",
                "The previous state is now read before it is changed",
            ],
        ],
        widths=[1.8, 2.3, 2.1],
    )

    # ═══════════ 8. Security ═══════════
    h1(doc, "8. Security Analysis")
    add_table(
        doc,
        "Threats and how they are prevented",
        ["Threat", "How it is prevented"],
        [
            ["Making up a certificate", "Requires the university's key. A checker works out the signing key independently of this website"],
            ["Changing a certificate after issue", "Any change breaks the fingerprint comparison and is reported as tampering"],
            ["Selling or giving away a qualification", "Every method of moving the token is blocked in the contract, including the ones marketplaces use"],
            ["Withdrawing someone else's certificate", "Both the contract and the application require the original issuer"],
            ["Reading another student's certificates", "Ownership is checked on the server for every request. Hiding a button is not treated as security"],
            ["Guardians conspiring to seize an account", "A 24-hour delay in which only the student can cancel, plus a minimum of two guardians who must agree"],
            ["Changing guardians during a recovery", "Blocked while a request is open"],
            ["Guessing passwords in bulk", "Repeated attempts from the same source are slowed down"],
            ["Finding out which emails have accounts", "A wrong password and an unknown email give exactly the same response"],
            ["Keys leaking", "Keys are never included in data sent to the browser. Revealing one needs the password and happens once"],
        ],
        widths=[2.2, 4.0],
    )
    body(
        doc,
        "Passwords are stored using a slow, salted hashing method so that stealing the database "
        "does not reveal them. Each wallet key is encrypted twice: once with a key derived from "
        "the user's password, which the server cannot open, and once with a server key, which "
        "is what lets a certificate be signed at the moment it is issued without the registrar "
        "retyping their password each time.",
    )

    # ═══════════ 9. Limitations ═══════════
    h1(doc, "9. Limitations")
    bullets(
        doc,
        [
            "Deciding which universities are genuine is outside this project. Anyone can "
            "register as an institution in the current system; in real use this would need an "
            "accrediting body.",
            "The server holds a copy of each university's key so it can sign certificates "
            "without a registrar being present. This is a deliberate trade-off for usability, "
            "and students can always take their own key and leave.",
            "A certificate can only be issued to someone who has already registered.",
            "Records are written as whole groups rather than individually, so two people "
            "writing at the same instant could in principle overwrite one another. Certificate "
            "numbering is exempt from this.",
            "The limit on repeated password attempts applies to each server copy separately, "
            "which raises the cost of an attack without being an absolute guarantee.",
            "The system has been run on a test network only. It has not been used with real "
            "students or real money.",
        ],
    )

    # ═══════════ 10. Conclusion ═══════════
    h1(doc, "10. Conclusion and Future Work")
    body(
        doc,
        "This project set out to make an academic certificate that an employer can check "
        "without trusting the website showing it to them, and to do so without asking students "
        "to become key managers. Both were achieved.",
    )
    body(
        doc,
        "A certificate carries a fingerprint of its own contents and a signature from the "
        "university that issued it. Either can be checked offline, so verification does not "
        "depend on a blockchain being reachable at that moment. Where it is reachable, the "
        "certificate is also recorded as a token that can never be sold. Students who lose "
        "access get their accounts back through universities they already trust, protected by "
        "a delay that only they can act within.",
    )
    body(
        doc,
        "Throughout, the system reports what is actually true rather than presenting a "
        "confident face over a feature that is not working. That principle found several real "
        "faults during development, including one that had made the entire blockchain side of "
        "the system inert.",
    )
    doc.add_heading("Future work", level=2)
    bullets(
        doc,
        [
            "Proving something about a certificate without revealing the certificate, for "
            "example that a degree is above a given classification.",
            "An accrediting body that decides which institutions may issue, which this project "
            "leaves open and which the literature identifies as a gap [2].",
            "Issuing a whole year group in a single blockchain transaction, to cut costs.",
            "A study with real students measuring how usable the system is compared with an "
            "ordinary wallet.",
            "Storing records individually so that simultaneous writes cannot interfere.",
        ],
    )

    # ═══════════ 11. References ═══════════
    h1(doc, "11. References")
    references = [
        "Silaghi, D. L. and Popescu, D. E. (2025). A Systematic Review of Blockchain-Based "
        "Initiatives in Comparison to Best Practices Used in Higher Education Institutions. "
        "Computers, 14(4), 141. https://doi.org/10.3390/computers14040141",

        "Frutuoso, G., Rodrigues, D., Francisco, A. P. and Vaz, C. (2026). Identity-Bound "
        "Academic Credentials on Blockchain: On-Chain Issuer Accreditation with ERC-3643 and "
        "OnchainID. arXiv:2607.16383.",

        "Farabi, A., Khandaker, I., Ahsan, J., Shanto, I. K., Jahan, N. and Khan, M. J. (2025). "
        "ShikkhaChain: A Blockchain-Powered Academic Credential Verification System for "
        "Bangladesh. arXiv:2508.05334.",

        "Chatzigiannis, P., Chalkias, K., Kate, A., Mangipudi, E. V., Minaei, M. and Mondal, M. "
        "(2023). SoK: Web3 Recovery Mechanisms. Cryptology ePrint Archive, Report 2023/1575.",

        "Mazzocca, C., Acar, A., Uluagac, S., Montanari, R., Bellavista, P. and Conti, M. "
        "(2025). A Survey on Decentralized Identifiers and Verifiable Credentials. "
        "arXiv:2402.02455.",

        "Schumm, D., Müller, K. O. E. and Stiller, B. (2025). Are We There Yet? A Study of "
        "Decentralized Identity Applications. arXiv:2503.15964.",

        "World Wide Web Consortium (2025). Verifiable Credentials Data Model v2.0. W3C "
        "Recommendation.",

        "Entriken, W., Shirley, D., Evans, J. and Sachs, N. (2018). ERC-721: Non-Fungible Token "
        "Standard. Ethereum Improvement Proposals.",

        "Pandurov, T. et al. (2022). ERC-5192: Minimal Soulbound NFTs. Ethereum Improvement "
        "Proposals.",

        "Buterin, V. (2016). ERC-191: Signed Data Standard. Ethereum Improvement Proposals.",

        "OpenZeppelin (2024). OpenZeppelin Contracts v5 Documentation.",

        "Dworkin, M. (2007). Recommendation for Block Cipher Modes of Operation: "
        "Galois/Counter Mode and GMAC. NIST Special Publication 800-38D.",

        "Kaliski, B. (2000). PKCS #5: Password-Based Cryptography Specification Version 2.0. "
        "RFC 2898.",
    ]
    for i, reference in enumerate(references, start=1):
        paragraph = doc.add_paragraph(f"[{i}]  {reference}")
        paragraph.paragraph_format.left_indent = Inches(0.45)
        paragraph.paragraph_format.first_line_indent = Inches(-0.45)
        paragraph.paragraph_format.space_after = Pt(7)
        paragraph.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

    doc.save(OUT)
    print(f"Written: {OUT}")
    print(f"  {state['figure']} figures, {state['table']} tables")


if __name__ == "__main__":
    build()
