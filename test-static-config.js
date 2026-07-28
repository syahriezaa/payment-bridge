import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDistPath = path.resolve(__dirname, 'web/dist');

async function testCollision(name, setupFunc) {
  try {
    const fastify = Fastify({ logger: false });
    await setupFunc(fastify);
    await fastify.ready();
    console.log(`[PASS] ${name}`);
    await fastify.close();
  } catch (err) {
    console.error(`[FAIL] ${name} -> ${err.code || err.message}`);
  }
}

async function run() {
  await testCollision('1. fastify.get("/") THEN default fastifyStatic(prefix: "/")', async (f) => {
    f.get('/', async () => 'hello root');
    await f.register(fastifyStatic, { root: webDistPath, prefix: '/' });
  });

  await testCollision('2. default fastifyStatic(prefix: "/") THEN fastify.get("/")', async (f) => {
    await f.register(fastifyStatic, { root: webDistPath, prefix: '/' });
    f.get('/', async () => 'hello root');
  });

  await testCollision('3. fastifyStatic(wildcard: false, prefix: "/") THEN fastify.get("/")', async (f) => {
    await f.register(fastifyStatic, { root: webDistPath, prefix: '/', wildcard: false });
    f.get('/', async () => 'hello root');
  });

  await testCollision('4. fastifyStatic(decorateReply: false, wildcard: true, index: false) THEN fastify.get("/")', async (f) => {
    await f.register(fastifyStatic, { root: webDistPath, prefix: '/', decorateReply: false, wildcard: true, index: false });
    f.get('/', async () => 'hello root');
  });

  await testCollision('5. fastifyStatic(decorateReply: false, wildcard: true) + fastify.get("/")', async (f) => {
    await f.register(fastifyStatic, { root: webDistPath, prefix: '/', decorateReply: false, wildcard: true });
    f.get('/', async () => 'hello root');
  });
}

run();
