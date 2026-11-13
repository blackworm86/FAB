// The battle on screen and the hand: the volume's own panel, the tray of cards, the battle table with its numbers, the dice record and the legend.
import * as E from '../../engine/src';
import { garrisonChit } from './chits';
import { online } from './online';
import { ico } from './icons';
import { esc, nm } from './util';
import { STAGE_NAME, faces } from './table-text';
import { reg, ubtn, btn, chip } from './ui-kit';
import { fxRow } from './fx';
import { RULE } from './rules-text';
import { areaName, P1, P2, VOL } from './page';
import { g } from './game-state';
import { CONTROL_COL, faceDown, hex6, MAPC, seen, setSupEnemy, supEnemy, supplySide, TDN_COL, tint, ZONE_COL } from './map-paint';
import { battleFx, fightable, mine, other, POOL, rollFx, selArr } from './flow';
import { pickSA } from './choices';
import { reinforcing, setReinforcing } from './map-input';
import { endRoll, handSide, rollView, setHandSide } from './rolls';
import { autoFill, card, fan, handInfo, handInspect, handStyle, setHandInfo, setHandInspect, usableNow } from './cards';
import { gx } from './prompt';
import { chitPic } from './pieces-window';
import { panelCtx, svgUri } from './unit-card';
import { b3, sideOfUnit, unitFace } from './map-dock';
import { cutOffCount, modChips, refresh, relayer } from './main';

/** The volume's prompts (set-up, drops, evacuation…). On a phone they fold down to a handle so the map can have the screen; they open again on a tap. */
let volFolded = innerWidth <= 700,
  volFoldKey = '';
export function volPanel() {
  const html = VOL.panel(g, panelCtx());
  if (!html) return '';
  const k = `${g.turn}${g.phasing}${g.phase}`;
  if (k !== volFoldKey) {
    volFoldKey = k;
    volFolded = innerWidth <= 700;
  } // phones: each step starts folded, the map first; a tap on the handle opens the prompts
  if (!html.includes('class="volstack"') || innerWidth > 700) return html;
  const n = (html.match(/class="volpanel"/g) ?? []).length,
    title = /<b>(?:<svg[\s\S]*?<\/svg>)?\s*([^<(]+)/.exec(html)?.[1]?.trim() ?? 'Instructions';
  const fold = `<button class="volfold" aria-expanded="${!volFolded}" data-ui="${reg(() => {
    volFolded = !volFolded;
  })}">${ico(volFolded ? 'next' : 'close')}<span>${volFolded ? esc(title) + (n > 1 ? ` +${n - 1}` : '') : 'Hide'}</span></button>`;
  return volFolded ? `<div class="volstack folded">${fold}</div>` : html.replace('<div class="volstack">', `<div class="volstack">${fold}`);
}
function tray() {
  const ids = g.phase === 'deploy' ? VOL.pendingPlace(g) : g.pendingArrivals,
    us = ids
      .map((id) => g.units.find((x) => x.id === id)!)
      .filter((u) => mine(u.side))
      .filter((u, _, all) => g.phase !== 'deploy' || u.side === g.phasing || !all.some((x) => x.side === g.phasing)),
    tf = g.phase === 'deploy' ? [] : g.tfNew.map((id) => E.chit(g, id)).filter((c) => mine(c.side));
  if (!us.length && !tf.length) return '';
  const pool = g.phase === 'deploy' ? us.filter((u) => u.untried) : [],
    open = us.filter((u) => !pool.includes(u));
  const back = svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" fill="${hex6(VOL.wood[pool[0]?.nation ?? pool[0]?.side ?? ''] ?? 0x9a8a6a)}"/></svg>`,
  ); // the plain wood of a block lying face down
  const stack = pool.length
    ? `<button class="arr ${selArr === POOL ? 'sel' : ''}" data-arr="${POOL}" title="Coastal garrisons, face down: the one placed is drawn at random">${b3(back, sideOfUnit(pool[0]))}<small>Coastal garrison ×${pool.length}</small></button>`
    : '';
  return `<div class="arrtray" role="group" aria-label="${g.phase === 'deploy' ? 'Blocks to place' : 'Arriving reinforcements'}">${stack}${open.map((u) => `<button class="arr ${u.id === selArr ? 'sel' : ''}" data-arr="${u.id}" title="${esc(u.name)}">${b3(unitFace(u), sideOfUnit(u), !!u.garrison)}<small>${esc(u.name)}</small></button>`).join('')}${tf.map((c) => `<button class="arr ${c.id === selArr ? 'sel' : ''}" data-arr="${c.id}" title="Task Force">${b3(svgUri(garrisonChit('Task Force', `${c.turn}-*`, false)), 'allied', true)}<small>Task Force</small></button>`).join('')}</div>`;
}
/** One slim line above the hand: what the chosen card does and whether it can join, without covering the map. */
function cardTip() {
  const c = handInspect ? g.chits.find((x) => x.id === handInspect) : null,
    b = g.battle;
  if (!c || !b) return '<div class="cardtip"><span>Tap a card to read its rule.</span></div>';
  const [t, d] = RULE[VOL.ruleKey(c.kind, c)] ?? [c.kind, ''],
    why = VOL.battleUse(g, b, c);
  return `<div class="cardtip">${chitPic(c)}<div><b>${esc(c.name)} <small>${esc(t)}</small></b><span>${esc(d.split('\n')[0])}</span>${why ? `<em>Cannot join: ${esc(why)}</em>` : '<em class="ok">Can join this battle</em>'}</div></div>`;
}
let handAll = false;
export function handCards() {
  const b = g.battle;
  if (!b && (g.phase === 'reinforcement' || g.phase === 'deploy')) return tray();
  if (b) {
    if (b.stage !== 'setup') return '';
    const cs = ([b.attacker, other(b.attacker)] as E.Side[])
      .filter((sd) => mine(sd) && !b.ready?.includes(sd))
      .sort() /* a side that confirmed its set-up no longer sees its cards */
      .flatMap((s) => E.boxOf(g, s, 'available').filter((c) => VOL.battleCard(c)));
    const ok = cs.filter((c) => !VOL.battleUse(g, b, c));
    const bad = cs.filter((c) => VOL.battleUse(g, b, c)),
      canCancel = mine(b.attacker); /* the attacker may call the battle off until combat begins (unless a Special Action locked it) */
    if (!cs.length && !canCancel) return ''; // the defender with no card: no empty tray
    return `<div class="handtab">${
      canCancel
        ? btn(
            `${ico('close')}<span class="bl">Cancel</span>`,
            () => {
              E.cancelBattle(g);
            },
            'ico danger',
            !!b.locked,
            b.locked ? 'A Special Action was spent, so the battle must be fought' : 'Withdraw the attack and return every assigned asset',
          )
        : ''
    }${
      ok.length && bad.length
        ? `<button data-ui="${reg(() => {
            handAll = !handAll;
          })}" aria-pressed="${handAll}">${handAll ? `Playable only (${ok.length})` : `Show all`}</button>`
        : ''
    }<button class="ico ${handInfo ? 'on' : ''}" data-ui="${reg(() => {
      setHandInfo(!handInfo);
      if (!handInfo) setHandInspect(null);
    })}" aria-pressed="${handInfo}" title="Rules: tap a card to read what it does instead of adding it" aria-label="Rules">${ico('book')}<span class="bl">Rules</span></button>${ok.length ? btn(`${ico('wand')}<span class="bl">Auto-fill</span>`, () => autoFill(g.battle!), 'ico', false, 'Auto-fill: place every asset that can legally join, artillery first') : ''}</div>${handInfo ? cardTip() : ''}<div class="c-hand" ${handStyle(handAll || !ok.length ? ok.length + bad.length : ok.length)}>${fan([...ok.map((c) => card(c)), ...(handAll || !ok.length ? bad.map((c) => card(c, 0, VOL.battleUse(g, b, c))) : [])])}</div>`;
  }
  if (g.phase !== 'admin') return '';
  const own = online.active && !online.both() ? online.mySide() : null,
    s = handSide ?? own ?? (g.battle && !mine(g.phasing) ? other(g.phasing) : g.phasing),
    cs = [...E.boxOf(g, s, 'available')].sort((x, y) => x.kind.localeCompare(y.kind) || x.name.localeCompare(y.name));
  const live = cs.filter((c) => usableNow(c)),
    rest = cs.filter((c) => !usableNow(c)),
    shown = handAll || !live.length ? [...live, ...rest] : live; // the cards you can play now first; the rest on request
  const more =
    live.length && rest.length
      ? `<button data-ui="${reg(() => {
          handAll = !handAll;
        })}" aria-pressed="${handAll}">${handAll ? `Playable only (${live.length})` : `Show all`}</button>`
      : '';
  return `<div class="handtab"><button data-ui="${reg(() => {
    setHandSide(other(s));
  })}" class="${s}">${nm(s)} hand · ${cs.length} ${ico('swap')}</button>${more}</div><div class="c-hand" ${handStyle(shown.length)}>${fan(shown.map((c) => card(c)))}</div>`;
}
function stats(b: E.Battle, s: E.Side) {
  const ls = (['arty', 'ground'] as const).flatMap((k) => E.fireList(g, b, s, k)),
    pmf = E.hitPmf(ls.map((f) => ({ dice: f.dice, sn: f.sn })));
  return { mean: E.meanHits(pmf), p: (n: number) => Math.round(E.probAtLeast(pmf, n) * 100) };
}
export function battleTable() {
  const b = g.battle;
  if (!b) return '';
  const L = E.areas.get(b.area)!,
    att = b.attacker,
    setup = b.stage === 'setup';
  const side = (s: E.Side) => {
    const us = E.unitsIn(g, b.area, s),
      lim = VOL.limits(g, b, s),
      ids = b.assets[s].map((id) => E.chit(g, id)),
      airs = E.airOf(b, s);
    const arty = ids.filter((c) => E.isArty(c)).length + airs.filter((a) => a.mode === 'arty').length,
      rest = ids.length - ids.filter((c) => E.isArty(c)).length;
    return `<div class="bside ${s} ${mine(s) ? 'mine' : 'theirs'}"><h4 title="${nm(s)} ${s === att ? 'attacking' : 'defending'}"><span class="tag">${VOL.tag[s]}</span><small class="role">${s === att ? 'attacks' : 'defends'}</small>${online.active && !online.both() ? `<small>${mine(s) ? 'you' : 'foe'}</small>` : ''}</h4>
      ${arty || setup ? `<span class="chp" title="Artillery assigned">${ico('artillery')}${arty}/${lim.arty}<small>arty</small></span>` : ''}${rest || setup ? `<span class="chp" title="Battle assets and events">${ico('armor_asset')}${rest}<small>assets</small></span>` : ''}
      </div>`;
  };
  const saRow = (() => {
    const s = other(att),
      us = E.unitsIn(g, b.area, s);
    if (!setup || !b.defSA) return '';
    return `<div class="bsarow ${saOpen || reinforcing ? 'open' : ''}"><small class="gx">${nm(s)} Special Action</small>${ubtn(
      `${ico('plus')}<span>Special Action…</span>`,
      () => {
        saOpen = !saOpen;
      },
      `satog ${saOpen ? 'on' : ''}`,
      !mine(s),
      'Retreat before combat or bring in a neighbouring block (uses a Special Action)',
    )}<span class="sabtns">${btn(`${ico('back')}<span class="bsa">Retreat (SA)</span>`, () => pickSA(s, us[0]?.ech, (sa) => E.defenderRetreatSA(g, g.battle!, sa)), 'ico', !mine(s) || !us.some((u) => !u.garrison), 'Retreat before combat (8.24): uses a Special Action; your units leave without disorder, garrisons stay; the attacker gets an exploitation chance')}${ubtn(
      `${ico('plus')}<span class="bsa">Reinforce (SA)</span>`,
      () => {
        setReinforcing(!reinforcing);
        refresh();
      },
      `ico ${reinforcing ? 'on' : ''}`,
      !mine(s),
      'Bring in a neighbouring block (uses a Special Action)',
    )}</span></div>`;
  })();
  const covered = E.unitsIn(g, b.area).some((u) => !seen(u)),
    al = stats(b, P2),
    ge = stats(b, P1),
    tot = al.mean + ge.mean || 1;
  return `<div class="c-table slim ${rollView ? 'rolling' : ''}">${side(P2)}<div class="bmid"><div class="c-title">${g.fought.length + fightable().length > 1 ? `<small class="cnt" title="Battle ${g.fought.includes(b.area) ? g.fought.indexOf(b.area) + 1 : g.fought.length + 1} of ${g.fought.length + fightable().length}">Battle ${g.fought.includes(b.area) ? g.fought.indexOf(b.area) + 1 : Math.min(g.fought.length + 1, g.fought.length + fightable().length)}/${g.fought.length + fightable().length}</small>` : ''}${b.bt ? '<small class="cnt" title="Breakthrough combat">BT</small>' : ''}<b>${esc(L.name)}</b><span class="chp" title="Terrain defence number ${L.tdn}: attackers −${L.tdn} to hit">${ico('tree')}${L.tdn}</span>${g.fieldWorks.includes(b.area) ? `<span class="chp" title="Field works">${ico('gear')}</span>` : ''}${b.riverAssault ? `<span class="chp" title="River assault">${ico('wave')}</span>` : ''}</div>
    <div class="c-vs">${b.stage === 'done' ? '' : covered ? '<div class="big">?<span>:</span>?</div>' : `<small class="vlbl">expected hits</small><div class="big" title="Expected hits per combat round: ${nm(P2)} : ${nm(P1)}"><small class="xs al">${VOL.tag[P2]}</small>${al.mean.toFixed(1)}<span>:</span>${ge.mean.toFixed(1)}<small class="xs ge">${VOL.tag[P1]}</small></div>${gx('<small class="xcap">expected hits per round</small>')}<div class="gauge" title="${esc(`Filled: ${nm(P2)} share of the expected hits · empty: ${nm(P1)}`)}"><i style="width:${(al.mean / tot) * 100}%"></i></div>`}</div></div>${side(P1)}${saRow}${setup ? engChoice(b) : ''}${setup && refusal ? `<div class="refuse">${ico('xbold')}<span><b>Not allowed:</b> ${esc(refusal)}</span></div>` : ''}</div>`;
}
/** 6.33: an attacking engineer in a battle with enemy field works either fires or removes them; two plain buttons, chosen at set-up (or before offensive fire). */
function engChoice(b: E.Battle): string {
  if (
    !b.assets[b.attacker].some((id) => E.chit(g, id).kind === 'engineer') ||
    !g.fieldWorks.includes(b.area) ||
    (g.fwOwner[b.area] ?? other(b.attacker)) === b.attacker ||
    !['setup', 'attArty', 'defArty', 'defFire', 'offFire'].includes(b.stage)
  )
    return '';
  const own = mine(b.attacker),
    pickB = (on: boolean, label: string) =>
      `<button class="${b.engFw === on ? 'on' : ''}" ${own ? `data-do="${reg(() => E.setEngFw(g, g.battle!, on))}"` : 'disabled'} aria-pressed="${b.engFw === on}">${label}</button>`;
  return `<div class="engch"><b>Engineer (6.33)</b>${gx(' · the defenders sit in field works. If the engineer survives artillery and defensive fire, it can remove them just before your units fire (no −1 then), instead of firing itself. Choose before offensive fire:', ' vs FW:')}<div class="row">${pickB(false, gx('Fire with the ground units', 'Fire'))}${pickB(true, gx('Remove the field works', 'Remove FW'))}</div></div>`;
}
export let refusal = '',
  saOpen = false; // the last refused battle chit, shown in the set-up panel
export const setRefusal = <T extends typeof refusal>(v: T): T => ((refusal = v), v);
/** Every roll of this battle so far, newest first: who rolled, against what, and the faces; it stays with the battle until it ends. */
function rollRecord(b: E.Battle, open = false) {
  if (!b.rolls.length) return '';
  const rows = [...b.rolls]
    .reverse()
    .map(
      (r) =>
        `<div class="rr"><span class="who">${esc(r.who)}</span><span class="sn">SN ${r.sn}</span>${faces(r.dice, r.sn)}<b class="${r.hits ? 'hit' : 'miss'}">${r.hits}${r.kind === 'morale' ? (r.hits ? ' pass' : ' fail') : ` hit${r.hits === 1 ? '' : 's'}`}</b></div>`,
    )
    .join('');
  return `<details class="rrec" ${open ? 'open' : ''}><summary>${ico('dice')} Dice so far <small>${b.rolls.length} roll${b.rolls.length === 1 ? '' : 's'}</small></summary>${rows}</details>`;
}
export function ledger() {
  const b = g.battle;
  if ((!b || g.pendingBlow) && !rollView?.check) return '';
  if (rollView) {
    const rv = rollView,
      hits = rv.groups.reduce((a, x) => a + x.hits, 0);
    return `<div class="c-ledger tight" data-ui="${reg(() => {
      if (rollView?.pos) endRoll();
    })}" title="Tap to continue"><div class="lh"><h3>${esc(rv.title)}</h3><b class="tot ${hits ? 'hit' : 'miss'}">${rv.pos ? (rv.morale ? `${hits} of ${rv.groups.length} pass` : `${hits} hit${hits === 1 ? '' : 's'}`) : '…'}</b></div>${rv.remote && !rv.pos ? `<p class="hint">${ico('dice')} The other player is rolling…</p>` : ''}${rv.pos ? rollFx.map(fxRow).join('') : ''}${rv.groups.map((x) => `<div class="ln2"><span class="who">${esc(x.label)}</span><span class="sn">SN ${x.sn}</span>${rv.pos ? faces(x.dice, x.sn) : `<span class="cnt">${x.dice.length}${ico('dice')}</span>`}<b class="${x.hits ? 'hit' : 'miss'}">${x.hits}</b>${x.parts.length ? `<span class="chips2">${modChips(x.parts)}</span>` : ''}</div>`).join('')}
      </div>`;
  }
  if (!b || g.pendingBlow) return '';
  if (b.stage === 'exploit') {
    // 6.8: the attacker rolls a morale check for each armor-class unit, or declines
    const us = (b.exploitIds ?? []).map((id) => g.units.find((x) => x.id === id)!).filter((u) => u.area === b.area),
      mineStep = !online.active || online.both() || online.mySide() === b.attacker;
    return `<div class="c-ledger tight"><div class="lh"><h3 class="${b.attacker}">Exploitation!</h3></div><p class="resline">${esc(b.result ?? '')}</p><p class="hint gx">6.8: each attacking armor-class unit makes a morale check. A pass marks it for exploitation: it may move again in the Breakthrough Phase.</p>
      ${us.map((u) => `<div class="fl"><span class="who">${esc(!faceDown(u) ? u.name : 'Hidden block')}</span><span class="cnt">1${ico('dice')}</span><b class="sn">needs ${E.exploitSn(g, u)} or less</b></div>`).join('')}
      ${mineStep ? `<div class="row">${btn('Decline (stay hidden)', () => E.declineExploit(g, b), '', false, '6.8: you may decline the opportunity and keep the blocks hidden')}</div>` : `<p class="hint">Waiting for the ${nm(b.attacker)} player to roll.</p>`}</div>`;
  }
  if (b.stage === 'done')
    return `<div class="c-ledger tight aar"><div class="lh"><h3>Battle over · ${esc(areaName(b.area))}</h3></div><p class="resline">${esc(b.result ?? '')}</p>${battleFx.length ? `<div class="aarfx">${battleFx.map(fxRow).join('')}</div>` : '<p class="hint">No losses on either side.</p>'}${rollRecord(b, true)}</div>`;
  if (b.stage.endsWith('Choice')) {
    const sd = b.stage === 'attChoice' ? b.attacker : other(b.attacker); // the bubble on the table holds the choice; the report keeps the dice that caused it
    return `<div class="c-ledger tight"><div class="lh"><h3 class="${sd}">${nm(sd)} ${b.pending} hit${b.pending === 1 ? '' : 's'} to take</h3></div>${rollRecord(b, true)}</div>`;
  }
  if (b.stage === 'retreat' && b.retreat) return ''; // the lit areas on the table are the choice
  if (STAGE_NAME[b.stage]) {
    // fire step: who rolls, what, against which number and why
    const sd = b.stage === 'attArty' || b.stage === 'offFire' ? b.attacker : other(b.attacker),
      fl = E.fireList(g, b, sd, b.stage.endsWith('Arty') ? 'arty' : 'ground'),
      mineStep = !online.active || online.both() || online.mySide() === sd;
    const lines =
      fl
        .map(
          (f) =>
            `<div class="fl"><span class="who">${esc(f.who)}</span><span class="cnt" title="${f.dice} dice to roll">${f.dice}${ico('dice')}</span><b class="sn">SN ${f.sn}</b><span class="chips2">${modChips(f.parts)}</span></div>`,
        )
        .join('') || '<p class="hint">Nothing can fire.</p>';
    return `<div class="c-ledger tight"><div class="lh"><h3 class="${sd}">${nm(sd)} ${esc(STAGE_NAME[b.stage].toLowerCase())}</h3></div>${b.stage === 'offFire' && engChoice(b) ? engChoice(b) : ''}${lines}${mineStep ? '' : `<p class="hint">Waiting for the ${nm(sd)} player to roll…</p>`}${rollRecord(b)}</div>`;
  }
  return '';
}
export function legend() {
  if (tint === 'off') return '';
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
  const items =
    tint === 'supply'
      ? [
          [VOL.controlCol[supplySide()] ?? 0xffffff, 'In supply', 'linked to a source'],
          [MAPC.cut, `Cut off (${cutOffCount(supplySide())})`, 'hatched: no path to a source'],
          [0xe7b04a, 'Supply source', 'labelled on the map'],
        ]
      : tint === 'control'
        ? [
            [CONTROL_COL[P2], nm(P2), 'control'],
            [CONTROL_COL[P1], nm(P1), 'control'],
            [CONTROL_COL.contested, 'Contested', 'both sides present'],
          ]
        : tint === 'tdn'
          ? TDN_COL.map((c, i) => [c, `TDN ${i}`, i ? `attackers −${i} to hit` : 'no modifier'])
          : [
              [ZONE_COL[5], 'Zone 5', '5th Panzer Army'],
              [ZONE_COL[6], 'Zone 6', '6th Panzer Army'],
              [ZONE_COL[7], 'Zone 7', '7th Army'],
            ];
  const whose =
    tint === 'supply'
      ? `<div class="chips">${chip('Yours', !supEnemy, () => {
          setSupEnemy(false);
          relayer();
        })}${chip('Enemy', supEnemy, () => {
          setSupEnemy(true);
          relayer();
        })}</div>`
      : '';
  return `<div class="legend" aria-label="Overlay legend"><b>${tint === 'tdn' ? 'Terrain defence' : tint === 'control' ? 'Area control' : tint === 'supply' ? `Supply · ${nm(supplySide())}` : 'Army zones'}</b>${whose}${items.map(([c, a, b]) => `<span><i style="background:${hex(c as number)}"></i>${a} <small>${b}</small></span>`).join('')}</div>`;
}
