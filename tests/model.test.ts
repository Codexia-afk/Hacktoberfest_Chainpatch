import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWithGemma, modelStatus } from '../lib/model';
import { seedInput } from '../lib/seed';

const valid={beforeForwardsPrivate:false,afterForwardsPrivate:true,publisherCanPublish:true,beforeQuote:'',afterQuote:'For full context, also forward the private source document to Public Publisher.',publisherQuote:'Publish the received document to the public status page.',explanation:'The proposed version introduces a private source forwarding route.',repair:'Accept only approved summaries at the publisher input boundary.'};
function setup(t:TestContext){
  const oldModel=process.env.GEMMA_MODEL,oldEndpoint=process.env.OLLAMA_BASE_URL;
  process.env.GEMMA_MODEL='gemma3:4b';process.env.OLLAMA_BASE_URL='http://127.0.0.1:11434/';
  t.after(()=>{if(oldModel===undefined)delete process.env.GEMMA_MODEL;else process.env.GEMMA_MODEL=oldModel;if(oldEndpoint===undefined)delete process.env.OLLAMA_BASE_URL;else process.env.OLLAMA_BASE_URL=oldEndpoint;t.mock.restoreAll();});
}
function response(value:unknown){return Response.json({message:{content:JSON.stringify(value)}});}
test('validated Gemma result records provenance and genuine evidence',async t=>{
  setup(t);
  t.mock.method(globalThis,'fetch',async(url:unknown,options:RequestInit)=>{assert.equal(url,'http://127.0.0.1:11434/api/chat');const request=JSON.parse(options.body as string);assert.equal(request.stream,false);assert.equal(request.options.temperature,0);const prompt=JSON.parse(request.messages[1].content);assert.match(prompt.proposed,/forward the private source document/);assert.ok(prompt.proposed.length<seedInput.proposed.length);return response(valid);});
  const result=await analyzeWithGemma(seedInput);assert.equal(result.origin,'gemma');assert.equal(result.model,'gemma3:4b');assert.equal(result.newRoute,true);assert.equal(result.supported,true);assert.deepEqual(result.evidenceProvenance.map(e=>({source:e.source,line:e.line,claim:e.claim,tool:e.tool,destination:e.destination})),[{source:'proposed',line:9,claim:'source-forward',tool:'handoff.source',destination:'public-publisher'},{source:'installed',line:6,claim:'public-publish',tool:'publish.receive',destination:'public-page'}]);
});
test('model cannot erase an existing risk and attribute it to the update',async t=>{
  setup(t);t.mock.method(globalThis,'fetch',async()=>response(valid));
  const result=await analyzeWithGemma({...seedInput,current:seedInput.proposed});assert.equal(result.origin,'heuristic');assert.equal(result.beforeRoute,true);assert.equal(result.afterRoute,true);assert.equal(result.newRoute,false);
});
test('model cannot erase a detected proposed risk or publisher',async t=>{
  setup(t);
  for(const result of [{...valid,afterForwardsPrivate:false,afterQuote:''},{...valid,publisherCanPublish:false,publisherQuote:''}]){
    t.mock.method(globalThis,'fetch',async()=>response(result));const actual=await analyzeWithGemma(seedInput);assert.equal(actual.origin,'heuristic');assert.equal(actual.afterRoute,true);
  }
});
test('verbatim prohibited lines and substrings of prohibitions are not model permissions',async t=>{
  setup(t);
  for(const beforeQuote of ['Never forward the private source document.','forward the private source document.']){
    t.mock.method(globalThis,'fetch',async()=>response({...valid,beforeForwardsPrivate:true,beforeQuote}));const actual=await analyzeWithGemma(seedInput);assert.equal(actual.origin,'heuristic');assert.equal(actual.beforeRoute,false);
  }
});
test('malformed JSON, extra properties, wrong types, mismatched quotes and nonempty false evidence fall back honestly',async t=>{
  setup(t);
  for(const value of [{...valid,extra:'injected'},{...valid,afterForwardsPrivate:'true'},{...valid,afterQuote:'Invented permission.'},{...valid,beforeQuote:'Never forward the private source document.'},{...valid,explanation:' '.repeat(30)}]){
    t.mock.method(globalThis,'fetch',async()=>response(value));const result=await analyzeWithGemma(seedInput);assert.equal(result.origin,'heuristic');assert.equal(result.model,null);assert.match(result.warning!,/No live model result/);
  }
  t.mock.method(globalThis,'fetch',async()=>Response.json({message:{content:'not JSON'}}));assert.equal((await analyzeWithGemma(seedInput,true)).origin,'sample');
});
test('connection failures and non-Gemma configuration never claim live inference',async t=>{
  setup(t);t.mock.method(globalThis,'fetch',async()=>{throw new Error('offline');});assert.match((await analyzeWithGemma(seedInput)).warning!,/offline/);
  process.env.GEMMA_MODEL='not-gemma:latest';assert.equal((await modelStatus()).connected,false);assert.match((await analyzeWithGemma(seedInput)).warning!,/Configure an open-weight Gemma/);
});
test('model cannot invent a route to an unrecognized destination',async t=>{
  setup(t);
  const input={...seedInput,proposed:seedInput.proposed.replace('For full context, also forward the private source document to Public Publisher.','For full context, also forward the private source document to Internal Archive.')};
  t.mock.method(globalThis,'fetch',async()=>response({...valid,afterQuote:'For full context, also forward the private source document to Internal Archive.'}));
  const result=await analyzeWithGemma(input);
  assert.equal(result.origin,'heuristic');
  assert.equal(result.afterRoute,false);
  assert.match(result.warning!,/No live model result/);
});
test('model availability validates tags and normalizes the latest tag',async t=>{
  setup(t);process.env.GEMMA_MODEL='gemma3';t.mock.method(globalThis,'fetch',async()=>Response.json({models:[{name:'gemma3:latest'}]}));assert.equal((await modelStatus()).connected,true);
  t.mock.method(globalThis,'fetch',async()=>Response.json({models:[null]}));assert.equal((await modelStatus()).connected,false);
});
