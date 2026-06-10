/**
 * Planting-window rules for the plant directory. Windows are month ranges
 * (1-12, inclusive) per USDA zone, and may wrap across the new year
 * (e.g. a Nov->Feb overwintering window). Pure functions, no I/O.
 */

export interface PlantingWindow {
  zone: string;
  plantStartMonth: number;
  plantEndMonth: number;
  harvestStartMonth?: number | null;
  harvestEndMonth?: number | null;
  /** Set for a user override of the curated (ownerId null) window. */
  ownerId?: string | null;
}

/** Inclusive month-in-range test that supports wrap-around ranges. */
export function monthInRange(month: number, start: number, end: number): boolean {
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  if (start <= end) return month >= start && month <= end;
  // Wrap-around, e.g. start=11, end=2 covers Nov, Dec, Jan, Feb.
  return month >= start || month <= end;
}

/** Whether the plant can be sown/transplanted in `month` under this window. */
export function isPlantableInMonth(window: PlantingWindow, month: number): boolean {
  return monthInRange(month, window.plantStartMonth, window.plantEndMonth);
}

/** Whether any window exists for the given zone (i.e. the plant suits the zone). */
export function plantSuitableInZone(windows: PlantingWindow[], zone: string): boolean {
  return windows.some((w) => w.zone === zone);
}

/**
 * Choose the effective window for a plant + zone: a user override
 * (`ownerId` set) wins over the curated window (`ownerId` null). Returns null
 * when no window covers the zone.
 */
export function effectiveWindow(
  windows: PlantingWindow[],
  zone: string,
  userId?: string | null,
): PlantingWindow | null {
  const forZone = windows.filter((w) => w.zone === zone);
  if (forZone.length === 0) return null;
  if (userId) {
    const override = forZone.find((w) => w.ownerId === userId);
    if (override) return override;
  }
  return forZone.find((w) => w.ownerId == null) ?? forZone[0]!;
}

/**
 * Filter a set of plants (each with its windows) to those plantable in a given
 * zone and (optional) month. Used to back the directory's zone/season filters.
 */
export function filterByZoneAndMonth<T extends { windows: PlantingWindow[] }>(
  plants: T[],
  zone: string,
  month?: number,
): T[] {
  return plants.filter((p) => {
    const w = effectiveWindow(p.windows, zone);
    if (!w) return false;
    return month == null ? true : isPlantableInMonth(w, month);
  });
}
