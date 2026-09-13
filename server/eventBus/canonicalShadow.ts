export interface CanonicalShadowMessage {
  canonicalEvent: unknown;
  equivalent: boolean;
}

export interface CanonicalShadowDiagnosticSnapshot {
  publications: number;
  delivered: number;
  failed: number;
  equivalent: number;
  divergent: number;
}

export type CanonicalShadowSubscriber = (
  message: CanonicalShadowMessage
) => void | Promise<void>;

const subscribers = new Set<CanonicalShadowSubscriber>();

function createEmptyDiagnosticSnapshot(): CanonicalShadowDiagnosticSnapshot {
  return {
    publications: 0,
    delivered: 0,
    failed: 0,
    equivalent: 0,
    divergent: 0,
  };
}

let diagnosticSnapshot = createEmptyDiagnosticSnapshot();

export function subscribeCanonicalShadow(subscriber: CanonicalShadowSubscriber) {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

export function getCanonicalShadowDiagnosticSnapshot(): Readonly<CanonicalShadowDiagnosticSnapshot> {
  return { ...diagnosticSnapshot };
}

export async function publishCanonicalShadowEvent(message: CanonicalShadowMessage) {
  const results = await Promise.allSettled(
    Array.from(subscribers).map(subscriber => Promise.resolve().then(() => subscriber(message)))
  );

  const summary = results.reduce(
    (current, result) => {
      if (result.status === "fulfilled") current.delivered += 1;
      else current.failed += 1;
      return current;
    },
    { delivered: 0, failed: 0 }
  );

  diagnosticSnapshot.publications += 1;
  diagnosticSnapshot.delivered += summary.delivered;
  diagnosticSnapshot.failed += summary.failed;
  if (message.equivalent) diagnosticSnapshot.equivalent += 1;
  else diagnosticSnapshot.divergent += 1;

  return summary;
}

export function resetCanonicalShadowSubscribersForTest() {
  subscribers.clear();
  diagnosticSnapshot = createEmptyDiagnosticSnapshot();
}
