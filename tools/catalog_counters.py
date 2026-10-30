"""Build data/bulge/counters.json from the hand-read counter sheet (ids = sheet+row+col, see assets/counters/raw/)."""
import cv2, json, numpy as np
RAW = '../assets/counters/raw/'
P6, A5, A7, GSR = 'de_6pz', 'de_5pz', 'de_7a', 'de_sr'     # German Higher Echelons (purple, grey, blue, orange)
U1, U3, USR, BR = 'us_1a', 'us_3a', 'us_sr', 'br_xxx'      # Allied Higher Echelons (light green, dark green, light blue, tan)
def t(i, kind, ech, turn, name, **kw): return dict(id=i, kind=kind, echelon=ech, turn=turn, name=name, **kw)
C = []
# ---- left sheet ----
C += [t('L11','infantry_asset',GSR,2,'v.d. Heydte',cls='infantry',airborne=True,drop_areas=[31,52]),
 t('L12','rocket_artillery',P6,'S','9th'), t('L13','rocket_artillery',P6,'S','17th'), t('L14','artillery',P6,'S','402nd'), t('L15','artillery',P6,'S','405th'), t('L16','artillery',P6,'S','388th'),
 t('L17','replacement_inf',P6,2,'Non-Elite Inf Repl'), t('L18','replacement_inf',P6,6,'Non-Elite Inf Repl'), t('L19','replacement_arm',P6,5,'Non-Elite Arm Repl'),
 t('L21','armor_asset',P6,6,'301 + 506'), t('L22','armor_asset',P6,2,'394 + 653 + 667'), t('L23','armor_asset',P6,5,'519 + 521'), t('L24','armor_asset',P6,2,'217 + 1000 + 1001'),
 t('L25','rocket_artillery',P6,'S','4th'), t('L26','engineer',P6,'S','62 + 73'),
 t('L27','replacement_inf',A5,3,'Non-Elite Inf Repl'), t('L28','replacement_inf',A5,6,'Non-Elite Inf Repl'), t('L29','replacement_arm',A5,5,'Non-Elite Arm Repl'),
 t('L31','rocket_artillery',A5,'S','15th'), t('L32','rocket_artillery',A5,'S','16th'), t('L33','artillery',A5,'S','401st'), t('L34','artillery',A5,'S','766th'),
 t('L35','armor_asset',A5,3,'741 + 902'), t('L36','rocket_artillery',A5,'S','7th'),
 t('L37','replacement_inf',A7,4,'Non-Elite Inf Repl'), t('L38','replacement_inf',A7,7,'Non-Elite Inf Repl'), t('L39','replacement_inf',GSR,8,'Non-Elite Inf Repl'),
 t('L41','engineer',A5,'S','207 + 600'), t('L42','infantry_asset',A7,2,'44 + 669'), t('L43','rocket_artillery',A7,'S','8th'), t('L44','rocket_artillery',A7,'S','18th'),
 t('L45','artillery',A7,'S','406th'), t('L46','artillery',A7,'S','408th'), t('L47','engineer',A7,'S','47 + 605'),
 t('L48','replacement_inf',U1,3,'Non-Elite Inf Repl'), t('L49','command_staff',GSR,3,'Command HQ Staff Asset'),
 t('L51','artillery',BR,7,'5 AGRA'), t('L52','artillery',BR,7,'4 AGRA'), t('L53','armor_asset',BR,6,'29th'), t('L54','armor_asset',BR,6,'34th'), t('L55','armor_asset',BR,8,'33rd'),
 t('L56','rebuild_or_replace_inf',U1,3,'Non-Elite Rebuild or Repl'), t('L57','replacement_inf',U1,6,'Non-Elite Inf Repl'), t('L58','replacement_inf',U1,7,'Non-Elite Inf Repl'), t('L59','replacement_inf',U1,8,'Non-Elite Inf Repl'),
 t('L61','artillery',U1,2,'187th'), t('L62','artillery',U1,2,'333rd'), t('L63','engineer',USR,2,'35th'), t('L64','artillery',U1,2,'402nd'), t('L65','engineer',USR,2,'159th'),
 t('L66','rebuild_or_replace_arm',U1,4,'Non-Elite Rebuild or Repl'), t('L67','replacement_arm',U1,6,'Non-Elite Arm Repl'), t('L68','replacement_arm',U1,7,'Non-Elite Arm Repl'), t('L69','replacement_arm',U1,8,'Non-Elite Arm Repl'),
 t('L71','artillery',U1,2,'406th'), t('L72','infantry_asset',USR,4,'509 + 551',airborne=True), t('L73','artillery',U1,2,'174th'), t('L74','artillery',U1,4,'190th'), t('L75','artillery',U1,7,'18th'), t('L76','artillery',U1,7,'188th'),
 t('L77','replacement_arm',U1,9,'Non-Elite Arm Repl'), t('L78','artillery',U1,8,'179th'), t('L79','engineer',USR,2,'146th'),
 t('L81','armor_asset',U1,4,'705 + 740'), t('L82','infantry_asset',U1,6,'29 + 118'), t('L83','engineer',USR,3,'158th'), t('L84','engineer',USR,6,'Thrasher'), t('L85','artillery',U1,7,'142nd'),
 t('L86','armor_asset',U1,7,'628th'), t('L87','engineer',USR,3,'299th'), t('L88','engineer',USR,2,'168th'), t('L89','engineer',USR,2,'44th'),
 t('L91','replacement_inf',U3,7,'Non-Elite Inf Repl'), t('L92','replacement_inf',U3,8,'Non-Elite Inf Repl'), t('L93','replacement_inf',U3,9,'Non-Elite Inf Repl'), t('L94','replacement_arm',U3,7,'Non-Elite Arm Repl'), t('L95','replacement_arm',U3,8,'Non-Elite Arm Repl'),
 t('L96','garrison',USR,'scenario','Wiltz',area=38), t('L97','garrison',USR,'scenario','St. Vith',area=23), t('L98','command_staff','allied',3,'Command HQ Staff Asset'),
 t('L99','reserve_marker','allied',None,'Zone 7 Reserve Unit',zones=[7]),
 t('L101','armor_asset',U3,7,'602 + 654'), t('L102','artillery',U3,7,'177th'), t('L103','artillery',U3,6,'182nd'), t('L104','artillery',U3,7,'193rd'), t('L105','artillery',U3,7,'203rd'),
 t('L106','garrison',USR,'scenario','Spa',area=32), t('L107','garrison',USR,'scenario','Bastogne',area=47),
 t('L108','reserve_marker','allied',None,'Zone 7 Reserve Unit',zones=[7]), t('L109','reserve_marker','allied',None,'Zones 5/6 Reserve Unit',zones=[5,6])]
# ---- right sheet ----
C += [t('R11','event_release',GSR,5,'11th Pz Div Released'), t('R12','event_release',GSR,5,'10th SS Pz Div Released'), t('R13','event_release',GSR,8,'17th SS Pz Gr Div Released'), t('R14','event_release',GSR,8,'6th SS Mtn Div Released'),
 t('R15','event_greif_bridge','german',2,'Greif Team Bridge'), t('R16','event_greif_bridge','german',3,'Greif Team Bridge')]
C += [t(f'R1{i}','fuel','german','S','Fuel Asset') for i in (7,8,9)]
C += [t('R21','event_bodenplatte','german',7,'Operation Bodenplatte'), t('R22','event_delayed_response','german',7,'Delayed Response'), t('R23','event_delayed_response','german',8,'Delayed Response'), t('R24','event_delayed_response','german',9,'Delayed Response'),
 t('R25','event_greif_interdict','german',2,'Greif Team Interdict'), t('R26','event_greif_interdict','german',3,'Greif Team Interdict'),
 t('R27','fuel','german','S','Fuel Asset'), t('R28','fuel','german','S','Fuel Asset'), t('R29','fuel','german',None,'Captured Fuel Asset')]
C += [t('R31','event_arriving_regiment',U1,2,'Regt only for 4th Inf Div',division='4th Inf'), t('R32','event_delayed_response','allied',2,'Delayed Response'), t('R33','event_delayed_response','allied',3,'Delayed Response'), t('R34','event_delayed_response','allied',4,'Delayed Response'),
 t('R35','event_arriving_regiment',U1,3,'Regt only for 1st Inf Div',division='1st Inf'), t('R36','event_arriving_regiment',U1,4,'Regt only for 1st Inf Div',division='1st Inf'), t('R37','event_arriving_regiment',U1,5,'Regt only for 1st Inf Div',division='1st Inf'),
 t('R38','special_action_event',P6,4,'Special Action'), t('R39','special_action_event',P6,6,'Special Action')]
C += [t('R41','air_mission','allied',6,'Air Mission'), t('R42','air_mission','allied',7,'Air Mission'), t('R43','air_mission','allied',7,'Air Mission'),
 t('R44','special_action_event',U3,7,'Special Action'), t('R45','special_action_event',U3,7,'Special Action'), t('R46','special_action_event',U1,5,'Special Action'), t('R47','special_action_event',U1,6,'Special Action'),
 t('R48','special_action_event',A5,3,'Special Action'), t('R49','special_action_event',A5,3,'Special Action')]
for i, tn in zip((1,2,3,4,5,6), (7,8,6,7,7,7)): C.append(t(f'R5{i}','air_mission','allied',tn,'Air Mission'))
C += [t('R57','reserve_marker','german',None,'Zone 5 Reserve Unit',zones=[5]), t('R58','reserve_marker','german',None,'Zone 6 Reserve Unit',zones=[6]), t('R59','reserve_marker','german',None,'Zone 6 Reserve Unit',zones=[6])]
for i, tn in zip((1,2,3,4,5), (8,9,8,8,9)): C.append(t(f'R6{i}','air_mission','allied',tn,'Air Mission'))
C += [t('R66','marker','none',None,'Game Turn'), t('R67','marker','german',None,'Boundary Crossing'), t('R68','reserve_marker','german',None,'Zone 5 Reserve Unit',zones=[5]), t('R69','reserve_marker','german',None,'Zone 7 Reserve Unit',zones=[7])]
C += [t('R71','task_force',USR,2,'Task Force'), t('R72','task_force',USR,2,'Task Force')] + [t(f'R7{i}','marker_vp','german',None,'German VP') for i in range(3,9)] + [t('R79','marker','german',None,'VPs')]
C += [t('R81','task_force',USR,3,'Task Force'), t('R82','task_force',USR,4,'Task Force'), t('R83','task_force',USR,5,'Task Force')] + [t(f'R8{i}','marker_vp','german',None,'German VP') for i in range(4,9)] + [t('R89','marker','german',None,'Remaining German Bridge Repairs')]
for row in (9, 10):
    C += [t(f'R{row}1','reserve_marker','allied',None,'Zones 5/6 Reserve Unit',zones=[5,6]), t(f'R{row}2','marker','none',None,'River Assault'), t(f'R{row}3','marker','none',None,'River Assault')]
    C += [t(f'R{row}{i}','marker','none',None,'Disordered / Recovering') for i in range(4,10)]
C += [t(f'Rx{i}','marker','none',None,'Exploitation') for i in range(1,9)] + [t(f'Rb{i}','fuel_bid','german',None,'Bid Fuel Asset') for i in (1,2)]
# ---- quality dot (colour above the symbol: red elite, black veteran, white green) ----
def dot(i):
    im = cv2.imread(RAW + i + '.png'); reg = im[6:34, 60:102].astype(int)
    bg = np.median(reg.reshape(-1, 3), 0); m = (np.abs(reg - bg).sum(2) > 110).astype(np.uint8)
    n, cc, st, cen = cv2.connectedComponentsWithStats(m)
    best = [j for j in range(1, n) if 40 < st[j, 4] < 400 and 0.6 < st[j, 2] / max(1, st[j, 3]) < 1.7]
    if not best: return None
    j = max(best, key=lambda j: st[j, 4]); cx, cy = map(int, cen[j]); p = reg[max(0, cy - 2):cy + 3, max(0, cx - 2):cx + 3].reshape(-1, 3).mean(0); b_, g_, r_ = p
    if r_ > 150 and g_ < 110 and b_ < 110: return 'elite'
    if p.mean() < 100: return 'veteran'
    if p.min() > 215: return 'green'
    return None
FIX = {'L21': 'elite', 'L96': 'green', 'L97': 'green', 'L106': 'green', 'L107': 'green', 'R71': 'green', 'R72': 'green', 'R81': 'green', 'R82': 'green', 'R83': 'green'}
for c in C:
    if c['kind'] in ('artillery', 'rocket_artillery'): c['class'] = 'infantry'
    if c['kind'] in ('engineer', 'armor_asset', 'infantry_asset', 'garrison', 'task_force'):
        c['quality'] = FIX.get(c['id']) or dot(c['id'])
        c['class'] = 'armor' if c['kind'] == 'armor_asset' else 'infantry'
    c['image'] = f'assets/counters/raw/{c["id"]}.png'
json.dump(C, open('../data/bulge/counters.json', 'w'), indent=1, ensure_ascii=False)
from collections import Counter
print(len(C), Counter(c['kind'] for c in C))
print([(c['id'], c['name'], c.get('quality')) for c in C if 'quality' in c][:60])
