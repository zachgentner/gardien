import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { IdParam, Timestamps, errorResponses } from '../schemas/common.js';
import {
  effectiveWindow,
  isPlantableInMonth,
  type PlantingWindow as PlantingWindowRule,
} from '../domain/planting.js';

const PlantTypeEnum = Type.Union([
  Type.Literal('vegetable'),
  Type.Literal('fruit'),
  Type.Literal('herb'),
  Type.Literal('flower'),
  Type.Literal('cover_crop'),
]);

const SunEnum = Type.Union([
  Type.Literal('full_sun'),
  Type.Literal('partial_sun'),
  Type.Literal('partial_shade'),
  Type.Literal('full_shade'),
]);
const WaterEnum = Type.Union([Type.Literal('low'), Type.Literal('medium'), Type.Literal('high')]);
const FeederEnum = Type.Union([
  Type.Literal('heavy'),
  Type.Literal('medium'),
  Type.Literal('light'),
  Type.Literal('fixer'),
]);
const RelationEnum = Type.Union([Type.Literal('companion'), Type.Literal('antagonist')]);
const IssueKindEnum = Type.Union([Type.Literal('pest'), Type.Literal('disease')]);

const Family = Type.Object({
  id: Type.String(),
  name: Type.String(),
  slug: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  rotationGroup: Type.Union([Type.String(), Type.Null()]),
  source: Type.Union([Type.String(), Type.Null()]),
  ...Timestamps,
});

const Plant = Type.Object({
  id: Type.String(),
  commonName: Type.String(),
  scientificName: Type.Union([Type.String(), Type.Null()]),
  slug: Type.String(),
  type: PlantTypeEnum,
  sun: Type.Union([Type.String(), Type.Null()]),
  water: Type.Union([Type.String(), Type.Null()]),
  feederType: Type.Union([Type.String(), Type.Null()]),
  spacingMm: Type.Union([Type.Integer(), Type.Null()]),
  rowSpacingMm: Type.Union([Type.Integer(), Type.Null()]),
  daysToMaturityMin: Type.Union([Type.Integer(), Type.Null()]),
  daysToMaturityMax: Type.Union([Type.Integer(), Type.Null()]),
  soilNotes: Type.Union([Type.String(), Type.Null()]),
  growingTips: Type.Union([Type.String(), Type.Null()]),
  commonMistakes: Type.Union([Type.String(), Type.Null()]),
  source: Type.Union([Type.String(), Type.Null()]),
  familyId: Type.Union([Type.String(), Type.Null()]),
  ...Timestamps,
});

const Window = Type.Object({
  id: Type.String(),
  zone: Type.String(),
  plantStartMonth: Type.Integer(),
  plantEndMonth: Type.Integer(),
  harvestStartMonth: Type.Union([Type.Integer(), Type.Null()]),
  harvestEndMonth: Type.Union([Type.Integer(), Type.Null()]),
  source: Type.Union([Type.String(), Type.Null()]),
  notes: Type.Union([Type.String(), Type.Null()]),
  ownerId: Type.Union([Type.String(), Type.Null()]),
});

const Issue = Type.Object({
  id: Type.String(),
  kind: IssueKindEnum,
  name: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  management: Type.Union([Type.String(), Type.Null()]),
  source: Type.Union([Type.String(), Type.Null()]),
});

const Companion = Type.Object({
  linkId: Type.String(),
  plantId: Type.String(),
  relation: RelationEnum,
  reason: Type.Union([Type.String(), Type.Null()]),
});

const PlantDetail = Type.Intersect([
  Plant,
  Type.Object({
    windows: Type.Array(Window),
    issues: Type.Array(Issue),
    companions: Type.Array(Companion),
  }),
]);

const PlantSearchQuery = Type.Object({
  q: Type.Optional(Type.String({ maxLength: 120 })),
  type: Type.Optional(PlantTypeEnum),
  familyId: Type.Optional(Type.String()),
  // Phase 2 filters:
  zone: Type.Optional(Type.String({ maxLength: 8 })),
  month: Type.Optional(Type.Integer({ minimum: 1, maximum: 12 })),
  companionOf: Type.Optional(Type.String()),
  take: Type.Optional(Type.Integer({ minimum: 1, maximum: 200, default: 50 })),
  skip: Type.Optional(Type.Integer({ minimum: 0, default: 0 })),
});

const PlantCreate = Type.Object({
  commonName: Type.String({ minLength: 1, maxLength: 120 }),
  slug: Type.String({ minLength: 1, maxLength: 120 }),
  type: PlantTypeEnum,
  scientificName: Type.Optional(Type.String({ maxLength: 160 })),
  sun: Type.Optional(SunEnum),
  water: Type.Optional(WaterEnum),
  feederType: Type.Optional(FeederEnum),
  spacingMm: Type.Optional(Type.Integer({ minimum: 0 })),
  rowSpacingMm: Type.Optional(Type.Integer({ minimum: 0 })),
  daysToMaturityMin: Type.Optional(Type.Integer({ minimum: 0 })),
  daysToMaturityMax: Type.Optional(Type.Integer({ minimum: 0 })),
  soilNotes: Type.Optional(Type.String({ maxLength: 1000 })),
  growingTips: Type.Optional(Type.String({ maxLength: 2000 })),
  commonMistakes: Type.Optional(Type.String({ maxLength: 2000 })),
  source: Type.Optional(Type.String({ maxLength: 300 })),
  familyId: Type.Optional(Type.String()),
});
const PlantUpdate = Type.Partial(Type.Omit(PlantCreate, ['slug']));

const FamilyCreate = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 120 }),
  slug: Type.String({ minLength: 1, maxLength: 120 }),
  description: Type.Optional(Type.String({ maxLength: 2000 })),
  rotationGroup: Type.Optional(Type.String({ maxLength: 60 })),
  source: Type.Optional(Type.String({ maxLength: 300 })),
});

const WindowCreate = Type.Object({
  zone: Type.String({ minLength: 1, maxLength: 8 }),
  plantStartMonth: Type.Integer({ minimum: 1, maximum: 12 }),
  plantEndMonth: Type.Integer({ minimum: 1, maximum: 12 }),
  harvestStartMonth: Type.Optional(Type.Integer({ minimum: 1, maximum: 12 })),
  harvestEndMonth: Type.Optional(Type.Integer({ minimum: 1, maximum: 12 })),
  source: Type.Optional(Type.String({ maxLength: 300 })),
  notes: Type.Optional(Type.String({ maxLength: 500 })),
  // When true, saved as the current user's override of the curated window.
  override: Type.Optional(Type.Boolean({ default: false })),
});

const IssueCreate = Type.Object({
  kind: IssueKindEnum,
  name: Type.String({ minLength: 1, maxLength: 120 }),
  description: Type.Optional(Type.String({ maxLength: 2000 })),
  management: Type.Optional(Type.String({ maxLength: 2000 })),
  source: Type.Optional(Type.String({ maxLength: 300 })),
});

const CompanionCreate = Type.Object({
  otherPlantId: Type.String({ minLength: 1 }),
  relation: RelationEnum,
  reason: Type.Optional(Type.String({ maxLength: 500 })),
});

export const plantRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook('onRequest', app.authenticate);

  // -- Families ------------------------------------------------------------
  app.get(
    '/families',
    {
      schema: {
        tags: ['plants'],
        summary: 'List plant families (drive rotation/disease rules)',
        security: [{ bearerAuth: [] }],
        response: { 200: Type.Array(Family), ...errorResponses },
      },
    },
    async () =>
      app.prisma.plantFamily.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
  );

  app.post(
    '/families',
    {
      schema: {
        tags: ['plants'],
        summary: 'Create a plant family',
        security: [{ bearerAuth: [] }],
        body: FamilyCreate,
        response: { 201: Family, ...errorResponses },
      },
    },
    async (request, reply) => {
      const family = await app.prisma.plantFamily.create({
        data: { ...request.body, ownerId: request.user.sub },
      });
      return reply.code(201).send(family);
    },
  );

  // -- Directory search ----------------------------------------------------
  app.get(
    '/',
    {
      schema: {
        tags: ['plants'],
        summary: 'Search the plant directory',
        description:
          'Filter by text (`q`), `type`, `familyId`, zone suitability (`zone`), season (`month`, needs `zone`), and `companionOf` (a plant id).',
        security: [{ bearerAuth: [] }],
        querystring: PlantSearchQuery,
        response: { 200: Type.Array(Plant), ...errorResponses },
      },
    },
    async (request, reply) => {
      const { q, type, familyId, zone, month, companionOf, take, skip } = request.query;

      if (month != null && !zone) {
        return reply.badRequest('`month` filtering requires a `zone`.');
      }

      // companionOf -> collect the ids of plants linked to that plant.
      let companionIds: string[] | undefined;
      if (companionOf) {
        const links = await app.prisma.companionLink.findMany({
          where: { OR: [{ plantAId: companionOf }, { plantBId: companionOf }] },
        });
        companionIds = links.map((l) => (l.plantAId === companionOf ? l.plantBId : l.plantAId));
        if (companionIds.length === 0) return [];
      }

      const plants = await app.prisma.plant.findMany({
        where: {
          deletedAt: null,
          ...(type ? { type } : {}),
          ...(familyId ? { familyId } : {}),
          ...(companionIds ? { id: { in: companionIds } } : {}),
          ...(zone ? { windows: { some: { zone, deletedAt: null } } } : {}),
          ...(q
            ? {
                OR: [
                  { commonName: { contains: q, mode: 'insensitive' } },
                  { scientificName: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        orderBy: { commonName: 'asc' },
        // Need windows in memory only when month-filtering (wrap-around isn't SQL-friendly).
        include: month != null ? { windows: { where: { deletedAt: null } } } : undefined,
        take,
        skip,
      });

      if (month != null && zone) {
        const filtered = plants.filter((p) => {
          const windows = (p as unknown as { windows: PlantingWindowRule[] }).windows;
          const w = effectiveWindow(windows, zone);
          return w ? isPlantableInMonth(w, month) : false;
        });
        return filtered.map(stripWindows);
      }

      return plants;
    },
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['plants'],
        summary: 'Add a plant to the directory',
        security: [{ bearerAuth: [] }],
        body: PlantCreate,
        response: { 201: Plant, 409: Type.Ref('Error'), ...errorResponses },
      },
    },
    async (request, reply) => {
      const existing = await app.prisma.plant.findUnique({ where: { slug: request.body.slug } });
      if (existing) return reply.conflict('A plant with that slug already exists.');
      const plant = await app.prisma.plant.create({
        data: { ...request.body, ownerId: request.user.sub },
      });
      return reply.code(201).send(plant);
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        tags: ['plants'],
        summary: 'Get a plant with windows, pests/diseases, and companions',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: PlantDetail, ...errorResponses },
      },
    },
    async (request, reply) => {
      const plant = await app.prisma.plant.findFirst({
        where: { id: request.params.id, deletedAt: null },
        include: {
          companionsFrom: true,
          companionsTo: true,
          windows: { where: { deletedAt: null }, orderBy: { zone: 'asc' } },
          issues: { where: { deletedAt: null }, orderBy: { name: 'asc' } },
        },
      });
      if (!plant) return reply.notFound('Plant not found.');

      const companions = [
        ...plant.companionsFrom.map((c) => ({
          linkId: c.id,
          plantId: c.plantBId,
          relation: c.relation,
          reason: c.reason,
        })),
        ...plant.companionsTo.map((c) => ({
          linkId: c.id,
          plantId: c.plantAId,
          relation: c.relation,
          reason: c.reason,
        })),
      ];

      const { companionsFrom: _f, companionsTo: _t, ...rest } = plant;
      return { ...rest, companions };
    },
  );

  app.patch(
    '/:id',
    {
      schema: {
        tags: ['plants'],
        summary: 'Update a plant',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        body: PlantUpdate,
        response: { 200: Plant, ...errorResponses },
      },
    },
    async (request, reply) => {
      const plant = await app.prisma.plant.findFirst({
        where: { id: request.params.id, deletedAt: null },
      });
      if (!plant) return reply.notFound('Plant not found.');
      return app.prisma.plant.update({ where: { id: plant.id }, data: request.body });
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['plants'],
        summary: 'Archive (soft-delete) a plant',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: Plant, ...errorResponses },
      },
    },
    async (request, reply) => {
      const plant = await app.prisma.plant.findFirst({
        where: { id: request.params.id, deletedAt: null },
      });
      if (!plant) return reply.notFound('Plant not found.');
      return app.prisma.plant.update({
        where: { id: plant.id },
        data: { deletedAt: new Date() },
      });
    },
  );

  // -- Planting windows ----------------------------------------------------
  app.post(
    '/:id/windows',
    {
      schema: {
        tags: ['plants'],
        summary: 'Add or override a planting/harvest window for a zone',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        body: WindowCreate,
        response: { 201: Window, ...errorResponses },
      },
    },
    async (request, reply) => {
      const plant = await app.prisma.plant.findFirst({
        where: { id: request.params.id, deletedAt: null },
      });
      if (!plant) return reply.notFound('Plant not found.');

      const { override, ...data } = request.body;
      const ownerId = override ? request.user.sub : null;
      // Find-then-write rather than upsert: the (plantId, zone, ownerId) unique
      // has a nullable ownerId, and SQL treats NULLs as distinct, so an upsert
      // keyed on it can't match curated (ownerId null) rows reliably.
      const existing = await app.prisma.plantingWindow.findFirst({
        where: { plantId: plant.id, zone: data.zone, ownerId },
      });
      const window = existing
        ? await app.prisma.plantingWindow.update({
            where: { id: existing.id },
            data: { ...data, deletedAt: null },
          })
        : await app.prisma.plantingWindow.create({
            data: { ...data, plantId: plant.id, ownerId },
          });
      return reply.code(201).send(window);
    },
  );

  app.delete(
    '/windows/:id',
    {
      schema: {
        tags: ['plants'],
        summary: 'Archive a planting window',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: Window, ...errorResponses },
      },
    },
    async (request, reply) => {
      const window = await app.prisma.plantingWindow.findFirst({
        where: { id: request.params.id, deletedAt: null },
      });
      if (!window) return reply.notFound('Window not found.');
      return app.prisma.plantingWindow.update({
        where: { id: window.id },
        data: { deletedAt: new Date() },
      });
    },
  );

  // -- Pests & diseases ----------------------------------------------------
  app.post(
    '/:id/issues',
    {
      schema: {
        tags: ['plants'],
        summary: 'Add a pest or disease to a plant',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        body: IssueCreate,
        response: { 201: Issue, ...errorResponses },
      },
    },
    async (request, reply) => {
      const plant = await app.prisma.plant.findFirst({
        where: { id: request.params.id, deletedAt: null },
      });
      if (!plant) return reply.notFound('Plant not found.');
      const issue = await app.prisma.plantIssue.create({
        data: { ...request.body, plantId: plant.id, ownerId: request.user.sub },
      });
      return reply.code(201).send(issue);
    },
  );

  app.delete(
    '/issues/:id',
    {
      schema: {
        tags: ['plants'],
        summary: 'Archive a pest/disease entry',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: Issue, ...errorResponses },
      },
    },
    async (request, reply) => {
      const issue = await app.prisma.plantIssue.findFirst({
        where: { id: request.params.id, deletedAt: null },
      });
      if (!issue) return reply.notFound('Issue not found.');
      return app.prisma.plantIssue.update({
        where: { id: issue.id },
        data: { deletedAt: new Date() },
      });
    },
  );

  // -- Companions ----------------------------------------------------------
  app.post(
    '/:id/companions',
    {
      schema: {
        tags: ['plants'],
        summary: 'Link a companion or antagonist plant',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        body: CompanionCreate,
        response: { 201: Companion, 409: Type.Ref('Error'), ...errorResponses },
      },
    },
    async (request, reply) => {
      const { otherPlantId, relation, reason } = request.body;
      if (otherPlantId === request.params.id) {
        return reply.badRequest('A plant cannot be its own companion.');
      }
      const [plant, other] = await Promise.all([
        app.prisma.plant.findFirst({ where: { id: request.params.id, deletedAt: null } }),
        app.prisma.plant.findFirst({ where: { id: otherPlantId, deletedAt: null } }),
      ]);
      if (!plant || !other) return reply.notFound('Plant not found.');

      const existing = await app.prisma.companionLink.findFirst({
        where: { plantAId: plant.id, plantBId: other.id, relation },
      });
      if (existing) return reply.conflict('That companion link already exists.');

      const link = await app.prisma.companionLink.create({
        data: { plantAId: plant.id, plantBId: other.id, relation, reason: reason ?? null },
      });
      return reply
        .code(201)
        .send({ linkId: link.id, plantId: other.id, relation: link.relation, reason: link.reason });
    },
  );

  app.delete(
    '/companions/:id',
    {
      schema: {
        tags: ['plants'],
        summary: 'Remove a companion link',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: Type.Object({ ok: Type.Boolean() }), ...errorResponses },
      },
    },
    async (request, reply) => {
      const link = await app.prisma.companionLink.findUnique({ where: { id: request.params.id } });
      if (!link) return reply.notFound('Companion link not found.');
      await app.prisma.companionLink.delete({ where: { id: link.id } });
      return { ok: true };
    },
  );
};

function stripWindows<T extends object>(plant: T): Omit<T, 'windows'> {
  const { windows: _w, ...rest } = plant as T & { windows?: unknown };
  return rest;
}
