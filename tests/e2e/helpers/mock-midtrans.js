import http from 'node:http';

export class MockMidtransServer {
  constructor(port = 9998) {
    this.port = port;
    this.server = null;
    this.receivedSnapRequests = [];
    this.forcedStatusCode = null;
    this.forcedResponseBody = null;
  }

  setForcedResponse(statusCode, body) {
    this.forcedStatusCode = statusCode;
    this.forcedResponseBody = body;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });

        req.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(body);
          } catch {
            parsed = null;
          }

          this.receivedSnapRequests.push({
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: parsed,
            timestamp: Date.now()
          });

          if (req.url.includes('/snap/v1/transactions') && req.method === 'POST') {
            if (this.forcedStatusCode !== null) {
              const code = this.forcedStatusCode;
              const resBody = this.forcedResponseBody || { status_code: String(code), status_message: 'Forced Error' };
              res.writeHead(code, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(resBody));
              return;
            }

            const authHeader = req.headers.authorization || '';
            if (!authHeader) {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status_code: '401', status_message: 'Unauthorized' }));
              return;
            }

            if (!parsed || !parsed.order_id || parsed.gross_amount === undefined) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status_code: '400', status_message: 'Invalid gross_amount or order_id' }));
              return;
            }

            const token = `snap-token-${parsed.order_id}-${Date.now()}`;
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              token,
              redirect_url: `https://app.sandbox.midtrans.com/snap/v2/vtweb/${token}`
            }));
            return;
          }

          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status_code: '404', status_message: 'Not found' }));
        });
      });

      this.server.on('error', err => reject(err));
      this.server.listen(this.port, () => resolve());
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

  getSnapRequests() {
    return [...this.receivedSnapRequests];
  }

  clearRequests() {
    this.receivedSnapRequests = [];
  }
}
