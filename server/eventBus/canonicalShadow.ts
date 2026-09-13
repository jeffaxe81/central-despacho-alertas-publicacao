export interface CanonicalShadowMessage {
  canonicalEvent: unknown;
  equivalent: boolean;
}

export type CanonicalShadowSubscriber = (
  message: CanonicalShadowMessage
) => void | Promise<void>;

const subscribers = new Set<CanonicalShadowSubscriber>();

export function subscribeCanonicalShadow(subscriber: CanonicalShadowSubscriber) {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

export async function publishCanonicalShadowEvent(message: CanonicalShadowMessage) {
  const results = await Promise.allSettled(
    [...subscribers].map(subscriber => Promise.resolve().then(() => subscriber(message)))
  );

  return results.reduce(
    (summary, result) => {
      if (result.status === "fulfilled") summary.delivered += 1;
      else summary.failed += 1;
      return summary;
    },
    { delivered: 0, failed: 0 }
  );
}

export function resetCanonicalShadowSubscribersForTest() {
  subscribers.clear();
}
