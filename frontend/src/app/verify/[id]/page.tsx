"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";
import { VerificationScreen } from "@/components/VerificationScreen";
import type { VerificationData } from "@/components/CertificateView";

/** A self-contained sample so the verification flow is explorable signed-out. */
const DEMO: VerificationData = {
  outcome: "valid",
  isValid: true,
  id: "demo",
  tokenId: 1,
  studentName: "Jane Smith",
  studentAddress: "0x8ba1f109551bD432803012645ac136c9A02b29e4",
  degreeType: "Bachelor of Science",
  major: "Computer Science",
  grade: "First Class Honours",
  institutionName: "EduWallet Demo University",
  issuerAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38",
  issuedAt: "2026-06-15T09:00:00.000Z",
  ipfsHash: "QmDemo123456789abcdef",
  anonymized: false,
  integrity: {
    signed: true,
    contentIntact: true,
    signatureValid: true,
    credentialHash: "0x9f2c4e1b7a8d5f3e6c0b2a94d7e8f1c5b3a6d9e2f4c7b1a8d5e3f6c9b2a4d7e81",
    recoveredSigner: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD38",
  },
  anchor: { anchored: false, note: "sample certificate" },
  priorVerifications: 0,
  isDemo: true,
};

export default function VerifyPage() {
  const params = useParams();
  const id = String(params.id ?? "");

  const demoData = useMemo(() => (id === "demo" ? DEMO : undefined), [id]);

  return (
    <VerificationScreen
      endpoint={`/api/verify/${encodeURIComponent(id)}`}
      demoData={demoData}
      notFoundHint="Check that the full link was copied — credential IDs are 36 characters long."
    />
  );
}
