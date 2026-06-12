/**
 * Thin typed API client. Talks to the documented Gardien API contract; shared
 * response types come from @gardien/shared so the client can't drift from the
 * server. The JWT is persisted to localStorage so a single-user session
 * survives reloads (and works against the offline cache).
 */
import type { AuthResponse } from '@gardien/shared';

const TOKEN_KEY = 'gardien.token';

// In dev the Vite proxy forwards /api to the backend; in prod set VITE_API_BASE_URL.
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // non-JSON error body; keep statusText
    }
    throw new ApiRequestError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export interface Garden {
  id: string;
  name: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  hardinessZone: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type BedType = 'raised_bed' | 'in_ground' | 'container' | 'greenhouse';

export interface Bed {
  id: string;
  name: string;
  bedType: BedType;
  location: string | null;
  soilType: string | null;
  // Canonical storage: millimetres for dimensions, square metres for area.
  lengthMm: number | null;
  widthMm: number | null;
  areaSqM: number | null;
  gardenId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type PlantingStatus = 'planned' | 'planted' | 'harvested' | 'removed';

export interface BedPlanting {
  id: string;
  quantity: number;
  status: PlantingStatus;
  plannedPlantDate: string | null;
  plannedHarvestDate: string | null;
  plantedOn: string | null;
  harvestedOn: string | null;
  notes: string | null;
  seasonId: string;
  plantId: string;
  plantName: string;
  plantSlug: string;
  plantType: string;
}

export interface BedAmendment {
  id: string;
  name: string;
  appliedOn: string;
  amount: number | null;
  amountUnit: string | null;
  notes: string | null;
  seasonId: string | null;
}

export interface SensorSnapshot {
  metric: string;
  value: number;
  unit: string;
  recordedAt: string;
}

export interface BedDetail extends Bed {
  current: BedPlanting[];
  history: BedPlanting[];
  amendments: BedAmendment[];
  sensors: SensorSnapshot[];
}

export interface Season {
  id: string;
  name: string;
  seasonType: string;
  year: number;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  notes: string | null;
}

/** A planting record as returned by the list endpoint (no embedded plant). */
export interface Planting {
  id: string;
  quantity: number;
  status: PlantingStatus;
  plannedPlantDate: string | null;
  plannedHarvestDate: string | null;
  plantedOn: string | null;
  harvestedOn: string | null;
  notes: string | null;
  bedId: string;
  plantId: string;
  seasonId: string;
}

/** A soil amendment as returned by the list endpoint. */
export interface Amendment {
  id: string;
  name: string;
  appliedOn: string;
  amount: number | null;
  amountUnit: string | null;
  notes: string | null;
  bedId: string;
  seasonId: string | null;
}

export interface GardenInput {
  name: string;
  description?: string;
  hardinessZone?: string;
}

export interface BedInput {
  name: string;
  bedType?: BedType;
  location?: string;
  soilType?: string;
  lengthMm?: number;
  widthMm?: number;
}

export interface AccountLocation {
  zipCode: string | null;
  hardinessZone: string | null;
  zoneIsManual: boolean;
  latitude: number | null;
  longitude: number | null;
}

export interface ZoneLookup {
  zip: string;
  hardinessZone: string;
  latitude: number | null;
  longitude: number | null;
  temperatureRange: string | null;
  source: 'api' | 'cache' | 'stale-cache';
}

export interface Plant {
  id: string;
  commonName: string;
  scientificName: string | null;
  slug: string;
  type: string;
  sun: string | null;
  water: string | null;
  feederType: string | null;
  spacingMm: number | null;
  rowSpacingMm: number | null;
  daysToMaturityMin: number | null;
  daysToMaturityMax: number | null;
  soilNotes: string | null;
  growingTips: string | null;
  commonMistakes: string | null;
  source: string | null;
  familyId: string | null;
}

export interface PlantWindow {
  id: string;
  zone: string;
  plantStartMonth: number;
  plantEndMonth: number;
  harvestStartMonth: number | null;
  harvestEndMonth: number | null;
  source: string | null;
  notes: string | null;
  ownerId: string | null;
}

export interface PlantIssue {
  id: string;
  kind: 'pest' | 'disease';
  name: string;
  description: string | null;
  management: string | null;
  source: string | null;
}

export interface PlantCompanion {
  linkId: string;
  plantId: string;
  relation: 'companion' | 'antagonist';
  reason: string | null;
}

export interface PlantDetail extends Plant {
  windows: PlantWindow[];
  issues: PlantIssue[];
  companions: PlantCompanion[];
}

export interface PlantFamily {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  rotationGroup: string | null;
  source: string | null;
}

export interface PlantSearchParams {
  q?: string;
  type?: string;
  familyId?: string;
  zone?: string;
  month?: number;
  companionOf?: string;
}

export interface PlanPlant {
  plantingId: string;
  plantId: string;
  name: string;
  quantity: number;
  status: PlantingStatus;
  plantStartMonth: number | null;
  plantEndMonth: number | null;
  harvestStartMonth: number | null;
  harvestEndMonth: number | null;
}

export interface PairFinding {
  plantAName: string;
  plantBName: string;
  reason: string | null;
}

export interface RotationFinding {
  plantName: string;
  lastSeasonsAgo: number;
  message: string;
}

export interface Capacity {
  areaSqM: number | null;
  usedSqM: number;
  overBy: number;
  over: boolean;
  unknown: string[];
}

export interface SuitabilityFinding {
  plantName: string;
  zone: string;
}

export interface BedPlan {
  bedId: string;
  bedName: string;
  seasonId: string;
  seasonName: string;
  zone: string | null;
  plants: PlanPlant[];
  capacity: Capacity;
  antagonists: PairFinding[];
  companions: PairFinding[];
  rotation: RotationFinding[];
  unsuitable: SuitabilityFinding[];
  warningCount: number;
}

export interface PlantingInput {
  bedId: string;
  plantId: string;
  seasonId: string;
  quantity?: number;
  status?: PlantingStatus;
  plannedPlantDate?: string;
  plannedHarvestDate?: string;
}

export interface SeasonInput {
  name: string;
  seasonType: string;
  year: number;
  isActive?: boolean;
}

export interface PlantRecommendation {
  plantId: string;
  name: string;
  reason: string;
}

export interface BedRecommendations {
  bedId: string;
  seasonId: string;
  zone: string | null;
  recommendations: PlantRecommendation[];
}

export interface AmendmentInput {
  bedId: string;
  name: string;
  appliedOn?: string;
  amount?: number;
  amountUnit?: string;
  seasonId?: string;
  notes?: string;
}

export interface ForecastDay {
  date: string;
  tempMinC: number | null;
  tempMaxC: number | null;
  precipMm: number | null;
}

export interface FrostWarning {
  date: string;
  tempMinC: number;
  severity: 'frost' | 'light-frost';
}

export interface PestWatch {
  plantName: string;
  name: string;
  kind: 'pest' | 'disease';
  management: string | null;
}

export interface WeatherAlerts {
  located: boolean;
  latitude: number | null;
  longitude: number | null;
  source: 'api' | 'cache' | 'stale-cache' | null;
  forecast: ForecastDay[];
  frostWarnings: FrostWarning[];
  pestWatch: PestWatch[];
}

export type SensorMetric = 'air_temp' | 'humidity' | 'soil_moisture' | 'water_level' | 'light';

export interface Device {
  id: string;
  name: string;
  bedId: string | null;
  batteryPct: number | null;
  firmwareVersion: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
export interface DeviceWithToken extends Device {
  token: string;
}
export interface SensorReading {
  id: string;
  metric: SensorMetric;
  value: number;
  unit: string;
  recordedAt: string;
}
export interface IrrigationConfig {
  enabled: boolean;
  thresholdPct: number;
  requestedRunMs: number;
  maxRunMs: number;
  minIntervalMs: number;
  staleAfterMs: number;
}
export interface IrrigationDecision {
  irrigate: boolean;
  runMs: number;
  reason: string;
  soilMoisturePct: number | null;
}
export interface IrrigationRun {
  id: string;
  startedAt: string;
  endedAt: string;
  runMs: number;
  reason: string;
  soilMoisturePct: number | null;
}
export interface IrrigationStatus {
  config: IrrigationConfig;
  decision: IrrigationDecision;
  recentRuns: IrrigationRun[];
}

export const api = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(res.token);
    return res;
  },
  logout(): void {
    setToken(null);
  },
  me() {
    return request<AuthResponse['user']>('/api/auth/me');
  },
  listGardens() {
    return request<Garden[]>('/api/gardens');
  },
  createGarden(input: GardenInput) {
    return request<Garden>('/api/gardens', { method: 'POST', body: JSON.stringify(input) });
  },
  updateGarden(id: string, input: Partial<GardenInput>) {
    return request<Garden>(`/api/gardens/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },
  archiveGarden(id: string) {
    return request<Garden>(`/api/gardens/${id}`, { method: 'DELETE' });
  },
  listBeds(gardenId: string, includeArchived = false) {
    const qs = new URLSearchParams({ gardenId });
    if (includeArchived) qs.set('includeArchived', 'true');
    return request<Bed[]>(`/api/beds?${qs.toString()}`);
  },
  createBed(input: BedInput & { gardenId: string }) {
    return request<Bed>('/api/beds', { method: 'POST', body: JSON.stringify(input) });
  },
  updateBed(id: string, input: Partial<BedInput>) {
    return request<Bed>(`/api/beds/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
  },
  archiveBed(id: string) {
    return request<Bed>(`/api/beds/${id}`, { method: 'DELETE' });
  },
  getBedDetail(id: string) {
    return request<BedDetail>(`/api/beds/${id}/detail`);
  },
  listSeasons() {
    return request<Season[]>('/api/seasons');
  },
  listPlantings(params: { bedId?: string; seasonId?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.bedId) qs.set('bedId', params.bedId);
    if (params.seasonId) qs.set('seasonId', params.seasonId);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<Planting[]>(`/api/plantings${suffix}`);
  },
  listAmendments(params: { bedId?: string; seasonId?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.bedId) qs.set('bedId', params.bedId);
    if (params.seasonId) qs.set('seasonId', params.seasonId);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<Amendment[]>(`/api/amendments${suffix}`);
  },
  getBedPlan(bedId: string, seasonId: string) {
    return request<BedPlan>(`/api/beds/${bedId}/plan?seasonId=${encodeURIComponent(seasonId)}`);
  },
  createPlanting(input: PlantingInput) {
    return request<Planting>('/api/plantings', { method: 'POST', body: JSON.stringify(input) });
  },
  updatePlanting(
    id: string,
    input: Partial<{
      quantity: number;
      status: PlantingStatus;
      plannedPlantDate: string;
      plannedHarvestDate: string;
      plantedOn: string;
      harvestedOn: string;
      notes: string;
    }>,
  ) {
    return request<Planting>(`/api/plantings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },
  archivePlanting(id: string) {
    return request<Planting>(`/api/plantings/${id}`, { method: 'DELETE' });
  },
  createSeason(input: SeasonInput) {
    return request<Season>('/api/seasons', { method: 'POST', body: JSON.stringify(input) });
  },
  getBedRecommendations(bedId: string, seasonId: string) {
    return request<BedRecommendations>(
      `/api/beds/${bedId}/recommendations?seasonId=${encodeURIComponent(seasonId)}`,
    );
  },
  createAmendment(input: AmendmentInput) {
    return request<Amendment>('/api/amendments', { method: 'POST', body: JSON.stringify(input) });
  },
  exportData() {
    return request<Record<string, unknown>>('/api/export');
  },
  importData(data: unknown) {
    return request<{
      gardens: number;
      beds: number;
      seasons: number;
      plantings: number;
      amendments: number;
      skippedPlantings: number;
    }>('/api/import', { method: 'POST', body: JSON.stringify(data) });
  },
  getWeather() {
    return request<WeatherAlerts>('/api/weather');
  },
  listDevices() {
    return request<Device[]>('/api/devices');
  },
  createDevice(input: { name: string; bedId?: string }) {
    return request<DeviceWithToken>('/api/devices', { method: 'POST', body: JSON.stringify(input) });
  },
  updateDevice(id: string, input: { name?: string; bedId?: string | null; firmwareVersion?: string }) {
    return request<Device>(`/api/devices/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
  },
  archiveDevice(id: string) {
    return request<Device>(`/api/devices/${id}`, { method: 'DELETE' });
  },
  rotateDeviceToken(id: string) {
    return request<DeviceWithToken>(`/api/devices/${id}/rotate-token`, { method: 'POST' });
  },
  getDeviceReadings(id: string, metric?: SensorMetric, limit = 100) {
    const qs = new URLSearchParams();
    if (metric) qs.set('metric', metric);
    qs.set('limit', String(limit));
    return request<SensorReading[]>(`/api/devices/${id}/readings?${qs.toString()}`);
  },
  getIrrigation(id: string) {
    return request<IrrigationStatus>(`/api/devices/${id}/irrigation`);
  },
  updateIrrigation(id: string, input: Partial<IrrigationConfig>) {
    return request<IrrigationConfig>(`/api/devices/${id}/irrigation`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },
  irrigateNow(id: string) {
    return request<IrrigationDecision>(`/api/devices/${id}/irrigate`, { method: 'POST' });
  },
  getZone() {
    return request<AccountLocation>('/api/zone');
  },
  lookupZone(zip: string) {
    return request<ZoneLookup>(`/api/zone/lookup?zip=${encodeURIComponent(zip)}`);
  },
  setZone(input: { zip?: string; hardinessZone?: string }) {
    return request<AccountLocation>('/api/zone', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },
  searchPlants(params: PlantSearchParams = {}) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') qs.set(key, String(value));
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<Plant[]>(`/api/plants${suffix}`);
  },
  getPlant(id: string) {
    return request<PlantDetail>(`/api/plants/${id}`);
  },
  listFamilies() {
    return request<PlantFamily[]>('/api/plants/families');
  },
};
