import { describe, it, expect } from 'vitest';
import { CompanionRelation } from '@gardien/shared';
import {
  findAntagonisticPairs,
  findCompanionPairs,
  type CompanionEdge,
  type PlantRef,
} from '../src/domain/companion.js';

const tomato: PlantRef = { id: 'tomato', name: 'Tomato' };
const basil: PlantRef = { id: 'basil', name: 'Basil' };
const potato: PlantRef = { id: 'potato', name: 'Potato' };
const pepper: PlantRef = { id: 'pepper', name: 'Pepper' };

const edges: CompanionEdge[] = [
  { aId: 'tomato', bId: 'basil', relation: CompanionRelation.Companion, reason: 'pest deterrent' },
  { aId: 'tomato', bId: 'potato', relation: CompanionRelation.Antagonist, reason: 'shared blight' },
  { aId: 'pepper', bId: 'jalapeno', relation: CompanionRelation.Antagonist, reason: 'cross-pollination' },
];

describe('findAntagonisticPairs', () => {
  it('flags antagonists that are both present in the bed', () => {
    const findings = findAntagonisticPairs([tomato, potato, basil], edges);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.reason).toBe('shared blight');
  });

  it('ignores antagonist edges when only one plant is present', () => {
    const findings = findAntagonisticPairs([tomato, basil], edges);
    expect(findings).toHaveLength(0);
  });

  it('does not flag a missing partner (pepper without jalapeno)', () => {
    const findings = findAntagonisticPairs([pepper, tomato], edges);
    expect(findings).toHaveLength(0);
  });
});

describe('findCompanionPairs', () => {
  it('surfaces beneficial neighbours present together', () => {
    const findings = findCompanionPairs([tomato, basil], edges);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.plantAName).toBe('Tomato');
    expect(findings[0]?.relation).toBe(CompanionRelation.Companion);
  });

  it('collapses duplicate/reversed edges to a single finding', () => {
    const dupEdges: CompanionEdge[] = [
      ...edges,
      { aId: 'basil', bId: 'tomato', relation: CompanionRelation.Companion },
    ];
    const findings = findCompanionPairs([tomato, basil], dupEdges);
    expect(findings).toHaveLength(1);
  });
});
