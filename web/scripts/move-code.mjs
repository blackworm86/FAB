// Moves top-level code from one module of web/src into a new one without retyping it (the streamlining plan, docs/STATUS.md).
//   node scripts/move-code.mjs [--dry] <from.ts> <to.ts> "<first line of the new file's comment>" <lines or names>...
//   e.g. node scripts/move-code.mjs src/main.ts src/routes.ts "Routes on the map" 2954-3267 moveArrow
// A selection is a line range (every top-level statement starting inside it) or the name of a top-level declaration.
// The TypeScript compiler resolves every name, so a local variable that happens to share a name is never touched. What it does:
//   - the moved statements go to the new file as they are, with the imports they need;
//   - names used across the two files are exported and imported; the old file also re-exports the new one (`export * from`),
//     so files that import a moved name from the old file keep working, and the new files load in the order they are listed
//     there. Move code from the top of the old file downwards: load order then stays exactly what it was in the one file;
//   - a `let` assigned from the other file gets a setter (`setName`), and those assignments become calls to it, because an
//     imported variable can be read but not assigned;
//   - it reports what needs a look: code the new file would run while loading that depends on the old file (the old file loads
//     after it), assignments it cannot rewrite, and moved statements that do something at load time (their order changes).
// Then run Prettier, the type check and the tests.
import ts from 'typescript';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';

const args = process.argv.slice(2),
  dry = args[0] === '--dry' ? !!args.shift() : false;
const [fromArg, toArg, header, ...sel] = args;
const from = resolve(fromArg),
  to = resolve(toArg);
if (existsSync(to)) throw new Error(`${toArg} exists: move into a new file`);
const cfg = ts.getParsedCommandLineOfConfigFile(
  resolve('tsconfig.json'),
  {},
  {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => {
      throw new Error(String(d.messageText));
    },
  },
);
const program = ts.createProgram(cfg.fileNames, cfg.options),
  checker = program.getTypeChecker(),
  sf = program.getSourceFile(from);
const text = sf.text,
  lineOf = (p) => sf.getLineAndCharacterOfPosition(p).line + 1;
const modName = (f) => './' + basename(f).replace(/\.ts$/, '');

/* ---- the top-level statements and what each declares ---- */
const bindNames = (n, out = []) => {
  if (ts.isIdentifier(n)) out.push(n.text);
  else n.elements.forEach((e) => !ts.isOmittedExpression(e) && bindNames(e.name, out));
  return out;
};
const stmts = sf.statements.map((st) => {
  const s = {
    st,
    names: [],
    lets: [],
    isImport: ts.isImportDeclaration(st),
    isReexport: ts.isExportDeclaration(st) && !!st.moduleSpecifier,
    line: lineOf(st.getStart()),
  };
  if (ts.isVariableStatement(st))
    for (const d of st.declarationList.declarations) {
      const ns = bindNames(d.name);
      s.names.push(...ns);
      if (!(st.declarationList.flags & ts.NodeFlags.Const)) s.lets.push(...ns);
    }
  else if (
    (ts.isFunctionDeclaration(st) ||
      ts.isClassDeclaration(st) ||
      ts.isTypeAliasDeclaration(st) ||
      ts.isInterfaceDeclaration(st) ||
      ts.isEnumDeclaration(st)) &&
    st.name
  )
    s.names.push(st.name.text);
  return s;
});
const byName = new Map();
for (const s of stmts) for (const n of s.names) byName.set(n, s);
const setterOf = (n) => 'set' + n[0].toUpperCase() + n.slice(1);

/* ---- the selection ---- */
const moved = new Set();
for (const a of sel) {
  const m = /^(\d+)-(\d+)$/.exec(a);
  if (m) {
    for (const s of stmts) if (!s.isImport && !s.isReexport && s.line >= +m[1] && s.line <= +m[2]) moved.add(s);
  } else if (byName.has(a)) moved.add(byName.get(a));
  else throw new Error(`no top-level "${a}" in ${fromArg}`);
}
for (const s of [...moved]) for (const n of s.lets) if (byName.has(setterOf(n))) moved.add(byName.get(setterOf(n))); // a variable's setter goes with it
if (!moved.size) throw new Error('nothing selected');

/* ---- every use of a top-level name ---- */
const topOf = (n) => {
  while (n.parent && n.parent !== sf) n = n.parent;
  return n;
};
const stmtOf = new Map(stmts.map((s) => [s.st, s]));
/** The top-level statement that declares this symbol as a module-level name of this file (not a local, not a property), or null. */
function declStmt(sym) {
  for (const d of sym.declarations ?? []) {
    if (d.getSourceFile() !== sf) continue;
    if (ts.isImportClause(d) || ts.isNamespaceImport(d) || ts.isImportSpecifier(d)) return stmtOf.get(topOf(d));
    let v = d;
    while (ts.isBindingElement(v) || ts.isObjectBindingPattern(v) || ts.isArrayBindingPattern(v)) v = v.parent;
    if (ts.isVariableDeclaration(v) && ts.isVariableStatement(v.parent.parent) && v.parent.parent.parent === sf)
      return stmtOf.get(v.parent.parent);
    if (
      (ts.isFunctionDeclaration(d) ||
        ts.isClassDeclaration(d) ||
        ts.isTypeAliasDeclaration(d) ||
        ts.isInterfaceDeclaration(d) ||
        ts.isEnumDeclaration(d)) &&
      d.parent === sf
    )
      return stmtOf.get(d);
  }
  return null;
}
const deferred = (n) => {
  for (let p = n.parent; p && p !== sf; p = p.parent) if (ts.isFunctionLike(p)) return true;
  return false;
};
const ASSIGN = (k) => k >= ts.SyntaxKind.FirstAssignment && k <= ts.SyntaxKind.LastAssignment;
/** How this identifier is written to, if it is: { kind: 'assign' | 'step' | 'manual', node }. */
function writeOf(id) {
  const p = id.parent;
  if (ts.isBinaryExpression(p) && p.left === id && ASSIGN(p.operatorToken.kind)) return { kind: 'assign', node: p };
  if (
    (ts.isPostfixUnaryExpression(p) || ts.isPrefixUnaryExpression(p)) &&
    (p.operator === ts.SyntaxKind.PlusPlusToken || p.operator === ts.SyntaxKind.MinusMinusToken)
  )
    return { kind: 'step', node: p };
  // a destructuring target or a for-of / for-in variable
  let n = id;
  for (let q = n.parent; q; n = q, q = q.parent) {
    if ((ts.isForOfStatement(q) || ts.isForInStatement(q)) && q.initializer === n) return { kind: 'manual', node: q };
    if (ts.isBinaryExpression(q) && q.left === n && n !== id && q.operatorToken.kind === ts.SyntaxKind.EqualsToken)
      return { kind: 'manual', node: q };
    if (
      !(
        ts.isArrayLiteralExpression(q) ||
        ts.isObjectLiteralExpression(q) ||
        ts.isShorthandPropertyAssignment(q) ||
        ts.isSpreadElement(q) ||
        ts.isSpreadAssignment(q) ||
        (ts.isPropertyAssignment(q) && q.initializer === n)
      )
    )
      break;
  }
  return null;
}
const uses = []; // { id, user, decl, name, write, load }
(function walk(n) {
  if (ts.isIdentifier(n)) {
    const p = n.parent;
    let sym =
      ts.isShorthandPropertyAssignment(p) && p.name === n ? checker.getShorthandAssignmentValueSymbol(p) : checker.getSymbolAtLocation(n);
    const decl = sym && declStmt(sym),
      user = stmtOf.get(topOf(n));
    if (decl && user && decl !== user) {
      const target = sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym;
      uses.push({
        id: n,
        user,
        decl,
        name: n.text,
        write: writeOf(n),
        load: !deferred(n),
        typeOnly: !(target.flags & ts.SymbolFlags.Value) && !(sym.flags & ts.SymbolFlags.Value),
        shorthand: ts.isShorthandPropertyAssignment(p),
      });
    }
  }
  ts.forEachChild(n, walk);
})(sf);

/* ---- what crosses the cut ---- */
const edits = [],
  problems = [],
  notes = []; // edits: { pos, end, text } on the old text
const exportIn = new Set(),
  needFromSrc = new Map(),
  needFromDst = new Map(),
  needImports = new Map(),
  setters = new Map(); // name → typeOnly
const want = (map, name, typeOnly) => map.set(name, (map.get(name) ?? true) && typeOnly);
for (const u of uses) {
  const um = moved.has(u.user),
    dm = moved.has(u.decl);
  if (u.decl.isImport) {
    if (um) {
      if (!needImports.has(u.decl)) needImports.set(u.decl, new Map());
      want(needImports.get(u.decl), u.name, u.typeOnly);
    }
    continue;
  }
  if (um === dm) continue;
  exportIn.add(u.decl);
  want(um ? needFromSrc : needFromDst, u.name, u.typeOnly);
  if (um && u.load)
    problems.push(
      `line ${lineOf(u.id.getStart())}: the new file uses "${u.name}" while loading, but ${basename(from)} (line ${u.decl.line}) loads after it (fine only for a function that needs nothing declared later)`,
    );
  if (!u.write) continue;
  const set = setterOf(u.name),
    w = u.write.node;
  if (u.write.kind === 'manual') {
    problems.push(`line ${lineOf(u.id.getStart())}: "${u.name}" is assigned in a pattern or a loop header: rewrite by hand with ${set}()`);
    continue;
  }
  if (!u.decl.lets.includes(u.name)) {
    problems.push(`line ${lineOf(u.id.getStart())}: "${u.name}" is assigned but is not a plain let`);
    continue;
  }
  setters.set(u.name, u.decl);
  want(um ? needFromSrc : needFromDst, set, false);
  if (u.write.kind === 'step') {
    if (!ts.isExpressionStatement(w.parent) && !(ts.isForStatement(w.parent) && w.parent.incrementor === w))
      problems.push(`line ${lineOf(w.getStart())}: the value of "${w.getText()}" is used: check the rewrite`);
    edits.push({
      at: u.user,
      pos: w.getStart(),
      end: w.end,
      text: `${set}(${u.name} ${w.operator === ts.SyntaxKind.PlusPlusToken ? '+' : '-'} 1)`,
    });
  } else {
    const op = w.operatorToken.getText(),
      right = w.right.getStart();
    if (op === '=') {
      edits.push({ at: u.user, pos: w.getStart(), end: right, text: `${set}(` }, { at: u.user, pos: w.end, end: w.end, text: ')' });
    } else {
      edits.push(
        { at: u.user, pos: w.getStart(), end: right, text: `${set}(${u.name} ${op.slice(0, -1)} (` },
        { at: u.user, pos: w.end, end: w.end, text: '))' },
      );
    }
  }
}
for (const s of exportIn)
  if (!s.st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
    edits.push({ at: s, pos: s.st.getStart(), end: s.st.getStart(), text: 'export ' });
for (const [name, s] of setters) {
  const set = setterOf(name);
  if (byName.has(set)) {
    if (!byName.get(set).st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
      edits.push({ at: byName.get(set), pos: byName.get(set).st.getStart(), end: byName.get(set).st.getStart(), text: 'export ' });
    continue;
  }
  // after the variable's line; a comment at the end of that line stays on it (it is the next statement's leading text)
  const code = `export const ${set} = <T extends typeof ${name}>(v: T): T => ((${name} = v), v);`; // generic: `a = b = null` keeps its types
  const tail = ts.getTrailingCommentRanges(text, s.st.end)?.at(-1),
    next = stmts[stmts.indexOf(s) + 1];
  if (tail && next && moved.has(next) === moved.has(s)) edits.push({ at: next, pos: tail.end, end: tail.end, text: `\n${code}` });
  else edits.push({ at: s, pos: s.st.end, end: s.st.end, text: `\n${code}` });
}
for (const s of moved)
  if (
    ts.isExpressionStatement(s.st) ||
    ts.isIfStatement(s.st) ||
    ts.isForStatement(s.st) ||
    ts.isForOfStatement(s.st) ||
    ts.isBlock(s.st) ||
    ts.isTryStatement(s.st)
  )
    notes.push(`line ${s.line}: runs at load time, now when the new file loads: ${s.st.getText().slice(0, 90).replace(/\s+/g, ' ')}`);

/* ---- the two texts ---- */
const piece = (s) => {
  let out = text.slice(s.st.getFullStart(), s.st.end);
  for (const e of edits.filter((e) => e.at === s).sort((a, b) => b.pos - a.pos || b.end - a.end))
    out = out.slice(0, e.pos - s.st.getFullStart()) + e.text + out.slice(e.end - s.st.getFullStart());
  return out;
};
const names = (map) =>
  [...map]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([n, t]) => (t ? 'type ' : '') + n)
    .join(', ');
/** An import of the old file, cut down to the names in `keep` (name → typeOnly), or '' when none is left. */
function importText(decl, keep) {
  const c = decl.importClause;
  if (!c) return decl.getText(); // a side-effect import stays whole
  const parts = [],
    nb = c.namedBindings;
  if (c.name && keep.has(c.name.text)) parts.push(c.name.text);
  if (nb && ts.isNamespaceImport(nb) && keep.has(nb.name.text)) parts.push(`* as ${nb.name.text}`);
  if (nb && ts.isNamedImports(nb)) {
    const el = nb.elements
      .filter((e) => keep.has(e.name.text))
      .map(
        (e) =>
          (c.isTypeOnly ? '' : e.isTypeOnly || keep.get(e.name.text) === true ? 'type ' : '') +
          (e.propertyName ? `${e.propertyName.text} as ` : '') +
          e.name.text,
      );
    if (el.length) parts.push(`{ ${el.join(', ')} }`);
  }
  return parts.length ? `import ${c.isTypeOnly ? 'type ' : ''}${parts.join(', ')} from ${decl.moduleSpecifier.getText()};` : '';
}
const usedBySrc = new Map(); // import statement → names the old file still uses
for (const u of uses)
  if (u.decl.isImport && !moved.has(u.user)) {
    if (!usedBySrc.has(u.decl)) usedBySrc.set(u.decl, new Map());
    usedBySrc.get(u.decl).set(u.name, false);
  }
let dst = `// ${header}\n`;
for (const s of stmts) if (s.isImport && needImports.has(s)) dst += importText(s.st, needImports.get(s)) + '\n';
if (needFromSrc.size) dst += `import { ${names(needFromSrc)} } from '${modName(from)}';\n`;
let src = '',
  importsDone = false;
for (const s of stmts) {
  if (s.isImport) {
    const t = importText(s.st, usedBySrc.get(s) ?? new Map());
    if (t) src += text.slice(s.st.getFullStart(), s.st.getStart()) + t;
    else notes.push(`import no longer used by ${basename(from)}: ${s.st.moduleSpecifier.getText()}`);
    continue;
  }
  if (s.isReexport) {
    src += piece(s);
    continue;
  }
  if (!importsDone) {
    importsDone = true;
    src += `\n${needFromDst.size ? `import { ${names(needFromDst)} } from '${modName(to)}';\n` : ''}export * from '${modName(to)}';`;
  }
  if (moved.has(s)) dst += piece(s);
  else src += piece(s);
}
src += text.slice(sf.statements[sf.statements.length - 1].end);

/* ---- report and write ---- */
const lines = [...moved].reduce((n, s) => n + lineOf(s.st.end) - lineOf(s.st.getFullStart()) + 1, 0);
console.log(`${moved.size} statements (about ${lines} lines) → ${toArg}`);
console.log(`  the new file takes from ${basename(from)}: ${needFromSrc.size ? names(needFromSrc) : 'nothing'}`);
console.log(`  ${basename(from)} takes from the new file: ${needFromDst.size} names; setters: ${[...setters.keys()].join(', ') || 'none'}`);
for (const n of notes) console.log('  note: ' + n);
for (const p of problems) console.log('  LOOK: ' + p);
if (!dry) {
  writeFileSync(to, dst);
  writeFileSync(from, src);
  console.log('written');
}
