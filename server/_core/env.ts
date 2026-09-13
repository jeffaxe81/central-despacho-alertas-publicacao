const isProduction = process.env.NODE_ENV === "production";

function required(name: string, minimumLength = 1) {
  const value = process.env[name]?.trim() ?? "";
  if (isProduction && value.length < minimumLength) {
    throw new Error(`${name} must be configured with at least ${minimumLength} characters in production.`);
  }
  return value;
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: required("JWT_SECRET", 32),
  databaseUrl: required("DATABASE_URL", 20),
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction,
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
