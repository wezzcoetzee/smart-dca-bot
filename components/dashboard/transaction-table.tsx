"use client";

import { useState } from "react";
import type { TransactionRow } from "@/types/dashboard";
import { formatDateTimeUTC } from "@/lib/date";

const PAGE_SIZE = 10;

interface TransactionTableProps {
  transactions: TransactionRow[];
  ticker?: string;
}

export function TransactionTable({
  transactions,
  ticker = "BTC",
}: TransactionTableProps) {
  const [currentPage, setCurrentPage] = useState(1);

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-white/40">
        No programatic transactions in this period
      </div>
    );
  }

  const totalPages = Math.ceil(transactions.length / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedTransactions = transactions.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-3 px-4 text-xs font-medium tracking-wider text-white/40 uppercase">
                Date
              </th>
              <th className="text-right py-3 px-4 text-xs font-medium tracking-wider text-white/40 uppercase">
                Amount
              </th>
              <th className="text-right py-3 px-4 text-xs font-medium tracking-wider text-white/40 uppercase">
                Price
              </th>
              <th className="text-right py-3 px-4 text-xs font-medium tracking-wider text-white/40 uppercase">
                Value
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium tracking-wider text-white/40 uppercase">
                Reason
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedTransactions.map((tx) => (
              <tr
                key={tx.id}
                className="border-b border-white/5 hover:bg-white/5 transition-colors"
              >
                <td className="py-3 px-4 text-sm text-white/70">
                  {formatDateTimeUTC(tx.date)}
                </td>
                <td className="py-3 px-4 text-sm text-white tabular-nums text-right">
                  {tx.amount.toFixed(8)} {ticker}
                </td>
                <td className="py-3 px-4 text-sm text-white/70 tabular-nums text-right">
                  $
                  {tx.price.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="py-3 px-4 text-sm text-white tabular-nums text-right">
                  $
                  {(tx.amount * tx.price).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td className="py-3 px-4 text-sm text-white/50">{tx.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-4">
          <span className="text-xs text-white/40">
            {startIndex + 1}-{Math.min(startIndex + PAGE_SIZE, transactions.length)} of{" "}
            {transactions.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm rounded-md bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Prev
            </button>
            <span className="text-sm text-white/50 tabular-nums">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm rounded-md bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
