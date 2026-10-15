import Papa from 'papaparse';
export type Row = Record<string, string>;
export type Dataset = { columns: string[]; rows: Row[] };
export type Mapping = { className: string; customer: string; revenue: string; count: string };
export type Ranking = { name: string; value: number };

export function fromGrid(grid: unknown[][]): Dataset {
  const populated = grid.filter(row => row.some(cell => String(cell ?? '').trim() !== ''));
  const columns = (populated[0] ?? []).map(cell => String(cell ?? '').trim());
  if (columns.length < 3 || columns.some(c => !c) || new Set(columns).size !== columns.length)
    throw new Error('Use at least three unique, nonempty column headers in the first row.');
  const rows = populated.slice(1).map(cells => Object.fromEntries(columns.map((c, i) => [c, String(cells[i] ?? '')])));
  if (!rows.length) throw new Error('The spreadsheet has no data rows.');
  return { columns, rows };
}
export function parseCsv(text: string): Dataset {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' });
  if (result.errors.length) throw new Error(`CSV could not be read: ${result.errors[0].message}`);
  return fromGrid(result.data);
}
export function googleUrl(link: string) {
  const url = new URL(link);
  const match = url.pathname.match(/^\/spreadsheets\/d\/([\w-]+)(?:\/.*)?$/);
  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com' || !match)
    throw new Error('Enter a valid Google Sheets link from docs.google.com.');
  const gid = new URLSearchParams(url.hash.slice(1)).get('gid') ?? url.searchParams.get('gid') ?? '0';
  if (!/^\d+$/.test(gid)) throw new Error('The sheet tab ID (gid) must be numeric.');
  return `https://docs.google.com/spreadsheets/d/${match[1]}/gviz/tq?tqx=out:csv&gid=${gid}`;
}
export function defaultMapping(columns: string[]): Mapping {
  const find = (names: string[], fallback: number) => columns.find(c => names.includes(c.toLowerCase().trim())) ?? columns[fallback];
  return { className: find(['class', 'class name', 'class_name'], 0), customer: find(['email', 'customer', 'customer name', 'customer_email'], 1), revenue: find(['revenue', 'amount', 'total', 'paid'], 2), count: '' };
}
function number(value: string) {
  const clean = value.replace(/[,$£€₹\s]/g, '');
  return clean ? Number(clean) : NaN;
}
export function summarize(rows: Row[], mapping: Mapping) {
  const chosen = [mapping.className, mapping.customer, mapping.revenue, ...(mapping.count ? [mapping.count] : [])];
  if (chosen.some(c => !c) || new Set(chosen).size !== chosen.length) throw new Error('Choose a different column for each field.');
  const registrations = new Map<string, number>(), revenue = new Map<string, number>(), customers = new Map<string, number>();
  let invalidRevenue = 0, missingClass = 0, missingCustomer = 0, totalRegistrations = 0, totalRevenue = 0;
  const add = (map: Map<string, number>, key: string, value: number) => map.set(key, (map.get(key) ?? 0) + value);
  rows.forEach((row, index) => {
    const count = mapping.count ? number(row[mapping.count] ?? '') : 1;
    if (!Number.isSafeInteger(count) || count < 0) throw new Error(`Row ${index + 2}: registrations must be nonnegative whole numbers.`);
    let amount = number(row[mapping.revenue] ?? '');
    if (!Number.isFinite(amount)) { invalidRevenue++; amount = 0; }
    const className = (row[mapping.className] ?? '').trim(), customer = (row[mapping.customer] ?? '').trim();
    totalRegistrations += count; totalRevenue += amount;
    if (className) { add(registrations, className, count); add(revenue, className, amount); } else missingClass++;
    if (customer) add(customers, customer, count); else missingCustomer++;
  });
  const rank = (map: Map<string, number>): Ranking[] => Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  return { registrations: rank(registrations), revenue: rank(revenue), customers: rank(customers).slice(0, 10), invalidRevenue, missingClass, missingCustomer, totalRegistrations, totalRevenue };
}
export function rankingCsv(rows: Ranking[], metric: string) {
  // Prevent spreadsheet formula execution in exported customer/class names.
  const safe = rows.map(row => ({ Name: /^[=+\-@\t\r]/.test(row.name) ? `'${row.name}` : row.name, [metric]: row.value }));
  return Papa.unparse(safe, { columns: ['Name', metric] });
}
export const demo = fromGrid([
  ['Class', 'Customer', 'Revenue'],
  ['Salsa', 'Alex', 25], ['Ballet', 'Sam', 30], ['Hip Hop', 'Alex', 20],
  ['Salsa', 'Taylor', 25], ['Hip Hop', 'Sam', 20], ['Contemporary', 'Jordan', 35],
  ['Salsa', 'Alex', 25], ['Ballet', 'Morgan', 30], ['Hip Hop', 'Taylor', 20],
]);
