/**
 * Garden activity feed — derives a reverse-chronological list of events from
 * planting records (planted / harvested) and soil amendments. Shared by the
 * Journal view and the Home dashboard so both read the history the same way.
 * Watering and fertilizing events join here once those are modelled.
 */
import type { Planting, Amendment } from './api/client';

export type ActivityKind = 'planted' | 'harvested' | 'amended';

export interface Activity {
  id: string;
  date: string;
  kind: ActivityKind;
  title: string;
  bed: string;
}

export function buildActivity(
  plantings: Planting[],
  amendments: Amendment[],
  plantNames: Map<string, string>,
  bedNames: Map<string, string>,
): Activity[] {
  const events: Activity[] = [];

  for (const p of plantings) {
    const plant = plantNames.get(p.plantId) ?? 'a plant';
    const bed = bedNames.get(p.bedId) ?? 'a bed';
    const qty = p.quantity > 1 ? `${p.quantity} ` : '';
    if (p.plantedOn) {
      events.push({ id: `${p.id}:planted`, date: p.plantedOn, kind: 'planted', title: `Planted ${qty}${plant}`, bed });
    }
    if (p.harvestedOn) {
      events.push({ id: `${p.id}:harvested`, date: p.harvestedOn, kind: 'harvested', title: `Harvested ${plant}`, bed });
    }
  }

  for (const a of amendments) {
    const bed = bedNames.get(a.bedId) ?? 'a bed';
    const amt = a.amount != null ? ` (${a.amount}${a.amountUnit ? ` ${a.amountUnit}` : ''})` : '';
    events.push({ id: a.id, date: a.appliedOn, kind: 'amended', title: `Applied ${a.name}${amt}`, bed });
  }

  events.sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime());
  return events;
}

export function formatActivityDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
