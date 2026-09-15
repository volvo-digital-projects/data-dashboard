// Publish only reviewed fields; raw comment samples and local workbook stay outside git.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (process.argv[3]) {
 const samples=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
 for(const c of input.channels)c.reviewedVideos=samples.channels.find(s=>s.channelId===c.channelId)?.reviewedVideos ?? [];
}
const ids = {서수원:'6KR6870',분당판교:'6KR6858',서초:'6KR6852',송파:'6KR6847',하남:'6KR6861',분당:'6KR6830',안양:'6KR6849',고양:'6KR6867',목동:'6KR6846',용산:'6KR6839'};
// Manual contextual review: paraphrases, never an automated personnel score.
const evidence = [
 ['조선별','IXy0Iu6kAEI','UgyV1qLru7OxhpYX36B4AaABAg','positive','이해하기 쉬운 설명','시승 중에도 내용을 이해하기 쉽게 설명한다는 시청자 의견.'],
 ['곽지명','YxShHQUP5q0','UgxtuxCTtwMRfnkNkuV4AaABAg','positive','설명 전달력','차량 설명을 잘한다는 짧은 긍정 의견.'],
 ['김정호','XMjsqm2BF4w','UgxwEs7gVaCWRN8GfjJ4AaABAg','positive','꾸준한 정보 공유','실시간으로 정보를 공유하는 성실함을 긍정적으로 언급.'],
 ['진주현','PucUoGQfxhs','UgyvO8jb8WftBhBURnN4AaABAg','positive','명확한 설명','차량 설명이 명확하고 귀에 잘 들어온다는 의견.'],
 ['신수경','ZmJfe27b8ag','UgxRncZdsOJOUKP2QE94AaABAg','positive','상담 응대','주말 상담에 대한 만족을 표현한 의견. 실제 고객 여부는 별도 검증하지 않음.'],
 ['신수경','1OcMqH0fDDY','UgweEy3hq0tZwaBJbad4AaABAg','positive','궁금증 해소','영상 속 차량 설명으로 궁금한 점이 해소되었다는 의견.'],
 ['신수경','ZmJfe27b8ag','UgzaGHp48vuTcmWyDat4AaABAg','suggestion','콘텐츠 확장 요청','순정 액세서리·전시장 소개와 출고 과정 영상 제작을 요청. 불만이나 능력 부족의 근거는 아님.'],
 ['송민경','1sp_WtjTOfs','UgzMyBbFkI8u9-WLyRV4AaABAg','positive','친절한 비교 상담','계약했다고 밝힌 시청자가 친절한 설명과 비교 상담을 긍정적으로 언급. 고객 신원·계약 여부는 별도 검증하지 않음.'],
 ['송민경','1sp_WtjTOfs','UgwR_WpwwRbpo22wDwF4AaABAg','suggestion','반복되는 말끝맺음','상세한 설명은 긍정적으로 평가하면서, 반복되는 말끝맺음을 줄이면 좋겠다는 개선 의견.'],
];
const channels = input.channels.map(c => {
 if (c.errors.length || !c.longComplete || !c.shortComplete || c.videos.length !== c.videoCount) throw Error(`Incomplete channel: ${c.title}`);
 const kinds = kind => {
  const list = c.videos.filter(v=>v.kind===kind); const known=list.filter(v=>v.views!==null);
  return {count:list.length, averageViews:known.length ? Math.round(known.reduce((s,v)=>s+v.views,0)/known.length) : null, viewsSample:known.length};
 };
 const known=c.videos.filter(v=>v.views!==null);
 if(known.length!==c.videos.length)throw Error(`Missing public view counts: ${c.title}`);
 return {id:c.channelId,url:c.url,title:c.title,checkedAt:c.checkedAt,joined:c.joined,subscribers:c.subscribers,totalViews:c.totalViews,videoCount:c.videoCount,
  averageViews:known.length?Math.round(known.reduce((s,v)=>s+v.views,0)/known.length):null,viewsSample:known.length,long:kinds('long'),short:kinds('short'),
  sampledVideos:c.reviewedVideos.length,commentSamples:c.reviewedVideos.reduce((s,v)=>s+v.comments.length,0),availableCommentVideos:c.reviewedVideos.filter(v=>v.commentStatus==='sampled').length,
  sharedVideos:input.roster.filter(r=>r.channelUrl===c.url).length>1?c.reviewedVideos.map(v=>({id:v.id,title:v.title,kind:v.kind,views:v.views,names:v.attribution,basis:v.attribution.length?'영상 설명란의 출연자 소개':'출연자 이름 근거 미확인'})):[]};
});
const creators=input.roster.map(r=>({dealer:r.dealer,showroom:r.showroom,name:r.name,gender:r.gender,cdsid:ids[r.showroom],channelId:channels.find(c=>c.url===r.channelUrl).id}));
const reviewedEvidence=evidence.map(([name,videoId,commentId,kind,topic,summary])=>{
 const c=input.channels.find(c=>c.reviewedVideos.some(v=>v.id===videoId));
 const v=c?.reviewedVideos.find(v=>v.id===videoId);
 if(!v?.comments.some(x=>x.id===commentId))throw Error(`Missing evidence ${commentId}`);
 return {name,videoId,commentId,kind,topic,summary,videoTitle:v.title,url:`https://www.youtube.com/watch?v=${videoId}&lc=${commentId}`};
});
fs.writeFileSync(path.join(root,'app/data/youtube-creators.json'),JSON.stringify({rosterDate:input.rosterDate,source:'사용자 제공 볼보 유튜브 영업직원 명단 · 공개 YouTube 채널/영상',creators,channels,evidence:reviewedEvidence},null,2)+'\n');
console.log(`Prepared ${creators.length} staff / ${channels.length} distinct channels / ${reviewedEvidence.length} reviewed evidence items.`);
