import React from "react";
import "./FrivButton.css";

export type FrivButtonTone = "pink" | "blue" | "green" | "yellow" | "purple";
export type FrivButtonSize = "sm" | "md" | "lg";

export type FrivButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "disabled"
> & {
  /** Button label */
  label: string;
  /** Color theme reminiscent of early-2000s web games */
  tone?: FrivButtonTone;
  /** Size controls padding/height/font size */
  size?: FrivButtonSize;
  /** Optional icon shown before the label */
  icon?: React.ReactNode;
  /** Shows a spinner and prevents repeated activation */
  loading?: boolean;
  /** Disabled state */
  disabled?: boolean;
};

export function FrivButton({
  label,
  tone = "pink",
  size = "md",
  icon,
  loading = false,
  disabled = false,
  className,
  type = "button",
  onClick,
  ...rest
}: FrivButtonProps) {
  const isDisabled = disabled || loading;

  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    if (isDisabled) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  const classes = [
    "FrivButton",
    `FrivButton--${tone}`,
    `FrivButton--${size}`,
    loading ? "is-loading" : "",
    isDisabled ? "is-disabled" : "",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...rest}
      type={type}
      className={classes}
      onClick={handleClick}
      disabled={isDisabled}
      aria-disabled={isDisabled || undefined}
      aria-busy={loading || undefined}
    >
      <span className="FrivButton__shine" aria-hidden="true" />
      <span className="FrivButton__content">
        {icon ? (
          <span className="FrivButton__icon" aria-hidden="true">
            {icon}
          </span>
        ) : null}

        <span className="FrivButton__label" data-label={label}>
          {label}
        </span>

        {loading ? (
          <span className="FrivButton__spinner" aria-hidden="true" />
        ) : null}
      </span>
    </button>
  );
}
