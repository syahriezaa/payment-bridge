import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createSnapTokenProxy, SnapTokenRequest } from '../services/snap.js';

export async function snapRoutes(fastify: FastifyInstance) {
  fastify.post('/api/v1/snap/token', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers['authorization'] || '';
    let apiKey = '';

    if (authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7).trim();
    } else if (authHeader.startsWith('bearer ')) {
      apiKey = authHeader.substring(7).trim();
    }

    const body = request.body as SnapTokenRequest;

    const result = await createSnapTokenProxy(apiKey, body);
    return reply.status(result.statusCode).send(result.data);
  });
}
