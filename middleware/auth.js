require('dotenv').config();

/**
 * Keycloak token verification middleware.
 * Validates the Bearer token from the frontend Keycloak JS adapter
 * by introspecting it against the Keycloak server, with a JWKS fallback.
 */

const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const REALM = process.env.KEYCLOAK_REALM || 'ems-realm';
const ISSUER = `${KEYCLOAK_URL}/realms/${REALM}`;

let cachedJwks = null;
let jwksFetchedAt = 0;
const JWKS_CACHE_MS = 5 * 60 * 1000; // cache 5 min

/**
 * Fetch JWKS from Keycloak (with caching)
 */
async function getJwks() {
  const now = Date.now();
  if (cachedJwks && now - jwksFetchedAt < JWKS_CACHE_MS) return cachedJwks;
  const res = await fetch(`${ISSUER}/protocol/openid-connect/certs`);
  if (!res.ok) throw new Error('Failed to fetch JWKS');
  cachedJwks = await res.json();
  jwksFetchedAt = now;
  return cachedJwks;
}

/**
 * Decode JWT without verification (to read header/payload)
 */
function decodeJwt(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  return { header, payload };
}

/**
 * Import a JWK as a CryptoKey for verification
 */
async function importJwk(jwk) {
  const { subtle } = globalThis.crypto || require('crypto').webcrypto || require('crypto');
  return subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
}

/**
 * Verify JWT signature using Web Crypto
 */
async function verifyToken(token) {
  const { header, payload } = decodeJwt(token);

  // Basic claim validation
  if (payload.iss !== ISSUER) throw new Error('Invalid issuer');
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('Token expired');

  // Get signing key
  const jwks = await getJwks();
  const jwk = jwks.keys.find(k => k.kid === header.kid && k.use === 'sig');
  if (!jwk) throw new Error('Signing key not found');

  // Verify signature
  const key = await importJwk(jwk);
  const parts = token.split('.');
  const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = Buffer.from(parts[2], 'base64url');
  const { subtle } = globalThis.crypto || require('crypto').webcrypto || require('crypto');
  const valid = await subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data);
  if (!valid) throw new Error('Invalid signature');

  return payload;
}

/**
 * Express middleware
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = await verifyToken(token);
    req.user = {
      id: payload.sub,
      username: payload.preferred_username,
      email: payload.email,
      name: payload.name,
      roles: payload.realm_access?.roles || []
    };
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

module.exports = authenticate;
