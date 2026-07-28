import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { getDb } from './db/index.js';
import { webhookRoutes } from './routes/webhook.js';
import { adminRoutes } from './routes/admin.js';
import { snapRoutes } from './routes/snap.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDistPath = path.resolve(__dirname, '../web/dist');

export async function buildServer(options = {}): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: false,
    ...options
  });

  // Register CORS plugin
  await fastify.register(cors, {
    origin: true
  });

  // Ensure DB initialized
  getDb();

  // Register API Routes
  await fastify.register(webhookRoutes);
  await fastify.register(adminRoutes);
  await fastify.register(snapRoutes);

  // Health check endpoint
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Serve Web Admin Dashboard static files
  if (fs.existsSync(webDistPath)) {
    await fastify.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
      decorateReply: false,
      wildcard: false,
      index: false,
    });

    fastify.setNotFoundHandler(async (request: FastifyRequest, reply: FastifyReply) => {
      const url = request.raw.url || '';
      if (url.startsWith('/api') || url.startsWith('/health')) {
        return reply.status(404).send({ error: 'Not Found' });
      }
      const indexPath = path.join(webDistPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        const html = fs.readFileSync(indexPath, 'utf-8');
        return reply.type('text/html').send(html);
      }
      return reply.status(404).send({ error: 'Not Found' });
    });
  }

  return fastify;
}

export async function startServer() {
  const port = config.port;
  const host = config.host;

  try {
    const app = await buildServer();
    const address = await app.listen({ port, host });
    console.log(`[Bridge Server] Midtrans Multi-Tenant Payment Bridge listening at ${address}`);
    return app;
  } catch (err) {
    console.error('[Bridge Server] Error starting server:', err);
    process.exit(1);
  }
}

// Auto-start if not in test environment
if (!config.isTest) {
  await startServer().catch((err) => {
    console.error('[Bridge Server] Fatal error on startup:', err);
    process.exit(1);
  });
}
