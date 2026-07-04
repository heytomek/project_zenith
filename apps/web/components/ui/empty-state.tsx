import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  body?: string;
  action?: ReactNode;
};

export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {body ? <p>{body}</p> : null}
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
