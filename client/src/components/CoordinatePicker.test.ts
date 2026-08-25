import { describe, expect, it } from "vitest";
import { coordinatesFromStaticMapClick, normalizeCoordinates } from "./CoordinatePicker";

describe("seleção de coordenadas", () => {
  it("normaliza o clique ou arraste do marcador para seis casas decimais", () => {
    expect(normalizeCoordinates({ latitude: -23.55051991, longitude: -46.63330842 })).toEqual({
      latitude: -23.55052,
      longitude: -46.633308,
    });
  });

  it("preserva o centro quando o operador clica no centro do mapa estático", () => {
    expect(coordinatesFromStaticMapClick({
      center: { latitude: -15.793889, longitude: -47.882778 },
      clickX: 320,
      clickY: 180,
      width: 640,
      height: 360,
    })).toEqual({ latitude: -15.793889, longitude: -47.882778 });
  });
});
