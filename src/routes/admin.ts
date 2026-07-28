import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { tenantDb, adminUserDb } from '../db/index.js';
import { auditService } from '../services/audit.js';
import { retryDispatchManually } from '../services/dispatcher.js';
import { hashPassword, verifyPassword, generateToken, verifyToken } from '../services/auth.js';
import { config } from '../config.js';

export async function adminRoutes(fastify: FastifyInstance) {
  // --- Auth Middleware ---
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.raw.url || request.url;
    const pathWithoutQuery = url.split('?')[0];

    if (pathWithoutQuery.startsWith('/api/admin')) {
      if (pathWithoutQuery === '/api/admin/login' || pathWithoutQuery === '/api/admin/setup') {
        return;
      }

      const authHeader = request.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      const token = authHeader.slice(7).trim();
      if (!token) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }

      try {
        const payload = verifyToken(token, config.jwtSecret);
        (request as any).user = payload;
      } catch {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
    }
  });

  // --- Auth Endpoints ---

  // POST /api/admin/setup - Initial Admin Registration
  fastify.post('/api/admin/setup', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    if (!body || !body.username || !body.password) {
      return reply.status(400).send({ error: 'Username and password are required' });
    }

    if (adminUserDb.count() > 0) {
      return reply.status(400).send({ error: 'Admin setup already completed' });
    }

    const { hash, salt } = hashPassword(body.password);
    const user = adminUserDb.create({
      username: body.username,
      password_hash: hash,
      salt
    });

    const token = generateToken({ id: user.id, username: user.username }, config.jwtSecret);
    return reply.status(200).send({
      token,
      user: {
        id: user.id,
        username: user.username
      }
    });
  });

  // POST /api/admin/login - Admin Login
  fastify.post('/api/admin/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    if (!body || !body.username || !body.password) {
      return reply.status(400).send({ error: 'Username and password are required' });
    }

    const user = adminUserDb.findByUsername(body.username);
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const isValid = verifyPassword(body.password, user.password_hash, user.salt);
    if (!isValid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const token = generateToken({ id: user.id, username: user.username }, config.jwtSecret);
    return reply.status(200).send({
      token,
      user: {
        id: user.id,
        username: user.username
      }
    });
  });

  // --- Tenants Management ---

  // POST /api/admin/tenants - Create Tenant
  fastify.post('/api/admin/tenants', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;

    if (!body || !body.name || (!body.order_prefix && !body.prefix) || !body.server_key || !body.target_url) {
      return reply.status(400).send({ error: 'Missing required tenant fields' });
    }

    const prefix = (body.order_prefix || body.prefix).toUpperCase();

    try {
      const tenant = tenantDb.create({
        name: body.name,
        order_prefix: prefix,
        prefix,
        server_key: body.server_key,
        target_url: body.target_url,
        webhook_secret: body.webhook_secret,
        api_key: body.api_key
      });

      return reply.status(201).send(tenant);
    } catch (err: any) {
      if (
        err.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
        err.code === 'SQLITE_CONSTRAINT' ||
        err.message?.includes('already registered') ||
        err.message?.includes('UNIQUE constraint')
      ) {
        return reply.status(409).send({ error: `Tenant prefix ${prefix} already registered` });
      }
      return reply.status(400).send({ error: err.message || 'Failed to create tenant' });
    }
  });

  // GET /api/admin/tenants - List Tenants
  fastify.get('/api/admin/tenants', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenants = tenantDb.getAll();
    return reply.status(200).send(tenants);
  });

  // GET /api/admin/tenants/:id - Get Single Tenant
  fastify.get('/api/admin/tenants/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const tenant = tenantDb.getById(id);
    if (!tenant) {
      return reply.status(404).send({ error: 'Tenant not found' });
    }
    return reply.status(200).send(tenant);
  });

  // PUT /api/admin/tenants/:id - Update Tenant
  fastify.put('/api/admin/tenants/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const body = request.body as any;

    const existing = tenantDb.getById(id);
    if (!existing) {
      return reply.status(404).send({ error: 'Tenant not found' });
    }

    try {
      const updated = tenantDb.update(id, body);
      return reply.status(200).send(updated);
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Failed to update tenant' });
    }
  });

  // DELETE /api/admin/tenants/:id - Delete Tenant
  fastify.delete('/api/admin/tenants/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const success = tenantDb.delete(id);
    if (!success) {
      return reply.status(404).send({ error: 'Tenant not found' });
    }
    return reply.status(200).send({ success: true, message: 'Tenant deleted' });
  });

  // --- Rules API ---
  fastify.get('/api/admin/rules', async (request: FastifyRequest, reply: FastifyReply) => {
    const tenants = tenantDb.getAll();
    const rules = tenants.map(t => ({
      id: t.id,
      name: t.name,
      prefix: t.order_prefix,
      order_prefix: t.order_prefix,
      target_url: t.target_url
    }));
    return reply.status(200).send(rules);
  });

  // --- Webhook Audit Logs ---

  // GET /api/admin/audit-logs - List / Search Audit Logs
  fastify.get('/api/admin/audit-logs', async (request: FastifyRequest<{
    Querystring: { tenant_id?: string; status?: string; page?: string; limit?: string }
  }>, reply: FastifyReply) => {
    const { tenant_id, status, page, limit } = request.query;

    const result = auditService.queryLogs({
      tenant_id,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50
    });

    return reply.status(200).send(result);
  });

  // GET /api/admin/audit-logs/:id or GET /api/admin/tenants/logs/:id - Get Single Audit Log
  const getAuditLogHandler = async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const log = auditService.getLogById(id);
    if (!log) {
      return reply.status(404).send({ error: 'Audit log not found' });
    }
    return reply.status(200).send(log);
  };

  fastify.get('/api/admin/audit-logs/:id', getAuditLogHandler);
  fastify.get('/api/admin/tenants/logs/:id', getAuditLogHandler);

  // POST /api/admin/audit-logs/:id/retry - Manual Retry Trigger
  fastify.post('/api/admin/audit-logs/:id/retry', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    try {
      const result = await retryDispatchManually(id);
      return reply.status(200).send({
        success: result.success,
        message: 'Retry triggered',
        log: result.log
      });
    } catch (err: any) {
      const statusCode = err.message === 'Audit log not found' ? 404 : 400;
      return reply.status(statusCode).send({ error: err.message });
    }
  });
}
