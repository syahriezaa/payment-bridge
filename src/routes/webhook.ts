import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { resolveTenantByOrderId } from '../services/router.js';
import { verifyMidtransSignature } from '../services/signature.js';
import { auditService } from '../services/audit.js';
import { enqueueDispatch } from '../services/dispatcher.js';

export async function webhookRoutes(fastify: FastifyInstance) {
  fastify.post('/api/webhooks/midtrans', async (request: FastifyRequest, reply: FastifyReply) => {
    let rawBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    let payload = typeof request.body === 'string' ? null : request.body as any;

    if (!payload) {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return reply.status(400).send({ error: 'Invalid JSON payload' });
      }
    }

    if (!payload || typeof payload !== 'object') {
      return reply.status(400).send({ error: 'Invalid JSON payload' });
    }

    const { order_id, status_code, gross_amount, signature_key } = payload;

    if (!order_id || !signature_key || status_code === undefined || status_code === null || gross_amount === undefined || gross_amount === null) {
      return reply.status(400).send({ error: 'Missing required Midtrans webhook parameters' });
    }

    const orderIdStr = String(order_id);
    const statusCodeStr = String(status_code);
    const grossAmountStr = String(gross_amount);

    // Resolve tenant
    const resolution = resolveTenantByOrderId(orderIdStr);
    const tenant = resolution.tenant;

    if (!tenant) {
      const log = auditService.createLog({
        order_id: orderIdStr,
        prefix: resolution.prefix || 'UNKNOWN',
        tenant_id: null,
        status: 'UNMAPPED_PREFIX',
        last_http_status: 404,
        payload: rawBody
      });

      return reply.status(400).send({
        error: 'Unmapped Order ID prefix',
        audit_id: log.id
      });
    }

    // Verify SHA-512 Signature
    const isValidSignature = verifyMidtransSignature(
      orderIdStr,
      statusCodeStr,
      grossAmountStr,
      tenant.server_key,
      String(signature_key)
    );

    if (!isValidSignature) {
      const log = auditService.createLog({
        order_id: orderIdStr,
        prefix: tenant.order_prefix,
        tenant_id: tenant.id,
        target_url: tenant.target_url,
        status: 'INVALID_SIGNATURE',
        last_http_status: 401,
        payload: rawBody
      });

      return reply.status(401).send({
        error: 'Invalid Midtrans signature key',
        audit_id: log.id
      });
    }

    // Valid webhook!
    const log = auditService.createLog({
      order_id: orderIdStr,
      prefix: tenant.order_prefix,
      tenant_id: tenant.id,
      target_url: tenant.target_url,
      status: 'PENDING',
      payload: rawBody
    });

    // Enqueue async dispatch worker non-blockingly
    enqueueDispatch(log.id);

    return reply.status(200).send({
      status: 'received',
      audit_id: log.id
    });
  });
}
