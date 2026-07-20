import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { MarioBrosCard } from "./MarioBrosCard";

const meta: Meta<typeof MarioBrosCard> = {
  title: "Generated/MarioBrosCard",
  component: MarioBrosCard,
  parameters: { layout: "centered" },
  args: {
    title: "Mario Bros",
    subtitle: "World 1-1",
    description: "Salta, junta monedas y encontrá el banderín. ¡Cuidado con los Goombas!",
    difficulty: "Normal",
    coins: 12,
    lives: 3,
    featured: true,
    playLabel: "Jugar",
    detailsLabel: "Detalles",
  },
};

export default meta;
type Story = StoryObj<typeof MarioBrosCard>;

export const Default: Story = {};

export const NightTone: Story = {
  args: {
    tone: "night",
    subtitle: "World 1-2",
    difficulty: "Hard",
    coins: 99,
    lives: 1,
    featured: false,
  },
};

export const WorldTone: Story = {
  args: {
    tone: "world",
    subtitle: "World 2-1",
    difficulty: "Easy",
    coins: 3,
    lives: 5,
    featured: false,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};

export const Loading: Story = {
  args: {
    loading: true,
  },
};
