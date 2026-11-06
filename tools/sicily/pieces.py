"""FAB: Sicily blocks, counters, backs, reinforcements and set-ups, from the Vassal module checked against the printed sheets and cards.

The Vassal module (docs/games/sicily/other/FAB_Sicily.vmod) gives one image per piece and where each piece sits on the three set-up cards
(Allied At Start, Allied Reinforcements, Axis At Start and Reinforcements). It carries no step or quality data, so the facts below
(pips per edge, set-up codes, symbols, pip colours of the chits) were read off the Vassal images and confirmed on the owner's scans
(docs/games/sicily/counters: sticker sheet, counter sheet front and back) and the player aid cards (pages 7, 10, 12 and the Sunrise
Bridge pages 8, 9, 11). The script checks every hand-read entry against the module: image present, number of pieces per image, and the
turn each piece sits at on the cards. It stops on any mismatch.

Run from the repo root, with the module unzipped to a scratch folder (its images are reference only, never committed):
  python3 -I tools/sicily/pieces.py <unzipped vmod> data/sicily [<scratch dir for review.html>]
"""
import sys, os, re, json, html
import xml.etree.ElementTree as ET

VMOD, OUT = sys.argv[1], sys.argv[2]
REVIEW = sys.argv[3] if len(sys.argv) > 3 else None
IMGS = os.path.join(VMOD, 'images')
G, V, E = 'green', 'veteran', 'elite'
ALLIED, AXIS = 'allied', 'axis'
US7, BR8, IT6 = 'us_7th_army', 'br_8th_army', 'it_6th_army'

# ------------------------------------------------------------------ the Vassal module: every piece slot, its image(s) and where it sits
def slots():
    root = ET.parse(os.path.join(VMOD, 'buildFile')).getroot()
    out = []
    def walk(el, anc):
        tag = el.tag.split('.')[-1]
        if tag in ('PieceSlot', 'CardSlot'):
            txt = el.text or ''
            imgs = re.findall(r'[A-Za-z0-9_\-\(\)\'\. +&]+?\.(?:png|jpg)', txt)
            out.append({'name': (el.get('entryName') or '').strip(), 'imgs': imgs, 'protos': re.findall(r'prototype;([^\t\\]+)', txt), 'anc': anc})
            return
        a = dict(tag=tag, name=el.get('name') or el.get('mapName') or '', board=el.get('owningBoard'), x=el.get('x'), y=el.get('y'), loc=el.get('location'))
        for c in el: walk(c, anc + [a])
    walk(root, [])
    return out

def vassal_turn(s):
    """The code a piece carries on the Vassal set-up cards: Inv / S / C / start / turn number / marker box."""
    st = s['anc'][-1]
    board, x, y = st.get('board') or '', int(st['x'] or 0), int(st['y'] or 0)
    if board == 'Allied Forces':
        return {140: 'Inv', 219: 'Inv', 346: 'S', 426: 'S', 553: 'C', 554: 'C', 1017: 'beachhead'}[y]
    if board == 'Allied Reinforcements':
        return int(re.match(r'T(\d)', st['name']).group(1))
    if board.startswith('Axis Forces'):
        if st['tag'] == 'DrawPile': return 'untried'
        if y in (140, 219): return 'start'
        if y in (346, 426): return 'S'
        if y in (606, 607): return 2
        if y == 734: return 3
        if y == 862: return 4
        if y == 989: return 5 if x < 560 else 6
        if y == 1116: return 7 if x < 250 else 8 if x < 650 else 9
    return 'map'

# ------------------------------------------------------------------ blocks (pips read edge by edge: top = full strength; quality_by_step[i] = quality at i+1 steps)
UNITS = []
DIV = {   # division: echelon, name, size, sampled colours from the Vassal faces (stripe behind the unit box, unit box, sticker paper)
    'us_1st_inf': (US7, '1st Infantry Division', 'division', '#f04d3d', '#6f7b49', '#a0b25e'),
    'us_2nd_arm': (US7, '2nd Armored Division', 'division', '#92268f', '#727d42', '#a0b35f'),
    'us_3rd_inf': (US7, '3rd Infantry Division', 'division', '#96784a', '#727b44', '#a1b25f'),
    'us_45th_inf': (US7, '45th Infantry Division', 'division', '#929fa8', '#6d7949', '#a1b25f'),
    'us_82nd_ab': (US7, '82nd Airborne Division', 'division', '#b8e4fb', '#fae04e', '#a1b25f'),
    'us_9th_inf': (US7, '9th Infantry Division', 'division', '#fefbcc', '#6e7a3c', '#a0b35f'),
    'br_1st_cdn': (BR8, '1st Canadian Infantry Division', 'division', '#7ed1f9', '#ff574d', '#e1c08b'),
    'br_5th_inf': (BR8, '5th Infantry Division', 'division', '#ba88bb', '#bda569', '#e2c18c'),
    'br_50th_inf': (BR8, '50th Infantry Division', 'division', '#ccd3db', '#bfa56c', '#e2c289'),
    'br_51st_inf': (BR8, '51st Infantry Division', 'division', '#bfc434', '#b99c64', '#e1bd8b'),
    'br_78th_inf': (BR8, '78th Infantry Division', 'division', '#fef9cf', '#af9c5a', '#e2be8a'),
    'br_1st_ab': (BR8, '1st Airborne Division', 'division', '#0081d2', '#fff231', '#e0bf89'),
    'br_1st_cdn_arm': (BR8, '1st Canadian Armoured Brigade', 'brigade', None, '#fc5140', '#e1c08b'),
    'br_4th_arm': (BR8, '4th Armoured Brigade', 'brigade', None, '#b39f64', '#e2be8a'),
    'br_231st': (BR8, '231st Infantry Brigade', 'brigade', None, '#a49156', '#e2c287'),
    'it_livorno': (IT6, 'Livorno Division', 'division', '#53b7e8', '#cde29d', '#f5951c'),
    'it_assietta': (IT6, 'Assietta Division', 'division', '#977245', '#d1e59e', '#f79518'),
    'it_aosta': (IT6, 'Aosta Division', 'division', '#fff488', '#cbe79c', '#f5921b'),
    'it_napoli': (IT6, 'Napoli Division', 'division', '#ccd4df', '#cde8a3', '#f69417'),
    'it_coastal': (IT6, 'Coastal / Garrison', 'garrison', None, '#c8e5a2', '#f99116'),
    'ge_15th_pg': (IT6, '15th Panzergrenadier Division', 'division', '#f34d41', '#d5d6db', '#b2c3cb'),
    'ge_29th_pg': (IT6, '29th Panzergrenadier Division', 'division', '#ffdf4d', '#d5d6da', '#b2c3cb'),
    'ge_hg': (IT6, 'Hermann Göring Panzer Division', 'division', '#acdef9', '#74bad3', '#b2c3cb'),
}
NATION = {'us': (ALLIED, US7), 'british': (ALLIED, BR8), 'italian': (AXIS, IT6), 'german': (AXIS, IT6)}
CLS = {'inf': 'infantry', 'airborne': 'infantry', 'mountain_inf': 'infantry', 'motorized_inf': 'infantry', 'garrison': 'infantry', 'armor': 'armor', 'mech': 'armor'}

# Exclusive Rules 14.24-14.25: where arriving units are placed (airborne: Airborne Assault box; US: a US beachhead or port box P3 Palermo;
# British: a British beachhead or port boxes P1 Syracuse / P2 Catania; Axis: port box P4 Messina only). Ports only if undamaged and friendly.
def entry_for(nation, symbol):
    if symbol == 'airborne': return ['airborne_assault']
    return {'us': ['us_beachhead', 'P3'], 'british': ['br_beachhead', 'P1', 'P2']}.get(nation, ['P4'])

def unit(id, name, nation, div, symbol, q, img, code, **kw):
    side, ech = NATION[nation]
    e, dname, size, stripe, box, paper = DIV[div]
    d = {'id': id, 'name': name, 'side': side, 'nation': nation, 'echelon': ech, 'symbol': symbol, 'cls': CLS[symbol], 'steps': len(q), 'quality_by_step': q,
         'division': div, 'size': size, 'sticker_code': code}
    if code == 'Inv': d.update(arrival='invasion', arrival_turn=1, entry=entry_for(nation, symbol))
    elif code == 'S*': d.update(arrival='untried_setup')
    elif code.isdigit() and nation in ('us', 'british'): d.update(arrival_turn=int(code), entry=entry_for(nation, symbol))
    elif code.isdigit() and img.startswith('Block_GE_29th'): d.update(arrival_turn=int(code), entry=entry_for(nation, symbol))
    else:  # Axis start area printed in the yellow box (R: starts with a 6th Army reserve marker)
        d.update(start_area=int(code.rstrip('R')))
        if code.endswith('R'): d['start_reserve'] = True
    d.update(kw)
    d['colours'] = {'stripe': stripe, 'box': box, 'sticker': paper}
    d['vassal_images'] = [img]
    d['image'] = None
    UNITS.append(d)

# US 7th Army (olive stickers, dark green wood in Vassal)
unit('US01', '2nd Armored', 'us', 'us_2nd_arm', 'armor', [V, V, V, G], 'Block_US_2nd Arm a.png', 'Inv')
unit('US02', '2nd Armored', 'us', 'us_2nd_arm', 'armor', [V, V, V, G], 'Block_US_2nd Arm b.png', '2')
unit('US03', '1st Infantry', 'us', 'us_1st_inf', 'inf', [V] * 4, 'Block_US_1st Inf a.png', 'Inv')
unit('US04', '1st Infantry', 'us', 'us_1st_inf', 'inf', [V] * 4, 'Block_US_1st Inf a.png', 'Inv')
unit('US05', '3rd Infantry', 'us', 'us_3rd_inf', 'inf', [V] * 4, 'Block_US_3rd Inf a.png', 'Inv')
unit('US06', '3rd Infantry', 'us', 'us_3rd_inf', 'inf', [V] * 4, 'Block_US_3rd Inf a.png', 'Inv')
unit('US07', '45th Infantry', 'us', 'us_45th_inf', 'inf', [V, V, E, E], 'Block_US_45th Inf a.png', 'Inv')
unit('US08', '45th Infantry', 'us', 'us_45th_inf', 'inf', [V, V, E, E], 'Block_US_45th Inf a.png', 'Inv')
unit('US09', '82nd Airborne', 'us', 'us_82nd_ab', 'airborne', [V, V, V, G], 'Block_US_82nd AB a.png', 'Inv')
unit('US10', '82nd Airborne', 'us', 'us_82nd_ab', 'airborne', [V, V, V, G], 'Block_US_82nd AB b.png', '2')
unit('US11', '9th Infantry', 'us', 'us_9th_inf', 'inf', [V, V, G, G], 'Block_US_9th Inf a.png', '3')
unit('US12', '9th Infantry', 'us', 'us_9th_inf', 'inf', [V, V, G, G], 'Block_US_9th Inf b.png', '8')
# British 8th Army (tan stickers, blue wood in Vassal); the red unit box marks the Canadians
unit('BR01', '1st Canadian', 'british', 'br_1st_cdn', 'inf', [V] * 4, 'Block_BR_1st Cdn a.png', 'Inv', canadian=True)
unit('BR02', '1st Canadian', 'british', 'br_1st_cdn', 'inf', [V] * 4, 'Block_BR_1st Cdn a.png', 'Inv', canadian=True)
unit('BR03', '5th Infantry', 'british', 'br_5th_inf', 'inf', [V, V, V, G], 'Block_BR_5th Inf a.png', 'Inv')
unit('BR04', '5th Infantry', 'british', 'br_5th_inf', 'inf', [V, V, V, G], 'Block_BR_5th Inf a.png', 'Inv')
unit('BR05', '50th Infantry', 'british', 'br_50th_inf', 'inf', [V] * 4, 'Block_BR_50th Inf a.png', 'Inv')
unit('BR06', '50th Infantry', 'british', 'br_50th_inf', 'inf', [V] * 4, 'Block_BR_50th Inf a.png', 'Inv')
unit('BR07', '51st Infantry', 'british', 'br_51st_inf', 'inf', [V, V, E, E], 'Block_BR_51st Inf a.png', 'Inv')
unit('BR08', '51st Infantry', 'british', 'br_51st_inf', 'inf', [V, V, E, E], 'Block_BR_51st Inf a.png', 'Inv')
unit('BR09', '78th Infantry', 'british', 'br_78th_inf', 'inf', [V] * 4, 'Block_BR_78th Inf a.png', '8')
unit('BR10', '78th Infantry', 'british', 'br_78th_inf', 'inf', [V] * 4, 'Block_BR_78th Inf a.png', '8')
unit('BR11', '1st Airborne', 'british', 'br_1st_ab', 'airborne', [V, V, V, G], 'Block_BR_1st AB a.png', 'Inv')
unit('BR12', '1st Airborne', 'british', 'br_1st_ab', 'airborne', [V, V, V, G], 'Block_BR_1st AB b.png', '3')
unit('BR13', '1st Canadian Armoured', 'british', 'br_1st_cdn_arm', 'armor', [V, V, G], 'Block_BR_1st Cdn c.png', '6', canadian=True)
unit('BR14', '4th Armoured', 'british', 'br_4th_arm', 'armor', [V, V, V], 'Block_BR_4th Arm.png', 'Inv')
unit('BR15', '231st Infantry', 'british', 'br_231st', 'inf', [V, V, V], 'Block_BR_231st.png', 'Inv')
# Italian 6th Army (orange stickers): divisions with their start area in the yellow box
unit('IT01', 'Livorno', 'italian', 'it_livorno', 'motorized_inf', [V, V, V], 'Block_IT_Livorno a.png', '40', motorized=True)
unit('IT02', 'Livorno', 'italian', 'it_livorno', 'motorized_inf', [V, V, V], 'Block_IT_Livorno a.png', '40', motorized=True)
unit('IT03', 'Assietta', 'italian', 'it_assietta', 'mountain_inf', [V, V, V], 'Block_IT_Assietta a.png', '53')
unit('IT04', 'Assietta', 'italian', 'it_assietta', 'mountain_inf', [V, V, V], 'Block_IT_Assietta b.png', '60')
unit('IT05', 'Aosta', 'italian', 'it_aosta', 'inf', [V, V, G], 'Block_IT_Aosta a.png', '57')
unit('IT06', 'Aosta', 'italian', 'it_aosta', 'inf', [V, V, G], 'Block_IT_Aosta b.png', '58')
unit('IT07', 'Napoli', 'italian', 'it_napoli', 'inf', [G, G, V], 'Block_IT_Napoli a.png', '11')
unit('IT08', 'Napoli', 'italian', 'it_napoli', 'inf', [G, G, V], 'Block_IT_Napoli b.png', '15')
# the untried Coastal/Garrison blocks (15.3): 24 one-step green, 4 two-step green, 1 two-step veteran; set up face down at random (S*)
for i in range(29):
    q, img = ([G], 'Block_IT_Garrison 1Green (x24).png') if i < 24 else ([G, G], 'Block_IT_Garrison 2Green (x4).png') if i < 28 else ([V, V], 'Block_IT_Garrison 2Vet (x1).png')
    unit(f'IT{9 + i:02}', 'Coastal/Garrison', 'italian', 'it_coastal', 'garrison', q, img, 'S*', kind='untried')
# German (grey stickers)
unit('GE01', '15th PG', 'german', 'ge_15th_pg', 'mech', [V, E, E], 'Block_GE_15th PG a.png', '25R')
unit('GE02', '15th PG', 'german', 'ge_15th_pg', 'mech', [V, E, E], 'Block_GE_15th PG b.png', '59')
unit('GE03', '15th PG', 'german', 'ge_15th_pg', 'mech', [V, E, E], 'Block_GE_15th PG b.png', '59')
unit('GE04', 'HG', 'german', 'ge_hg', 'mech', [V, V, V, G], 'Block_GE_HG a.png', '17')
unit('GE05', 'HG', 'german', 'ge_hg', 'mech', [V, V, V, G], 'Block_GE_HG a.png', '17')
unit('GE06', '29th PG', 'german', 'ge_29th_pg', 'mech', [V, V, V], 'Block_GE_29th PG a.png', '4')
unit('GE07', '29th PG', 'german', 'ge_29th_pg', 'mech', [V, V, V], 'Block_GE_29th PG b.png', '6')
# the reusable Special Action blocks (8.1), from turn 2 (the "2" and red flag printed on the label)
UNITS.append({'id': 'AL01', 'name': 'Allied Special Action', 'side': ALLIED, 'nation': None, 'echelon': 'allied', 'kind': 'special_action_block', 'arrival_turn': 2, 'red_flag': True,
              'vassal_images': ['Block_Special Action.png'], 'image': None})
UNITS.append({'id': 'AX01', 'name': 'Axis Special Action', 'side': AXIS, 'nation': None, 'echelon': IT6, 'kind': 'special_action_block', 'arrival_turn': 2, 'red_flag': True,
              'vassal_images': ['Block_Axis Special Action.png'], 'image': None})

# ------------------------------------------------------------------ counters
COUNTERS = []
BACK = {ALLIED: 'back_allied_asset', AXIS: 'back_axis_asset'}
ART = {'artillery': 'bulge:artillery', 'engineer': 'bulge:engineer', 'infantry_asset': 'bulge:infantry_asset', 'armor_asset': 'bulge:armor_asset', 'air_mission': 'bulge:air_mission',
       'special_action_event': 'bulge:special_action_event', 'command_staff': 'bulge:command_staff', 'replacement_inf': 'bulge:replacement_inf', 'replacement_arm': 'bulge:replacement_arm',
       'reserve_marker': 'bulge:reserve_marker', 'marker': 'bulge:marker', 'field_works': 'bulge:field_works'}
SYMCLS = {'artillery': 'infantry', 'engineer': 'infantry', 'inf': 'infantry', 'airborne': 'infantry', 'ranger': 'infantry', 'marine': 'infantry', 'recon': 'infantry', 'armor': 'armor'}
def chit(id, kind, nation, turn, name, img, q=None, symbol=None, copies=1, side=None, ech=None, **kw):
    side = side or NATION[nation][0]
    d = {'id': id, 'kind': kind, 'side': side, 'nation': nation, 'echelon': ech or (NATION[nation][1] if nation else 'allied' if side == ALLIED else IT6 if side == AXIS else 'none'), 'turn': turn, 'name': name}
    if q: d['quality'] = q
    if symbol: d['class'], d['symbol'] = SYMCLS[symbol], symbol
    d.update(kw)
    ids = [id] if copies == 1 else [f'{id}{chr(97 + i)}' for i in range(copies)] if copies else []
    d.update(copies=copies, ids=ids, limit='limited' if copies else 'unlimited')
    d.setdefault('back', BACK.get(side))
    d['art'] = ART.get(kind, 'new')
    d['vassal_image'] = img
    d['image'] = None
    COUNTERS.append(d)

A = lambda t, n: f'Asset_Allies_{t}_{n}.png'
X = lambda t, n: f'Asset_Axis_{t}_{n}.png'
n = iter(range(1, 100))
def us(*a, **k): chit(f'USC{next(n):02}', *a[:1], 'us', *a[1:], **k)
FLAG = dict(red_flag=True)
# US 7th Army (green)
us('infantry_asset', 'S', '1st Ranger', A('S', '1st Ranger'), E, 'ranger', subtype='ranger')
us('infantry_asset', 'S', '3rd Ranger', A('S', '3rd Ranger'), E, 'ranger', subtype='ranger')
us('infantry_asset', 'S', '4th Ranger', A('S', '4th Ranger'), E, 'ranger', subtype='ranger')
us('infantry_asset', 'S', '3rd', A('S', '3rd'), V, 'inf', division='us_3rd_inf')
us('infantry_asset', 'S', '45th', A('S', '45th'), V, 'inf', division='us_45th_inf')
us('air_mission', 'S', 'Air Support', A('S', 'US Air Support (x2)'), copies=2, **FLAG)
us('naval_support', 'S', 'Naval Support', A('S', 'US Naval Support (x2)'), copies=2, **FLAG)
us('air_mission', 'C', 'Air Support', A('C', 'US Air Support (x2)'), copies=2, conditional='airfield_captured', start_box='captured_airfields', **FLAG)
us('infantry_asset', 2, '1st', A(2, '1st'), E, 'inf', division='us_1st_inf')
us('artillery', 2, '58th', A(2, '58th Arty'), symbol='artillery')
us('artillery', 2, '62nd', A(2, '62nd Arty'), symbol='artillery')
us('engineer', 2, '39th', A(2, '39th Eng'), V, 'engineer')
us('event_asset_delayed', 2, 'Asset Delayed', A(2, 'Delayed'))
us('replacement_inf', 2, 'US Inf Non-Elite Repl', A(2, 'US Inf Repl'), elite_allowed=False)
us('special_action_event', 2, 'Special Action', A(2, 'US Special Action'))
us('artillery', 3, '17th', A(3, '17th Arty'), symbol='artillery')
us('artillery', 3, '65th', A(3, '65th Arty'), symbol='artillery')
us('infantry_asset', 3, '82nd Airborne', A(3, '82nd AB'), G, 'airborne', division='us_82nd_ab', airborne=True)
us('engineer', 3, '540th', A(3, '540th Eng'), V, 'engineer')
us('armor_asset', 3, '2nd', A(3, '2nd Arm'), G, 'armor', division='us_2nd_arm')
us('armor_asset', 3, '70th', A(3, '70th Arm'), G, 'armor')
us('event_asset_delayed', 3, 'Asset Delayed', A(3, 'Delay'))
us('event_army_release', 3, 'US 7th Army Release', A(3, 'US 7th Army Release'), releases='us_7th_army', zones=['A', 'C', 'D'])
us('special_action_event', 3, 'Special Action', A(3, 'US Special Action'))
us('artillery', 4, '36th', A(4, '36th Arty'), symbol='artillery')
us('artillery', 4, '77th', A(4, '77th Arty'), symbol='artillery')
us('infantry_asset', 4, '30 RCT (-)', A(4, '30 RCT'), V, 'inf', flanking_invasion=True)
us('event_asset_delayed', 4, 'Asset Delayed', A(4, 'Delayed'))
us('replacement_inf', 4, 'US Inf Non-Elite Repl', A(4, 'US Inf Repl'), elite_allowed=False)
us('special_action_event', 4, 'Special Action', A(4, 'US Special Action'))
us('infantry_asset', 5, '30 RCT (-)', A(5, '30 RCT'), V, 'inf', flanking_invasion=True)
us('artillery', 5, '178th', A(5, '178th Arty'), symbol='artillery')
us('armor_asset', 5, '753rd', A(5, '753rd Arm'), G, 'armor')
us('replacement_arm', 5, 'US Armor Non-Elite Repl', A(5, 'US Armor Repl'), elite_allowed=False)
us('special_action_event', 5, 'Special Action', A(5, 'US Special Action'))
us('special_action_event', 6, 'Special Action', A(6, 'US Special Action'))
us('replacement_inf', 6, 'US Inf Non-Elite Repl', A(6, 'US Inf Repl'), elite_allowed=False)
us('infantry_asset', 7, '9th', A(7, '9th'), G, 'inf', division='us_9th_inf')
us('armor_asset', 7, '756th', A(7, '756th Arm'), G, 'armor')
us('special_action_event', 7, 'Special Action', A(7, 'US Special Action'))
us('special_action_event', 8, 'Special Action', A(8, 'US Special Action'))
us('replacement_inf', 8, 'US Inf Non-Elite Repl', A(8, 'US Inf Repl'), elite_allowed=False)
us('special_action_event', 9, 'Special Action', A(9, 'US Special Action'))
chit('ALC01', 'event_fading_morale', None, 'C', 'Fading Italian Morale', A('C', 'Fading Italian Morale (x3)'), copies=3, side=ALLIED, ech='allied',
     conditional='port_or_mutual_vp_captured', start_box='captured_ports_vp')
n = iter(range(1, 100))
def br(*a, **k): chit(f'BRC{next(n):02}', *a[:1], 'british', *a[1:], **k)
# British 8th Army (tan)
br('infantry_asset', 'S', '3rd CDO', A('S', '3rd Cdo'), E, 'ranger', subtype='commando', flanking_invasion='once_per_game')
br('infantry_asset', 'S', 'RYL Marines', A('S', 'Ryl Marines'), E, 'marine', subtype='marines')
br('infantry_asset', 'S', '5th', A('S', '5th'), V, 'inf', division='br_5th_inf')
br('infantry_asset', 'S', '50th', A('S', '50th'), V, 'inf', division='br_50th_inf')
br('armor_asset', 'S', '46 RTR', A('S', '46th RTR'), V, 'armor')
br('armor_asset', 'S', '50 RTR', A('S', '50th RTR'), V, 'armor')
br('infantry_asset', 'S', '1st Canadian', A('S', '1st Canadian'), V, 'inf', division='br_1st_cdn', canadian=True)
br('air_mission', 'S', 'Air Support', A('S', 'BR Air Support (x2)'), copies=2, **FLAG)
br('naval_support', 'S', 'Naval Support', A('S', 'BR Naval Support (x2)'), copies=2, **FLAG)
br('air_mission', 'C', 'Air Support', A('C', 'BR Air Support'), conditional='airfield_captured', start_box='captured_airfields', **FLAG)
br('engineer', 2, 'XXX', A(2, 'XXX Eng'), V, 'engineer')
br('artillery', 2, '24th', A(2, '24th Arty'), symbol='artillery')
br('artillery', 2, '98th', A(2, '98th Arty'), symbol='artillery')
br('infantry_asset', 2, '51st', A(2, '51st'), E, 'inf', division='br_51st_inf')
br('special_action_event', 2, 'Special Action', A(2, 'BR Special Action'))
br('replacement_inf', 2, 'Br Inf Non-Elite Repl', A(2, 'BR Inf Repl'), elite_allowed=False)
br('command_staff', 2, 'Staff Asset', A(2, 'Staff Asset'), **FLAG)
br('artillery', 3, '111th', A(3, '111th Arty'), symbol='artillery')
br('artillery', 3, '57th', A(3, '57th Arty'), symbol='artillery')
br('infantry_asset', 3, '1st Airbourne', A(3, '1st AB'), G, 'airborne', division='br_1st_ab', airborne=True)
br('engineer', 3, 'XIII', A(3, 'XIII Eng'), V, 'engineer')
br('artillery', 4, '58th', A(4, '58th Arty'), symbol='artillery')
br('artillery', 4, '78th', A(4, '78th Arty'), symbol='artillery')
br('replacement_inf', 4, 'Br Inf Non-Elite Repl', A(4, 'BR Inf Repl'), elite_allowed=False)
br('special_action_event', 4, 'Special Action', A(4, 'BR Special Action'))
br('artillery', 5, '142nd', A(5, '142nd Arty'), symbol='artillery')
br('replacement_inf', 6, 'Br Inf Non-Elite Repl', A(6, 'BR Inf Repl'), elite_allowed=False)
br('special_action_event', 6, 'Special Action', A(6, 'BR Special Action'))
br('infantry_asset', 7, '78th', A(7, '78th'), V, 'inf', division='br_78th_inf')
br('replacement_inf', 8, 'Br Inf Non-Elite Repl', A(8, 'BR Inf Repl'), elite_allowed=False)
br('special_action_event', 8, 'Special Action', A(8, 'BR Special Action'))
n = iter(range(1, 100))
def ge(*a, **k): chit(f'GEC{next(n):02}', *a[:1], 'german', *a[1:], **k)
# German (grey)
ge('armor_asset', 'S', '15th Pz Gren', X('S', '15th Pz Gren'), E, 'armor', division='ge_15th_pg')
ge('armor_asset', 'S', 'HG Pz', X('S', 'HG Pz (x2)'), V, 'armor', copies=2, division='ge_hg')
ge('artillery', 'S', '33rd', X('S', '33rd Arty'), symbol='artillery')
ge('air_mission', 'S', 'Air Support', X('S', 'Air Support'), **FLAG)
ge('artillery', 2, '29th', X(2, '29th Arty'), symbol='artillery')
for b in (1, 2, 3): ge('infantry_asset', 2, f'{b}/3rd FJ', X(2, f'{b}-3rd FJ'), E, 'airborne', subtype='paratroop', airborne=True)
ge('air_mission', 2, 'Air Support', X(2, 'Air Support'), **FLAG)
ge('special_action_event', 2, 'Special Action', X(2, 'Special Action'), **FLAG)
ge('air_mission', 3, 'Air Support', X(3, 'Air Support'), **FLAG)
for b in (1, 2, 3): ge('infantry_asset', 4, f'{b}/4th FJ', X(4, f'{b}-4th FJ'), E, 'airborne', subtype='paratroop', airborne=True)
ge('artillery', 5, '1st FJ', X(5, '1 FJ Arty'), symbol='artillery', subtype='paratroop')
ge('special_action_event', 5, 'Special Action', X(5, 'Special Action'), **FLAG)
ge('event_tactical_extract', 5, 'Axis Tactical Extract', X(5, 'Tactical Extract'), nation_scope='german', **FLAG)
ge('event_asset_delayed', 7, 'Asset Delayed', X(7, 'Delayed'))
ge('armor_asset', 8, '29th Pz Gren', X(8, '29th Pz Gren'), V, 'armor', division='ge_29th_pg')
ge('event_asset_delayed', 8, 'Asset Delayed', X(8, 'Delayed'))
ge('event_patton_slap', 8, 'Patton Soldier Slap', X(8, 'Patton Slap'), target='us_7th_army', **FLAG)
ge('special_action_event', 8, 'Special Action', X(8, 'Special Action'), **FLAG)
ge('event_asset_delayed', 9, 'Asset Delayed', X(9, 'Delayed'))
n = iter(range(1, 100))
def it(*a, **k): chit(f'ITC{next(n):02}', *a[:1], 'italian', *a[1:], **k)
# Italian 6th Army (orange)
it('armor_asset', 'S', 'Mobile A', X('S', 'Mobile A'), G, 'armor', subtype='mobile_group')
it('armor_asset', 'S', 'Mobile C', X('S', 'Mobile C'), G, 'armor', subtype='mobile_group')
it('artillery', 'S', '12th', X('S', '12th Arty'), symbol='artillery')
it('infantry_asset', 'S', '58th Bers.', X('S', '58th Bers'), G, 'inf', subtype='bersaglieri')
it('infantry_asset', 'S', '177th Bers.', X('S', '177 Bers'), G, 'inf', subtype='bersaglieri')
it('engineer', 'S', 'XII', X('S', 'XII Eng'), V, 'engineer', **FLAG)
it('engineer', 'S', 'XVI', X('S', 'XVI Eng'), V, 'engineer', **FLAG)
it('armor_asset', 2, 'Mobile B', X(2, 'Mobile B'), G, 'armor', subtype='mobile_group')
it('armor_asset', 2, 'Mobile D', X(2, 'Mobile D'), G, 'armor', subtype='mobile_group')
it('infantry_asset', 2, '23rd Dismnt.', X(2, '23rd Dismounted'), G, 'inf')
it('command_staff', 2, 'Staff Asset', X(2, 'Staff Asset'), **FLAG)
it('artillery', 2, '40th', X(2, '40th Arty'), symbol='artillery')
it('armor_asset', 3, 'Mobile F', X(3, 'Mobile F'), G, 'armor', subtype='mobile_group')
it('infantry_asset', 3, 'Mobile G', X(3, 'Mobile G'), G, 'inf', subtype='mobile_group')
it('infantry_asset', 3, 'Palermitani', X(3, 'Palermitani'), G, 'recon')
it('armor_asset', 4, 'Carmito', X(4, 'Carmite'), G, 'armor')
it('armor_asset', 4, 'Mobile E', X(4, 'Mobile E'), G, 'armor', subtype='mobile_group')
it('infantry_asset', 4, '173rd Blackshirt', X(4, '173rd Blackshirt'), G, 'inf', subtype='blackshirt')
it('infantry_asset', 4, '185th', X(4, '185th'), G, 'inf')
it('armor_asset', 5, '230th', X(5, '230th Arm'), G, 'armor')
it('infantry_asset', 5, '17th Blackshirt', X(5, '17th Blackshirt'), G, 'inf', subtype='blackshirt')
it('infantry_asset', 5, '10th Bers.', X(5, '10th Bers'), G, 'inf', subtype='bersaglieri')
it('infantry_asset', 6, '19th Blackshirt', X(6, '19th Blackshirt'), G, 'inf', subtype='blackshirt')
it('infantry_asset', 6, '51st Bers.', X(6, '51st Bers'), G, 'inf', subtype='bersaglieri')
# markers (turn null)
n = iter(range(1, 100))
def mk(kind, name, img, copies, side='none', nation=None, back=None, **kw):
    chit(f'M{next(n):02}', kind, nation, None, name, img, copies=copies, side=side, ech=kw.pop('ech', None) or ('none' if side == 'none' else None), back=back, **kw)
mk('reserve_marker', '7th Army Reserve', 'Allies_Reserve_7th Army (x2).png', 2, ALLIED, 'us', 'same', ech=US7)
mk('reserve_marker', '8th Army Reserve', 'Allies_Reserve_8th Army (x2).png', 2, ALLIED, 'british', 'same', ech=BR8)
mk('reserve_marker', '6th Army Reserve', 'Axis_Reserve_6th Army (x2).png', 2, AXIS, None, 'same', ech=IT6)
RESTRICT = [('us', US7, 'us_82nd_ab', '82nd Airborne', 'US_82nd AB'), ('us', US7, 'us_45th_inf', '45th Infantry', 'US_45th Inf'), ('us', US7, 'us_9th_inf', '9th Infantry', 'US_9th Inf'),
            ('us', US7, 'us_3rd_inf', '3rd Infantry', 'US_3rd Inf'), ('us', US7, 'us_2nd_arm', '2nd Armor', 'US_2nd Arm'), ('us', US7, 'us_1st_inf', '1st Infantry', 'US_1st Inf'),
            ('british', BR8, 'br_1st_cdn', '1st Canadian', 'BR_1st Cdn'), ('british', BR8, 'br_50th_inf', '50th Infantry', 'BR_50th'), ('british', BR8, 'br_51st_inf', '51st Infantry', 'BR_51st'),
            ('british', BR8, 'br_78th_inf', '78th Infantry', 'BR_78th'), ('british', BR8, 'br_5th_inf', '5th Infantry', 'BR_5th'), ('british', BR8, 'br_1st_ab', '1st Airbourne', 'BR_1st AB'),
            ('british', BR8, 'br_1st_cdn_arm', '1st Canadian (Arm Bde)', 'BR_1st Cdn Arm'), ('british', BR8, 'br_4th_arm', '4th Armour', 'BR_4th Arm'), ('british', BR8, 'br_231st', '231st Infantry', 'BR_231st')]
for nat, ech, div, name, img in RESTRICT:
    mk('marker_restricted', f'Restricted {name}', f'Marker_Restricted_{img}.png', 1, ALLIED, nat, 'back_released', ech=ech, division=div,
       restricts=[u['id'] for u in UNITS if u.get('division') == div], vassal_faces=[f'Marker_Restricted_{img}.png', f'Marker_Restricted_{img}-b.png'])
mk('marker_beachhead', 'US Beach Head', 'Marker_US Beach Head (x4).png', 4, ALLIED, 'us', 'same', ech=US7)
mk('marker_beachhead', 'Br Beach Head', 'Marker_BR Beach Head (x5).png', 5, ALLIED, 'british', 'same', ech=BR8)
for port in ('Palermo', 'Syracuse', 'Catania'):
    mk('marker_port_damage', f'{port} Damage', f'Marker_{port} Damage 1.png', 1, back=f'back_{port.lower()}_damage_2', port=port.lower(),
       vassal_faces=[f'Marker_{port} Damage 1.png', f'Marker_{port} Damage 2.png'])
mk('marker_control', 'Control', 'Marker_Control_Allies.png', 9, back='back_control_axis', vassal_faces=['Marker_Control_Allies.png', 'Marker_Control_Axis.png'])
mk('marker', 'Game Turn', 'Marker_Game Turn_Allies.png', 1, back='back_game_turn_axis', vassal_faces=['Marker_Game Turn_Allies.png', 'Marker_Game Turn_Axis.png'])
mk('marker', 'VPs', 'Marker_VPs_Axis.png', 1, back='back_vps_allies', vassal_faces=['Marker_VPs_Axis.png', 'Marker_VPs_Allies.png'])
mk('marker', 'River Assault', 'Marker_River Assault.png', 9, back='back_road_block')
mk('marker', 'Exploitation', 'Marker_Exploitation.png', 4, back='back_out_of_supply')
mk('marker', 'Disordered', 'Marker_Disordered.png', 18, back='back_recovering', vassal_faces=['Marker_Disordered.png', 'Marker_Disordered-b.png'])
mk('field_works', 'Field Works', 'Marker_Field Works.png', 23, back='back_blown_bridge')

BACKS = [
    ('back_allied_asset', 'Asset or Event (Allied)', 'back_generic', 'Asset_Allies_Back.png', 'bulge:back_green_asset'),
    ('back_axis_asset', 'Asset or Event (Axis)', 'back_generic', 'Asset_Axis_Back.png', 'bulge:back_grey_asset'),
    ('back_released', 'Released (back of each Restricted marker, same division)', 'marker_restricted', None, 'new'),
    ('back_palermo_damage_2', 'Palermo Damage 2', 'marker_port_damage', 'Marker_Palermo Damage 2.png', 'new'),
    ('back_syracuse_damage_2', 'Syracuse Damage 2', 'marker_port_damage', 'Marker_Syracuse Damage 2.png', 'new'),
    ('back_catania_damage_2', 'Catania Damage 2', 'marker_port_damage', 'Marker_Catania Damage 2.png', 'new'),
    ('back_control_axis', 'Control (Axis side)', 'marker_control', 'Marker_Control_Axis.png', 'new'),
    ('back_game_turn_axis', 'Game Turn (Axis side)', 'marker', 'Marker_Game Turn_Axis.png', 'bulge:back_game_turn'),
    ('back_vps_allies', 'VPs (Allied side)', 'marker', 'Marker_VPs_Allies.png', 'bulge:back_vps'),
    ('back_road_block', 'Road Block (back of River Assault)', 'marker', 'Marker_Road Block.png', 'bulge:marker'),
    ('back_out_of_supply', 'Out of Supply (back of Exploitation)', 'marker', 'Marker_Out of Supply.png', 'bulge:marker'),
    ('back_recovering', 'Recovering (back of Disordered)', 'marker', 'Marker_Disordered-b.png', 'bulge:marker'),
    ('back_blown_bridge', 'Blown Bridge (back of Field Works)', 'marker', 'Marker_Blown Bridge.png', 'bulge:marker'),
]

# ------------------------------------------------------------------ cross-checks against the Vassal module
S = slots()
have = set(os.listdir(IMGS))
used = {}
for s in S:
    if s['protos'] and 'Restricted Division' in s['protos']: key = [i for i in s['imgs'] if not i.endswith('-b.png')][0]
    elif s['name'].startswith('Axis Untried Division'): continue          # Vassal-only helper markers ("?"): each is swapped for a random garrison block
    elif s['anc'][-1]['tag'] == 'ListWidget' or s['anc'][-1]['name'] in ('Turn', 'VPs', 'Syracuse Damage', 'Catania Damage', 'Palermo Damage'): continue   # markers from the palette / tracks
    else: key = s['imgs'][-1]
    used.setdefault(key, []).append(vassal_turn(s))
problems = []
def check(img, copies, turn, what):
    if img not in have: problems.append(f'{what}: image {img} missing'); return
    got = used.get(img, [])
    if what.startswith('unit') and len(got) != copies: problems.append(f'{what}: {img} used by {len(got)} Vassal pieces, expected {copies}')
    for t in got:
        if turn is not None and t != turn: problems.append(f'{what}: {img} sits at Vassal code {t}, data says {turn}')
img_count = {}
for u in UNITS: img_count[u['vassal_images'][0]] = img_count.get(u['vassal_images'][0], 0) + 1
for u in UNITS:
    code = u.get('sticker_code')
    vt = None if u.get('kind') == 'untried' else 'Inv' if code == 'Inv' else 'start' if u.get('start_area') else u.get('arrival_turn')
    if u['id'] in ('AL01', 'AX01'): vt = 2
    if u.get('kind') == 'untried': vt = 'untried'
    check(u['vassal_images'][0], img_count[u['vassal_images'][0]], vt, f"unit {u['id']}")
for c in COUNTERS:
    if c['turn'] is None:
        if c['vassal_image'] not in have: problems.append(f"{c['id']}: image {c['vassal_image']} missing")
        for f in c.get('vassal_faces', []):
            if f not in have: problems.append(f"{c['id']}: face {f} missing")
        continue
    got = used.get(c['vassal_image'], [])
    if len(got) != c['copies']: problems.append(f"{c['id']}: {c['vassal_image']} used {len(got)}x in Vassal, copies {c['copies']}")
    for t in got:
        if t != c['turn']: problems.append(f"{c['id']}: Vassal turn {t}, data {c['turn']}")
    m = re.match(r'Asset_(?:Allies|Axis)_([^_]+)_', c['vassal_image'])
    if m and str(c['turn']) != m.group(1): problems.append(f"{c['id']}: file-name turn {m.group(1)} vs {c['turn']}")
for b in BACKS:
    if b[3] and b[3] not in have: problems.append(f'back {b[0]}: {b[3]} missing')
data_imgs = {u['vassal_images'][0] for u in UNITS} | {c['vassal_image'] for c in COUNTERS} | {f for c in COUNTERS for f in c.get('vassal_faces', [])} | {b[3] for b in BACKS if b[3]}
unused = sorted(f for f in have if re.match(r'(Block|Asset|Marker|Allies_Reserve|Axis_Reserve)_', f) and f not in data_imgs)
OK_UNUSED = {'Block_Axis_Block.png', 'Block_BR_Block.png', 'Block_US_Block.png', 'Block_IT_Untried.png', 'Marker_Blank.png'}
for f in unused:
    if f not in OK_UNUSED: problems.append(f'Vassal image not in data: {f}')
# the printed counter sheet holds 228 counters
total = sum(c['copies'] for c in COUNTERS)
if total != 228: problems.append(f'{total} counters, the sheet has 228')
if problems:
    print('\n'.join(problems)); sys.exit(1)

# backs: count the counters that carry each one
for b in BACKS: pass
backs = []
for id, name, kind, img, art in BACKS:
    backs.append({'id': id, 'name': name, 'kind': kind, 'vassal_image': img, 'art': art, 'copies': sum(c['copies'] for c in COUNTERS if c['back'] == id), 'image': None})

# ------------------------------------------------------------------ reinforcements (per turn, both sides) and set-ups
TURN_NAMES = {'1': 'July 10-11', '2': 'July 12-13', '3': 'July 14-15', '4': 'July 16-17', '5': 'July 18-19', '6': 'July 20-22', '7': 'July 23-25', '8': 'July 26-28', '9': 'July 29-31'}
def cref(c): d = {'id': c['id'], 'kind': c['kind'], 'name': c['name']}; d.update({'copies': c['copies']} if c['copies'] > 1 else {}); return d
turns = {}
for t in range(2, 10):
    turns[str(t)] = {}
    for side in (ALLIED, AXIS):
        us_ = [{'id': u['id'], 'name': u['name'], 'entry': u.get('entry')} for u in UNITS if u['side'] == side and u.get('arrival_turn') == t and u.get('kind') != 'special_action_block']
        ch = [{'id': u['id'], 'name': u['name'], 'reusable': True} for u in UNITS if u['side'] == side and u.get('kind') == 'special_action_block' and u['arrival_turn'] == t]
        ch += [cref(c) for c in COUNTERS if c['side'] == side and c['turn'] == t]
        turns[str(t)][side] = {'units': us_, 'chits': ch}
reinf = {
    'source': 'Vassal set-up cards (SetupStacks on the boards "Allied Forces", "Allied Reinforcements", "Axis Forces/ Reinforcements"; asset file names carry the same turn codes) '
              '= printed player aid pages 7, 10, 12 and the sticker / counter sheets; S = at start (Available Box), C = conditional, Inv = invasion landing on turn 1',
    'turn_names': TURN_NAMES,
    'start_assets': {side: [{'id': u['id'], 'name': u['name'], 'area': u['start_area'], **({'reserve_marker': True} if u.get('start_reserve') else {})} for u in UNITS if u['side'] == side and u.get('start_area')]
                     + [cref(c) for c in COUNTERS if c['side'] == side and c['turn'] == 'S'] for side in (ALLIED, AXIS)},
    'turns': turns,
    'invasion': {'allied': [{'id': u['id'], 'name': u['name']} for u in UNITS if u.get('arrival') == 'invasion'],
                 'note': 'Arriving Units (sticker code Inv): land on game turn 1 at the beaches of the landing plan chosen; the Beachhead markers go out per that plan'},
    'untried': {'axis': [u['id'] for u in UNITS if u.get('kind') == 'untried'],
                'note': 'sticker code S*: the Coastal/Garrison blocks go into a cup and are set up face down at random (placement areas per scenario: Play Book 22.14, 22.24, 22.37)'},
    'conditional': {'allied': [cref(c) for c in COUNTERS if c['turn'] == 'C']},
}
ids = lambda f: [i for c in COUNTERS if f(c) for i in c['ids']]
uid = lambda f: [u['id'] for u in UNITS if f(u)]
def find(nation, turn, name):
    f = [c for c in COUNTERS if c['nation'] == nation and c['turn'] == turn and c['name'] == name] if nation or turn else [c for c in COUNTERS if c['name'] == name]
    assert len(f) == 1, (nation, turn, name, len(f)); return f[0]
avail = lambda side: ids(lambda c: c['side'] == side and c['turn'] == 'S')
INVASION_CAPABLE = [1, 2, 4, 5, 8, 9, 13, 14, 19, 20, 41, 42, 51, 52, 53, 56, 57, 58, 60, 61, 63, 64, 65]  # areas a landing box points at (14.21)
BOX_ORDER = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6']  # consecutive boxes along the south and east coasts (22.25-22.26)
D_ORDER = ['D%d' % i for i in range(1, 14)]
inv_box = lambda i: 'airborne_assault' if next(u for u in UNITS if u['id'] == i)['symbol'] == 'airborne' else 'at_sea'
VICTORY_19 = {
    'objectives': '19.1: an objective counts only if friendly-controlled and able to trace supply. German crosses (28, 29, 30): Allied VPs only, and only while an Allied unit is there. '
                  'White stars (5, 57, 65): Axis VPs only. Yellow stars (15, 18, 26, 45, 49): both sides; the Allies only while an Allied unit is there.',
    'large_units': '19.2: each eliminated unit with 3+ steps on its label is 1 VP to the other side; each captured Allied beachhead is 1 VP to the Axis (Eliminated Large Units Track)',
    'tally': '19.3: each side sums objective VPs + eliminated enemy large units; the difference is the VP level, marked on the General Information Track with the leading side face up',
    'sudden_death': '19.4: from turn 4, the net VPs printed on the turn track for that turn end the game in the Victory Check Phase',
}
FULL = {
    'map': 'sicily', 'first_player': 'allied', 'startPhase': 'movement',
    'admin_skipped_turn1': ['allied'],
    'turn1_note': 'The scenario starts with the Allied Operational Movement Phase; the Allied Admin Phase of turn 1 is skipped (22.27). Admin draws on turn 1 are 0/0 for both sides (turn track).',
    'units': [{'id': u['id'], 'area': u['start_area']} for u in UNITS if u.get('start_area')] + [{'id': i, 'box': inv_box(i)} for i in uid(lambda u: u.get('arrival') == 'invasion')],
    'reserve': {'axis': uid(lambda u: u.get('start_reserve'))},
    'untried': {'ids': uid(lambda u: u.get('kind') == 'untried'), 'rule': 'shuffle face down; one per area anywhere in Sicily, also with a tried unit, but not in an area that already holds two tried units (22.24)'},
    'field_works': {'rule': 'after all Axis units are placed: one on each invasion-capable coastal area holding at least one Axis unit (22.24)', 'invasion_capable': INVASION_CAPABLE, 'available': 23},
    'landing_plans': {
        'box_order': BOX_ORDER + D_ORDER,
        'historical': {'british': {'beachheads': 5, 'consecutive_in': BOX_ORDER[4:], 'zones': ['B'], 'released_zones': ['A', 'B', 'C']},
                       'us': {'beachheads': 4, 'boxes': BOX_ORDER[:4], 'zones': ['A', 'C'], 'released_zones': ['A', 'C', 'D']}, 'rule': '22.25'},
        'alternate': {'british': {'beachheads': 5, 'consecutive_in': BOX_ORDER, 'zones': ['A', 'B'], 'released_zones': ['A', 'B', 'C']},
                      'us': {'beachheads': 4, 'consecutive_in': D_ORDER, 'zones': ['C', 'D'], 'released_zones': ['A', 'C', 'D']}, 'rule': '22.26'},
        'never': {'us': {'zones': ['B'], 'except_areas': [29]}, 'british': {'zones': ['D']}, 'rule': '14.41: Messina (29) is in both zones B and C'},
        'note': 'The Allied player chooses a plan after seeing the Axis set-up, places the beachhead markers, then the Inv units: two per beachhead at most, airborne units in the Airborne Assault box (14.24)',
    },
    'holding_boxes': {
        'allied_reserve_markers': ids(lambda c: c['kind'] == 'reserve_marker' and c['side'] == ALLIED),
        'axis_reserve_markers': ids(lambda c: c['name'] == '6th Army Reserve')[1:],
        'restricted_7th_army': ids(lambda c: c['kind'] == 'marker_restricted' and c['echelon'] == US7),
        'restricted_8th_army': ids(lambda c: c['kind'] == 'marker_restricted' and c['echelon'] == BR8),
        'captured_airfields': ids(lambda c: c['kind'] == 'air_mission' and c['turn'] == 'C'),
        'captured_ports_vp': ids(lambda c: c['kind'] == 'event_fading_morale'),
        'beachhead_markers': ids(lambda c: c['kind'] == 'marker_beachhead'),
    },
    'reserve_markers_on_units': {ids(lambda c: c['name'] == '6th Army Reserve')[0]: uid(lambda u: u.get('start_reserve'))[0]},
    'available': {'allied': avail(ALLIED), 'axis': avail(AXIS)},
    'port_damage': {'palermo': 0, 'syracuse': 0, 'catania': 0},
    'supply': {'axis': 'Messina (29), friendly-controlled (14.91)', 'allied': 'a beachhead of the unit\'s own nationality, or any friendly-controlled undamaged port (14.92)'},
    'vp': {'marker': 8, 'note': 'At start the Axis holds the 3 white stars and 5 yellow stars: 8 VPs, Axis face up (19.3; the Vassal set-up agrees)'},
    'game_turn': 1,
}
setups = {
    'sunrise_bridge': {
        'name': 'Sunrise Bridge', 'rule': '22.1', 'map': 'sicily', 'turns': 4, 'first_player': 'allied', 'startPhase': 'movement',
        'source': 'Play Book 22.1; player aids p. 8 (status boxes and turn track), p. 9 (scenario map), p. 11 (set-up); not in the Vassal module',
        'turn_names': {k: TURN_NAMES[k] for k in '1234'},
        'areas_in_play': [1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15, 16, 17, 25, 26],
        'admin_skipped_turn1': ['allied', 'axis'],
        'track': {'1': {'allied': [0, 0], 'axis': [0, 0]}, '2': {'allied': [6, 3], 'axis': [5, 3]}, '3': {'allied': [6, 3], 'axis': [5, 2]}, '4': {'allied': [6, 3], 'axis': [4, 2]}},
        'units': [{'id': 'IT07', 'area': 11}, {'id': 'IT08', 'area': 15}, {'id': 'GE04', 'area': 17}, {'id': 'GE05', 'area': 17}]
                 + [{'id': i, 'box': inv_box(i)} for i in ['BR01', 'BR02', 'BR03', 'BR04', 'BR05', 'BR06', 'BR07', 'BR08', 'BR11', 'BR14', 'BR15']],
        'invasion': {'allied': ['BR01', 'BR02', 'BR03', 'BR04', 'BR05', 'BR06', 'BR07', 'BR08', 'BR11', 'BR14', 'BR15'], 'beachheads': ['B1', 'B2', 'B3', 'B4', 'B5'],
                     'note': 'Arriving (July 10-11): enter at Beachheads B1 through B5 with Assets Available; skip first Admin Phase; x5 Br Beach Head on Landing Boxes B1-B5. The 1st Airborne goes to the Airborne Assault box (14.24)'},
        'untried': {'ids': ['IT09', 'IT10', 'IT11', 'IT12', 'IT13', 'IT14', 'IT15', 'IT33', 'IT34', 'IT37'], 'mix': {'1 green': 7, '2 green': 2, '2 veteran': 1},
                    'areas': [1, 2, 3, 4, 5, 6, 7, 13, 14, 26], 'rule': 'shuffle the ten face down and place one per area (22.14)'},
        'field_works': {'rule': 'one on each invasion-capable coastal area holding at least one Axis unit (22.14): areas 1, 2, 4, 5, 13 and 14 after the garrisons are placed', 'areas': [1, 2, 4, 5, 13, 14]},
        'zones': {'british': ['B'], 'zone_a_areas': [7, 10, 11, 16, 17, 25], 'rule': 'British units land and operate in zone B unless a division is released by Special Action (14.61) to enter zone A (22.16)'},
        'supply': {'axis_areas': [16, 17, 25, 26], 'axis': 'trace into a friendly-controlled area 16, 17, 25 or 26 (22.16)', 'allied': '14.92 unchanged'},
        'special_rules': ['No voluntary exit off the map except Allied Sea Retreat (14.28); units forced off the map are eliminated',
                          'Italian Untried Units rules in effect (15.3), including no congestion penalty (14.42)',
                          'Fading Italian Morale (17.21) is not used'],
        'fading_italian_morale': False,
        'available': {'allied': [i for k in (('british', 'S', n) for n in ('Naval Support', 'Air Support', '3rd CDO', 'RYL Marines', '5th', '50th', '46 RTR', '50 RTR', '1st Canadian')) for i in find(*k)['ids']],
                      'axis': [i for k in [('italian', 'S', n) for n in ('Mobile A', '12th', 'XII')] + [('german', 'S', n) for n in ('HG Pz', '33rd', 'Air Support')] for i in find(*k)['ids']]},
        'holding_boxes': {'allied_reserve_markers': [find('british', None, '8th Army Reserve')['ids'][0]], 'axis_reserve_markers': [find(None, None, '6th Army Reserve')['ids'][0]],
                          'restricted_8th_army': ids(lambda c: c['kind'] == 'marker_restricted' and c['echelon'] == BR8), 'beachhead_markers': ids(lambda c: c['name'] == 'Br Beach Head')},
        'reinforcements': {
            '2': {'allied': {'units': [], 'chits': ['AL01'] + [find('british', 2, n)['id'] for n in ('XXX', '24th', '98th', '51st', 'Special Action', 'Br Inf Non-Elite Repl', 'Staff Asset')] + [find('us', 2, 'Asset Delayed')['id']]},
                  'axis': {'units': [{'id': 'IT01', 'entry': [16, 17, 25]}, {'id': 'IT02', 'entry': [16, 17, 25]}],
                           'chits': ['AX01'] + [find('italian', 2, n)['id'] for n in ('Staff Asset', '23rd Dismnt.', '40th', 'Mobile B')] + [find('german', 2, n)['id'] for n in ('29th', '1/3rd FJ', '2/3rd FJ', '3/3rd FJ')]}},
            '3': {'allied': {'units': [{'id': 'BR12', 'entry': ['airborne_assault']}], 'chits': [find('british', 3, n)['id'] for n in ('57th', '111th', '1st Airbourne', 'XIII')]}, 'axis': {'units': [], 'chits': []}},
            '4': {'allied': {'units': [], 'chits': [find('british', 4, n)['id'] for n in ('58th', '78th', 'Br Inf Non-Elite Repl', 'Special Action')]},
                  'axis': {'units': [{'id': 'GE06', 'entry': [25, 26]}], 'chits': [find('german', 4, n)['id'] for n in ('1/4th FJ', '2/4th FJ', '3/4th FJ')]}},
        },
        'victory': {'when': 'end of turn 4', 'area_vp': {'6': 1, '7': 1, '10': 1, '11': 1, '12': 1, '13': 1, '14': 1, '15': 1, '17': 1, '5': 2, '16': 2, '25': 3, '26': 4},
                    'large_units': False, 'rule': '22.17: each side scores the areas it controls; the side with positive net VPs wins, otherwise a draw',
                    'note': 'The Play Book lists area 16 under both 1 VP (areas 10-17) and 2 VP; the scenario map prints 2 in area 16, so 2 is used'},
        'vp': {'marker': 0},
        'note': 'Livorno arrives on turn 2 here (it starts in area 40 in the full game); the Allied turn 2 row includes the green US "Asset Delayed" (2).',
    },
    'tournament': {
        'name': 'Tournament (July 10-19, 1943)', 'rule': '22.2', 'turns': 5,
        'source': 'Play Book 22.2; At Start cards (player aids p. 10 Allied, p. 12 Axis; Vassal "Allied Forces" and "Axis Forces/ Reinforcements" boards); main-map tracks from the Vassal map',
        **FULL,
        'victory': {**VICTORY_19, 'end': 'Axis 4 or more VPs: Axis win; otherwise Allied win (22.28)', 'axis_win_at': 4},
    },
    'campaign': {
        'name': 'Campaign (July 10-31, 1943)', 'rule': '22.3', 'turns': 9,
        'source': 'Play Book 22.3; At Start cards (player aids p. 10 Allied, p. 12 Axis; Vassal "Allied Forces" and "Axis Forces/ Reinforcements" boards); main-map tracks from the Vassal map',
        **FULL,
        'historical_option': {'rule': '22.37', 'untried_areas': INVASION_CAPABLE + [26, 28, 29, 30, 48, 49], 'landing_plan': 'historical', 'british_beachheads': ['B1', 'B2', 'B3', 'B4', 'B5'],
                              'note': 'the 29 garrisons go one per area: the 23 invasion-capable areas plus coastal areas 26, 28, 29, 30, 48 and 49'},
        'victory': {**VICTORY_19, 'end': '4+ VPs operational victory, 1-3 marginal victory for the side with the VPs, 0 draw (22.38)', 'levels': {'operational': 4, 'marginal': 1}},
    },
}

os.makedirs(OUT, exist_ok=True)
def dump(name, obj):
    with open(os.path.join(OUT, name), 'w') as f: json.dump(obj, f, indent=1, ensure_ascii=False); f.write('\n')
dump('units.json', UNITS); dump('counters.json', COUNTERS); dump('counter_backs.json', backs); dump('reinforcements.json', reinf); dump('setups.json', setups)
print(f'{len(UNITS)} blocks, {len(COUNTERS)} counter entries ({total} counters), {len(backs)} backs; all checks passed')

# ------------------------------------------------------------------ review sheet (scratch only: it shows the Vassal images, which are never committed)
if REVIEW:
    os.makedirs(REVIEW, exist_ok=True)
    rel = os.path.relpath(IMGS, REVIEW)
    def row(img, fields, faces=()):
        ims = ''.join(f'<img src="{html.escape(rel + "/" + f)}">' for f in [img, *faces] if f)
        return f'<tr><td>{ims}</td><td><code>{html.escape(json.dumps(fields, ensure_ascii=False))}</code></td></tr>'
    skip = {'vassal_images', 'image', 'vassal_image', 'vassal_faces', 'colours'}
    parts = ['<!doctype html><meta charset="utf-8"><title>Sicily pieces review</title><style>body{font:13px sans-serif}img{width:112px;height:112px;image-rendering:auto;margin:2px;background:#ccc}td{border-bottom:1px solid #ddd;vertical-align:top}code{white-space:pre-wrap}</style>',
             f'<h1>FAB: Sicily pieces ({len(UNITS)} blocks, {total} counters)</h1><h2>Blocks</h2><table>']
    parts += [row(u['vassal_images'][0], {k: v for k, v in u.items() if k not in skip}) for u in UNITS]
    parts.append('</table><h2>Counters</h2><table>')
    parts += [row(c['vassal_image'], {k: v for k, v in c.items() if k not in skip}, c.get('vassal_faces', [])[1:]) for c in COUNTERS]
    parts.append('</table><h2>Backs</h2><table>')
    parts += [row(b['vassal_image'], {k: v for k, v in b.items() if k not in skip}) for b in backs]
    parts.append('</table>')
    open(os.path.join(REVIEW, 'review.html'), 'w').write('\n'.join(parts))
    print('review sheet:', os.path.join(REVIEW, 'review.html'))
