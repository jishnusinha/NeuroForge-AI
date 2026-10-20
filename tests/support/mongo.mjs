import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createServer, connect } from 'node:net';
import { randomUUID } from 'node:crypto';

export async function availablePort() {
  const server = createServer();
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const { port } = server.address();
  await new Promise(done => server.close(done));
  return port;
}

export async function startTestMongo() {
  const dbName = `neuroforge_test_${randomUUID().replaceAll('-', '')}`;
  if (process.env.NEUROFORGE_TEST_MONGODB_URI) return { uri: process.env.NEUROFORGE_TEST_MONGODB_URI, dbName, dispose: async () => {} };
  const directory = await mkdtemp(join(tmpdir(), 'neuroforge-mongo-'));
  const port = await availablePort();
  const log = join(directory, 'mongod.log');
  const child = spawn(process.env.NEUROFORGE_MONGOD_BINARY || 'mongod', [
    '--bind_ip', '127.0.0.1', '--port', String(port), '--dbpath', directory,
    '--logpath', log, '--quiet', '--wiredTigerCacheSizeGB', '0.25',
  ], { windowsHide: true, stdio: 'ignore' });
  let startupError;
  child.once('error', error => { startupError = error; });
  const dispose = async () => {
    if (child.exitCode === null && child.pid) {
      const exited = new Promise(done => child.once('exit', done));
      child.kill();
      await exited;
    }
    // Never recursively remove a directory outside the dedicated temporary root.
    if (dirname(resolve(directory)) !== resolve(tmpdir()) || !basename(directory).startsWith('neuroforge-mongo-')) throw new Error('Unsafe MongoDB cleanup path.');
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  };
  try {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      if (startupError || child.exitCode !== null) throw startupError || new Error('Test MongoDB exited during startup.');
      const ready = await new Promise(done => {
        const socket = connect({ host: '127.0.0.1', port });
        socket.once('connect', () => { socket.destroy(); done(true); });
        socket.once('error', () => { socket.destroy(); done(false); });
      });
      if (ready) return { uri: `mongodb://127.0.0.1:${port}`, dbName, dispose };
      await new Promise(done => setTimeout(done, 100));
    }
    throw new Error('Test MongoDB startup exceeded 20 seconds.');
  } catch (error) {
    const diagnostic = await readFile(log, 'utf8').catch(() => 'Install mongod or set NEUROFORGE_TEST_MONGODB_URI.');
    await dispose();
    throw new Error(`${error.message}\n${diagnostic.slice(-2000)}`);
  }
}

export async function dropTestDatabase(connection, expectedName) {
  if (!expectedName.startsWith('neuroforge_test_') || connection.name !== expectedName) throw new Error('Refusing to drop a non-test database.');
  await connection.dropDatabase();
}
