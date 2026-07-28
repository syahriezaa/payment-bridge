import http from 'node:http';
import { verifyBridgeSignature } from './crypto-utils.js';

export class MockTargetServer {
  constructor(port = 9999) {
    this.port = port;
    this.server = null;
    this.receivedRequests = [];
    this.responseCode = 200;
    this.failCount = 0;
    this.failCode = 500;
    this.delayMs = 0;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });

        req.on('end', async () => {
          let parsedBody = null;
          try {
            parsedBody = JSON.parse(body);
          } catch {
            parsedBody = null;
          }

          const record = {
            method: req.method,
            url: req.url,
            headers: req.headers,
            rawBody: body,
            body: parsedBody,
            signatureHeader: req.headers['x-bridge-signature'],
            timestamp: Date.now()
          };

          this.receivedRequests.push(record);

          if (this.delayMs > 0) {
            await new Promise(r => setTimeout(r, this.delayMs));
          }

          let statusCode = this.responseCode;
          if (this.failCount > 0) {
            this.failCount--;
            statusCode = this.failCode;
          }

          res.writeHead(statusCode, { 'Content-Type': 'application/json' });
          if (statusCode >= 200 && statusCode < 300) {
            res.end(JSON.stringify({ status: 'ok', received: true }));
          } else {
            res.end(JSON.stringify({ status: 'error', code: statusCode }));
          }
        });
      });

      this.server.on('error', err => reject(err));
      this.server.listen(this.port, () => {
        resolve();
      });
    });
  }

  stop() {
    return new Promise(resolve => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  getRequests() {
    return [...this.receivedRequests];
  }

  clearRequests() {
    this.receivedRequests = [];
  }

  setResponseCode(code) {
    this.responseCode = code;
  }

  setFailCount(count, failCode = 500) {
    this.failCount = count;
    this.failCode = failCode;
  }

  setDelay(ms) {
    this.delayMs = ms;
  }

  verifyRequestSignature(requestIndex, webhookSecret) {
    const req = this.receivedRequests[requestIndex];
    if (!req) return false;
    return verifyBridgeSignature(req.rawBody, webhookSecret, req.signatureHeader);
  }
}
