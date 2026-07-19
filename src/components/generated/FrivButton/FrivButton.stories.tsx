import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { FrivButton, type FrivButtonProps } from "./FrivButton";

const meta: Meta<typeof FrivButton> = {
  title: "Generated/FrivButton",
  component: FrivButton,
  args: {
    label: "Jugar",
    tone: "pink",
    size: "md",
    loading: false,
    disabled: false,
  },
  argTypes: {
    tone: {
      control: "select",
      options: ["pink", "blue", "green", "yellow", "purple"],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
    icon: { control: false },
    onClick: { action: "click" },
  },
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof FrivButton>;

const StarIcon = (
  <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
    <path d="M12 2.6l2.9 6 6.6.9-4.8 4.7 1.2 6.6L12 18.9 6.1 20.8l1.2-6.6-4.8-4.7 6.6-.9L12 2.6z" />
  </svg>
);

export const Default: Story = {};

export const BlueWithIcon: Story = {
  args: {
    label: "Colección",
    tone: "blue",
    icon: StarIcon,
  } satisfies Partial<FrivButtonProps>,
};

export const LoadingLarge: Story = {
  args: {
    label: "Cargando...",
    tone: "green",
    size: "lg",
    loading: true,
  } satisfies Partial<FrivButtonProps>,
};

export const Disabled: Story = {
  args: {
    label: "Bloqueado",
    tone: "purple",
    disabled: true,
  } satisfies Partial<FrivButtonProps>,
};
