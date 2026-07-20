import React, { useId } from "react";
import "./MarioBrosCard.css";

export type MarioBrosCardTone = "classic" | "night" | "world";
export type MarioBrosDifficulty = "Easy" | "Normal" | "Hard";

type ActionButtonProps = {
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary";
  ariaLabel?: string;
};

export type MarioBrosCardProps = {
  title?: string;
  subtitle?: string;
  description?: string;
  tone?: MarioBrosCardTone;
  difficulty?: MarioBrosDifficulty;
  coins?: number;
  lives?: number;
  featured?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onPlay?: () => void;
  onDetails?: () => void;
  playHref?: string;
  detailsHref?: string;
  playLabel?: string;
  detailsLabel?: string;
  className?: string;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function ActionButton({
  label,
  onClick,
  href,
  disabled,
  loading,
  variant = "primary",
  ariaLabel,
}: ActionButtonProps) {
  const isDisabled = Boolean(disabled || loading);

  const commonProps = {
    className: cx(
      "MarioBrosCard__btn",
      variant === "primary" ? "MarioBrosCard__btn--primary" : "MarioBrosCard__btn--secondary",
      loading && "is-loading"
    ),
    "aria-disabled": isDisabled ? true : undefined,
    "aria-busy": loading ? true : undefined,
  } as const;

  const content = (
    <>
      <span className="MarioBrosCard__btnLabel">{label}</span>
      <span className="MarioBrosCard__btnSpinner" aria-hidden="true" />
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
            e.stopPropagation();
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
      onClick={(e) => {
        if (isDisabled) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onClick?.();
      }}
      disabled={isDisabled}
      aria-label={ariaLabel || label}
    >
      {content}
    </button>
  );
}

export function MarioBrosCard({
  title = "Mario Bros",
  subtitle = "World 1-1",
  description = "Salta, junta monedas y encontrá el banderín. ¡Cuidado con los Goombas!",
  tone = "classic",
  difficulty = "Normal",
  coins = 12,
  lives = 3,
  featured,
  disabled,
  loading,
  onPlay,
  onDetails,
  playHref,
  detailsHref,
  playLabel = "Jugar",
  detailsLabel = "Detalles",
  className,
}: MarioBrosCardProps) {
  const uid = useId();
  const titleId = `mbc-title-${uid}`;
  const descId = `mbc-desc-${uid}`;

  return (
    <article
      className={cx(
        "MarioBrosCard",
        `MarioBrosCard--tone-${tone}`,
        featured && "is-featured",
        disabled && "is-disabled",
        loading && "is-loading",
        className
      )}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      data-tone={tone}
    >
      <div className="MarioBrosCard__shine" aria-hidden="true" />

      <header className="MarioBrosCard__header">
        <div className="MarioBrosCard__art" aria-hidden="true">
          <div className="MarioBrosCard__sky" />
          <div className="MarioBrosCard__cloud MarioBrosCard__cloud--a" />
          <div className="MarioBrosCard__cloud MarioBrosCard__cloud--b" />
          <div className="MarioBrosCard__hill" />
          <div className="MarioBrosCard__pipe" />
          <div className="MarioBrosCard__ground" />
          <div className="MarioBrosCard__blocks">
            <span className="MarioBrosCard__block MarioBrosCard__block--q" />
            <span className="MarioBrosCard__block" />
            <span className="MarioBrosCard__block" />
          </div>
          <div className="MarioBrosCard__mario" title="Mario" />

          {featured ? <span className="MarioBrosCard__ribbon">TOP</span> : null}
        </div>

        <div className="MarioBrosCard__titleArea">
          <h3 className="MarioBrosCard__title" id={titleId}>
            {title}
          </h3>
          <div className="MarioBrosCard__subtitle">{subtitle}</div>

          <div className="MarioBrosCard__stats" role="group" aria-label="Estadísticas">
            <span className="MarioBrosCard__chip" aria-label={`Dificultad ${difficulty}`}>
              {difficulty}
            </span>
            <span className="MarioBrosCard__chip" aria-label={`${coins} monedas`}>
              <span className="MarioBrosCard__chipIcon" aria-hidden="true">
                
              </span>
              {coins}
            </span>
            <span className="MarioBrosCard__chip" aria-label={`${lives} vidas`}>
              <span className="MarioBrosCard__chipIcon" aria-hidden="true">
                
              </span>
              {lives}
            </span>
          </div>
        </div>
      </header>

      {description ? (
        <p className="MarioBrosCard__desc" id={descId}>
          {description}
        </p>
      ) : null}

      <div className="MarioBrosCard__actions" role="group" aria-label="Acciones">
        <ActionButton
          label={loading ? "Cargando..." : playLabel}
          onClick={onPlay}
          href={playHref}
          disabled={disabled}
          loading={loading}
          variant="primary"
          ariaLabel={`${playLabel}: ${title}`}
        />
        <ActionButton
          label={detailsLabel}
          onClick={onDetails}
          href={detailsHref}
          disabled={disabled}
          variant="secondary"
          ariaLabel={`${detailsLabel}: ${title}`}
        />
      </div>

      <footer className="MarioBrosCard__footer" aria-hidden="true">
        <span className="MarioBrosCard__spark MarioBrosCard__spark--a" />
        <span className="MarioBrosCard__spark MarioBrosCard__spark--b" />
        <span className="MarioBrosCard__spark MarioBrosCard__spark--c" />
      </footer>
    </article>
  );
}
