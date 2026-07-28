import { runner } from './e2e/helpers/test-framework.js';
import { TestClient } from './e2e/helpers/test-client.js';
import { MockTargetServer } from './e2e/helpers/mock-target.js';
import { MockMidtransServer } from './e2e/helpers/mock-midtrans.js';
import { MockBridgeServer } from './e2e/helpers/mock-bridge-server.js';

import { registerTenantCrudTests } from './e2e/tier1-feature-coverage/tenant-crud.test.js';
import { registerSignatureValidationTests } from './e2e/tier1-feature-coverage/signature-validation.test.js';
import { registerPrefixRoutingTests } from './e2e/tier1-feature-coverage/prefix-routing.test.js';
import { registerSnapProxyTests } from './e2e/tier1-feature-coverage/snap-proxy.test.js';
import { registerAuditLogsTests } from './e2e/tier1-feature-coverage/audit-logs.test.js';
import { registerBoundaryCasesTests } from './e2e/tier2-boundary-corner/boundary-cases.test.js';
import { registerCrossFeatureTests } from './e2e/tier3-cross-feature/cross-feature.test.js';
import { registerRealWorldWorkflowTests } from './e2e/tier4-real-world/real-world-workflows.test.js';
import { registerTier5AdversarialTests } from './e2e/tier5-adversarial/adversarial.test.js';

async function runE2ESuite() {
  console.log('\x1b[35m=====================================================\x1b[0m');
  console.log('\x1b[35m  Midtrans Multi-Tenant Payment Bridge E2E Test Suite \x1b[0m');
  console.log('\x1b[35m=====================================================\x1b[0m\n');

  const args = process.argv.slice(2);
  const useMockServer = args.includes('--mock-server') || !process.env.BRIDGE_URL;

  let bridgeServer = null;
  let bridgeUrl = process.env.BRIDGE_URL || 'http://localhost:3000';

  // 1. Start Mock Target Server on Port 9999
  const mockTarget = new MockTargetServer(9999);
  await mockTarget.start();
  console.log('✔ Started Mock Target Website Server on http://localhost:9999');

  // 2. Start Mock Midtrans Snap Server on Port 9998
  const mockMidtrans = new MockMidtransServer(9998);
  await mockMidtrans.start();
  console.log('✔ Started Mock Midtrans API Server on http://localhost:9998');

  // 3. Start Embedded Mock Bridge Server if required
  if (useMockServer) {
    bridgeServer = new MockBridgeServer(3000, 'http://localhost:9998');
    await bridgeServer.start();
    console.log('✔ Started Embedded Mock Bridge Server on http://localhost:3000\n');
  } else {
    console.log(`✔ Testing against External Bridge Server at ${bridgeUrl}\n`);
  }

  const client = new TestClient(bridgeUrl);

  // Register Test Suites across Tiers 1-5
  registerTenantCrudTests(client);
  registerSignatureValidationTests(client);
  registerPrefixRoutingTests(client, mockTarget);
  registerSnapProxyTests(client, mockMidtrans);
  registerAuditLogsTests(client);
  registerBoundaryCasesTests(client, mockTarget);
  registerCrossFeatureTests(client, mockTarget);
  registerRealWorldWorkflowTests(client, mockTarget, mockMidtrans);
  registerTier5AdversarialTests(client, mockTarget, mockMidtrans);

  // Execute All Test Suites
  const result = await runner.run();

  // Cleanup Servers
  await mockTarget.stop();
  await mockMidtrans.stop();
  if (bridgeServer) {
    await bridgeServer.stop();
  }

  // Summary Report
  console.log('\n\x1b[35m=====================================================\x1b[0m');
  console.log('\x1b[35m                 E2E TEST SUMMARY RESULTS            \x1b[0m');
  console.log('\x1b[35m=====================================================\x1b[0m');
  console.log(`  Total Test Cases : ${result.total}`);
  console.log(`  Passed           : \x1b[32m${result.passed}\x1b[0m`);
  console.log(`  Failed           : ${result.failed > 0 ? `\x1b[31m${result.failed}\x1b[0m` : `\x1b[32m0\x1b[0m`}`);
  console.log(`  Total Duration   : ${result.duration}ms`);
  console.log('\x1b[35m=====================================================\x1b[0m\n');

  if (result.failed > 0) {
    console.error('\x1b[31mE2E Test Suite Execution FAILED.\x1b[0m');
    process.exit(1);
  } else {
    console.log('\x1b[32mE2E Test Suite Execution PASSED SUCCESSFULLY (100% Success Rate).\x1b[0m');
    process.exit(0);
  }
}

runE2ESuite().catch(err => {
  console.error('Fatal error running E2E test suite:', err);
  process.exit(1);
});
