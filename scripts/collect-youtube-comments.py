"""Public comment samples, with video attribution based only on explicit text names."""
import concurrent.futures, json, runpy, sys, urllib.request
from pathlib import Path
d=runpy.run_path(str(Path(__file__).with_name('collect-youtube-channels.py')))
page,nodes,txt=d['page'],d['nodes'],d['txt']
def post(endpoint,version):
    payload={'context':{'client':{'clientName':'WEB','clientVersion':version,'hl':'ko','gl':'KR'}},'continuation':endpoint['continuationCommand']['token']}
    api=endpoint['commandMetadata']['webCommandMetadata']['apiUrl']
    return json.load(urllib.request.urlopen(urllib.request.Request('https://www.youtube.com'+api,data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'}),timeout=20))
def collect(v):
    out={**v,'comments':[],'attribution':[],'commentStatus':'unavailable'}
    try:
        data=page('https://www.youtube.com/watch?v='+v['id'])
        version=data['_clientVersion']
        info=next(nodes(data,'videoSecondaryInfoRenderer'),{})
        desc=txt(info.get('attributedDescription',{})) or txt(info.get('description',{}))
        out['attribution']=[name for name in ['조선별','곽지명'] if name in (v['title']+' '+desc)]
        sections=[s for s in nodes(data,'itemSectionRenderer') if s.get('sectionIdentifier')=='comment-item-section' or s.get('targetId')=='comments-section']
        endpoints=list(nodes(sections,'continuationEndpoint'))
        if not endpoints: return out
        comments=post(endpoints[0],version)
        # The initial response may contain only a comment sort header and continuation.
        if not list(nodes(comments,'commentEntityPayload')) and not list(nodes(comments,'commentRenderer')):
            more=list(nodes(comments,'continuationEndpoint'))
            if more: comments=post(more[0],version)
        for c in nodes(comments,'commentEntityPayload'):
            props=c.get('properties',{}); content=props.get('content',{}).get('content','')
            if content and not c.get('author',{}).get('isCreator'):
                out['comments'].append({'id':props.get('commentId'),'text':content})
        for c in nodes(comments,'commentRenderer'):
            if not c.get('authorIsChannelOwner'): out['comments'].append({'id':c.get('commentId'),'text':txt(c.get('contentText',{}))})
        out['commentStatus']='sampled'
    except Exception as e: out['error']=str(e)
    return out
if __name__=='__main__':
    data=json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    for c in data['channels']:
        shared='볼보러가자' in (c.get('title') or '')
        sample=c['videos'] if shared else [v for kind in ['long','short'] for v in [x for x in c['videos'] if x['kind']==kind][:3]]
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: c['reviewedVideos']=list(pool.map(collect,sample))
        print(c['title'],len(sample),sum(len(v['comments']) for v in c['reviewedVideos']),flush=True)
    Path(sys.argv[2]).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
