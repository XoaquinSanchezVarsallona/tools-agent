import React, { useEffect, useMemo, useRef, useState } from "react";
import "./XoacoGptCard.css";

type ChatRole = "user" | "assistant";

export type XoacoGptCardMessage = {
  role: ChatRole;
  content: string;
  storybook?: string;
};

export type XoacoGptCardProps = {
  /** Title shown in the header. */
  title?: string;
  /** Seed messages shown on first render (and re-synced when it changes). */
  initialMessages?: XoacoGptCardMessage[];
  /** Input placeholder. */
  placeholder?: string;
  /** Called when user sends a message. */
  onSend?: (text: string) => void;
  /** When true, disables the input/send button. */
  disabled?: boolean;
  /** When true, shows the typing indicator (controlled from outside). */
  busy?: boolean;
  /** Optional className for the outer card. */
  className?: string;
};

export function XoacoGptCard({
  title = "Xoaco GPT",
  initialMessages,
  placeholder = "Escribí tu mensaje…",
  onSend,
  disabled = false,
  busy = false,
  className,
}: XoacoGptCardProps) {
  const seeded = useMemo<XoacoGptCardMessage[]>(
    () =>
      initialMessages ?? [
        { role: "assistant", content: "Hola, soy Xoaco GPT. ¿En qué te ayudo?" },
      ],
    [initialMessages]
  );

  const [messages, setMessages] = useState<XoacoGptCardMessage[]>(seeded);
  const [text, setText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const demoTimerRef = useRef<number | null>(null);

  // Keep state in sync if the parent changes initialMessages.
  useEffect(() => {
    setMessages(seeded);
  }, [seeded]);

  // Cleanup any pending demo timeout to avoid setState on unmount.
  useEffect(() => {
    return () => {
      if (demoTimerRef.current != null) {
        window.clearTimeout(demoTimerRef.current);
        demoTimerRef.current = null;
      }
    };
  }, []);

  // Auto-scroll, but only if the user is already near the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const nearBottomThreshold = 64;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNearBottom = distanceFromBottom <= nearBottomThreshold;

    if (isNearBottom) {
      el.scrollTo({ top: el.scrollHeight });
    }
  }, [messages.length, isTyping, busy]);

  const showTyping = isTyping || busy;

  const send = () => {
    if (disabled || busy) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setText("");

    if (onSend) {
      onSend(trimmed);
      return;
    }

    // Local demo response, only when the card is not wired to a real backend.
    setIsTyping(true);

    if (demoTimerRef.current != null) {
      window.clearTimeout(demoTimerRef.current);
    }

    demoTimerRef.current = window.setTimeout(() => {
      setIsTyping(false);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Recibido. Si querés, conectame a tu API para responder con datos reales.",
        },
      ]);
      demoTimerRef.current = null;
    }, 650);
  };

  return (
    <section className={`xoacoCard ${className ?? ""}`.trim()} aria-label={title}>
      <header className="xoacoHeader">
        <div className="xoacoBadge" aria-hidden="true">
          XO
        </div>

        <div className="xoacoTitleWrap">
          <h3 className="xoacoTitle">{title}</h3>
          <p className="xoacoSubtitle">retro chat interface</p>
        </div>

        <div className="xoacoLights" aria-hidden="true">
          <span className="xoacoLight xoacoRed" />
          <span className="xoacoLight xoacoYellow" />
          <span className="xoacoLight xoacoGreen" />
        </div>
      </header>

      <div className="xoacoScreen">
        <div className="xoacoScanlines" aria-hidden="true" />

        <div className="xoacoMessages" ref={scrollRef} role="log" aria-live="polite">
          {messages.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={`xoacoRow ${m.role === "user" ? "isUser" : "isAssistant"}`}
            >
              <div className="xoacoBubble">
                <span className="xoacoRole">{m.role === "user" ? "Vos" : "Xoaco"}</span>
                <div className="xoacoText">{m.content}</div>
                {m.storybook && (
                  <a
                    href={m.storybook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="xoacoStoryLink"
                  >
                    📖 Ver en Storybook
                  </a>
                )}
              </div>
            </div>
          ))}

          {showTyping && (
            <div className="xoacoRow isAssistant">
              <div className="xoacoBubble">
                <span className="xoacoRole">Xoaco</span>
                <div className="xoacoText">
                  <span className="xoacoDots" aria-label="Escribiendo">
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <form
          className="xoacoInputBar"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            className="xoacoInput"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            aria-label="Mensaje"
            disabled={disabled}
          />
          <button className="xoacoSend" type="submit" disabled={disabled || busy}>
            SEND
          </button>
        </form>
      </div>

      <footer className="xoacoFooter" aria-hidden="true">
        <span>▲▼◄►</span>
        <span>START</span>
        <span>A / B</span>
      </footer>
    </section>
  );
}
