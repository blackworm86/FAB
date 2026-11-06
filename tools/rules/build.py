"""Build each game's rules reference (data/<game>/rules.json) from its rulebooks.

Every game gets its own edition of the Series Rules and its exclusive rules, scenarios and examples, verbatim:
text PDFs go through extract.py; the scanned Golan '73 Play Book comes from its proofread transcription (Markdown).
Small corrections the extraction cannot make (a label printed out of line, a word broken oddly) are in corrections.json.
Run: python3 -I tools/rules/build.py   (needs poppler's pdftohtml)
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
import extract as X

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
D = lambda *p: os.path.join(ROOT, *p)
# A book: what the reader shows as one tab. `parts` are the sources, in order.
GAMES = {
  'bulge': [
    dict(id='aids', title='Player Aids', sub='The Bulge player aid cards A–E', parts=[dict(aid='tools/rules/bulge-aids.md', label='The Bulge player aid cards')]),
    dict(id='series', title='Series Rules', sub='Fast Action Battles Series Rule Book', parts=[dict(pdf='docs/rules/FastActionBattleBulge.pdf')]),
    dict(id='exclusive', title='Exclusive Rules', sub='The Bulge Play Book, 11.0–19.0', parts=[dict(pdf='docs/rules/FAB_play-book_final.pdf', pages='2-24', only=(11, 19))]),
    dict(id='scenarios', title='Scenarios', sub='The Bulge Play Book, 24.0', parts=[dict(pdf='docs/rules/FAB_play-book_final.pdf', pages='2-24', only=(24, 24))]),
    dict(id='examples', title='Examples & Notes', sub='The Bulge Play Book, 20.0–23.0', parts=[dict(pdf='docs/rules/FAB_play-book_final.pdf', pages='2-24', only=(20, 23))]),
  ],
  'golan73': [
    dict(id='aids', title='Player Aids', sub="Golan '73 player aid cards", parts=[dict(aid='tools/rules/golan73-aids.md', label="Golan '73 player aid cards")]),
    dict(id='series', title='Series Rules', sub="Golan '73 Series Rule Book (2016)", parts=[dict(pdf='docs/games/golan73/rules/FAB-G_Rules_FINAL.pdf', pages='1-22', only=(1, 10))]),
    dict(id='exclusive', title='Exclusive Rules', sub="Golan '73 Rule Book, 11.0–19.0", parts=[dict(pdf='docs/games/golan73/rules/FAB-G_Rules_FINAL.pdf', pages='1-22', only=(11, 19))]),
    dict(id='scenarios', title='Scenarios', sub="Play Book 22.0; Battle for Nafakh (22.4) and Operation Al-Owda (20.3) sheets", parts=[
      dict(md='tools/rules/golan73-playbook.md', only=(22, 22)),
      dict(pdf='docs/games/golan73/scenarios/Battle_for_Nafakh_Scenario_Docs.pdf', pages='2-3', only=(22, 22), label='Battle for Nafakh sheet'),
      dict(pdf='docs/games/golan73/scenarios/FAB_Golan73_Al-Owda_ScenarioRules.pdf', pages='1-2', only=(20, 20), label='Al-Owda sheet')]),
    dict(id='optional', title='Additional Optional Rules', sub='From the Battle for Nafakh and Al-Owda scenario sheets', parts=[
      dict(pdf='docs/games/golan73/scenarios/Battle_for_Nafakh_Scenario_Docs.pdf', pages='2-3', only=(18, 18), label='Battle for Nafakh sheet', prefix='N'),
      dict(pdf='docs/games/golan73/scenarios/FAB_Golan73_Al-Owda_ScenarioRules.pdf', pages='1-2', only=(18, 18), label='Al-Owda sheet', prefix='A')]),
    dict(id='examples', title='Examples & Notes', sub="Golan '73 Play Book, 20.0, 21.0, 23.0", parts=[dict(md='tools/rules/golan73-playbook.md', only=(20, 23), skip=(22,))]),
  ],
  'sicily': [                                                                       # Sicily plays the 2016 series rules (the Golan '73 rule book); its own books are scans, transcribed
    dict(id='series', title='Series Rules', sub="Fast Action Battles Series Rules (2016, Golan '73 Rule Book)", parts=[dict(pdf='docs/games/golan73/rules/FAB-G_Rules_FINAL.pdf', pages='1-22', only=(1, 9))]),
    dict(id='exclusive', title='Exclusive Rules', sub='Sicily Rule Book, 10.0–19.0', parts=[dict(md='tools/rules/sicily-rules.md', only=(10, 19), label='Sicily Rule Book')]),
    dict(id='scenarios', title='Scenarios', sub='Sicily Play Book, 22.0', parts=[dict(md='tools/rules/sicily-playbook.md', only=(22, 22), label='Sicily Play Book')]),
    dict(id='examples', title='Examples & Notes', sub='Sicily Play Book, 20.0, 21.0, 23.0', parts=[dict(md='tools/rules/sicily-playbook.md', only=(20, 23), skip=(22,), label='Sicily Play Book')]),
  ],
}

# The book's own printed index (Series Rules; in Golan '73 it covers the exclusive rules too). Pages from the table of contents.
INDEXES = {'bulge': ('docs/rules/FastActionBattleBulge.pdf', 11, 12), 'golan73': ('docs/games/golan73/rules/FAB-G_Rules_FINAL.pdf', 23, 24),
           'sicily': ('docs/games/golan73/rules/FAB-G_Rules_FINAL.pdf', 23, 24, 9)}       # Sicily: the 2016 index, series rules only (its 11.0+ entries are Golan's)

def md_sections(path, label):
    """The proofread transcription: '## 22.14 Title' headings, paragraphs, '- ' items, Markdown tables."""
    secs, cur, para = [], None, []
    def flush():
        if cur is not None and para: cur['paras'].append(' '.join(para).strip())
        para.clear()
    for line in open(D(path), encoding='utf-8').read().splitlines():
        h = re.match(r'^#{2,3}\s+(\d{1,2}\.\d{1,2}[a-z]?)\s+(.*)$', line)
        if h:
            flush(); cur = dict(id=h.group(1), title=h.group(2).strip(), source=label, paras=[]); secs.append(cur); continue
        ex = re.match(r'^#{3}\s+Example\s+(\d+)\s*[—–:-]\s*(.*)$', line)
        if ex:                                                                            # each example of play is its own entry
            flush(); cur = dict(id=f'Ex {ex.group(1)}', title=ex.group(2).strip(), source=label, paras=[]); secs.append(cur); continue
        h3 = re.match(r'^#{3}\s+(.*)$', line)
        if h3 and cur is not None: flush(); cur['paras'].append('**' + h3.group(1).strip() + '**'); continue
        if cur is None: continue
        if not line.strip(): flush(); continue
        if line.startswith('- '): flush(); cur['paras'].append('• ' + line[2:].strip()); continue
        if line.startswith('|'): flush(); cur['paras'].append(line.strip()); continue                 # a table row; rows stay separate
        if line.startswith('> '): flush(); cur['paras'].append('_' + line[2:].strip() + '_'); continue
        para.append(line.strip())
    flush()
    return secs

def aid_sections(path, label):
    """The player-aid cards, transcribed: '# Card title' + 'Card: C', then '## Box title' per box; boxes become C.1, C.2 ... under 'C.0'."""
    secs, cur, para, card, n = [], None, [], None, 0
    def flush():
        if cur is not None and para: cur['paras'].append(' '.join(para).strip())
        para.clear()
    lines = open(D(path), encoding='utf-8').read().splitlines()
    for k, line in enumerate(lines):
        h1 = re.match(r'^#\s+(.*)$', line)
        if h1:
            flush(); title = h1.group(1).strip(); card = None
            for j in range(k + 1, min(k + 4, len(lines))):
                m = re.match(r'^Card:\s*([A-Z])', lines[j]); card = m.group(1) if m else card
            card = card or chr(65 + len([x for x in secs if x['id'].endswith('.0')])); n = 0
            cur = dict(id=f'{card}.0', title=X.tidy_title(title), source=label, paras=[]); secs.append(cur); continue
        if re.match(r'^Card:\s*[A-Z]', line): continue
        h3 = re.match(r'^###\s+(.*)$', line)
        if h3 and cur is not None: flush(); cur['paras'].append('### ' + h3.group(1).strip()); continue            # a sub-heading inside the box (a phase under its turn bar)
        h2 = re.match(r'^##\s+(.*)$', line)
        if h2 and card:
            flush(); n += 1; cur = dict(id=f'{card}.{n}', title=X.tidy_title(h2.group(1).strip()), source=label, paras=[]); secs.append(cur); continue
        if cur is None: continue
        if not line.strip(): flush(); continue
        if re.match(r'^\s*[-*]\s', line): flush(); cur['paras'].append(('• ' if not line.startswith(' ') else '• ◦ ') + re.sub(r'^\s*[-*]\s+', '', line)); continue
        if re.match(r'^\s*\d+\.\s', line): flush(); cur['paras'].append(line.strip()); continue
        if line.startswith('|'): flush(); cur['paras'].append(line.strip()); continue
        para.append(line.strip())
    flush()
    return secs

def main_of(sid): return 23 if sid.startswith('Ex ') else int(sid.lstrip('NA').split('.')[0])
def correct(secs, fixes):
    for s in secs:
        for i, p in enumerate(s['paras']):
            for a, b in fixes: p = p.replace(a, b)
            s['paras'][i] = p
    return secs

def build(game):
    fixes = json.load(open(D('tools/rules/corrections.json'), encoding='utf-8'))
    books = []
    for b in GAMES[game]:
        secs = []
        for part in b['parts']:
            label = part.get('label') or b['sub']
            if 'aid' in part:
                if not os.path.exists(D(part['aid'])): print('  missing', part['aid']); continue
                got = aid_sections(part['aid'], label)
                for x in got: x['title'] = fixes.get('titles', {}).get(x['title'], x['title'])
                secs += got; continue
            if 'md' in part:
                if not os.path.exists(D(part['md'])): print('  missing', part['md']); continue
                got = md_sections(part['md'], label)
            else:
                first, last = map(int, part.get('pages', '1-999').split('-'))
                X.VOCAB.clear(); X.HYPH.clear()
                got = X.sections(X.extract(D(part['pdf']), first, last), label)
            lo, hi = part.get('only', (0, 99)); skip = part.get('skip', ())
            got = [s for s in got if lo <= main_of(s['id']) <= hi and main_of(s['id']) not in skip]
            got = [s for s in got if '(Continued)' not in s['title']]                      # a sheet's '22.0 Scenarios (Continued)' heading
            for s in got: s['title'] = fixes.get('titles', {}).get(s['title'], s['title'])
            for s in got:
                s.pop('page', None); s['source'] = label
                if part.get('prefix'): s['ref'] = s['id']; s['id'] = part['prefix'] + s['id']
            got = correct(got, fixes.get(part.get('pdf') or part.get('md'), []))
            secs += got
        upd = fixes.get('updates', {}).get(game, {})
        newer = {}
        if upd.get('_series2016') and b['id'] == 'series':                               # rules this game plays by the 2016 series edition (Golan '73 Rule Book)
            g73 = json.load(open(D('data', 'golan73', 'rules.json'), encoding='utf-8'))
            newer = {x['id']: x['paras'] for x in next(k for k in g73['books'] if k['id'] == 'series')['sections'] if x['id'] in upd['_series2016']}
        for x in secs:
            if x['id'] in newer:
                was = [re.sub(r'\*\*\s*', '', w).replace('_', '').strip() for w in x['paras']]
                x['paras'] = newer[x['id']] + ["_Updated to the 2016 series rules (Golan '73 Rule Book), which this game follows. The Bulge Rule Book read:_"] + ['_' + w + '_' for w in was if w]
            u = upd.get(x['id'])
            if u and u.get('note') and b['id'] == u.get('book'): x['paras'] = x['paras'] + ['_Note: ' + u['note'] + '_']
        books.append(dict(id=b['id'], title=b['title'], sub=b['sub'], sections=secs))
    pdf, a, z, *top = INDEXES[game]
    ids = {sec['id'] for bk in books for sec in bk['sections']}
    index = X.index_of(D(pdf), a, z)
    for e in index:
        for sub in e['subs']: sub['refs'] = [r for r in sub['refs'] if (re.sub(r'[a-z]$', '', r) in ids or r in ids) and (not top or (r.split('.')[0].isdigit() and int(r.split('.')[0]) <= top[0]))]
    out = dict(game=game, books=books, index=[e for e in index if any(sub['refs'] for sub in e['subs']) or e['see']], indexSource=os.path.basename(pdf))
    path = D('data', game, 'rules.json'); json.dump(out, open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    n = sum(len(b['sections']) for b in books)
    print(game, n, 'sections', os.path.getsize(path) // 1024, 'KB', [(b['id'], len(b['sections'])) for b in books])

if __name__ == '__main__':
    for g in (sys.argv[1:] or GAMES): build(g)
