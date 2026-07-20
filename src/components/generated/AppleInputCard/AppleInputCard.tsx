import React from "react";
import "./AppleInputCard.css";

export type AppleInputCardProps = {
  className?: string;

  title: string;
  description?: string;

  label?: string;
  placeholder?: string;

  /** Controlled value */
  value?: string;
  /** Uncontrolled initial value */
  defaultValue?: string;
  onChange?: (value: string) => void;

  helperText?: string;
  errorText?: string;

  disabled?: boolean;
  required?: boolean;

  ctaLabel?: string;
  onSubmit?: (value: string) => void;
};

function cx(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function AppleInputCard({
  className,
  title,
  description,
  label = "Input",
  placeholder = "Type something…",
  value,
  defaultValue,
  onChange,
  helperText,
  errorText,
  disabled,
  required,
  ctaLabel = "Continue",
  onSubmit,
}: AppleInputCardProps) {
  const reactId = React.useId();
  const inputId = `apple-input-card-${reactId}`;
  const helpId = `${inputId}-help`;
  const errId = `${inputId}-err`;

  const isControlled = typeof value === "string";
  const [innerValue, setInnerValue] = React.useState(defaultValue ?? "");
  const currentValue = isControlled ? (value as string) : innerValue;

  const isInvalid = Boolean(errorText);

  const commitChange = (next: string) => {
    if (!isControlled) setInnerValue(next);
    onChange?.(next);
  };

  return (
    <section
      className={cx(
        "AppleInputCard",
        disabled && "is-disabled",
        isInvalid && "is-invalid",
        className
      )}
      aria-disabled={disabled ? "true" : undefined}
    >
      <header className="AppleInputCard__header">
        <h3 className="AppleInputCard__title">{title}</h3>
        {description ? (
          <p className="AppleInputCard__description">{description}</p>
        ) : null}
      </header>

      <form
        className="AppleInputCard__form"
        onSubmit={(e) => {
          e.preventDefault();
          if (disabled) return;
          onSubmit?.(currentValue);
        }}
      >
        <div className="AppleInputCard__field">
          <label className="AppleInputCard__label" htmlFor={inputId}>
            {label} {required ? <span aria-hidden="true">*</span> : null}
          </label>

          <div className="AppleInputCard__inputWrap">
            <input
              id={inputId}
              className="AppleInputCard__input"
              type="text"
              placeholder={placeholder}
              value={currentValue}
              onChange={(e) => commitChange(e.target.value)}
              disabled={disabled}
              required={required}
              aria-invalid={isInvalid ? "true" : undefined}
              aria-describedby={isInvalid ? errId : helperText ? helpId : undefined}
            />
          </div>

          {isInvalid ? (
            <div
              className="AppleInputCard__message AppleInputCard__message--error"
              id={errId}
            >
              {errorText}
            </div>
          ) : helperText ? (
            <div className="AppleInputCard__message" id={helpId}>
              {helperText}
            </div>
          ) : null}
        </div>

        <div className="AppleInputCard__footer">
          <button className="AppleInputCard__cta" type="submit" disabled={disabled}>
            {ctaLabel}
          </button>
        </div>
      </form>
    </section>
  );
}
