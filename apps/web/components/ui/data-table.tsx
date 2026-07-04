import type { ReactNode } from "react";

type DataTableProps = {
  columns: string[];
  children: ReactNode;
};

export function DataTable({ columns, children }: DataTableProps) {
  return (
    <div className="table-shell">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
