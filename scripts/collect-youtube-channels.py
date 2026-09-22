"""Read public channel pages from the supplied roster; never assume missing metrics are zero."""
import concurrent.futures, datetime, json, re, sys, urllib.request
from pathlib import Path
sys.stdout.reconfigure(encoding='utf-8')
ROOT = Path(__file__).resolve().parents[1]
def nodes(v, key):
    if isinstance(v, dict):
        if key in v: yield v[key]
        for x in v.values(): yield from nodes(x, key)
    elif isinstance(v, list):
        for x in v: yield from nodes(x, key)
def page(url):
    localized = url + ('&' if '?' in url else '?') + 'hl=ko&gl=KR'
    request = urllib.request.Request(localized, headers={
        'Accept-Language':'ko-KR,ko;q=0.9',
        'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36',
    })
    html = urllib.request.urlopen(request, timeout=30).read().decode()
    m = re.search(r'var ytInitialData = (.*?);</script>',html)
    data=json.loads(m.group(1))
    version=re.search(r'"INNERTUBE_CLIENT_VERSION":"([^"]+)"',html)
    data['_clientVersion']=version[1] if version else None
    return data
def number(text):
    m = re.search(r'([\d,.]+)\s*(만|천|억)?',text or '')
    return round(float(m[1].replace(',','')) * {'만':10000,'천':1000,'억':100000000,None:1}[m[2]]) if m else None
def txt(v):
    return v.get('simpleText',v.get('content','')) or ''.join(x.get('text','') for x in v.get('runs',[]))
def collect(url):
    result = {'url':url,'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'videos':[],'errors':[]}
    try:
        data=page(url+'/about'); about=next(nodes(data,'aboutChannelViewModel'),{}); meta=next(nodes(data,'channelMetadataRenderer'),{})
        result.update(title=meta.get('title'),channelId=meta.get('externalId'),subscribers=number(about.get('subscriberCountText')),totalViews=number(about.get('viewCountText')),videoCount=number(about.get('videoCountText')),joined=txt(about.get('joinedDateText',{})).replace('가입일: ',''))
        for kind,tab in [('long','videos'),('short','shorts')]:
            data=page(url+'/'+tab)
            version=data.get('_clientVersion')
            contents=data.get('contents',{})
            pages=[contents]
            for _ in range(30):
                continuations=list(nodes(pages[-1],'continuationItemRenderer'))
                if not continuations or not version: break
                endpoint=continuations[-1]['continuationEndpoint']
                token=endpoint['continuationCommand']['token']
                api=endpoint['commandMetadata']['webCommandMetadata']['apiUrl']
                payload={'context':{'client':{'clientName':'WEB','clientVersion':version,'hl':'ko','gl':'KR'}},'continuation':token}
                req=urllib.request.Request('https://www.youtube.com'+api,data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'})
                more=json.load(urllib.request.urlopen(req,timeout=30))
                pages.append(more)
            videos=[]
            for v in nodes(pages,'videoRenderer'):
                videos.append({'id':v['videoId'],'title':txt(v.get('title',{})),'views':number(txt(v.get('viewCountText',{}))),'kind':kind})
            for v in nodes(pages,'lockupViewModel'):
                if v.get('contentType')!='LOCKUP_CONTENT_TYPE_VIDEO': continue
                meta=v.get('metadata',{}).get('lockupMetadataViewModel',{})
                labels=list(nodes(meta.get('metadata',{}),'content'))+list(nodes(meta.get('metadata',{}),'accessibilityLabel'))
                views=next((x for x in labels if '조회수' in x),None)
                videos.append({'id':v['contentId'],'title':txt(meta.get('title',{})),'views':number(views),'kind':kind})
            for v in nodes(pages,'shortsLockupViewModel'):
                rid=v.get('entityId','').replace('shorts-shelf-item-','')
                ids=list(nodes(v,'videoId'))
                vid=ids[0] if ids else rid
                videos.append({'id':vid,'title':txt(v.get('overlayMetadata',{}).get('primaryText',{})),'views':number(txt(v.get('overlayMetadata',{}).get('secondaryText',{}))),'kind':kind})
            unique={v['id']:v for v in videos}
            result['videos'].extend(unique.values())
            # Counts are only exact when all public videos in this tab were enumerated.
            result[kind+'Complete']=not bool(list(nodes(pages[-1],'continuationItemRenderer')))
        result['videos']=list({v['id']:v for v in result['videos']}.values())
    except Exception as e: result['errors'].append(str(e))
    return result
if __name__=='__main__':
    import openpyxl
    workbook=openpyxl.load_workbook(sys.argv[1],data_only=True)
    rows=[r for r in list(workbook.active.values)[3:] if r[2]]
    roster=[{'dealer':r[0],'showroom':r[1],'name':r[2],'gender':'여성' if r[3]=='예성' else r[3],'channelUrl':r[5].removesuffix('/shorts')} for r in rows]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool: channels=list(pool.map(collect,dict.fromkeys(r['channelUrl'] for r in roster)))
    supplied_date=workbook.active['F1'].value
    roster_date=supplied_date.date().isoformat() if isinstance(supplied_date, datetime.datetime) else str(supplied_date)
    result={'rosterSource':Path(sys.argv[1]).name,'rosterDate':roster_date,'roster':roster,'channels':channels}
    out=Path(sys.argv[2]);out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    for c in channels: print(c.get('title'),c.get('subscribers'),c.get('videoCount'),len(c['videos']),c.get('longComplete'),c.get('shortComplete'),c['errors'])
