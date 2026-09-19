"use client";

import { useEffect, useRef, useState } from "react";
import data from "./data/youtube-creators.json";
import salesData from "./data/sales-activity-analysis.json";
import vocData from "./data/voc-staff-analysis.json";
import photoData from "./data/staff-profile-photos.json";
import certificationData from "./data/staff-certifications.json";
import YouTubeCommentAnalysis, { commentData } from "./YouTubeCommentAnalysis";
import "./youtube-performance.css";

type Sales = { staff: { name: string; deliveredSales: number; monthlyDeliveredSales: number[] }[] };
type Voc = { employees: { name: string; years: Record<string, {responses: number; scoreSum: number}> }[] };
type Photos = { sourcePage: string; employees: Record<string, {image: string}> };
const sales = salesData.showrooms as Record<string, Sales>;
const voc = vocData.showrooms as Record<string, Voc>;
const photos = photoData.showrooms as Record<string, Photos>;
const dealers = ["코오롱", "아주", "에이치", "천하", "태영", "아이언", "아이비"];
const dealerCodes: Record<string, string> = {에이치:"H", 천하:"CA", 아주:"AJ", 코오롱:"KL", 아이비:"IV", 아이언:"IR", 태영:"TY"};
const creators = data.creators.map(person => {
  const channel = data.channels.find(channel => channel.id === person.channelId)!;
  const staff = sales[person.cdsid]?.staff.filter(staff => staff.name === person.name);
  // Require an unambiguous name + showroom join. Missing data is not zero.
  const result = staff?.length === 1 ? staff[0] : undefined;
  const history = voc[person.cdsid]?.employees.find(staff => staff.name === person.name)?.years;
  const survey = Object.values(history ?? {}).reduce((sum, year) => ({responses: sum.responses + year.responses, scoreSum: sum.scoreSum + year.scoreSum}), {responses:0, scoreSum:0});
  const nameCount = Object.values(sales).flatMap(showroom => showroom.staff).filter(staff => staff.name === person.name).length;
  const certifications = ["Grand", "Advanced", "Certified"].map(level => certificationData.records.filter(record => record.name === person.name && (nameCount === 1 || record.showroom === person.showroom) && record.level === level).length);
  return {...person, channel, image: photos[person.cdsid]?.employees[person.name]?.image,
    delivered: result?.deliveredSales ?? null,
    monthly: result?.monthlyDeliveredSales.length ? result.deliveredSales / result.monthlyDeliveredSales.length : null,
    months: result?.monthlyDeliveredSales ?? [], responses: survey?.responses ?? 0,
    score: survey?.responses ? survey.scoreSum / survey.responses : null,
    hireDate: voc[person.cdsid]?.employees.find(employee => employee.name === person.name)?.hireDate,
    certifications, shared: data.creators.filter(staff => staff.channelId === person.channelId).length > 1,
  };
});
const number = (value: number | null) => value === null ? "—" : value.toLocaleString("ko-KR");
const decimal = (value: number | null) => value === null ? "—" : value.toFixed(1);
const formatDates = (value: string) => value.replace(/(\d{4})[-.]\s*(\d{1,2})[-.]\s*(\d{1,2})\.?/g, (_, year, month, day) => `${year}.${month.padStart(2,"0")}.${day.padStart(2,"0")}`);
const formatCompactDate = (value: string | undefined) => {
  if (!value) return "—";
  const match = value.match(/(\d{4})[-.]\s*(\d{1,2})[-.]\s*(\d{1,2})/);
  return match ? `${match[1].slice(2)}${match[2].padStart(2,"0")}${match[3].padStart(2,"0")}` : value;
};
const sumSubscribers = data.channels.reduce((sum, channel) => sum + (channel.subscribers ?? 0), 0);
const videoTotal = data.channels.reduce((sum, channel) => sum + channel.videoCount, 0);
const male = creators.filter(person=>person.gender === "남성").length;
const lastChannelUpdate = new Date(Math.min(...data.channels.map(channel => Date.parse(channel.checkedAt))));
const updateLabel = formatDates(new Intl.DateTimeFormat("sv-SE", {timeZone:"Asia/Seoul", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false}).format(lastChannelUpdate));
type DailyClose = {date:string; lastSubscribers:number; lastVideos:number; previousSubscribers:number|null; previousVideos:number|null};
const dailyCloseKey = "volvo-youtube-daily-close";
const kstDate = () => new Intl.DateTimeFormat("sv-SE", {timeZone:"Asia/Seoul", year:"numeric", month:"2-digit", day:"2-digit"}).format(new Date());
const changeLabel = (current:number, previous:number|null) => previous === null || previous === 0 ? "전일 최종마감 대비 —" : `전일 최종마감 대비 ${current >= previous ? "+" : ""}${((current - previous) / previous * 100).toFixed(1)}%`;

function GenderIcon({gender}:{gender:string}) {
  return <svg className="yt-gender-icon" viewBox="0 0 16 20" role="img" aria-label={gender} fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="9" r="4"/>{gender==="남성"?<path d="M8 5V0M5 3 8 0l3 3"/>:<path d="M8 13v7M5 17h6"/>}</svg>;
}
export default function YouTubePerformance() {
  const [dealer, setDealer] = useState("전체");
  const [selectedName, setSelectedName] = useState("신수경");
  const [entered, setEntered] = useState(false);
  const [sort, setSort] = useState("subscribers");
  const [detailOpen, setDetailOpen] = useState(false);
  const [dailyClose, setDailyClose] = useState<DailyClose | null>(null);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const today = kstDate();
    const current = {subscribers:sumSubscribers, videos:videoTotal};
    let saved: DailyClose | null = null;
    try { saved = JSON.parse(localStorage.getItem(dailyCloseKey) ?? "null") as DailyClose | null; } catch {}
    const next: DailyClose = saved?.date === today
      ? {...saved, lastSubscribers:current.subscribers, lastVideos:current.videos}
      : {date:today, lastSubscribers:current.subscribers, lastVideos:current.videos, previousSubscribers:saved?.lastSubscribers ?? null, previousVideos:saved?.lastVideos ?? null};
    try { localStorage.setItem(dailyCloseKey, JSON.stringify(next)); } catch {}
    setDailyClose(next);
  }, []);
  const visible = creators.filter(person=>(dealer === "전체" || person.dealer === dealer)).sort((a,b)=>{
    if (sort === "subscribers") return (b.channel.subscribers ?? -1) - (a.channel.subscribers ?? -1);
    if (sort === "views") return (b.channel.averageViews ?? -1) - (a.channel.averageViews ?? -1);
    if (sort === "sales") return (b.monthly ?? -1) - (a.monthly ?? -1);
    if (sort === "voc") return (b.score ?? -1) - (a.score ?? -1);
    return dealers.indexOf(a.dealer)-dealers.indexOf(b.dealer);
  });
  const selected = visible.find(person=>person.name === selectedName) ?? visible[0];
  const channel = selected?.channel;
  useEffect(()=> {
    if (!root.current || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)) {setEntered(true); observer.disconnect();}
    }, {threshold: 0.04});
    observer.observe(root.current);
    return ()=>observer.disconnect();
  }, []);

  useEffect(() => {
    const section = root.current;
    const scroller = section?.closest<HTMLElement>(".dealer-analysis-scroll");
    if (!section || !scroller) return;
    const resize = () => section.style.setProperty("--yt-available", `${scroller.clientHeight}px`);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(scroller);
    let timer: ReturnType<typeof setTimeout>;
    let frame = 0, touching = false, direction = 0, previous = scroller.scrollTop;
    const target = () => (section.getBoundingClientRect().top - scroller.getBoundingClientRect().top) / (scroller.getBoundingClientRect().height / scroller.offsetHeight) + scroller.scrollTop;
    const cancel = () => { clearTimeout(timer); cancelAnimationFrame(frame); frame = 0; };
    const settle = () => {
      const end = target(), from = scroller.scrollTop;
      if (touching || end <= from + 2 || end - from > Math.min(400, scroller.clientHeight * .65)) return;
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) { scroller.scrollTop = end; return; }
      const started = performance.now();
      const step = (now:number) => {
        const t = Math.min(1, (now-started)/320);
        scroller.scrollTop = from + (end-from)*(1-Math.pow(1-t,3));
        if(t<1) frame=requestAnimationFrame(step); else frame=0;
      };
      frame=requestAnimationFrame(step);
    };
    const scroll = () => {
      const down = scroller.scrollTop > previous;
      direction = down ? 1 : -1;
      previous = scroller.scrollTop;
      if(frame || touching) return;
      clearTimeout(timer);
      if(down) timer=setTimeout(settle, 90);
    };
    const touchStart = () => { touching=true; cancel(); };
    const touchEnd = () => { touching=false; if(direction>0) timer=setTimeout(settle,90); };
    scroller.addEventListener("scroll",scroll,{passive:true});
    scroller.addEventListener("wheel",cancel,{passive:true});
    scroller.addEventListener("touchstart",touchStart,{passive:true});
    scroller.addEventListener("touchend",touchEnd,{passive:true});
    scroller.addEventListener("keydown",cancel);
    return () => {cancel(); observer.disconnect(); scroller.removeEventListener("scroll",scroll); scroller.removeEventListener("wheel",cancel); scroller.removeEventListener("touchstart",touchStart); scroller.removeEventListener("touchend",touchEnd); scroller.removeEventListener("keydown",cancel);};
  }, []);
  useEffect(() => {
    if (!detailOpen) return;
    const section=root.current, scroller=section?.closest<HTMLElement>(".dealer-analysis-scroll");
    if(section && scroller) scroller.scrollTo({top:(section.getBoundingClientRect().top-scroller.getBoundingClientRect().top)/(scroller.getBoundingClientRect().height/scroller.offsetHeight)+scroller.scrollTop,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
  }, [detailOpen]);
  return <section ref={root} className={`youtube-performance yt-compact ${entered ? "has-entered" : ""} ${detailOpen ? "has-comment-detail" : ""}`} aria-labelledby="yt-heading">
    <header className="yt-hero">
      <div className="yt-hero-copy">
        <div className="yt-title-row"><h2 id="yt-heading"><svg className="yt-title-icon" viewBox="0 0 24 17" aria-hidden="true"><rect width="24" height="17" rx="4" fill="#ff0033"/><path d="M10 4.5 16 8.5 10 12.5Z" fill="white"/></svg>유튜브 크리에이터 <em>성과 비교</em></h2><span className="yt-update-stamp" title="공개 채널 지표 매시간 수집 예정 · 마지막 전체 수집 성공 시각 (KST)"><span aria-hidden="true">◷</span><b>UPDATE</b> {updateLabel} 기준</span></div>
      </div>
      <div className="yt-headline-stats">
        <div className="yt-staff-stat"><span>활동 영업직원</span><div className="yt-staff-total"><strong>{creators.length}<small>명</small></strong><div className="yt-gender-summary">{["남성","여성"].map(gender=>{const count=gender==="남성"?male:creators.length-male;return <span key={gender}><GenderIcon gender={gender}/>{count}명 <small>{(count/creators.length*100).toFixed(1)}%</small></span>})}</div></div></div>
        <div><span>합산 구독자</span><strong>{number(sumSubscribers)}<small>명</small></strong><p className="yt-close-change">{changeLabel(sumSubscribers, dailyClose?.previousSubscribers ?? null)}</p><p>채널 중복 집계 제외 · 구독자 간 중복 가능</p></div>
        <div><span>공개 영상</span><strong>{number(videoTotal)}<small>개</small></strong><p className="yt-close-change">{changeLabel(videoTotal, dailyClose?.previousVideos ?? null)}</p><p>롱폼 {data.channels.reduce((s,c)=>s+c.long.count,0)} · 숏츠 {data.channels.reduce((s,c)=>s+c.short.count,0)}</p></div>
      </div>
    </header>
    <div className="yt-distribution">
      <div className="yt-section-label"><span>01 / NETWORK</span><h3>딜러사별 크리에이터 분포</h3><p>비율 기준: 첨부 명단의 전체 {creators.length}명</p></div>
      <div className="yt-dealers" aria-label="딜러사 필터">
        {dealers.map(name=>{const count=creators.filter(person=>person.dealer===name).length;return <button key={name} type="button" aria-pressed={dealer===name} onClick={()=>setDealer(dealer===name ? "전체" : name)} className={count===0?"is-zero":""}>
          <span>{name}</span><strong>{count}<small>명 / {creators.length}</small></strong><em>{(count / creators.length * 100).toFixed(1)}%</em><i aria-hidden="true">{Array.from({length:count},(_,i)=><b key={i}/>)}</i>
        </button>;})}
      </div>
    </div>
    <div className="yt-matrix-heading"><div className="yt-section-label"><h3>크리에이터 명단</h3></div>
      <div className="yt-filters" aria-label="크리에이터 정렬">{([["subscribers","구독자 많은 순"],["voc","평균 만족도 높은 순"],["sales","월평균 판매 높은 순"],["views","평균 조회 높은 순"],["dealer","딜러사별"]] as const).map(([value,label])=><button key={value} type="button" className="yt-sort-filter" aria-pressed={sort===value} onClick={()=>setSort(value)}>{label}</button>)}</div>
    </div>
    {visible.length ? <div className="yt-table-wrap" tabIndex={0} role="region" aria-label="크리에이터 정량 지표 비교표">
      <table className="yt-comparison-table"><caption className="yt-table-caption">12명 채널·상담·판매 정량 지표. 조회수 평균은 공개 표시값 기준 근삿값.</caption><thead><tr>
        <th scope="col">딜러사 / 직원</th><th scope="col">입사일자<small>YYMMDD</small></th><th scope="col">채널 개설일<small>YYMMDD</small></th><th scope="col">인증레벨<small>누적 횟수</small></th><th scope="col">구독자<small>명</small></th><th scope="col">평균 조회수<small>/ 누적 · 회</small></th><th scope="col">롱폼<small>개수 / 평균 조회</small></th><th scope="col">숏츠<small>개수 / 평균 조회</small></th><th scope="col">누적 고객만족도 평균<small>10점 / 회신 수</small></th><th scope="col">26년 월평균 판매<small>/ 누적 · 대</small></th><th scope="col">공개 댓글·답글<small>롱폼 + 숏츠</small></th>
      </tr></thead><tbody>{visible.map((person,index)=>{
        const comments=commentData.channels[person.channelId];


        return <tr key={person.name} className={`${detailOpen && selected?.name===person.name?"is-selected":""} ${index>0 && visible[index-1].dealer!==person.dealer && sort==="dealer"?"yt-dealer-start":""}`}>
          <th scope="row"><button type="button" className="yt-row-person" aria-expanded={detailOpen && selected?.name===person.name} aria-controls="yt-channel-detail" onClick={()=>{setSelectedName(person.name);setDetailOpen(!(detailOpen&&selected?.name===person.name));}}><span className="yt-dealer-code" title={person.dealer}>{dealerCodes[person.dealer]}</span><span className="yt-row-avatar"><img src={person.image ?? "/staff-profiles/neutral-human-silhouette.png"} alt="" loading="lazy"/></span><span><strong>{person.name} <GenderIcon gender={person.gender}/></strong><small>/ {person.showroom}{person.shared&&<b title="조선별·곽지명 공동 채널, 채널 지표 중복 합산 금지">공동</b>}</small></span></button></th>
          <td className="yt-hire-date">{formatCompactDate(person.hireDate)}</td>
          <td className="yt-joined">{formatCompactDate(person.channel.joined)}</td>
          <td className="yt-cert-cell"><span className="yt-certifications" aria-label={`누적 인증 Grand ${person.certifications[0]}회, Advanced ${person.certifications[1]}회, Certified ${person.certifications[2]}회`}>{person.certifications.map((count,i)=><span key={i}>{["G","A","C"][i]}-{count}</span>)}</span></td>
          <td><strong>{number(person.channel.subscribers)}</strong></td>
          <td><strong>≈{number(person.channel.averageViews)}</strong><small>{number(person.channel.totalViews)}</small></td>
          <td><strong>{person.channel.long.count}<i>개</i></strong><small>≈{number(person.channel.long.averageViews)}회</small></td>
          <td><strong>{person.channel.short.count}<i>개</i></strong><small>≈{number(person.channel.short.averageViews)}회</small></td>
          <td className="yt-cell-voc"><strong>{decimal(person.score)}</strong><small>{person.responses?`${person.responses}건 회신`:"회신 없음"}</small></td>
          <td className="yt-cell-sales"><strong>{decimal(person.monthly)}</strong><small>누적 {number(person.delivered)}대</small></td>
          <td className="yt-cell-comments"><button type="button" onClick={()=>{setSelectedName(person.name);setDetailOpen(true);}} aria-controls="yt-channel-detail">{comments && comments.status==="complete"?`${number(comments.total)}건`:"전체 미확인"}<small>상세보기</small></button>{!comments && <small>기존 표본 {person.channel.commentSamples}건</small>}{comments && <small>{comments.status==="complete"?"공개 순회 완료":`미완료 ${comments.videos-comments.completeVideos}개 영상`}</small>}</td>
        </tr>;
      })}</tbody></table>
    </div> : <div className="yt-empty"><strong>{dealer}의 등록 직원이 없습니다.</strong><p>첨부 명단 기준이며 실제 채널 부재를 단정하지 않습니다.</p></div>}
    <p className="yt-period">판매 {formatDates(salesData.source.salesPeriod)} · 월평균은 집계 월수로 나눔(진행 중인 9월 포함) / 누적 VOC {vocData.source.historyRange} (~{formatDates(vocData.source.vocThrough)}) · 총 점수 ÷ 총 회신 수 · 회신 0건은 점수 미표시 / 인증 2021–2026 누적 횟수</p>
    {selected && channel && <details className="yt-detail yt-detail-disclosure" id="yt-channel-detail" open={detailOpen}>
      <summary onClick={event=>{event.preventDefault();setDetailOpen(open=>!open);}}>{selected.name} · 댓글 분석 <span>{detailOpen?"접기":"펼치기"}</span></summary>
      <YouTubeCommentAnalysis key={channel.id} channelId={channel.id} shared={selected.shared} onTopicChange={()=>{
        const section=root.current, scroller=section?.closest<HTMLElement>(".dealer-analysis-scroll");
        if(section && scroller) scroller.scrollTop+=(section.getBoundingClientRect().top-scroller.getBoundingClientRect().top)/(scroller.getBoundingClientRect().height/scroller.offsetHeight);
      }}/>
    </details>}
    <details className="yt-method"><summary>데이터 기준과 해석 가이드</summary><ul><li>직원·성별·소속은 제공 명단 기준입니다. 공동 채널은 직원 2명, 채널 1개로 집계합니다. 얼굴은 기존 공식 딜러사 프로필과 이름·전시장으로 연결했습니다.</li><li>구독자·영상·조회는 수집 시점의 공개 스냅샷입니다. 공개 채널 지표는 매시간 수집을 시도하며 UPDATE는 마지막 전체 수집 성공 시각입니다. 실행 지연·수집 실패 시 이전 정상값을 유지합니다. 댓글은 API 키 연결 후 같은 시간별 작업에서 갱신하며, 댓글 수집일은 상세 분석에 별도로 표시합니다. 평균 조회수는 공개 롱폼·숏츠의 표시 조회수를 합산한 영상당 평균으로, 반올림된 공개 수치에 따른 근삿값입니다.</li><li>댓글은 API 키 연결 후 채널 전체 공개 댓글·답글 페이지를 순회합니다. 연결 전에는 기존 검토 표본만 표시하며, 삭제·비공개·검토 대기 댓글은 포함할 수 없습니다. 분류는 키워드 기반 자동 검토 보조이며 원문 확인이 필요합니다.</li><li>모든 수집 댓글을 유지/강화·수정/보완·중립/기타·복합 검토·운영자 답글로 집계합니다. 댓글 작성자가 실제 고객인지 검증되지 않았으며, 직원의 객관적 능력 점수나 인사 순위로 사용하지 않습니다.</li><li>판매는 직원명·전시장 코드의 단일 일치, 상담 만족도는 2023~2026 누적 VOC 총점÷총 회신 수입니다. 유튜브 활동과 판매의 인과관계나 유튜브 유입 매출을 뜻하지 않습니다.</li></ul></details>
  </section>;
}
