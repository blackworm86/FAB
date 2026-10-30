---
name: FAB: The Bulge
description: A dim war-room table for a rules-complete 3D wargame, brass on olive-black.
colors:
  table-black: "#0b0d08"
  panel-olive: "#1d2114"
  dispatch-paper: "#ddd7b5"
  brass: "#e7b04a"
  brass-ink: "#1a1608"
  rule-olive: "#8d9065"
  alarm-red: "#d1432f"
  alarm-red-deep: "#7d2417"
  allied-olive: "#9db36a"
  german-steel: "#b9bcc0"
  ok-green: "#5d8b3a"
  hit-green: "#a9e08a"
  miss-salmon: "#ff9c8a"
typography:
  display:
    fontFamily: "Saira Condensed, Arial Narrow, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
  label:
    fontFamily: "Saira Condensed, Arial Narrow, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    letterSpacing: "0.14em"
  body:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  block: "4px"
  card: "9px"
  slot: "12px"
spacing:
  sm: "8px"
  md: "14px"
  lg: "20px"
components:
  button-go:
    backgroundColor: "{colors.alarm-red}"
    textColor: "{colors.dispatch-paper}"
    typography: "{typography.display}"
    padding: "12px 26px"
  button-primary:
    backgroundColor: "{colors.brass}"
    textColor: "{colors.brass-ink}"
    padding: "7px 14px"
  button-default:
    backgroundColor: "{colors.panel-olive}"
    textColor: "{colors.dispatch-paper}"
    padding: "7px 14px"
  card-asset:
    backgroundColor: "{colors.allied-olive}"
    textColor: "{colors.table-black}"
    rounded: "{rounded.card}"
    width: "108px"
    height: "156px"
  slot-drop:
    backgroundColor: "{colors.table-black}"
    rounded: "{rounded.slot}"
    width: "150px"
---

# Design System: FAB: The Bulge

## Overview

**Creative North Star: "The War Room Table"**

A dimly lit planning table where the map is the hero and everything else is dispatch paper and brass around it. Chrome is quiet, flat and dark; the only loud things are the single red action button, the brass accent, and the physical-feeling pieces (blocks, cards, dice) that carry the depth. The mood is focused, tense and tactile, never playful.

Every number appears with its reason: the Success Number comes with its modifier chips, the move with its MP and fuel, the refused drop with the rule that refused it. Typography is condensed and uppercase for names and orders, monospace for ledgers and values.

**Key Characteristics:**
- Letterboxed layout: a top bar of steps and a bottom bar with one prompt and one action; the map fills the middle.
- Brass is the only accent on the chrome; red is reserved for the one primary action and for "must fight".
- Sides are colour-coded everywhere: Allied olive, German steel.
- Depth lives on pieces, not on panels.

## Colors

A near-black olive ground, paper-cream text, one brass accent, one alarm red.

### Primary
- **Brass** (#e7b04a): the active step, labels on slots, primary buttons, selected cards, the route line and tickets.
- **Alarm Red** (#d1432f, shadow #7d2417): the one go-button per screen and mandatory battles.

### Secondary
- **Allied Olive** (#9db36a): Allied blocks, cards, names.
- **German Steel** (#b9bcc0): German blocks, cards, names.

### Neutral
- **Table Black** (#0b0d08): bars, panels, modal ground.
- **Panel Olive** (#1d2114): default buttons and inputs.
- **Dispatch Paper** (#ddd7b5): body text.
- **Rule Olive** (#8d9065): 1px borders, dashed slot outlines, secondary labels.
- **Hit Green** (#a9e08a) and **Miss Salmon** (#ff9c8a): dice results and positive or negative modifier chips. **OK Green** (#5d8b3a) marks reachable areas.

### Named Rules
**The One Red Rule.** Alarm red appears once as the main action and for mandatory battles; nowhere else.
**The Both Sides Rule.** A side is always shown by its colour and its name, never colour alone.

## Typography

**Display Font:** Saira Condensed (Arial Narrow fallback)
**Body Font:** JetBrains Mono

**Character:** Stencilled, military-orders condensed caps for names and headings, a typewriter mono for numbers and rule text.

### Hierarchy
- **Display** (700, 28px, 1, +0.08em, uppercase): dispatch card titles, ledger headings.
- **Label** (600, 15px, +0.14em, uppercase): step names, side headings, button text.
- **Body** (400, 14px, 1.4): prompts, ledger rows, hints, max about 70ch.
- **Figures** (700, 22px to 64px, tabular numerals): turn, VP, expected hits.

### Named Rules
**The Typed Numbers Rule.** Anything that is a measurement uses the monospace face with tabular numerals.

## Layout

A full-bleed three-dimensional map under a letterbox. Top bar 56px, bottom bar at least 70px; floating panels (dispatch card at the left, battle table centred, ledger centred above the bottom bar) sit over the map. A hand of cards fans along the bottom in a scrollable tray. Spacing is 8, 14 and 20px. Below 860px the battle table stacks into one column, only the current step is shown in the top bar, and panels go full width.

## Elevation & Depth

Panels are flat at rest with a 1px olive rule; they do not cast shadows. Depth belongs to physical things: blocks show a hard side face (`4px 0 0` in a darker tone) with a soft drop (`8px 10px 14px #000a`), cards carry `0 10px 20px #000a`, toasts `0 6px 18px #000a`, and the go-button a pressed-edge `0 4px 0 #7d2417` that collapses on click. The map is vignetted with a radial gradient to focus the centre.

### Named Rules
**The Pieces Cast Shadows Rule.** Only pieces and the single action button have depth; panels stay flat.

## Shapes

Blocks are nearly square (4px), cards have 9px corners, drop slots are dashed 12px rounded outlines, buttons and panels are square with 1px rules. Step names sit in a chevron-shaped tab (clip-path arrow). Icons are drawn line icons at 1.7px stroke.

## Components

### Buttons
- **Go:** alarm red, cream condensed caps, pressed-edge shadow, 12px 26px.
- **Primary:** brass with near-black text, condensed caps.
- **Default:** olive panel, 1px rule, brass border on hover.
- **Icon:** transparent, 4px 10px, labelled with aria-label.
- **Focus:** a 2px blue-white ring (#4aa3ff) on buttons, a 2px brass ring on cards and blocks.

### Cards (assets)
A portrait chit in side colour: icon top, name in condensed caps, echelon in small mono. Fanned a few degrees, lifted on hover, brass outline when selected, greyed and desaturated when unavailable.

### Slots
Dashed rule-olive outline, a brass tab label (for example ARTY 0/2), brass tint when a card is dragged over.

### Dispatch card
Black panel with a 1px rule, a brass display title, dotted-rule rows of label and value, and a route ticket with a brass-tinted ground and a full-width primary button.

### Ledger
Black panel with the roll title, one row per firer: name, modifier chips (green for plus, salmon for minus), a brass SN tag, the dice in hit or miss colours and the hit count.

### Badges on the map
Pill badges in a white 2px border: green for reachable, brass for must stop or fuel, red for mandatory battle.

## Do's and Don'ts

### Do:
- **Do** show a number together with its reason.
- **Do** keep one primary action per screen, in alarm red.
- **Do** colour and name both sides.
- **Do** keep panels flat and let pieces carry shadows.
- **Do** use tabular numerals and the mono face for values.

### Don't:
- **Don't** show scanned artwork on pieces; all pieces are vector.
- **Don't** use colour alone to identify a side or a result.
- **Don't** put a second red or a second accent colour on the chrome.
- **Don't** use emoji or text glyphs as icons.
- **Don't** hide a decision that belongs to a player behind an automatic step.
