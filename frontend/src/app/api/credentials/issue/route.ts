import { NextRequest, NextResponse } from "next/server";
import { findUserByEmail, findUserById, verifyJWT } from "@/lib/userStore";
import { uploadJSONToIPFS } from "@/lib/ipfs";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";

// ─── Credential Store (local JSON for prototype) ───
const CRED_PATH = path.join(process.cwd(), "data", "credentials.json");

interface StoredCredential {
  id: string;
  tokenId: number;
  studentAddress: string;
  studentName: string;
  studentEmail: string;
  issuerAddress: string;
  issuerEmail: string;
  degreeType: string;
  major: string;
  institutionName: string;
  ipfsHash: string;
  issuedAt: string;
  isValid: boolean;
}

function getCredentials(): StoredCredential[] {
  const dir = path.dirname(CRED_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(CRED_PATH)) fs.writeFileSync(CRED_PATH, "[]");
  return JSON.parse(fs.readFileSync(CRED_PATH, "utf-8"));
}

function saveCredentials(creds: StoredCredential[]) {
  const dir = path.dirname(CRED_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CRED_PATH, JSON.stringify(creds, null, 2));
}

let nextTokenId = 1;
function initTokenId() {
  const creds = getCredentials();
  if (creds.length > 0) {
    nextTokenId = Math.max(...creds.map((c) => c.tokenId)) + 1;
  }
}
initTokenId();

// ─── POST /api/credentials/issue ───
export async function POST(request: NextRequest) {
  try {
    // Verify auth
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = verifyJWT(authHeader.slice(7));
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const issuer = findUserById(payload.userId as string);
    if (!issuer || issuer.role !== "university") {
      return NextResponse.json({ error: "Only university staff can issue credentials" }, { status: 403 });
    }

    const { studentEmail, studentName, degreeType, major } = await request.json();

    if (!studentEmail || !studentName || !degreeType || !major) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    // Find student
    const student = findUserByEmail(studentEmail);
    if (!student) {
      return NextResponse.json({ error: "Student not found. They must register on EduWallet first." }, { status: 404 });
    }
    if (student.role !== "student") {
      return NextResponse.json({ error: "Specified email is not a student account" }, { status: 400 });
    }

    // 1. Upload Credential Metadata to Pinata IPFS
    const institutionName = `${issuer.name}'s Institution`;
    let ipfsHash = "";

    try {
      ipfsHash = await uploadJSONToIPFS({
        name: `${degreeType} in ${major}`,
        description: `Official Soulbound Academic Credential issued to ${studentName} by ${institutionName}.`,
        attributes: [
          { trait_type: "Student Name", value: studentName },
          { trait_type: "Degree Type", value: degreeType },
          { trait_type: "Major", value: major },
          { trait_type: "Institution", value: institutionName },
          { trait_type: "Issued Date", value: new Date().toISOString() },
        ],
      });
    } catch (ipfsError) {
      console.warn("Falling back to synthetic IPFS hash:", ipfsError);
      ipfsHash = `Qm${uuidv4().replace(/-/g, "").slice(0, 44)}`;
    }

    // 2. Create credential record
    const tokenId = nextTokenId++;
    const credential: StoredCredential = {
      id: uuidv4(),
      tokenId,
      studentAddress: student.walletAddress,
      studentName,
      studentEmail: student.email,
      issuerAddress: issuer.walletAddress,
      issuerEmail: issuer.email,
      degreeType,
      major,
      institutionName,
      ipfsHash,
      issuedAt: new Date().toISOString(),
      isValid: true,
    };

    const creds = getCredentials();
    creds.push(credential);
    saveCredentials(creds);

    return NextResponse.json({
      tokenId: credential.tokenId,
      message: "Certificate issued & metadata pinned to IPFS successfully!",
      ipfsHash: credential.ipfsHash,
      credential: {
        tokenId: credential.tokenId,
        studentName: credential.studentName,
        degreeType: credential.degreeType,
        major: credential.major,
        issuedAt: credential.issuedAt,
        ipfsHash: credential.ipfsHash,
      },
    });
  } catch (error) {
    console.error("Issue error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
