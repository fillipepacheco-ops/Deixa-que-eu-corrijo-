import json,sys
y=sys.argv[1]; lo,hi=int(sys.argv[2]),int(sys.argv[3])
for q in json.load(open(f'out1/{y}.json')):
    if not lo<=q['number']<=hi: continue
    ps=[b['s'] for b in q['statement'] if b['t']=='p']
    if q.get('shared') and q['number']!=int(q['shared'].split('-')[0]):
        ps=ps[-1:]
    srcs=[b['s'] for b in q['statement'] if b['t']=='p' and b.get('src')]
    first=' '.join(' '.join(ps).split()[:12])
    last=' '.join(ps[-1].split()[-14:]) if ps else ''
    src=(srcs[0][:40] if srcs else '')
    op=' '.join(b['s'] for b in q['options'][0]['blocks'] if b['t']=='p')[:30]
    print(f"{q['key']}: {first} … {last} [{src}] A:{op}")
