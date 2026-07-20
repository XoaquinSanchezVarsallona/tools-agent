import React from "react";
import "./FinanceDashboardCard.css";

export type FinanceDashboardCardProps = {
  title?: string;
  periodLabel?: string;

  primaryKpiLabel?: string;
  primaryKpiValue?: string;
  primaryKpiDelta?: number;

  secondaryKpiLabel?: string;
  secondaryKpiValue?: string;
  secondaryKpiDelta?: number;

  tertiaryKpiLabel?: string;
  tertiaryKpiValue?: string;
  tertiaryKpiDelta?: number;

  note?: string;

  ctaLabel?: string;
  onCtaClick?: () => void;

  /** Makes the whole card clickable (in addition to CTA). */
  onCardClick?: () => void;

  /** Simple sparkline data (0..100 recommended). */
  sparkline?: number[];

  className?: string;
};

function formatDelta(delta?: number) {
  if (delta === undefined || Number.isNaN(delta)) return null;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}%`;
}

function deltaTone(delta?: number) {
  if (delta === undefined || Number.isNaN(delta) || delta === 0) return "neutral";
  return delta > 0 ? "positive" : "negative";
}

function sparkPath(data: number[]) {
  if (!data?.length) return "";
  const w = 120;
  const h = 36;
  const pad = 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(1, max - min);

  const toX = (i: number) => (i * (w - pad * 2)) / Math.max(1, data.length - 1) + pad;
  const toY = (v: number) => {
    const n = (v - min) / range;
    return h - pad - n * (h - pad * 2);
  };

  return data
    .map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(2)} ${toY(v).toFixed(2)}`)
    .join(" ");
}

export default function FinanceDashboardCard({
  title = "Dashboard financiero",
  periodLabel = "Últimos 30 días",

  primaryKpiLabel = "Balance",
  primaryKpiValue = "$ 12.450.000",
  primaryKpiDelta = 4.2,

  secondaryKpiLabel = "Ingresos",
  secondaryKpiValue = "$ 3.250.000",
  secondaryKpiDelta = 2.1,

  tertiaryKpiLabel = "Gastos",
  tertiaryKpiValue = "$ 1.980.000",
  tertiaryKpiDelta = -1.4,

  note = "Actualizado hace 5 min",

  ctaLabel = "Ver dashboard",
  onCtaClick,
  onCardClick,

  sparkline = [32, 40, 36, 52, 48, 60, 58, 66, 62, 74, 70, 82],
  className,
}: FinanceDashboardCardProps) {
  const cardClickable = typeof onCardClick === "function";
  const path = sparkPath(sparkline);

  return (
    <section
      className={["fdc-card", cardClickable ? "fdc-card--clickable" : "", className]
        .filter(Boolean)
        .join(" ")}
      onClick={cardClickable ? onCardClick : undefined}
      role={cardClickable ? "button" : undefined}
      tabIndex={cardClickable ? 0 : undefined}
      aria-label={cardClickable ? `${title}. ${periodLabel}` : undefined}
      onKeyDown={(e) => {
        if (!cardClickable) return;
        if (e.key === " ") {
          // Prevent page scroll when using Space on a button-like element.
          e.preventDefault();
        }
        if (e.key === "Enter") {
          onCardClick?.();
        }
      }}
      onKeyUp={(e) => {
        if (!cardClickable) return;
        if (e.key === " ") {
          onCardClick?.();
        }
      }}
    >
      <header className="fdc-header">
        <div className="fdc-header__titles">
          <h3 className="fdc-title">{title}</h3>
          <p className="fdc-subtitle">{periodLabel}</p>
        </div>

        <div className="fdc-spark" aria-hidden="true">
          <svg viewBox="0 0 120 36" className="fdc-spark__svg">
            <path d={path} className="fdc-spark__line" />
          </svg>
        </div>
      </header>

      <div className="fdc-kpis">
        <div className="fdc-kpi">
          <div className="fdc-kpi__top">
            <span className="fdc-kpi__label">{primaryKpiLabel}</span>
            <span className={`fdc-delta fdc-delta--${deltaTone(primaryKpiDelta)}`}>
              {formatDelta(primaryKpiDelta)}
            </span>
          </div>
          <div className="fdc-kpi__value">{primaryKpiValue}</div>
        </div>

        <div className="fdc-kpi">
          <div className="fdc-kpi__top">
            <span className="fdc-kpi__label">{secondaryKpiLabel}</span>
            <span className={`fdc-delta fdc-delta--${deltaTone(secondaryKpiDelta)}`}>
              {formatDelta(secondaryKpiDelta)}
            </span>
          </div>
          <div className="fdc-kpi__value">{secondaryKpiValue}</div>
        </div>

        <div className="fdc-kpi">
          <div className="fdc-kpi__top">
            <span className="fdc-kpi__label">{tertiaryKpiLabel}</span>
            <span className={`fdc-delta fdc-delta--${deltaTone(tertiaryKpiDelta)}`}>
              {formatDelta(tertiaryKpiDelta)}
            </span>
          </div>
          <div className="fdc-kpi__value">{tertiaryKpiValue}</div>
        </div>
      </div>

      <div className="fdc-footer">
        <button
          className="fdc-cta"
          type="button"
          onClick={(e) => {
            // If the card is clickable, keep CTA isolated without relying on stopPropagation at container level.
            e.stopPropagation();
            onCtaClick?.();
          }}
        >
          {ctaLabel}
        </button>
        <span className="fdc-note">{note}</span>
      </div>
    </section>
  );
}
