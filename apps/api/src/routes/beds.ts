import { Type, type Static } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { CompanionRelation } from '@gardien/shared';
import { IdParam, Timestamps, NullableDateTime, DateTime, errorResponses } from '../schemas/common.js';
import { deriveAreaSqM, partitionPlantings, type PlantingStatus } from '../domain/bed.js';
import {
  findAntagonisticPairs,
  findCompanionPairs,
  type CompanionEdge,
  type PlantRef,
} from '../domain/companion.js';
import { checkRotation, type BedHistoryEntry } from '../domain/rotation.js';
import { evaluateCapacity, type SpacedPlanting } from '../domain/spacing.js';

const SEASON_ORDER: Record<string, number> = { spring: 0, summer: 1, fall: 2, winter: 3 };

const BedTypeEnum = Type.Union([
  Type.Literal('raised_bed'),
  Type.Literal('in_ground'),
  Type.Literal('container'),
  Type.Literal('greenhouse'),
]);

const Bed = Type.Object({
  id: Type.String(),
  name: Type.String(),
  bedType: BedTypeEnum,
  location: Type.Union([Type.String(), Type.Null()]),
  soilType: Type.Union([Type.String(), Type.Null()]),
  // Explicit units: millimetres for dimensions, square metres for area.
  lengthMm: Type.Union([Type.Integer(), Type.Null()]),
  widthMm: Type.Union([Type.Integer(), Type.Null()]),
  areaSqM: Type.Union([Type.Number(), Type.Null()]),
  gardenId: Type.String(),
  ...Timestamps,
});

const BedCreate = Type.Object({
  gardenId: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1, maxLength: 120 }),
  bedType: Type.Optional(BedTypeEnum),
  location: Type.Optional(Type.String({ maxLength: 500 })),
  soilType: Type.Optional(Type.String({ maxLength: 120 })),
  lengthMm: Type.Optional(Type.Integer({ minimum: 0 })),
  widthMm: Type.Optional(Type.Integer({ minimum: 0 })),
});

const BedUpdate = Type.Partial(Type.Omit(BedCreate, ['gardenId']));

const ListBedsQuery = Type.Object({
  gardenId: Type.String({ minLength: 1 }),
  includeArchived: Type.Optional(Type.Boolean({ default: false })),
});

const PlantingStatusEnum = Type.Union([
  Type.Literal('planned'),
  Type.Literal('planted'),
  Type.Literal('harvested'),
  Type.Literal('removed'),
]);

/** A planting in the bed-detail view, enriched with its plant's name. */
const BedPlanting = Type.Object({
  id: Type.String(),
  quantity: Type.Integer(),
  status: PlantingStatusEnum,
  plannedPlantDate: NullableDateTime,
  plannedHarvestDate: NullableDateTime,
  plantedOn: NullableDateTime,
  harvestedOn: NullableDateTime,
  notes: Type.Union([Type.String(), Type.Null()]),
  seasonId: Type.String(),
  plantId: Type.String(),
  plantName: Type.String(),
  plantSlug: Type.String(),
  plantType: Type.String(),
});

const BedAmendment = Type.Object({
  id: Type.String(),
  name: Type.String(),
  appliedOn: DateTime,
  amount: Type.Union([Type.Number(), Type.Null()]),
  amountUnit: Type.Union([Type.String(), Type.Null()]),
  notes: Type.Union([Type.String(), Type.Null()]),
  seasonId: Type.Union([Type.String(), Type.Null()]),
});

/**
 * A bed plus its current plantings, past planting history, and soil amendments
 * — the single read that backs the Phase 3 bed-detail view.
 */
const BedDetail = Type.Intersect([
  Bed,
  Type.Object({
    current: Type.Array(BedPlanting),
    history: Type.Array(BedPlanting),
    amendments: Type.Array(BedAmendment),
  }),
]);

const ListPlanQuery = Type.Object({
  seasonId: Type.String({ minLength: 1 }),
});

const PlanPlant = Type.Object({
  plantingId: Type.String(),
  plantId: Type.String(),
  name: Type.String(),
  quantity: Type.Integer(),
  status: PlantingStatusEnum,
});

const PairFinding = Type.Object({
  plantAName: Type.String(),
  plantBName: Type.String(),
  reason: Type.Union([Type.String(), Type.Null()]),
});

const RotationFinding = Type.Object({
  plantName: Type.String(),
  lastSeasonsAgo: Type.Integer(),
  message: Type.String(),
});

const Capacity = Type.Object({
  areaSqM: Type.Union([Type.Number(), Type.Null()]),
  usedSqM: Type.Number(),
  overBy: Type.Number(),
  over: Type.Boolean(),
  unknown: Type.Array(Type.String()),
});

const SuitabilityFinding = Type.Object({ plantName: Type.String(), zone: Type.String() });

/**
 * Plan-time conflict report for a bed in a season: what's slated, plus
 * incompatible neighbours, rotation violations, overcrowding, and zone
 * suitability — surfaced before anything goes in the ground (Phase 4).
 */
const BedPlan = Type.Object({
  bedId: Type.String(),
  bedName: Type.String(),
  seasonId: Type.String(),
  seasonName: Type.String(),
  zone: Type.Union([Type.String(), Type.Null()]),
  plants: Type.Array(PlanPlant),
  capacity: Capacity,
  antagonists: Type.Array(PairFinding),
  companions: Type.Array(PairFinding),
  rotation: Type.Array(RotationFinding),
  unsuitable: Type.Array(SuitabilityFinding),
  warningCount: Type.Integer(),
});

export const bedRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook('onRequest', app.authenticate);

  const ownsGarden = (gardenId: string, userId: string) =>
    app.prisma.garden.findFirst({ where: { id: gardenId, ownerId: userId } });

  app.get(
    '/',
    {
      schema: {
        tags: ['beds'],
        summary: 'List beds in a garden',
        security: [{ bearerAuth: [] }],
        querystring: ListBedsQuery,
        response: { 200: Type.Array(Bed), ...errorResponses },
      },
    },
    async (request, reply) => {
      const garden = await ownsGarden(request.query.gardenId, request.user.sub);
      if (!garden) return reply.notFound('Garden not found.');
      return app.prisma.bed.findMany({
        where: {
          gardenId: garden.id,
          ...(request.query.includeArchived ? {} : { deletedAt: null }),
        },
        orderBy: { createdAt: 'asc' },
      });
    },
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['beds'],
        summary: 'Create a bed',
        security: [{ bearerAuth: [] }],
        body: BedCreate,
        response: { 201: Bed, ...errorResponses },
      },
    },
    async (request, reply) => {
      const garden = await ownsGarden(request.body.gardenId, request.user.sub);
      if (!garden) return reply.notFound('Garden not found.');
      const { gardenId, ...rest } = request.body;
      const bed = await app.prisma.bed.create({
        data: {
          ...rest,
          gardenId,
          areaSqM: deriveAreaSqM(rest.lengthMm, rest.widthMm),
        },
      });
      return reply.code(201).send(bed);
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        tags: ['beds'],
        summary: 'Get a bed',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: Bed, ...errorResponses },
      },
    },
    async (request, reply) => {
      const bed = await app.prisma.bed.findFirst({
        where: { id: request.params.id, garden: { ownerId: request.user.sub } },
      });
      if (!bed) return reply.notFound('Bed not found.');
      return bed;
    },
  );

  app.get(
    '/:id/detail',
    {
      schema: {
        tags: ['beds'],
        summary: "A bed with its current plantings, planting history, and amendments",
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: BedDetail, ...errorResponses },
      },
    },
    async (request, reply) => {
      const bed = await app.prisma.bed.findFirst({
        where: { id: request.params.id, garden: { ownerId: request.user.sub } },
        include: {
          plantings: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'desc' },
            include: { plant: { select: { commonName: true, slug: true, type: true } } },
          },
          amendments: {
            where: { deletedAt: null },
            orderBy: { appliedOn: 'desc' },
          },
        },
      });
      if (!bed) return reply.notFound('Bed not found.');

      const { plantings, amendments, ...bedFields } = bed;
      const enriched = plantings.map((p) => ({
        id: p.id,
        quantity: p.quantity,
        status: p.status as PlantingStatus,
        plannedPlantDate: p.plannedPlantDate,
        plannedHarvestDate: p.plannedHarvestDate,
        plantedOn: p.plantedOn,
        harvestedOn: p.harvestedOn,
        notes: p.notes,
        seasonId: p.seasonId,
        plantId: p.plantId,
        plantName: p.plant.commonName,
        plantSlug: p.plant.slug,
        plantType: p.plant.type,
      }));
      const { current, history } = partitionPlantings(enriched);

      return {
        ...bedFields,
        current,
        history,
        amendments: amendments.map((a) => ({
          id: a.id,
          name: a.name,
          appliedOn: a.appliedOn,
          amount: a.amount,
          amountUnit: a.amountUnit,
          notes: a.notes,
          seasonId: a.seasonId,
        })),
      };
    },
  );

  app.get(
    '/:id/plan',
    {
      schema: {
        tags: ['beds'],
        summary: 'Plan-time conflict report for a bed in a season',
        description:
          'Evaluates the bed’s planned/planted plantings for a season and reports ' +
          'incompatible neighbours, rotation violations, overcrowding, and zone suitability.',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        querystring: ListPlanQuery,
        response: { 200: BedPlan, ...errorResponses },
      },
    },
    async (request, reply) => {
      const [bed, season, me] = await Promise.all([
        app.prisma.bed.findFirst({
          where: { id: request.params.id, garden: { ownerId: request.user.sub } },
          include: { garden: { select: { hardinessZone: true } } },
        }),
        app.prisma.season.findFirst({
          where: { id: request.query.seasonId, ownerId: request.user.sub },
        }),
        app.prisma.user.findUnique({
          where: { id: request.user.sub },
          select: { hardinessZone: true },
        }),
      ]);
      if (!bed) return reply.notFound('Bed not found.');
      if (!season) return reply.notFound('Season not found.');

      const zone = bed.garden.hardinessZone ?? me?.hardinessZone ?? null;

      // What's slated for this bed + season (the plan).
      const planRecords = await app.prisma.plantingRecord.findMany({
        where: {
          bedId: bed.id,
          seasonId: season.id,
          deletedAt: null,
          status: { in: ['planned', 'planted'] },
        },
        include: {
          plant: {
            select: {
              id: true,
              commonName: true,
              familyId: true,
              spacingMm: true,
              rowSpacingMm: true,
            },
          },
        },
      });

      const plants: Static<typeof PlanPlant>[] = planRecords.map((p) => ({
        plantingId: p.id,
        plantId: p.plantId,
        name: p.plant.commonName,
        quantity: p.quantity,
        status: p.status as PlantingStatus,
      }));

      // Distinct plants present, for companion pairing and zone suitability.
      const refs = new Map<string, PlantRef>();
      for (const p of planRecords) refs.set(p.plant.id, { id: p.plant.id, name: p.plant.commonName });
      const plantIds = [...refs.keys()];

      // Companion graph among the plants in the bed.
      const links =
        plantIds.length > 0
          ? await app.prisma.companionLink.findMany({
              where: { plantAId: { in: plantIds }, plantBId: { in: plantIds } },
            })
          : [];
      const edges: CompanionEdge[] = links.map((l) => ({
        aId: l.plantAId,
        bId: l.plantBId,
        relation: l.relation as CompanionRelation,
        reason: l.reason ?? undefined,
      }));
      const refList = [...refs.values()];
      const toPair = (f: { plantAName: string; plantBName: string; reason?: string }) => ({
        plantAName: f.plantAName,
        plantBName: f.plantBName,
        reason: f.reason ?? null,
      });
      const antagonists = findAntagonisticPairs(refList, edges).map(toPair);
      const companions = findCompanionPairs(refList, edges).map(toPair);

      // Overcrowding.
      const capacity = evaluateCapacity(
        planRecords.map(
          (p): SpacedPlanting => ({
            plantName: p.plant.commonName,
            quantity: p.quantity,
            spacingMm: p.plant.spacingMm,
            rowSpacingMm: p.plant.rowSpacingMm,
          }),
        ),
        bed.areaSqM,
      );

      // Rotation: order this bed's seasons chronologically, then check each
      // family in the current plan against earlier seasons.
      const history = await app.prisma.plantingRecord.findMany({
        where: { bedId: bed.id, deletedAt: null },
        include: {
          plant: { select: { familyId: true } },
          season: { select: { id: true, year: true, seasonType: true, startDate: true, createdAt: true } },
        },
      });
      const seasons = new Map<string, { year: number; type: string; at: number }>();
      for (const h of history) {
        seasons.set(h.season.id, {
          year: h.season.year,
          type: h.season.seasonType,
          at: (h.season.startDate ?? h.season.createdAt).getTime(),
        });
      }
      seasons.set(season.id, {
        year: season.year,
        type: season.seasonType,
        at: (season.startDate ?? season.createdAt).getTime(),
      });
      const seq = new Map<string, number>();
      [...seasons.entries()]
        .sort(([, a], [, b]) =>
          a.year - b.year || (SEASON_ORDER[a.type] ?? 0) - (SEASON_ORDER[b.type] ?? 0) || a.at - b.at,
        )
        .forEach(([id], i) => seq.set(id, i));

      const candidateSequence = seq.get(season.id)!;
      const historyEntries: BedHistoryEntry[] = history
        .filter((h) => (seq.get(h.season.id) ?? 0) < candidateSequence)
        .map((h) => ({ sequence: seq.get(h.season.id)!, familyId: h.plant.familyId }));

      // One rotation finding per offending family, naming the plants involved.
      const namesByFamily = new Map<string, Set<string>>();
      for (const p of planRecords) {
        if (!p.plant.familyId) continue;
        const set = namesByFamily.get(p.plant.familyId) ?? new Set<string>();
        set.add(p.plant.commonName);
        namesByFamily.set(p.plant.familyId, set);
      }
      const rotation: Static<typeof RotationFinding>[] = [];
      for (const [familyId, names] of namesByFamily) {
        const check = checkRotation(historyEntries, familyId, candidateSequence);
        if (check.violated) {
          rotation.push({
            plantName: [...names].join(', '),
            lastSeasonsAgo: check.lastSeasonsAgo ?? 0,
            message: check.message ?? 'Rotation conflict.',
          });
        }
      }

      // Zone suitability: a plant with no planting window for the zone is risky.
      let unsuitable: Static<typeof SuitabilityFinding>[] = [];
      if (zone && plantIds.length > 0) {
        const windows = await app.prisma.plantingWindow.findMany({
          where: { plantId: { in: plantIds }, zone, deletedAt: null },
          select: { plantId: true },
        });
        const ok = new Set(windows.map((w) => w.plantId));
        unsuitable = refList
          .filter((p) => !ok.has(p.id))
          .map((p) => ({ plantName: p.name, zone }));
      }

      const warningCount =
        antagonists.length + rotation.length + unsuitable.length + (capacity.over ? 1 : 0);

      return {
        bedId: bed.id,
        bedName: bed.name,
        seasonId: season.id,
        seasonName: season.name,
        zone,
        plants,
        capacity,
        antagonists,
        companions,
        rotation,
        unsuitable,
        warningCount,
      };
    },
  );

  app.patch(
    '/:id',
    {
      schema: {
        tags: ['beds'],
        summary: 'Update a bed',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        body: BedUpdate,
        response: { 200: Bed, ...errorResponses },
      },
    },
    async (request, reply) => {
      const bed = await app.prisma.bed.findFirst({
        where: { id: request.params.id, garden: { ownerId: request.user.sub } },
      });
      if (!bed) return reply.notFound('Bed not found.');
      const lengthMm = request.body.lengthMm ?? bed.lengthMm;
      const widthMm = request.body.widthMm ?? bed.widthMm;
      return app.prisma.bed.update({
        where: { id: bed.id },
        data: { ...request.body, areaSqM: deriveAreaSqM(lengthMm, widthMm) },
      });
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['beds'],
        summary: 'Archive (soft-delete) a bed — planting history is preserved',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: Bed, ...errorResponses },
      },
    },
    async (request, reply) => {
      const bed = await app.prisma.bed.findFirst({
        where: { id: request.params.id, garden: { ownerId: request.user.sub } },
      });
      if (!bed) return reply.notFound('Bed not found.');
      return app.prisma.bed.update({
        where: { id: bed.id },
        data: { deletedAt: bed.deletedAt ?? new Date() },
      });
    },
  );
};
