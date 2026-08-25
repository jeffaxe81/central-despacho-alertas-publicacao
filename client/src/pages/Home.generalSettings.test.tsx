/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/CoordinatePicker", () => ({
  CoordinatePicker: ({ onChange }: { onChange: (coordinates: { latitude: number; longitude: number }) => void }) => <button type="button" onClick={() => onChange({ latitude: -23.55052, longitude: -46.633308 })}>Selecionar coordenada de teste</button>,
  normalizeCoordinates: (coordinates: { latitude: number; longitude: number }) => ({ latitude: Number(coordinates.latitude.toFixed(6)), longitude: Number(coordinates.longitude.toFixed(6)) }),
}));

import { GeneralSettingsView, ResetGeneratedDataPanel } from "./Home";

afterEach(() => cleanup());

describe("Configurações Gerais de localização", () => {
  it("salva a latitude e longitude escolhidas no seletor", () => {
    const onSave = vi.fn();
    render(<GeneralSettingsView coordinates={{ latitude: -15.793889, longitude: -47.882778 }} onSave={onSave} onSearchAddress={async () => ({ latitude: -23.55052, longitude: -46.633308, formattedAddress: "São Paulo, SP" })} isSaving={false} isSearching={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Selecionar coordenada de teste" }));
    expect(screen.getByText("-23.550520")).toBeTruthy();
    expect(screen.getByText("-46.633308")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Salvar localização padrão" }));
    expect(onSave).toHaveBeenCalledWith({ latitude: -23.55052, longitude: -46.633308 });
  });

  it("preenche a localização ao pesquisar um endereço", async () => {
    const onSearchAddress = vi.fn().mockResolvedValue({ latitude: -15.799765, longitude: -47.864471, formattedAddress: "Praça dos Três Poderes, Brasília - DF" });
    render(<GeneralSettingsView coordinates={{ latitude: -15.793889, longitude: -47.882778 }} onSave={vi.fn()} onSearchAddress={onSearchAddress} isSaving={false} isSearching={false} />);

    fireEvent.change(screen.getByLabelText("Buscar endereço"), { target: { value: "Praça dos Três Poderes, Brasília - DF" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    await waitFor(() => expect(onSearchAddress).toHaveBeenCalledWith("Praça dos Três Poderes, Brasília - DF"));
    expect(screen.getByText("-15.799765")).toBeTruthy();
    expect(screen.getByText("-47.864471")).toBeTruthy();
  });

  it("preenche a localização quando o navegador concede a posição atual", () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => success({ coords: { latitude: -22.906847, longitude: -43.172896 } } as GeolocationPosition));
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
    render(<GeneralSettingsView coordinates={{ latitude: -15.793889, longitude: -47.882778 }} onSave={vi.fn()} onSearchAddress={async () => ({ latitude: 0, longitude: 0, formattedAddress: "" })} isSaving={false} isSearching={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Usar minha localização" }));

    expect(getCurrentPosition).toHaveBeenCalled();
    expect(screen.getByText("-22.906847")).toBeTruthy();
    expect(screen.getByText("-43.172896")).toBeTruthy();
  });

  it("exige a frase de confirmação antes de disparar a limpeza de dados gerados", () => {
    const onReset = vi.fn();
    render(<ResetGeneratedDataPanel onReset={onReset} isResetting={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Resetar dados gerados" }));
    const confirmButton = screen.getByRole("button", { name: "Limpar dados" });
    expect(confirmButton.hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByLabelText(/Digite/), { target: { value: "LIMPAR DADOS GERADOS" } });
    expect(confirmButton.hasAttribute("disabled")).toBe(false);
    fireEvent.click(confirmButton);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
