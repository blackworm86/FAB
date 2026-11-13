// Drawing the pieces: where figures face and stand, the battle table, and every block, figure and marker on the map.
import * as THREE from 'three';
import * as E from '../../engine/src';
import { troopOf, troopGroup, radius as troopR, arrange, yawOf } from './troops';
import { borderAngle, borderMid, cellsOf, first, MAP, near, P1, pole, POLE, toWorld, VOL } from './page';
import { g, selUnit } from './game-state';
import {
  block,
  CHIT,
  chit3d,
  disc,
  discSprite,
  disposeAll,
  markers,
  outlineRibbon,
  pieces,
  tag,
  troopSize,
  wantTroops,
  woodOf,
} from './piece-kit';
import { coveredLabels, faceDown, farSide, fightable, MAPC, mine, other, seen, tgt, viewRot } from './main';

// ---- where figures face and stand (docs/ASSETS-3D.md): the way they last moved, toward the attacker, toward the nearest enemy ----
const CTR = new Map<number, THREE.Vector3>(),
  ctr = (id: number) => CTR.get(id) ?? (CTR.set(id, toWorld(...pole(MAP.areas.find((x) => x.id === id)!.polygon))), CTR.get(id)!);
const yawTo = (dx: number, dz: number) => Math.atan2(dx, dz); // a figure is modelled facing +z
/** A contested area: the attacking side (the battle's, else the side that moved in, the phasing side first) and the way it came from. */
const frontOf = (id: number, us: E.Unit[]): { att: E.Side; v: [number, number] } => {
  const came = (sd: E.Side) => us.filter((u) => u.side === sd && u.from != null && u.from !== id && MAP.areas.some((x) => x.id === u.from));
  const sides = [...new Set(us.map((u) => u.side))];
  const att =
    g.battle?.area === id
      ? g.battle.attacker
      : came(g.phasing).length
        ? g.phasing
        : (sides.find((sd) => came(sd).length) ?? (sides.includes(g.phasing) ? g.phasing : sides[0]));
  const c0 = ctr(id);
  let vx = 0,
    vz = 0;
  for (const u of came(att)) {
    const q = ctr(u.from!);
    vx += q.x - c0.x;
    vz += q.z - c0.z;
  }
  if (Math.hypot(vx, vz) < 1e-6) {
    const y = sideYaw(att);
    vx = -Math.sin(y);
    vz = -Math.cos(y);
  } // no move recorded: from the attackers' own side of the front
  const l = Math.hypot(vx, vz);
  return { att, v: l > 1e-6 ? [vx / l, vz / l] : [0, near(att) ? 1 : -1] };
};
/** A side's usual facing: The Bulge, Germans west and Allies east; the other volumes, toward the other side's edge of the map. */
const sideYaw = (sd: E.Side) => (VOL.id === 'bulge' ? yawOf(sd) : near(sd) ? Math.PI : 0);
/** The order a unit group is laid out in (the first player's units first, strongpoints and garrisons last). */
const orderOf = (us: E.Unit[]) => [...us].sort((p, q) => +(p.side !== P1) - +(q.side !== P1) || +!!p.garrison - +!!q.garrison);
/** Footprint radius of what a unit shows on the table: its figure, or the block while it is hidden. */
export const unitR = (u: E.Unit) => {
  const t = wantTroops() && !faceDown(u) ? troopOf(u.id) : null;
  return t ? troopR(t) : u.garrison ? 0.75 : 0.95;
};
/** Where an area's units stand (world x, z, in `order`): each side in its own part of the area, spread over all its free room, nothing overlapping
 * (`arrange` in troops.ts). front: the attackers and the way they came from (their side is +v); null in a calm area (one group). */
function figSpots(
  id: number,
  order: E.Unit[],
  front: { att: E.Side; v: [number, number] } | null,
  avoid: { x: number; z: number; r: number }[] = [],
) {
  return arrange(
    cellsOf(id),
    order.map((u) => ({ r: unitR(u), group: front && u.side !== front.att ? 1 : 0 })),
    front?.v ?? [0, -1],
    avoid,
    0.15,
  );
}
/** The battle on the table when figures are drawn: the units' spots, and for each side where its cardboard counters go (a row behind its units,
 * along the attack). null with blocks (the block formation keeps its rows). Memoised: the camera and every counter ask for it. */
let battleCache: { key: string; val: ReturnType<typeof battleFigure> } | null = null;
export function battleFig(b: E.Battle) {
  if (!wantTroops()) return null;
  const order = orderOf(E.unitsIn(g, b.area)),
    key = JSON.stringify([b.area, b.attacker, troopSize, order.map((u) => [u.id, u.str, faceDown(u), u.from])]);
  if (battleCache?.key !== key) battleCache = { key, val: battleFigure(b, order) };
  return battleCache.val;
}
function battleFigure(b: E.Battle, order: E.Unit[]) {
  const f = frontOf(b.area, order),
    spots = figSpots(b.area, order, f),
    c0 = toWorld(...POLE.get(b.area)!),
    p: [number, number] = [-f.v[1], f.v[0]];
  const side = (sd: E.Side) => {
    const sg = sd === f.att ? 1 : -1,
      mine = order.map((u, i) => (u.side === sd ? i : -1)).filter((i) => i >= 0);
    const depth = (i: number) => (spots[i].x - c0.x) * sg * f.v[0] + (spots[i].z - c0.z) * sg * f.v[1],
      lat = (i: number) => (spots[i].x - c0.x) * p[0] + (spots[i].z - c0.z) * p[1];
    return {
      sg,
      D: mine.length ? Math.max(...mine.map((i) => depth(i) + unitR(order[i]))) + 0.9 : 1.5,
      lat0: mine.length ? mine.reduce((a, i) => a + lat(i), 0) / mine.length : 0,
    };
  };
  return {
    f,
    p,
    c0,
    order,
    spots,
    side: { [VOL.sides[0]]: side(VOL.sides[0]), [VOL.sides[1]]: side(VOL.sides[1]) } as Record<string, ReturnType<typeof side>>,
  };
}
function battleSpot(b: E.Battle, sd: E.Side, kind: 'unit' | 'asset', i: number, n: number) {
  const base = toWorld(...POLE.get(b.area)!),
    dir = near(sd) ? 1 : -1,
    per = 5,
    row = Math.floor(i / per),
    inRow = Math.min(per, n - row * per),
    col = i % per;
  const units = E.unitsIn(g, b.area, sd).length,
    unitRows = Math.max(1, Math.ceil(units / per)),
    bf = kind === 'asset' ? battleFig(b) : null;
  if (bf) {
    // figures: a row of counters behind the side's units, along the attack
    const s = bf.side[sd],
      lat = s.lat0 + (col - (inRow - 1) / 2) * 1.75,
      d = s.D + row * 1.7;
    return { x: bf.c0.x + lat * bf.p[0] + s.sg * d * bf.f.v[0], z: bf.c0.z + lat * bf.p[1] + s.sg * d * bf.f.v[1] };
  }
  const depth = kind === 'unit' ? 1.35 + row * 1.9 : 1.35 + unitRows * 1.9 + 0.5 + row * 1.7;
  return { x: base.x + (col - (inRow - 1) / 2) * (kind === 'unit' ? 1.95 : 1.75), z: base.z + dir * depth };
}
/** The battle on the table: each side's assigned assets as cardboard counters in a row behind its blocks, with a red cross to take one back before the battle starts. */
function drawBattleTable(b: E.Battle) {
  const base = toWorld(...POLE.get(b.area)!);
  for (const sd of VOL.sides) {
    const live = sd === b.attacker ? ['setup', 'attArty'] : ['setup', 'attArty', 'defArty'],
      spent = (arty: boolean) => arty && !live.includes(b.stage);
    const airs = E.airOf(b, sd),
      all = [...b.assets[sd], ...airs.map((a) => a.id)],
      ids = all.filter((id) => {
        const c = E.chit(g, id);
        return !spent(E.isArty(c) || (c.kind === 'air_mission' && airs.find((a) => a.id === id)?.mode === 'arty'));
      }),
      dir = first(sd) ? 1 : -1; // artillery leaves the table once it has fired
    ids.forEach((id, i) => {
      const m = chit3d(E.chit(g, id)),
        at = battleSpot(b, sd, 'asset', i, ids.length),
        x = at.x,
        z = at.z;
      m.userData.chit = id;
      m.position.set(x, 0.06, z);
      pieces.add(m);
      if (b.stage === 'setup' && mine(sd)) {
        const d = disc('x', 0.42);
        d.position.set(x + 0.5, 0.2, z - 0.5);
        d.userData.chit = id;
        pieces.add(d);
      }
      if (tgt?.units.has(id)) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(1.0, 1.25, 40),
          new THREE.MeshBasicMaterial({ color: MAPC.ring, side: THREE.DoubleSide }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, 0.14, z);
        markers.add(ring);
      }
    });
  }
}
/** The point unit of each side carries a gold target (after the blocks are placed). */
function drawPointMarks(b: E.Battle) {
  for (const [uid, sd] of [
    [b.attPoint, b.attacker],
    [b.defPoint, other(b.attacker)],
  ] as const) {
    // the point unit carries a gold target
    const o = pieces.children.find((x) => x.userData.unit === uid);
    const u = g.units.find((x) => x.id === uid);
    if (!o || !u || !seen(u)) continue;
    const d = discSprite('point', 0.26),
      c = farSide() ? -1 : 1;
    d.position.set(o.position.x + 0.58 * c, o.position.y > 0.6 ? 1.95 : 0.9, o.position.z - 0.58 * c);
    d.userData.anchor = uid;
    markers.add(d); // a back corner of the block, clear of its pips and symbol d.userData.anchor = uid; markers.add(d);                  // on top of the block, so it is always inside the area
  }
}
export function drawPieces() {
  disposeAll(pieces);
  disposeAll(markers);
  const troops = wantTroops();
  const fronts = new Map<number, { att: E.Side; v: [number, number] }>();
  /** A unit's facing. Battle close-up: its row faces the other. Contested: the attackers face in from where they came, the defenders face them.
   * Elsewhere: the way it last moved; a unit that has not moved faces the way of the front (sideYaw). */
  const heading = (u: E.Unit, id: number, cont: boolean, battle: boolean) => {
    const f = cont || battle ? fronts.get(id) : undefined;
    if (f) return u.side === f.att ? yawTo(-f.v[0], -f.v[1]) : yawTo(f.v[0], f.v[1]);
    const here = ctr(id);
    if (u.from != null && u.from !== id && MAP.areas.some((x) => x.id === u.from)) {
      const q = ctr(u.from);
      return yawTo(here.x - q.x, here.z - q.z);
    }
    return sideYaw(u.side); // not moved yet: the direction of the front
  };
  /** Figures: where an area's units stand (figSpots); what is already there (markers) is kept clear of, and markers placed later keep clear of the units. */
  const arrangeLay = (id: number, order: E.Unit[]) => {
    const saved = [...(taken.get(id) ?? [])],
      spots = figSpots(id, order, fronts.get(id) ?? null, saved);
    taken.set(id, [...saved, ...spots.map((q, i) => ({ x: q.x, z: q.z, r: unitR(order[i]) }))]);
    return { spots, tight: false, saved };
  };
  const rOf = (u: E.Unit) => {
    const t = troops && !faceDown(u) ? troopOf(u.id) : null;
    return t ? troopR(t) : u.garrison ? 0.75 : 0.95;
  }; // a figure takes its own footprint
  coveredLabels.clear();
  /** The printed number plate and name (drawn upright for the viewer) are kept clear: blocks go around them when the area has room. */
  const labelSpots = (_id: number): { x: number; z: number; r: number }[] => []; // no printed label to keep clear of: the area tag sits under the pieces
  const taken = new Map<number, { x: number; z: number; r: number }[]>(),
    edgeTaken: { x: number; z: number; r: number }[] = [];
  /** Spot inside the area nearest to (x, z) whose footprint (radius r) is fully inside it and clear of what is already there. */
  const inArea = (id: number, x: number, z: number, r: number) => {
    const t = taken.get(id) ?? (taken.set(id, []), taken.get(id)!),
      cells = cellsOf(id);
    for (const need of [r, r * 0.75, r * 0.5, 0]) {
      let best: { x: number; z: number } | null = null,
        bd = 1e9;
      for (const c of cells) {
        if (c.d < need) continue;
        const d = Math.hypot(c.x - x, c.z - z);
        if (d < bd && t.every((q) => Math.hypot(q.x - c.x, q.z - c.z) >= q.r + r * (need === r ? 1 : 0.7))) {
          bd = d;
          best = c;
        }
      }
      if (best) {
        t.push({ ...best, r });
        (best as { tight?: boolean }).tight = need < r;
        return best;
      }
    }
    const p = toWorld(...POLE.get(id)!);
    t.push({ x: p.x, z: p.z, r });
    return p;
  };
  const free = (x: number, z: number, r: number) => {
    const all = [...edgeTaken, ...[...taken.values()].flat()],
      ok = (px: number, pz: number) => all.every((t) => Math.hypot(t.x - px, t.z - pz) >= t.r + r);
    let spot = { x, z };
    if (!ok(x, z))
      outer: for (let ring = 1; ring <= 10; ring++)
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2,
            px = x + Math.cos(a) * ring * 0.4,
            pz = z + Math.sin(a) * ring * 0.4;
          if (ok(px, pz)) {
            spot = { x: px, z: pz };
            break outer;
          }
        }
    edgeTaken.push({ ...spot, r });
    return spot;
  };
  const rows = new Map<number, { base: THREE.Vector3; cont: boolean }>(),
    contestedNow = new Set(E.contestedAreas(g)); // once per redraw, not once per area
  if (g.battle) drawBattleTable(g.battle); // counters first, so blocks make room around them and nothing hides one
  for (const a of MAP.areas) {
    const us = E.unitsIn(g, a.id),
      base = toWorld(...POLE.get(a.id)!),
      cont = contestedNow.has(a.id);
    rows.set(a.id, { base, cont });
    const lab = us.length && g.battle?.area !== a.id ? labelSpots(a.id) : [];
    if (lab.length) taken.set(a.id, [...(taken.get(a.id) ?? []), ...lab]);
    const order = [...us].sort((p, q) => +(p.side !== P1) - +(q.side !== P1) || +!!p.garrison - +!!q.garrison);
    const place = (column: boolean) => {
      // a row of blocks, or a column when the area is too narrow for a row
      const t = taken.get(a.id) ?? [],
        saved = [...t];
      let tight = false;
      const spots = order.map((u) => {
        const same = us.filter((x) => x.side === u.side),
          idx = column ? order.indexOf(u) - (order.length - 1) / 2 : same.indexOf(u) - (same.length - 1) / 2,
          row = near(u.side) ? 1.1 : -1.1;
        const r = rOf(u),
          p = column ? inArea(a.id, base.x, base.z + idx * 1.8, r) : inArea(a.id, base.x + idx * 1.75, base.z + (cont ? row : 0.4), r);
        if ((p as { tight?: boolean }).tight) tight = true;
        return p;
      });
      return { spots, tight, saved };
    };
    if (troops && (cont || g.battle?.area === a.id)) fronts.set(a.id, frontOf(a.id, order));
    let lay = troops && order.length ? arrangeLay(a.id, order) : place(false);
    if (lay.tight && order.length > 1) {
      taken.set(a.id, lay.saved);
      const col = place(true);
      if (!col.tight) lay = col;
      else {
        taken.set(a.id, lay.saved);
        lay = place(false);
      }
    }
    if (cont && lay.tight && g.battle?.area !== a.id) {
      // a crowded contested area: the two sides in facing rows (German row, Allied row), never mixed or stacked
      taken.set(a.id, lay.saved);
      const pl = toWorld(...POLE.get(a.id)!);
      const sp = Math.max(1.75, 2 * Math.max(...order.map(rOf))); // wide figures (a Panther) need more than a block's width
      lay.spots = order.map((u) => {
        const same = order.filter((x) => x.side === u.side),
          i = same.indexOf(u),
          per = 4,
          rw = Math.floor(i / per),
          inRow = Math.min(per, same.length - rw * per),
          dir = near(u.side) ? 1 : -1;
        return { x: pl.x + ((i % per) - (inRow - 1) / 2) * sp, z: pl.z + dir * (1.3 + rw * sp) };
      });
    }
    if (g.battle?.area === a.id && !(troops && order.length)) {
      const b = g.battle;
      lay.spots = order.map((u) => {
        const same = order.filter((x) => x.side === u.side);
        return battleSpot(b, u.side, 'unit', same.indexOf(u), same.length);
      });
    }
    if (lab.some((l) => lay.spots.some((p) => Math.hypot(p.x - l.x, p.z - l.z) < l.r + 0.7))) coveredLabels.add(a.id); // no room: the area's number and name ride on a tag above
    order.forEach((u, n) => {
      const hid = faceDown(u),
        t = troops && !hid ? troopOf(u.id) : null,
        sel = u.id === selUnit || (!!g.battle && !hid && (u.id === g.battle.attPoint || u.id === g.battle.defPoint));
      // facing: heading() (the way it last moved; in a contested area toward the other side; in a battle close-up row against row)
      const m = t
          ? troopGroup(
              t,
              u.id,
              u.side,
              woodOf(u),
              u.str,
              u.q.length ? u.q : ['veteran'],
              sel,
              heading(u, a.id, cont, g.battle?.area === a.id),
            )
          : block(u, hid),
        p = lay.spots[n];
      m.userData.hidden = hid;
      const flat = !t && cont && !hid && !u.garrison && u.up === a.id; // revealed blocks lie flat, label up, while the area is contested
      m.position.x = p.x;
      m.position.z = p.z;
      if (flat) {
        m.rotation.order = 'YXZ';
        m.rotation.set(-Math.PI / 2, viewRot(), 0);
        m.position.y = 0.4;
      }
      if (tgt?.units.has(u.id)) {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(1.15, 1.45, 40),
          new THREE.MeshBasicMaterial({ color: MAPC.ring, transparent: true, opacity: 0.95, side: THREE.DoubleSide }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(p.x, 0.09, p.z);
        markers.add(ring);
        const glow = new THREE.Mesh(
          new THREE.CircleGeometry(1.15, 40),
          new THREE.MeshBasicMaterial({ color: MAPC.ring, transparent: true, opacity: 0.28 }),
        );
        glow.rotation.x = -Math.PI / 2;
        glow.position.set(p.x, 0.085, p.z);
        markers.add(glow);
      }
      m.userData.unit = u.id;
      if (sel && !t) {
        const o = new THREE.LineSegments(
          new THREE.EdgesGeometry((m as THREE.Mesh).geometry),
          new THREE.LineBasicMaterial({ color: 0xe7b04a }),
        );
        m.add(o);
      }
      pieces.add(m);
      const tags: [string, string][] = [];
      const top = t ? (m.userData.top as number) + 0.55 : flat ? 0.85 : 1.66;
      if (u.disorder && !u.garrison) tags.push([u.disorder === 1 ? 'DIS' : 'REC', u.disorder === 1 ? '#8a1f1f' : '#a8741a']);
      if (u.rec) {
        if (u.rec <= 3) for (let k = 0; k < u.rec; k++) tags.push(['REC', '#a8741a']);
        else tags.push([`REC×${u.rec}`, '#a8741a']);
      } // artillery vs armour (optional): one recovery marker per hit this battle
      if (u.reserve) tags.push([VOL.reserveTag(u), '#2d6cb0']);
      if (u.exploit) tags.push(['E', '#d9741c']);
      if (u.unsupplied && !u.garrison) tags.push(['OOS', '#b8312f']);
      if (u.interdict) tags.push(['GI', '#8a2f9c']);
      if (u.bcross) tags.push(['B', '#8a6a1c']);
      if (g.riverAssault.includes(a.id) && u.side === g.phasing && !u.garrison) tags.push(['RA', '#2a7fb8']);
      const dc = farSide() ? -1 : 1;
      tags.forEach(([t, c], i) => {
        // status markers float in a row above the block, tilted toward the player (animated in frame())
        const k = tag(t, c, CHIT * 0.6),
          x0 = (i - (tags.length - 1) / 2) * 0.95;
        k.rotation.order = 'YXZ';
        k.rotation.set(0.95, viewRot(), 0);
        k.userData.float = { y: top + 1.0, ph: i * 1.1 + m.position.x * 0.3 };
        k.position.set(m.position.x + x0 * dc, top + 1.0, m.position.z);
        markers.add(k);
      });
    });
  }
  if (g.battle) drawPointMarks(g.battle);
  if (!g.battle && (g.phase === 'combat' || g.phase === 'btCombat')) {
    const must = new Set(E.mustFight(g)); // each battle area gets its own edge, so neighbouring battles never merge into one patch
    for (const id of fightable())
      markers.add(must.has(id) ? outlineRibbon(id, -0.32, 0.22, MAPC.must) : outlineRibbon(id, -0.26, 0.1, MAPC.fight));
  } // red is only for battles: must fight thick and filled, may fight a thin line
  // area markers: inside their own area, next to the group they belong to
  for (const a of MAP.areas) {
    const { base, cont } = rows.get(a.id)!,
      mine: { side?: E.Side; t: string; c: string }[] = [];
    if (g.roadblocks[a.id]) mine.push({ side: g.roadblocks[a.id], t: 'RB', c: '#6b4a8a' });
    if (g.interdicted[a.id]) mine.push({ side: E.chit(g, g.interdicted[a.id]).side, t: `chit:${g.interdicted[a.id]}`, c: '#2f6fb0' });
    if (g.pooled === a.id) mine.push({ side: 'allied', t: 'P', c: '#3f8a5a' });
    if (g.airSupply?.area === a.id) mine.push({ side: g.airSupply.side, t: `chit:${g.airSupply.id}`, c: '#2f6fb0' });
    if (g.fieldWorks.includes(a.id)) mine.push({ side: g.fwOwner[a.id] ?? g.control[a.id], t: 'FW', c: '#7a5a2b' });
    mine.forEach((m, i) => {
      const side = m.side ?? g.control[a.id],
        lane = cont ? (near(side) ? 1 : -1) : 1,
        size = CHIT;
      const p = inArea(a.id, base.x + (i - (mine.length - 1) / 2) * 1.5, base.z + lane * 2.3, size / 2 + 0.25);
      const k = tag(m.t, m.c, size);
      k.position.set(p.x, 0.02, p.z);
      k.userData.mark = `${m.t}:${a.id}`;
      markers.add(k);
    });
  }
  for (const k of Object.keys(g.greif)) {
    const [x, y] = k.split('-').map(Number),
      q = toWorld(...borderMid(x, y)),
      p = free(q.x, q.z - 1.3, 0.8),
      t = tag('G', '#8a2f9c', CHIT);
    t.position.set(p.x, 0.07, p.z);
    t.rotation.y = -borderAngle(x, y);
    markers.add(t);
  }
  for (const k of g.blown) {
    const [x, y] = k.split('-').map(Number),
      q = toWorld(...borderMid(x, y)),
      p = free(q.x, q.z, 0.85),
      t = tag('X', '#d9421f', CHIT * 0.72);
    t.position.set(p.x, 0.07, p.z);
    t.rotation.y = -borderAngle(x, y);
    markers.add(t);
  }
  for (const { key, code } of VOL.edgeMarks(g)) {
    const [x, y] = key.split('-').map(Number),
      q = toWorld(...borderMid(x, y)),
      p = free(q.x, q.z, 0.85),
      t = tag(code, '#8a7a4e', CHIT * 0.8);
    t.position.set(p.x, 0.07, p.z);
    t.rotation.y = -borderAngle(x, y);
    markers.add(t);
  } // the volume's boundary markers (Golan: minefields, bridged ditch)
}
