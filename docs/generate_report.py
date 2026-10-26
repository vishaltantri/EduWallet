#!/usr/bin/env python3
"""
Generate the EduWallet course project report.

    .venv/bin/python docs/generate_report.py

Follows the department's course-project format. Code listings are read from
the working tree so they cannot drift from the real source, and the figures
are captured from a running instance connected to a live chain.
"""

from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor

from report_code import function_at, listing
from report_images import prepare
from report_style import (
    BAND_FILL, HEADER_FILL, MAROON,
    body, bullets, centred, code, configure, no_borders, page_break, rule, shade, steps,
)

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "docs" / "screenshots"
SPLIT = SHOTS / "_split"
OUT = ROOT / "EduWallet_Final_Project_Report.docx"
TEXT_WIDTH = 6.27

state = {"figure": 0, "table": 0, "listing": 0}
figures, tables, listings = [], [], []


# ─── Building blocks ────────────────────────────────────────────────────────

def add_table(doc, caption, headers, rows, widths=None):
    state["table"] += 1
    tables.append((state["table"], caption))

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

    centred(doc, f"Table {state['table']}: {caption}", size=9.5, after=10).runs[0].italic = True


def figure(doc, filename, caption, width=5.1):
    path = SHOTS / filename
    if not path.exists():
        print(f"  ! missing figure: {filename}")
        return

    parts = prepare(path, SPLIT)
    state["figure"] += 1
    figures.append((state["figure"], caption))

    if len(parts) == 1:
        paragraph = doc.add_paragraph()
        paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        paragraph.paragraph_format.space_after = Pt(3)
        paragraph.add_run().add_picture(str(parts[0]), width=Inches(width))
    else:
        gutter = 0.10
        column = (TEXT_WIDTH - gutter * (len(parts) - 1)) / len(parts)
        table = doc.add_table(rows=1, cols=len(parts))
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        no_borders(table)
        for cell, part in zip(table.rows[0].cells, parts):
            cell.width = Inches(column + gutter)
            paragraph = cell.paragraphs[0]
            paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
            paragraph.paragraph_format.space_after = Pt(0)
            paragraph.add_run().add_picture(str(part), width=Inches(column))

    label = f"Figure {state['figure']}: {caption}"
    if len(parts) > 1:
        label += " (read left to right)"
    centred(doc, label, size=9.5, after=10).runs[0].italic = True


def source(doc, caption, relative_path, signature, size=8.5, max_lines=90):
    """A numbered listing, extracted from the project source by signature."""
    state["listing"] += 1
    listings.append((state["listing"], caption))
    code(doc, function_at(relative_path, signature, max_lines=max_lines), size=size)
    centred(doc, f"Listing {state['listing']}: {caption}", size=9.5, after=10).runs[0].italic = True


def inline_code(doc, caption, text, size=8.5):
    state["listing"] += 1
    listings.append((state["listing"], caption))
    code(doc, text, size=size)
    centred(doc, f"Listing {state['listing']}: {caption}", size=9.5, after=10).runs[0].italic = True


def h1(doc, text):
    page_break(doc)
    doc.add_heading(text, level=1)


def build():
    doc = Document()
    configure(doc)

    # ═══════════════ TITLE PAGE ═══════════════
    doc.add_paragraph()
    centred(doc, "EDUWALLET: TAMPER-PROOF ACADEMIC CERTIFICATES", size=14, bold=True, after=2)
    centred(doc, "ON BLOCKCHAIN WITH INSTITUTIONAL SOCIAL RECOVERY", size=14, bold=True, after=26)

    centred(doc, "Blockchain Technologies", size=14, bold=True, after=6)
    centred(doc, "Course code : CSI3013", size=12.5, bold=True, after=4)
    centred(doc, "Slot: ______________", size=12.5, bold=True, after=26)

    centred(doc, "COURSE PROJECT REPORT", size=14, bold=True, after=28)

    centred(doc, "Submitted by", size=12.5, bold=True, after=8)
    centred(doc, "______________________________    ______________", size=12.5, after=6)
    centred(doc, "______________________________    ______________", size=12.5, after=6)
    centred(doc, "______________________________    ______________", size=12.5, after=24)

    centred(doc, "Under the guidance of", size=12.5, bold=True, after=6)
    centred(doc, "______________________________", size=12.5, after=24)

    centred(doc, "[ Insert institution logo here ]", size=10.5, after=18)
    centred(doc, "School of Computer Science and Engineering (SCOPE)", size=12, bold=True, after=4)
    centred(doc, date.today().strftime("%B %Y"), size=12, bold=True, after=0)

    # ═══════════════ DECLARATION ═══════════════
    h1(doc, "DECLARATION")
    body(
        doc,
        "We hereby declare that the project report titled “EduWallet: Tamper-Proof "
        "Academic Certificates on Blockchain with Institutional Social Recovery”, "
        "submitted for the course Blockchain Technologies (CSI3013), is a record of the "
        "original work carried out by us under the guidance of our faculty supervisor.",
    )
    body(
        doc,
        "The design, implementation, testing and results presented in this report are our "
        "own. Material drawn from published work is acknowledged in the text and listed in "
        "the references. This work has not been submitted for the award of any other course "
        "credit or degree.",
    )
    for _ in range(2):
        doc.add_paragraph()
    doc.add_paragraph("Signature of the candidates:")
    for _ in range(3):
        doc.add_paragraph("______________________________")
    doc.add_paragraph("Place: ____________________        Date: ____________________")

    # ═══════════════ ACKNOWLEDGEMENT ═══════════════
    h1(doc, "ACKNOWLEDGEMENT")
    body(
        doc,
        "Firstly, we would like to extend our sincere thanks to the management of our "
        "institution, who provided us with all the facilities needed to carry out this "
        "project.",
    )
    body(
        doc,
        "We thank the Head of the Department for the motivation given to us during this "
        "project. Our sincere thanks go to our project guide, who gave us guidance, "
        "constructive advice and encouragement throughout.",
    )
    body(
        doc,
        "We also appreciate the contribution of the faculty and of our fellow students. Our "
        "thanks go as well to the researchers, developers and organisations whose "
        "publications and technical documentation on verifiable credentials, soulbound "
        "tokens, account recovery and blockchain development made this work possible.",
    )
    body(doc, "This project gave us the chance to put our technical knowledge into practice.")

    # ═══════════════ ABSTRACT ═══════════════
    h1(doc, "ABSTRACT")
    body(
        doc,
        "A printed degree certificate is easy to forge and slow to check. An employer who "
        "wants to confirm one must contact the issuing university and wait, often for days. "
        "Moving the certificate into a university database makes checking faster but does not "
        "remove the need for trust: the employer must now believe whoever operates that "
        "database.",
    )
    body(
        doc,
        "This project presents EduWallet, a blockchain-based academic credential system in "
        "which every certificate carries two guarantees that a verifier can check without "
        "trusting the application serving it. All the facts on the certificate are combined, "
        "in a fixed order, into a single keccak256 fingerprint, and the issuing "
        "university’s wallet signs that fingerprint under EIP-191. A verifier recovers "
        "the signing address from the signature and compares it with the university’s "
        "published address. Altering any field breaks the fingerprint comparison. Both checks "
        "run offline, so verification does not depend on the blockchain being reachable at "
        "the moment of checking.",
    )
    body(
        doc,
        "Where a Polygon endpoint is available, the certificate is additionally minted as a "
        "soulbound ERC-721 token conforming to ERC-5192, permanently bound to the holder and "
        "incapable of transfer, approval or sale. A server-side relayer authorises each "
        "university on the certificate contract at its first issuance and funds its gas, so "
        "the university’s own wallet signs the mint and the on-chain issuer matches the "
        "signer of the fingerprint.",
    )
    body(
        doc,
        "The system also addresses the obstacle that has kept similar systems out of "
        "practical use, namely what happens when a student loses access to their wallet. "
        "Rather than asking students to safeguard a private key, EduWallet lets them nominate "
        "between two and five universities as guardians with a chosen approval threshold. A "
        "guardian may open a recovery request naming a new wallet address; the remaining "
        "guardians approve until the threshold is met; a twenty-four hour delay then runs "
        "during which only the student can cancel. The migration preserves the "
        "student’s address history, so certificates signed over the original address "
        "continue to verify instead of being orphaned.",
    )
    body(
        doc,
        "The implementation comprises three Solidity contracts, a Next.js application with "
        "twenty-five API endpoints, and a complete test suite. It was validated by 77 smart "
        "contract tests including fuzz and invariant suites, 179 application tests, and a "
        "20-step end-to-end run driving the live application against a running blockchain. "
        "All pass. Testing uncovered six defects, two of which had left entire features "
        "silently inert.",
    )
    keywords = doc.add_paragraph()
    keywords.add_run("Keywords: ").bold = True
    keywords.add_run(
        "Blockchain, Academic Credentials, Soulbound Tokens, ERC-5192, Digital Signatures, "
        "EIP-191, Social Recovery, Smart Contracts, Polygon, Verifiable Credentials."
    )

    # ═══════════════ TABLE OF CONTENTS ═══════════════
    h1(doc, "TABLE OF CONTENTS")
    contents = [
        ("Preliminary", "Declaration"),
        ("Preliminary", "Acknowledgement"),
        ("Preliminary", "Abstract"),
        ("Preliminary", "List of Figures"),
        ("Preliminary", "List of Tables"),
        ("Preliminary", "List of Listings"),
        ("Chapter 1", "Introduction"),
        ("1.1", "Background"),
        ("1.2", "Overview of Blockchain-Based Credentials"),
        ("1.3", "Problem Statement"),
        ("1.4", "Objectives"),
        ("1.5", "Scope of the Project"),
        ("1.6", "Motivation"),
        ("Chapter 2", "Literature Survey"),
        ("2.1", "Introduction"),
        ("2.2", "Existing Certificate Verification Systems"),
        ("2.3", "Blockchain-Based Credential Frameworks"),
        ("2.4", "Soulbound Tokens and Non-Transferable Credentials"),
        ("2.5", "Key Loss and Account Recovery"),
        ("2.6", "Research Gap"),
        ("Chapter 3", "Proposed System"),
        ("3.1", "Overview"),
        ("3.2", "Proposed Architecture"),
        ("3.3", "System Modules"),
        ("3.4", "Functional Requirements"),
        ("3.5", "Non-Functional Requirements"),
        ("3.6", "Advantages"),
        ("Chapter 4", "System Design and Methodology"),
        ("4.1", "System Workflow"),
        ("4.2", "Canonical Fingerprinting of a Certificate"),
        ("4.3", "Issuer Signature and Verification"),
        ("4.4", "Soulbound Token Design"),
        ("4.5", "Social Recovery Design"),
        ("4.6", "Blockchain Integration"),
        ("4.7", "Security and Privacy Considerations"),
        ("Chapter 5", "Implementation"),
        ("5.1", "Development Environment"),
        ("5.2", "Software Architecture"),
        ("5.3", "Application Implementation"),
        ("5.4", "Verification Engine Implementation"),
        ("5.5", "Smart Contract Implementation"),
        ("5.6", "Application Execution"),
        ("Chapter 6", "Testing and Results"),
        ("6.1", "Testing Strategy"),
        ("6.2", "Test Cases"),
        ("6.3", "Functional Testing and Output"),
        ("6.4", "Smart Contract Testing"),
        ("6.5", "End-to-End Evaluation"),
        ("6.6", "Results and Discussion"),
        ("Chapter 7", "Conclusion and Future Scope"),
        ("7.1", "Conclusion"),
        ("7.2", "Limitations"),
        ("7.3", "Future Enhancements"),
        ("References", "Bibliography"),
        ("Appendix A", "Source Code"),
        ("Appendix B", "System Modules and API Reference"),
        ("Appendix C", "Verification and Recovery Methodology"),
        ("Appendix D", "Testing and Validation"),
        ("Appendix E", "Abbreviations"),
    ]
    toc = doc.add_table(rows=len(contents), cols=2)
    no_borders(toc)
    for row, (left, right) in zip(toc.rows, contents):
        row.cells[0].width = Inches(1.35)
        row.cells[1].width = Inches(4.9)
        for cell, text in zip(row.cells, (left, right)):
            paragraph = cell.paragraphs[0]
            paragraph.paragraph_format.space_after = Pt(3)
            run = paragraph.add_run(text)
            run.font.size = Pt(11)
            if left.startswith(("Chapter", "Appendix", "References", "Preliminary")):
                run.bold = left.startswith(("Chapter", "Appendix"))

    doc.add_paragraph()
    placeholder = {"figures": doc.add_paragraph(), "tables": doc.add_paragraph(),
                   "listings": doc.add_paragraph()}

    build_chapters(doc)

    # Back-fill the three lists now that everything is numbered.
    for key, title, entries in [
        ("figures", "LIST OF FIGURES", figures),
        ("tables", "LIST OF TABLES", tables),
        ("listings", "LIST OF LISTINGS", listings),
    ]:
        paragraph = placeholder[key]
        heading = paragraph.add_run(title)
        heading.bold = True
        heading.font.size = Pt(12.5)
        heading.font.color.rgb = MAROON
        word = title.split()[-1].rstrip("S").title()
        for number, caption in entries:
            paragraph.add_run(f"\n{word} {number}: {caption}")
        paragraph.add_run("\n")

    doc.save(OUT)
    print(f"Written: {OUT}")
    print(f"  {state['figure']} figures, {state['table']} tables, {state['listing']} listings")


def build_chapters(doc):
    # ═══════════ CHAPTER 1 ═══════════
    h1(doc, "CHAPTER 1: INTRODUCTION")

    doc.add_heading("1.1 Background", level=2)
    body(
        doc,
        "Academic certificates are high-value documents that are checked by low-trust means. "
        "A printed certificate carries nothing that lets an outsider establish that the named "
        "university issued it, that its contents have not been altered, or that it has not "
        "since been withdrawn. The only recourse is to contact the issuing registrar, which "
        "takes days and depends on that registrar still existing and still holding reliable "
        "records.",
    )
    body(
        doc,
        "Meanwhile modern printing makes a convincing forgery cheap. A 2025 study of "
        "blockchain-based verification identifies forged engineering degrees and fake "
        "diplomas as an active and growing problem [1]. Employers, admissions offices and "
        "licensing bodies all rely on documents they cannot independently check.",
    )

    doc.add_heading("1.2 Overview of Blockchain-Based Credentials", level=2)
    body(
        doc,
        "A blockchain is an append-only record that no single party controls. Writing a "
        "reference to a certificate onto it produces a record that cannot quietly be changed "
        "afterwards. Applied to education, this allows a university to publish evidence that "
        "a certificate was issued, at a particular time, to a particular person.",
    )
    body(
        doc,
        "Four ideas from this field are used in the present work. A cryptographic hash "
        "reduces a document to a short fingerprint that changes completely if anything in the "
        "document changes. A digital signature lets a verifier establish which key approved "
        "that fingerprint. A soulbound token is a token that is permanently bound to one "
        "account and can never be transferred, which suits a qualification because a degree "
        "is not transferable in real life either. Social recovery allows a set of trusted "
        "parties to move an account to a new address when its owner loses access.",
    )

    doc.add_heading("1.3 Problem Statement", level=2)
    body(
        doc,
        "Existing approaches each leave something unresolved. Paper is forgeable. A central "
        "database moves the trust to its operator rather than removing it. Systems that write "
        "only a hash to a blockchain stop working when the network is unreachable and prove "
        "that a file existed rather than who issued it.",
    )
    body(
        doc,
        "Blockchain credential systems that do address these points have largely failed to "
        "reach practical use. A 2025 systematic review of blockchain in higher education "
        "found that despite a decade of proposals, adoption remains limited [1], and a 2025 "
        "study of deployed decentralised identity systems concluded that the barriers are "
        "practical rather than technical [6]. A recurring cause is key management: such "
        "systems ask the credential holder to safeguard a private key, and a lost key means "
        "permanent loss of access to one’s own academic record [4].",
    )
    body(doc, "The problem statement of this project is therefore:")
    statement = doc.add_paragraph()
    statement.paragraph_format.left_indent = Inches(0.35)
    statement.paragraph_format.right_indent = Inches(0.35)
    statement.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    statement.add_run(
        "To design and implement an academic credential system in which a certificate can be "
        "verified by any third party without trusting the application that serves it, in "
        "which the certificate cannot be transferred or altered, and in which a holder who "
        "loses access to their wallet can recover it without relying on a central support "
        "desk."
    ).italic = True

    doc.add_heading("1.4 Objectives", level=2)
    steps(
        doc,
        [
            "To design a certificate representation that a verifier can check independently of the serving application and without a network connection.",
            "To implement non-transferable on-chain certificates so a qualification cannot be sold or gifted.",
            "To implement issuance, bulk issuance, withdrawal and privacy-scoped sharing as a complete workflow.",
            "To remove key management from the holder without making the system a trap they cannot leave.",
            "To design and implement institutional social recovery with a safeguard against guardian collusion.",
            "To ensure the system reports reduced capability honestly rather than presenting confidence it does not have.",
            "To validate the implementation with automated tests at the contract, application and end-to-end levels.",
        ],
    )

    doc.add_heading("1.5 Scope of the Project", level=2)
    body(doc, "The scope of the implemented system covers:")
    bullets(
        doc,
        [
            "Registration of university and student accounts, each with an automatically generated wallet.",
            "Issuance of a single certificate and bulk issuance of a cohort from a CSV file with prior validation.",
            "Fingerprinting and signing of every certificate by the issuing university’s wallet.",
            "Minting of each certificate as a non-transferable token on Polygon.",
            "Withdrawal of a certificate with a stated reason, propagated on-chain and off.",
            "Public verification with no account, reporting signature, integrity and withdrawal separately.",
            "Expiring share links that can optionally withhold the holder’s identity.",
            "Export of a certificate as a W3C Verifiable Credential document.",
            "Institutional social recovery with a configurable approval threshold and a safety delay.",
            "Issuance and verification analytics for the issuing university.",
        ],
    )
    body(
        doc,
        "The project does not address which bodies are entitled to accredit a university as a "
        "legitimate issuer, nor selective disclosure of individual fields using "
        "zero-knowledge proofs. It has been deployed and tested on a local development chain "
        "and the Polygon Amoy test network, not on a production network.",
    )

    doc.add_heading("1.6 Motivation", level=2)
    body(
        doc,
        "Graduates apply for jobs and further study repeatedly, and each application triggers "
        "the same slow verification. Universities spend staff time answering verification "
        "requests that a machine could answer. Employers accept documents they cannot check. "
        "All three would benefit from a certificate that proves itself.",
    )
    body(
        doc,
        "The second motivation is to make such a system usable. Asking a graduate to look "
        "after a cryptographic key, with permanent loss of their academic record as the "
        "penalty for failure, is not a reasonable design. Universities are already trusted by "
        "their graduates and already exist for the long term, which makes them natural "
        "guardians for exactly this purpose.",
    )

    # ═══════════ CHAPTER 2 ═══════════
    h1(doc, "CHAPTER 2: LITERATURE SURVEY")

    doc.add_heading("2.1 Introduction", level=2)
    body(
        doc,
        "This chapter reviews the work relevant to the project: how certificates are verified "
        "today, what blockchain credential systems have been built, how non-transferable "
        "tokens are standardised, and what is known about account recovery. It closes by "
        "identifying the gaps the proposed system addresses.",
    )

    doc.add_heading("2.2 Existing Certificate Verification Systems", level=2)
    body(
        doc,
        "Verification today falls into a small number of patterns, each with a characteristic "
        "weakness. These are compared in Table 1.",
    )
    add_table(
        doc,
        "Comparison of approaches to certificate verification",
        ["Approach", "How it is checked", "Trust required", "Main weakness"],
        [
            ["Printed certificate", "Contact the registrar", "The records office", "Forgeable; takes days"],
            ["University database", "Search a portal", "The portal operator", "Records can be altered or lost"],
            ["Digitally signed PDF", "Open in a reader", "A certificate authority", "No visibility of later withdrawal"],
            ["Hash on a blockchain", "Compare a hash", "The network being reachable", "Proves a file existed, not who issued it"],
            ["EduWallet", "Signature, fingerprint and chain", "The university’s key only", "The university must protect its key"],
        ],
        widths=[1.3, 1.5, 1.5, 1.9],
    )

    doc.add_heading("2.3 Blockchain-Based Credential Frameworks", level=2)
    body(
        doc,
        "A 2025 systematic review of blockchain initiatives in higher education surveys "
        "proposals for managing academic certificates and compares them against established "
        "institutional practice [1]. It reports continuing interest alongside limited "
        "adoption, and identifies recurring obstacles rather than a single technical barrier.",
    )
    body(
        doc,
        "Deployed systems do exist. ShikkhaChain, published in 2025, is a credential "
        "verification platform for Bangladesh built on Ethereum smart contracts and IPFS, "
        "providing issuance, verification and revocation of tamper-proof records in response "
        "to widespread credential fraud [3]. Work of this kind demonstrates that the "
        "underlying approach is sound and deployable at national scale.",
    )
    body(
        doc,
        "Alongside this, the W3C Verifiable Credentials Data Model provides a vendor-neutral "
        "representation for digital credentials [7], and surveys of decentralised identifiers "
        "and verifiable credentials describe how these standards are being applied across "
        "sectors [5]. The present project exports its certificates in this format so that "
        "they remain readable outside the application.",
    )

    doc.add_heading("2.4 Soulbound Tokens and Non-Transferable Credentials", level=2)
    body(
        doc,
        "A conventional token can be sold. For a qualification this is undesirable: a degree "
        "belongs to the person who earned it. ERC-5192 defines a minimal extension to the "
        "ERC-721 token standard that marks a token as permanently bound to its holder [8][9]. "
        "A 2026 study notes that academic certificates are inherently non-transferable and "
        "therefore resemble soulbound tokens closely, a credential being meaningful only when "
        "bound to the individual who earned it [2].",
    )

    doc.add_heading("2.5 Key Loss and Account Recovery", level=2)
    body(
        doc,
        "A systematisation of Web3 recovery mechanisms sets out the difficulty directly: "
        "recovery in blockchain systems presents challenges distinct from conventional web "
        "applications, and designers must trade off ease of use, cryptographic security and "
        "availability when deciding how a user regains access after losing a key [4].",
    )
    body(
        doc,
        "Social recovery is the dominant answer. A set of guardians can collectively authorise "
        "moving an account to a new key, so that losing a key becomes a recoverable event "
        "rather than a permanent one. Consumer wallets typically nominate friends and family. "
        "In an academic setting, a more suitable class of guardian is already present: the "
        "issuing universities themselves, which the holder already trusts with their academic "
        "record and which are institutionally long-lived.",
    )

    doc.add_heading("2.6 Research Gap", level=2)
    body(
        doc,
        "A 2026 study of blockchain credential systems states the position plainly. Existing "
        "systems, it reports, tend to anchor certificate hashes without binding them to a "
        "verifiable identity, without an explicit mechanism to accredit issuing institutions, "
        "and without support for correcting or revoking credentials once issued [2]. Two "
        "further gaps follow from the wider literature: verification that fails when the "
        "network is unavailable, and the unresolved consequences of key loss [4][6].",
    )
    add_table(
        doc,
        "Gaps identified in the literature and how this project addresses them",
        ["Gap", "Source", "How the proposed system addresses it"],
        [
            ["Hashes stored without binding to a verifiable identity", "[2]",
             "The holder’s wallet address is part of the signed fingerprint, and the certificate is minted as a token permanently bound to that address"],
            ["No mechanism to correct or withdraw an issued credential", "[2]",
             "Withdrawal with a stated reason, applied on-chain and off, visible on every link already shared"],
            ["No mechanism to accredit the issuing institution", "[2]",
             "Partly addressed. A university must be authorised on the contract before it can mint. Deciding who deserves authorisation is left as future work"],
            ["Key loss ends access permanently", "[4]",
             "Institutional social recovery with a configurable threshold and a delay during which only the holder can cancel"],
            ["Verification fails when the network is unreachable", "[1][6]",
             "Signature and fingerprint checks run entirely offline; the chain is a supplementary record"],
            ["Systems appear healthy while silently degraded", "[6]",
             "A status endpoint and interface indicators report the true state of every dependency"],
        ],
        widths=[1.9, 0.6, 3.7],
    )

    # ═══════════ CHAPTER 3 ═══════════
    h1(doc, "CHAPTER 3: PROPOSED SYSTEM")

    doc.add_heading("3.1 Overview", level=2)
    body(
        doc,
        "The proposed system is a web application serving three kinds of user. A university "
        "issues certificates. A student holds and shares them. A verifier checks one, without "
        "an account. Behind the interface, every certificate is fingerprinted and signed by "
        "the issuing university, and recorded on Polygon as a non-transferable token.",
    )

    doc.add_heading("3.2 Proposed Architecture", level=2)
    body(
        doc,
        "The system is organised in three tiers. The presentation and application tiers are "
        "served by a single Next.js process; the settlement tier consists of three Solidity "
        "contracts.",
    )
    inline_code(
        doc,
        "Three-tier architecture of the proposed system",
        "  PRESENTATION TIER  (React, browser)\n"
        "      Landing | Register | Dashboards | Verification | Public profile\n"
        "                     |  HTTPS, bearer token\n"
        "                     v\n"
        "  APPLICATION TIER   (Next.js route handlers, server)\n"
        "      Authentication  -  password hashing, sessions, wallet custody\n"
        "      Credential      -  canonical fingerprint, EIP-191 signing, W3C export\n"
        "      Issuance        -  validation, metadata, numbering, signing, minting\n"
        "      Verification    -  signature, integrity and withdrawal checks\n"
        "      Recovery        -  guardian sets, request lifecycle, migration\n"
        "      Relayer         -  issuer authorisation, gas funding, nonce control\n"
        "                     |                              |\n"
        "                     v                              v\n"
        "  DATA TIER                            SETTLEMENT TIER (Polygon)\n"
        "      Key-value store / files              SoulboundCertificate\n"
        "      IPFS metadata (Pinata)               CredentialRegistry\n"
        "                                           RecoveryManager",
        size=8.0,
    )

    doc.add_heading("3.3 System Modules", level=2)
    add_table(
        doc,
        "Modules of the proposed system",
        ["Module", "Responsibility"],
        [
            ["Authentication", "Registration, sign-in, sessions, password change, wallet key custody and export"],
            ["Issuance", "Single and bulk issuance, validation, metadata storage, numbering, signing"],
            ["Credential", "Canonical fingerprinting, issuer signing, integrity checking, W3C export"],
            ["Verification", "Public checking, outcome resolution, audit logging"],
            ["Sharing", "Expiring and optionally anonymised share links"],
            ["Recovery", "Guardian configuration and the request lifecycle, on-chain and off"],
            ["Blockchain", "Contract calls, issuer onboarding, gas funding, timeouts and degradation"],
            ["Analytics", "Issuance volume, credential mix, verification activity"],
        ],
        widths=[1.4, 4.8],
    )

    doc.add_heading("3.4 Functional Requirements", level=2)
    add_table(
        doc,
        "Functional requirements and their implementation status",
        ["ID", "Requirement", "Status"],
        [
            ["FR1", "Register university and student accounts, each with a generated wallet", "Implemented"],
            ["FR2", "Issue a signed certificate to a registered student", "Implemented"],
            ["FR3", "Issue a cohort from a CSV file, with validation before issuance", "Implemented"],
            ["FR4", "Withdraw a certificate with a stated reason", "Implemented"],
            ["FR5", "Mint each certificate as a non-transferable on-chain token", "Implemented"],
            ["FR6", "List, search and filter a holder’s certificates", "Implemented"],
            ["FR7", "Create expiring, optionally anonymised share links", "Implemented"],
            ["FR8", "Export a certificate as a W3C Verifiable Credential", "Implemented"],
            ["FR9", "Verify a certificate with no account", "Implemented"],
            ["FR10", "Report signature, integrity and withdrawal as separate results", "Implemented"],
            ["FR11", "Configure guardians and an approval threshold", "Implemented"],
            ["FR12", "Open, approve and complete a recovery request", "Implemented"],
            ["FR13", "Allow the holder alone to cancel during the safety delay", "Implemented"],
            ["FR14", "Export the wallet key and change the account password", "Implemented"],
            ["FR15", "Provide issuance and verification analytics", "Implemented"],
        ],
        widths=[0.6, 4.1, 1.5],
    )

    doc.add_heading("3.5 Non-Functional Requirements", level=2)
    add_table(
        doc,
        "Non-functional requirements and how they are met",
        ["ID", "Requirement", "How it is met"],
        [
            ["NFR1", "Verification must not require a network connection", "Signature and fingerprint checks are computed locally"],
            ["NFR2", "Degraded capability must be reported honestly", "A status endpoint and interface indicators reflect real dependency state"],
            ["NFR3", "Key material must never reach the browser or logs", "Serialised user objects exclude all key fields; export is a single explicit action"],
            ["NFR4", "Authorisation must be enforced on the server", "Every endpoint checks ownership or role before responding"],
            ["NFR5", "Concurrent issuance must not duplicate token numbers", "Numbering uses an atomic increment in the shared store"],
            ["NFR6", "A chain or storage failure must not fail an issuance", "Both steps degrade; only signing is mandatory"],
        ],
        widths=[0.6, 2.3, 3.3],
    )

    doc.add_heading("3.6 Advantages", level=2)
    bullets(
        doc,
        [
            "A verifier checks the certificate against the university’s key, not against this application.",
            "Verification completes in seconds, with no account and no contact with the registrar.",
            "Any alteration after issuance is detected and reported specifically as tampering.",
            "A certificate cannot be transferred, approved or sold.",
            "Withdrawal reaches every link already shared, with the reason attached.",
            "The holder can share a qualification without disclosing their identity.",
            "A lost wallet is recoverable through institutions the holder already trusts.",
            "Verification continues to work when the blockchain is unavailable.",
        ],
    )

    # ═══════════ CHAPTER 4 ═══════════
    h1(doc, "CHAPTER 4: SYSTEM DESIGN AND METHODOLOGY")

    doc.add_heading("4.1 System Workflow", level=2)
    body(
        doc,
        "The workflow runs from issuance through sharing to verification, with recovery as a "
        "separate lifecycle that can be triggered at any point.",
    )
    inline_code(
        doc,
        "End-to-end workflow of the system",
        "  UNIVERSITY                 STUDENT                    VERIFIER\n"
        "      |                          |                          |\n"
        "  [1] enters certificate         |                          |\n"
        "      details                    |                          |\n"
        "      |                          |                          |\n"
        "  [2] metadata -> IPFS           |                          |\n"
        "  [3] token number allocated     |                          |\n"
        "  [4] fingerprint computed       |                          |\n"
        "      and SIGNED  <-- mandatory  |                          |\n"
        "  [5] minted on Polygon          |                          |\n"
        "      |                          |                          |\n"
        "      +------- certificate ----> |                          |\n"
        "                                 |                          |\n"
        "                             [6] creates share link ------> |\n"
        "                                 (expiry, anonymity)        |\n"
        "                                                            |\n"
        "                                                  [7] signature check\n"
        "                                                  [8] fingerprint check\n"
        "                                                  [9] withdrawal check\n"
        "                                                            |\n"
        "                                                  VALID / WITHDRAWN /\n"
        "                                                  TAMPERED / NOT FOUND",
        size=8.0,
    )

    doc.add_heading("4.2 Canonical Fingerprinting of a Certificate", level=2)
    body(
        doc,
        "A fingerprint is only meaningful if the same certificate always produces the same "
        "bytes. The order of keys in a JSON object is not a stable guarantee, so the payload "
        "is built as an explicitly ordered list of key and value pairs. Addresses and email "
        "addresses are lowercased so a re-cased copy produces the same fingerprint, and "
        "optional fields are always present so that a value cannot move between fields "
        "without changing the result.",
    )
    inline_code(
        doc,
        "Canonical payload for a certificate, before hashing",
        "tokenId=7\n"
        "studentAddress=0xe5be0ae5ddffb86c6d4ecf5d07fab76df42b7048\n"
        "studentName=Priya Sharma\n"
        "studentEmail=priya.sharma@student.edu\n"
        "issuerAddress=0xbe22811dff0d5b70c12a90863f27f41e19423455\n"
        "institutionName=Northfield Institute of Technology\n"
        "degreeType=Bachelor of Technology\n"
        "major=Computer Science and Engineering\n"
        "grade=First Class with Distinction\n"
        "completionDate=2026-05-28\n"
        "ipfsHash=QmX4e9...\n"
        "issuedAt=2026-10-25T09:14:02.511Z",
    )
    body(
        doc,
        "This text is hashed with keccak256 to produce the fingerprint. Fields that a verifier "
        "evaluates separately are deliberately excluded. Withdrawal status is one: including "
        "it would cause a legitimately withdrawn certificate to report as tampered.",
    )

    doc.add_heading("4.3 Issuer Signature and Verification", level=2)
    body(
        doc,
        "The university’s wallet signs the fingerprint under EIP-191. Verification "
        "recomputes the fingerprint from the stored record, compares it with the one that was "
        "signed, and recovers the signing address from the signature. Altering a field breaks "
        "the first comparison; substituting another wallet’s signature breaks the second.",
    )
    body(doc, "Four outcomes are possible, in the order of precedence shown in Table 6.")
    add_table(
        doc,
        "Verification outcomes and their precedence",
        ["Outcome", "Signature", "Contents", "Interpretation"],
        [
            ["Tampered", "Fails, or contents differ", "Altered", "Highest precedence; a question of forgery"],
            ["Withdrawn", "Valid", "Intact", "Genuinely issued, later cancelled, with the reason"],
            ["Valid", "Valid", "Intact", "Genuine and in force"],
            ["Not found", "—", "—", "No such certificate; usually a truncated link"],
        ],
        widths=[1.1, 1.5, 1.0, 2.6],
    )
    body(
        doc,
        "Tampering outranks withdrawal deliberately. A document whose contents no longer "
        "match its signature raises a question of forgery, which is materially different from "
        "an administrative cancellation, so the more serious answer must win. Conversely a "
        "withdrawn certificate retains and displays its valid signature, because the document "
        "genuinely was issued.",
    )

    doc.add_heading("4.4 Soulbound Token Design", level=2)
    body(
        doc,
        "Non-transferability is enforced at the lowest available point rather than in the "
        "interface. The ERC-721 update hook permits only minting, where the sender is the "
        "zero address, and burning, where the recipient is. Every other movement reverts. The "
        "approval functions are overridden to revert as well, which closes the route by which "
        "a token could otherwise be listed on a marketplace.",
    )

    doc.add_heading("4.5 Social Recovery Design", level=2)
    body(
        doc,
        "The recovery lifecycle is implemented in the contract and mirrored in the "
        "application, using identical timing constants so the interface never offers an "
        "action the contract would reject.",
    )
    steps(
        doc,
        [
            "In advance, the holder nominates two to five universities and sets how many must agree.",
            "A guardian opens a request naming the holder’s new wallet address. This counts as the first agreement.",
            "Remaining guardians approve until the threshold is reached.",
            "A 24-hour delay begins, measured from the time the request was opened.",
            "During the delay the holder, and only the holder, may cancel.",
            "After the delay, any guardian or the holder completes the migration.",
        ],
    )
    body(
        doc,
        "A request that nobody completes expires after seven days. The delay is the "
        "holder’s protection against collusion among guardians, and the exclusivity of "
        "the cancellation right is what gives it force.",
    )
    body(
        doc,
        "Migration preserves history rather than rewriting records. A certificate’s "
        "signature covers the address it was issued to, so that address cannot be changed "
        "without invalidating the signature. The account therefore retains its previous "
        "addresses, and lookups for certificates, share links and the public profile all "
        "resolve across the whole history.",
    )

    doc.add_heading("4.6 Blockchain Integration", level=2)
    body(
        doc,
        "Space on a blockchain is costly and permanent, so the boundary is drawn "
        "deliberately. Ownership, issuer authorisation, withdrawal status, guardian sets and "
        "recovery requests are settled on-chain. Account details, search, analytics, share "
        "links and the verification audit log remain in the application database.",
    )
    body(
        doc,
        "The certificate contract restricts minting to authorised issuers, and a university "
        "receives a freshly generated wallet when it registers, which is neither authorised "
        "nor funded. A server-side relayer holding the deploying wallet’s key closes "
        "this gap: at a university’s first issuance it authorises that wallet, registers "
        "it on the credential registry and transfers enough currency to cover gas. The "
        "university’s own wallet then signs the mint, so the on-chain issuer matches the "
        "address that signed the fingerprint.",
    )
    body(
        doc,
        "A database record is never treated as evidence that an on-chain operation succeeded. "
        "Transaction receipts are awaited and contract state is read back before a "
        "certificate is reported as recorded.",
    )

    doc.add_heading("4.7 Security and Privacy Considerations", level=2)
    body(
        doc,
        "Passwords are stored as PBKDF2-SHA512 digests over 100,000 iterations with a "
        "per-user salt [13]. Each wallet key is sealed twice with AES-256-GCM [12]: once "
        "under a key derived from the user’s password, which the server cannot open, and "
        "once under a server master key, which is what allows a certificate to be signed at "
        "the moment of issuance without a registrar retyping their password for every "
        "certificate.",
    )
    body(
        doc,
        "Verification records store a city and country rather than an address. Public "
        "profiles never expose an email address. Share links can withhold the holder’s "
        "name and wallet while still proving the qualification.",
    )

    # ═══════════ CHAPTER 5 ═══════════
    h1(doc, "CHAPTER 5: IMPLEMENTATION")

    doc.add_heading("5.1 Development Environment", level=2)
    add_table(
        doc,
        "Development environment and tools",
        ["Component", "Technology", "Purpose"],
        [
            ["Blockchain", "Polygon Amoy; local Hardhat node", "Settlement and testing"],
            ["Contract language", "Solidity 0.8.27", "Smart contract implementation"],
            ["Contract tooling", "Hardhat, OpenZeppelin v5", "Compilation, deployment, testing"],
            ["Application", "Next.js 16, React 19, TypeScript", "Interface and API in one process"],
            ["Styling", "Tailwind CSS v4, Framer Motion", "Interface and transitions"],
            ["Chain access", "Ethers v6", "Typed contract calls and nonce management"],
            ["Storage", "Upstash Redis, local files", "Selected at runtime"],
            ["Metadata", "IPFS via Pinata", "Content-addressed certificate metadata"],
            ["Testing", "Hardhat, Vitest, Puppeteer", "Contract, application and browser levels"],
        ],
        widths=[1.3, 2.3, 2.6],
    )

    doc.add_heading("5.2 Software Architecture", level=2)
    body(
        doc,
        "The application is organised as a set of domain modules behind the API endpoints. "
        "Each endpoint performs authentication and authorisation, then delegates to a module. "
        "The modules of interest to this chapter are credential fingerprinting and signing, "
        "the issuance pipeline, verification, the recovery state machine and the blockchain "
        "layer.",
    )

    doc.add_heading("5.3 Application Implementation", level=2)
    body(
        doc,
        "Listing 3 shows the construction of the canonical payload and its hash. The field "
        "order is fixed in code rather than relying on object key order, and the normalising "
        "of case is visible on the address and email fields.",
    )
    source(doc, "Canonical payload construction",
           "frontend/src/lib/credential.ts", "export function canonicalPayload")

    body(
        doc,
        "Listing 4 shows signing. The issuer’s key is opened from server-side custody, "
        "the fingerprint is computed and signed, and a university whose key is unavailable "
        "returns null rather than a fabricated signature, so the certificate is marked "
        "unsigned instead of falsely claiming to be signed.",
    )
    source(doc, "Signing a certificate with the issuing university’s key",
           "frontend/src/lib/credential.ts", "export async function signCredential")

    body(
        doc,
        "Listing 5 shows the integrity check performed at verification time. The fingerprint "
        "is recomputed and compared, and the signing address is recovered from the signature "
        "and compared with the issuer’s address. The two results are reported separately "
        "so the interface can distinguish an edited certificate from one signed by the wrong "
        "wallet.",
    )
    source(doc, "Integrity checking: recomputing the fingerprint and recovering the signer",
           "frontend/src/lib/credential.ts", "export function checkIntegrity")

    body(
        doc,
        "Listing 6 shows how a single answer is derived from those results. Tampering is "
        "tested before withdrawal, which is what gives it precedence.",
    )
    source(doc, "Resolving the verification outcome",
           "frontend/src/lib/verification.ts", "export function resolveOutcome")

    doc.add_heading("5.4 Verification Engine Implementation", level=2)
    body(
        doc,
        "The recovery state machine is pure and takes the current time as an argument, which "
        "makes the whole lifecycle testable without waiting a day. Listing 7 shows how the "
        "two gates, the approval threshold and the cooldown, are evaluated together with the "
        "seven-day expiry.",
    )
    source(doc, "The recovery state machine", "frontend/src/lib/recovery.ts", "export function recoveryState")

    body(
        doc,
        "Listing 8 shows the relayer routine that makes on-chain issuance possible at all. It "
        "checks whether the university is already authorised, authorises it if not, registers "
        "it on the credential registry and funds its gas. It is idempotent, so a second "
        "issuance by the same university sends no transactions.",
    )
    source(doc, "Authorising and funding a university at its first issuance",
           "frontend/src/lib/blockchain.ts", "export async function ensureIssuerOnboarded", size=8.0)

    doc.add_heading("5.5 Smart Contract Implementation", level=2)
    body(
        doc,
        "Listing 9 shows certificate issuance in the contract. The call is restricted to "
        "authorised issuers, the token is minted to the student, and the ERC-5192 Locked "
        "event is emitted alongside the issuance event so that wallets recognise the token as "
        "soulbound.",
    )
    source(doc, "Minting a certificate on chain",
           "contracts/contracts/SoulboundCertificate.sol", "function issueCertificate")

    body(
        doc,
        "Listing 10 is the mechanism that makes the token non-transferable. Only minting, "
        "where the sender is the zero address, and burning, where the recipient is, are "
        "permitted; anything else reverts.",
    )
    source(doc, "Blocking every transfer at the ERC-721 update hook",
           "contracts/contracts/SoulboundCertificate.sol", "function _update")

    body(
        doc,
        "Listing 11 shows the opening of a recovery request. The call is restricted to a "
        "guardian of the account, a second concurrent request is rejected, and the initiating "
        "guardian is counted as the first approval.",
    )
    source(doc, "Opening a recovery request",
           "contracts/contracts/RecoveryManager.sol", "function initiateRecovery")

    body(
        doc,
        "Listing 12 shows completion. Both gates are enforced on-chain: the approval count "
        "must have reached the threshold, and the cooldown must have elapsed. The address "
        "migration is then recorded so that the old address resolves to the new one.",
    )
    source(doc, "Completing a recovery after the threshold and cooldown",
           "contracts/contracts/RecoveryManager.sol", "function executeRecovery", size=8.0, max_lines=60)

    doc.add_heading("5.6 Application Execution", level=2)
    body(doc, "The system is compiled, deployed and started with the following commands.")
    inline_code(
        doc,
        "Commands to compile, deploy and run the system",
        "# 1. Compile and test the smart contracts\n"
        "cd contracts\n"
        "npx hardhat compile\n"
        "npx hardhat test\n"
        "\n"
        "# 2. Start a local chain and deploy to it\n"
        "npx hardhat node\n"
        "npx hardhat run scripts/deploy.js --network localhost\n"
        "\n"
        "# 3. Configure and start the application\n"
        "cd ../frontend\n"
        "npm install\n"
        "cp .env.example .env.local      # contract addresses, RPC URL, relayer key\n"
        "npm run dev\n"
        "\n"
        "# 4. Run the test suites\n"
        "npm test                        # 179 application tests\n"
        "npm run test:e2e:chain          # 20-step run against the live chain",
    )
    body(
        doc,
        "Deployment to the local chain produces the three contract addresses, which are then "
        "placed in the application configuration. The output of a deployment is shown in "
        "Listing 14.",
    )
    inline_code(
        doc,
        "Output of deploying the three contracts to a local chain",
        "EduWallet Contract Deployment\n"
        "\n"
        "Deployer address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266\n"
        "Deployer balance: 10000.0 ETH/MATIC\n"
        "\n"
        "1/3 Deploying SoulboundCertificate...\n"
        "    SoulboundCertificate: 0x5FbDB2315678afecb367f032d93F642f64180aa3\n"
        "2/3 Deploying CredentialRegistry...\n"
        "    CredentialRegistry:   0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512\n"
        "3/3 Deploying RecoveryManager...\n"
        "    RecoveryManager:      0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0\n"
        "\n"
        "All contracts deployed successfully.\n"
        "Deployment info saved to ./deployments.json",
    )

    # ═══════════ CHAPTER 6 ═══════════
    h1(doc, "CHAPTER 6: TESTING AND RESULTS")

    doc.add_heading("6.1 Testing Strategy", level=2)
    body(
        doc,
        "Testing was carried out at three levels. Smart contract tests exercise the Solidity "
        "directly on a local chain. Application tests exercise the API endpoints against a "
        "real persistent store rather than imitations, so storage, authorisation and "
        "cryptography all genuinely execute. An end-to-end run drives the live application "
        "over HTTP against a running blockchain and then reads the contracts back, confirming "
        "that what the application reported actually happened.",
    )

    doc.add_heading("6.2 Test Cases", level=2)
    add_table(
        doc,
        "Representative test cases and their outcomes",
        ["ID", "Test case", "Expected result", "Outcome"],
        [
            ["T1", "Issue a certificate to a registered student", "Signed certificate created and minted", "Pass"],
            ["T2", "Issue to an unregistered email address", "Rejected with a specific reason", "Pass"],
            ["T3", "Alter a stored certificate, then verify", "Reported as tampered", "Pass"],
            ["T4", "Sign with a wallet other than the issuer\u2019s", "Signature check fails", "Pass"],
            ["T5", "Withdraw a certificate and re-verify", "Withdrawn, with reason; signature still valid", "Pass"],
            ["T6", "Withdraw another university\u2019s certificate", "Rejected as unauthorised", "Pass"],
            ["T7", "Transfer a minted certificate", "Reverts with Soulbound", "Pass"],
            ["T8", "Approve a certificate for transfer", "Reverts with Soulbound", "Pass"],
            ["T9", "Open a share link after its expiry", "Reported as expired", "Pass"],
            ["T10", "Open an anonymised share link", "Qualification shown; holder withheld", "Pass"],
            ["T11", "Complete a recovery before the threshold", "Rejected", "Pass"],
            ["T12", "Complete a recovery before the delay elapses", "Rejected", "Pass"],
            ["T13", "Cancel a recovery as the holder", "Request cancelled", "Pass"],
            ["T14", "Cancel a recovery as a guardian", "Rejected", "Pass"],
            ["T15", "Verify an old certificate after migration", "Still valid under the previous address", "Pass"],
            ["T16", "Read another student\u2019s certificates", "Rejected as unauthorised", "Pass"],
            ["T17", "Issue twenty-five certificates concurrently", "No duplicate token numbers", "Pass"],
            ["T18", "Verify with the blockchain unreachable", "Valid; anchoring reported unavailable", "Pass"],
        ],
        widths=[0.5, 2.3, 2.4, 0.8],
    )

    doc.add_heading("6.3 Functional Testing and Output", level=2)
    body(
        doc,
        "This section presents the output of the system in use. Every figure is the running "
        "application connected to a live chain, with certificates that are genuinely signed "
        "and transaction references that are real.",
    )

    doc.add_heading("6.3.1 Account creation", level=3)
    figure(doc, "01-landing.png", "Home page, with the live chain status indicator beside the logo")
    figure(doc, "03-register.png", "Registration, beginning with the choice of role")
    figure(doc, "04-register-institution.png", "University registration, requiring the institution name")

    doc.add_heading("6.3.2 Certificate issuance", level=3)
    figure(doc, "11-institution-issue.png", "The issuance form with the university\u2019s running totals")
    body(
        doc,
        "A successful issuance returns the created certificate. The response in Listing 15 is "
        "the actual output for the certificate used throughout this chapter, showing the "
        "fingerprint, the issuer signature and the transaction in which it was minted.",
    )
    inline_code(
        doc,
        "Output of a successful issuance request",
        '{\n'
        '  "message": "Certificate issued and cryptographically signed",\n'
        '  "tokenId": 1,\n'
        '  "credential": {\n'
        '    "id": "f5880389-60b5-4a08-9848-089a22ac735d",\n'
        '    "studentName": "Priya Sharma",\n'
        '    "degreeType": "Bachelor of Technology",\n'
        '    "major": "Computer Science and Engineering",\n'
        '    "grade": "First Class with Distinction",\n'
        '    "institutionName": "Northfield Institute of Technology",\n'
        '    "credentialHash": "0xf1ddbc90ff004ce6ee22d0aabc44b206f0b27c303e63f...",\n'
        '    "issuerSignature": "0x2db4a3889680e9da3b7fda0e74b158d93f6fa83ba55...",\n'
        '    "anchored": true,\n'
        '    "txHash": "0xc6555bf5fdfe87335f6523a6459ff5461b71189e9fa921f508...",\n'
        '    "chainTokenId": 1,\n'
        '    "isValid": true\n'
        '  }\n'
        '}',
    )

    doc.add_heading("6.3.3 Bulk issuance", level=3)
    figure(doc, "13-institution-bulk.png", "Bulk issuance, with validation performed before anything is issued")
    body(
        doc,
        "Bulk issuance reports each row separately, because partial success is the normal "
        "outcome rather than an error. Listing 16 shows the output for a file containing two "
        "valid rows, one naming an unregistered student and one with a malformed address.",
    )
    inline_code(
        doc,
        "Output of a bulk issuance containing valid and invalid rows",
        '{\n'
        '  "message": "Issued 2 of 3 certificates",\n'
        '  "issued": [\n'
        '    { "email": "daniel.okafor@student.edu", "tokenId": 5 },\n'
        '    { "email": "sofia.marino@student.edu",  "tokenId": 6 }\n'
        '  ],\n'
        '  "failed": [\n'
        '    { "email": "ghost@example.com",\n'
        '      "reason": "No EduWallet account for ghost@example.com." },\n'
        '    { "email": "\\u2014",\n'
        '      "reason": "Row 5: \\"bad-email\\" is not a valid email address" }\n'
        '  ]\n'
        '}',
    )

    doc.add_heading("6.3.4 Management and withdrawal", level=3)
    figure(doc, "14-institution-manage.png", "Issued certificates, searchable, with verification counts")
    figure(doc, "15-institution-analytics.png", "Issuance volume, credential mix and verification activity")

    doc.add_heading("6.3.5 The holder\u2019s view and sharing", level=3)
    figure(doc, "18-student-dashboard.png", "The holder\u2019s certificates, share links and verification history")
    figure(doc, "19-student-share-dialog.png", "Creating a share link with an expiry and optional anonymity", 4.8)

    doc.add_heading("6.3.6 Verification output", level=3)
    figure(doc, "05-verify-landing.png", "The verification entry point, requiring no account")
    figure(doc, "06-verify-valid.png", "A verified certificate, showing the three checks, the fingerprint and the chain anchor", 4.6)
    body(
        doc,
        "The same result is available as a machine-readable response, shown in Listing 17. "
        "The three checks are reported independently, and the on-chain record is compared "
        "with the stored record rather than assumed to agree.",
    )
    inline_code(
        doc,
        "Verification response for a valid, anchored certificate",
        '{\n'
        '  "outcome": "valid",\n'
        '  "isValid": true,\n'
        '  "studentName": "Priya Sharma",\n'
        '  "degreeType": "Bachelor of Technology",\n'
        '  "institutionName": "Northfield Institute of Technology",\n'
        '  "integrity": {\n'
        '    "signed": true,\n'
        '    "contentIntact": true,\n'
        '    "signatureValid": true,\n'
        '    "recoveredSigner": "0xBe22811dff0d5B70c12a90863f27F41e19423455"\n'
        '  },\n'
        '  "anchor": {\n'
        '    "anchored": true,\n'
        '    "onChainMatches": true,\n'
        '    "txHash": "0xc6555bf5fdfe87335f6523a6459ff5461b71189e9fa921f508..."\n'
        '  },\n'
        '  "priorVerifications": 11\n'
        '}',
    )
    figure(doc, "07-verify-revoked.png", "A withdrawn certificate, with the reason given by the university", 4.6)
    body(
        doc,
        "Listing 18 shows the output when a certificate has been altered in storage after "
        "issuance. The signature still recovers to the issuer, because it was a genuine "
        "signature over the original fingerprint, but the contents no longer match it, and "
        "the outcome is reported as tampered rather than valid.",
    )
    inline_code(
        doc,
        "Verification response for a certificate altered after issuance",
        '{\n'
        '  "outcome": "tampered",\n'
        '  "isValid": false,\n'
        '  "integrity": {\n'
        '    "signed": true,\n'
        '    "contentIntact": false,\n'
        '    "signatureValid": true\n'
        '  }\n'
        '}',
    )
    figure(doc, "08-verify-share-anonymised.png", "An anonymised share link proving the qualification without naming the holder", 4.6)
    figure(doc, "09-public-profile.png", "A public credential profile listing active, signature-valid certificates")

    doc.add_heading("6.3.7 Social recovery", level=3)
    figure(doc, "20-student-recovery.png", "Guardian configuration, recorded in the application and on the contract")
    figure(doc, "16-institution-guardianship.png", "The guardian queue; completion is unavailable until both gates are satisfied")
    figure(doc, "21-student-recovery-pending.png", "The holder\u2019s view of a pending request, with the exclusive cancel action")
    figure(doc, "22-student-wallet-export.png", "Wallet key export, requiring the password and shown once", 4.8)

    doc.add_heading("6.3.8 Responsive output", level=3)
    figure(doc, "24-mobile-verify.png", "Verification at a 390 pixel viewport", 2.4)
    figure(doc, "25-mobile-student-dashboard.png", "The holder\u2019s dashboard at a 390 pixel viewport", 2.4)

    doc.add_heading("6.4 Smart Contract Testing", level=2)
    body(
        doc,
        "The contract suite covers access control, state transitions, rejections and event "
        "emission, and adds deterministic fuzz runs and invariant checks. Fuzz runs mint to "
        "arbitrary recipients with arbitrary metadata lengths and exercise every valid "
        "combination of guardian count and threshold. Invariants assert properties that must "
        "hold whatever the order of operations: that per-student and per-university token "
        "lists always sum to the total issued, that withdrawal never alters a "
        "certificate\u2019s issuer, holder, metadata or issuance time, and that approval "
        "counts increase monotonically and never exceed the guardian count.",
    )
    inline_code(
        doc,
        "Output of the smart contract test suite",
        "  EduWallet Smart Contracts\n"
        "    SoulboundCertificate\n"
        "      Issuer Management .......................... 4 passing\n"
        "      Certificate Issuance ....................... 6 passing\n"
        "      Soulbound Enforcement ...................... 5 passing\n"
        "      Revocation ................................. 4 passing\n"
        "    CredentialRegistry ........................... 9 passing\n"
        "    RecoveryManager .............................. 20 passing\n"
        "  EduWallet hardening\n"
        "    RecoveryManager events ....................... 5 passing\n"
        "    Recovery expiry .............................. 3 passing\n"
        "    Soulbound enforcement ........................ 5 passing\n"
        "    Access control ............................... 7 passing\n"
        "    Fuzz ......................................... 3 passing\n"
        "    Invariants ................................... 5 passing\n"
        "\n"
        "  77 passing (3s)",
    )

    doc.add_heading("6.5 End-to-End Evaluation", level=2)
    body(
        doc,
        "The end-to-end run confirms the on-chain path by reading the contracts back rather "
        "than trusting the application\u2019s own report. It verifies that the university "
        "wallet was authorised, that the mint transaction succeeded, that the certificate was "
        "mirrored into the registry, that the token is owned by the student and reports "
        "itself locked, that withdrawal is reflected in contract state, and that a complete "
        "social recovery migrates the account with the contract recording the migration.",
    )
    inline_code(
        doc,
        "Output of the chain-enabled end-to-end run",
        "EduWallet chain-enabled E2E\n"
        "  chain: chain 31337 | block 3\n"
        "\n"
        "  PASS  first issuance authorises and funds the university, then mints\n"
        "  PASS  the mint transaction really succeeded on chain\n"
        "  PASS  the wallet is authorised as an issuer on chain\n"
        "  PASS  the university is registered on the credential registry\n"
        "  PASS  the credential was mirrored into the registry\n"
        "  PASS  the token is owned by the student and is locked\n"
        "  PASS  public verification corroborates the record against the chain\n"
        "  PASS  a second issuance reuses the existing authorisation\n"
        "  PASS  withdrawal is anchored on chain and reflected in verification\n"
        "  PASS  a guardian set is registered on the RecoveryManager contract\n"
        "  PASS  a guardian opens a recovery request, mirrored on chain\n"
        "  PASS  the student can see the request, making cancellation possible\n"
        "  PASS  execution is refused before the threshold and the delay\n"
        "  PASS  a second guardian's approval is mirrored on chain\n"
        "  PASS  execution is still refused during the 24-hour delay\n"
        "  PASS  after the delay the migration completes on chain and off\n"
        "  PASS  the recovered account keeps working under its new address\n"
        "  PASS  verification of an unknown certificate reports not_found\n"
        "  PASS  every public page renders\n"
        "  PASS  a public credential profile renders for the holder's address\n"
        "\n"
        "ALL PASSED",
    )

    doc.add_heading("6.6 Results and Discussion", level=2)
    add_table(
        doc,
        "Summary of test results",
        ["Level", "Count", "Scope", "Result"],
        [
            ["Smart contracts", "77", "Access control, state, events, fuzz, invariants", "All pass"],
            ["Application logic", "89", "Fingerprinting, signing, validation, parsing, recovery rules", "All pass"],
            ["Application integration", "65", "Every endpoint against a real store", "All pass"],
            ["Storage and integrations", "25", "Durable store, metadata pinning, host detection", "All pass"],
            ["End-to-end with chain", "20 steps", "Issuance, anchoring, withdrawal, recovery", "All pass"],
        ],
        widths=[1.5, 0.8, 2.8, 1.1],
    )
    body(
        doc,
        "All objectives stated in section 1.4 were met. Testing also located six defects, two "
        "of which had left whole features silently inert, and these are set out in Table 11.",
    )
    add_table(
        doc,
        "Defects identified during testing and their resolution",
        ["Defect", "Effect", "Resolution"],
        [
            ["Nothing ever authorised a university to mint",
             "Every mint reverted and was recorded as pending indefinitely; the on-chain path did nothing at all",
             "A relayer now authorises and funds each university at its first issuance"],
            ["Consecutive relayer and issuer transactions reused nonces",
             "Registry registration and credential mirroring failed silently",
             "A shared provider, nonce-managed signers and a serialised queue"],
            ["The verification log was capped across the whole system",
             "One frequently checked certificate evicted every other holder\u2019s history and skewed analytics",
             "Retention is now bounded per certificate"],
            ["Only one hosting platform was recognised as having temporary storage",
             "On others the system reported data as durable while every redeploy erased it",
             "Detection extended; a mounted disk can be named explicitly"],
            ["A metadata response with no identifier was accepted as success",
             "An empty reference would be placed on the certificate and signed into it",
             "Treated as a failure, falling back to local metadata"],
            ["First-time guardian configuration emitted the wrong event",
             "The configured flag was read after being set",
             "The prior state is captured before mutation; regression test added"],
        ],
        widths=[1.8, 2.3, 2.1],
    )

    # ═══════════ CHAPTER 7 ═══════════
    h1(doc, "CHAPTER 7: CONCLUSION AND FUTURE SCOPE")

    doc.add_heading("7.1 Conclusion", level=2)
    body(
        doc,
        "This project set out to produce an academic certificate that a third party can "
        "verify without trusting the application presenting it, and to do so without "
        "requiring students to manage cryptographic keys. Both aims were achieved.",
    )
    body(
        doc,
        "Every certificate carries a canonical fingerprint of its own contents and a "
        "signature from the issuing university. Either can be checked offline, so "
        "verification does not depend on the blockchain being reachable. Where it is "
        "reachable, the certificate is additionally minted as a soulbound token that cannot "
        "be transferred, approved or sold, and a relayer ensures the on-chain issuer is the "
        "same address that produced the signature.",
    )
    body(
        doc,
        "Key loss, the obstacle that has kept comparable systems out of practical use, is "
        "addressed through institutional social recovery. The holder retains an exclusive "
        "right of cancellation throughout a twenty-four hour delay, and migration preserves "
        "the address history so that existing certificates continue to verify.",
    )
    body(
        doc,
        "A principle applied throughout is that the system reports what is actually true "
        "rather than presenting confidence it does not have. That principle located several "
        "real defects during development, including one that had rendered the entire on-chain "
        "component inert while the interface reported success.",
    )

    doc.add_heading("7.2 Limitations", level=2)
    bullets(
        doc,
        [
            "Accreditation is out of scope. Any party can register as a university in the current system; real deployment would require an accrediting authority.",
            "The server retains a copy of each university\u2019s key so certificates can be signed at the moment of issuance. This is a deliberate usability trade-off, mitigated by allowing any holder to export their own key.",
            "A certificate can only be issued to a student who has already registered.",
            "Records are written as whole collections, so two simultaneous writers to one collection could in principle overwrite one another. Token numbering is exempt, using an atomic increment.",
            "Rate limiting applies per server instance, which raises the cost of an automated attack without being an absolute guarantee.",
            "The system has been validated on a local chain and a test network, not in production use with real students.",
        ],
    )

    doc.add_heading("7.3 Future Enhancements", level=2)
    doc.add_heading("7.3.1 Selective Disclosure", level=3)
    body(
        doc,
        "Zero-knowledge proofs would let a holder prove a property of a certificate, such as "
        "holding a degree above a given classification, without disclosing the certificate "
        "itself. This would extend the existing anonymised share link from hiding identity to "
        "hiding content.",
    )
    doc.add_heading("7.3.2 Issuer Accreditation", level=3)
    body(
        doc,
        "An accreditation layer deciding which institutions may issue would close the gap "
        "identified in the literature [2]. On-chain identity frameworks are one route to "
        "this.",
    )
    doc.add_heading("7.3.3 Batch Minting", level=3)
    body(
        doc,
        "Issuing an entire cohort in a single transaction would reduce the gas cost of bulk "
        "issuance substantially, which matters at the scale of a graduating year group.",
    )
    doc.add_heading("7.3.4 Usability Evaluation", level=3)
    body(
        doc,
        "A study with student participants, measuring the system against an established "
        "wallet benchmark, would provide evidence for the usability claims made for "
        "institutional recovery.",
    )
    doc.add_heading("7.3.5 Storage and Rate Limiting", level=3)
    body(
        doc,
        "Writing records individually rather than as whole collections would remove the "
        "residual risk of concurrent overwrites, and a shared rate limiter would make the "
        "current protection a guarantee across a scaled deployment.",
    )

    # ═══════════ REFERENCES ═══════════
    h1(doc, "REFERENCES")
    references = [
        "Silaghi, D. L. and Popescu, D. E. (2025). A Systematic Review of Blockchain-Based "
        "Initiatives in Comparison to Best Practices Used in Higher Education Institutions. "
        "Computers, 14(4), 141.",

        "Frutuoso, G., Rodrigues, D., Francisco, A. P. and Vaz, C. (2026). Identity-Bound "
        "Academic Credentials on Blockchain: On-Chain Issuer Accreditation with ERC-3643 and "
        "OnchainID. arXiv preprint arXiv:2607.16383.",

        "Farabi, A., Khandaker, I., Ahsan, J., Shanto, I. K., Jahan, N. and Khan, M. J. "
        "(2025). ShikkhaChain: A Blockchain-Powered Academic Credential Verification System "
        "for Bangladesh. arXiv preprint arXiv:2508.05334.",

        "Chatzigiannis, P., Chalkias, K., Kate, A., Mangipudi, E. V., Minaei, M. and Mondal, "
        "M. (2023). SoK: Web3 Recovery Mechanisms. Cryptology ePrint Archive, Report "
        "2023/1575.",

        "Mazzocca, C., Acar, A., Uluagac, S., Montanari, R., Bellavista, P. and Conti, M. "
        "(2025). A Survey on Decentralized Identifiers and Verifiable Credentials. arXiv "
        "preprint arXiv:2402.02455.",

        "Schumm, D., M\u00fcller, K. O. E. and Stiller, B. (2025). Are We There Yet? A Study "
        "of Decentralized Identity Applications. arXiv preprint arXiv:2503.15964.",

        "World Wide Web Consortium (2025). Verifiable Credentials Data Model v2.0. W3C "
        "Recommendation.",

        "Entriken, W., Shirley, D., Evans, J. and Sachs, N. (2018). ERC-721: Non-Fungible "
        "Token Standard. Ethereum Improvement Proposals.",

        "Pandurov, T. et al. (2022). ERC-5192: Minimal Soulbound NFTs. Ethereum Improvement "
        "Proposals.",

        "Buterin, V. (2016). ERC-191: Signed Data Standard. Ethereum Improvement Proposals.",

        "OpenZeppelin (2024). OpenZeppelin Contracts v5 Documentation.",

        "Dworkin, M. (2007). Recommendation for Block Cipher Modes of Operation: "
        "Galois/Counter Mode and GMAC. NIST Special Publication 800-38D.",

        "Kaliski, B. (2000). PKCS #5: Password-Based Cryptography Specification Version 2.0. "
        "RFC 2898.",

        "Nomic Foundation (2024). Hardhat Development Environment Documentation.",
    ]
    for i, reference in enumerate(references, start=1):
        paragraph = doc.add_paragraph(f"[{i}]  {reference}")
        paragraph.paragraph_format.left_indent = Inches(0.45)
        paragraph.paragraph_format.first_line_indent = Inches(-0.45)
        paragraph.paragraph_format.space_after = Pt(7)
        paragraph.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

    build_appendices(doc)


def build_appendices(doc):
    # ═══════════ APPENDIX A ═══════════
    h1(doc, "APPENDIX A: SOURCE CODE")
    body(
        doc,
        "The listings in this appendix are taken directly from the project source. The "
        "complete code is available in the accompanying repository.",
    )

    doc.add_heading("A.1 Issuance Pipeline", level=2)
    body(
        doc,
        "The pipeline resolves the student, stores metadata, allocates a token number, signs "
        "the certificate and mints it. Only the signing step is mandatory; the others degrade "
        "and are reported rather than failing the issuance.",
    )
    source(doc, "Validating an issuance request", "frontend/src/lib/issuance.ts", "export function validateIssuance")

    doc.add_heading("A.2 Verification Response", level=2)
    body(
        doc,
        "Verification assembles the outcome, the three integrity results, the anchoring state "
        "and the prior verification count into a single response. Where the certificate is "
        "anchored, the on-chain record is read and compared rather than assumed to agree.",
    )
    source(doc, "Assembling the verification response",
           "frontend/src/lib/verification.ts", "export async function buildVerification", size=8.0, max_lines=80)

    doc.add_heading("A.3 Wallet Key Custody", level=2)
    body(
        doc,
        "Each wallet key is sealed twice. The password-derived key uses a per-user salt so "
        "that two users choosing the same password do not produce the same encryption key.",
    )
    source(doc, "Sealing a secret with AES-256-GCM", "frontend/src/lib/crypto.ts", "function seal(")

    doc.add_heading("A.4 Recovery Migration", level=2)
    body(
        doc,
        "Completing a recovery records the migration without rewriting the certificates. The "
        "previous address is retained and the server-side key copy is cleared, because the "
        "account’s new wallet is one only the holder controls.",
    )
    source(doc, "Recording a completed wallet migration",
           "frontend/src/lib/stores.ts", "export async function migrateUserWallet")

    # ═══════════ APPENDIX B ═══════════
    h1(doc, "APPENDIX B: SYSTEM MODULES AND API REFERENCE")

    doc.add_heading("B.1 Public Endpoints", level=2)
    add_table(
        doc,
        "Public endpoints, requiring no authentication",
        ["Method", "Endpoint", "Purpose"],
        [
            ["GET", "/api/verify/:id", "Verify a certificate and record the check"],
            ["GET", "/api/verify/share/:token", "Resolve a share link"],
            ["GET", "/api/profile/:address", "Public credential profile for a wallet"],
            ["GET", "/api/credentials/:id/vc", "Download the W3C Verifiable Credential"],
            ["GET", "/api/system/status", "Storage, metadata and chain health"],
        ],
        widths=[0.8, 2.4, 3.0],
    )

    doc.add_heading("B.2 Authenticated Endpoints", level=2)
    add_table(
        doc,
        "Authenticated endpoints and the roles permitted to call them",
        ["Method", "Endpoint", "Role", "Purpose"],
        [
            ["POST", "/api/auth/register", "Any", "Create an account and wallet"],
            ["POST", "/api/auth/login", "Any", "Sign in"],
            ["GET", "/api/auth/me", "Any", "Validate the session"],
            ["POST", "/api/auth/password", "Any", "Change password and re-seal the wallet"],
            ["POST", "/api/auth/wallet-export", "Any", "Reveal the wallet key once"],
            ["POST", "/api/credentials/issue", "University", "Issue one certificate"],
            ["POST", "/api/credentials/bulk", "University", "Issue from a CSV file"],
            ["POST", "/api/credentials/:id/revoke", "University", "Withdraw with a reason"],
            ["GET", "/api/credentials/issuer/:address", "University", "Certificates issued"],
            ["GET", "/api/analytics/issuer", "University", "Issuance and verification analytics"],
            ["GET", "/api/credentials/student/:address", "Holder", "Own certificates"],
            ["GET", "/api/credentials/:id/verifications", "Holder or issuer", "Verification history"],
            ["GET, POST", "/api/share", "Holder", "List or create share links"],
            ["DELETE", "/api/share/:token", "Holder", "Revoke a share link"],
            ["GET, POST", "/api/recovery/setup", "Holder", "Read or configure guardians"],
            ["GET", "/api/recovery/requests", "Holder or guardian", "Relevant recovery requests"],
            ["POST", "/api/recovery/requests", "Guardian", "Open a recovery request"],
            ["POST", "/api/recovery/requests/:id/approve", "Guardian", "Approve a request"],
            ["POST", "/api/recovery/requests/:id/execute", "Guardian or holder", "Complete the migration"],
            ["POST", "/api/recovery/requests/:id/cancel", "Holder", "Cancel a request"],
        ],
        widths=[0.9, 2.4, 1.3, 1.6],
    )

    doc.add_heading("B.3 Smart Contracts", level=2)
    add_table(
        doc,
        "Deployed smart contracts and their responsibilities",
        ["Contract", "Responsibility", "Key properties"],
        [
            ["SoulboundCertificate",
             "Mints and withdraws certificates as ERC-721 tokens",
             "ERC-5192 compliant; transfer and approval revert; only authorised issuers may mint; only the original issuer may withdraw"],
            ["CredentialRegistry",
             "Records issuer identity and certificate metadata",
             "Owner-controlled issuer registration; certificates indexed by holder and by issuer"],
            ["RecoveryManager",
             "Guardian sets and the recovery lifecycle",
             "Two to ten guardians; threshold of at least two; 24-hour cooldown; 7-day expiry; holder may cancel; migration chain resolvable"],
        ],
        widths=[1.5, 2.0, 2.7],
    )

    # ═══════════ APPENDIX C ═══════════
    h1(doc, "APPENDIX C: VERIFICATION AND RECOVERY METHODOLOGY")

    doc.add_heading("C.1 Fields Covered by the Signature", level=2)
    add_table(
        doc,
        "Fields included in and excluded from the signed fingerprint",
        ["Included", "Excluded", "Reason for exclusion"],
        [
            ["Token number", "Withdrawal status", "A withdrawn certificate would otherwise report as tampered"],
            ["Holder address and name", "Transaction hash", "Assigned after signing"],
            ["Holder email address", "Anchoring state", "Evaluated separately against the chain"],
            ["Issuer address and institution", "Issuer email address", "Not shown to a verifier"],
            ["Degree type, subject, grade", "Verification count", "Changes on every check"],
            ["Completion date, metadata reference, issuance time", "—", "—"],
        ],
        widths=[2.1, 1.8, 2.3],
    )

    doc.add_heading("C.2 Verification Outcomes", level=2)
    body(
        doc,
        "The three checks are combined into one answer. Tampering is evaluated first, so a "
        "certificate that has been altered is reported as such even if it has also been "
        "withdrawn. A certificate issued before the signing scheme existed is reported as "
        "unsigned rather than as tampered, because there is nothing to compare it against.",
    )

    doc.add_heading("C.3 Recovery Timing Constants", level=2)
    add_table(
        doc,
        "Timing constants used by the recovery lifecycle",
        ["Constant", "Value", "Enforced by", "Purpose"],
        [
            ["Cooldown", "24 hours", "Contract and application", "The window in which the holder may cancel"],
            ["Expiry", "7 days", "Contract and application", "A request nobody completes lapses"],
            ["Minimum guardians", "2", "Contract and application", "No single guardian can act alone"],
            ["Maximum guardians", "5 (10 on chain)", "Application (contract)", "Keeps the set manageable"],
            ["Minimum threshold", "2", "Contract and application", "At least two must agree"],
        ],
        widths=[1.3, 1.2, 1.7, 2.0],
    )

    doc.add_heading("C.4 Address History After Migration", level=2)
    body(
        doc,
        "A completed migration moves the account to the new address and retains the previous "
        "one. Certificate lookups, public profiles and share links all resolve across the "
        "whole history, so a link issued before the migration continues to work. The "
        "server-side copy of the key is cleared, because the new wallet is one the holder "
        "controls and the backend must not claim it can sign for it. Wallet export afterwards "
        "returns the key to the original wallet, which is the one holding the already-minted "
        "certificates.",
    )

    # ═══════════ APPENDIX D ═══════════
    h1(doc, "APPENDIX D: TESTING AND VALIDATION")

    doc.add_heading("D.1 Functional Testing", level=2)
    body(
        doc,
        "Functional testing exercises every endpoint against a real store, covering account "
        "creation, sign-in, session expiry, rate limiting, issuance, bulk issuance, "
        "withdrawal, verification, share links, credential export, the public profile, the "
        "verification log, analytics and the complete recovery lifecycle. Authorisation is "
        "tested negatively throughout.",
    )

    doc.add_heading("D.2 Smart Contract Testing", level=2)
    body(
        doc,
        "Contract testing covers issuer authorisation, minting, withdrawal, soulbound "
        "enforcement including both transfer overloads and the approval functions, the "
        "ERC-5192 interface declaration, the registry, and the full recovery lifecycle "
        "including expiry and cancellation.",
    )

    doc.add_heading("D.3 Fuzz and Invariant Testing", level=2)
    body(
        doc,
        "Fuzz runs use a seeded generator so that a failure is reproducible. Invariants "
        "assert properties that must hold regardless of operation order, including the "
        "consistency of token lists with total supply, the immutability of a "
        "certificate’s core fields across withdrawal, the monotonic and bounded growth "
        "of approval counts, and the resolution of a chain of migrated addresses to its final "
        "destination.",
    )

    doc.add_heading("D.4 End-to-End Testing", level=2)
    body(
        doc,
        "The end-to-end run drives the live application over HTTP and reads the contracts "
        "back to confirm the reported state. It was this run that exposed the nonce collision "
        "between consecutive relayer transactions, which no unit test had detected because "
        "the failure only appears when several transactions are sent in sequence from one "
        "wallet.",
    )

    doc.add_heading("D.5 Testing Limitations", level=2)
    body(
        doc,
        "Testing was carried out on a local development chain and a test network. Metadata "
        "pinning was exercised against a protocol-compatible local endpoint rather than the "
        "live service. No timing, throughput or gas-cost figures are claimed in this report, "
        "because they were not measured under controlled conditions.",
    )

    # ═══════════ APPENDIX E ═══════════
    h1(doc, "APPENDIX E: ABBREVIATIONS")
    add_table(
        doc,
        "Abbreviations used in this report",
        ["Abbreviation", "Full form"],
        [
            ["AES-GCM", "Advanced Encryption Standard, Galois/Counter Mode"],
            ["API", "Application Programming Interface"],
            ["CSV", "Comma-Separated Values"],
            ["EIP", "Ethereum Improvement Proposal"],
            ["ERC", "Ethereum Request for Comments"],
            ["IPFS", "InterPlanetary File System"],
            ["JSON", "JavaScript Object Notation"],
            ["JWT", "JSON Web Token"],
            ["NFT", "Non-Fungible Token"],
            ["PBKDF2", "Password-Based Key Derivation Function 2"],
            ["RPC", "Remote Procedure Call"],
            ["SBT", "Soulbound Token"],
            ["SSI", "Self-Sovereign Identity"],
            ["UUID", "Universally Unique Identifier"],
            ["VC", "Verifiable Credential"],
        ],
        widths=[1.6, 4.6],
    )


if __name__ == "__main__":
    build()
