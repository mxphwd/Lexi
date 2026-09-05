/** Bounded Pratt parser. Every token must be consumed; never execute input code. */
const small: Record<string, number> = { zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16, seventeen:17, eighteen:18, nineteen:19, twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90 };
export function numberWords(text: string): number | undefined {
  if (/^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(text.trim())) return Number(text.replaceAll(',', ''));
  const words = text.toLowerCase().trim().replaceAll('-', ' ').split(/\s+/);
  let sum = 0, group = 0, seen = false;
  for (const w of words) {
    if (w === 'and') continue;
    if (small[w] !== undefined) { group += small[w]; seen = true; }
    else if (w === 'hundred') { group = (group || 1) * 100; seen = true; }
    else if (w === 'thousand' || w === 'million' || w === 'billion') { sum += (group || 1) * ({ thousand:1e3, million:1e6, billion:1e9 }[w]); group = 0; seen = true; }
    else return undefined;
  }
  return seen ? sum + group : undefined;
}
export function expressionText(input: string) {
  return input.toLowerCase().replace(/[?!.]+$/, '').replace(/^(?:please\s+)?(?:calculate|compute|evaluate|what is|what's)\s+/, '')
    .replace(/\b(\d{1,3}(?:,\d{3})+(?:\.\d+)?)\b/g, x => x.replaceAll(',', ''))
    .replace(/\bhalf of\b/g, '0.5 *').replace(/\b(?:a |one )?quarter of\b/g, '0.25 *')
    .replace(/\b(\d+(?:\.\d+)?)\s*(?:percent|%)\s+of\s+/g, '($1 / 100) * ')
    .replace(/\bto the power of\b/g, '^').replace(/\bmultiplied by\b|\btimes\b/g, '*').replace(/\bdivided by\b/g, '/')
    .replace(/\bplus\b/g, '+').replace(/\bminus\b/g, '-').replace(/\bsquared\b/g, '^2').replace(/\bcubed\b/g, '^3')
    .replace(/\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion)(?:[ -]+(?:and[ -]+)?(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion))*\b/g, x => String(numberWords(x))).trim();
}
export function calculate(input: string): { value: number; steps: string[] } {
  const source = expressionText(input);
  const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[()+*/^%-]/g) ?? [];
  if (!tokens.length || tokens.length > 256 || tokens.join('') !== source.replace(/\s/g, '')) throw new Error('INVALID_EXPRESSION');
  let cursor = 0, depth = 0;
  const steps: string[] = [];
  function parse(min = 0): number {
    if (++depth > 32) throw new Error('EXPRESSION_DEPTH');
    const token = tokens[cursor++];
    let left: number;
    if (token === '+' || token === '-') left = (token === '-' ? -1 : 1) * parse(25);
    else if (token === '(') { left = parse(); if (tokens[cursor++] !== ')') throw new Error('UNBALANCED_EXPRESSION'); }
    else if (token !== undefined && /^(?:\d|\.)/.test(token)) left = Number(token);
    else throw new Error('MISSING_OPERAND');
    for (;;) {
      const op = tokens[cursor];
      const precedence = ({ '+':10, '-':10, '*':20, '/':20, '%':20, '^':30 } as Record<string, number>)[op];
      if (precedence === undefined || precedence < min) break;
      cursor++;
      const right = parse(precedence + (op === '^' ? 0 : 1));
      const before = left;
      if ((op === '/' || op === '%') && right === 0) throw new Error('DIVISION_BY_ZERO');
      left = op === '+' ? left + right : op === '-' ? left - right : op === '*' ? left * right : op === '/' ? left / right : op === '%' ? left % right : left ** right;
      if (!Number.isFinite(left)) throw new Error('NON_FINITE_RESULT');
      steps.push(`${before} ${op} ${right} = ${left}`);
    }
    depth--; return left;
  }
  const value = parse();
  if (cursor !== tokens.length) throw new Error('UNCONSUMED_EXPRESSION');
  return { value: Object.is(value, -0) ? 0 : value, steps };
}
type Unit = { dimension: string; scale: number; offset: number; name: string };
const units = new Map<string, Unit>();
function unit(names: string[], dimension: string, scale: number, offset = 0) {
  for (const name of names) units.set(name, { dimension, scale, offset, name: names[0] });
}
unit(['m','meter','meters','metre','metres'], 'length', 1);
unit(['km','kilometer','kilometers','kilometre','kilometres'], 'length', 1000);
unit(['cm','centimeter','centimeters'], 'length', .01); unit(['mm','millimeter','millimeters'], 'length', .001);
unit(['mile','miles','mi'], 'length', 1609.344); unit(['foot','feet','ft'], 'length', .3048); unit(['inch','inches','in'], 'length', .0254);
unit(['s','second','seconds'], 'time', 1); unit(['minute','minutes','min'], 'time', 60); unit(['hour','hours','hr'], 'time', 3600); unit(['day','days'], 'time', 86400); unit(['week','weeks'], 'time', 604800);
unit(['kg','kilogram','kilograms'], 'mass', 1); unit(['g','gram','grams'], 'mass', .001); unit(['lb','pound','pounds'], 'mass', .45359237);
unit(['l','liter','liters','litre','litres'], 'volume', 1); unit(['ml','milliliter','milliliters'], 'volume', .001);
unit(['kelvin','kelvins','k'], 'temperature', 1); unit(['celsius','degrees celsius','°c'], 'temperature', 1, 273.15); unit(['fahrenheit','degrees fahrenheit','°f'], 'temperature', 5/9, 255.3722222222222);
unit(['m/s','meters per second'], 'speed', 1); unit(['km/h','kilometers per hour','kph'], 'speed', 1/3.6); unit(['mph','miles per hour'], 'speed', .44704);
export function canonical(value: number, name?: string) {
  if (!name) return { value, dimension: 'scalar' };
  const u = units.get(name.toLowerCase());
  if (!u) throw new Error(`UNKNOWN_UNIT:${name}`);
  return { value: value * u.scale + u.offset, dimension: u.dimension };
}
export function convert(value: number, from: string, to: string) {
  const a = canonical(value, from), b = units.get(to.toLowerCase());
  if (!b || a.dimension !== b.dimension) throw new Error('INCOMPATIBLE_DIMENSIONS');
  return (a.value - b.offset) / b.scale;
}
export function numericCompare(a: { value: number; unit?: string }, b: { value: number; unit?: string }) {
  const x = canonical(a.value, a.unit), y = canonical(b.value, b.unit);
  if (x.dimension !== y.dimension) throw new Error('INCOMPATIBLE_DIMENSIONS');
  return x.value - y.value;
}
