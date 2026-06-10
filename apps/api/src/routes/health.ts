import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

export const healthRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['health'],
        summary: 'Liveness probe',
        response: {
          200: Type.Object({
            status: Type.Literal('ok'),
            uptime: Type.Number(),
            timestamp: Type.String({ format: 'date-time' }),
          }),
        },
      },
    },
    async () => ({
      status: 'ok' as const,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }),
  );

  app.get(
    '/ready',
    {
      schema: {
        tags: ['health'],
        summary: 'Readiness probe (checks the database connection)',
        response: {
          200: Type.Object({ status: Type.Literal('ready') }),
          503: Type.Object({ status: Type.Literal('unavailable') }),
        },
      },
    },
    async (_request, reply) => {
      try {
        if (app.hasDecorator('prisma')) {
          await app.prisma.$queryRaw`SELECT 1`;
        }
        return { status: 'ready' as const };
      } catch {
        return reply.code(503).send({ status: 'unavailable' as const });
      }
    },
  );
};
