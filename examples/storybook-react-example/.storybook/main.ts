import type { StorybookConfig } from "@storybook/react-vite";
import { withClickToSourceStorybook } from "click-to-source/storybook";

const config: StorybookConfig = withClickToSourceStorybook(
  {
    stories: ["../src/**/*.stories.@(ts|tsx)"],
    framework: "@storybook/react-vite",
    addons: [],
  },
  { framework: "react" }
);

export default config;
