// Generic sortable data table (rule #78/#79/#89) — `columns` declares
// exactly which fields can be sorted (whitelist), never an arbitrary
// client-supplied field name reaching the backend.
import { useState } from "react";

export default function DataTable({ columns, rows, emptyMessage = "No data", getRowKey = (row, i) => row.id || row._id || i }) {
  const [sort, setSort] = useState(null);

  const sorted = sort
    ? [...rows].sort((a, b) => {
        const av = a[sort.key], bv = b[sort.key];
        const cmp = typeof av === "number" ? av - bv : String(av || "").localeCompare(String(bv || ""));
        return sort.dir === "asc" ? cmp : -cmp;
      })
    : rows;

  function toggleSort(col) {
    if (!col.sortable) return;
    setSort((prev) => (prev?.key === col.key ? { key: col.key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key: col.key, dir: "desc" }));
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-400 border-b border-gray-100 bg-gray-50">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => toggleSort(col)}
                className={`px-4 py-2.5 font-medium ${col.sortable ? "cursor-pointer select-none hover:text-gray-600" : ""}`}
              >
                {col.label}
                {sort?.key === col.key && <span className="ml-1">{sort.dir === "asc" ? "↑" : "↓"}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr><td colSpan={columns.length} className="text-center text-gray-400 py-10">{emptyMessage}</td></tr>
          )}
          {sorted.map((row, i) => (
            <tr key={getRowKey(row, i)} className="border-b border-gray-50 last:border-0">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-2.5 text-gray-700">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
