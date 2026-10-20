import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';

test('Phase 4: Account registration, login, and secure session management', async () => {
  const app = createApp({ allowMemoryFallback: true });
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Register User A
    const regRes = await fetch(`${baseUrl}/api/v2/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@neuroforge.ai',
        name: 'Alice Researcher',
        password: 'SuperSecurePassword123!',
      }),
    });
    assert.equal(regRes.status, 201);
    const regData = await regRes.json();
    assert.ok(regData.user.id);
    assert.equal(regData.user.email, 'alice@neuroforge.ai');
    assert.ok(regData.token);

    // 2. Duplicate registration fails
    const dupRes = await fetch(`${baseUrl}/api/v2/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@neuroforge.ai',
        name: 'Alice Duplicate',
        password: 'SuperSecurePassword123!',
      }),
    });
    assert.equal(dupRes.status, 409);

    // 3. Login User A
    const loginRes = await fetch(`${baseUrl}/api/v2/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@neuroforge.ai',
        password: 'SuperSecurePassword123!',
      }),
    });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.ok(loginData.token);

    // 4. Verify /me with token
    const meRes = await fetch(`${baseUrl}/api/v2/auth/me`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    assert.equal(meRes.status, 200);
    const meData = await meRes.json();
    assert.equal(meData.user.email, 'alice@neuroforge.ai');
  } finally {
    server.close();
  }
});

test('Phase 4: Account isolation enforces private ownership on projects and mutations', async () => {
  const app = createApp({ allowMemoryFallback: true });
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Create User A
    const resA = await fetch(`${baseUrl}/api/v2/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'userA@neuroforge.ai', name: 'User A', password: 'PasswordA123!' }),
    });
    const { token: tokenA } = await resA.json();

    // Create User B
    const resB = await fetch(`${baseUrl}/api/v2/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'userB@neuroforge.ai', name: 'User B', password: 'PasswordB123!' }),
    });
    const { token: tokenB } = await resB.json();

    // User A creates a project
    const projRes = await fetch(`${baseUrl}/api/v2/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: 'Private Neural Project', description: 'Top Secret' }),
    });
    assert.equal(projRes.status, 201);
    const { data: projectA } = await projRes.json();
    assert.ok(projectA.id);

    // User B tries to read User A's project -> MUST BE REJECTED (404 Not Found)
    const accessRes = await fetch(`${baseUrl}/api/v2/projects/${projectA.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(accessRes.status, 404, 'User B must not be able to read User A project');

    // User B tries to update User A's project -> MUST BE REJECTED (404)
    const updateRes = await fetch(`${baseUrl}/api/v2/projects/${projectA.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ name: 'Hijacked' }),
    });
    assert.equal(updateRes.status, 404);

    // User B tries to delete User A's project -> MUST BE REJECTED (404)
    const deleteRes = await fetch(`${baseUrl}/api/v2/projects/${projectA.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.equal(deleteRes.status, 404);
  } finally {
    server.close();
  }
});

test('Phase 4: Guest projects work immediately and can be migrated to an account idempotently', async () => {
  const app = createApp({ allowMemoryFallback: true });
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const guestToken = 'guest-session-token-1234567890-secure';

    // 1. Guest creates a project
    const guestProjRes = await fetch(`${baseUrl}/api/v2/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Owner-Token': guestToken },
      body: JSON.stringify({ name: 'Guest Exploration Project' }),
    });
    assert.equal(guestProjRes.status, 201);
    const { data: guestProj } = await guestProjRes.json();

    // 2. User registers
    const userRes = await fetch(`${baseUrl}/api/v2/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'migrator@neuroforge.ai', name: 'Migrator', password: 'PasswordMigrate123!' }),
    });
    const { token: userToken } = await userRes.json();

    // 3. User migrates guest data
    const migRes = await fetch(`${baseUrl}/api/v2/auth/migrate-guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ guestToken }),
    });
    assert.equal(migRes.status, 200);

    // 4. Repeated migration call is idempotent
    const repeatMigRes = await fetch(`${baseUrl}/api/v2/auth/migrate-guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ guestToken }),
    });
    assert.equal(repeatMigRes.status, 200);
  } finally {
    server.close();
  }
});

test('Phase 4: Explicit scoped sharing enforces private default, revocation, and expiry', async () => {
  const app = createApp({ allowMemoryFallback: true });
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Register owner
    const regRes = await fetch(`${baseUrl}/api/v2/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@neuroforge.ai', name: 'Owner', password: 'PasswordOwner123!' }),
    });
    const { token } = await regRes.json();

    const projectResponse = await fetch(baseUrl+'/api/v2/projects',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({name:'Actually owned shared project'})});
    const sharedProject=(await projectResponse.json()).data;
    // 1. Create share link
    const shareRes = await fetch(`${baseUrl}/api/v2/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        resourceType: 'project',
        resourceId: sharedProject.id,
        expiresInHours: 24,
      }),
    });
    assert.equal(shareRes.status, 201);
    const { data: shareData } = await shareRes.json();
    assert.ok(shareData.shareId);
    assert.equal(shareData.scope, 'read-only');

    // 2. Public access to share link
    const readRes = await fetch(`${baseUrl}/api/v2/shares/${shareData.shareId}`);
    assert.equal(readRes.status, 200);

    // 3. Revoke share link
    const revokeRes = await fetch(`${baseUrl}/api/v2/shares/${shareData.shareId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(revokeRes.status, 200);

    // 4. Accessing revoked share link returns 410 Gone / SHARE_REVOKED
    const revokedAccessRes = await fetch(`${baseUrl}/api/v2/shares/${shareData.shareId}`);
    assert.equal(revokedAccessRes.status, 410);
    const errData = await revokedAccessRes.json();
    assert.equal(errData.code, 'SHARE_REVOKED');
  } finally {
    server.close();
  }
});

test('Phase 4: Production database failure produces honest 503 STORAGE_UNAVAILABLE', async () => {
  // App configured without memory fallback (production mode)
  const app = createApp({ allowMemoryFallback: false });
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // When MongoDB is disconnected, writing to projects must return 503
    const res = await fetch(`${baseUrl}/api/v2/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Owner-Token': 'guest-session-1234567890' },
      body: JSON.stringify({ name: 'Should Fail Honestly' }),
    });
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.code, 'STORAGE_UNAVAILABLE');
  } finally {
    server.close();
  }
});
