/**
 * Builds the Fastify application: plugins, OpenAPI docs, and routes.
 * Exported separately from the server bootstrap so tests can build an app
 * instance without binding a port.
 */
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

import { config } from './config.js';
import { ErrorSchema } from './schemas/common.js';
import prismaPlugin from './plugins/prisma.js';
import authPlugin from './plugins/auth.js';

import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { zoneRoutes } from './routes/zone.js';
import { gardenRoutes } from './routes/gardens.js';
import { bedRoutes } from './routes/beds.js';
import { plantRoutes } from './routes/plants.js';
import { seasonRoutes } from './routes/seasons.js';
import { plantingRoutes } from './routes/plantings.js';
import { amendmentRoutes } from './routes/amendments.js';
import { exportRoutes } from './routes/export.js';

export interface BuildOptions {
  /** Skip the Prisma plugin (e.g. pure-logic tests that never touch the DB). */
  withDatabase?: boolean;
}

export async function buildApp(options: BuildOptions = {}): Promise<FastifyInstance> {
  const { withDatabase = true } = options;

  const app = Fastify({
    logger: config.isProd
      ? true
      : { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } },
  }).withTypeProvider<TypeBoxTypeProvider>();

  await app.register(sensible);
  await app.register(cors, { origin: config.corsOrigin, credentials: true });

  // Shared schemas referenced by route response definitions.
  app.addSchema(ErrorSchema);

  // OpenAPI: define & document the contract (served at /docs, JSON at /openapi.json).
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Gardien API',
        description:
          'API-first contract for the Gardien PWA, future mobile client, and ESP32 layer.',
        version: '0.1.0',
      },
      servers: [{ url: `http://localhost:${config.port}`, description: 'Local development' }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      tags: [
        { name: 'health', description: 'Liveness/readiness' },
        { name: 'auth', description: 'Authentication & the current user' },
        { name: 'zone', description: 'Location & USDA hardiness zone' },
        { name: 'gardens', description: 'Gardens' },
        { name: 'beds', description: 'Beds / growing areas' },
        { name: 'plants', description: 'Plant directory & families' },
        { name: 'seasons', description: 'Seasons (first-class)' },
        { name: 'plantings', description: 'Planting records' },
        { name: 'amendments', description: 'Soil amendments' },
        { name: 'data', description: 'Data export / import' },
      ],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  if (withDatabase) {
    await app.register(prismaPlugin);
  }
  await app.register(authPlugin);

  // Routes (all under /api except health).
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(zoneRoutes, { prefix: '/api/zone' });
  await app.register(gardenRoutes, { prefix: '/api/gardens' });
  await app.register(bedRoutes, { prefix: '/api/beds' });
  await app.register(plantRoutes, { prefix: '/api/plants' });
  await app.register(seasonRoutes, { prefix: '/api/seasons' });
  await app.register(plantingRoutes, { prefix: '/api/plantings' });
  await app.register(amendmentRoutes, { prefix: '/api/amendments' });
  await app.register(exportRoutes, { prefix: '/api/export' });

  return app;
}
