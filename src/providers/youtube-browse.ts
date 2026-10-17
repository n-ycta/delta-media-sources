import {clean,getJson,httpsUrl,type Settings,type SourceItem} from '../types';
const videoId=/^[\w-]{11}$/, collectionId=/^[\w-]{10,150}$/;
export function youtubeCollection(input:string){
 const u=new URL(input);if(u.protocol!=='https:'||u.username||u.password||!['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(u.hostname))throw Error('unsupported_collection');
 const list=u.searchParams.get('list');if(list&&collectionId.test(list))return {kind:'playlist' as const,id:list};
 const m=u.pathname.match(/^\/(channel\/([\w-]{10,80})|(@[\w.\-\u0080-\uffff]{1,100}))\/?$/);
 if(!m)throw Error('unsupported_collection');return {kind:'channel' as const,id:m[2]||m[3]};
}
const track=(v:any):SourceItem[]=>{
 const id=v?.contentDetails?.videoId||v?.snippet?.resourceId?.videoId||v?.videoId||String(v?.url||'').match(/[?&]v=([\w-]{11})/)?.[1];
 if(!videoId.test(id||''))return [];
 const s=v.snippet||v;return [{provider:'youtube',kind:'video',url:'https://www.youtube.com/watch?v='+id,title:clean(s.title)||'YouTube '+id,artist:clean(s.videoOwnerChannelTitle||s.author||s.uploaderName)||undefined,artwork:`https://i.ytimg.com/vi/${id}/hqdefault.jpg`,channelUrl:(s.videoOwnerChannelId||s.authorId)?'https://www.youtube.com/channel/'+(s.videoOwnerChannelId||s.authorId):undefined}];
};
export async function browseYoutube(url:string,cursor:string|undefined,settings:Settings,fetcher:typeof fetch=fetch){
 const target=youtubeCollection(url);let emptyResult:any;
 if(cursor&&cursor.length>8000)throw Error('invalid_cursor');
 const previous=cursor?JSON.parse(cursor):null;
 const pack=(engine:string,base:string,token:unknown,id=target.id)=>token?JSON.stringify({engine,base,token,id}):undefined;
 if(settings.youtubeKey.trim()&&(!previous||previous.engine==='api')){
  const api=async(path:string,params:Record<string,string>)=>getJson('https://www.googleapis.com/youtube/v3/'+path+'?'+new URLSearchParams({...params,key:settings.youtubeKey.trim()}),fetcher,8000);
  let id=target.id,title='',description='',artwork='';
  if(target.kind==='channel'){
   const response=await api('channels',{part:'snippet,contentDetails',...(id.startsWith('@')?{forHandle:id}:{id})});
   const channel=response.items?.[0];if(!channel)throw Error('channel_not_found');
   id=channel.contentDetails?.relatedPlaylists?.uploads;title=clean(channel.snippet?.title);description=clean(channel.snippet?.description,3000);artwork=httpsUrl(channel.snippet?.thumbnails?.high?.url)||'';
  }else if(!previous){const response=await api('playlists',{part:'snippet',id});const p=response.items?.[0];title=clean(p?.snippet?.title);description=clean(p?.snippet?.description,3000);artwork=httpsUrl(p?.snippet?.thumbnails?.high?.url)||'';}
  const response=await api('playlistItems',{part:'snippet,contentDetails',playlistId:id,maxResults:'50',...(previous?{pageToken:String(previous.token)}:{})});
  if(!Array.isArray(response.items))throw Error('browse_unavailable');
  return {kind:target.kind,title:title||'YouTube',description,artwork,url,items:(response.items||[]).flatMap(track),next:pack('api','',response.nextPageToken,id)};
 }
 const bases=settings.pipedInstances.map(httpsUrl).filter(Boolean) as string[];
 const candidates=previous?bases.filter(b=>b.replace(/\/$/,'')===previous.base):bases;
 if(previous&&!['piped','invidious'].includes(previous.engine))throw Error('invalid_cursor');
 for(const raw of previous?.engine==='invidious'?[]:candidates){const base=raw.replace(/\/$/,'');try{
  const route=target.kind==='channel'?'channel':'playlists';
  const response=await getJson(base+'/'+(previous?'nextpage/':'')+route+'/'+encodeURIComponent(target.id)+(previous?'?nextpage='+encodeURIComponent(String(previous.token)):''),fetcher,3000);
  if(!Array.isArray(response.relatedStreams))throw Error('browse_unavailable');
  const result={kind:target.kind,title:clean(response.name)||'YouTube',description:clean(response.description,3000),artwork:httpsUrl(response.avatarUrl||response.thumbnailUrl),url,items:(response.relatedStreams||[]).flatMap(track),next:pack('piped',base,response.nextpage)};
  if(result.items.length)return result;emptyResult=result;
 }catch{}}
 const invBases=settings.invidiousInstances.map(httpsUrl).filter(Boolean) as string[];
 for(const raw of invBases){const base=raw.replace(/\/$/,'');if(previous&&(previous.engine!=='invidious'||previous.base!==base))continue;try{
  const route=target.kind==='channel'?'channels/':'playlists/';
  const token=previous?.token;const suffix=target.kind==='channel'?(token?'?continuation='+encodeURIComponent(String(token)):''):'?page='+String(token||1);
  const response=await getJson(base+'/api/v1/'+route+encodeURIComponent(target.id)+suffix,fetcher,3000);
  const videos=response.latestVideos||response.videos;if(!Array.isArray(videos))throw Error('browse_unavailable');
  const next=target.kind==='channel'?response.continuation:(response.videoCount>Number(token||1)*100?Number(token||1)+1:undefined);
  const result={kind:target.kind,title:clean(response.author||response.title)||'YouTube',description:clean(response.description,3000),artwork:httpsUrl(response.authorThumbnails?.at(-1)?.url||response.playlistThumbnail),url,items:videos.flatMap(track),next:pack('invidious',base,next)};
  if(result.items.length)return result;emptyResult=result;
 }catch{}}
 if(emptyResult)return emptyResult;
 throw Error('browse_unavailable');
}

