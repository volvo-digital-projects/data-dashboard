import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
const read = name => JSON.parse(readFileSync(new URL(`../app/data/${name}.json`,import.meta.url),'utf8'));
const data=read('youtube-creators');

test('YouTube roster joins official photos, DMS sales and VOC by showroom and name',()=>{
 const photos=read('staff-profile-photos').showrooms;
 const sales=read('sales-activity-analysis').showrooms;
 const voc=read('voc-staff-analysis').showrooms;
 assert.equal(data.creators.length,12);
 assert.equal(new Set(data.creators.map(p=>`${p.cdsid}:${p.name}`)).size,12);
 for(const p of data.creators){
  const image=photos[p.cdsid]?.employees[p.name]?.image;
  assert.ok(image, p.name);
  assert.ok(existsSync(new URL(`../public${image}`,import.meta.url)),p.name);
  assert.equal(sales[p.cdsid].staff.filter(s=>s.name===p.name).length,1,p.name);
  assert.equal(voc[p.cdsid].employees.filter(s=>s.name===p.name).length,1,p.name);
  assert.ok(['남성','여성'].includes(p.gender));
  assert.ok(data.channels.some(c=>c.id===p.channelId));
 }
});
test('YouTube shared channel is counted once and unconfirmed shorts are not assigned',()=>{
 assert.equal(data.channels.length,11);
 assert.equal(new Set(data.channels.map(c=>c.id)).size,11);
 const pair=data.creators.filter(p=>['조선별','곽지명'].includes(p.name));
 assert.equal(pair[0].channelId,pair[1].channelId);
 const channel=data.channels.find(c=>c.id===pair[0].channelId);
 assert.equal(channel.sharedVideos.length,channel.videoCount);
 assert.ok(channel.sharedVideos.some(v=>v.names.length===0));
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
 assert.deepEqual(counts,{'코오롱':6,'에이치':1,'아주':4,'천하':1});
 assert.equal(data.creators.filter(p=>p.gender==='남성').length,7);
 assert.equal(data.creators.filter(p=>p.gender==='여성').length,5);
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
