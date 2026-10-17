import{mkdir,readFile,writeFile,rename,readdir,stat,lstat,open,rm}from'node:fs/promises';
import{resolve,join}from'node:path';import{fileURLToPath}from'node:url';import{randomUUID}from'node:crypto';import{spawn,spawnSync}from'node:child_process';
import{DeltaError}from'./delta-sdk.mjs';
const bad=m=>{throw new DeltaError('bad_request',m)};
export function youtubeUrl(value){if(typeof value!=='string'||value.length>2048)bad('YouTube URL required');let u;try{u=new URL(value)}catch{bad('YouTube URL required')}if(u.protocol!=='https:'||u.username||u.password)bad('HTTPS YouTube URL required');const host=u.hostname.replace(/^(www|m|music)\./,'');let id;if(host==='youtu.be')id=u.pathname.slice(1);else if(host==='youtube.com'||host==='youtube-nocookie.com')id=u.searchParams.get('v')||u.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)$/)?.[1];if(!/^[a-zA-Z0-9_-]{11}$/.test(id||''))bad('Single YouTube video required');return 'https://www.youtube.com/watch?v='+id;}
export async function createDownloader(options={}){
 const dir=resolve(options.dataDir||process.env.DATA_DIR||process.env.DELTA_DATA||'data'),cache=join(dir,'offline'),db=join(dir,'downloads.json');await mkdir(cache,{recursive:true,mode:0o700});
 let jobs=[];try{jobs=JSON.parse(await readFile(db,'utf8'));if(!Array.isArray(jobs))throw Error('Invalid downloads data')}catch(e){if(e.code!=='ENOENT')throw e}
 for(const job of jobs)if(['queued','downloading'].includes(job.state)){job.state='failed';job.error='Download interrupted. Retry.';}
 let tail=Promise.resolve(),running=null;const children=new Map();const maxBytes=256*1024*1024,maxCacheBytes=options.maxCacheBytes||2*1024*1024*1024;
 const save=()=>{const data=JSON.stringify(jobs);const task=tail.then(async()=>{await writeFile(db+'.tmp',data,{mode:0o600});await rename(db+'.tmp',db)});tail=task.catch(()=>{});return task;};
 const summary=j=>({...j,file:undefined,error:j.error||undefined});
 const python=process.env.DELTA_PYTHON||'python3',engine=options.engine||fileURLToPath(new URL('../engine/yt-dlp',import.meta.url));
 const ready=()=>options.skipDependencyCheck||spawnSync(python,['-c',"import sys,os;sys.exit(0 if sys.version_info>=(3,10) and os.path.isfile(sys.argv[1]) else 1)",engine],{timeout:3000}).status===0;
 const find=id=>{const j=jobs.find(j=>j.id===id);if(!j)throw new DeltaError('not_found','Download not found');return j;};
 const work=async()=>{
  if(running)return;const job=jobs.find(j=>j.state==='queued');if(!job)return;running=job.id;job.state='downloading';await save();const folder=join(cache,job.id);await mkdir(folder,{recursive:true,mode:0o700});
  const args=[engine,'--ignore-config','--no-playlist','--no-part','--no-overwrites','--newline','--progress','--progress-delta','1','--progress-template','download:DELTA:%(progress._percent_str)s','--max-filesize',String(maxBytes),'--socket-timeout','15','--retries','2','--fragment-retries','2','--js-runtimes','node:'+process.execPath,'--output',join(folder,'media.%(ext)s'),'-f',job.kind==='audio'?'bestaudio[ext=m4a]/bestaudio':'best[ext=mp4][height<=720]/best[height<=720]','--',job.url];
  try{await new Promise((accept,reject)=>{
   const child=(options.spawn||spawn)(python,args,{stdio:['ignore','pipe','pipe'],env:{...process.env,PYTHONUNBUFFERED:'1'}});children.set(job.id,child);let text='',last=0;
   const input=chunk=>{text=(text+chunk.toString()).slice(-12000);const matches=[...text.matchAll(/DELTA:\s*([0-9.]+)%/g)];if(matches.length)job.progress=Math.max(0,Math.min(99,Number(matches.at(-1)[1])));if(Date.now()-last>1000){last=Date.now();void save();}};
   child.stdout.on('data',input);child.stderr.on('data',input);const timer=setTimeout(()=>{child.kill('SIGTERM');setTimeout(()=>child.kill('SIGKILL'),3000).unref();reject(Error('Download time limit exceeded'));},30*60*1000);timer.unref();
   child.once('error',e=>{clearTimeout(timer);reject(e)});child.once('close',code=>{clearTimeout(timer);code===0?accept():reject(Error(text.includes('Sign in')||text.includes('sign in')?'YouTube requires sign-in for this video.':text.includes('not available')?'Video is unavailable for download.':text.includes('larger than')?'Video exceeds the offline cache size limit.':'Download failed. YouTube may restrict this video; retry later.'))});
  });
  if(job.state==='cancelled')return;
  const files=(await readdir(folder)).filter(f=>/^media\.(m4a|mp4|webm|opus|ogg|mp3|mkv)$/.test(f));if(files.length!==1)throw Error('A complete media file was not produced.');const file=join(folder,files[0]),s=await lstat(file);if(!s.isFile()||s.isSymbolicLink()||s.size>maxBytes)throw Error('Offline file exceeds allowed limits.');job.file=file;job.size=s.size;job.name=files[0];job.mime=({m4a:'audio/mp4',mp4:'video/mp4',webm:job.kind==='audio'?'audio/webm':'video/webm',opus:'audio/ogg',ogg:'audio/ogg',mp3:'audio/mpeg',mkv:'video/x-matroska'})[files[0].split('.').at(-1)];job.state='ready';job.progress=100;
  }catch(e){if(job.state!=='cancelled'){job.state='failed';job.error=e.message;}await rm(folder,{recursive:true,force:true});}
  finally{children.delete(job.id);running=null;await save();queueMicrotask(()=>void work());}
 };
 await save();
 return {
  'downloads.status':async()=>({connected:ready(),engine:'yt-dlp',cacheDirectory:cache,maxFileBytes:maxBytes,maxCacheBytes,jobs:jobs.map(summary)}),
  'downloads.create':async a=>{const url=youtubeUrl(a.url),kind=a.kind==='audio'?'audio':a.kind==='video'?'video':null;if(!kind)bad('Choose audio or video');const existing=jobs.find(j=>j.url===url&&j.kind===kind&&['queued','downloading','ready'].includes(j.state));if(existing)return summary(existing);if(!ready())throw new DeltaError('unavailable','Python 3.10+ is required on the download node');if(jobs.filter(j=>['queued','downloading'].includes(j.state)).length>=20)throw new DeltaError('busy','Offline download queue is full');if(jobs.filter(j=>j.state==='ready').reduce((n,j)=>n+(j.size||0),0)+maxBytes>maxCacheBytes)throw new DeltaError('conflict','Offline cache is full. Remove an older offline copy.');const job={id:randomUUID(),url,kind,state:'queued',progress:0,createdAt:Date.now()};jobs.push(job);if(jobs.length>200)jobs=jobs.filter(j=>j.state==='ready'||j.state==='queued'||j.state==='downloading'||j.createdAt>Date.now()-7*86400000);await save();queueMicrotask(()=>void work());return summary(job);},
  'downloads.job':async a=>summary(find(a.id)),
  'downloads.cancel':async a=>{const job=find(a.id);if(!['queued','downloading'].includes(job.state))bad('Download is not active');job.state='cancelled';const child=children.get(job.id);child?.kill('SIGTERM');if(child)setTimeout(()=>child.kill('SIGKILL'),3000).unref();await save();return summary(job);},
  'downloads.read':async a=>{const job=find(a.id);if(job.state!=='ready')throw new DeltaError('conflict','Offline file is not ready');const offset=a.offset??0,limit=a.limit??24576;if(!Number.isSafeInteger(offset)||offset<0||offset>job.size||!Number.isSafeInteger(limit)||limit<1||limit>24576)bad('Invalid file chunk');const f=await open(job.file,'r');try{const b=Buffer.alloc(Math.min(limit,job.size-offset)),{bytesRead}=await f.read(b,0,b.length,offset);return {data:b.subarray(0,bytesRead).toString('base64'),offset,next:offset+bytesRead,size:job.size,mime:job.mime,done:offset+bytesRead>=job.size};}finally{await f.close()}},
  'downloads.remove':async a=>{const job=find(a.id);if(['queued','downloading'].includes(job.state))bad('Cancel the active download first');await rm(join(cache,job.id),{recursive:true,force:true});jobs=jobs.filter(j=>j.id!==job.id);await save();return {removed:true};},
 };
}
