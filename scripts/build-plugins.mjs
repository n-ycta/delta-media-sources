import { build } from 'vite';
import { mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
await build({ configFile: false, build: { target:'node22', outDir:'service', lib:{ entry:'src/service.ts', formats:['es'], fileName:()=> 'providers.mjs' }, minify:false } });
const {version}=JSON.parse(await readFile('package.json','utf8'));
await mkdir('release',{recursive:true}); let sums='';
for (const provider of ['youtube','soundcloud','spotify']) {
 const { makeManifest }=await import('../server/manifest.mjs');
 const manifest=makeManifest(provider,version), stage=`release/stage-${provider}`;
 await rm(stage,{recursive:true,force:true}); await mkdir(stage,{recursive:true});
 await cp('server',stage+'/server',{recursive:true}); await cp('service',stage+'/service',{recursive:true});
 await writeFile(stage+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
 await writeFile(stage+'/package.json',JSON.stringify({name:`delta-${provider}`,version,type:'module',private:true}));
 await writeFile(stage+'/package-lock.json',JSON.stringify({name:`delta-${provider}`,version,lockfileVersion:3,requires:true,packages:{'':{name:`delta-${provider}`,version}}}));
 for (const file of ['LICENSE']) await cp(file,stage+'/'+file);
 const asset=`delta-${provider}.tar.gz`;
 execFileSync('tar',['-czf',`release/${asset}`,'-C',stage,'.']);
 sums+=createHash('sha256').update(await readFile('release/'+asset)).digest('hex')+'  '+asset+'\n';
 await rm(stage,{recursive:true,force:true});
}
await writeFile('release/SHA256SUMS',sums);
