"use client";

import { useCallback, useState } from "react";
import {
  applyThemePreference,
  readThemePreference,
  type ThemePreference,
} from "@/lib/theme";

/**
 * @brief The viewer's saved theme and a setter that applies and persists it.
 */
export function useThemePreference() {
  const [preference, setPreferenceState] =
    useState<ThemePreference>(readThemePreference);

  const setPreference = useCallback((next: ThemePreference) => {
    applyThemePreference(next);
    setPreferenceState(next);
  }, []);

  return { preference, setPreference };
}
