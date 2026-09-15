"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import data from "./data/youtube-creators.json";
import salesData from "./data/sales-activity-analysis.json";
import vocData from "./data/voc-staff-analysis.json";
import photoData from "./data/staff-profile-photos.json";
import certificationData from "./data/staff-certifications.json";
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
    certifications, shared: data.creators.filter(staff => staff.channelId === person.channelId).length > 1,
  };
});
const number = (value: number | null) => value === null ? "—" : value.toLocaleString("ko-KR");
const decimal = (value: number | null) => value === null ? "—" : value.toFixed(1);
const sumSubscribers = data.channels.reduce((sum, channel) => sum + (channel.subscribers ?? 0), 0);
const videoTotal = data.channels.reduce((sum, channel) => sum + channel.videoCount, 0);
const male = creators.filter(person=>person.gender === "남성").length;

export default function YouTubePerformance() {
  const [dealer, setDealer] = useState("전체");
  const [selectedName, setSelectedName] = useState("신수경");
  const [entered, setEntered] = useState(false);
  const [sort, setSort] = useState("dealer");
  const [detailOpen, setDetailOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const visible = creators.filter(person=>(dealer === "전체" || person.dealer === dealer)).sort((a,b)=>{
    if (sort === "subscribers") return (b.channel.subscribers ?? -1) - (a.channel.subscribers ?? -1);
    if (sort === "views") return (b.channel.averageViews ?? -1) - (a.channel.averageViews ?? -1);
    if (sort === "sales") return (b.monthly ?? -1) - (a.monthly ?? -1);
    if (sort === "voc") return (b.score ?? -1) - (a.score ?? -1);
    return dealers.indexOf(a.dealer)-dealers.indexOf(b.dealer);
  });
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

  return <section ref={root} className={`youtube-performance yt-compact ${entered ? "has-entered" : ""}`} aria-labelledby="yt-heading">
    <header className="yt-hero">
      <div className="yt-hero-copy"><span className="yt-eyebrow"><i aria-hidden="true">▶</i> VOLVO CREATOR INTELLIGENCE</span>
        <h2 id="yt-heading">유튜브 크리에이터 <em>성과 비교</em></h2>
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
    <div className="yt-matrix-heading"><div className="yt-section-label"><h3>크리에이터 종합 매트릭스</h3><p>모든 정량 지표 동시 비교 · 이름 선택 시 댓글 근거 펼치기</p></div>
      <div className="yt-filters"><button type="button" aria-pressed={dealer==="전체"} onClick={()=>setDealer("전체")}>전체 보기</button><label>정렬 <select value={sort} onChange={event=>setSort(event.target.value)}><option value="dealer">딜러사별</option><option value="subscribers">구독자 많은 순</option><option value="views">평균 조회 높은 순</option><option value="sales">월판매 높은 순</option><option value="voc">누적 만족도 높은 순</option></select></label></div>
    </div>
    {visible.length ? <div className="yt-table-wrap" tabIndex={0} role="region" aria-label="크리에이터 정량 지표 비교표">
      <table className="yt-comparison-table"><caption className="yt-table-caption">12명 채널·상담·판매 정량 지표. 조회수 평균은 공개 표시값 기준 근삿값.</caption><thead><tr>
        <th scope="col">딜러사 / 직원</th><th scope="col">구독자<small>명</small></th><th scope="col">조회수<small>평균 / 누적 · 회</small></th><th scope="col">채널 개설일</th><th scope="col">롱폼<small>개수 / 평균 조회</small></th><th scope="col">숏츠<small>개수 / 평균 조회</small></th><th scope="col">누적 고객만족도 평균<small>10점 / 회신 수</small></th><th scope="col">2026 판매<small>월평균 / 누적 · 대</small></th><th scope="col">댓글 근거<small>선별 요약 · 표본</small></th>
      </tr></thead><tbody>{visible.map((person,index)=>{
        const comments=data.evidence.filter(item=>item.name===person.name);
        const positives=comments.filter(item=>item.kind==="positive").length;
        const suggestions=comments.filter(item=>item.kind==="suggestion").length;
        return <tr key={person.name} className={`${detailOpen && selected?.name===person.name?"is-selected":""} ${index>0 && visible[index-1].dealer!==person.dealer && sort==="dealer"?"yt-dealer-start":""}`}>
          <th scope="row"><button type="button" className="yt-row-person" aria-expanded={detailOpen && selected?.name===person.name} aria-controls="yt-channel-detail" onClick={()=>{setSelectedName(person.name);setDetailOpen(!(detailOpen&&selected?.name===person.name));}}><span className="yt-dealer-code" title={person.dealer}>{dealerCodes[person.dealer]}</span><span className="yt-row-avatar"><img src={person.image ?? "/staff-profiles/neutral-human-silhouette.png"} alt="" loading="lazy"/></span><span><strong>{person.name}<span className="yt-certifications" aria-label={`누적 인증 Grand ${person.certifications[0]}회, Advanced ${person.certifications[1]}회, Certified ${person.certifications[2]}회`}>{person.certifications.map((count,i)=><span key={i}>{["G","A","C"][i]}-{count}</span>)}</span></strong><small><span className="yt-gender-icon" role="img" aria-label={person.gender}>{person.gender==="남성"?"♂":"♀"}</span> {person.showroom}{person.shared&&<b title="조선별·곽지명 공동 채널, 채널 지표 중복 합산 금지">공동</b>}</small></span></button></th>
          <td><strong>{number(person.channel.subscribers)}</strong></td>
          <td><strong>≈{number(person.channel.averageViews)}</strong><small>{number(person.channel.totalViews)}</small></td>
          <td className="yt-joined">{person.channel.joined.replace(/\. /g,".").replace(/\.$/,"")}</td>
          <td><strong>{person.channel.long.count}<i>개</i></strong><small>≈{number(person.channel.long.averageViews)}회</small></td>
          <td><strong>{person.channel.short.count}<i>개</i></strong><small>≈{number(person.channel.short.averageViews)}회</small></td>
          <td className="yt-cell-voc"><strong>{decimal(person.score)}</strong><small>{person.responses?`${person.responses}건 회신`:"회신 없음"}</small></td>
          <td className="yt-cell-sales"><strong>{decimal(person.monthly)}</strong><small>누적 {number(person.delivered)}대</small></td>
          <td className="yt-cell-comments"><span>{positives?`긍정 ${positives}`:"선별 없음"}{suggestions?` · 개선 ${suggestions}`:""}</span><small>채널 표본 {person.channel.commentSamples}건</small></td>
        </tr>;
      })}</tbody></table>
    </div> : <div className="yt-empty"><strong>{dealer}의 등록 직원이 없습니다.</strong><p>첨부 명단 기준이며 실제 채널 부재를 단정하지 않습니다.</p></div>}
    <p className="yt-period">판매 {salesData.source.salesPeriod} · 월평균은 집계 월수로 나눔(진행 중인 9월 포함) / 누적 VOC {vocData.source.historyRange} (~{vocData.source.vocThrough}) · 총 점수 ÷ 총 회신 수 · 회신 0건은 점수 미표시 / 인증 2021–2026 누적 횟수</p>
    {selected && channel && <details className="yt-detail yt-detail-disclosure" id="yt-channel-detail" open={detailOpen} onToggle={event=>setDetailOpen(event.currentTarget.open)}>
      <summary>{selected.name} · 댓글 근거 / 월별 판매 / 채널 상세 <span>{detailOpen?"접기":"펼치기"}</span></summary>
      <div className="yt-detail-heading"><div className="yt-section-label"><span>03 / CHANNEL DEEP DIVE</span><h3>{selected.name} <small>{channel.title}</small></h3></div><a href={channel.url} target="_blank" rel="noreferrer">채널에서 보기 ↗</a></div>
      {selected.shared && <p className="yt-shared-note">조선별 × 곽지명 공동 운영 · 아래 구독자·조회·영상 수는 채널 전체 값이며 개인별 성과가 아닙니다.</p>}
      <div className="yt-channel-facts"><div><span>채널 개설일</span><strong>{channel.joined}</strong><small>영업 활동 시작일과 다를 수 있음</small></div><div><span>롱폼</span><strong>{channel.long.count}<small>개</small></strong><small>평균 약 {number(channel.long.averageViews)}회</small></div><div><span>숏츠</span><strong>{channel.short.count}<small>개</small></strong><small>평균 약 {number(channel.short.averageViews)}회</small></div><div><span>채널 누적 조회</span><strong>{number(channel.totalViews)}<small>회</small></strong><small>현재 공개 영상 조회 합계와 다를 수 있음</small></div></div>
      <div className="yt-detail-body"><section className="yt-comments"><h4>시청자가 말하는 설명·응대</h4><p className="yt-muted">영상 {channel.sampledVideos}개에서 댓글 {channel.commentSamples}건 수집 · 확인 가능한 영상 {channel.availableCommentVideos}개</p>
        <div className="yt-evidence-grid">{["positive","suggestion"].map(kind=>{const list=evidence.filter(item=>item.kind===kind);return <div className={`yt-evidence ${kind}`} key={kind}><h5>{kind==="positive"?"+ 긍정 의견":"↗ 개선·요청 의견"}</h5>{list.length?list.map(item=><div key={item.commentId}><strong>{item.topic}</strong><p>{item.summary}</p><a href={item.url} target="_blank" rel="noreferrer">댓글 근거 ↗</a></div>):<p>검토 표본에서 채택한 직원 역량 관련 {kind==="positive"?"긍정":"부정·개선"} 근거가 없습니다. 평가가 없거나 문제가 없다는 뜻은 아닙니다.</p>}</div>;})}</div>
        <p className="yt-muted">시청자 의견 요약이며 능력 판정이 아닙니다. 외모 평가·차량 불만·다른 딜러에 대한 불만은 제외했습니다. 실제 고객 여부와 주장 내용은 검증되지 않았습니다.</p>
      </section><section className="yt-sales-mini"><h4>2026 판매 리듬 <small>월별 출고 대수</small></h4><div className="yt-months" role="img" aria-label={selected.months.map((value,index)=>`${index+1}월 ${value}대`).join(", ")}>{selected.months.map((value,index)=><div key={index}><strong>{value}</strong><i style={{height:`${Math.max(3, value / Math.max(1,...selected.months) * 80)}px`}}/><span>{index+1}월{index===selected.months.length-1?"*":""}</span></div>)}</div><p className="yt-muted">* 9월 진행 중 · 채널 개설 전 판매 포함.<br/>유튜브를 통한 판매 전환으로 해석하지 않습니다.</p><a href={photos[selected.cdsid]?.sourcePage} target="_blank" rel="noreferrer">공식 프로필 출처 ↗</a></section></div>
      {selected.shared && <details className="yt-attribution"><summary>공동 채널 영상별 출연자 확인 <span>조선별 4 · 곽지명 2 · 미확인 8</span></summary><p>영상 설명란의 명시적 출연자 소개 기준. 이름 근거가 없는 숏츠는 얼굴만으로 식별하거나 롱폼과 자동 매칭하지 않았습니다.</p><div>{channel.sharedVideos.map(video=><a key={video.id} href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer"><span>{video.kind==="long"?"롱폼":"숏츠"}</span><strong>{video.title}</strong><em>{video.names.length?video.names.join(" · "):"담당자 미확인"}</em><small>{video.basis}</small></a>)}</div></details>}
    </details>}
    <details className="yt-method"><summary>데이터 기준과 해석 가이드</summary><ul><li>직원·성별·소속은 제공 명단 기준입니다. 공동 채널은 직원 2명, 채널 1개로 집계합니다. 얼굴은 기존 공식 딜러사 프로필과 이름·전시장으로 연결했습니다.</li><li>구독자·영상·조회는 수집 시점의 공개 스냅샷입니다. 자동 실시간 갱신이 아닙니다. 평균 조회수는 공개 롱폼·숏츠의 표시 조회수를 합산한 영상당 평균으로, 반올림된 공개 수치에 따른 근삿값입니다.</li><li>댓글은 채널별 최신 롱폼 최대 3개와 숏츠 최대 3개의 공개 기본 정렬 첫 페이지 표본입니다. 공동 채널은 공개 14개 영상에서 수집했습니다. 전체 댓글의 긍정·부정 비율을 의미하지 않습니다.</li><li>선별한 관련 의견만 요약합니다. 댓글 작성자가 실제 고객인지 검증되지 않았으며, 직원의 객관적 능력 점수나 인사 순위로 사용하지 않습니다.</li><li>판매는 직원명·전시장 코드의 단일 일치, 상담 만족도는 2023~2026 누적 VOC 총점÷총 회신 수입니다. 유튜브 활동과 판매의 인과관계나 유튜브 유입 매출을 뜻하지 않습니다.</li></ul></details>
  </section>;
}
