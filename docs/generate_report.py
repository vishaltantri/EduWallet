#!/usr/bin/env python3
"""
Generate the final EduWallet project report as a .docx file.

Run from the project root with the virtualenv that has python-docx:

    .venv/bin/python docs/generate_report.py

Figures are read from docs/screenshots/, which is produced by
frontend/tests/e2e/capture-docs.mjs against a running, chain-connected
instance, so every figure in the report is the real application.
"""

from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor
from lxml import etree

ROOT = Path(__file__).resolve().parent.parent
SHOTS = ROOT / "docs" / "screenshots"
OUT = ROOT / "EduWallet_Final_Project_Report.docx"

ACCENT = "1E3A5F"
BAND = "F0F4F8"

figure_number = 0
table_number = 0
figures = []
tables = []


# ─── Helpers ────────────────────────────────────────────────────────────────

def shade(cell, color_hex):
    shading = etree.SubElement(cell._tc.get_or_add_tcPr(), qn("w:shd"))
    shading.set(qn("w:fill"), color_hex)
    shading.set(qn("w:val"), "clear")


def add_table(doc, caption, headers, rows, widths=None):
    global table_number
    table_number += 1
    tables.append(f"Table {table_number}: {caption}")

    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = "Table Grid"

    for i, header in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.text = str(header)
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.bold = True
                run.font.size = Pt(9.5)
                run.font.color.rgb = RGBColor(255, 255, 255)
        shade(cell, ACCENT)

    for r, row in enumerate(rows):
        for c, value in enumerate(row):
            cell = table.rows[r + 1].cells[c]
            cell.text = str(value)
            for paragraph in cell.paragraphs:
                for run in paragraph.runs:
                    run.font.size = Pt(9)
            if r % 2 == 0:
                shade(cell, BAND)

    if widths:
        for row in table.rows:
            for i, width in enumerate(widths):
                row.cells[i].width = Inches(width)

    caption_paragraph = doc.add_paragraph()
    caption_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = caption_paragraph.add_run(f"Table {table_number}: {caption}")
    run.italic = True
    run.font.size = Pt(9)
    doc.add_paragraph()
    return table


def add_figure(doc, filename, caption, width=6.0):
    global figure_number
    path = SHOTS / filename
    if not path.exists():
        print(f"  ! missing figure: {filename}")
        return

    figure_number += 1
    figures.append(f"Figure {figure_number}: {caption}")

    paragraph = doc.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph.add_run().add_picture(str(path), width=Inches(width))

    caption_paragraph = doc.add_paragraph()
    caption_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = caption_paragraph.add_run(f"Figure {figure_number}: {caption}")
    run.italic = True
    run.font.size = Pt(9)
    doc.add_paragraph()


def body(doc, text):
    paragraph = doc.add_paragraph(text)
    paragraph.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    return paragraph


def bullets(doc, items):
    for item in items:
        doc.add_paragraph(str(item), style="List Bullet")


def numbered(doc, items):
    for item in items:
        doc.add_paragraph(str(item), style="List Number")


def code(doc, text):
    paragraph = doc.add_paragraph()
    run = paragraph.add_run(text)
    run.font.name = "Consolas"
    run.font.size = Pt(9)
    paragraph.paragraph_format.left_indent = Inches(0.3)
    paragraph.paragraph_format.space_after = Pt(10)
    return paragraph


def page_break(doc):
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


def h1(doc, text):
    page_break(doc)
    doc.add_heading(text, level=1)


# ─── Document ───────────────────────────────────────────────────────────────

def build():
    doc = Document()

    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(11)
    normal.paragraph_format.space_after = Pt(8)

    # ── Title page ──
    for _ in range(4):
        doc.add_paragraph()

    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title.add_run("EduWallet")
    run.bold = True
    run.font.size = Pt(40)
    run.font.color.rgb = RGBColor(0x1E, 0x3A, 0x5F)

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = subtitle.add_run(
        "A Blockchain-Based Academic Credential System with\n"
        "Cryptographic Verification and Institutional Social Recovery"
    )
    run.font.size = Pt(15)

    doc.add_paragraph()
    kind = doc.add_paragraph()
    kind.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = kind.add_run("Final Project Report")
    run.bold = True
    run.font.size = Pt(14)

    for _ in range(6):
        doc.add_paragraph()

    for line in [
        "Submitted by: ____________________________",
        "Roll number: ____________________________",
        "Programme: ____________________________",
        "Department: ____________________________",
        "Institution: ____________________________",
        "Supervisor: ____________________________",
        "",
        date.today().strftime("%d %B %Y"),
    ]:
        paragraph = doc.add_paragraph()
        paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = paragraph.add_run(line)
        run.font.size = Pt(11.5)

    # ── Declaration ──
    h1(doc, "Declaration")
    body(
        doc,
        "I declare that this report and the work it describes are my own, carried out "
        "under the guidance of my supervisor. Material taken from other sources is "
        "acknowledged in the text and listed in the references. This work has not been "
        "submitted for any other degree or qualification.",
    )
    doc.add_paragraph()
    doc.add_paragraph()
    doc.add_paragraph("Signature: ____________________________")
    doc.add_paragraph("Name: ____________________________")
    doc.add_paragraph("Date: ____________________________")

    # ── Abstract ──
    h1(doc, "Abstract")
    body(
        doc,
        "A paper academic certificate can be reproduced with a photocopier, and verifying "
        "one requires contacting the issuing registrar and waiting days for a reply. "
        "Digitising the certificate into a central database solves the delay but not the "
        "trust problem: the verifier must now trust whoever operates that database.",
    )
    body(
        doc,
        "This project presents EduWallet, a system in which every academic certificate "
        "carries two guarantees that a verifier can check without trusting the application "
        "that serves it. The facts of the certificate are reduced to a canonical, "
        "field-ordered serialisation and committed with a keccak256 hash, and the issuing "
        "institution's wallet signs that hash under EIP-191. A verifier recovers the signing "
        "address from the signature and compares it with the institution's published "
        "address. Both checks hold offline, so verification does not depend on a blockchain "
        "connection being available at the moment of checking.",
    )
    body(
        doc,
        "Where a Polygon endpoint is reachable, the certificate is additionally minted as a "
        "soulbound ERC-721 token conforming to ERC-5192, permanently bound to the holder and "
        "incapable of transfer, approval or sale. A server-side relayer authorises each "
        "institution on the certificate contract at its first issuance and funds its gas, so "
        "the institution's own wallet signs the mint and the on-chain issuer matches the "
        "signer of the content hash.",
    )
    body(
        doc,
        "The system addresses the principal usability obstacle to blockchain credentials for "
        "non-technical holders, namely key loss, through institutional social recovery. A "
        "holder nominates between two and five institutions as guardians and sets a "
        "threshold. A guardian may open a recovery request naming a new wallet address; the "
        "remaining guardians approve until the threshold is met; a twenty-four hour delay "
        "then runs during which only the holder can cancel. The migration preserves the "
        "holder's address history, so certificates signed over the original address continue "
        "to verify rather than being orphaned.",
    )
    body(
        doc,
        "The implementation was validated by 77 smart-contract tests including fuzz and "
        "invariant suites, 179 application tests including a 65-test integration layer "
        "exercising the real API against a persistent store, and a 20-step end-to-end check "
        "driving a running instance against a live chain. All pass.",
    )
    doc.add_paragraph()
    keywords = doc.add_paragraph()
    run = keywords.add_run("Keywords: ")
    run.bold = True
    keywords.add_run(
        "blockchain, academic credentials, soulbound tokens, ERC-5192, digital signatures, "
        "EIP-191, social recovery, Polygon, verifiable credentials, key management"
    )

    # ── Contents ──
    h1(doc, "Table of Contents")
    contents = [
        "1. Introduction",
        "    1.1 Problem statement",
        "    1.2 Motivation",
        "    1.3 Objectives",
        "    1.4 Scope and limitations",
        "2. Background and Related Work",
        "    2.1 Existing approaches",
        "    2.2 The key-loss problem",
        "    2.3 Research gap",
        "3. System Analysis",
        "    3.1 Stakeholders",
        "    3.2 Functional requirements",
        "    3.3 Non-functional requirements",
        "4. System Design",
        "    4.1 Architecture",
        "    4.2 The onchain and offchain boundary",
        "    4.3 Smart contract design",
        "    4.4 Data model",
        "    4.5 The verification model",
        "5. Implementation",
        "    5.1 Technology stack",
        "    5.2 Canonical hashing and issuer signatures",
        "    5.3 The issuance pipeline",
        "    5.4 The platform relayer",
        "    5.5 Social recovery",
        "    5.6 Key custody and storage",
        "6. Results",
        "    6.1 Account creation",
        "    6.2 Issuance",
        "    6.3 Credential management",
        "    6.4 The holder's wallet",
        "    6.5 Verification",
        "    6.6 Social recovery",
        "    6.7 Responsive behaviour",
        "7. Testing and Validation",
        "    7.1 Strategy",
        "    7.2 Smart contract testing",
        "    7.3 Application testing",
        "    7.4 End-to-end testing",
        "    7.5 Defects found and resolved",
        "8. Security Analysis",
        "9. Deployment",
        "10. Conclusion and Future Work",
        "11. References",
        "Appendix A: API reference",
        "Appendix B: Repository structure",
    ]
    for line in contents:
        paragraph = doc.add_paragraph(line)
        paragraph.paragraph_format.space_after = Pt(2)

    placeholder_figures = doc.add_paragraph()
    placeholder_tables = doc.add_paragraph()

    # ═══ 1. Introduction ═══
    h1(doc, "1. Introduction")

    doc.add_heading("1.1 Problem statement", level=2)
    body(
        doc,
        "Academic credentials are high-value documents verified by low-trust means. A paper "
        "certificate carries no mechanism by which a third party can establish that the named "
        "institution issued it, that its contents have not been altered since issuance, or "
        "that it has not subsequently been withdrawn. Verification therefore falls back on "
        "contacting the issuing registrar, a process measured in days and dependent on that "
        "registrar's continued existence and record-keeping.",
    )
    body(
        doc,
        "Digitisation alone does not resolve this. A scanned certificate in a database "
        "transfers the trust requirement from the paper to the database operator. The "
        "verifier gains speed and loses independence: they can now check quickly, but only by "
        "believing whoever runs the system.",
    )

    doc.add_heading("1.2 Motivation", level=2)
    body(
        doc,
        "A credential system is only useful if the party doing the verifying can satisfy "
        "themselves without trusting the party serving the data. This suggests cryptographic "
        "signatures by the issuing institution, which is a solved problem in principle. In "
        "practice such systems have failed to reach the people who hold credentials, because "
        "they require the holder to manage a private key. Key loss in consumer cryptographic "
        "systems is common, and a lost key in a credential system means the holder is "
        "permanently separated from their own qualifications.",
    )

    doc.add_heading("1.3 Objectives", level=2)
    numbered(
        doc,
        [
            "Design a credential representation that a verifier can check without trusting "
            "the serving application, and without requiring a blockchain connection at the "
            "moment of verification.",
            "Implement non-transferable onchain certificates so that a credential cannot be "
            "sold, gifted or traded.",
            "Remove key management from the holder's responsibility without making the system "
            "custodial in a way that traps them.",
            "Provide a recovery path for a lost wallet that does not rely on a support desk "
            "and cannot be abused by the parties operating it.",
            "Ensure the system degrades honestly, reporting reduced capability rather than "
            "presenting a confident interface over an unavailable dependency.",
            "Validate the implementation with automated tests at the contract, application "
            "and end-to-end levels.",
        ],
    )

    doc.add_heading("1.4 Scope and limitations", level=2)
    body(
        doc,
        "The system covers issuance by an institution, custody and sharing by a holder, and "
        "verification by an unauthenticated third party, together with revocation, analytics "
        "and social recovery. It is deployed against the Polygon Amoy test network. The "
        "project does not address institutional onboarding governance, that is, who decides "
        "which institutions are legitimate, which in a production deployment would require "
        "an accreditation authority. It also does not implement selective disclosure of "
        "individual credential fields through zero-knowledge proofs, which is identified as "
        "future work.",
    )

    # ═══ 2. Background ═══
    h1(doc, "2. Background and Related Work")

    doc.add_heading("2.1 Existing approaches", level=2)
    add_table(
        doc,
        "Comparison of credential verification approaches",
        ["Approach", "Verification", "Trust required", "Weakness"],
        [
            ["Paper certificate", "Contact registrar", "The registrar", "Forgeable; days to verify"],
            ["Central database", "Query a portal", "The operator", "Operator can alter or lose records"],
            ["PDF with digital signature", "Check the signature", "A certificate authority", "No revocation visibility; key distribution"],
            ["Blockchain record only", "Read the chain", "The chain", "Fails when the endpoint is unreachable"],
            ["EduWallet", "Signature, hash and chain", "The institution's key alone", "Requires institutional key custody"],
        ],
        widths=[1.4, 1.4, 1.4, 2.0],
    )

    doc.add_heading("2.2 The key-loss problem", level=2)
    body(
        doc,
        "Self-custodied cryptographic identity places the entire burden of key management on "
        "the holder. For a wallet holding currency this is a recognised trade-off. For a "
        "wallet holding a degree it is unreasonable: the holder did not choose to become a "
        "key custodian, gains nothing from the responsibility, and faces permanent loss of "
        "access to their own academic record if they fail at it.",
    )
    body(
        doc,
        "Social recovery addresses this by distributing the authority to reassign an account "
        "across several parties. Existing consumer implementations nominate friends and "
        "family as guardians. In an academic setting a better class of guardian is already "
        "present and already trusted by the holder for exactly this purpose: the issuing "
        "institutions themselves.",
    )

    doc.add_heading("2.3 Research gap", level=2)
    body(
        doc,
        "Social recovery is established in cryptocurrency wallets and academic credentials "
        "are established on blockchains, but the two have not been combined. This project "
        "applies institutional social recovery to academic credential custody, with the "
        "specific property that a recovery preserves the holder's address history so that "
        "credentials signed over a prior address remain verifiable after migration.",
    )

    # ═══ 3. System Analysis ═══
    h1(doc, "3. System Analysis")

    doc.add_heading("3.1 Stakeholders", level=2)
    add_table(
        doc,
        "Stakeholders and their requirements",
        ["Stakeholder", "Authenticated", "Primary task", "Interaction pattern"],
        [
            ["Institution registrar", "Yes", "Issue and revoke certificates", "Long sessions, high volume, at a desk"],
            ["Student or graduate", "Yes", "Hold and share credentials", "Short, occasional, frequently mobile"],
            ["Verifier, typically an employer", "No", "Establish whether one credential is genuine", "A single visit, under a minute"],
            ["Guardian institution", "Yes", "Approve a holder's account recovery", "Rare, consequential"],
        ],
        widths=[1.5, 0.9, 1.9, 1.9],
    )

    doc.add_heading("3.2 Functional requirements", level=2)
    add_table(
        doc,
        "Functional requirements",
        ["ID", "Requirement", "Status"],
        [
            ["FR1", "An institution can register and receive a signing wallet", "Implemented"],
            ["FR2", "An institution can issue a signed certificate to a registered holder", "Implemented"],
            ["FR3", "An institution can issue a cohort from a CSV with prior validation", "Implemented"],
            ["FR4", "An institution can revoke a certificate with a stated reason", "Implemented"],
            ["FR5", "A certificate is minted as a non-transferable onchain token", "Implemented"],
            ["FR6", "A holder can view and search their credentials", "Implemented"],
            ["FR7", "A holder can create expiring, optionally anonymised share links", "Implemented"],
            ["FR8", "A holder can export their credential in a portable standard format", "Implemented"],
            ["FR9", "A verifier can check a credential with no account", "Implemented"],
            ["FR10", "Verification reports signature, integrity and revocation separately", "Implemented"],
            ["FR11", "A holder can nominate guardians and set an approval threshold", "Implemented"],
            ["FR12", "Guardians can open, approve and complete a recovery", "Implemented"],
            ["FR13", "A holder can cancel a recovery during the safety delay", "Implemented"],
            ["FR14", "A holder can export their wallet key and change their password", "Implemented"],
            ["FR15", "An institution can view issuance and verification analytics", "Implemented"],
        ],
        widths=[0.6, 4.1, 1.5],
    )

    doc.add_heading("3.3 Non-functional requirements", level=2)
    add_table(
        doc,
        "Non-functional requirements",
        ["ID", "Requirement", "How it is met"],
        [
            ["NFR1", "Verification must not require a chain connection", "Signature and hash checks are offline"],
            ["NFR2", "The system must report degraded capability honestly", "A status endpoint and UI indicators reflect real dependency state"],
            ["NFR3", "Key material must never reach the browser or logs", "Serialised user objects exclude all key fields; export is a single explicit action"],
            ["NFR4", "Authorisation must be enforced server-side", "Every route checks ownership or role before responding"],
            ["NFR5", "Concurrent issuance must not produce duplicate token IDs", "Allocation uses an atomic increment in the shared store"],
            ["NFR6", "A chain or pinning failure must not fail an issuance", "Both steps are soft; only signing is mandatory"],
        ],
        widths=[0.6, 2.3, 3.3],
    )

    # ═══ 4. System Design ═══
    h1(doc, "4. System Design")

    doc.add_heading("4.1 Architecture", level=2)
    body(
        doc,
        "The system is organised in three tiers. A Next.js application serves both the user "
        "interface and the API as route handlers in the same process. A storage adapter "
        "selects a backend at runtime. Three Solidity contracts on Polygon hold the "
        "settlement state.",
    )
    code(
        doc,
        "Browser (React)\n"
        "    |  fetch, bearer token\n"
        "    v\n"
        "Next.js route handlers\n"
        "    |-- crypto.ts        password hashing, JWT, key custody\n"
        "    |-- credential.ts    canonical hashing, EIP-191 signing, W3C export\n"
        "    |-- issuance.ts      the issuance pipeline\n"
        "    |-- verification.ts  outcome resolution\n"
        "    |-- recovery*.ts     the recovery state machine and operations\n"
        "    |-- blockchain.ts    contract calls, relayer, timeouts\n"
        "    |-- db.ts            storage adapter: kv -> file -> memory\n"
        "    v                              v\n"
        "Storage backend                Polygon (Amoy)\n"
        "  Redis / disk / memory          SoulboundCertificate\n"
        "                                 CredentialRegistry\n"
        "                                 RecoveryManager",
    )

    doc.add_heading("4.2 The onchain and offchain boundary", level=2)
    body(
        doc,
        "Placing data on a blockchain is expensive and permanent, so the boundary is drawn "
        "deliberately. Ownership, settlement and proof live onchain. Application state, "
        "search, analytics and anything personal lives offchain.",
    )
    add_table(
        doc,
        "Division of state between the chain and the application",
        ["Held onchain", "Held offchain"],
        [
            ["Certificate ownership, bound to the holder", "User accounts, names and email addresses"],
            ["Issuer authorisation", "Search, filtering and analytics"],
            ["Revocation status", "Share links, labels and expiry"],
            ["Guardian sets and recovery requests", "Verification audit log"],
            ["A metadata URI", "Certificate metadata and its content hash"],
        ],
        widths=[3.1, 3.1],
    )
    body(
        doc,
        "A corollary enforced throughout the implementation is that an offchain record is "
        "never treated as evidence that an onchain operation succeeded. Transaction receipts "
        "are awaited and contract state is read back before a certificate is reported as "
        "anchored.",
    )

    doc.add_heading("4.3 Smart contract design", level=2)
    add_table(
        doc,
        "Smart contracts",
        ["Contract", "Responsibility", "Key properties"],
        [
            [
                "SoulboundCertificate",
                "Mints and revokes certificates as ERC-721 tokens",
                "ERC-5192 compliant; transfer, approve and setApprovalForAll all revert; only authorised issuers may mint; only the original issuer may revoke",
            ],
            [
                "CredentialRegistry",
                "Records issuer identity and credential metadata",
                "Owner-controlled issuer registration; credentials indexed by holder and by issuer",
            ],
            [
                "RecoveryManager",
                "Guardian sets and the recovery lifecycle",
                "Two to ten guardians; threshold of at least two; 24-hour cooldown; 7-day expiry; holder may cancel; address migration chain is resolvable",
            ],
        ],
        widths=[1.5, 2.0, 2.7],
    )
    body(
        doc,
        "Non-transferability is enforced at the lowest available point. The ERC-721 _update "
        "hook permits only minting, where the sender is the zero address, and burning, where "
        "the recipient is. Every other movement reverts. The approval functions are "
        "overridden to revert as well, which closes the route by which a token could "
        "otherwise be listed on a marketplace.",
    )

    doc.add_heading("4.4 Data model", level=2)
    add_table(
        doc,
        "Principal stored entities",
        ["Entity", "Significant fields"],
        [
            ["User", "Role, wallet address, previous wallet addresses, password hash, wallet key sealed twice, key wallet address"],
            ["Credential", "Token ID, holder and issuer addresses, academic fields, IPFS hash, credential hash, issuer signature, anchoring state, revocation"],
            ["ShareLink", "Token, credential, label, expiry, anonymisation flag, revoked flag, view count"],
            ["VerificationEvent", "Credential, timestamp, outcome, coarse origin, share token"],
            ["RecoveryConfiguration", "Holder, guardian emails and addresses, threshold"],
            ["RecoveryRequest", "Holder, source and destination addresses, threshold, approvals, status, transaction hashes"],
        ],
        widths=[1.4, 4.8],
    )

    doc.add_heading("4.5 The verification model", level=2)
    body(
        doc,
        "Verification answers three independent questions and reports each separately rather "
        "than collapsing them into a single indicator. Whether a signature exists and was "
        "produced by the issuing institution's wallet; whether recomputing the content hash "
        "reproduces the hash that was signed; and whether the institution has since withdrawn "
        "the certificate.",
    )
    add_table(
        doc,
        "Verification outcomes and their precedence",
        ["Outcome", "Signature", "Content", "Meaning"],
        [
            ["Tampered", "Fails, or content differs", "Altered", "Highest precedence; a forgery question"],
            ["Revoked", "Valid", "Intact", "Genuinely issued, later withdrawn"],
            ["Valid", "Valid", "Intact", "Genuine and in force"],
            ["Not found", "—", "—", "No such credential; usually a truncated link"],
        ],
        widths=[1.1, 1.3, 1.1, 2.7],
    )
    body(
        doc,
        "Tampering outranks revocation deliberately. A document whose contents no longer "
        "match its signature raises a question of forgery, which is materially different from "
        "an administrative withdrawal, and the more serious answer must take precedence. "
        "Conversely a revoked certificate retains and displays its valid signature, because "
        "the document genuinely was issued.",
    )

    # ═══ 5. Implementation ═══
    h1(doc, "5. Implementation")

    doc.add_heading("5.1 Technology stack", level=2)
    add_table(
        doc,
        "Technology stack",
        ["Layer", "Technology", "Rationale"],
        [
            ["Blockchain", "Polygon Amoy, Solidity 0.8.27", "Low transaction cost; EVM tooling; free test network"],
            ["Contracts", "Hardhat, OpenZeppelin v5", "Audited base implementations; mature test tooling"],
            ["Frontend", "Next.js 16, React 19, TypeScript, Tailwind CSS v4", "Server and client in one deployable unit"],
            ["Chain access", "Ethers v6", "Typed contract interfaces; nonce management"],
            ["Storage", "Upstash or Vercel KV, local files, memory", "Selected at runtime with honest reporting"],
            ["Metadata", "IPFS via Pinata", "Content-addressed, independent of the application"],
            ["Testing", "Hardhat, Vitest, Puppeteer", "Contract, application and browser levels"],
        ],
        widths=[1.1, 2.2, 2.9],
    )

    doc.add_heading("5.2 Canonical hashing and issuer signatures", level=2)
    body(
        doc,
        "A content commitment is only meaningful if the same certificate always produces the "
        "same bytes. JSON key order is not a stable contract, so the payload is constructed as "
        "an explicitly ordered sequence of key and value pairs. Addresses and email addresses "
        "are lowercased so that a re-cased copy hashes identically, and optional fields are "
        "always present so that a value cannot migrate between fields without changing the "
        "hash.",
    )
    code(
        doc,
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
        "ipfsHash=Qm...\n"
        "issuedAt=2026-10-25T09:14:02.511Z",
    )
    body(
        doc,
        "This payload is hashed with keccak256 and the resulting digest is signed by the "
        "issuing institution's wallet under EIP-191. Verification recomputes the hash from the "
        "stored record, compares it with the hash that was signed, and recovers the signing "
        "address from the signature. Altering any signed field breaks the first comparison; "
        "substituting a signature from another wallet breaks the second.",
    )
    body(
        doc,
        "Fields that a verifier evaluates separately are deliberately excluded from the "
        "hashed payload. Revocation status is one: including it would cause a legitimately "
        "revoked certificate to report as tampered.",
    )

    doc.add_heading("5.3 The issuance pipeline", level=2)
    body(
        doc,
        "Issuance proceeds in five stages. Only the fourth is mandatory; the others degrade.",
    )
    add_table(
        doc,
        "Issuance pipeline stages and failure behaviour",
        ["Stage", "Operation", "On failure"],
        [
            ["1", "Resolve and validate the holder", "Issuance is rejected with a specific reason"],
            ["2", "Pin metadata to IPFS", "Soft: a local metadata digest is recorded and a warning returned"],
            ["3", "Allocate a token ID", "Hard: allocation is an atomic increment"],
            ["4", "Hash and sign the certificate", "The certificate is marked unsigned rather than claiming a signature"],
            ["5", "Authorise, fund and mint onchain", "Soft: recorded as pending anchor; the certificate remains verifiable"],
        ],
        widths=[0.5, 2.4, 3.3],
    )

    doc.add_heading("5.4 The platform relayer", level=2)
    body(
        doc,
        "The certificate contract restricts minting to authorised issuers. Institutions "
        "receive a freshly generated wallet when they register, which is neither authorised "
        "nor funded. Without intervention every mint reverts.",
    )
    body(
        doc,
        "A server-side relayer, holding the deploying wallet's key, closes this gap. At an "
        "institution's first issuance it authorises that wallet on the certificate contract, "
        "registers it on the credential registry, and transfers enough native currency to "
        "cover gas. The institution's own wallet then signs the mint. This matters for "
        "verification: the onchain issuer must be the same address that signed the content "
        "hash, or the two cannot be checked against one another.",
    )
    body(
        doc,
        "Because onboarding sends several transactions in sequence, relayer work is "
        "serialised through a queue and signers are nonce-managed. An earlier implementation "
        "that constructed a signer per call reused nonces and silently lost the registry "
        "transactions.",
    )

    doc.add_heading("5.5 Social recovery", level=2)
    body(
        doc,
        "The recovery lifecycle is implemented both in the contract and in the application, "
        "with identical timing constants so that the interface never offers an action the "
        "contract would reject.",
    )
    add_table(
        doc,
        "The recovery lifecycle",
        ["Step", "Actor", "Effect", "Constraint"],
        [
            ["Configure", "Holder", "Guardian set and threshold recorded, and registered on the contract", "Two to five guardians; threshold at least two; cannot nominate oneself"],
            ["Initiate", "A guardian", "Request opened naming a destination address; counts as the first approval", "Only a nominated guardian; no concurrent request"],
            ["Approve", "Other guardians", "Approval recorded onchain and off", "One approval per guardian"],
            ["Wait", "Nobody", "A 24-hour delay runs", "Enforced by both the contract and the application"],
            ["Cancel", "Holder only", "Request voided", "A guardian cannot cancel"],
            ["Execute", "Guardian or holder", "Account migrates; previous address retained", "Threshold and delay both satisfied; request not lapsed"],
        ],
        widths=[0.8, 1.0, 2.2, 2.2],
    )
    body(
        doc,
        "The delay is the holder's protection against collusion among guardians, and the "
        "exclusivity of the cancellation right is what gives it force. A request that nobody "
        "completes lapses after seven days.",
    )
    body(
        doc,
        "Migration preserves history rather than rewriting records. A certificate's signature "
        "covers the address it was issued to, so that address cannot be changed without "
        "invalidating the signature. The account therefore retains its previous addresses and "
        "all lookups, including the holder's dashboard, their public profile and their share "
        "links, resolve across the whole history.",
    )

    doc.add_heading("5.6 Key custody and storage", level=2)
    body(
        doc,
        "Each wallet key is sealed twice with AES-256-GCM. One copy is encrypted under a key "
        "derived from the user's password with a per-user salt, which the server cannot open. "
        "The second is encrypted under a server master key, and is what permits the backend to "
        "sign a certificate on an institution's behalf at issuance without a registrar "
        "re-entering their password for every certificate. Passwords themselves are stored as "
        "PBKDF2-SHA512 digests over 100,000 iterations with a per-user salt.",
    )
    body(
        doc,
        "The storage adapter selects a backend at runtime: a shared key-value store when one "
        "is configured, local files otherwise, and an in-process cache as a last resort on "
        "hosts with an ephemeral filesystem. The selected mode and its durability are reported "
        "through the status endpoint and surfaced in the interface, so a deployment that "
        "cannot persist data says so rather than losing it quietly.",
    )

    # ═══ 6. Results ═══
    h1(doc, "6. Results")
    body(
        doc,
        "The figures in this chapter are captured from a running instance connected to a live "
        "chain, with data created through the application's own API. The certificates are "
        "genuinely signed, the transaction hashes are real and the verification counts are "
        "actual recorded checks.",
    )

    doc.add_heading("6.1 Account creation", level=2)
    add_figure(doc, "01-landing.png", "The landing page, with a live chain status indicator", 5.4)
    add_figure(doc, "03-register.png", "Registration begins with the role choice, which determines the remainder of the form", 5.4)
    add_figure(doc, "04-register-institution.png", "The institution form requires an institution name, which appears on every certificate issued", 5.4)

    doc.add_heading("6.2 Issuance", level=2)
    add_figure(doc, "11-institution-issue.png", "The issuing form, with institutional statistics", 5.4)
    add_figure(doc, "13-institution-bulk.png", "Bulk issuance from CSV, with a validation pass before any certificate is issued", 5.4)

    doc.add_heading("6.3 Credential management", level=2)
    add_figure(doc, "14-institution-manage.png", "Issued credentials, searchable and filterable, with verification counts", 5.4)
    add_figure(doc, "15-institution-analytics.png", "Issuance volume, credential mix and verification activity", 5.4)

    doc.add_heading("6.4 The holder's wallet", level=2)
    add_figure(doc, "18-student-dashboard.png", "The holder's credentials, share links and verification history", 5.4)
    add_figure(doc, "19-student-share-dialog.png", "Creating a scoped share link with an expiry and optional anonymisation", 5.0)

    doc.add_heading("6.5 Verification", level=2)
    add_figure(doc, "05-verify-landing.png", "The verifier's entry point, accepting a link, an identifier or a wallet address", 5.4)
    add_figure(doc, "06-verify-valid.png", "A verified certificate. The three cryptographic checks are reported separately, with the content hash and the chain anchor", 4.8)
    add_figure(doc, "07-verify-revoked.png", "A revoked certificate. The signature remains valid because the document genuinely was issued", 4.8)
    add_figure(doc, "08-verify-share-anonymised.png", "An anonymised share link proves the qualification without naming the holder", 4.8)
    add_figure(doc, "09-public-profile.png", "A public credential profile, listing only active and signature-valid credentials", 5.4)

    doc.add_heading("6.6 Social recovery", level=2)
    add_figure(doc, "20-student-recovery.png", "Guardian configuration, recorded in the application and registered on the contract", 5.4)
    add_figure(doc, "16-institution-guardianship.png", "The guardian queue. Completion remains unavailable until both the threshold and the delay are satisfied", 5.4)
    add_figure(doc, "21-student-recovery-pending.png", "The holder's view of a pending request, with the exclusive right to cancel it", 5.4)
    add_figure(doc, "22-student-wallet-export.png", "Wallet key export, requiring the password and shown once", 5.0)

    doc.add_heading("6.7 Responsive behaviour", level=2)
    add_figure(doc, "24-mobile-verify.png", "Verification at a 390 pixel viewport", 2.6)
    add_figure(doc, "25-mobile-student-dashboard.png", "The holder's dashboard at a 390 pixel viewport", 2.6)

    # ═══ 7. Testing ═══
    h1(doc, "7. Testing and Validation")

    doc.add_heading("7.1 Strategy", level=2)
    body(
        doc,
        "Testing is organised at three levels. Contract tests exercise the Solidity directly "
        "on a local chain. Application tests exercise the route handlers against a real "
        "persistent store rather than mocks, so storage, authorisation and cryptography all "
        "execute. An end-to-end check drives a running instance over HTTP against a live "
        "chain and reads the contracts back to confirm that what the application reported "
        "actually happened.",
    )
    add_table(
        doc,
        "Test suite summary",
        ["Level", "Count", "Scope", "Result"],
        [
            ["Smart contracts", "77", "Access control, state transitions, reverts, events, fuzz, invariants", "All pass"],
            ["Application unit", "89", "Hashing, signing, validation, CSV parsing, recovery state, retention, rate limiting", "All pass"],
            ["Application integration", "65", "Route handlers against a file-backed store", "All pass"],
            ["Storage and integrations", "25", "Durable key-value backend, IPFS pinning, host detection", "All pass"],
            ["End-to-end with chain", "20 steps", "Issuance, anchoring, revocation, recovery against a live chain", "All pass"],
        ],
        widths=[1.4, 0.7, 3.0, 1.1],
    )

    doc.add_heading("7.2 Smart contract testing", level=2)
    body(
        doc,
        "Beyond conventional unit tests, the contract suite includes deterministic fuzz runs "
        "and invariant checks. Fuzz runs mint to arbitrary recipients with arbitrary metadata "
        "lengths and exercise every valid combination of guardian count and threshold. "
        "Invariants assert properties that must hold regardless of operation order: that "
        "per-holder and per-issuer token lists remain consistent with total supply, that a "
        "revocation never alters a certificate's issuer, holder, metadata or issuance time, "
        "that approval counts increase monotonically and remain bounded by the guardian count, "
        "and that a chain of recovered addresses resolves to its final destination.",
    )

    doc.add_heading("7.3 Application testing", level=2)
    body(
        doc,
        "The integration layer creates accounts, issues certificates, verifies them, mints and "
        "revokes share links, performs revocations and runs complete recovery lifecycles "
        "through the real route handlers. Nothing is mocked except the host environment, which "
        "is relocated to a temporary directory so that tests cannot touch project data. "
        "Authorisation is tested negatively throughout: a holder cannot read another holder's "
        "credentials, an institution cannot revoke another institution's certificate, and a "
        "guardian cannot cancel a recovery.",
    )

    doc.add_heading("7.4 End-to-end testing", level=2)
    body(
        doc,
        "The end-to-end check confirms the onchain path by reading the contracts back rather "
        "than trusting the application's own report. It asserts that the institution wallet "
        "was authorised, that the mint transaction's receipt succeeded, that the credential "
        "was mirrored into the registry, that the token is owned by the holder and reports "
        "itself locked, that revocation is reflected in contract state, and that a complete "
        "social recovery migrates the account with the contract recording the migration.",
    )

    doc.add_heading("7.5 Defects found and resolved", level=2)
    add_table(
        doc,
        "Significant defects identified during validation",
        ["Defect", "Consequence", "Resolution"],
        [
            [
                "No code path authorised an institution to mint",
                "Every certificate reverted and was recorded as pending anchor indefinitely; the onchain path was inert",
                "A platform relayer authorises and funds each institution at first issuance",
            ],
            [
                "Relayer and issuer wallets reused nonces",
                "Registry registration and credential mirroring failed silently",
                "Shared provider, nonce-managed signers, serialised relayer queue",
            ],
            [
                "GuardiansConfigured was never emitted",
                "First-time configuration reported as an update, because the flag was read after being set",
                "The prior state is captured before mutation; regression test added",
            ],
            [
                "Verification log capped globally at 500 entries",
                "One frequently checked certificate evicted every other credential's audit trail and skewed analytics",
                "Retention bounded per credential with a global ceiling",
            ],
            [
                "Only one host was recognised as having an ephemeral filesystem",
                "On other hosts data was reported durable while every redeploy erased it",
                "Host detection extended; an explicit data directory can designate a mounted disk",
            ],
            [
                "A pinning response without a content identifier was accepted",
                "An empty IPFS reference would be placed on the certificate and hashed into its signature",
                "Treated as a failure, falling back to local metadata",
            ],
        ],
        widths=[1.7, 2.3, 2.2],
    )

    # ═══ 8. Security ═══
    h1(doc, "8. Security Analysis")
    add_table(
        doc,
        "Threats and mitigations",
        ["Threat", "Mitigation"],
        [
            ["Forging a certificate", "Requires the institution's private key; a verifier recovers the signer from the signature independently of this application"],
            ["Altering a certificate after issuance", "Any change to a signed field breaks the content hash comparison, reported as tampering"],
            ["Selling or transferring a credential", "Transfer, approval and blanket approval all revert at the contract level"],
            ["Revoking another institution's certificate", "The contract and the API both require the caller to be the original issuer"],
            ["Reading another holder's credentials", "Ownership is checked server-side on every route; hidden interface elements are not treated as access control"],
            ["Guardians colluding to seize an account", "A 24-hour delay during which only the holder can cancel, plus a threshold of at least two guardians"],
            ["Changing guardians mid-recovery", "Rejected while a request is open"],
            ["Credential stuffing", "Per-client rate limiting on authentication, registration, key export and recovery initiation"],
            ["Account enumeration", "Failed sign-in returns an identical response for an unknown address and a wrong password"],
            ["Key material disclosure", "Serialised user objects exclude all key fields; export requires the password and is returned once, uncached"],
            ["Secret exposure in logs or responses", "The status endpoint reports only a host for the RPC URL; errors avoid credential detail"],
        ],
        widths=[2.0, 4.2],
    )
    body(
        doc,
        "Two residual risks are recorded rather than resolved. Collections are written as "
        "whole arrays, so concurrent writers to the same collection can lose a record; token "
        "allocation is exempt because it uses an atomic increment. Rate limiting is per "
        "instance, which raises the cost of an automated attack without constituting a "
        "guarantee across a horizontally scaled deployment.",
    )

    # ═══ 9. Deployment ═══
    h1(doc, "9. Deployment")
    body(
        doc,
        "The application starts and verifies certificates with no configuration. Two settings "
        "determine what else is available.",
    )
    add_table(
        doc,
        "Deployment configuration",
        ["Variable", "Purpose", "If absent"],
        [
            ["PLATFORM_PRIVATE_KEY", "The deploying wallet's key, used to authorise and fund institutions", "No certificate is anchored; the interface reports read-only"],
            ["KV_REST_API_URL and token", "A shared durable store", "Falls back to the filesystem"],
            ["DATA_DIR", "A mounted persistent disk, as an alternative to the shared store", "On an ephemeral host, data is lost on restart and the interface warns"],
            ["JWT_SECRET", "Signs session tokens", "A development default is used"],
            ["WALLET_MASTER_KEY", "Encrypts the server-held wallet copies", "Derived from JWT_SECRET; rotating it prevents issuance until users sign in again"],
            ["PINATA_JWT", "IPFS pinning", "Metadata is stored locally; verification is unaffected"],
            ["NEXT_PUBLIC_RPC_URL and contract addresses", "Chain access", "The application runs offchain"],
        ],
        widths=[1.8, 2.2, 2.2],
    )
    code(
        doc,
        "# Contracts\n"
        "cd contracts && npm install\n"
        "npx hardhat compile\n"
        "npx hardhat test\n"
        "npx hardhat run scripts/deploy.js --network polygonAmoy\n"
        "\n"
        "# Application\n"
        "cd frontend && npm install\n"
        "cp .env.example .env.local      # then fill it in\n"
        "npm run dev                     # or: npm run build && npm start\n"
        "\n"
        "# Tests\n"
        "cd frontend  && npm test\n"
        "cd contracts && npx hardhat test",
    )
    body(
        doc,
        "Values beginning with NEXT_PUBLIC_ are embedded during the build, so on a hosted "
        "platform they must be present when the build runs and not only at runtime. The "
        "endpoint /api/system/status reports the storage mode, whether the relayer is "
        "configured, and whether each contract responds, and is suitable as a health check.",
    )

    # ═══ 10. Conclusion ═══
    h1(doc, "10. Conclusion and Future Work")
    body(
        doc,
        "This project delivers a working academic credential system whose central property is "
        "that a verifier need not trust the application serving the credential. A certificate "
        "is committed with a canonical content hash and signed by the issuing institution's "
        "wallet, so both the integrity of its contents and the identity of its issuer can be "
        "established independently and offline. Where a chain is reachable, the certificate is "
        "additionally minted as a non-transferable token, and a relayer ensures the onchain "
        "issuer is the same address that produced the signature.",
    )
    body(
        doc,
        "The system addresses key loss, the principal obstacle to credential wallets for "
        "non-technical holders, through institutional social recovery, with a design in which "
        "the holder retains an exclusive veto for the duration of a safety delay and in which "
        "migration preserves rather than rewrites the credential record. A consistent "
        "principle throughout is that the interface reports reduced capability honestly rather "
        "than presenting confidence it does not have.",
    )
    body(
        doc,
        "All objectives stated in section 1.3 were met, and the implementation is validated by "
        "77 contract tests, 179 application tests and a 20-step end-to-end check against a "
        "live chain.",
    )
    doc.add_heading("Future work", level=2)
    bullets(
        doc,
        [
            "Selective disclosure through zero-knowledge proofs, so a holder can prove a "
            "property of a credential, such as holding a degree above a classification "
            "threshold, without revealing the credential itself.",
            "An accreditation authority governing which institutions may register as issuers, "
            "which this project treats as out of scope.",
            "Per-record storage keys or transactional writes, removing the residual risk that "
            "concurrent writers to one collection lose a record.",
            "A shared rate limiter, making the current per-instance limiting a guarantee "
            "across a horizontally scaled deployment.",
            "Batch minting, reducing the gas cost of issuing a large cohort.",
            "A formal usability study with student participants, measuring the system against "
            "an established wallet benchmark.",
        ],
    )

    # ═══ 11. References ═══
    h1(doc, "11. References")
    for i, reference in enumerate(
        [
            "W3C. Verifiable Credentials Data Model v2.0. World Wide Web Consortium Recommendation.",
            "Entriken, W., Shirley, D., Evans, J. and Sachs, N. ERC-721: Non-Fungible Token Standard. Ethereum Improvement Proposals.",
            "Pandurov, T. and others. ERC-5192: Minimal Soulbound NFTs. Ethereum Improvement Proposals.",
            "Buterin, V. ERC-191: Signed Data Standard. Ethereum Improvement Proposals.",
            "Buterin, V., Weyl, E. G. and Ohlhaver, P. Decentralized Society: Finding Web3's Soul.",
            "OpenZeppelin. OpenZeppelin Contracts v5 Documentation.",
            "Polygon Labs. Polygon Amoy Testnet Documentation.",
            "Benet, J. IPFS: Content Addressed, Versioned, P2P File System.",
            "Kaliski, B. PKCS #5: Password-Based Cryptography Specification Version 2.0. RFC 2898.",
            "Dworkin, M. Recommendation for Block Cipher Modes of Operation: Galois/Counter Mode and GMAC. NIST SP 800-38D.",
            "Jones, M., Bradley, J. and Sakimura, N. JSON Web Token (JWT). RFC 7519.",
            "Nomic Foundation. Hardhat Development Environment Documentation.",
        ],
        start=1,
    ):
        paragraph = doc.add_paragraph(f"[{i}] {reference}")
        paragraph.paragraph_format.left_indent = Inches(0.4)
        paragraph.paragraph_format.first_line_indent = Inches(-0.4)
        paragraph.paragraph_format.space_after = Pt(6)

    # ═══ Appendix A ═══
    h1(doc, "Appendix A: API Reference")
    add_table(
        doc,
        "Public endpoints, requiring no authentication",
        ["Method", "Path", "Purpose"],
        [
            ["GET", "/api/verify/:id", "Verify a credential and record the check"],
            ["GET", "/api/verify/share/:token", "Resolve a share link"],
            ["GET", "/api/profile/:address", "Public credential profile"],
            ["GET", "/api/credentials/:id/vc", "Download the W3C Verifiable Credential"],
            ["GET", "/api/system/status", "Storage, pinning and chain health"],
        ],
        widths=[0.8, 2.4, 3.0],
    )
    add_table(
        doc,
        "Authenticated endpoints",
        ["Method", "Path", "Role", "Purpose"],
        [
            ["POST", "/api/auth/register", "Any", "Create an account and wallet"],
            ["POST", "/api/auth/login", "Any", "Sign in"],
            ["GET", "/api/auth/me", "Any", "Validate the session"],
            ["POST", "/api/auth/password", "Any", "Change the password and re-seal the wallet"],
            ["POST", "/api/auth/wallet-export", "Any", "Reveal the wallet key once"],
            ["POST", "/api/credentials/issue", "Institution", "Issue one certificate"],
            ["POST", "/api/credentials/bulk", "Institution", "Issue from CSV"],
            ["POST", "/api/credentials/:id/revoke", "Institution", "Revoke with a reason"],
            ["GET", "/api/credentials/issuer/:address", "Institution", "Credentials issued"],
            ["GET", "/api/analytics/issuer", "Institution", "Issuance and verification analytics"],
            ["GET", "/api/credentials/student/:address", "Holder", "Own credentials"],
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

    # ═══ Appendix B ═══
    h1(doc, "Appendix B: Repository Structure")
    code(
        doc,
        "EduWallet/\n"
        "├── contracts/\n"
        "│   ├── contracts/\n"
        "│   │   ├── SoulboundCertificate.sol   Non-transferable ERC-721 (ERC-5192)\n"
        "│   │   ├── CredentialRegistry.sol     Issuer and credential registry\n"
        "│   │   └── RecoveryManager.sol        Social recovery with guardians\n"
        "│   ├── scripts/deploy.js              Deployment script\n"
        "│   ├── test/                          77 tests, incl. fuzz and invariants\n"
        "│   ├── hardhat.config.js              Network and compiler configuration\n"
        "│   └── .env.example\n"
        "├── frontend/\n"
        "│   ├── src/app/                       Pages and API route handlers\n"
        "│   ├── src/components/                Interface components\n"
        "│   ├── src/lib/                       Domain logic\n"
        "│   ├── tests/                         179 application tests\n"
        "│   ├── tests/e2e/                     Seeding, capture and chain E2E\n"
        "│   └── .env.example\n"
        "├── docs/\n"
        "│   ├── USER_GUIDE.md                  Illustrated end-to-end guide\n"
        "│   ├── screenshots/                   Figures captured from a live instance\n"
        "│   └── generate_report.py             Generator for this report\n"
        "├── README.md                          Setup and run instructions\n"
        "└── DEMO_GUIDE.md                      Operator and presenter reference",
    )

    # ── Back-fill the figure and table lists ──
    placeholder_figures.add_run("List of Figures").bold = True
    for entry in figures:
        placeholder_figures.add_run("\n" + entry)
    placeholder_tables.add_run("\n\nList of Tables").bold = True
    for entry in tables:
        placeholder_tables.add_run("\n" + entry)

    doc.save(OUT)
    print(f"Written: {OUT}")
    print(f"  {figure_number} figures, {table_number} tables")


if __name__ == "__main__":
    build()
