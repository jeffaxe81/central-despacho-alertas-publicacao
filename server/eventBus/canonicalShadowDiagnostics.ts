import {
  getCanonicalShadowDiagnosticSnapshot,
  type CanonicalShadowDiagnosticSnapshot,
} from "./canonicalShadow";

export function readCanonicalShadowDiagnosticSnapshot(input: {
  isTestMode: boolean;
}): Readonly<CanonicalShadowDiagnosticSnapshot> {
  if (!input.isTestMode) {
    throw new Error("Diagnóstico shadow disponível somente em modo teste.");
  }

  return getCanonicalShadowDiagnosticSnapshot();
}
