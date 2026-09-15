"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import data from "./data/youtube-creators.json";
import salesData from "./data/sales-activity-analysis.json";
import vocData from "./data/voc-staff-analysis.json";
import photoData from "./data/staff-profile-photos.json";
import "./youtube-performance.css";

type Sales = { staff: { name: string; deliveredSales: number; monthlyDeliveredSales: number[] }[] };
type Voc = { employees: { name: string; years: Record<string, {responses: number; scoreSum: number}> }[] };
type Photos = { sourcePage: string; employees: Record<string, {image: string}> };
const sales = salesData.showrooms as Record<string, Sales>;
const voc = vocData.showrooms as Record<string, Voc>;
const photos = photoData.showrooms as Record<string, Photos>;
const dealers = ["코오롱", "아주", "에이치", "천하", "태영", "아이언", "아이비"];
const creators = data.creators.map(person => {
  const channel = data.channels.find(channel => channel.id === person.channelId)!;
  const staff = sales[person.cdsid]?.staff.filter(staff => staff.name === person.name);
  // Require an unambiguous name + showroom join. Missing data is not zero.
  const result = staff?.length === 1 ? staff[0] : undefined;
  const survey = voc[person.cdsid]?.employees.find(staff => staff.name === person.name)?.years["2026"];
  return {...person, channel, image: photos[person.cdsid]?.employees[person.name]?.image,
    delivered: result?.deliveredSales ?? null,
    monthly: result?.monthlyDeliveredSales.length ? result.deliveredSales / result.monthlyDeliveredSales.length : null,
    months: result?.monthlyDeliveredSales ?? [], responses: survey?.responses ?? 0,
    score: survey?.responses ? survey.scoreSum / survey.responses : null,
    shared: data.creators.filter(staff => staff.channelId === person.channelId).length > 1,
  };
});
const number = (value: number | null) => value === null ? "—" : value.toLocaleString("ko-KR");
const decimal = (value: number | null) => value === null ? "—" : value.toFixed(1);
const sumSubscribers = data.channels.reduce((sum, channel) => sum + (channel.subscribers ?? 0), 0);
const videoTotal = data.channels.reduce((sum, channel) => sum + channel.videoCount, 0);
const male = creators.filter(person=>person.gender === "남성").length;

function ScoreRing({score, responses}: {score: number | null; responses: number}) {
  return <div className={`yt-score ${score === null ? "is-empty" : ""}`}>
    <svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="25"/><circle cx="30" cy="30" r="25" pathLength="100" strokeDasharray={`${(score ?? 0) * 10} 100`}/></svg>
    <strong>{decimal(score)}</strong><span>{responses ? `${responses}건 회신` : "회신 없음"}</span>
  </div>;
}

export default function YouTubePerformance() {
  const [dealer, setDealer] = useState("전체");
  const [gender, setGender] = useState("전체");
  const [selectedName, setSelectedName] = useState("신수경");
  const [entered, setEntered] = useState(false);
  const root = useRef<HTMLElement>(null);
  const visible = creators.filter(person=>(dealer === "전체" || person.dealer === dealer) && (gender === "전체" || person.gender === gender));
  const selected = visible.find(person=>person.name === selectedName) ?? visible[0];
  const channel = selected?.channel;
  const evidence = data.evidence.filter(item=>item.name === selected?.name);
  useEffect(()=> {
    if (!root.current || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)) {setEntered(true); observer.disconnect();}
    }, {threshold: 0.04});
    observer.observe(root.current);
    return ()=>observer.disconnect();
  }, []);

  return <section ref={root} className={`youtube-performance ${entered ? "has-entered" : ""}`} aria-labelledby="yt-heading">
    <header className="yt-hero">
      <div className="yt-hero-copy"><span className="yt-eyebrow"><i aria-hidden="true">▶</i> VOLVO CREATOR INTELLIGENCE</span>
        <h2 id="yt-heading">화면 속 신뢰,<br/><em>고객과 만나는 성과.</em></h2>
        <p>유튜브 영업직원 · 채널의 영향력과 실제 상담·판매를 한눈에</p>
        <small>명단 {data.rosterDate} · 공개 채널 {data.channels[0].checkedAt.slice(0,10)} 확인</small>
      </div>
      <div className="yt-headline-stats">
        <div><span>활동 영업직원</span><strong>{creators.length}<small>명</small></strong><p>채널 {data.channels.length}개 · 공동 운영 1개 포함</p></div>
        <div><span>합산 구독자</span><strong>{number(sumSubscribers)}<small>명</small></strong><p>채널 중복 집계 제외 · 구독자 간 중복 가능</p></div>
        <div><span>공개 영상</span><strong>{number(videoTotal)}<small>개</small></strong><p>롱폼 {data.channels.reduce((s,c)=>s+c.long.count,0)} · 숏츠 {data.channels.reduce((s,c)=>s+c.short.count,0)}</p></div>
      </div>
    </header>
    <div className="yt-distribution">
      <div className="yt-section-label"><span>01 / NETWORK</span><h3>딜러사별 크리에이터 분포</h3><p>비율 기준: 첨부 명단의 전체 {creators.length}명</p></div>
      <div className="yt-dealers" aria-label="딜러사 필터">
        {dealers.map(name=>{const count=creators.filter(person=>person.dealer===name).length;return <button key={name} type="button" aria-pressed={dealer===name} onClick={()=>setDealer(dealer===name ? "전체" : name)} className={count===0?"is-zero":""}>
          <span>{name}</span><strong>{count}<small>명</small></strong><em>{(count / creators.length * 100).toFixed(1)}%</em><i aria-hidden="true">{Array.from({length:count},(_,i)=><b key={i}/>)}</i>
        </button>;})}
      </div>
      <div className="yt-gender"><span className="yt-gender-ring" style={{"--male":`${male / creators.length * 100}%`} as CSSProperties}><b>{creators.length}<small>명</small></b></span><div><strong>남성 {male}명 <small>{(male/creators.length*100).toFixed(1)}%</small></strong><strong>여성 {creators.length-male}명 <small>{((creators.length-male)/creators.length*100).toFixed(1)}%</small></strong><p>제공 명단 기준</p></div></div>
    </div>
    <div className="yt-matrix-heading"><div className="yt-section-label"><span>02 / PEOPLE & PERFORMANCE</span><h3>크리에이터 종합 매트릭스</h3><p>얼굴 카드를 선택하면 채널 상세와 댓글 근거를 확인할 수 있습니다.</p></div>
      <div className="yt-filters"><button type="button" aria-pressed={dealer==="전체"&&gender==="전체"} onClick={()=>{setDealer("전체");setGender("전체");}}>전체 {creators.length}명</button><label>성별 <select value={gender} onChange={event=>setGender(event.target.value)}><option>전체</option><option>남성</option><option>여성</option></select></label><span>{dealer} · {visible.length}명</span></div>
    </div>
    {visible.length ? <div className="yt-people">
      {visible.map(person=><button type="button" key={person.name} className={`yt-person ${selected?.name===person.name?"is-selected":""}`} aria-pressed={selected?.name===person.name} aria-controls="yt-channel-detail" onClick={()=>setSelectedName(person.name)}>
        <div className="yt-person-top"><img src={person.image ?? "/staff-profiles/neutral-human-silhouette.png"} alt={`${person.name} 공식 프로필`} loading="lazy"/><div><span>{person.dealer} · {person.showroom}</span><h4>{person.name}<small>{person.gender}</small></h4><p>{person.shared?"공동 채널":"개인 채널"} <i aria-hidden="true">↗</i></p></div></div>
        <div className="yt-person-channel"><div><span>구독자</span><strong>{number(person.channel.subscribers)}<small>명</small></strong></div><div><span>영상당 평균 조회</span><strong><small>약 </small>{number(person.channel.averageViews)}<small>회</small></strong></div></div>
        <div className="yt-person-results"><div className="yt-person-voc"><ScoreRing score={person.score} responses={person.responses}/><span>2026 상담 만족도<small>10점 만점</small></span></div><div><span>2026 월평균 판매</span><strong>{decimal(person.monthly)}<small>대</small></strong><p>누적 {number(person.delivered)}대</p></div></div>
      </button>)}
    </div> : <div className="yt-empty"><strong>{dealer} · {gender} 조건의 등록 직원이 없습니다.</strong><p>첨부 명단 기준이며 실제 채널 부재를 단정하지 않습니다.</p></div>}
    <p className="yt-period">판매 {salesData.source.salesPeriod} · 월평균은 집계 월수로 나눔(진행 중인 9월 포함) / VOC ~{vocData.source.vocThrough} · 회신 0건은 점수 미표시, 소표본에 유의</p>
    {selected && channel && <article className="yt-detail" id="yt-channel-detail" aria-label={`${selected.name} 채널 상세`}>
      <div className="yt-detail-heading"><div className="yt-section-label"><span>03 / CHANNEL DEEP DIVE</span><h3>{selected.name} <small>{channel.title}</small></h3></div><a href={channel.url} target="_blank" rel="noreferrer">채널에서 보기 ↗</a></div>
      {selected.shared && <p className="yt-shared-note">조선별 × 곽지명 공동 운영 · 아래 구독자·조회·영상 수는 채널 전체 값이며 개인별 성과가 아닙니다.</p>}
      <div className="yt-channel-facts"><div><span>채널 개설일</span><strong>{channel.joined}</strong><small>영업 활동 시작일과 다를 수 있음</small></div><div><span>롱폼</span><strong>{channel.long.count}<small>개</small></strong><small>평균 약 {number(channel.long.averageViews)}회</small></div><div><span>숏츠</span><strong>{channel.short.count}<small>개</small></strong><small>평균 약 {number(channel.short.averageViews)}회</small></div><div><span>채널 누적 조회</span><strong>{number(channel.totalViews)}<small>회</small></strong><small>현재 공개 영상 조회 합계와 다를 수 있음</small></div></div>
      <div className="yt-detail-body"><section className="yt-comments"><h4>시청자가 말하는 설명·응대</h4><p className="yt-muted">영상 {channel.sampledVideos}개에서 댓글 {channel.commentSamples}건 수집 · 확인 가능한 영상 {channel.availableCommentVideos}개</p>
        <div className="yt-evidence-grid">{["positive","suggestion"].map(kind=>{const list=evidence.filter(item=>item.kind===kind);return <div className={`yt-evidence ${kind}`} key={kind}><h5>{kind==="positive"?"+ 긍정 의견":"↗ 개선·요청 의견"}</h5>{list.length?list.map(item=><div key={item.commentId}><strong>{item.topic}</strong><p>{item.summary}</p><a href={item.url} target="_blank" rel="noreferrer">댓글 근거 ↗</a></div>):<p>검토 표본에서 채택한 직원 역량 관련 {kind==="positive"?"긍정":"부정·개선"} 근거가 없습니다. 평가가 없거나 문제가 없다는 뜻은 아닙니다.</p>}</div>;})}</div>
        <p className="yt-muted">시청자 의견 요약이며 능력 판정이 아닙니다. 외모 평가·차량 불만·다른 딜러에 대한 불만은 제외했습니다. 실제 고객 여부와 주장 내용은 검증되지 않았습니다.</p>
      </section><section className="yt-sales-mini"><h4>2026 판매 리듬 <small>월별 출고 대수</small></h4><div className="yt-months" role="img" aria-label={selected.months.map((value,index)=>`${index+1}월 ${value}대`).join(", ")}>{selected.months.map((value,index)=><div key={index}><strong>{value}</strong><i style={{height:`${Math.max(3, value / Math.max(1,...selected.months) * 80)}px`}}/><span>{index+1}월{index===selected.months.length-1?"*":""}</span></div>)}</div><p className="yt-muted">* 9월 진행 중 · 채널 개설 전 판매 포함.<br/>유튜브를 통한 판매 전환으로 해석하지 않습니다.</p><a href={photos[selected.cdsid]?.sourcePage} target="_blank" rel="noreferrer">공식 프로필 출처 ↗</a></section></div>
      {selected.shared && <details className="yt-attribution"><summary>공동 채널 영상별 출연자 확인 <span>조선별 4 · 곽지명 2 · 미확인 8</span></summary><p>영상 설명란의 명시적 출연자 소개 기준. 이름 근거가 없는 숏츠는 얼굴만으로 식별하거나 롱폼과 자동 매칭하지 않았습니다.</p><div>{channel.sharedVideos.map(video=><a key={video.id} href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer"><span>{video.kind==="long"?"롱폼":"숏츠"}</span><strong>{video.title}</strong><em>{video.names.length?video.names.join(" · "):"담당자 미확인"}</em><small>{video.basis}</small></a>)}</div></details>}
    </article>}
    <details className="yt-method"><summary>데이터 기준과 해석 가이드</summary><ul><li>직원·성별·소속은 제공 명단 기준입니다. 공동 채널은 직원 2명, 채널 1개로 집계합니다. 얼굴은 기존 공식 딜러사 프로필과 이름·전시장으로 연결했습니다.</li><li>구독자·영상·조회는 수집 시점의 공개 스냅샷입니다. 자동 실시간 갱신이 아닙니다. 평균 조회수는 공개 롱폼·숏츠의 표시 조회수를 합산한 영상당 평균으로, 반올림된 공개 수치에 따른 근삿값입니다.</li><li>댓글은 채널별 최신 롱폼 최대 3개와 숏츠 최대 3개의 공개 기본 정렬 첫 페이지 표본입니다. 공동 채널은 공개 14개 영상에서 수집했습니다. 전체 댓글의 긍정·부정 비율을 의미하지 않습니다.</li><li>선별한 관련 의견만 요약합니다. 댓글 작성자가 실제 고객인지 검증되지 않았으며, 직원의 객관적 능력 점수나 인사 순위로 사용하지 않습니다.</li><li>판매는 직원명·전시장 코드의 단일 일치, 상담 만족도는 2026 VOC 총점÷회신 수입니다. 유튜브 활동과 판매의 인과관계나 유튜브 유입 매출을 뜻하지 않습니다.</li></ul></details>
  </section>;
}
