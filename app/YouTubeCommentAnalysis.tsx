"use client";
import raw from "./data/youtube-comments.json";
import editorial from "./data/youtube-comment-editorial.json";

type ChannelComments = {status?:string;total:number;counts:Record<string,number>;videos:number;completeVideos:number;excludedOwnerPromotions?:number};
export const commentData = raw as {checkedAt:string|null;method:string;channels:Record<string,ChannelComments>};
type Review = {overall:string;positive:string[];negative:string[];opinion:string};
const reviews = editorial.channels as Record<string, Review>;

export default function YouTubeCommentAnalysis({channelId}:{channelId:string;shared:boolean;onTopicChange?:()=>void}) {
  const review = reviews[channelId];
  if (!review) return <section className="yt-comments"><h4>댓글 분석 준비 중</h4></section>;
  return <section className="yt-comments yt-editorial" aria-label="채널별 댓글 해석">
    <article className="yt-editorial-overall"><h4>채널 총평</h4><p>{review.overall}</p></article>
    <div className="yt-editorial-reactions">
      <article className="positive"><h4>긍정 반응</h4><ul>{review.positive.map(text=><li key={text}>{text}</li>)}</ul></article>
      <article className="negative"><h4>부정 반응</h4><ul>{review.negative.map(text=><li key={text}>{text}</li>)}</ul></article>
    </div>
    <article className="yt-editorial-opinion"><h4>내 의견</h4><p>{review.opinion}</p></article>
  </section>;
}
