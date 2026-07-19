import type { Preview } from "@storybook/react-vite";
import "../packages/ui/src/styles.css";

const preview: Preview = {
  parameters: {
    controls: {
      expanded: true,
    },
    layout: "centered",
  },
};

export default preview;
