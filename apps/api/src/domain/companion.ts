/**
 * Companion-planting rules. Pure functions over plain data so they are trivial
 * to unit-test — this is core value and easy to get subtly wrong, so it lives
 * apart from the database and HTTP layers.
 */
import { CompanionRelation } from '@gardien/shared';

export interface PlantRef {
  id: string;
  name: string;
}

export interface CompanionEdge {
  aId: string;
  bId: string;
  relation: CompanionRelation;
  reason?: string;
}

export interface CompanionFinding {
  plantAId: string;
  plantBId: string;
  plantAName: string;
  plantBName: string;
  relation: CompanionRelation;
  reason?: string;
}

function edgeKey(x: string, y: string): string {
  return x < y ? `${x}::${y}` : `${y}::${x}`;
}

/**
 * Given the set of plants sharing a bed and a companion graph, return every
 * unordered pair present in the bed that has the requested relation. Edges are
 * treated as undirected; duplicate pairs are collapsed.
 */
function findPairs(
  plants: PlantRef[],
  edges: CompanionEdge[],
  relation: CompanionRelation,
): CompanionFinding[] {
  const present = new Map(plants.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const findings: CompanionFinding[] = [];

  for (const edge of edges) {
    if (edge.relation !== relation) continue;
    const a = present.get(edge.aId);
    const b = present.get(edge.bId);
    if (!a || !b || a.id === b.id) continue;

    const key = edgeKey(a.id, b.id);
    if (seen.has(key)) continue;
    seen.add(key);

    findings.push({
      plantAId: a.id,
      plantBId: b.id,
      plantAName: a.name,
      plantBName: b.name,
      relation,
      reason: edge.reason,
    });
  }

  return findings;
}

/** Pairs that should be kept apart — surfaced as plan-time warnings. */
export function findAntagonisticPairs(
  plants: PlantRef[],
  edges: CompanionEdge[],
): CompanionFinding[] {
  return findPairs(plants, edges, CompanionRelation.Antagonist);
}

/** Beneficial neighbours present in the bed — surfaced as positive hints. */
export function findCompanionPairs(plants: PlantRef[], edges: CompanionEdge[]): CompanionFinding[] {
  return findPairs(plants, edges, CompanionRelation.Companion);
}
