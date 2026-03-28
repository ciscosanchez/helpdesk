"use client";

import { CATEGORY_LABELS, CATEGORY_COLORS, type TicketCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CategoryBadge({ category }: { category: string }) {
  const label = CATEGORY_LABELS[category as TicketCategory] ?? category;
  const color = CATEGORY_COLORS[category as TicketCategory] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", color)}>
      {label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: number }) {
  const colors: Record<number, string> = {
    1: "bg-red-100 text-red-800",
    2: "bg-orange-100 text-orange-800",
    3: "bg-yellow-100 text-yellow-800",
    4: "bg-blue-100 text-blue-800",
    5: "bg-gray-100 text-gray-500",
  };
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", colors[priority] ?? "bg-gray-100 text-gray-700")}>
      P{priority}
    </span>
  );
}
