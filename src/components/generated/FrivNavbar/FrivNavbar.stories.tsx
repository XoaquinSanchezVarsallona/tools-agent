import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { FrivNavbar } from "./FrivNavbar";

const meta: Meta<typeof FrivNavbar> = {
  title: "Generated/FrivNavbar",
  component: FrivNavbar,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof FrivNavbar>;

export const Default: Story = {
  args: {
    brand: "FRIV-ARCADE",
    items: [
      { id: "games", label: "Juegos", href: "#games", tone: "blue" },
      { id: "new", label: "Nuevos", href: "#new", tone: "green" },
      { id: "top", label: "Top", href: "#top", tone: "yellow" },
      { id: "cats", label: "Categorías", href: "#cats", tone: "purple" },
    ],
    activeItemId: "games",
    showSearch: true,
    onSearch: (q) => console.log("search:", q),
  },
  render: (args) => (
    <div style={{ minHeight: "100vh", background: "#070712" }}>
      <FrivNavbar {...args} />
      <div style={{ padding: 16, color: "white", fontFamily: "system-ui" }}>
        Contenido…
      </div>
    </div>
  ),
};

export const NoSearch: Story = {
  args: {
    brand: "PIXEL PORTAL",
    items: [
      { id: "play", label: "Jugar", href: "#play", tone: "pink" },
      { id: "arcade", label: "Arcade", href: "#arcade", tone: "blue" },
      { id: "scores", label: "Scores", href: "#scores", tone: "yellow" },
    ],
    activeItemId: "arcade",
    showSearch: false,
  },
  render: (args) => (
    <div style={{ minHeight: "100vh", background: "#070712" }}>
      <FrivNavbar {...args} />
      <div style={{ padding: 16, color: "white", fontFamily: "system-ui" }}>
        Navbar sin buscador.
      </div>
    </div>
  ),
};

export const CustomRightActions: Story = {
  args: {
    brand: "ARCADE 2000",
    items: [
      { id: "home", label: "Home", href: "#home", tone: "green" },
      { id: "games", label: "Games", href: "#games", tone: "blue" },
      { id: "shop", label: "Shop", href: "#shop", tone: "purple" },
      { id: "news", label: "News", href: "#news", tone: "yellow" },
    ],
    activeItemId: "home",
    showSearch: true,
    rightActions: (
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <a className="FrivNavbar__chip" href="#coins">
          Monedas: 120
        </a>
        <a className="FrivNavbar__chip FrivNavbar__chip--hot" href="#play">
          PLAY
        </a>
      </div>
    ),
  },
  render: (args) => (
    <div style={{ minHeight: "100vh", background: "#070712" }}>
      <FrivNavbar {...args} />
      <div style={{ padding: 16, color: "white", fontFamily: "system-ui" }}>
        Navbar con acciones custom a la derecha.
      </div>
    </div>
  ),
};
