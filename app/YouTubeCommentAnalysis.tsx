"use client";
import raw from "./data/youtube-comments.json";
import editorial from "./data/youtube-comment-editorial.json";

type ChannelComments = {status?:string;total:number;counts:Record<string,number>;videos:number;completeVideos:number;excludedOwnerPromotions?:number};
export const commentData = raw as {checkedAt:string|null;method:string;channels:Record<string,ChannelComments>};
type Review = {overall:string;positive:string[];negative:string[]};
const reviews = editorial.channels as Record<string, Review>;

function ReactionFace({positive}:{positive:boolean}) {
  return <svg className="yt-reaction-face" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="9"/>
    <path d="M8 9h.01M16 9h.01"/>
    <path d={positive ? "M8 13q4 5 8 0" : "M8 16q4-4 8 0"}/>
  </svg>;
}

export default function YouTubeCommentAnalysis({channelId}:{channelId:string;shared:boolean;onTopicChange?:()=>void}) {
  const review = reviews[channelId];
  if (!review) return <section className="yt-comments"><h4>댓글 분석 준비 중</h4></section>;
  return <section className="yt-comments yt-editorial" aria-label="채널별 댓글 해석">
    <article className="yt-editorial-overall"><h4>채널 총평</h4><p>{review.overall}</p></article>
    <div className="yt-editorial-reactions">
      <article className="positive"><h4>긍정 반응<ReactionFace positive={true}/></h4><ul>{review.positive.map(text=><li key={text}>{text}</li>)}</ul></article>
      <article className="negative"><h4>부정 반응<ReactionFace positive={false}/></h4><ul>{review.negative.map(text=><li key={text}>{text}</li>)}</ul></article>
    </div>
  </section>;
}
