import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "./badge";

const meta = {
  title: "Shared UI/Badge",
  component: Badge,
  args: {
    children: "Monitoring",
    tone: "neutral",
  },
  argTypes: {
    tone: {
      control: "inline-radio",
      options: ["neutral", "info", "success", "warning", "danger"],
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const CriticalIncident: Story = {
  args: {
    children: "Critical Incident",
    tone: "danger",
  },
  argTypes: {
    children: {
      control: "text",
      description: "Badge 안에 표시할 문구",
    },
    tone: {
      control: "inline-radio",
      options: ["neutral", "info", "success", "warning", "danger"],
      description: "Badge의 의미와 색상",
    },
  },
};

export const Tones: Story = {
  decorators: [
    (Story) => (
      <div style={{ background: "#ffffff", padding: "2rem" }}>
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
      <Badge tone="neutral">Neutral</Badge>
      <Badge tone="info">Info</Badge>
      <Badge tone="success">Success</Badge>
      <Badge tone="warning">Warning</Badge>
      <Badge tone="danger">Danger</Badge>
    </div>
  ),
};
