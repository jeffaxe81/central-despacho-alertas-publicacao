import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

/**
 * Proteção de segredos em repouso.
 *
 * - Valores que precisam ser enviados em claro às centrais (API keys de saída,
 *   tokens de autorização, chaves de webhook) são cifrados com AES-256-GCM.
 * - Chaves que só precisam ser verificadas (API keys de entrada, chaves de
 *   assinante) são guardadas como um "digest" HMAC-SHA256: a busca é feita pelo
 *   digest e o valor original nunca fica no banco.
 *
 * A chave-mestra vem de `SECRETS_ENCRYPTION_KEY` (mínimo de 32 caracteres).
 * Em produção, a ausência dela impede o início do servidor.
 */

const CIPHER_PREFIX = "v1:";
const DEV_FALLBACK_SEED = "central-alertas-dev-only-secrets-key";

let cachedMasterKey: Buffer | null = null;
let warnedAboutDevelopmentKey = false;

function deriveSubkey(purpose: string): Buffer {
  return createHmac("sha256", getMasterKey()).update(purpose).digest();
}

export function getMasterKey(): Buffer {
  if (cachedMasterKey) return cachedMasterKey;

  const configured = process.env.SECRETS_ENCRYPTION_KEY?.trim();
  if (configured) {
    if (configured.length < 32) {
      throw new Error("SECRETS_ENCRYPTION_KEY precisa ter pelo menos 32 caracteres.");
    }
    cachedMasterKey = createHash("sha256").update(configured).digest();
    return cachedMasterKey;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Configure SECRETS_ENCRYPTION_KEY (mínimo de 32 caracteres) antes de iniciar em produção.");
  }

  // Desenvolvimento e testes: chave fixa e pública, aceitável apenas fora de produção.
  if (!warnedAboutDevelopmentKey) {
    warnedAboutDevelopmentKey = true;
    console.warn("[secrets] SECRETS_ENCRYPTION_KEY não definida; usando chave de desenvolvimento (não use em produção).");
  }
  cachedMasterKey = createHash("sha256").update(DEV_FALLBACK_SEED).digest();
  return cachedMasterKey;
}

/** Usado apenas em testes para forçar a releitura da chave a partir do ambiente. */
export function resetSecretsKeyCacheForTests(): void {
  cachedMasterKey = null;
}

export function isEncryptedSecret(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(CIPHER_PREFIX);
}

export function encryptSecret(plainText: string): string {
  const key = deriveSubkey("secret-encryption");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${CIPHER_PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

/**
 * Devolve o valor em claro. Valores sem o prefixo `v1:` são tratados como legado
 * (ainda não cifrados) e devolvidos sem alteração; o backfill na inicialização os converte.
 * Falha de autenticação (valor adulterado ou chave trocada) lança erro.
 */
export function decryptSecret(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (!isEncryptedSecret(value)) return value;

  const [ivPart, tagPart, dataPart] = value.slice(CIPHER_PREFIX.length).split(".");
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error("Segredo cifrado em formato inválido.");
  }
  const decipher = createDecipheriv("aes-256-gcm", deriveSubkey("secret-encryption"), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8");
}

/** Digest estável usado para localizar uma chave sem armazená-la em claro. */
export function secretDigest(value: string): string {
  return createHmac("sha256", deriveSubkey("secret-lookup")).update(value.trim()).digest("hex");
}
