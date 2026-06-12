import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { errorResponses } from '../schemas/common.js';

/**
 * Data import (Phase 5, "own your data"). Accepts a document produced by
 * `GET /api/export` and recreates it under the *current* account. Additive:
 * every garden/bed/season/planting/amendment is created fresh (IDs are
 * remapped), so importing never overwrites existing data. The whole thing runs
 * in one transaction. Plantings resolve their plant by `plantSlug` against the
 * existing directory; anything that can't be resolved is skipped and counted.
 */

// Loose body: validate the version, pass the rest through and parse defensively.
const ImportBody = Type.Object({ version: Type.Number() }, { additionalProperties: true });

const ImportResult = Type.Object({
  gardens: Type.Integer(),
  beds: Type.Integer(),
  seasons: Type.Integer(),
  plantings: Type.Integer(),
  amendments: Type.Integer(),
  skippedPlantings: Type.Integer(),
});

interface Row {
  [key: string]: unknown;
}
const arr = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const date = (v: unknown): Date | null => {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const importRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook('onRequest', app.authenticate);

  app.post(
    '/',
    {
      schema: {
        tags: ['data'],
        summary: 'Import a JSON export into the current account (additive)',
        security: [{ bearerAuth: [] }],
        body: ImportBody,
        response: { 200: ImportResult, ...errorResponses },
      },
    },
    async (request, reply) => {
      const data = request.body as Record<string, unknown>;
      if (data.version !== 1) return reply.badRequest('Unsupported export version.');
      const ownerId = request.user.sub;

      const result = await app.prisma.$transaction(
        async (tx) => {
          const gardenMap = new Map<string, string>();
          for (const g of arr(data.gardens)) {
            const created = await tx.garden.create({
              data: {
                ownerId,
                name: str(g.name) ?? 'Imported garden',
                description: str(g.description),
                latitude: num(g.latitude),
                longitude: num(g.longitude),
                hardinessZone: str(g.hardinessZone),
              },
            });
            if (str(g.id)) gardenMap.set(str(g.id)!, created.id);
          }

          const bedMap = new Map<string, string>();
          for (const b of arr(data.beds)) {
            const gardenId = gardenMap.get(str(b.gardenId) ?? '');
            if (!gardenId) continue;
            const created = await tx.bed.create({
              data: {
                gardenId,
                name: str(b.name) ?? 'Imported bed',
                bedType: (str(b.bedType) ?? 'raised_bed') as 'raised_bed',
                location: str(b.location),
                soilType: str(b.soilType),
                lengthMm: num(b.lengthMm),
                widthMm: num(b.widthMm),
                areaSqM: num(b.areaSqM),
              },
            });
            if (str(b.id)) bedMap.set(str(b.id)!, created.id);
          }

          const seasonMap = new Map<string, string>();
          for (const s of arr(data.seasons)) {
            const created = await tx.season.create({
              data: {
                ownerId,
                name: str(s.name) ?? 'Imported season',
                seasonType: (str(s.seasonType) ?? 'spring') as 'spring',
                year: num(s.year) ?? new Date().getFullYear(),
                startDate: date(s.startDate),
                endDate: date(s.endDate),
                isActive: false,
                notes: str(s.notes),
              },
            });
            if (str(s.id)) seasonMap.set(str(s.id)!, created.id);
          }

          // Resolve plantings' plants by slug against the existing directory.
          const slugs = [
            ...new Set(arr(data.plantings).map((p) => str(p.plantSlug)).filter((x): x is string => !!x)),
          ];
          const plants = slugs.length
            ? await tx.plant.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } })
            : [];
          const plantBySlug = new Map(plants.map((p) => [p.slug, p.id]));

          let plantings = 0;
          let skippedPlantings = 0;
          for (const p of arr(data.plantings)) {
            const bedId = bedMap.get(str(p.bedId) ?? '');
            const seasonId = seasonMap.get(str(p.seasonId) ?? '');
            const plantId = plantBySlug.get(str(p.plantSlug) ?? '');
            if (!bedId || !seasonId || !plantId) {
              skippedPlantings++;
              continue;
            }
            await tx.plantingRecord.create({
              data: {
                bedId,
                seasonId,
                plantId,
                quantity: num(p.quantity) ?? 1,
                status: (str(p.status) ?? 'planned') as 'planned',
                plannedPlantDate: date(p.plannedPlantDate),
                plannedHarvestDate: date(p.plannedHarvestDate),
                plantedOn: date(p.plantedOn),
                harvestedOn: date(p.harvestedOn),
                notes: str(p.notes),
              },
            });
            plantings++;
          }

          let amendments = 0;
          for (const a of arr(data.amendments)) {
            const bedId = bedMap.get(str(a.bedId) ?? '');
            if (!bedId) continue;
            await tx.soilAmendment.create({
              data: {
                bedId,
                seasonId: a.seasonId ? (seasonMap.get(str(a.seasonId)!) ?? null) : null,
                name: str(a.name) ?? 'Imported amendment',
                appliedOn: date(a.appliedOn) ?? new Date(),
                amount: num(a.amount),
                amountUnit: str(a.amountUnit),
                notes: str(a.notes),
              },
            });
            amendments++;
          }

          return {
            gardens: gardenMap.size,
            beds: bedMap.size,
            seasons: seasonMap.size,
            plantings,
            amendments,
            skippedPlantings,
          };
        },
        { timeout: 20000 },
      );

      return result;
    },
  );
};
