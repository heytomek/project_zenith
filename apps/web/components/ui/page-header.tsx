import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  chips?: ReactNode;
  eyebrow?: string;
  icon?: LucideIcon;
};

export function PageHeader({
  title,
  description,
  actions,
  chips,
  eyebrow,
  icon: Icon,
}: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__copy">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        {Icon ? (
          <div className="page-header__icon-mark" aria-hidden="true">
            <Icon className="page-header__icon" />
          </div>
        ) : null}
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
        {chips ? <div className="page-header__chips">{chips}</div> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
