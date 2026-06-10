import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { IdParam, Timestamps, DateTime, errorResponses } from '../schemas/common.js';

const Amendment = Type.Object({
  id: Type.String(),
  name: Type.String(),
  appliedOn: DateTime,
  amount: Type.Union([Type.Number(), Type.Null()]),
  amountUnit: Type.Union([Type.String(), Type.Null()]),
  notes: Type.Union([Type.String(), Type.Null()]),
  bedId: Type.String(),
  seasonId: Type.Union([Type.String(), Type.Null()]),
  ...Timestamps,
});

const AmendmentCreate = Type.Object({
  bedId: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1, maxLength: 120 }),
  appliedOn: Type.Optional(Type.String({ format: 'date-time' })),
  // Explicit units: free amount + unit (e.g. 2 "kg", 1 "cu_ft").
  amount: Type.Optional(Type.Number({ minimum: 0 })),
  amountUnit: Type.Optional(Type.String({ maxLength: 24 })),
  seasonId: Type.Optional(Type.String()),
  notes: Type.Optional(Type.String({ maxLength: 2000 })),
});

const AmendmentUpdate = Type.Partial(Type.Omit(AmendmentCreate, ['bedId']));

const ListAmendmentsQuery = Type.Object({
  bedId: Type.Optional(Type.String()),
  seasonId: Type.Optional(Type.String()),
  includeArchived: Type.Optional(Type.Boolean({ default: false })),
});

export const amendmentRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.addHook('onRequest', app.authenticate);

  const ownsBed = (bedId: string, userId: string) =>
    app.prisma.bed.findFirst({ where: { id: bedId, garden: { ownerId: userId } } });

  app.get(
    '/',
    {
      schema: {
        tags: ['amendments'],
        summary: 'List soil amendments (filter by bed and/or season)',
        security: [{ bearerAuth: [] }],
        querystring: ListAmendmentsQuery,
        response: { 200: Type.Array(Amendment), ...errorResponses },
      },
    },
    async (request) => {
      const { bedId, seasonId, includeArchived } = request.query;
      return app.prisma.soilAmendment.findMany({
        where: {
          bed: { garden: { ownerId: request.user.sub } },
          ...(bedId ? { bedId } : {}),
          ...(seasonId ? { seasonId } : {}),
          ...(includeArchived ? {} : { deletedAt: null }),
        },
        orderBy: { appliedOn: 'desc' },
      });
    },
  );

  app.post(
    '/',
    {
      schema: {
        tags: ['amendments'],
        summary: 'Record a soil amendment',
        security: [{ bearerAuth: [] }],
        body: AmendmentCreate,
        response: { 201: Amendment, ...errorResponses },
      },
    },
    async (request, reply) => {
      const bed = await ownsBed(request.body.bedId, request.user.sub);
      if (!bed) return reply.notFound('Bed not found.');
      const amendment = await app.prisma.soilAmendment.create({ data: request.body });
      return reply.code(201).send(amendment);
    },
  );

  app.patch(
    '/:id',
    {
      schema: {
        tags: ['amendments'],
        summary: 'Update a soil amendment',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        body: AmendmentUpdate,
        response: { 200: Amendment, ...errorResponses },
      },
    },
    async (request, reply) => {
      const amendment = await app.prisma.soilAmendment.findFirst({
        where: { id: request.params.id, bed: { garden: { ownerId: request.user.sub } } },
      });
      if (!amendment) return reply.notFound('Soil amendment not found.');
      return app.prisma.soilAmendment.update({ where: { id: amendment.id }, data: request.body });
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['amendments'],
        summary: 'Soft-delete a soil amendment',
        security: [{ bearerAuth: [] }],
        params: IdParam,
        response: { 200: Amendment, ...errorResponses },
      },
    },
    async (request, reply) => {
      const amendment = await app.prisma.soilAmendment.findFirst({
        where: { id: request.params.id, bed: { garden: { ownerId: request.user.sub } } },
      });
      if (!amendment) return reply.notFound('Soil amendment not found.');
      return app.prisma.soilAmendment.update({
        where: { id: amendment.id },
        data: { deletedAt: amendment.deletedAt ?? new Date() },
      });
    },
  );
};
