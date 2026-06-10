/** Domain enumerations shared by the API and the web client. */

export const PlantType = {
  Vegetable: 'vegetable',
  Fruit: 'fruit',
  Herb: 'herb',
  Flower: 'flower',
  CoverCrop: 'cover_crop',
} as const;
export type PlantType = (typeof PlantType)[keyof typeof PlantType];

export const SunRequirement = {
  FullSun: 'full_sun',
  PartialSun: 'partial_sun',
  PartialShade: 'partial_shade',
  FullShade: 'full_shade',
} as const;
export type SunRequirement = (typeof SunRequirement)[keyof typeof SunRequirement];

export const WaterRequirement = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
} as const;
export type WaterRequirement = (typeof WaterRequirement)[keyof typeof WaterRequirement];

/** How heavily a plant draws on soil nutrients — drives rotation suggestions. */
export const FeederType = {
  Heavy: 'heavy',
  Medium: 'medium',
  Light: 'light',
  Fixer: 'fixer', // legumes that enrich the soil with nitrogen
} as const;
export type FeederType = (typeof FeederType)[keyof typeof FeederType];

export const BedType = {
  RaisedBed: 'raised_bed',
  InGround: 'in_ground',
  Container: 'container',
  Greenhouse: 'greenhouse',
} as const;
export type BedType = (typeof BedType)[keyof typeof BedType];

/** Seasons are first-class entities; this is their type, not a free string. */
export const SeasonType = {
  Spring: 'spring',
  Summer: 'summer',
  Fall: 'fall',
  Winter: 'winter',
} as const;
export type SeasonType = (typeof SeasonType)[keyof typeof SeasonType];

/** Relationship between two plants, used for plan-time conflict detection. */
export const CompanionRelation = {
  /** Beneficial neighbors. */
  Companion: 'companion',
  /** Should be kept apart (pest attraction, cross-pollination, allelopathy). */
  Antagonist: 'antagonist',
} as const;
export type CompanionRelation = (typeof CompanionRelation)[keyof typeof CompanionRelation];

export const UserRole = {
  /** Single-user owner today; structured so multi-user can be enabled later. */
  Owner: 'owner',
  Member: 'member',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];
