"""Writes the blank redraw sheets (docs/maps/vector/blank/*.svg): one empty square per counter, block, marker and map symbol, with what it is written beside it."""
import json, html, os
c = json.load(open('data/bulge/counters.json')); u = json.load(open('data/bulge/units.json'))
ECH = {'de_5pz': '5th Panzer Army (grey)', 'de_6pz': '6th Panzer Army (purple)', 'de_7a': '7th Army (blue)', 'de_sr': 'German Strategic Reserve (orange)', 'us_1a': 'US First Army (light green)', 'us_3a': 'US Third Army (dark green)', 'us_sr': 'US Strategic Reserve (light blue)', 'br_xxx': 'British XXX Corps (red)', 'german': 'German', 'allied': 'Allied', 'none': 'neutral', '': ''}
KIND = {
 'artillery': ('Artillery asset', 'Assigned to a battle; fires before the ground units (6.25, 6.26). Printed: a dot in a square.'),
 'rocket_artillery': ('Rocket artillery asset', 'Fires like artillery; one regular and one rocket per German army (16.12). Printed: an arrow in a square.'),
 'engineer': ('Engineer asset', 'Admin Phase: blow or repair bridges, build field works, roadblocks (4.34); in battle may remove field works (6.33).'),
 'armor_asset': ('Armor battle asset', 'Joins a battle and fires in the ground-fire steps; can take the first hit (6.4).'),
 'infantry_asset': ('Infantry battle asset', 'Joins a battle and fires in the ground-fire steps; can take the first hit (6.4).'),
 'task_force': ('Task Force (Allied)', 'Allied asset placed in an entry area when it arrives.'),
 'fuel': ('Fuel asset (German)', 'Spent when a German unit moves more than 3 MP or strategic-moves.'),
 'fuel_bid': ('Fuel bid marker', 'Optional rule 18.2: fuel bidding.'),
 'command_staff': ('Command / Staff asset', 'Staff functions in the Admin Phase (8.3): boundary crossing, pooled assets, intelligence, replacements, reserves.'),
 'replacement_inf': ('Infantry replacements (event)', 'Admin Phase: +1 step to a supplied infantry unit of the same Higher Echelon (8.31).'),
 'replacement_arm': ('Armor replacements (event)', 'Admin Phase: +1 step to a supplied armor unit of the same Higher Echelon (8.31).'),
 'rebuild_or_replace_inf': ('Rebuild or replace, infantry (event)', 'Return an eliminated infantry unit, or add a step.'),
 'rebuild_or_replace_arm': ('Rebuild or replace, armor (event)', 'Return an eliminated armor unit, or add a step.'),
 'event_arriving_regiment': ('Arriving regiment (event)', 'Brings an eliminated division back as one step, or adds a step (17.23).'),
 'special_action_event': ('Special Action (event)', 'One-use Special Action: reinforce or retreat in a battle, rally, quality replacement.'),
 'event_release': ('Release (event)', 'Event played in the Admin Phase: a unit enters at area 4 or 6.'),
 'event_greif_bridge': ('Greif Team: Bridge (event)', 'Placed on a river boundary; first German unit crossing takes the bridge (17.1).'),
 'event_greif_interdict': ('Greif Team: Interdict (event)', 'Marks an Allied unit as interdicted (17.1).'),
 'event_bodenplatte': ('Operation Bodenplatte (event)', 'German air strike on the Allied Air Missions (17).'),
 'event_delayed_response': ('Delayed Response (event)', 'No effect when drawn.'),
 'air_mission': ('Air Mission (Allied)', 'Artillery or support in a battle; interdiction or air supply (17.2).'),
 'marker': ('Map marker', 'Placed on the board: disordered, recovering, exploitation, boundary crossing, pooled assets.'),
 'reserve_marker': ('Reserve marker', 'Marks a block held in reserve for a zone.'),
 'garrison': ('Garrison counter', 'A fixed defender that cannot retreat; counts as an asset.'),
 'marker_vp': ('Victory point marker', 'Shows a victory-point area.'),
}
items = []
for x in c:
    t, desc = KIND.get(x['kind'], (x['kind'], '')); t2 = x.get('turn'); ts = ('Turn ' + str(t2)) if isinstance(t2, int) else ('Start of game' if t2 in ('S', None) else str(t2))
    items.append(dict(g='Chits and counters', id=x['id'], title=x['name'], l2=f"{t}", l4=ECH.get(x.get('echelon', ''), x.get('echelon', '')), l3=f"{ts} · copies {x.get('copies', 1)}" + (' · ' + x['quality'] if x.get('quality') else ''), desc=desc))
for x in u:
    steps = x.get('steps', 1); q = ', '.join(x.get('quality_by_step', []))
    where = f"starts in area {x['start_area']}" if x.get('start_area') else f"arrives turn {x.get('arrival_turn', '?')}"
    items.append(dict(g='Unit blocks (label stickers)', id=x['id'], title=x['name'], l2=f"{x['side'].title()} {x.get('cls', x.get('kind', ''))} · {x.get('symbol', '')} · {steps} step(s)", l3=where, l4=ECH.get(x.get('echelon', ''), x.get('echelon', '')), desc=f"Block label, one edge per step. Steps by strength: {q or 'n/a'}."))
MK = [('X', 'Blown bridge', 'Marks a destroyed bridge on a river boundary.'), ('FW', 'Field works', 'Defender bonus in the area (gear).'), ('RA', 'River assault', 'Marks an attack across a river (5.35e).'), ('RB', 'Road block', 'Roadblock placed by an engineer (4.34).'), ('DIS', 'Disordered', 'Block is disordered (capital D).'), ('REC', 'Recovering', 'Block is recovering from disorder.'), ('E', 'Exploitation', 'Armor that may move in the Breakthrough phase.'), ('B', 'Boundary crossing', 'Pre-authorized boundary crossing (14.62a).'), ('P', 'Pooled assets', 'Allied assets pooled in an area (14.62b).'), ('R5', 'Reserve, Zone 5', 'German reserve marker.'), ('R6', 'Reserve, Zone 6', 'German reserve marker.'), ('R7', 'Reserve, Zone 7', 'German reserve marker.'), ('A7', 'Reserve, Zone 7 (Allied)', 'Allied reserve marker.'), ('A56', 'Reserve, Zones 5/6 (Allied)', 'Allied reserve marker.'), ('GI', 'Greif interdict', 'Greif Team interdict marker on a block.'), ('G', 'Greif bridge', 'Greif Team bridge marker on a river boundary.'), ('AIR', 'Interdiction', 'Air interdiction marker on an area.'), ('AS', 'Air supply', 'Air supply marker on an area.')]
for i, t, d in MK: items.append(dict(g='Map markers (placed on the board)', id=i, title=t, l2='Map marker', l3='', desc=d))
for i, t, d in [('vp-allied', 'VP symbol, Allied-held objective', 'Black cross on the map.'), ('vp-german', 'VP symbol, German-held objective', 'Blue circle with a star.'), ('vp-mutual', 'VP symbol, mutual objective', 'Yellow star on red.'), ('tdn0', 'TDN 0 plate', 'Area number plate, no terrain defence.'), ('tdn1', 'TDN 1 plate', 'Area number plate, TDN 1.'), ('tdn2', 'TDN 2 plate', 'Area number plate, TDN 2.'), ('tdn3', 'TDN 3 plate', 'Area number plate, TDN 3.'), ('entry-german', 'Entry strip, German', 'Entering-zone strip with its letter.'), ('entry-allied', 'Entry strip, Allied', 'Entering-zone strip with its letter.')]:
    items.append(dict(g='Map symbols', id=i, title=t, l2='Map symbol', l3='', desc=d))
def wrap(s, n):
    out = []; cur = ''
    for w in s.split():
        if len(cur) + len(w) + 1 > n and cur: out.append(cur); cur = w
        else: cur = (cur + ' ' + w).strip()
    if cur: out.append(cur)
    return out
def sheet(group, path, cols=5, cell=200):
    its = [i for i in items if i['g'] == group]; pad = 30; H = 150; rows = (len(its) + cols - 1) // cols; W = cols * (cell + pad) + pad; Ht = rows * (cell + H + pad) + pad + 60
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {Ht}" width="{W}" height="{Ht}"><title>{html.escape(group)}</title><rect id="background" width="{W}" height="{Ht}" fill="#ffffff"/><text x="{pad}" y="40" font-family="Arial" font-size="26" font-weight="700">{html.escape(group)}: {len(its)} to redraw. Draw inside each square (group "art-..."); the text is in groups "notes-..." and can be deleted.</text>']
    for n, it in enumerate(its):
        x = pad + (n % cols) * (cell + pad); y = 60 + pad + (n // cols) * (cell + H + pad); iid = ''.join(ch if ch.isalnum() or ch in '-_' else '-' for ch in it['id'])
        o.append(f'<g id="{iid}"><g id="art-{iid}"><rect x="{x}" y="{y}" width="{cell}" height="{cell}" rx="8" fill="#ffffff" stroke="#999" stroke-width="1.5" stroke-dasharray="6 4"/><path d="M{x + cell / 2} {y + 8}V{y + cell - 8}M{x + 8} {y + cell / 2}H{x + cell - 8}" stroke="#eee" stroke-width="1"/></g><g id="notes-{iid}" font-family="Arial" fill="#222"><text x="{x}" y="{y + cell + 20}" font-size="15" font-weight="700">{html.escape(it["title"][:26])} <tspan fill="#888" font-weight="400">[{html.escape(it["id"])}]</tspan></text><text x="{x}" y="{y + cell + 38}" font-size="11.5" fill="#444">{html.escape(it["l2"])}</text><text x="{x}" y="{y + cell + 53}" font-size="11.5" fill="#444">{html.escape(it["l3"])}</text><text x="{x}" y="{y + cell + 67}" font-size="11.5" fill="#444">{html.escape(it.get("l4", ""))}</text>')
        for k, line in enumerate(wrap(it['desc'], 44)[:4]): o.append(f'<text x="{x}" y="{y + cell + 86 + k * 13}" font-size="10.5" fill="#666">{html.escape(line)}</text>')
        o.append('</g></g>')
    o.append('</svg>'); open(path, 'w').write(''.join(o)); print(path, len(its))
os.makedirs('docs/maps/vector/blank', exist_ok=True)
for g, n in [('Chits and counters', 'chits'), ('Unit blocks (label stickers)', 'blocks'), ('Map markers (placed on the board)', 'markers'), ('Map symbols', 'map-symbols')]: sheet(g, f'docs/maps/vector/blank/blank-{n}.svg')
