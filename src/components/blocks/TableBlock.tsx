/**
 * TableBlock — sortable data table block for the BlockRenderer generative UI system.
 *
 * Phase 03, Plan 02: IL-03 block rendering.
 */

import { useState } from "react";
import type { TableBlockData } from "@/types/generative-blocks";

interface TableBlockProps {
  block: TableBlockData;
}

export function TableBlock({ block }: TableBlockProps) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const handleHeaderClick = (colIndex: number) => {
    if (sortCol === colIndex) {
      setSortAsc((prev) => !prev);
    } else {
      setSortCol(colIndex);
      setSortAsc(true);
    }
  };

  const sortedRows = sortCol === null
    ? block.rows
    : [...block.rows].sort((a, b) => {
        const av = a[sortCol];
        const bv = b[sortCol];
        if (av === bv) return 0;
        // Numeric sort when both values are numbers; lexicographic otherwise.
        // This prevents unreliable type coercion when columns mix numbers and strings.
        if (typeof av === "number" && typeof bv === "number") {
          return sortAsc ? av - bv : bv - av;
        }
        const cmp = String(av) < String(bv) ? -1 : 1;
        return sortAsc ? cmp : -cmp;
      });

  return (
    <div className="overflow-x-auto">
      <table className="text-base border-collapse w-full">
        <thead>
          <tr className="bg-(--secondary)">
            {block.columns.map((col, i) => (
              <th
                key={i}
                className="border border-(--border) px-3 py-2 cursor-pointer select-none uppercase tracking-wide text-sm text-(--muted-foreground) text-left"
                onClick={() => handleHeaderClick(i)}
              >
                {col}
                {sortCol === i ? (sortAsc ? " ▲" : " ▼") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="border border-(--border) px-3 py-2"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
