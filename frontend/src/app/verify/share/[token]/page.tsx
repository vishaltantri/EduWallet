"use client";

import { useParams } from "next/navigation";
import { VerificationScreen } from "@/components/VerificationScreen";

export default function SharedVerifyPage() {
  const params = useParams();
  const token = String(params.token ?? "");

  return (
    <VerificationScreen
      endpoint={`/api/verify/share/${encodeURIComponent(token)}`}
      notFoundHint="Share links can be revoked by the credential holder or expire on their own. Ask them for a fresh link."
    />
  );
}
