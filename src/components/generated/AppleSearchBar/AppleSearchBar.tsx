import React from "react";
import "./AppleSearchBar.css";

export type AppleSearchBarFilter = {
  id: string;
  label: string;
};

export type AppleSearchBarProps = {
  className?: string;

  /** Optional visible label (screen-reader friendly if you pass empty string and use ariaLabel). */
  label?: string;
  ariaLabel?: string;
  placeholder?: string;

  /** Controlled value */
  value?: string;
  /** Uncontrolled initial value */
  defaultValue?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;

  filters?: AppleSearchBarFilter[];

  /** Controlled selected filter ids */
  selectedFilterIds?: string[];
  /** Uncontrolled initial selected filter ids */
  defaultSelectedFilterIds?: string[];
  onToggleFilter?: (id: string, nextSelected: boolean) => void;

  disabled?: boolean;
  showSearchButton?: boolean;
  searchButtonLabel?: string;
};

function cx(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

function uniq(ids: string[]) {
  return Array.from(new Set(ids));
}

export function AppleSearchBar({
  className,
  label = "Search",
  ariaLabel,
  placeholder = "Search",
  value,
  defaultValue,
  onChange,
  onSearch,
  filters = [],
  selectedFilterIds,
  defaultSelectedFilterIds,
  onToggleFilter,
  disabled,
  showSearchButton = false,
  searchButtonLabel = "Search",
}: AppleSearchBarProps) {
  const reactId = React.useId();
  const inputId = `apple-searchbar-${reactId}`;

  const isValueControlled = typeof value === "string";
  const [innerValue, setInnerValue] = React.useState(defaultValue ?? "");
  const currentValue = isValueControlled ? (value as string) : innerValue;

  const isFiltersControlled = Array.isArray(selectedFilterIds);
  const [innerSelected, setInnerSelected] = React.useState<string[]>(
    defaultSelectedFilterIds ?? []
  );
  const currentSelected = isFiltersControlled ? (selectedFilterIds as string[]) : innerSelected;

  const commitValue = (next: string) => {
    if (!isValueControlled) setInnerValue(next);
    onChange?.(next);
  };

  const toggleFilter = (id: string) => {
    const isSelected = currentSelected.includes(id);
    const nextSelected = !isSelected;

    if (!isFiltersControlled) {
      const next = nextSelected
        ? uniq([...currentSelected, id])
        : currentSelected.filter((x) => x !== id);
      setInnerSelected(next);
    }

    onToggleFilter?.(id, nextSelected);
  };

  const submit = () => {
    if (disabled) return;
    onSearch?.(currentValue);
  };

  return (
    <form
      className={cx("AppleSearchBar", disabled && "is-disabled", className)}
      role="search"
      aria-disabled={disabled ? "true" : undefined}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="AppleSearchBar__row">
        <div className="AppleSearchBar__field">
          {label ? (
            <label className="AppleSearchBar__label" htmlFor={inputId}>
              {label}
            </label>
          ) : null}

          <div className="AppleSearchBar__inputWrap">
            <span className="AppleSearchBar__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                <path
                  d="M10.5 18.2a7.7 7.7 0 1 1 0-15.4 7.7 7.7 0 0 1 0 15.4Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M16.6 16.6 21 21"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </span>

            <input
              id={inputId}
              className="AppleSearchBar__input"
              type="search"
              placeholder={placeholder}
              value={currentValue}
              onChange={(e) => commitValue(e.target.value)}
              disabled={disabled}
              aria-label={ariaLabel ?? (label ? undefined : "Search")}
            />

            {currentValue ? (
              <button
                className="AppleSearchBar__clear"
                type="button"
                onClick={() => {
                  if (disabled) return;
                  commitValue("");
                }}
                aria-label="Clear search"
                disabled={disabled}
              >
                <span aria-hidden="true">×</span>
              </button>
            ) : null}
          </div>
        </div>

        {showSearchButton ? (
          <button
            className="AppleSearchBar__searchBtn"
            type="submit"
            disabled={disabled}
          >
            {searchButtonLabel}
          </button>
        ) : null}
      </div>

      {filters.length ? (
        <div className="AppleSearchBar__filters" aria-label="Filters">
          {filters.map((f) => {
            const selected = currentSelected.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                className={cx(
                  "AppleSearchBar__chip",
                  selected && "is-selected",
                  disabled && "is-disabled"
                )}
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => toggleFilter(f.id)}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </form>
  );
}
