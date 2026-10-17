import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DeltaError, allowed } from './delta-sdk.mjs';
export async function createProvider(id, providers, options={}) {
 const provider=providers[id]; if(!provider) throw Error('Unknown provider');
 const path=resolve(options.dataDir||process.env.DATA_DIR||process.env.DELTA_DATA||'data',id+'-settings.json');
 let settings={...providers.defaultSettings,clientId:'',clientSecret:'',accessToken:''};
 try{Object.assign(settings,JSON.parse(await readFile(path,'utf8')))}catch(e){if(e.code!=='ENOENT')throw e}
 let token='',expires=0;
 const safe=()=>({...Object.fromEntries(Object.entries(settings).filter(([k])=>!['youtubeKey','clientSecret','accessToken'].includes(k))),_configuredSecrets:['youtubeKey','clientSecret','accessToken'].filter(k=>!!settings[k])});
 const json=async(url,init={})=>{const r=await (options.fetch||fetch)(url,{...init,signal:AbortSignal.timeout(12000)});if(!r.ok)throw new DeltaError('unavailable',r.status===401?'Provider authorization required':'Provider temporarily unavailable');return r.json()};
 const canSearch=()=>id==='youtube'||(id==='spotify'?!!(settings.clientId&&settings.clientSecret):!!settings.accessToken);
 return {
  [`${id}.status`]:async()=>({settings:safe(),provider:{id,name:provider.name,search:canSearch(),resolve:true,connected:true},notices:[]}),
  [`${id}.settings`]:async({values},caller)=>{
   if(values){if(!allowed(caller,id+'.settings',true))throw new DeltaError('forbidden','Owner required');
    for(const [key,val] of Object.entries(values)){if(!Object.hasOwn(settings,key))throw new DeltaError('bad_request','Unknown setting');if(Array.isArray(settings[key])){if(!Array.isArray(val)||val.length>5||val.some(v=>typeof v!=='string'||!/^https:\/\/[a-z0-9.-]+\/?$/i.test(v)))throw new DeltaError('bad_request','Invalid API instances');}else if(typeof val!=='string'||val.length>4096)throw new DeltaError('bad_request','Invalid setting');settings[key]=val;}
    await mkdir(resolve(path,'..'),{recursive:true,mode:0o700});await writeFile(path+'.tmp',JSON.stringify(settings),{mode:0o600});await rename(path+'.tmp',path);token='';expires=0;
   }return safe();
  },
  [`${id}.resolve`]:async({url})=>{if(typeof url!=='string'||url.length>2048)throw new DeltaError('bad_request','Invalid link');const item=provider.parse(url);if(!item)throw new DeltaError('bad_request','Unsupported provider link');return provider.enrich?provider.enrich(item,options.fetch||fetch):item;},
  [`${id}.search`]:async({query})=>{
   if(typeof query!=='string'||!query.trim()||query.length>200)throw new DeltaError('bad_request','Query required');
   const link=provider.parse(query);if(link)return [provider.enrich?await provider.enrich(link,options.fetch||fetch):link];
   if(!canSearch())throw new DeltaError('authorization_required','Connect this provider in plugin settings to search');
   if(id==='youtube')return provider.search(query,settings,options.fetch||fetch);
   if(id==='spotify'){
    if(Date.now()>=expires){const r=await json('https://accounts.spotify.com/api/token',{method:'POST',headers:{authorization:'Basic '+Buffer.from(settings.clientId+':'+settings.clientSecret).toString('base64'),'content-type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});token=r.access_token;expires=Date.now()+Math.max(0,(r.expires_in-60))*1000;}
    const r=await json('https://api.spotify.com/v1/search?type=track&limit=25&q='+encodeURIComponent(query),{headers:{authorization:'Bearer '+token}});
    return (r.tracks?.items||[]).map(t=>({provider:id,kind:'audio',url:t.external_urls.spotify,title:t.name,artist:t.artists?.map(a=>a.name).join(', '),artwork:t.album?.images?.[0]?.url,duration:t.duration_ms/1000}));
   }
   const r=await json('https://api.soundcloud.com/tracks?q='+encodeURIComponent(query)+'&limit=25',{headers:{authorization:'OAuth '+settings.accessToken}});
   return (Array.isArray(r)?r:r.collection||[]).map(t=>({provider:id,kind:'audio',url:t.permalink_url,title:t.title,artist:t.user?.username,artwork:t.artwork_url,duration:t.duration/1000}));
  }
 };
}
