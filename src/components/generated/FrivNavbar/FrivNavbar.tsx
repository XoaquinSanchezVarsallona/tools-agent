import React from "react";
import "./FrivNavbar.css";

export type FrivNavbarTone = "pink" | "blue" | "green" | "yellow" | "purple";

export type FrivNavbarItem = {
  id: string;
  label: string;
  href?: string;
  onClick?: () => void;
  tone?: FrivNavbarTone;
};

export type FrivNavbarProps = {
  brand?: string;
  brandHref?: string;
  items: FrivNavbarItem[];
  activeItemId?: string;

  showSearch?: boolean;
  searchPlaceholder?: string;
  onSearch?: (q: string) => void;

  rightActions?: React.ReactNode;
  className?: string;
  "aria-label"?: string;
};

export function FrivNavbar({
  brand = "ARCADE",
  brandHref = "#",
  items,
  activeItemId,
  showSearch = true,
  searchPlaceholder = "Buscar juegos…",
  onSearch,
  rightActions,
  className,
  "aria-label": ariaLabel = "Arcade navigation",
}: FrivNavbarProps) {
  const [q, setQ] = React.useState("");

  return (
    <nav className={`FrivNavbar ${className ?? ""}`} aria-label={ariaLabel}>
      <div className="FrivNavbar__inner">
        <a className="FrivNavbar__brand" href={brandHref} aria-label={brand}>
          <span className="FrivNavbar__brandText">{brand}</span>
          <span className="FrivNavbar__brandShine" aria-hidden="true" />
        </a>

        <div className="FrivNavbar__center">
          <div className="FrivNavbar__tabs" role="menubar" aria-label="Sections">
            {items.map((it) => {
              const isActive = it.id === activeItemId;
              const tone = it.tone ?? "blue";
              const cls = [
                "FrivNavbar__tab",
                `FrivNavbar__tab--${tone}`,
                isActive ? "is-active" : "",
              ]
                .filter(Boolean)
                .join(" ");

              const content = (
                <>
                  <span className="FrivNavbar__tabLabel">{it.label}</span>
                  <span className="FrivNavbar__tabShine" aria-hidden="true" />
                </>
              );

              if (it.href) {
                return (
                  <a
                    key={it.id}
                    href={it.href}
                    className={cls}
                    role="menuitem"
                    aria-current={isActive ? "page" : undefined}
                  >
                    {content}
                  </a>
                );
              }

              return (
                <button
                  key={it.id}
                  type="button"
                  className={cls}
                  role="menuitem"
                  onClick={it.onClick}
                  aria-current={isActive ? "page" : undefined}
                >
                  {content}
                </button>
              );
            })}
          </div>

          {showSearch && (
            <form
              className="FrivNavbar__search"
              onSubmit={(e) => {
                e.preventDefault();
                onSearch?.(q);
              }}
              role="search"
              aria-label="Search games"
            >
              <input
                className="FrivNavbar__searchInput"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
              />
              <button className="FrivNavbar__searchBtn" type="submit">
                GO
                <span className="FrivNavbar__searchBtnShine" aria-hidden="true" />
              </button>
            </form>
          )}
        </div>

        <div className="FrivNavbar__right">
          {rightActions ?? (
            <div className="FrivNavbar__rightDefault">
              <a className="FrivNavbar__chip" href="#">
                Favoritos
              </a>
              <a className="FrivNavbar__chip" href="#">
                Perfil
              </a>
              <a className="FrivNavbar__chip FrivNavbar__chip--hot" href="#">
                Login
              </a>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default FrivNavbar;
