import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function SectionCard({
  title,
  subtitle,
  actions,
  children,
}: SectionCardProps) {
  return (
    <section className="panel section-card">
      <div className="section-card__header">
        <div>
          <h2 className="section-card__title">{title}</h2>
          {subtitle ? <p className="section-card__subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="section-card__actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
