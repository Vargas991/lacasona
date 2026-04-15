import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '..', 'dist');

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function getArgValue(name, fallback) {
  const index = process.argv.findIndex((arg) => arg === name || arg.startsWith(`${name}=`));
  if (index === -1) {
    return fallback;
  }

  const arg = process.argv[index];
  if (arg.includes('=')) {
    return arg.split('=').slice(1).join('=');
  }

  return process.argv[index + 1] ?? fallback;
}

function getHost() {
  return getArgValue('--host', '0.0.0.0');
}

function getPort() {
  const value = getArgValue('--port', '4173');
  const port = Number.parseInt(value, 10);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Puerto invalido: ${value}`);
  }

  return port;
}

function resolveFilePath(urlPath) {
  const normalizedPath = urlPath === '/' ? '/index.html' : decodeURIComponent(urlPath);
  const safePath = path.normalize(normalizedPath).replace(/^([.][.][/\\])+/, '');
  return path.join(distDir, safePath);
}

async function existingFile(filePath) {
  try {
    const fileStats = await stat(filePath);
    return fileStats.isFile() ? filePath : null;
  } catch {
    return null;
  }
}

async function getResponseFile(urlPath) {
  const directFile = await existingFile(resolveFilePath(urlPath));
  if (directFile) {
    return directFile;
  }

  return path.join(distDir, 'index.html');
}

function sendFile(response, filePath) {
  const ext = path.extname(filePath);
  response.writeHead(200, {
    'Content-Type': mimeTypes[ext] ?? 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });

  createReadStream(filePath).pipe(response);
}

await access(path.join(distDir, 'index.html'));

const host = getHost();
const port = getPort();

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    const filePath = await getResponseFile(requestUrl.pathname);
    sendFile(response, filePath);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(`Error sirviendo frontend: ${error instanceof Error ? error.message : String(error)}`);
  }
});

server.listen(port, host, () => {
  console.log(`Frontend disponible en http://${host}:${port}`);
  console.log(`Sirviendo archivos desde ${distDir}`);
});
