"use client";

import { Skeleton } from "@/components/ui/skeleton";

function ChartTabsSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-center gap-2 mb-8">
        <Skeleton className="h-9 w-36 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>
      <Skeleton className="h-[300px] w-full rounded-lg" />
    </div>
  );
}

function TransactionTableSkeleton() {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-3 px-4">
                <Skeleton className="h-3 w-12" />
              </th>
              <th className="text-right py-3 px-4">
                <Skeleton className="h-3 w-16 ml-auto" />
              </th>
              <th className="text-right py-3 px-4">
                <Skeleton className="h-3 w-12 ml-auto" />
              </th>
              <th className="text-right py-3 px-4">
                <Skeleton className="h-3 w-12 ml-auto" />
              </th>
              <th className="text-left py-3 px-4">
                <Skeleton className="h-3 w-14" />
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-white/5">
                <td className="py-3 px-4">
                  <Skeleton className="h-4 w-36" />
                </td>
                <td className="py-3 px-4">
                  <Skeleton className="h-4 w-28 ml-auto" />
                </td>
                <td className="py-3 px-4">
                  <Skeleton className="h-4 w-20 ml-auto" />
                </td>
                <td className="py-3 px-4">
                  <Skeleton className="h-4 w-14 ml-auto" />
                </td>
                <td className="py-3 px-4">
                  <Skeleton className="h-4 w-48" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <>
      <div>
        <ChartTabsSkeleton />
      </div>

      <div className="mt-16">
        <Skeleton className="h-4 w-56 mb-4" />
        <TransactionTableSkeleton />
      </div>
    </>
  );
}
