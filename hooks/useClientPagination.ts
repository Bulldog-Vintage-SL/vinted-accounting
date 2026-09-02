"use client";

import { useEffect, useMemo, useState } from "react";

export const INVENTORY_PAGE_SIZE = 20;

export function useClientPagination<T>(
  items: T[],
  pageSize = INVENTORY_PAGE_SIZE,
  resetKey?: string | number
) {
  const [requestedPage, setRequestedPage] = useState(1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setRequestedPage(1);
  }, [resetKey]);

  const page = Math.min(requestedPage, totalPages);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return {
    page,
    setPage: setRequestedPage,
    pageItems,
    totalPages,
    from,
    to,
    total,
    pageSize,
  };
}
