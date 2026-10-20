import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createApp } from '../../server/app.js';
import { availablePort, startTestMongo, dropTestDatabase } from './mongo.mjs';
const serverRequire = createRequire(new URL('../../server/package.json', import.meta.url));
const clientRequire = createRequire(new URL('../../client/package.json', import.meta.url));
const mongoose = serverRequire('mongoose');

export default async function setup() {
  let mongo, api, frontend;
  const memory = process.env.NEUROFORGE_E2E_STORAGE === 'memory';
  const cleanup = async () => {
    if (frontend) await new Promise(done => frontend.httpServer.close(done));
    if (api) await new Promise(done => api.close(done));
    if (mongo) {
      if (mongoose.connection.readyState === 1) await dropTestDatabase(mongoose.connection,mongo.dbName);
      await mongoose.disconnect(); await mongo.dispose();
    }
  };
  try {
    if (!memory) {
      mongo = await startTestMongo();
      await mongoose.connect(mongo.uri, { dbName:mongo.dbName, serverSelectionTimeoutMS:10000 });
    }
    const port = await availablePort();
    const mailbox=[];
    const app=createApp({allowMemoryFallback:memory,deliverAccountEmail:async message=>mailbox.push(message)});
    app.get('/api/__test/email',(req,res)=>res.json({data:mailbox.filter(message=>message.to===req.query.email)}));
    api = app.listen(port,'127.0.0.1');
    await new Promise(done => api.once('listening',done));
    const { preview } = await import(pathToFileURL(clientRequire.resolve('vite')).href);
    frontend = await preview({ root:resolve('client'), preview: { host:'127.0.0.1', port:Number(process.env.NEUROFORGE_E2E_PORT || 4179), strictPort:true, proxy:{'/api':`http://127.0.0.1:${port}`} } });
    console.log(`Isolated browser baseline: ${memory ? 'temporary memory' : 'real MongoDB'}; production client build.`);
    return cleanup;
  } catch (error) { await cleanup(); throw error; }
}
