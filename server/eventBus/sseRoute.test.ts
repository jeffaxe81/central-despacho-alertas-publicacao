import { afterEach, describe, expect, it } from "vitest";
import { extractApiKey, queryApiKeyAllowed } from "./sseRoute";

const ORIGINAL = process.env.SSE_ALLOW_QUERY_API_KEY;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.SSE_ALLOW_QUERY_API_KEY;
  else process.env.SSE_ALLOW_QUERY_API_KEY = ORIGINAL;
});

describe("extração da API key do stream SSE", () => {
  it("aceita o header Authorization Bearer", () => {
    delete process.env.SSE_ALLOW_QUERY_API_KEY;
    expect(extractApiKey({ headers: { authorization: "Bearer sub_abc " }, query: {} } as any)).toBe("sub_abc");
  });

  it("não aceita api_key na query string por padrão", () => {
    delete process.env.SSE_ALLOW_QUERY_API_KEY;
    expect(queryApiKeyAllowed()).toBe(false);
    expect(extractApiKey({ headers: {}, query: { api_key: "sub_abc" } } as any)).toBeUndefined();
  });

  it("aceita api_key na query string somente com SSE_ALLOW_QUERY_API_KEY=true", () => {
    process.env.SSE_ALLOW_QUERY_API_KEY = "true";
    expect(queryApiKeyAllowed()).toBe(true);
    expect(extractApiKey({ headers: {}, query: { api_key: "sub_abc" } } as any)).toBe("sub_abc");
  });
});
