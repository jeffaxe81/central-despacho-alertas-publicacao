/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubscriptionsView } from "./Home";

afterEach(() => cleanup());

describe("SubscriptionsView", () => {
  it("cria uma assinatura webhook com os dados do formulário", () => {
    const onCreate = vi.fn();
    render(<SubscriptionsView subscriptions={[]} onCreate={onCreate} isCreating={false} justCreatedKey={null} onToggle={vi.fn()} isToggling={false} />);

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Despacho — semáforos" } });
    fireEvent.change(screen.getByLabelText("URL de destino"), { target: { value: "https://despacho.example/hook" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar assinatura" }));

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      label: "Despacho — semáforos",
      category: null,
      deliveryMode: "webhook",
      endpointUrl: "https://despacho.example/hook",
    }));
  });

  it("impede criar assinatura webhook sem URL de destino", () => {
    const onCreate = vi.fn();
    render(<SubscriptionsView subscriptions={[]} onCreate={onCreate} isCreating={false} justCreatedKey={null} onToggle={vi.fn()} isToggling={false} />);

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Sem endpoint" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar assinatura" }));

    expect(onCreate).not.toHaveBeenCalled();
  });

  it("exibe a API key recém-criada e alterna o estado ativo de uma assinatura existente", () => {
    const onToggle = vi.fn();
    render(<SubscriptionsView
      subscriptions={[{ id: 1, label: "Despacho geral", category: null, deliveryMode: "webhook", endpointUrl: "https://x.example/hook", isActive: true }]}
      onCreate={vi.fn()}
      isCreating={false}
      justCreatedKey="sub_abc123"
      onToggle={onToggle}
      isToggling={false}
    />);

    expect(screen.getByText("sub_abc123")).toBeTruthy();
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledWith(1, false);
  });
});
