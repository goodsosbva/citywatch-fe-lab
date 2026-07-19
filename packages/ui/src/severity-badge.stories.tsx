import type { Meta, StoryObj } from "@storybook/react-vite";
import { SeverityBadge } from "./severity-badge";

const meta = {
  title: "Shared UI/SeverityBadge",
  component: SeverityBadge,
  args: {
    severity: "medium",
  },
  argTypes: {
    severity: {
      control: "inline-radio",
      options: ["low", "medium", "high", "critical"],
    },
  },
} satisfies Meta<typeof SeverityBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const AllSeverities: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
      <SeverityBadge severity="low" />
      <SeverityBadge severity="medium" />
      <SeverityBadge severity="high" />
      <SeverityBadge severity="critical" />
    </div>
  ),
};
