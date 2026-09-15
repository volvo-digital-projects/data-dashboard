"use client";
import { useState } from "react";
import raw from "./data/youtube-comments.json";
import reviewed from "./data/youtube-creators.json";

type Entry = {id:string;category:string;topic:string;summary:string;url:string;videoId:string;kind:string};
type ChannelComments = {status?:string;total:number;videos:number;completeVideos:number;partialVideos:number;unavailableVideos:number;counts:Record<string,number>;entries:Entry[];coverage:{id:string;kind:string;status:string;reported:number|null}[]};
export const commentData = raw as {checkedAt:string|null;method:string;channels:Record<string,ChannelComments>};

export default function YouTubeCommentAnalysis({channelId, shared}:{channelId:string;shared:boolean}) {
  const [topic, setTopic] = useState<string|null>(null);
  const sampleOnly = !commentData.channels[channelId];
  const names = reviewed.creators.filter(person=>person.channelId===channelId).map(person=>person.name);
  const evidence = reviewed.evidence.filter(entry=>names.includes(entry.name));
  const data: ChannelComments = commentData.channels[channelId] ?? {total:evidence.length,videos:0,completeVideos:0,partialVideos:0,unavailableVideos:0,
    counts:{positive:evidence.filter(entry=>entry.kind==="positive").length,suggestion:evidence.filter(entry=>entry.kind==="suggestion").length,other:0,review:0,owner:0},
    entries:evidence.map(entry=>({id:entry.commentId,category:entry.kind,topic:entry.topic,summary:entry.summary,url:entry.url,videoId:entry.videoId,kind:"video"})),coverage:[]};
  const selected = data.entries.filter(entry=>`${entry.category}:${entry.topic}`===topic);
  return <section className="yt-comments yt-all-comments"><h4>유지/강화 · 수정/보완 댓글 분석</h4>
    <p className="yt-muted">{sampleOnly?`전체 댓글 수집 미완료 · YouTube 요청 제한 / API 연결 필요. 현재는 기존 표본 중 검토한 ${data.total}건만 표시합니다.`:`채널 전체 공개 댓글 페이지 순회 · 댓글이 확인된 영상 ${data.videos}개 · 댓글·답글 ${data.total.toLocaleString("ko-KR")}건 · ${commentData.checkedAt?.slice(0,10).replaceAll("-",".") ?? ""} 수집`}</p>
    <p className="yt-muted">{sampleOnly?"기존 수동 검토 의견입니다.":"자동 키워드 분류이며 원문 문맥 확인이 필요합니다."} 실제 고객 여부·직원 능력은 판정하지 않습니다. 삭제·비공개·차단 댓글은 수집할 수 없습니다.{shared?" 공동 채널 전체 의견이며 특정 직원에게 자동 귀속하지 않습니다.":""}</p>
    <div className="yt-comment-panels">{["positive","suggestion"].map(category=>{
      const items = data.entries.filter(entry=>entry.category===category);
      const topics = [...new Set(items.map(entry=>entry.topic))];
      return <div className={`yt-comment-panel ${category}`} key={category}><h5>{category==="positive"?"유지/강화":"수정/보완"}<span>{items.length}건</span></h5>
        {topics.length?topics.map(label=>{const count=items.filter(entry=>entry.topic===label).length;return <button key={label} type="button" aria-pressed={topic===`${category}:${label}`} onClick={()=>setTopic(`${category}:${label}`)}><span>{label}</span><i><b style={{width:`${count/Math.max(1,items.length)*100}%`}}/></i><em>{count}건</em><small>상세보기</small></button>}):<p>이 방향으로 분류된 표현이 없습니다.</p>}
      </div>
    })}</div>
    {!sampleOnly && <details className="yt-comment-other"><summary>중립·기타 {data.counts.other} · 복합/검토 필요 {data.counts.review} · 운영자 답글 {data.counts.owner}건</summary><p>두 방향으로 억지 분류하지 않은 댓글도 전체 건수에 포함됩니다.</p>{["other","review","owner"].map(category=><button type="button" key={category} onClick={()=>setTopic(`${category}:${data.entries.find(entry=>entry.category===category)?.topic}`)}>{category==="other"?"중립·기타":category==="review"?"복합 의견":"운영자 답글"} 상세보기</button>)}</details>}
    {topic && <div className="yt-comment-drilldown" aria-live="polite"><h5>{selected[0]?.topic ?? "해당 의견 없음"} · {selected.length}건 <button type="button" onClick={()=>setTopic(null)}>닫기</button></h5><p>본문·작성자 정보는 재게시하지 않습니다. 분류 근거와 각 댓글 원문 링크를 확인하세요.</p><ol>{selected.map(entry=><li key={`${entry.videoId}:${entry.id}`}><span>{entry.kind==="long"?"롱폼":entry.kind==="short"?"숏츠":"영상"}</span><p>{entry.summary}</p><a href={entry.url} target="_blank" rel="noreferrer">댓글 원문 ↗</a></li>)}</ol></div>}
    {!sampleOnly && <details className="yt-comment-coverage"><summary>영상별 수집 범위 확인</summary><ul>{data.coverage.map(video=><li key={video.id}><a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer">{video.kind==="long"?"롱폼":video.kind==="short"?"숏츠":"영상"} · {video.id}</a> — {video.status==="complete"?"API 공개 댓글 순회 완료":video.status==="partial"?"일부 수집 · 추가 확인 필요":"확인 불가"}</li>)}</ul></details>}
  </section>;
}
