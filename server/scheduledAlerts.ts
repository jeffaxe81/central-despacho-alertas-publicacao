import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { dispatchConfiguredAlert } from "./alertEngine";
import { getAlertTypeByScheduleTask, getGeneralSettings } from "./db";

export async function scheduledAlertDispatchHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "Acesso exclusivo para agendamentos autenticados." });
    }
    const alertType = await getAlertTypeByScheduleTask(user.taskUid);
    if (!alertType || !alertType.autoEnabled) {
      return res.json({ ok: true, skipped: "Agendamento órfão ou desativado." });
    }
    const generalSettings = alertType.useGeneralLocation ? await getGeneralSettings(alertType.userId) : undefined;
    const result = await dispatchConfiguredAlert(alertType, undefined, generalSettings ? { latitude: generalSettings.defaultLatitude, longitude: generalSettings.defaultLongitude } : undefined);
    return res.status(result.ok ? 200 : 502).json({
      ok: result.ok,
      alertId: result.alertId,
      attempts: result.attempts,
      status: result.status,
      failureReason: result.failureReason,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado no agendamento.";
    return res.status(500).json({
      error: message,
      timestamp: new Date().toISOString(),
      context: { url: req.originalUrl },
    });
  }
}
