import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  XoacoGptCard,
  type XoacoGptCardMessage
} from "../src/components/generated/XoacoGptCard/XoacoGptCard";

function App() {
  const [messages, setMessages] = useState<XoacoGptCardMessage[]>([
    {
      role: "assistant",
      content:
        "Hola, soy Xoaco GPT conectado al coding agent. Pedime un componente y lo genero en el proyecto."
    }
  ]);
  const [busy, setBusy] = useState(false);

  const handleSend = async (text: string) => {
    const next: XoacoGptCardMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setBusy(true);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });
      const data = await response.json();

      if (!response.ok) {
        setMessages([
          ...next,
          {
            role: "assistant",
            content: `Error: ${String(data.error)}`
          }
        ]);
      } else {
        const reply = String(data.reply);
        const storybook = String(data.storybook ?? "");

        setMessages([
          ...next,
          {
            role: "assistant",
            content: reply,
            storybook: storybook || undefined
          }
        ]);
      }
    } catch (error) {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : String(error)}`
        }
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "radial-gradient(800px 400px at 15% 10%, rgba(255, 59, 212, 0.12), transparent 60%), radial-gradient(800px 400px at 85% 90%, rgba(0, 212, 255, 0.12), transparent 60%), #f4f4f6"
      }}
    >
      <XoacoGptCard onSend={handleSend} initialMessages={messages} busy={busy} />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
