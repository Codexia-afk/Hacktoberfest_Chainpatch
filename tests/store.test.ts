import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
process.env.CHAINPATCH_DB=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'chainpatch-test-')),'test.sqlite');
test('reviews, policy snapshots, and replay inputs survive storage round trips and process restarts',async()=>{
  const {saveReview,getReview,updateReview,listReviews}=await import('../lib/store');
  const {createReview,simulate}=await import('../lib/engine');const {seedInput}=await import('../lib/seed');const {narrowPolicy}=await import('../lib/types');
  const review=createReview({...seedInput,title:'Persistence check'});saveReview(review);
  updateReview(review.id,r=>({...r,policy:narrowPolicy,runs:[simulate(r,'after'),simulate({...r,policy:narrowPolicy},'fixed')]}));
  const saved=getReview(review.id)!;assert.equal(saved.runs[0].destination[0].classification,'private-source');assert.deepEqual(saved.runs[1].policy,narrowPolicy);assert.ok(listReviews().some(r=>r.id===review.id));assert.ok(getReview('demo'));assert.equal(getReview('missing'),undefined);
  const script=`const { getReview } = require('./lib/store.ts'); process.stdout.write(JSON.stringify(getReview(${JSON.stringify(review.id)})));`;
  const child=spawnSync(process.execPath,['--import','tsx','-e',script],{cwd:process.cwd(),env:process.env,encoding:'utf8'});assert.equal(child.status,0,child.stderr);assert.deepEqual(JSON.parse(child.stdout),saved);
  const reloaded=getReview(review.id)!;reloaded.runs[1].policy!.allowedInputs.push('private-source');assert.deepEqual(getReview(review.id)!.runs[1].policy,narrowPolicy);
});
test('failed updates rollback all writes and cannot change review identity',async()=>{
  const {saveReview,getReview,updateReview}=await import('../lib/store');const {createReview}=await import('../lib/engine');const {seedInput}=await import('../lib/seed');
  const review=saveReview(createReview({...seedInput,title:'Rollback check'}));
  assert.throws(()=>updateReview(review.id,r=>{saveReview({...r,title:'Should roll back'});throw new Error('deliberate failure');}),/deliberate failure/);assert.deepEqual(getReview(review.id),review);
  assert.throws(()=>updateReview(review.id,r=>({...r,id:'different-identity'})),/cannot change its identity/);assert.equal(getReview('different-identity'),undefined);assert.deepEqual(getReview(review.id),review);
  assert.throws(()=>updateReview('missing',r=>r),/Review not found/);
  updateReview(review.id,r=>({...r,title:'Committed after rollback'}));assert.equal(getReview(review.id)!.title,'Committed after rollback');
});
test('initializing storage in another process preserves seeded demo changes',async()=>{
  const {getReview,updateReview}=await import('../lib/store');
  updateReview('demo',r=>({...r,title:'Preserved demo title'}));
  const child=spawnSync(process.execPath,['--import','tsx','-e',`const {getReview}=require('./lib/store.ts');process.stdout.write(getReview('demo').title);`],{cwd:process.cwd(),env:process.env,encoding:'utf8'});assert.equal(child.status,0,child.stderr);assert.equal(child.stdout,'Preserved demo title');assert.equal(getReview('demo')!.title,'Preserved demo title');
});

test('legacy reads do not rewrite stored bytes and invalid updates preserve the previous record', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { getReview, saveReview, updateReview } = await import('../lib/store');
  const { createReview } = await import('../lib/engine');
  const { seedInput } = await import('../lib/seed');
  const review = createReview({ ...seedInput, title: 'Legacy preservation check' });
  const connection = new DatabaseSync(process.env.CHAINPATCH_DB!);
  try {
    const raw = JSON.stringify(review);
    connection.prepare('INSERT INTO reviews (id, data) VALUES (?, ?)').run(review.id, raw);
    assert.deepEqual(getReview(review.id), review);
    const stored = () => (connection.prepare('SELECT data FROM reviews WHERE id = ?').get(review.id) as { data: string }).data;
    assert.equal(stored(), raw);
    assert.throws(() => updateReview(review.id, r => ({ ...r, runs: [{ outcome: 'blocked' }] } as never)), /invalid review/);
    assert.equal(stored(), raw);
    saveReview(getReview(review.id)!);
    assert.equal(JSON.parse(stored()).storageSchemaVersion, 1);
    const future = JSON.stringify({ storageSchemaVersion: 99, review });
    connection.prepare('UPDATE reviews SET data = ? WHERE id = ?').run(future, review.id);
    assert.throws(() => getReview(review.id), /stored data was left unchanged/);
    assert.throws(() => updateReview(review.id, r => r), /stored data was left unchanged/);
    assert.equal(stored(), future);
  } finally {
    connection.close();
  }
});
