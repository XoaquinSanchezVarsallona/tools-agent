import React from "react";
import "./MdButton.css";

export type MdButtonVariant = "filled" | "tonal" | "outlined" | "text";
export type MdButtonSize = "sm" | "md" | "lg";

export type MdButtonProps = {
  children: React.ReactNode;
  variant?: MdButtonVariant;
  size?: MdButtonSize;
  disabled?: boolean;
  loading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  fullWidth?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit" | "reset";
  /**
   * Optional accessible name override.
   * Prefer leaving this undefined when the button has visible text.
   */
  ariaLabel?: string;
  className?: string;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function MdButton({
  children,
  variant = "filled",
  size = "md",
  disabled = false,
  loading = false,
  leadingIcon,
  trailingIcon,
  fullWidth = false,
  onClick,
  type = "button",
  ariaLabel,
  className,
}: MdButtonProps) {
  const isDisabled = disabled || loading;

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    if (isDisabled) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick?.(e);
  };

  return (
    <button
      type={type}
      className={cx(
        "MdButton",
        `MdButton--${variant}`,
        `MdButton--${size}`,
        fullWidth && "MdButton--fullWidth",
        loading && "is-loading",
        isDisabled && "is-disabled",
        className
      )}
      onClick={handleClick}
      disabled={isDisabled}
      aria-disabled={isDisabled || undefined}
      aria-busy={loading || undefined}
      aria-label={ariaLabel}
    >
      <span className="MdButton__stateLayer" aria-hidden="true" />

      {leadingIcon ? (
        <span className="MdButton__icon MdButton__icon--leading" aria-hidden="true">
          {leadingIcon}
        </span>
      ) : null}

      <span className="MdButton__label">{children}</span>

      {trailingIcon ? (
        <span className="MdButton__icon MdButton__icon--trailing" aria-hidden="true">
          {trailingIcon}
        </span>
      ) : null}

      {loading ? (
        <span className="MdButton__spinner" aria-hidden="true">
          <span className="MdButton__spinnerDot" />
          <span className="MdButton__spinnerDot" />
          <span className="MdButton__spinnerDot" />
        </span>
      ) : null}
    </button>
  );
}
