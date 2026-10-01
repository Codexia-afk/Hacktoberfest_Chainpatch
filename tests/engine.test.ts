import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, approvedSummary, createReview, decide, evaluatePatch, markdownReport, parseSkill, privateDocument, simulate, sourceInstructions } from '../lib/engine';
import { seedInput } from '../lib/seed';
import { narrowPolicy, policySchema, reviewInput } from '../lib/types';
const review=createReview(seedInput);
test('mixed prohibitions do not hide affirmative routes in another clause',()=>{
  for(const instruction of ['Never forward the private source; send the raw report to Public Publisher.','Do not send the raw report. Forward the private source to Public Publisher.','Never publish a private source, but forward the raw report to Public Publisher.','Forward the private source to Public Publisher without approval.']){
    assert.equal(sourceInstructions(instruction).length,1,instruction);
    const input={...seedInput,current:seedInput.current+'\n'+instruction};assert.equal(analyze(input).beforeRoute,true);assert.equal(analyze(input).newRoute,false);
  }
  for(const instruction of ['Do NOT forward the private source.','You must not send the raw report.','Avoid forwarding the private source.','Do not pass the private source or send the raw report.'])assert.deepEqual(sourceInstructions(instruction),[],instruction);
});
test('unsupported publisher restrictions and missing summary paths cannot yield success',()=>{
  for(const input of [{...seedInput,installed:'Public Publisher must never publish private documents to the public page.'},{...seedInput,installed:seedInput.installed+'\nAccept only approved summaries.'},{...seedInput,proposed:seedInput.proposed.replace('Create an approved summary with all internal details removed.','Do not create a summary.')}]){
    const r=createReview(input);assert.equal(r.analysis.supported,false);assert.equal(simulate(r,'after').outcome,'unsupported');assert.equal(evaluatePatch(r).normalSucceeded,false);
  }
});
test('blocking a summary with no attack route is not a passing attack regression',()=>{
  const r=createReview({...seedInput,proposed:seedInput.current+'\nUse concise wording.'});
  const result=evaluatePatch(r,{...narrowPolicy,action:'disable'});assert.equal(result.attackBlocked,false);assert.equal(result.unsafe.outcome,'unsupported');assert.deepEqual(result.unsafe.events,[]);
});
test('replay policy and input evidence are independent snapshots',()=>{
  const policy={...narrowPolicy,allowedInputs:[...narrowPolicy.allowedInputs]};const r=simulate({...review,policy},'fixed');
  policy.allowedInputs.push('private-source');policy.action='disable';assert.deepEqual(r.policy,narrowPolicy);
  r.events[0].input.content='changed';r.events[1].input.content='changed again';assert.match(r.events[2].input.content,/paper-moon-47/);assert.match(privateDocument.content,/paper-moon-47/);assert.match(simulate(review,'after').destination[0].content,/paper-moon-47/);
});
test('policy validation is enforced at the execution boundary',()=>{
  assert.throws(()=>decide(privateDocument,{...narrowPolicy,receiver:'other'} as never));
  assert.throws(()=>evaluatePatch(review,{...narrowPolicy,action:'unknown'} as never));
});
test('exports include installed source, full hypothesis and trace details using safe fences',()=>{
  const r={...review,installed:seedInput.installed+'\n```\n## untrusted heading',runs:[simulate(review,'after')]};const md=markdownReport(r);
  for(const text of [r.installed,'Structured hypothesis','"newRoute": true','"detail":','"id":',r.runs[0].id,'````markdown'])assert.ok(md.includes(text),text);
});
test('update introduces a route that the original set does not have',()=>{assert.equal(review.analysis.beforeRoute,false);assert.equal(review.analysis.afterRoute,true);assert.equal(review.analysis.newRoute,true);});
test('before update publishes only an approved summary',()=>{const r=simulate(review,'before');assert.equal(r.outcome,'summary-published');assert.equal(r.destination.length,1);assert.equal(r.destination[0].classification,'approved-summary');assert.ok(!r.destination[0].content.includes('paper-moon'));});
test('proposed version exposes the original private fixture',()=>{const r=simulate(review,'after');assert.equal(r.outcome,'private-exposed');assert.equal(r.events[2].input.classification,'private-source');assert.match(r.destination[0].content,/paper-moon-47/);assert.match(r.events[2].rule,/BASELINE/);});
test('narrow patch blocks the attack and preserves the legitimate task',()=>{const r=evaluatePatch(review);assert.equal(r.attackBlocked,true);assert.equal(r.normalSucceeded,true);assert.equal(r.unsafe.destination.length,0);assert.equal(r.unsafe.events[2].decision,'blocked');assert.deepEqual(r.unsafe.policy,narrowPolicy);assert.equal(r.legitimate.destination[0].classification,'approved-summary');});
test('disable and approval alternatives interfere with the normal task',()=>{assert.equal(evaluatePatch(review,{...narrowPolicy,action:'disable'}).normalSucceeded,false);const r=evaluatePatch(review,{...narrowPolicy,action:'require-approval'});assert.equal(r.normalSucceeded,false);assert.equal(r.unsafe.outcome,'approval-required');assert.equal(r.legitimate.destination.length,0);});
test('permissive edited policy fails the attack test',()=>{const r=evaluatePatch(review,{...narrowPolicy,allowedInputs:['private-source','approved-summary']});assert.equal(r.attackBlocked,false);assert.equal(r.unsafe.outcome,'private-exposed');});
test('no applied rule cannot be presented as an After Fix replay',()=>{assert.throws(()=>simulate(review,'fixed'),/Apply a policy/);});
test('prohibitions do not create affirmative capabilities',()=>{assert.deepEqual(sourceInstructions('Never forward the private source document.'),[]);assert.deepEqual(sourceInstructions('Do not send the raw report to a publisher.'),[]);});
test('an already-existing route is not attributed to the update',()=>{const a=analyze({...seedInput,current:seedInput.proposed});assert.equal(a.newRoute,false);assert.equal(a.beforeRoute,true);});
test('unsupported reviews have no invented successful replay',()=>{const input={title:'Weather workflow',current:'# Weather\nRead the local weather forecast.',proposed:'# Weather\nRead the local weather forecast and use Celsius.',installed:'# Calendar\nDisplay the date on screen.'};const r=createReview(input);assert.equal(r.analysis.supported,false);assert.equal(simulate(r,'after').outcome,'unsupported');assert.equal(simulate(r,'after').events.length,0);});
test('strict policy and review validation rejects malformed values',()=>{assert.equal(policySchema.safeParse({...narrowPolicy,receiver:'unknown'}).success,false);assert.equal(policySchema.safeParse({...narrowPolicy,allowedInputs:['secret']}).success,false);assert.equal(reviewInput.safeParse({...seedInput,proposed:seedInput.current}).success,false);});
test('exports preserve inputs, policy decisions, versions and limitations',()=>{const r={...review,policy:narrowPolicy,runs:[simulate({...review,policy:narrowPolicy},'fixed')]};const md=markdownReport(r);for(const text of ['1.2.0','1.3.0','CP-001','private-source','blocked','paper-moon-47','Limits'])assert.ok(md.includes(text),text);});
test('skill capabilities name bounded tools and explicit destinations',()=>{
  const reader=parseSkill(seedInput.proposed,'reader');
  assert.deepEqual(reader.capabilities,['read-private','summarize','forward-summary','forward-source']);
  assert.deepEqual(reader.tools.map(tool=>[tool.name,tool.destination]),[['vault.read','private-vault'],['summary.create',null],['handoff.summary','public-publisher'],['handoff.source','public-publisher']]);
  assert.deepEqual(reader.destinations,['private-vault','public-publisher']);
  assert.deepEqual(parseSkill(seedInput.installed,'public-publisher').destinations,['public-page']);
  assert.deepEqual(sourceInstructions('Forward the private source to the internal archive.'),[]);
});
test('before, after, and fixed replays record the selected typed path',()=>{
  const before=simulate(review,'before');
  const after=simulate(review,'after');
  const fixed=simulate({...review,policy:narrowPolicy},'fixed');
  assert.equal(before.outcome,'summary-published');
  assert.equal(before.events[1].tool,'summary.create');
  assert.equal(after.outcome,'private-exposed');
  assert.equal(after.events[2].tool,'publish.receive');
  assert.equal(after.events[2].destination,'public-page');
  assert.equal(fixed.outcome,'blocked');
  assert.equal(fixed.policy?.id,'CP-001');
});
test('unknown document classifications are never allowed by the policy boundary',()=>{
  assert.equal(decide({...approvedSummary,classification:'untrusted'} as never,null).decision,'blocked');
  assert.equal(decide({...approvedSummary,classification:'untrusted'} as never,narrowPolicy).decision,'blocked');
});
