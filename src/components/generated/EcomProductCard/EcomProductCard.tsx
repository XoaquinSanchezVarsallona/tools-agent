import React from "react";
import "./EcomProductCard.css";

export type EcomProductCardPrice = {
  amount: number;
  currency?: string;
  locale?: string;
  originalAmount?: number | null;
};

export type EcomProductCardProps = {
  title: string;
  imageUrl: string;
  imageAlt?: string;
  badge?: string;
  outOfStock?: boolean;

  price: EcomProductCardPrice;

  onOpen?: () => void;

  showAddButton?: boolean;
  onAdd?: () => void;
  addLabel?: string;
  loadingAdd?: boolean;
  disabledAdd?: boolean;

  className?: string;
};

function formatMoney(
  amount: number,
  locale: string,
  currency: string
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function PriceInline({ price }: { price: EcomProductCardPrice }) {
  const locale = price.locale ?? "en-US";
  const currency = price.currency ?? "USD";
  const hasDiscount =
    typeof price.originalAmount === "number" && price.originalAmount > price.amount;

  const current = formatMoney(price.amount, locale, currency);
  const original = hasDiscount
    ? formatMoney(price.originalAmount as number, locale, currency)
    : null;

  return (
    <div
      className={[
        "EcomProductCard__price",
        hasDiscount ? "EcomProductCard__price--discount" : "",
      ].join(" ")}
      aria-label={hasDiscount ? `Price ${current}, originally ${original}` : `Price ${current}`}
    >
      <span className="EcomProductCard__priceCurrent">{current}</span>
      {hasDiscount ? (
        <span className="EcomProductCard__priceOriginal" aria-hidden="true">
          {original}
        </span>
      ) : null}
    </div>
  );
}

export function EcomProductCard({
  title,
  imageUrl,
  imageAlt,
  badge,
  outOfStock = false,
  price,
  onOpen,
  showAddButton = true,
  onAdd,
  addLabel = "Add",
  loadingAdd = false,
  disabledAdd = false,
  className,
}: EcomProductCardProps) {
  const addDisabled = outOfStock || disabledAdd || loadingAdd;

  return (
    <article className={["EcomProductCard", className ?? ""].join(" ")}>
      <button
        type="button"
        className="EcomProductCard__surface"
        onClick={onOpen}
        aria-label={`Open product: ${title}`}
      >
        <div className="EcomProductCard__media">
          <img
            className="EcomProductCard__img"
            src={imageUrl}
            alt={imageAlt ?? title}
            loading="lazy"
          />
          {badge ? <span className="EcomProductCard__badge">{badge}</span> : null}
          {outOfStock ? (
            <span className="EcomProductCard__stock" aria-label="Out of stock">
              Out of stock
            </span>
          ) : null}
        </div>

        <div className="EcomProductCard__content">
          <div className="EcomProductCard__title" title={title}>
            {title}
          </div>

          <div className="EcomProductCard__priceRow">
            <PriceInline price={price} />
          </div>
        </div>
      </button>

      {showAddButton ? (
        <div className="EcomProductCard__actions">
          <button
            type="button"
            className="EcomProductCard__addBtn"
            onClick={onAdd}
            disabled={addDisabled}
            aria-disabled={addDisabled || undefined}
            aria-busy={loadingAdd || undefined}
          >
            {loadingAdd ? "Adding…" : addLabel}
          </button>
        </div>
      ) : null}
    </article>
  );
}
