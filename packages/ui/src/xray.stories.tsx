import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { XRayBox, XRayToggle } from "./xray";
import { expect, userEvent, within } from "storybook/test";

const meta = {
  title: "Shared UI/XRay",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const BoxLayers: Story = {
  render: () => (
    <div
      style={{ display: "grid", gap: "1rem", maxWidth: "32rem", width: "100%" }}
    >
      <XRayBox enabled label="app/dashboard/HomePage" layer="app">
        <div style={panelStyle}>app/dashboard/HomePage</div>
      </XRayBox>
      <XRayBox
        enabled
        label="feature/incident/FetchIncidentList"
        layer="feature"
      >
        <div style={panelStyle}>feature/incident/FetchIncidentList</div>
      </XRayBox>
      <XRayBox enabled label="shared/ui/SeverityBadge" layer="shared">
        <div style={panelStyle}>shared/ui/SeverityBadge</div>
      </XRayBox>
    </div>
  ),
};

export const ToggleDemo: Story = {
  render: () => {
    function Demo() {
      const [enabled, setEnabled] = useState(false);

      return (
        <div style={{ display: "grid", gap: "1rem", maxWidth: "32rem" }}>
          <XRayToggle enabled={enabled} onChange={setEnabled} />
          <XRayBox
            enabled={enabled}
            label="widget/incident/IncidentSummaryCard"
            layer="widget"
            packageName="@citywatch/ui"
            stacks={["React", "TypeScript", "Storybook"]}
          >
            <div style={panelStyle}>
              Toggle the overlay to inspect this block.
            </div>
          </XRayBox>
        </div>
      );
    }
    return <Demo />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "X-Ray mode" });

    expect(button).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(button);

    expect(button).toHaveAttribute("aria-pressed", "true");

    expect(
      canvasElement.querySelector(
        '[data-xray-label="widget/incident/IncidentSummaryCard"]',
      ),
    ).toHaveAttribute("data-xray-proofs", "fsd-style");
  },
};

const panelStyle = {
  background: "#f8fafc",
  border: "1px solid #cbd5e1",
  borderRadius: "12px",
  color: "#0f172a",
  fontWeight: 700,
  minHeight: "96px",
  padding: "1rem",
};
