import test from'node:test';import assert from'node:assert/strict';import{EventEmitter}from'node:events';import{PassThrough}from'node:stream';import{mkdtemp,writeFile,mkdir,rm}from'node:fs/promises';import{tmpdir}from'node:os';import{join,dirname}from'node:path';import{createDownloader,youtubeUrl}from'../server/downloader.mjs';
test('offline downloader confines YouTube URLs, progress and bounded reads',async()=>{
 for(const url of ['file:///etc/passwd','https://evil.test/watch?v=M7lc1UVf-VE','https://youtube.com@evil.test/','https://youtu.be/../../secret','http://youtu.be/M7lc1UVf-VE'])assert.throws(()=>youtubeUrl(url));
 const dir=await mkdtemp(join(tmpdir(),'delta-offline-'));let calls=0;
 const fake=(cmd,args)=>{calls++;assert.equal(args.at(-2),'--');assert(args.includes('--ignore-config'));const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{};setTimeout(async()=>{const output=args[args.indexOf('--output')+1].replace('%(ext)s','m4a');await mkdir(dirname(output),{recursive:true});await writeFile(output,Buffer.from('audio-bytes'));child.stdout.write('DELTA: 50%\n');child.emit('close',0);},10);return child;};
 try{const h=await createDownloader({dataDir:dir,spawn:fake,skipDependencyCheck:true});const job=await h['downloads.create']({url:'https://youtu.be/M7lc1UVf-VE',kind:'audio'});assert.equal((await h['downloads.create']({url:job.url,kind:'audio'})).id,job.id);
 for(let i=0;i<60;i++){if((await h['downloads.job']({id:job.id})).state==='ready')break;await new Promise(r=>setTimeout(r,10));}
 const ready=await h['downloads.job']({id:job.id});assert.equal(ready.state,'ready');assert.equal(ready.progress,100);assert.equal(ready.file,undefined);assert.equal(calls,1);const chunk=await h['downloads.read']({id:job.id,limit:4});assert.equal(Buffer.from(chunk.data,'base64').toString(),'audi');assert.equal(chunk.done,false);await assert.rejects(()=>h['downloads.read']({id:job.id,offset:-1}),e=>e.code==='bad_request');await assert.rejects(()=>h['downloads.read']({id:job.id,limit:999999}),e=>e.code==='bad_request');await h['downloads.remove']({id:job.id});await assert.rejects(()=>h['downloads.job']({id:job.id}),e=>e.code==='not_found');
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('offline cache enforces its total quota and cancellation remains explicit',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'delta-offline-cancel-'));let child;
 const fake=()=>{child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.kill=()=>{queueMicrotask(()=>child.emit('close',1));return true;};return child;};
 try{const h=await createDownloader({dataDir:dir,spawn:fake,skipDependencyCheck:true});const job=await h['downloads.create']({url:'https://youtu.be/M7lc1UVf-VE',kind:'video'});for(let i=0;i<30&&!child;i++)await new Promise(r=>setTimeout(r,10));await h['downloads.cancel']({id:job.id});assert.equal((await h['downloads.job']({id:job.id})).state,'cancelled');await new Promise(r=>setTimeout(r,30));await h['downloads.remove']({id:job.id});
 const tiny=await createDownloader({dataDir:dir,skipDependencyCheck:true,maxCacheBytes:1024});await assert.rejects(()=>tiny['downloads.create']({url:'https://youtu.be/M7lc1UVf-VE',kind:'audio'}),e=>e.code==='conflict');
 }finally{await rm(dir,{recursive:true,force:true})}
});
