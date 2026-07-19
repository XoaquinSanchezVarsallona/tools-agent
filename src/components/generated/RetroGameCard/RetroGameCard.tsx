import React, { useId, useMemo } from "react";
import "./RetroGameCard.css";

export type RetroGameCardTone = "pink" | "lime" | "cyan" | "purple" | "sunset";

type ActionButtonProps = {
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary";
  ariaLabel?: string;
};

export type RetroGameCardProps = {
  title: string;
  description?: string;
  imageSrc?: string;
  imageAlt?: string;
  tone?: RetroGameCardTone;
  genre?: string;
  ageRating?: string;
  rating?: number; // 0..5
  players?: string;
  timeToPlay?: string;
  tags?: string[];
  featured?: boolean;
  disabled?: boolean;
  onPlay?: () => void;
  onFavorite?: () => void;
  playHref?: string;
  favoriteHref?: string;
  playLabel?: string;
  favoriteLabel?: string;
  className?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function ActionButton(props: ActionButtonProps) {
  const { label, onClick, href, disabled, loading, variant = "primary", ariaLabel } = props;
  const isDisabled = Boolean(disabled || loading);

  const commonProps = {
    className: [
      "rgc__btn",
      variant === "primary" ? "rgc__btn--primary" : "rgc__btn--secondary",
      loading ? "is-loading" : "",
    ]
      .filter(Boolean)
      .join(" "),
    "aria-disabled": isDisabled ? true : undefined,
    "aria-busy": loading ? true : undefined,
  } as const;

  const content = (
    <>
      <span className="rgc__btnLabel">{label}</span>
      <span className="rgc__btnSpinner" aria-hidden="true" />
    </>
  );

  if (href) {
    return (
      <a
        {...commonProps}
        href={isDisabled ? undefined : href}
        onClick={(e) => {
          if (isDisabled) {
            e.preventDefault();
            return;
          }
          onClick?.();
        }}
        aria-label={ariaLabel || label}
        tabIndex={isDisabled ? -1 : 0}
        role="button"
      >
        {content}
      </a>
    );
  }

  return (
    <button
      {...commonProps}
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      aria-label={ariaLabel || label}
    >
      {content}
    </button>
  );
}

export function RetroGameCard({
  title,
  description,
  imageSrc,
  imageAlt,
  tone = "pink",
  genre,
  ageRating,
  rating,
  players,
  timeToPlay,
  tags = [],
  featured,
  disabled,
  onPlay,
  onFavorite,
  playHref,
  favoriteHref,
  playLabel = "Jugar",
  favoriteLabel = "Favorito",
  className,
}: RetroGameCardProps) {
  const uid = useId();
  const titleId = `rgc-title-${uid}`;
  const descId = `rgc-desc-${uid}`;

  const safeRating = typeof rating === "number" ? clamp(rating, 0, 5) : undefined;
  const stars = useMemo(() => {
    if (safeRating == null) return null;
    const full = Math.floor(safeRating);
    const half = safeRating - full >= 0.5;
    const out: Array<"full" | "half" | "empty"> = [];
    for (let i = 0; i < 5; i++) {
      if (i < full) out.push("full");
      else if (i === full && half) out.push("half");
      else out.push("empty");
    }
    return out;
  }, [safeRating]);

  const resolvedAlt = imageAlt || (imageSrc ? `Portada de ${title}` : "");

  return (
    <article
      className={[
        "rgc",
        `rgc--tone-${tone}`,
        featured ? "is-featured" : "",
        disabled ? "is-disabled" : "",
        className || "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      data-tone={tone}
    >
      <div className="rgc__shine" aria-hidden="true" />
      <div className="rgc__header">
        <div className="rgc__art" aria-hidden={imageSrc ? undefined : true}>
          {imageSrc ? (
            <img className="rgc__img" src={imageSrc} alt={resolvedAlt} loading="lazy" />
          ) : (
            <div className="rgc__placeholder" role="img" aria-label={`Ilustración retro de ${title}`}>
              <span className="rgc__pixel">8</span>
              <span className="rgc__pixel">bit</span>
            </div>
          )}
          {featured ? <span className="rgc__ribbon">TOP</span> : null}
          {genre ? <span className="rgc__badge">{genre}</span> : null}
        </div>

        <div className="rgc__titleArea">
          <h3 className="rgc__title" id={titleId}>
            {title}
          </h3>
          <div className="rgc__meta" role="group" aria-label="Detalles del juego">
            {ageRating ? (
              <span className="rgc__chip" aria-label={`Clasificación por edad ${ageRating}`}>
                {ageRating}
              </span>
            ) : null}
            {players ? <span className="rgc__chip">{players}</span> : null}
            {timeToPlay ? <span className="rgc__chip">{timeToPlay}</span> : null}
          </div>

          {stars ? (
            <div className="rgc__rating" aria-label={`Valoración ${safeRating} de 5`}>
              {stars.map((t, idx) => (
                <span
                  key={idx}
                  className={["rgc__star", `rgc__star--${t}`].join(" ")}
                  aria-hidden="true"
                />
              ))}
              <span className="rgc__ratingText">{safeRating.toFixed(1)}</span>
            </div>
          ) : null}
        </div>
      </div>

      {description ? (
        <p className="rgc__desc" id={descId}>
          {description}
        </p>
      ) : null}

      {tags.length > 0 ? (
        <ul className="rgc__tags" aria-label="Etiquetas">
          {tags.slice(0, 6).map((t) => (
            <li key={t} className="rgc__tag">
              <span className="rgc__tagInner">#{t}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="rgc__actions" role="group" aria-label="Acciones">
        <ActionButton
          label={playLabel}
          onClick={onPlay}
          href={playHref}
          disabled={disabled}
          variant="primary"
          ariaLabel={`${playLabel}: ${title}`}
        />
        <ActionButton
          label={favoriteLabel}
          onClick={onFavorite}
          href={favoriteHref}
          disabled={disabled}
          variant="secondary"
          ariaLabel={`${favoriteLabel}: ${title}`}
        />
      </div>

      <div className="rgc__footer" aria-hidden="true">
        <span className="rgc__spark rgc__spark--a" />
        <span className="rgc__spark rgc__spark--b" />
        <span className="rgc__spark rgc__spark--c" />
      </div>
    </article>
  );
}
