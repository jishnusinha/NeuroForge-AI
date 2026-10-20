/** Production-only HTTP boundary. Cloud ingress and accounts need independent audit. */
export function trustedCorsOrigins({ originList = '', publicAppUrl = '' } = {}) {
  const raw=String(originList||'').split(',').map(item=>item.trim()).filter(Boolean);
  if (publicAppUrl) raw.push(new URL(publicAppUrl).origin);
  const list=[];
  for(const candidate of raw) {
    const url=new URL(candidate);
    if (!['https:','http:'].includes(url.protocol) || url.username || url.password ||
      url.pathname!=='/' || url.search || url.hash ||
      (url.protocol==='http:' && !['localhost','127.0.0.1','[::1]'].includes(url.hostname))) {
      throw new Error('INVALID_PRODUCTION_CORS_ORIGIN: Use exact HTTPS origins (or local loopback).');
    }
    const origin=url.origin;
    if (!list.includes(origin)) list.push(origin);
  }
  return list;
}

export function requestIdOrNew(value, generate) {
  return typeof value==='string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/.test(value)
    ? value : generate();
}

export function isTrustedRequestOrigin(origin, origins) {
  return typeof origin==='string' && origins.includes(origin);
}
