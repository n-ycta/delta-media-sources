import {test} from 'node:test';import assert from 'node:assert/strict';import {browseYoutube,youtubeCollection} from '../src/providers/youtube-browse';
const settings={youtubeKey:'test-only',pipedInstances:[],invidiousInstances:[]};
test('channel card resolves uploads and paginates official playlist items',async()=>{
 const requests:string[]=[];
 const fetcher=async(input:any)=>{const url=new URL(String(input));requests.push(url.href);let data:any;
 if(url.pathname.endsWith('/channels'))data={items:[{snippet:{title:'Artist',description:'Description'},contentDetails:{relatedPlaylists:{uploads:'UUabcdefghijklmnopqrstuv'}}}]};
 else data={items:[{snippet:{title:url.searchParams.has('pageToken')?'Track 2':'Track 1',videoOwnerChannelId:'UCabcdefghijklmnopqrstuv'},contentDetails:{videoId:'abcdefghijk'}}],...(!url.searchParams.has('pageToken')?{nextPageToken:'second-page'}:{})};
 return new Response(JSON.stringify(data));};
 const page=await browseYoutube('https://www.youtube.com/@artist',undefined,settings,fetcher as typeof fetch);assert.equal(page.title,'Artist');assert.equal(page.items[0].title,'Track 1');assert(page.next);
 const next=await browseYoutube(page.url,page.next,settings,fetcher as typeof fetch);assert.equal(next.items[0].title,'Track 2');assert.equal(next.next,undefined);assert(requests.some(u=>u.includes('pageToken=second-page')));
});
test('browse accepts only YouTube channel/playlist targets, never arbitrary network locations',()=>{
 for(const url of ['http://youtube.com/playlist?list=PLabcdefghijk','https://evil.example/playlist?list=PLabcdefghijk','https://user:secret@youtube.com/playlist?list=PLabcdefghijk','https://youtube.com/watch?v=abcdefghijk'])assert.throws(()=>youtubeCollection(url));
 assert.equal(youtubeCollection('https://www.youtube.com/playlist?list=PLabcdefghijk').kind,'playlist');
});
test('public Piped collection exposes continuation and rejects foreign cursor base',async()=>{
 const s={youtubeKey:'',pipedInstances:['https://api.example'],invidiousInstances:[]};
 const page=await browseYoutube('https://www.youtube.com/playlist?list=PLabcdefghijk',undefined,s,async()=>new Response(JSON.stringify({name:'Playlist',relatedStreams:[{url:'/watch?v=abcdefghijk',title:'Song'}],nextpage:'next'})));
 assert.equal(page.items.length,1);assert(page.next);
 await assert.rejects(()=>browseYoutube(page.url,JSON.stringify({engine:'piped',base:'https://evil.example',token:'x'}),s));
});
test('public error payloads are not a misleading empty playlist; Invidious fallback remains bounded',async()=>{
 const s={youtubeKey:'',pipedInstances:['https://piped.example'],invidiousInstances:['https://inv.example']};
 const fetcher=async(input:any)=>new Response(JSON.stringify(String(input).includes('piped')?{error:'unavailable'}:{title:'Collection',videoCount:101,videos:[{videoId:'abcdefghijk',title:'Song',author:'Artist'}]}));
 const page=await browseYoutube('https://www.youtube.com/playlist?list=PLabcdefghijk',undefined,s,fetcher);assert.equal(page.items.length,1);assert(page.next);assert.equal(JSON.parse(page.next!).engine,'invidious');
 await assert.rejects(()=>browseYoutube(page.url,undefined,s,async()=>new Response(JSON.stringify({error:'unavailable'}))));
});
