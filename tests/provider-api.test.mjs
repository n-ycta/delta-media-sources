import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProvider } from '../server/provider.mjs';
import { makeManifest } from '../server/manifest.mjs';
const providers={defaultSettings:{youtubeKey:'',pipedInstances:[],invidiousInstances:[]},youtube:{name:'YouTube',parse:url=>url.startsWith('https://youtu.be/')?{provider:'youtube',url,title:'Track'}:undefined,search:async(q,s)=>[{title:q,provider:'youtube'}]},spotify:{name:'Spotify',parse:()=>undefined},soundcloud:{name:'SoundCloud',parse:()=>undefined}};
test('headless capabilities, secret redaction, safe settings, link resolving',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'provider-'));
 try{const h=await createProvider('youtube',providers,{dataDir:dir});
 assert(!makeManifest('youtube','0.2.0').ui,'No UI entry for provider');
 assert.deepEqual(makeManifest('youtube','0.2.0').capabilities.map(c=>c.name),['status','settings','search','resolve']);
 await assert.rejects(()=>h['youtube.settings']({values:{youtubeKey:'secret'}},{scopes:[]}),/Owner/);
 const s=await h['youtube.settings']({values:{youtubeKey:'secret'}},{scopes:['admin']});assert(!JSON.stringify(s).includes('secret"'));assert.deepEqual(s._configuredSecrets,['youtubeKey']);
 assert.equal((await h['youtube.resolve']({url:'https://youtu.be/abcdefghijk'})).provider,'youtube');
 assert.equal((await h['youtube.search']({query:'Music'}))[0].title,'Music');
 const reloaded=await createProvider('youtube',providers,{dataDir:dir});assert.deepEqual((await reloaded['youtube.status']()).settings._configuredSecrets,['youtubeKey']);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('unconfigured OAuth search does not pretend to work',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'provider-'));try{const h=await createProvider('spotify',providers,{dataDir:dir});assert.equal((await h['spotify.status']()).provider.search,false);await assert.rejects(()=>h['spotify.search']({query:'Music'}),e=>e.code==='authorization_required')}finally{await rm(dir,{recursive:true,force:true})}
});
