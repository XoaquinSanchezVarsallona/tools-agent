import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { EcomProductCard } from "./EcomProductCard";

const meta: Meta<typeof EcomProductCard> = {
  title: "Generated/EcomProductCard",
  component: EcomProductCard,
  parameters: { layout: "centered" },
  args: {
    title: "AirPods Pro (2nd generation) with MagSafe Case (USB‑C)",
    imageUrl:
      "https://images.fravega.com/f500/775324b9dc6cba8ffdb7f660c78447c5.jpg",
    badge: "New",
    outOfStock: false,
    price: { amount: 249, currency: "USD", locale: "en-US" },
    showAddButton: true,
    addLabel: "Add to cart",
  },
};

export default meta;
type Story = StoryObj<typeof EcomProductCard>;

export const Default: Story = {};

export const WithDiscount: Story = {
  args: {
    badge: "Limited",
    price: {
      amount: 199,
      originalAmount: 249,
      currency: "USD",
      locale: "en-US",
    },
  },
};

export const OutOfStock: Story = {
  args: {
    outOfStock: true,
  },
};

export const LoadingAdd: Story = {
  args: {
    loadingAdd: true,
  },
};

export const WithLongTitle: Story = {
  args: {
    title:
      "MacBook Air 13‑inch with M‑series chip — incredibly thin and light, built for Apple Intelligence, with all‑day battery life",
  },
};
