/**
 * Seed a running instance with realistic demo data, through the real API.
 *
 * Used to populate screens before capturing documentation screenshots, so
 * every figure in the user guide shows genuine signed certificates, real
 * transaction hashes and real verification counts rather than mock-ups.
 *
 * Writes the created accounts and ids to stdout as JSON.
 */

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3120").replace(/\/$/, "");

let ipSeq = 0;
async function api(path, { method = "GET", body, token } = {}) {
  ipSeq += 1;
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "x-forwarded-for": `203.0.113.${ipSeq % 250}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const parsed = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${method} ${path} -> ${response.status} ${JSON.stringify(parsed)}`);
  }
  return parsed;
}

async function register(input) {
  const result = await api("/api/auth/register", { method: "POST", body: input });
  return { ...input, token: result.token, user: result.user };
}

const PASSWORD = "demo-password-2026";

// ─── Accounts ───────────────────────────────────────────────────────────────

const university = await register({
  name: "Dr Anita Rao",
  email: "registrar@northfield.edu",
  password: PASSWORD,
  role: "university",
  institutionName: "Northfield Institute of Technology",
});

const secondUniversity = await register({
  name: "Prof James Hale",
  email: "registrar@westbury.edu",
  password: PASSWORD,
  role: "university",
  institutionName: "Westbury University",
});

const thirdUniversity = await register({
  name: "Dr Mei Chen",
  email: "records@eastgate.edu",
  password: PASSWORD,
  role: "university",
  institutionName: "Eastgate College",
});

const student = await register({
  name: "Priya Sharma",
  email: "priya.sharma@student.edu",
  password: PASSWORD,
  role: "student",
});

const classmates = [];
for (const [name, email] of [
  ["Daniel Okafor", "daniel.okafor@student.edu"],
  ["Sofia Marino", "sofia.marino@student.edu"],
  ["Liam Walsh", "liam.walsh@student.edu"],
  ["Yuki Tanaka", "yuki.tanaka@student.edu"],
]) {
  classmates.push(await register({ name, email, password: PASSWORD, role: "student" }));
}

// ─── Certificates ───────────────────────────────────────────────────────────

async function issue(fields) {
  const result = await api("/api/credentials/issue", {
    method: "POST",
    token: university.token,
    body: fields,
  });
  return result.credential;
}

const degree = await issue({
  studentEmail: student.email,
  studentName: "Priya Sharma",
  degreeType: "Bachelor of Technology",
  major: "Computer Science and Engineering",
  grade: "First Class with Distinction",
  completionDate: "2026-05-28",
});

const masters = await issue({
  studentEmail: student.email,
  studentName: "Priya Sharma",
  degreeType: "Master of Science",
  major: "Artificial Intelligence",
  grade: "Distinction",
  completionDate: "2026-09-15",
});

const certificate = await issue({
  studentEmail: student.email,
  studentName: "Priya Sharma",
  degreeType: "Professional Certification",
  major: "Cloud Infrastructure",
  grade: "Pass",
  completionDate: "2026-02-10",
});

// One that will be revoked, so the revoked state has a real example.
const revoked = await issue({
  studentEmail: student.email,
  studentName: "Priya Sharma",
  degreeType: "Diploma",
  major: "Data Analytics",
  grade: "Merit",
  completionDate: "2025-11-30",
});

// A cohort, so the institution's tables and analytics have volume.
const bulkCsv = [
  "email,name,degree,major,grade,completion_date",
  "daniel.okafor@student.edu,Daniel Okafor,Bachelor of Science,Physics,Upper Second,2026-06-12",
  "sofia.marino@student.edu,Sofia Marino,Bachelor of Arts,Economics,First Class,2026-06-12",
  "liam.walsh@student.edu,Liam Walsh,Master of Business Administration,Finance,Merit,2026-06-12",
  "yuki.tanaka@student.edu,Yuki Tanaka,Doctor of Philosophy,Molecular Biology,Awarded,2026-06-12",
].join("\n");

const bulk = await api("/api/credentials/bulk", {
  method: "POST",
  token: university.token,
  body: { csv: bulkCsv },
});

await api(`/api/credentials/${revoked.id}/revoke`, {
  method: "POST",
  token: university.token,
  body: { reason: "Issued against an incomplete transcript; reissued under a corrected record." },
});

// ─── Share links ────────────────────────────────────────────────────────────

const employerLink = await api("/api/share", {
  method: "POST",
  token: student.token,
  body: {
    credentialId: degree.id,
    label: "Meridian Analytics — graduate application",
    expiry: "30d",
    anonymized: false,
  },
});

const anonymousLink = await api("/api/share", {
  method: "POST",
  token: student.token,
  body: {
    credentialId: masters.id,
    label: "Recruiter screening (identity withheld)",
    expiry: "7d",
    anonymized: true,
  },
});

await api("/api/share", {
  method: "POST",
  token: student.token,
  body: { credentialId: certificate.id, label: "Internal HR review", expiry: "24h" },
});

// ─── Verification activity ──────────────────────────────────────────────────

// Real verification events, so the audit trail and analytics are not empty.
for (let i = 0; i < 7; i++) await api(`/api/verify/${degree.id}`);
for (let i = 0; i < 4; i++) await api(`/api/verify/${masters.id}`);
for (let i = 0; i < 2; i++) await api(`/api/verify/${certificate.id}`);
await api(`/api/verify/share/${employerLink.link.token}`);
await api(`/api/verify/share/${employerLink.link.token}`);
await api(`/api/verify/share/${anonymousLink.link.token}`);
await api(`/api/verify/${revoked.id}`);

// ─── Social recovery ────────────────────────────────────────────────────────

const guardians = await api("/api/recovery/setup", {
  method: "POST",
  token: student.token,
  body: {
    guardianEmails: [secondUniversity.email, thirdUniversity.email, university.email],
    threshold: 2,
  },
});

// A classmate with an open recovery request, so the guardian queue and the
// student's cancel view both have a live example.
const recovering = classmates[0];
await api("/api/recovery/setup", {
  method: "POST",
  token: recovering.token,
  body: { guardianEmails: [university.email, secondUniversity.email], threshold: 2 },
});

const request = await api("/api/recovery/requests", {
  method: "POST",
  token: university.token,
  body: {
    studentEmail: recovering.email,
    newAddress: "0x4e2A9b1C3d5E7f8A0b2C4d6E8f0A2b4C6d8E0f2A",
  },
});

console.log(
  JSON.stringify(
    {
      password: PASSWORD,
      university: { email: university.email, token: university.token, user: university.user },
      secondUniversity: { email: secondUniversity.email, token: secondUniversity.token, user: secondUniversity.user },
      student: { email: student.email, token: student.token, user: student.user },
      recovering: { email: recovering.email, token: recovering.token, user: recovering.user },
      credentials: {
        degree: degree.id,
        masters: masters.id,
        certificate: certificate.id,
        revoked: revoked.id,
      },
      anchored: {
        degree: { txHash: degree.txHash, chainTokenId: degree.chainTokenId, anchored: degree.anchored },
      },
      shareTokens: {
        employer: employerLink.link.token,
        anonymous: anonymousLink.link.token,
      },
      bulkIssued: bulk.issued.length,
      guardians: guardians.guardians,
      recoveryRequestId: request.request.id,
    },
    null,
    2
  )
);
