import test from 'node:test';
import assert from 'node:assert/strict';

// Eseguire contro una preview locale SENZA variabili Supabase.
const base = process.env.CURA_PREVIEW_URL || 'http://localhost:3001';
test('senza configurazione i moduli non accettano credenziali', async () => {
  const response = await fetch(`${base}/login`);
  assert.equal(response.status,200);
  const html = await response.text();
  assert.ok(html.includes('Collegamento a Supabase da completare'));
  assert.ok(/<input(?=[^>]*\bname="email")(?=[^>]*\bdisabled)[^>]*>/.test(html),'Campo email disabilitato');
  assert.ok(/<input(?=[^>]*\bname="password")(?=[^>]*\bdisabled)[^>]*>/.test(html),'Campo password disabilitato');
});
test('il cambio password è protetto anche entrando direttamente dalla URL', async () => {
  const response = await fetch(`${base}/account/password`,{redirect:'manual'});
  assert.equal(response.status,307);
  assert.equal(new URL(response.headers.get('location'),base).pathname,'/login');
});
for (const query of ['', '?next=https://example.org', '?token_hash=test-fittizio&type=recovery&next=//example.org', '?token_hash=test-fittizio&type=invalid']) {
  test(`link di conferma non valido non concede accesso: ${query || 'nessun token'}`, async () => {
    const response = await fetch(`${base}/auth/confirm${query}`,{redirect:'manual'});
    assert.equal(response.status,307);
    const destination = new URL(response.headers.get('location'),base);
    assert.equal(destination.origin,new URL(base).origin);
    assert.equal(destination.pathname,'/login');
    assert.equal(destination.search,'?notice=invalid-link');
    assert.match(response.headers.get('cache-control'),/no-store/);
  });
}
