import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
const read = name => JSON.parse(readFileSync(new URL(`../app/data/${name}.json`,import.meta.url),'utf8'));
const data=read('youtube-creators');

test('YouTube roster joins official photos, DMS sales and VOC by showroom and name',()=>{
 const photos=read('staff-profile-photos').showrooms;
 const sales=read('sales-activity-analysis').showrooms;
 const voc=read('voc-staff-analysis').showrooms;
 assert.equal(data.creators.length,13);
 assert.equal(new Set(data.creators.map(p=>`${p.cdsid}:${p.name}`)).size,13);
 for(const p of data.creators){
  const image=photos[p.cdsid]?.employees[p.name]?.image ?? (p.gender==='여성'?'/staff-profiles/female-human-silhouette.png':'/staff-profiles/neutral-human-silhouette.png');
  assert.ok(image, p.name);
  assert.ok(existsSync(new URL(`../public${image}`,import.meta.url)),p.name);
  assert.equal(sales[p.cdsid].staff.filter(s=>s.name===p.name).length,1,p.name);
  assert.equal(voc[p.cdsid].employees.filter(s=>s.name===p.name).length,1,p.name);
  assert.ok(['남성','여성'].includes(p.gender));
  assert.ok(data.channels.some(c=>c.id===p.channelId));
 }
});
test('YouTube roster and channel URLs match the supplied 2026-09-22 workbook',()=>{
 const actual=data.creators.map(p=>[p.dealer,p.showroom,p.name,p.gender,data.channels.find(c=>c.id===p.channelId)?.url]);
 assert.deepEqual(actual,[
  ['코오롱','서수원','이정훈','남성','https://www.youtube.com/@%EB%B3%BC%EB%B3%B4%EC%99%95%EC%9E%90%EC%9D%B4%EC%A0%95%ED%9B%88'],
  ['코오롱','분당판교','나수연','여성','https://www.youtube.com/@volvo_nasubari'],
  ['코오롱','분당판교','조선별','여성','https://www.youtube.com/@%EB%B3%BC%EB%B3%B4%EB%9F%AC%EA%B0%80%EC%9E%90-g8p'],
  ['코오롱','서초','이규환','남성','https://www.youtube.com/@%EC%9D%B4%EA%B7%9C%ED%99%98-volkyou'],
  ['코오롱','송파','김정호','남성','https://www.youtube.com/@%EB%B3%BC%EB%B3%B4%EA%B9%80%EB%8C%80%EB%A6%AC'],
  ['코오롱','하남','곽지명','여성','https://www.youtube.com/@%EB%B3%BC%EB%B3%B4%EB%9F%AC%EA%B0%80%EC%9E%90-g8p'],
  ['에이치','분당','진주현','남성','https://www.youtube.com/@%EB%B3%BC%EB%B3%B4%EB%B9%85%EB%A7%A8'],
  ['아주','안양','신수경','여성','https://www.youtube.com/@%EB%B3%BC%EB%B3%B4%EA%B3%B5%EC%A3%BC-%EC%8B%A0%EC%88%98%EA%B2%BD%ED%8C%80%EC%9E%A5'],
  ['아주','고양','송민경','여성','https://www.youtube.com/@%EB%B3%BC%EB%B3%B4%EC%86%A1%EB%AF%BC%EA%B2%BD'],
  ['아주','목동','신승희','남성','https://www.youtube.com/@volvogodseunghee'],
  ['아주','목동','박형진','남성','https://www.youtube.com/@%EB%B3%BC%EB%B3%B4PARK'],
  ['아주','목동','김예소','여성','https://www.youtube.com/@%EB%B3%BC%EB%A7%A4%EA%B9%80%EC%98%88%EC%86%8C'],
  ['천하','용산','박준수','남성','https://www.youtube.com/@volvodesk'],
 ]);
});
test('YouTube shared channel is counted once and every video is attributed from reviewed evidence',()=>{
 assert.equal(data.channels.length,12);
 assert.equal(new Set(data.channels.map(c=>c.id)).size,12);
 const pair=data.creators.filter(p=>['조선별','곽지명'].includes(p.name));
 assert.equal(pair[0].channelId,pair[1].channelId);
 const channel=data.channels.find(c=>c.id===pair[0].channelId);
 assert.equal(channel.sharedVideos.length,channel.videoCount);
 const expected=new Map([
  ['zh-E_v-PXFE','곽지명'],['IXy0Iu6kAEI','조선별'],['9O5QGxCcuEw','조선별'],['YxShHQUP5q0','곽지명'],
  ['y2Ak71FfQRU','조선별'],['xKmkfdqbBqs','곽지명'],['cfEB7f4Fe3c','조선별'],['kR3dQMIDRxk','조선별'],
  ['jja3vjYEQ0E','조선별'],['8hSlC0LSlt4','곽지명'],['OlOHk3EyUL8','조선별'],['P7m_VoT_920','곽지명'],
  ['9oqQx4AptXw','조선별'],['Tctur3oMOXQ','조선별'],['UU1TqzUNSCQ','조선별'],['DVYAR2_3GSo','조선별'],
 ]);
 assert.equal(expected.size,channel.videoCount);
 for(const video of channel.sharedVideos)assert.deepEqual(video.names,[expected.get(video.id)],video.id);
 assert.deepEqual(channel.sharedVideos.reduce((counts,video)=>{counts[video.names[0]][video.kind]++;return counts;},{조선별:{long:0,short:0},곽지명:{long:0,short:0}}),{조선별:{long:4,short:7},곽지명:{long:3,short:2}});
 for(const v of channel.sharedVideos)for(const name of v.names)assert.ok(pair.some(p=>p.name===name));
 for(const c of data.channels){
  assert.equal(c.long.count+c.short.count,c.videoCount);
  assert.equal(c.long.viewsSample+c.short.viewsSample,c.viewsSample);
  assert.equal(c.viewsSample,c.videoCount);
  assert.ok(c.availableCommentVideos<=c.sampledVideos);
  for(const n of [c.subscribers,c.averageViews,c.totalViews])assert.ok(n===null||Number.isFinite(n)&&n>=0);
 }
});
test('Dealer and gender distribution reconcile to the supplied roster',()=>{
 const counts={};for(const p of data.creators)counts[p.dealer]=(counts[p.dealer]??0)+1;
 assert.deepEqual(counts,{'코오롱':6,'에이치':1,'아주':5,'천하':1});
 assert.equal(data.creators.filter(p=>p.gender==='남성').length,7);
 assert.equal(data.creators.filter(p=>p.gender==='여성').length,6);
});
test('Kim Yeso mixed-brand channel counts Volvo videos only',()=>{
 const person=data.creators.find(person=>person.name==='김예소');
 const channel=data.channels.find(channel=>channel.id===person.channelId);
 assert.equal(channel.videoBrandFilter,'volvo');
 assert.equal(channel.scopeVideoIds.length,channel.videoCount);
 assert.ok(channel.videoCount>0);
 assert.equal(channel.long.count+channel.short.count,channel.videoCount);
 assert.ok(channel.totalViews>=0);
 assert.equal(channel.averageViews,Math.round(channel.totalViews/channel.videoCount));
});
test('Per-channel subscriber changes share the previous-day final close baseline',()=>{
 assert.equal(Object.keys(data.dailyClose.channelSubscribers).length,data.channels.length);
 assert.equal(new Set(Object.keys(data.dailyClose.channelSubscribers)).size,data.channels.length);
 assert.equal(Object.values(data.dailyClose.channelSubscribers).reduce((sum,value)=>sum+value,0),data.dailyClose.subscribers);
 for(const channel of data.channels)assert.ok(Number.isFinite(data.dailyClose.channelSubscribers[channel.id]),channel.id);
 const totalDelta=data.channels.reduce((sum,channel)=>sum+channel.subscribers-data.dailyClose.channelSubscribers[channel.id],0);
 const uniqueCreatorDelta=data.creators.reduce((state,person)=>{
  if(state.seen.has(person.channelId))return state;
  state.seen.add(person.channelId);
  const channel=data.channels.find(channel=>channel.id===person.channelId);
  state.total+=channel.subscribers-data.dailyClose.channelSubscribers[channel.id];
  return state;
 },{seen:new Set(),total:0}).total;
 assert.equal(uniqueCreatorDelta,totalDelta);
});
test('Curated comments retain evidence links without raw author identities or ability scores',()=>{
 for(const item of data.evidence){
  assert.ok(data.creators.some(p=>p.name===item.name));
  const url=new URL(item.url);
  assert.equal(url.hostname,'www.youtube.com');
  assert.equal(url.searchParams.get('v'),item.videoId);
  assert.equal(url.searchParams.get('lc'),item.commentId);
  assert.ok(['positive','suggestion'].includes(item.kind));
  assert.equal(item.author,undefined);
  assert.equal(item.score,undefined);
 }
});
