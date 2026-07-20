import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { MdButton } from "./MdButton";

const meta: Meta<typeof MdButton> = {
  title: "Generated/MdButton",
  component: MdButton,
  parameters: {
    layout: "centered",
  },
  args: {
    children: "Continuar",
    variant: "filled",
    size: "md",
  },
};

export default meta;
type Story = StoryObj<typeof MdButton>;

export const Filled: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
      <MdButton {...args} variant="filled">
        Filled
      </MdButton>
      <MdButton {...args} variant="tonal">
        Tonal
      </MdButton>
      <MdButton {...args} variant="outlined">
        Outlined
      </MdButton>
      <MdButton {...args} variant="text">
        Text
      </MdButton>
    </div>
  ),
};

export const Loading: Story = {
  args: {
    children: "Agregando…",
    loading: true,
  },
};

export const Disabled: Story = {
  args: {
    children: "No disponible",
    disabled: true,
  },
};
