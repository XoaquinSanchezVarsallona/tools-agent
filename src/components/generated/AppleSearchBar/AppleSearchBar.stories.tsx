import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { AppleSearchBar } from "./AppleSearchBar";

const meta: Meta<typeof AppleSearchBar> = {
  title: "Generated/AppleSearchBar",
  component: AppleSearchBar,
  parameters: { layout: "centered" },
  args: {
    label: "Search",
    placeholder: "Search products, categories…",
    filters: [
      { id: "all", label: "All" },
      { id: "new", label: "New" },
      { id: "popular", label: "Popular" },
      { id: "sale", label: "On sale" },
      { id: "in-stock", label: "In stock" },
    ],
    defaultSelectedFilterIds: ["all"],
    defaultValue: "AirPods",
  },
};

export default meta;
type Story = StoryObj<typeof AppleSearchBar>;

export const Default: Story = {};

export const WithButton: Story = {
  args: {
    showSearchButton: true,
    searchButtonLabel: "Search",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    showSearchButton: true,
  },
};
