import { readCanonicalShadowDiagnosticSnapshot } from "./canonicalShadowDiagnostics";

export type CanonicalShadowDiagnosticStatus = "idle" | "healthy" | "attention";

export interface CanonicalShadowDiagnosticReport {
  status: CanonicalShadowDiagnosticStatus;
  publications: number;
  delivered: number;
  failed: number;
  equivalent: number;
  divergent: number;
  deliverySuccessRate: number | null;
  equivalenceRate: number | null;
}

export function createCanonicalShadowDiagnosticReport(input: {
  isTestMode: boolean;
}): CanonicalShadowDiagnosticReport {
  const snapshot = readCanonicalShadowDiagnosticSnapshot(input);
  const deliveryAttempts = snapshot.delivered + snapshot.failed;

  const status: CanonicalShadowDiagnosticStatus = snapshot.publications === 0
    ? "idle"
    : snapshot.failed > 0 || snapshot.divergent > 0
      ? "attention"
      : "healthy";

  return {
    status,
    publications: snapshot.publications,
    delivered: snapshot.delivered,
    failed: snapshot.failed,
    equivalent: snapshot.equivalent,
    divergent: snapshot.divergent,
    deliverySuccessRate: deliveryAttempts === 0 ? null : snapshot.delivered / deliveryAttempts,
    equivalenceRate: snapshot.publications === 0 ? null : snapshot.equivalent / snapshot.publications,
  };
}
