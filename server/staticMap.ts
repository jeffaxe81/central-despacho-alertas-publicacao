import type { Request, Response } from "express";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";

function parseCoordinate(value: unknown, min: number, max: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= min && numeric <= max ? numeric : null;
}

export async function staticMapHandler(req: Request, res: Response) {
  try {
    await sdk.authenticateRequest(req);
    const latitude = parseCoordinate(req.query.lat, -90, 90);
    const longitude = parseCoordinate(req.query.lng, -180, 180);
    if (latitude === null || longitude === null) {
      return res.status(400).json({ error: "Latitude e longitude válidas são obrigatórias." });
    }
    const upstreamUrl = new URL(`${ENV.forgeApiUrl}/v1/maps/proxy/maps/api/staticmap`);
    upstreamUrl.searchParams.set("key", ENV.forgeApiKey);
    upstreamUrl.searchParams.set("center", `${latitude},${longitude}`);
    upstreamUrl.searchParams.set("zoom", "14");
    upstreamUrl.searchParams.set("size", "640x360");
    upstreamUrl.searchParams.set("scale", "2");
    upstreamUrl.searchParams.set("maptype", "roadmap");
    upstreamUrl.searchParams.set("markers", `color:0x06b6d4|${latitude},${longitude}`);

    const upstream = await fetch(upstreamUrl);
    if (!upstream.ok) {
      return res.status(502).json({ error: "Não foi possível obter o mapa estático." });
    }
    const contentType = upstream.headers.get("content-type") ?? "image/png";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=60");
    return res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    return res.status(403).json({ error: "Autenticação necessária para consultar o mapa." });
  }
}
