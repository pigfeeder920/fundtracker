#!/usr/bin/env node
/**
 * 本地 CORS 代理：将浏览器的 dashscope 请求转发到阿里云，避免 CORS 限制。
 * 使用：node fund-tracker-proxy.js
 * 然后页面里把「代理地址」设为 http://localhost:3123
 */
const http = require('http');

const TARGET = 'https://dashscope.aliyuncs.com';
const PORT = 3123;

function allowCors(res, origin) {
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || '*';

  if (req.method === 'OPTIONS') {
    allowCors(res, origin);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/api/dashscope/generation') {
    allowCors(res, origin);
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found. POST /api/dashscope/generation to proxy to dashscope.');
    return;
  }

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const auth = req.headers.authorization || '';
    const url = TARGET + '/api/v1/services/aigc/text-generation/generation';

    const opt = {
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json',
        'Content-Length': body.length
      }
    };

    const proxy = require('https').request(url, opt, (upRes) => {
      allowCors(res, origin);
      res.writeHead(upRes.statusCode, {
        'Content-Type': upRes.headers['content-type'] || 'application/json'
      });
      upRes.pipe(res);
    });
    proxy.on('error', (e) => {
      allowCors(res, origin);
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Proxy error: ' + e.message);
    });
    proxy.write(body);
    proxy.end();
  });
});

server.listen(PORT, () => {
  console.log('CORS 代理已启动: http://localhost:' + PORT);
  console.log('请保持本窗口运行，然后在浏览器打开 fund-tracker 页面使用 OCR 解析。');
});
