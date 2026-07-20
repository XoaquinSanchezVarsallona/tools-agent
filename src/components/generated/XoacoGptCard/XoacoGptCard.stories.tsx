import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { XoacoGptCard, type XoacoGptCardProps } from "./XoacoGptCard";

const meta: Meta<typeof XoacoGptCard> = {
  title: "generated/XoacoGptCard",
  component: XoacoGptCard,
  parameters: {
    layout: "centered",
  },
  args: {
    title: "Xoaco GPT",
  },
};

export default meta;

type Story = StoryObj<typeof XoacoGptCard>;

export const Default: Story = {
  args: {
    initialMessages: [
      { role: "assistant", content: "Hola, soy Xoaco GPT. ¿En qué te ayudo?" },
      { role: "user", content: "Haceme un componente con estilo retro." },
      {
        role: "assistant",
        content: "Dale: neón, scanlines, grilla y burbujas tipo chat.",
      },
    ],
  } satisfies XoacoGptCardProps,
};

export const LongConversation: Story = {
  args: {
    initialMessages: [
      { role: "assistant", content: "Bienvenido a Xoaco GPT." },
      {
        role: "user",
        content:
          "Necesito que el chat se vea como una retro game card, pero moderno tipo ChatGPT.",
      },
      {
        role: "assistant",
        content:
          "Listo. Te dejo burbujas diferenciadas, cabecera con luces y una pantalla con scanlines.",
      },
      {
        role: "user",
        content:
          "Sumale un input abajo y que auto-scrollee al final cuando envío mensajes.",
      },
      {
        role: "assistant",
        content:
          "Hecho: input + botón SEND, y scroll suave al final cuando llegan mensajes.",
      },
      {
        role: "user",
        content: "Perfecto. ¿Y el título?",
      },
      {
        role: "assistant",
        content: "Xoaco GPT, como pediste.",
      },
    ],
  } satisfies XoacoGptCardProps,
};

export const Disabled: Story = {
  args: {
    disabled: true,
    placeholder: "Chat deshabilitado",
    initialMessages: [
      { role: "assistant", content: "Modo demo: input deshabilitado." },
      { role: "user", content: "No puedo escribir…" },
      {
        role: "assistant",
        content: "Correcto: esto prueba el estado disabled del componente.",
      },
    ],
  } satisfies XoacoGptCardProps,
};
