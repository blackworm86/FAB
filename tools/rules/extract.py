"""Rulebook PDF -> structured sections (rule number, title, paragraphs) for the in-game rules reference.

Reads `pdftohtml -xml` output (text runs with position, font and bold/italic), rebuilds the two-column reading
order, splits paragraphs, finds the numbered sections and keeps bold terms, italics and rule references.
Usage: python3 -I extract.py <pdf> <out.json> [--pages a-b] [--source "label"]
"""
import html, json, re, subprocess, sys, tempfile, os

BULLET = re.compile(r'^\s*[•●■▪◆]')
NUM = re.compile(r'^(\d{1,2}\.\d{1,3}[a-z]?)\s+(.*)$')
REF = re.compile(r'\((?:see\s+)?(\d{1,2}\.\d{1,3}[a-z]?(?:\s*[,&]\s*\d{1,2}\.\d{1,3}[a-z]?)*)\)')

def runs_of(pdf, first, last):
    with tempfile.TemporaryDirectory() as d:
        out = os.path.join(d, 'x')
        cmd = ['pdftohtml', '-xml', '-i', '-q', '-nodrm', '-f', str(first), '-l', str(last), pdf, out]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        xml = open(out + '.xml', encoding='utf-8', errors='replace').read()
    fonts = {m.group(1): float(m.group(2)) for m in re.finditer(r'<fontspec id="(\d+)" size="([\d.]+)"', xml)}
    pages = []
    for pm in re.finditer(r'<page number="(\d+)"[^>]*height="(\d+)" width="(\d+)">(.*?)</page>', xml, re.S):
        n, H, W, body = int(pm.group(1)), int(pm.group(2)), int(pm.group(3)), pm.group(4)
        runs = []
        for t in re.finditer(r'<text top="(-?\d+)" left="(-?\d+)" width="(\d+)" height="(\d+)" font="(\d+)">(.*?)</text>', body, re.S):
            top, left, w, h, f, inner = int(t.group(1)), int(t.group(2)), int(t.group(3)), int(t.group(4)), t.group(5), t.group(6)
            bold, ital = '<b>' in inner, '<i>' in inner
            txt = html.unescape(re.sub(r'<[^>]+>', '', inner))
            if not txt.strip() or w == 0: continue                    # rotated margin tabs have width 0
            runs.append(dict(top=top, left=left, w=w, h=h, size=fonts.get(f, 0), bold=bold, ital=ital, text=txt))
        pages.append((n, H, W, runs))
    return pages

def lines_of(page):
    n, H, W, runs = page
    mid = W / 2
    keep = [r for r in runs if 40 < r['top'] < H - 60 and 0 <= r['left'] and r['left'] + r['w'] <= W - 40 and not re.search(r'©|GMT Games, LLC', r['text']) and not re.match(r'^\s*(Page\s*\d*|Version [\d.]+|Enjoy!|FAB: Golan.\s?73 .*Scenario\s*)\s*$', r['text'])]
    for r in keep: r['col'] = 0 if r['left'] + r['w'] / 2 < mid else 1
    wide = [r for r in keep if r['w'] > W * 0.6]                      # a full-width line (titles spanning both columns)
    for r in wide: r['col'] = -1
    keep.sort(key=lambda r: (r['col'] if r['col'] >= 0 else -1, r['top'], r['left']))
    lines = []
    for r in keep:
        L = lines[-1] if lines else None
        if L and L['col'] == r['col'] and abs(L['top'] - r['top']) <= 4: L['runs'].append(r)
        else: lines.append(dict(col=r['col'], top=r['top'], left=r['left'], runs=[r]))
    for L in lines:
        L['runs'].sort(key=lambda r: r['left'])
        L['h'] = max(r['h'] for r in L['runs']); L['size'] = max(r['size'] for r in L['runs'])
    return lines

KEEP = {'and', 'as', 'at', 'a', 'all', 'also', 'any', 'are', 'after', 'against', 'an', 'vs', 'vs.', 'via', 'level', 'liable', 'line', 'lines', 'list', 'loss', 'losses', 'left', 'like', 'limit', 'limits', 'last'}
def fix_caps(t):
    """Bold small-caps faces store A, V, L, X and J as lower case ('aREaS', 'admin Phase'): restore them."""
    def word(m):
        w = m.group(0); letters = [c for c in w if c.isalpha()]
        if len(letters) > 1 and sum(c.isupper() for c in letters) * 2 >= len(letters): return w.upper()
        if re.search(r'[a-z][A-Z]', w): return w[:1].upper() + w[1:].lower()                     # another small-caps face: 'geRmaN'
        if len(w) > 1 and w[0] in 'avlxj' and w.lower() not in KEEP: return w[0].upper() + w[1:]
        return w
    return re.sub(r"[A-Za-z’']+", word, t)
def md(runs):
    """Runs -> light markup: **bold**, _italic_."""
    out = ''
    for r in runs:
        t = r['text']
        if r['bold'] and t.strip(): out += '**' + fix_caps(t) + '**'
        elif r['ital'] and t.strip(): out += '_' + t + '_'
        else: out += t
    out = re.sub(r'\*\*\s*\*\*', ' ', out).replace('****', '')
    return re.sub(r'[ \t]+', ' ', out).strip()

VOCAB = set()
HYPH = set()          # words printed with a hyphen inside a line somewhere in the book ('infantry-class'): keep that hyphen at a line end too
def join(a, b):
    if re.search(r'[a-z]-$', a) and re.match(r'^[a-z]', b):
        x, y = re.search(r'([A-Za-z]+)-$', a).group(1).lower(), re.match(r'[A-Za-z]+', b).group(0).lower()
        keep = (x + y) not in VOCAB and (f'{x}-{y}' in HYPH or (len(x) >= 3 and len(y) >= 3 and x in VOCAB and y in VOCAB))
        return a + b if keep else a[:-1] + b                                          # a word broken at the line end, or a real compound
    return a + ' ' + b

def extract(pdf, first, last, body_size=None):
    pages = runs_of(pdf, first, last)
    plines = [lines_of(p) for p in pages]
    for lines in plines:                                                                  # words seen whole inside a line (not at its ends, where they may be fragments)
        for L in lines:
            toks = re.sub(r'[*_]', '', md(L['runs'])).split()[1:-1]
            for t in toks:
                t = t.strip('.,;:()[]“”"‘’!?—–').lower()
                if re.fullmatch(r'[a-z]+-[a-z]+', t): HYPH.add(t)
                elif re.fullmatch(r'[a-z]+', t): VOCAB.add(t)
    allsizes = [r['size'] for p in pages for r in p[3]]
    body = body_size or max(set(allsizes), key=allsizes.count)
    paras = []            # (page, kind, text, size)
    cur = None; prev = None
    for page, lines in zip(pages, plines):
        for L in lines:
            text = md(L['runs']); plain = re.sub(r'[*_]', '', text)
            first_bold = L['runs'][0]['bold']
            big = L['size'] > body * 1.12
            gap = prev is not None and (L['col'] != prev['col'] or L['top'] - prev['top'] > prev['h'] * 1.55)
            starts = (first_bold and re.match(r'^\s*\S', L['runs'][0]['text'])) or BULLET.match(plain) or NUM.match(plain) and (first_bold or big) or big
            moved = prev is not None and (L['col'] != prev['col'] or L is lines[0])                          # the paragraph goes on in the next column or page
            carry = moved and cur is not None and not starts and re.match(r'^[a-z(]', plain) and not re.search(r'[.:!?]\*{0,2}$', cur['text'])
            new = not carry and (cur is None or gap or starts or (prev is not None and big != prev.get('big')))
            if new:
                cur = dict(page=page[0], text=text, big=big, numbered=bool(NUM.match(plain)) and (first_bold or big)); paras.append(cur)
            else: cur['text'] = join(cur['text'], text)
            L['big'] = big; prev = L
    return paras

SMALL = {'a', 'an', 'and', 'or', 'the', 'of', 'in', 'on', 'to', 'for', 'at', 'by', 'vs', 'with', 'from', 'then'}
ACRONYM = {'US', 'SAM', 'SAMS', 'EW', 'KG', 'HQ', 'SSM', 'FAB', 'IDF', 'II', 'III', 'SA', 'MP', 'MPS', 'VP', 'VPS', 'TDN', 'OOB'}
def tidy_title(t):
    t = re.sub(r'\s+', ' ', t).strip(' .:')
    words = re.findall(r"[A-Za-z’']+", t)
    odd = any(re.search(r'[a-z][A-Z]|^[A-Z]{2,}[a-z]', w) or (len(w) > 2 and w.isupper() and w.upper() not in ACRONYM) or (w[:1].islower() and w.lower() not in SMALL and w.lower() not in ('der', 'von', 'strat')) for w in words)
    if odd:                                                                                  # set in caps or a small-caps face: title case it
        def one(i, w):
            core = re.sub(r'[^A-Za-z]', '', w)
            if core.upper() in ACRONYM or w.upper() == '(AT)': return w.upper()
            if re.match(r'^\d+(st|nd|rd|th)$', w): return w
            if i and w in SMALL | {'der', 'von'}: return w
            return re.sub(r'[a-z]', lambda m: m.group(0).upper(), w, count=1)
        t = ' '.join(one(i, w) for i, w in enumerate(t.lower().split(' ')))
        t = re.sub(r'\bStrat-Moves?\b', lambda m: m.group(0).replace('M', 'm'), t)
    return t
def split_bullets(text):
    parts = [x.strip() for x in re.split(r'\s*[•●■▪◆]\s*', text)]
    head, items = parts[0], [x for x in parts[1:] if x]
    return ([head] if head else []) + ['• ' + x for x in items]
def sections(paras, source):
    secs, cur = [], None
    for p in paras:
        plain = re.sub(r'[*_]', '', p['text'])
        if plain.strip().upper() == 'INDEX': break                                       # the printed index follows: it is read on its own (index_of)
        m = NUM.match(plain)
        if p['numbered'] and m:
            num, rest = m.group(1), m.group(2)
            # title: the bold run after the number (run-in head), or the whole line for a stand-alone heading
            t = re.match(r'^\*\*\s*' + re.escape(num) + r'\s*(.*?)\*\*(.*)$', p['text'])
            if t: title, body = t.group(1).strip(), t.group(2).strip()
            else: title, body = (rest.strip(), '') if p['big'] or len(rest) < 70 else (rest.split('.')[0], rest)
            title = re.sub(r'\s*\.{3,}.*$', '', title).strip(' .')          # table of contents dot leaders
            if re.search(r'\.\s?\.\s?\.', plain): continue                    # a table of contents line
            if re.match(r'^N/?A$', title.strip()): cur = None; continue                      # a placeholder ('22.1 N/A': that rule is elsewhere)
            cur = dict(id=num, title=tidy_title(title), page=p['page'], source=source, paras=[])
            secs.append(cur)
            if body: cur['paras'] += split_bullets(body)
            continue
        if cur is None: continue
        cur['paras'] += split_bullets(p['text'])
    ids = [x['id'] for x in secs]
    return [x for i, x in enumerate(secs) if x['paras'] or ids.count(x['id']) == 1 or i == len(ids) - 1 - ids[::-1].index(x['id'])]

if __name__ == '__main__':
    pdf, out = sys.argv[1], sys.argv[2]
    a = sys.argv.index('--pages') if '--pages' in sys.argv else -1
    first, last = (map(int, sys.argv[a + 1].split('-')) if a > 0 else (1, 999))
    s = sys.argv.index('--source') if '--source' in sys.argv else -1
    src = sys.argv[s + 1] if s > 0 else os.path.basename(pdf)
    secs = sections(extract(pdf, first, last), src)
    json.dump(secs, open(out, 'w'), indent=1, ensure_ascii=False)
    print(len(secs), 'sections', sum(len(x['paras']) for x in secs), 'paragraphs')

# ---------- the printed index (three narrow columns after an INDEX heading) ----------
REFNUM = re.compile(r'\d{1,2}\.\d{1,3}[a-z]?')
def index_of(pdf, first, last):
    """Index pages -> [{term, subs: [{label, refs}], see: [term]}], as printed."""
    pages = runs_of(pdf, first, last); entries = []; started = False
    for n, H, W, runs in pages:
        runs = [r for r in runs if 40 < r['top'] < H - 60 and 0 <= r['left'] and r['left'] + r['w'] <= W - 40 and not re.search(r'©|GMT Games', r['text'])]
        if not started:
            head = [r for r in runs if r['text'].strip().upper() == 'INDEX']
            if not head: continue
            started = True; runs = [r for r in runs if r['top'] > head[0]['top'] + 4]
        for r in runs: r['col'] = 0 if r['left'] < W * 0.33 else 1 if r['left'] < W * 0.62 else 2
        runs.sort(key=lambda r: (r['col'], r['top'], r['left']))
        lines = []
        for r in runs:
            if lines and lines[-1]['col'] == r['col'] and abs(lines[-1]['top'] - r['top']) <= 4: lines[-1]['runs'].append(r)
            else: lines.append(dict(col=r['col'], top=r['top'], runs=[r]))
        for L in lines:
            L['runs'].sort(key=lambda r: r['left']); bold = L['runs'][0]['bold']
            head = ''.join(r['text'] for r in L['runs'] if r['bold']).strip(); rest = ''.join(r['text'] for r in L['runs'] if not r['bold'])
            if bold and head:
                entries.append(dict(term=fix_caps(head).strip().rstrip(':').strip(), raw=rest))
            elif entries: entries[-1]['raw'] = join(entries[-1]['raw'].rstrip(), rest.strip())
    out = []
    for e in entries:
        raw = re.sub(r'\s+', ' ', e['raw']).strip(); subs, see = [], []
        for part in [p.strip() for p in re.split(r';\s*(?=[A-Za-z_])', raw) if p.strip()]:
            for s in re.findall(r'see\s+([A-Z][^;]*)', part): see += [x.strip().strip('_ ') for x in re.split(r';\s*see\s+|,\s*see\s+', s)]
            part = re.sub(r'_?see\s+[A-Z][^;]*', '', part).strip(' ;_')
            refs = REFNUM.findall(part)
            if not refs: continue
            label = part.split(':')[0].strip() if ':' in part else ''
            subs.append(dict(label=label if not REFNUM.match(label) else '', refs=refs))
        # a term with its own numbers ('Abort Attack: 6.41b'), when nothing else carried them
        out.append(dict(term=e['term'], subs=subs, see=[s for s in see if s]))
    return [e for e in out if e['subs'] or e['see']]
