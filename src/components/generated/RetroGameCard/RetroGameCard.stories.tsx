import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { RetroGameCard, type RetroGameCardProps } from "./RetroGameCard";

const meta: Meta<typeof RetroGameCard> = {
  title: "Generated/RetroGameCard",
  component: RetroGameCard,
  args: {
    title: "Fireball Frenzy",
    description: "Dispara, esquiva y consigue combos absurdos. Un clásico de navegador con caos pixelado.",
    tone: "pink",
    genre: "Arcade",
    ageRating: "+7",
    rating: 4.5,
    players: "1 jugador",
    timeToPlay: "3–5 min",
    tags: ["retro", "pixel", "rápido", "friv"],
    featured: true,
    playLabel: "Jugar",
    favoriteLabel: "Guardar",
    onPlay: () => alert("Play!"),
    onFavorite: () => alert("Favorito!"),
  } satisfies RetroGameCardProps,
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof RetroGameCard>;

export const Default: Story = {};

export const ConImagenPortada: Story = {
  args: {
    tone: "cyan",
    featured: false,
    title: "Neon Skate 2003",
    genre: "Deportes",
    rating: 4.1,
    imageSrc:
      "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=900&q=60",
    imageAlt: "Mando retro con luces neón",
    tags: ["neón", "skate", "trucos", "score"],
  },
};

export const VariasEtiquetasYDeshabilitada: Story = {
  args: {
    tone: "sunset",
    featured: true,
    title: "Dungeon Clicker Deluxe",
    genre: "Aventura",
    rating: 3.6,
    players: "1–2 jugadores",
    timeToPlay: "10 min",
    tags: ["mazmorra", "clicker", "boss", "loot", "llaves", "secretos", "hard"],
    disabled: true,
    onPlay: () => alert("No debería activarse"),
    onFavorite: () => alert("No debería activarse"),
  },
};
