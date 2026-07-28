import React, { useState } from 'react';
import { Code, Copy, Check, Terminal, Shield, Cpu, HelpCircle } from 'lucide-react';

export const IntegrationGuide: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'php' | 'nodejs' | 'laravel' | 'wordpress'>('php');
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  const snippets = {
    php: `<?php
/**
 * PHP Native Webhook Handler
 * Verifies X-Bridge-Signature HMAC-SHA256
 */
$targetSecret = getenv('WEBHOOK_SECRET') ?: 'YOUR_WEBHOOK_SECRET';
$rawPayload = file_get_contents('php://input');
$receivedSignature = $_SERVER['HTTP_X_BRIDGE_SIGNATURE'] ?? '';

// Calculate expected signature
$expectedSignature = hash_hmac('sha256', $rawPayload, $targetSecret);

if (!hash_equals($expectedSignature, $receivedSignature)) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid X-Bridge-Signature']);
    exit;
}

// Parse verified Midtrans notification payload
$data = json_decode($rawPayload, true);
$orderId = $data['order_id'];
$transactionStatus = $data['transaction_status'];

// Process payment status update in database...
http_response_code(200);
echo json_encode(['status' => 'success', 'order_id' => $orderId]);
`,
    nodejs: `import crypto from 'crypto';
import express from 'express';

const app = express();
// Note: Use raw body buffer for accurate signature validation
app.use('/api/webhooks/midtrans', express.raw({ type: 'application/json' }));

app.post('/api/webhooks/midtrans', (req, res) => {
  const webhookSecret = process.env.WEBHOOK_SECRET || 'YOUR_WEBHOOK_SECRET';
  const receivedSig = req.headers['x-bridge-signature'];
  const rawBody = req.body.toString('utf-8');

  // Compute HMAC-SHA256 signature
  const expectedSig = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (receivedSig !== expectedSig) {
    return res.status(401).json({ error: 'Invalid X-Bridge-Signature' });
  }

  const payload = JSON.parse(rawBody);
  console.log(\`[Verified Webhook] Order: \${payload.order_id}, Status: \${payload.transaction_status}\`);

  // Return HTTP 200 OK
  return res.status(200).json({ status: 'success' });
});
`,
    laravel: `namespace App\\Http\\Middleware;

use Closure;
use Illuminate\\Http\\Request;

class VerifyBridgeSignature
{
    /**
     * Middleware to verify incoming Midtrans Payment Bridge signature
     */
    public function handle(Request $request, Closure $next)
    {
        $secret = config('services.midtrans.webhook_secret');
        $signature = $request->header('X-Bridge-Signature');
        $rawContent = $request->getContent();

        $expected = hash_hmac('sha256', $rawContent, $secret);

        if (!hash_equals($expected, (string) $signature)) {
            return response()->json(['error' => 'Invalid X-Bridge-Signature'], 401);
        }

        return $next($request);
    }
}
`,
    wordpress: `<?php
/**
 * WordPress Plugin / Theme Webhook Integration
 * Endpoint: POST /wp-json/bridge/v1/webhook
 */
add_action('rest_api_init', function () {
    register_rest_route('bridge/v1', '/webhook', [
        'methods' => 'POST',
        'callback' => 'handle_bridge_webhook',
        'permission_callback' => '__return_true',
    ]);
});

function handle_bridge_webhook(WP_REST_Request $request) {
    $secret = get_option('bridge_webhook_secret', 'YOUR_WEBHOOK_SECRET');
    $received_sig = $request->get_header('x_bridge_signature');
    $raw_body = $request->get_body();

    $expected_sig = hash_hmac('sha256', $raw_body, $secret);

    if (!hash_equals($expected_sig, $received_sig)) {
        return new WP_Error('invalid_signature', 'Invalid Bridge Signature', ['status' => 401]);
    }

    $payload = json_decode($raw_body, true);
    $order_id = sanitize_text_field($payload['order_id']);
    
    // Update WooCommerce or Custom WP Order Status
    do_action('bridge_payment_verified', $order_id, $payload);

    return rest_ensure_response(['status' => 'success']);
}
`
  };

  const handleCopyCode = (tab: 'php' | 'nodejs' | 'laravel' | 'wordpress') => {
    navigator.clipboard.writeText(snippets[tab]);
    setCopiedTab(tab);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-xl overflow-hidden mb-8">
      {/* Header Bar */}
      <div className="p-5 border-b border-slate-800 bg-slate-900/60 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Code className="w-5 h-5 text-indigo-400" />
            Developer Integration Guide
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Ready-to-copy code snippets for validating <code className="text-indigo-300 font-mono">X-Bridge-Signature</code> (HMAC-SHA256) in your target website codebase.
          </p>
        </div>

        {/* Verification Overview Badge */}
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 font-mono">
          <Shield className="w-4 h-4 text-indigo-400" />
          <span>HMAC-SHA256 Verification</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/60 overflow-x-auto">
        <button
          onClick={() => setActiveTab('php')}
          className={`px-5 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'php'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          PHP (Native)
        </button>

        <button
          onClick={() => setActiveTab('nodejs')}
          className={`px-5 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'nodejs'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          Node.js / Express
        </button>

        <button
          onClick={() => setActiveTab('laravel')}
          className={`px-5 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'laravel'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          Laravel Middleware
        </button>

        <button
          onClick={() => setActiveTab('wordpress')}
          className={`px-5 py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'wordpress'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Code className="w-3.5 h-3.5" />
          WordPress REST API
        </button>
      </div>

      {/* Code Snippet Box */}
      <div className="p-5 relative bg-slate-950">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {activeTab.toUpperCase()} Implementation Example
          </span>
          <button
            onClick={() => handleCopyCode(activeTab)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-all"
          >
            {copiedTab === activeTab ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-300" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/90 p-4 font-mono text-xs text-indigo-200 leading-relaxed">
          <pre className="whitespace-pre">{snippets[activeTab]}</pre>
        </div>

        {/* Integration Instructions Footer */}
        <div className="mt-4 p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-start gap-3 text-xs text-slate-300">
          <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-100">How signature verification works:</span>
            <p className="text-slate-400 mt-0.5">
              The Payment Bridge signs every routed payload with <code className="text-indigo-300 font-mono">HMAC-SHA256(raw_body, target_webhook_secret)</code> and includes it in the <code className="text-indigo-300 font-mono">X-Bridge-Signature</code> header. Your target application must compute the identical HMAC-SHA256 signature using the raw HTTP request body and compare it using timing-safe comparison.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
