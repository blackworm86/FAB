"""The rules checklist for the owner's tests: one row per rule section of the Series Rules and of each volume's exclusive,
optional and scenario rules (data/<game>/rules.json), each with sandbox links set up on that rule's situation
(web/src/sandbox.ts preset: at=turn.side.phase, chits=, battle=1, setup=0, scenario=, rules=).
Run: python3 -I tools/rules/checklist.py > rows.json   (the artifact page embeds the rows)
"""
import json, os, re, sys
from urllib.parse import quote

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SITE = 'https://blackworm86.github.io/FAB/'
SIDES = {'bulge': ('german', 'allied'), 'sicily': ('allied', 'axis'), 'golan73': ('syrian', 'israeli')}
NAME = {'bulge': 'The Bulge', 'sicily': 'Sicily', 'golan73': "Golan '73"}


def at(game, turn, phase, second=False):
    return dict(at=f'{turn}.{SIDES[game][1 if second else 0]}.{phase}')


def series(num, game):
    """The situation for a Series Rules section, by chapter."""
    n = float(num) if re.fullmatch(r'\d+(\.\d+)?', num) else 0
    c = int(n)
    if num in ('3.1', '4.0', '4.1', '8.27'): return at(game, 2, 'reinforcement')
    if num in ('3.21', '4.2', '4.21', '4.22', '8.0', '8.1', '8.2', '8.25', '8.26'): return {**at(game, 2, 'admin'), 'chits': 'special_action_event'}
    if num.startswith('4.3'): return {**at(game, 2, 'admin'), 'chits': 'engineer'}
    if num.startswith('8.3'): return {**at(game, 2, 'admin'), 'chits': 'command_staff'}
    if num in ('3.22',) or c == 5 and not num.startswith('5.4'): return at(game, 2, 'movement')
    if num in ('3.23', '5.4'): return at(game, 2, 'strategic')
    if num in ('3.25', '7.0', '7.1', '7.2'): return at(game, 2, 'reaction')
    if num in ('3.26', '7.3', '7.31', '7.32', '8.21'): return at(game, 2, 'btMove')
    if num in ('3.27', '7.4', '7.41', '7.42', '8.22'): return at(game, 2, 'btCombat')
    if num == '3.24' or c == 6 or num in ('8.23', '8.24'):
        r = dict(battle=1)
        if num.startswith('6.3') or num in ('6.22', '6.23', '6.25', '6.26'): r['chits'] = 'artillery,armor_asset,infantry_asset,engineer'
        if num in ('8.23', '8.24', '6.21'): r['chits'] = 'special_action_event'
        return r
    if num in ('3.28', '3.3', '3.4', '3.5') or c == 9: return at(game, 2, 'supply')
    return {}


# Volume rules: the situation by words in the title, then exact sections.
WORDS = [
    (r'Victory|Determining', lambda g: at(g, 3, 'supply')),
    (r'Supply|Airfield|Evacuation', lambda g: at(g, 2, 'supply')),
    (r'Strat', lambda g: at(g, 2, 'strategic')),
    (r'Entry|Reinforcement|Arriv|Landing|Beachhead|Port Box|Reroute', lambda g: at(g, 2, 'reinforcement')),
    (r'Engineering|Replacement|Staff|Special Action|Event Use|Rebuild|Released|Release', lambda g: {**at(g, 2, 'admin'), 'chits': 'special_action_event,command_staff,engineer'}),
    (r'Combat|Assault|Artillery|Battle|Asset|Garrison|Strongpoint|Ghost|Mixing|Integrity|Untried|Overrun|Retreat|Night Turn|Minefield', lambda g: dict(battle=1)),
    (r'Movement|Boundar|Connection|Escarpment|Ditch|Wadi|Rugged|River|Purple|Galilee|Hermon|Barrier|Zones|Sectors|Reserve|Motorized|T-62|Stacking|Withdrawal', lambda g: at(g, 2, 'movement')),
]
B = lambda **k: dict(battle=1, **k)
EXACT = {
    'bulge': {
        '14.22': at('bulge', 2, 'reinforcement', True), '14.23': at('bulge', 2, 'reinforcement', True),
        '14.42': at('bulge', 2, 'movement', True), '14.43': at('bulge', 2, 'movement', True), '14.72': at('bulge', 2, 'movement', True),
        '14.82': at('bulge', 2, 'strategic', True), '14.83': at('bulge', 2, 'strategic', True), '14.92': at('bulge', 2, 'supply', True),
        '14.51': {**at('bulge', 2, 'admin'), 'chits': 'engineer'}, '14.52': {**at('bulge', 2, 'admin'), 'chits': 'german:engineer'},
        '14.61': {**at('bulge', 2, 'admin'), 'chits': 'special_action_event'}, '14.62': {**at('bulge', 2, 'admin'), 'chits': 'command_staff'},
        '15.1': {**at('bulge', 2, 'admin'), 'chits': 'german:event_release'}, '15.2': at('bulge', 2, 'reinforcement', True), '15.3': at('bulge', 4, 'reinforcement'),
        '16.11': at('bulge', 1, 'admin'), '16.12': B(chits='german:artillery,german:rocket_artillery'), '16.13': {**at('bulge', 2, 'admin'), 'chits': 'german:fuel'},
        '16.21': B(), '16.22': {**at('bulge', 2, 'reinforcement', True), 'chits': 'allied:task_force'}, '16.23': B(chits='allied:artillery'),
        '17.11': {**at('bulge', 2, 'admin'), 'chits': 'german:event_greif_interdict'}, '17.12': {**at('bulge', 2, 'admin'), 'chits': 'german:event_greif_bridge'},
        '17.13': {**at('bulge', 2, 'admin'), 'chits': 'german:event_release'}, '17.14': at('bulge', 2, 'admin'), '17.21': at('bulge', 2, 'admin', True),
        '17.22': {**at('bulge', 2, 'admin', True), 'chits': 'allied:rebuild_or_replace_inf,allied:rebuild_or_replace_arm'},
        '17.23': {**at('bulge', 2, 'admin', True), 'chits': 'allied:event_arriving_regiment'},
        '17.31': {**at('bulge', 2, 'admin'), 'chits': 'replacement_inf'}, '17.32': {**at('bulge', 2, 'admin'), 'chits': 'german:replacement_arm'},
        '17.33': {**at('bulge', 2, 'admin'), 'chits': 'special_action_event'}, '17.34': {**at('bulge', 2, 'admin', True), 'chits': 'allied:event_delayed_response'},
        '18.1': {**at('bulge', 2, 'admin'), 'chits': 'engineer', 'rules': 'bridgeLimit'}, '18.2': dict(rules='bid:2', setup=0), '18.3': {**at('bulge', 1, 'movement'), 'rules': 'peiper'},
        '18.4': B(rules='pz150'), '18.5': {**at('bulge', 2, 'supply'), 'rules': 'airborne'}, '18.6': B(chits='artillery', rules='advArty'), '18.7': B(chits='artillery', rules='overrun'),
        '18.8': {**at('bulge', 2, 'supply'), 'rules': 'fwMaintain'}, '18.9': {**at('bulge', 2, 'reinforcement'), 'rules': 'randomReinf'},
        '18.91': {**at('bulge', 2, 'reinforcement'), 'rules': 'randomReinf'}, '18.92': {**at('bulge', 2, 'reinforcement'), 'rules': 'randomReinf'},
    },
    'sicily': {
        '14.27': B(), '14.28': B(), '14.29': at('sicily', 4, 'movement', True), '14.32': at('sicily', 2, 'movement', True), '14.43': B(),
        '14.53': {**at('sicily', 2, 'admin', True), 'chits': 'axis:engineer'}, '14.63': {**at('sicily', 2, 'admin', True), 'chits': 'axis:command_staff'}, '14.64': at('sicily', 2, 'reinforcement'),
        '14.71': at('sicily', 2, 'movement', True), '14.81': at('sicily', 2, 'strategic', True), '14.91': at('sicily', 2, 'supply', True),
        '15.1': at('sicily', 2, 'movement'), '15.2': B(), '15.3': B(),
        '16.1': B(chits='axis:infantry_asset,axis:armor_asset,axis:artillery'), '16.11': B(chits='axis:infantry_asset,axis:armor_asset'), '16.12': B(chits='axis:artillery'),
        '16.2': B(chits='allied:naval_support,allied:artillery'), '16.21': B(chits='allied:naval_support'), '16.22': B(chits='allied:infantry_asset'), '16.23': B(chits='allied:infantry_asset'),
        '16.3': B(chits='air_mission'), '16.31': B(chits='air_mission'), '16.32': B(chits='air_mission'), '16.33': {**at('sicily', 2, 'admin'), 'chits': 'air_mission'},
        '16.34': {**at('sicily', 2, 'supply'), 'chits': 'air_mission'}, '16.4': {**at('sicily', 2, 'supply'), 'chits': 'air_mission'}, '16.5': B(chits='allied:naval_support'),
        '17.1': at('sicily', 2, 'admin', True), '17.11': at('sicily', 2, 'admin', True), '17.12': B(chits='axis:event_tactical_extract'),
        '17.21': {**at('sicily', 2, 'admin'), 'chits': 'allied:event_fading_morale'}, '17.22': at('sicily', 2, 'admin'), '17.23': {**at('sicily', 2, 'admin'), 'chits': 'allied:event_army_release'},
        '17.24': {**at('sicily', 2, 'admin'), 'chits': 'allied:replacement_inf'}, '17.25': {**at('sicily', 2, 'admin'), 'chits': 'allied:replacement_arm'},
        '17.31': {**at('sicily', 2, 'admin'), 'chits': 'special_action_event'}, '17.32': {**at('sicily', 2, 'admin'), 'chits': 'allied:event_asset_delayed'},
        '18.1': {**at('sicily', 2, 'supply'), 'rules': 'airborne'}, '18.2': B(chits='artillery', rules='advArty'), '18.3': B(chits='artillery', rules='overrun'), '18.4': {**at('sicily', 2, 'supply'), 'rules': 'fwMaintain'},
    },
    'golan73': {
        '14.01': B(), '14.02': at('golan73', 1, 'movement', True), '14.03': at('golan73', 2, 'movement'), '14.15': B(chits='israeli:air_mission,syrian:sam'),
        '14.16': at('golan73', 2, 'movement'), '14.43': at('golan73', 2, 'movement', True), '14.51': B(chits='syrian:engineer'), '14.52': {**at('golan73', 2, 'admin'), 'chits': 'syrian:engineer'},
        '14.61': {**at('golan73', 2, 'admin'), 'chits': 'special_action_event'}, '14.62': {**at('golan73', 2, 'admin'), 'chits': 'command_staff'},
        '14.72': at('golan73', 2, 'movement', True), '14.92': at('golan73', 2, 'supply', True), '14.95': at('golan73', 2, 'supply', True),
        '15.1': B(), '15.11': B(), '15.12': B(chits='syrian:artillery,syrian:armor_asset'), '15.2': {**at('golan73', 3, 'admin'), 'chits': 'syrian:event_release'},
        '15.3': at('golan73', 1, 'combat'), '15.4': at('golan73', 2, 'movement'), '15.5': B(), '15.51': B(), '15.52': B(), '15.6': B(), '15.7': B(),
        '16.1': B(chits='syrian:commando,syrian:sam'), '16.11': B(chits='syrian:commando'), '16.12': B(**{'chits': 'israeli:air_mission,syrian:sam'}),
        '16.2': B(**{'chits': 'israeli:artillery,israeli:air_mission'}), '16.21': B(chits='israeli:artillery'),
        '16.22': B(**{'chits': 'israeli:air_mission'}), '16.23': {**at('golan73', 3, 'admin', True), 'chits': 'israeli:air_mission'}, '16.24': B(),
        '16.3': B(chits='air_mission'), '16.31': B(chits='air_mission'), '16.4': B(chits='rocket_artillery'),
        '17.1': {**at('golan73', 3, 'admin'), 'chits': 'syrian:event_release,syrian:event_ssm_strike'}, '17.11': {**at('golan73', 3, 'admin'), 'chits': 'syrian:event_release'},
        '17.12': {**at('golan73', 2, 'admin'), 'chits': 'syrian:event_ssm_strike'}, '17.2': at('golan73', 2, 'admin', True),
        '17.21': {**at('golan73', 2, 'admin', True), 'chits': 'israeli:event_arriving_battalion'}, '17.22': {**at('golan73', 3, 'admin', True), 'chits': 'israeli:event_dugman5'},
        '17.23': B(chits='israeli:event_lt_zvika'), '17.24': B(chits='israeli:event_king_hassan'),
        '17.3': B(chits='event_ew,event_counterbattery'), '17.31': {**at('golan73', 2, 'admin'), 'chits': 'replacement_arm'}, '17.32': {**at('golan73', 2, 'admin'), 'chits': 'replacement_mech'},
        '17.33': B(chits='event_ew'), '17.34': B(chits='event_counterbattery,artillery'), '17.35': {**at('golan73', 2, 'admin'), 'chits': 'special_action_event'},
        '17.4': {**at('golan73', 2, 'admin'), 'chits': 'special_action_event,event_ew,event_counterbattery'},
        '18.1': {**at('golan73', 2, 'supply'), 'rules': 'fwMaintain'}, '18.2': {**at('golan73', 2, 'movement'), 'rules': 'withdrawal'},
        '18.3': {**at('golan73', 2, 'admin'), 'chits': 'artillery', 'rules': 'artyInterdict,directSupport'}, '18.31': {**at('golan73', 2, 'admin'), 'chits': 'artillery', 'rules': 'artyInterdict'},
        '18.32': B(**{'chits': 'israeli:artillery', 'rules': 'directSupport'}), '18.4': B(chits='syrian:air_mission', rules='syrianAirAttack'),
        '18.5': B(**{'chits': 'israeli:artillery,israeli:armor_asset', 'rules': 'israeliDivisions'}),
        'N18.6': B(chits='syrian:infantry_asset', rules='atAssets'), 'N18.7': {**at('golan73', 2, 'movement'), 'rules': 't62'}, 'N18.8': B(chits='artillery', rules='artyArmor'),
        'N18.9': {**at('golan73', 2, 'supply', True), 'chits': 'israeli:event_lt_zvika', 'rules': 'zvikaCup'}, 'N18.10': B(chits='syrian:commando', rules='raidMod'),
        'N18.11': {**at('golan73', 2, 'supply'), 'rules': 'battleRecovery'},
        'A18.6': B(chits='syrian:infantry_asset', rules='atAssets', scenario='alowda'), 'A18.7': {**at('golan73', 1, 'combat', True), 'battle': 1, 'chits': 'syrian:artillery', 'rules': 'chemical', 'scenario': 'alowda'},
        'A18.8': {**at('golan73', 1, 'combat', True), 'battle': 1, 'rules': 'flank', 'scenario': 'alowda'}, 'A18.9': {**at('golan73', 2, 'movement'), 'rules': 't62', 'scenario': 'alowda'},
        'A18.10': {**at('golan73', 1, 'movement', True), 'rules': 'advGhosts', 'scenario': 'alowda'},
    },
}
# Scenario sections: the scenario they belong to; a deployment section stays in the set-up.
SCEN = {
    'bulge': [('24.1', 'campaign'), ('24.2', 'tournament'), ('24.3', 'intro')],
    'sicily': [('22.1', 'sunrise_bridge'), ('22.2', 'tournament'), ('22.3', 'campaign')],
    'golan73': [('22.1', 'badr'), ('22.2', 'badr_alt'), ('22.4', 'nafakh'), ('20.3', 'alowda')],
}


def volume(game, num, title):
    if num in EXACT[game]: return EXACT[game][num]
    for w, f in WORDS:
        if re.search(w, title): return f(game)
    return {}


def scenario(game, num, title):
    sc = next((s for p, s in SCEN[game] if num.startswith(p)), None)
    r = dict(scenario=sc) if sc else {}
    if re.search(r'Deployment|Setup', title): r['setup'] = 0
    elif re.search(r'Reinforcement', title): r.update(at(game, 2, 'reinforcement'))
    elif re.search(r'Victory', title): r.update(at(game, 3, 'supply'))
    return r


def link(game, num, title, r):
    q = [('sandbox', '1'), ('game', game)] + [(k, str(v)) for k, v in r.items()] + [('case', f'{num} {title}')]
    return SITE + '?' + '&'.join(f'{k}={quote(v, safe=",.:")}' for k, v in q)


def text(sec):
    return '\n\n'.join(p for p in sec['paras'])


def books(game):
    return {b['id']: b for b in json.load(open(os.path.join(ROOT, 'data', game, 'rules.json')))['books']}


def rid(group, num): return f'{group}-{num}'.lower().replace('.', '-')


rows = []
for sec in books('bulge')['series']['sections']:
    num, title = sec['id'], sec['title']
    rows.append(dict(id=rid('s', num), group='Basic', book='Series Rules', num=num, title=title, text=text(sec),
                     links=[[NAME[g], link(g, num, title, series(num, g))] for g in ('bulge', 'sicily', 'golan73')]))
for game, g in (('bulge', 'b'), ('sicily', 's'), ('golan73', 'g')):
    bk = books(game)
    for book in ('exclusive', 'optional', 'scenarios'):
        if book not in bk: continue
        for sec in bk[book]['sections']:
            num, title = sec['id'], sec['title']
            if re.match(r"(Designer|Introduction)", title) and book == 'exclusive' and num in ('10.0', '11.0'): continue
            r = scenario(game, num, title) if book == 'scenarios' else volume(game, num, title)
            rows.append(dict(id=rid(g, num), group=NAME[game], book=bk[book]['title'], num=num, title=title, text=text(sec), links=[['Open the test table', link(game, num, title, r)]]))
assert len({r['id'] for r in rows}) == len(rows), 'duplicate row ids'
json.dump(rows, sys.stdout, ensure_ascii=False)
