// Cloudflare Pages Function: the trusted proxy between Cloudflare Access and
// the pipeline Worker.
//
// Security model:
//   * This Function only runs behind Access (pipeline.cwprop.com). Access
//     injects a signed JWT in `Cf-Access-Jwt-Assertion`.
//   * We VERIFY that JWT's RS256 signature against the team's public keys
//     before trusting the identity — a decode-only check would let anyone
//     hitting the public *.pages.dev origin (which has no Access in front)
//     forge an admin email.
//   * We forward the verified email to the Worker and attach a shared secret
//     (PROXY_SECRET) so the Worker can reject any request that did not come
//     through this proxy (i.e. direct hits to its *.workers.dev origin).

const BACKEND = 'https://pipeline-backend.office-a21.workers.dev';
const TEAM_DOMAIN = 'https://cwprop.cloudflareaccess.com';
const CERTS_URL = `${TEAM_DOMAIN}/cdn-cgi/access/certs`;

let _jwkCache = { at: 0, keys: null };

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function b64urlToString(s) { return new TextDecoder().decode(b64urlToBytes(s)); }

async function getKeys(force) {
  const now = Date.now();
  if (!force && _jwkCache.keys && (now - _jwkCache.at) < 3600000) return _jwkCache.keys;
  const res = await fetch(CERTS_URL, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!res.ok) throw new Error(`certs fetch ${res.status}`);
  const data = await res.json();
  _jwkCache = { at: now, keys: data.keys || [] };
  return _jwkCache.keys;
}

// Returns the verified claims, or null if the token is missing/invalid.
async function verifyAccessJwt(token, expectedAud) {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = JSON.parse(b64urlToString(parts[0]));
    const payload = JSON.parse(b64urlToString(parts[1]));
    if (header.alg !== 'RS256') return null;

    const now = Date.now();
    if (payload.exp && now >= payload.exp * 1000) return null;
    if (payload.nbf && now < payload.nbf * 1000 - 60000) return null;
    if (payload.iss && payload.iss !== TEAM_DOMAIN) return null;
    if (expectedAud) {
      const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!auds.includes(expectedAud)) return null;
    }

    let keys = await getKeys(false);
    let jwk = keys.find(k => k.kid === header.kid);
    if (!jwk) { keys = await getKeys(true); jwk = keys.find(k => k.kid === header.kid); }
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['verify']
    );
    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), data);
    return ok ? payload : null;
  } catch {
    return null;
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  const claims = await verifyAccessJwt(jwt, env.ACCESS_AUD || null);
  const email = claims && claims.email ? claims.email : null;

  const headers = new Headers();
  headers.set('Content-Type', request.headers.get('Content-Type') || 'application/json');
  // Forward the cryptographically-verified identity in a proxy-owned header.
  // (Cf-Access-* headers are stripped by Cloudflare before reaching the Worker,
  // so we cannot rely on that name for the hop.) The Worker trusts this header
  // only in combination with the X-Proxy-Secret below.
  if (email) headers.set('X-Proxy-User-Email', email);
  // Prove to the Worker that this request came through the trusted proxy.
  if (env.PROXY_SECRET) headers.set('X-Proxy-Secret', env.PROXY_SECRET);

  const response = await fetch(`${BACKEND}${url.pathname}${url.search}`, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
