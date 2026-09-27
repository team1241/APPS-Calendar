"use client";

import { useCallback, useEffect, useState } from "react";
import { CATEGORIES, type CategoryKey } from "@/lib/calendar/calendar";

export function useSubteamFilter() {
  const [subteamFilter, setSubteamFilter] = useState<Set<CategoryKey>>(
    new Set(Object.keys(CATEGORIES) as CategoryKey[])
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersJustOpened, setFiltersJustOpened] = useState(false);

  const handleToggleSubteamFilter = useCallback((key: CategoryKey) => {
    setSubteamFilter((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);
  const handleToggleFilters = useCallback(() => {
    setFiltersOpen((open) => {
      const next = !open;
      setFiltersJustOpened(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!filtersOpen) {
      return;
    }
    const handleOutsidePointerDown = ({ target }: PointerEvent) => {
      if (!(target instanceof Element)) {
        return;
      }
      if (
        target.closest("#subteam-filter-popover") ||
        target.closest(".filter-btn")
      ) {
        return;
      }
      setFiltersOpen(false);
      setFiltersJustOpened(false);
    };
    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () =>
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, [filtersOpen]);
  useEffect(() => {
    if (!filtersJustOpened) {
      return;
    }
    const timer = setTimeout(() => setFiltersJustOpened(false), 200);
    return () => clearTimeout(timer);
  }, [filtersJustOpened]);

  return {
    filtersJustOpened,
    filtersOpen,
    handleToggleFilters,
    handleToggleSubteamFilter,
    subteamFilter,
  };
}
