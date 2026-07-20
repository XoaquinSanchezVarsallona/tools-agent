import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { AppleInputCard } from "./AppleInputCard";

const meta: Meta<typeof AppleInputCard> = {
  title: "Generated/AppleInputCard",
  component: AppleInputCard,
  parameters: { layout: "centered" },
  args: {
    title: "Sign in",
    description: "Enter your email to continue. We’ll never share it.",
    label: "Email",
    placeholder: "name@company.com",
    helperText: "Use your work email address.",
    ctaLabel: "Continue",
  },
};

export default meta;

type Story = StoryObj<typeof AppleInputCard>;

export const Default: Story = {};

export const WithError: Story = {
  args: {
    errorText: "Please enter a valid email address.",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: "disabled@example.com",
  },
};

export const Controlled: Story = {
  render: (args) => {
    const [val, setVal] = React.useState("hello@apple.com");
    return (
      <AppleInputCard
        {...args}
        value={val}
        onChange={setVal}
        onSubmit={(v) => alert(`Submitted: ${v}`)}
      />
    );
  },
};
