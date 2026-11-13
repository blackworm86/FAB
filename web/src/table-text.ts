/** Short texts of the table: chit abbreviations, button icons, die faces and the modifier icons of the battle panel. */
import * as E from '../../engine/src';
import { ico } from './icons';

export const pips = (u: E.Unit) => Array.from({ length: u.str }, () => `<i class="pip ${E.quality(u)}"></i>`).join('');
export const ABBR: Record<string, string> = {
  artillery: 'Arty',
  rocket_artillery: 'Rkt',
  engineer: 'Eng',
  armor_asset: 'Armor',
  infantry_asset: 'Inf',
  task_force: 'TF',
  fuel: 'Fuel',
  command_staff: 'Staff',
  sa_block: 'SA',
  replacement_inf: 'Repl inf',
  replacement_arm: 'Repl arm',
  rebuild_or_replace_inf: 'Rebuild inf',
  rebuild_or_replace_arm: 'Rebuild arm',
  event_arriving_regiment: 'Regt',
  special_action_event: 'SA event',
  air_mission: 'Air',
  event_release: 'Release',
  event_greif_bridge: 'Greif bridge',
  event_greif_interdict: 'Greif interdict',
  event_bodenplatte: 'Bodenplatte',
  event_delayed_response: 'Delayed',
};
export const chitLabel = (c: E.Chit) =>
  `${ABBR[c.kind] ?? c.kind}${['fuel', 'sa_block', 'special_action_event', 'air_mission', 'replacement_inf', 'replacement_arm', 'event_delayed_response'].includes(c.kind) || c.name.length > 14 ? '' : ' ' + c.name}${c.turn !== 'S' && E.isEvent(c) ? ' T' + c.turn : ''}`;
export const BTN_ICON: [RegExp, string][] = [
  [/blow|bridge.*bridge/i, 'xbold'],
  [/repair/i, 'engineer'],
  [/field works|fortify/i, 'gear'],
  [/roadblock|rally/i, 'flag'],
  [/interdict/i, 'warn'],
  [/alternate/i, 'swap'],
  [/pool/i, 'task_force'],
  [/intelligence/i, 'info'],
  [/reserve/i, 'sa_block'],
  [/replacement/i, 'infantry_asset'],
  [/drop|enter|place|boundary/i, 'next'],
  [/strike/i, 'air_mission'],
];
/** Give a chit action its icon so the buttons read at a glance; the text stays as the label. */
export const iconify = (html: string) =>
  html.replace(/<button class="([^"]*)" (data-do="[^"]+") ([^>]*)>([^<]*)<\/button>/g, (m, cls, d, rest, text) => {
    const ic = BTN_ICON.find(([re]) => re.test(text))?.[1];
    return ic ? `<button class="${cls} ab" ${d} ${rest}>${ico(ic)}<span>${text}</span></button>` : m;
  });
export const STAGE_NAME: Record<string, string> = {
  exploit: 'Exploitation morale check',
  attArty: 'artillery',
  defArty: 'artillery',
  defFire: 'Defensive fire',
  offFire: 'Offensive fire',
};
/** Die faces as small tiles: green when the die succeeds against the Success Number (a 1 always does, a 10 never), salmon when it misses. */
export const ok10 = (d: number, sn: number) => d === 1 || (d !== 10 && d <= sn);
export const faces = (dice: number[], sn: number) =>
  `<span class="faces">${dice.map((d) => `<i class="${ok10(d, sn) ? 'h' : 'm'}" title="${ok10(d, sn) ? 'hit' : 'miss'}" aria-label="${d}, ${ok10(d, sn) ? 'hit' : 'miss'}">${d}<s aria-hidden="true">${ico(ok10(d, sn) ? 'check' : 'close')}</s></i>`).join('')}</span>`;
/** A Success Number modifier as a small icon chip: the sign and size are the data, the full reason is the tooltip. */
export const modIcon = (why: string) =>
  /base/i.test(why)
    ? 'target'
    : /strongpoint/i.test(why)
      ? 'shield'
      : /brigade/i.test(why)
        ? 'users'
        : /armor|infantry|class/i.test(why)
          ? 'armor_asset'
          : /green|veteran|elite|quality/i.test(why)
            ? 'star'
            : /terrain|tdn/i.test(why)
              ? 'tree'
              : /field/i.test(why)
                ? 'gear'
                : /river|assault/i.test(why)
                  ? 'wave'
                  : /disorder/i.test(why)
                    ? 'disorder'
                    : /supply/i.test(why)
                      ? 'warn'
                      : /night/i.test(why)
                        ? 'eye'
                        : /air|asset|artillery|rocket/i.test(why)
                          ? 'air_mission'
                          : 'info';
/** A short word for a modifier, shown beside its icon with full explanations on; a tap names it in full. */
export const modWord = (why: string) =>
  /base/i.test(why)
    ? 'base'
    : /strongpoint/i.test(why)
      ? 'strongpoint'
      : /brigade/i.test(why)
        ? 'brigade'
        : /night/i.test(why)
          ? 'night'
          : /assault/i.test(why)
            ? 'assault'
            : /armor/i.test(why)
              ? 'armor'
              : /infantry/i.test(why)
                ? 'infantry'
                : /green|veteran|elite|quality/i.test(why)
                  ? 'quality'
                  : /terrain|tdn/i.test(why)
                    ? 'terrain'
                    : /field/i.test(why)
                      ? 'field works'
                      : /river/i.test(why)
                        ? 'river'
                        : /disorder/i.test(why)
                          ? 'disordered'
                          : /supply/i.test(why)
                            ? 'supply'
                            : /rocket/i.test(why)
                              ? 'rocket'
                              : /air/i.test(why)
                                ? 'air'
                                : /artillery/i.test(why)
                                  ? 'artillery'
                                  : /defender/i.test(why)
                                    ? 'defender'
                                    : '';
