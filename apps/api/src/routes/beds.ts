import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { IdParam, Timestamps, errorResponses } from '../schemas/common.js';

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

/** Derive area (m^2) from millimetre dimensions when both are present. */
function deriveAreaSqM(lengthMm?: number | null, widthMm?: number | null): number | undefined {
  if (lengthMm == null || widthMm == null) return undefined;
  return (lengthMm / 1000) * (widthMm / 1000);
}

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
