import { ReactNode } from "react";

type Column<T> = {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  emptyLabel?: string;
  getRowKey?: (row: T, index: number) => string | number;
};

export function DataTable<T>({
  columns,
  data,
  emptyLabel = "No rows to show",
  getRowKey,
}: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white/90 shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-neutral-50 text-left text-neutral-600">
          <tr>
            {columns.map((col) => (
              <th key={col.header} className={`px-4 py-3 font-medium ${col.className ?? ""}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {data.length === 0 ? (
            <tr>
              <td
                className="px-4 py-4 text-neutral-500"
                colSpan={columns.length}
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={getRowKey ? getRowKey(row, index) : index}
                className={index % 2 === 0 ? "bg-white/90" : "bg-neutral-50/80"}
              >
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className={`px-4 py-3 text-neutral-800 ${col.className ?? ""}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
