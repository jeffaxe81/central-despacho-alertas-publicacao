export function formatApiKey(bytes: Uint8Array) {
  if (bytes.length !== 32) throw new Error("A API key deve ser composta por 32 bytes aleatórios.");
  return `ak_${Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function generateIntegrationApiKey(random: Pick<Crypto, "getRandomValues"> = crypto) {
  const bytes = new Uint8Array(32);
  random.getRandomValues(bytes);
  return formatApiKey(bytes);
}
