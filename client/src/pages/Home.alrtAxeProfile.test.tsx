/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Dialog, DialogContent } from "@/components/ui/dialog";

vi.mock("@/components/CoordinatePicker", () => ({ CoordinatePicker: () => null }));

import { EventConfigDialog, type ConfigDraft } from "./Home";

const initialDraft: ConfigDraft = {
  id: 1,
  category: "iluminacao_publica",
  name: "Iluminação pública",
  defaultDescription: "Luminária apagada em ponto urbano.",
  defaultSeverity: "media",
  endpointUrl: "mock://central-despacho",
  headersJson: '{"x-origem":"legado"}',
  payloadTemplate: "{}",
  apiKeyHeader: "x-api-key",
  isTestMode: true,
  autoEnabled: false,
  autoIntervalMinutes: 15,
  defaultLatitude: -23.55052,
  defaultLongitude: -46.633308,
  useGeneralLocation: true,
  hasAuthToken: true,
  hasApiKey: true,
  authToken: "bearer-legado",
  clearToken: false,
  apiKey: "api-key-existente",
  clearApiKey: true,
};

function FormHarness() {
  const [draft, setDraft] = useState(initialDraft);
  return <Dialog open><DialogContent><EventConfigDialog draft={draft} setDraft={setDraft} onSave={vi.fn()} isSaving={false} autoInterval="15" setAutoInterval={vi.fn()} onAutomation={vi.fn()} automationSaving={false} /></DialogContent></Dialog>;
}

describe("botão Aplicar ALRT → AXE", () => {
  it("atualiza em tela todos os campos de integração em uma única ação", () => {
    render(<FormHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Aplicar ALRT → AXE" }));

    expect((screen.getByLabelText("Endpoint REST de destino") as HTMLInputElement).value).toBe("https://dispatchapp-dmbshjft.manus.space/api/integrations/alrt/events");
    expect((screen.getByLabelText("Headers personalizados (JSON)") as HTMLTextAreaElement).value).toBe("{}");
    expect((screen.getByLabelText("Token Bearer") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Nome do header da API key") as HTMLInputElement).value).toBe("X-ALRT-API-Key");
    expect((screen.getByLabelText("Modelo de payload JSON") as HTMLTextAreaElement).value).toContain('"eventType": "alert.received"');
    expect(screen.getByRole("switch", { name: "Modo teste" }).getAttribute("aria-checked")).toBe("false");
  });
});
