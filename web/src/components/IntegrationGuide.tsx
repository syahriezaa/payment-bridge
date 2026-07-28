import React, { useState } from 'react';
import { Code, Copy, Check, Terminal, Shield, Cpu, HelpCircle, FileCode, Layers } from 'lucide-react';

export const IntegrationGuide: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'php' | 'nodejs' | 'python' | 'woocommerce'>('php');
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

// Calculate expected HMAC-SHA256 signature
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
// Note: Use raw body buffer for accurate HMAC-SHA256 signature validation
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
    python: `import hmac
import hashlib
from flask import Flask, request, jsonify

app = Flask(__name__)

WEBHOOK_SECRET = "YOUR_WEBHOOK_SECRET"

@app.route('/api/webhooks/midtrans', methods=['POST'])
def handle_midtrans_webhook():
    received_sig = request.headers.get('X-Bridge-Signature', '')
    raw_payload = request.get_data()  # Get raw bytes

    # Calculate HMAC-SHA256 signature
    expected_sig = hmac.new(
        WEBHOOK_SECRET.encode('utf-[#8'),
        raw_payload,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_sig, received_sig):
        return jsonify({'error': 'Invalid X-Bridge-Signature'}), 401

    payload = request.get_json()
    order_id = payload.get('order_id')
    status = payload.get('transaction_status')
    
    # Process order status update...
    return jsonify({'status': 'success', 'order_id': order_id}), 200
`,
    woocommerce: `<?php
/**
 * WooCommerce / WordPress REST API Webhook Integration
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
    
    // Update WooCommerce Order Status
    do_action('bridge_payment_verified', $order_id, $payload);

    return rest_ensure_response(['status' => 'success']);
}
`
  };

  const handleCopyCode = (tab: 'php' | 'nodejs' | 'python' | 'woocommerce') => {
    navigator.clipboard.writeText(snippets[tab]);
    setCopiedTab(tab);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  return (
    <div className="glass-container p-6 mb-8 relative overflow-hidden">
      
      {/* Background Soft Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-200/30 via-emerald-200/20 to-transparent rounded-full blur-3xl pointer-events-none"></div>

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-200/80 mb-6">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-600 border border-indigo-500/20 shadow-sm">
              <Code className="w-5 h-5" />
            </div>
            Developer Integration Guide
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Copy-ready code snippets for verifying <code className="font-mono text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">X-Bridge-Signature</code> (HMAC-SHA256) in downstream merchant backend services.
          </p>
        </div>

        {/* Security Overview Badge */}
        <div className="glass-pill-badge bg-indigo-500/15 text-indigo-800 border border-indigo-500/25 py-1.5 px-3 font-mono text-xs">
          <Shield className="w-4 h-4 text-indigo-600" />
          <span>HMAC-SHA256 Signature Security</span>
        </div>
      </div>

      {/* Code Snippet Language Switcher Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-slate-100/80 backdrop-blur-md rounded-2xl border border-slate-200/80 mb-6">
        
        <button
          onClick={() => setActiveTab('php')}
          className={`py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'php'
              ? 'bg-white text-indigo-600 shadow-md border border-white/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Cpu className="w-4 h-4 text-indigo-500" />
          <span>PHP (Native)</span>
        </button>

        <button
          onClick={() => setActiveTab('nodejs')}
          className={`py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'nodejs'
              ? 'bg-white text-indigo-600 shadow-md border border-white/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Terminal className="w-4 h-4 text-emerald-500" />
          <span>Node.js / Express</span>
        </button>

        <button
          onClick={() => setActiveTab('python')}
          className={`py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'python'
              ? 'bg-white text-indigo-600 shadow-md border border-white/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileCode className="w-4 h-4 text-sky-500" />
          <span>Python (Flask)</span>
        </button>

        <button
          onClick={() => setActiveTab('woocommerce')}
          className={`py-2.5 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'woocommerce'
              ? 'bg-white text-indigo-600 shadow-md border border-white/80'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4 text-violet-500" />
          <span>WooCommerce</span>
        </button>

      </div>

      {/* Frosted Glass Snippet Box */}
      <div className="glass-card p-6 bg-white/80 border border-white/80 shadow-xl rounded-3xl relative">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            {activeTab.toUpperCase()} Validation Snippet
          </span>
          <button
            onClick={() => handleCopyCode(activeTab)}
            className="glass-button-primary px-4 py-2 text-xs inline-flex items-center gap-1.5"
          >
            {copiedTab === activeTab ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Code Snippet</span>
              </>
            )}
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900 p-5 font-mono text-xs text-indigo-200 leading-relaxed shadow-inner">
          <pre className="whitespace-pre text-[12px]">{snippets[activeTab]}</pre>
        </div>

        {/* Verification Explanation */}
        <div className="mt-5 p-4 rounded-2xl bg-indigo-50/80 border border-indigo-100 flex items-start gap-3 text-xs text-indigo-950 shadow-sm">
          <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-extrabold text-slate-900 text-sm block">How Signature Verification Works:</span>
            <p className="text-slate-600 mt-1 leading-normal">
              The Payment Bridge signs routed webhooks with <code className="font-mono text-indigo-700 font-bold bg-white px-1.5 py-0.5 rounded border border-indigo-200">HMAC-SHA256(raw_body, webhook_secret)</code> and attaches it to the <code className="font-mono text-indigo-700 font-bold bg-white px-1.5 py-0.5 rounded border border-indigo-200">X-Bridge-Signature</code> header. Your downstream target application should calculate the identical HMAC-SHA256 signature from the raw request payload and verify equality using timing-safe comparisons before updating order state in your database.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
