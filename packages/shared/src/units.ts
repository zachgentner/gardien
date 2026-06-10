/**
 * Explicit units. Per Gardien's "own your data" principle, all physical
 * quantities are STORED in canonical metric units and converted for display.
 * A measurement is always stored together with the unit it was entered in, so
 * nothing is ambiguous and imperial users never lose their original intent.
 */

export const LengthUnit = {
  Millimeter: 'mm',
  Centimeter: 'cm',
  Meter: 'm',
  Inch: 'in',
  Foot: 'ft',
} as const;
export type LengthUnit = (typeof LengthUnit)[keyof typeof LengthUnit];

export const AreaUnit = {
  SquareMeter: 'm2',
  SquareFoot: 'ft2',
} as const;
export type AreaUnit = (typeof AreaUnit)[keyof typeof AreaUnit];

export const TemperatureUnit = {
  Celsius: 'C',
  Fahrenheit: 'F',
} as const;
export type TemperatureUnit = (typeof TemperatureUnit)[keyof typeof TemperatureUnit];

export const UnitSystem = {
  Metric: 'metric',
  Imperial: 'imperial',
} as const;
export type UnitSystem = (typeof UnitSystem)[keyof typeof UnitSystem];

/** Canonical storage unit for lengths is the millimeter. */
const LENGTH_TO_MM: Record<LengthUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
};

export function lengthToMillimeters(value: number, unit: LengthUnit): number {
  return value * LENGTH_TO_MM[unit];
}

export function millimetersTo(value: number, unit: LengthUnit): number {
  return value / LENGTH_TO_MM[unit];
}

/** Canonical storage unit for areas is the square meter. */
const AREA_TO_M2: Record<AreaUnit, number> = {
  m2: 1,
  ft2: 0.09290304,
};

export function areaToSquareMeters(value: number, unit: AreaUnit): number {
  return value * AREA_TO_M2[unit];
}

export function squareMetersTo(value: number, unit: AreaUnit): number {
  return value / AREA_TO_M2[unit];
}

export function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

export function fahrenheitToCelsius(f: number): number {
  return ((f - 32) * 5) / 9;
}
