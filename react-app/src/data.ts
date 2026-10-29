import Papa from 'papaparse';
export type Row = Record<string, string>;
export type Dataset = { columns: string[]; rows: Row[]; classColumn?: string; dateColumn?: string; undatedSheets?: string[]; classSheets?: string[]; skippedSheets?: string[] };
export type Mapping = { className: string; customer: string; revenue: string; count: string; customerName?: string; classDate?: string };
export type Ranking = { name: string; value: number; customerName?: string };

export function fromGrid(grid: unknown[][], minimumColumns = 3): Dataset {
  const populated = grid.filter(row => row.some(cell => String(cell ?? '').trim() !== ''));
  const columns = (populated[0] ?? []).map(cell => String(cell ?? '').trim());
  if (columns.length < minimumColumns || columns.some(c => !c) || new Set(columns).size !== columns.length)
    throw new Error(`Use at least ${minimumColumns} unique, nonempty column headers in the first row.`);
  const rows = populated.slice(1).map(cells => Object.fromEntries(columns.map((c, i) => [c, String(cells[i] ?? '')])));
  if (!rows.length) throw new Error('The spreadsheet has no data rows.');
  return { columns, rows };
}

/** Worksheet dates use day.month.year. Two-digit years mean 2000–2099. */
export function parseClassSheetName(sheetName: string) {
  const name = sheetName.trim();
  const match = name.match(/^(.*?)\s+-\s+(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (!match || !match[1].trim()) return { className: name, date: '' };
  const day = Number(match[2]), month = Number(match[3]);
  const year = Number(match[4]) + (match[4].length === 2 ? 2000 : 0);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day)
    return { className: match[1].trim(), date: '' };
  return { className: match[1].trim(), date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
}

export function fromClassSheets(sheets: { name: string; grid: unknown[][] }[]): Dataset {
  const skippedSheets: string[] = [];
  const parsed: { name: string; data: Dataset }[] = [];
  for (const sheet of sheets) {
    const populated = sheet.grid.filter(row => row.some(cell => String(cell ?? '').trim() !== ''));
    if (populated.length <= 1) { skippedSheets.push(`${sheet.name} (empty or header-only)`); continue; }
    let data: Dataset;
    try { data = fromGrid(populated, 2); }
    catch (error) { throw new Error(`Worksheet “${sheet.name}”: ${error instanceof Error ? error.message : 'Invalid data.'}`); }
    // Normalize the fields we use; unrelated columns may differ between sheets.
    const canonical = (header: string) => {
      const key = header.trim().toLowerCase();
      return ({ email: 'Email', name: 'Name', revenue: 'Revenue', customer: 'Customer' } as Record<string, string>)[key] ?? header;
    };
    const columns = data.columns.map(canonical);
    if (new Set(columns).size !== columns.length) throw new Error(`Worksheet “${sheet.name}” has duplicate headers after normalizing capitalization.`);
    if (!columns.includes('Revenue') || (!columns.includes('Email') && !columns.includes('Customer'))) {
      skippedSheets.push(`${sheet.name} (missing Email/customer or Revenue column)`);
      continue;
    }
    const rows = data.rows.map(row => Object.fromEntries(data.columns.map((column, i) => [columns[i], row[column]])));
    parsed.push({ name: sheet.name.trim(), data: { columns, rows } });
  }
  if (!parsed.length) throw new Error('No class sheets contain booking rows with Email and Revenue columns.');
  const headers = [...new Set(parsed.flatMap(sheet => sheet.data.columns))];
  let classColumn = 'Class (worksheet)';
  while (headers.includes(classColumn)) classColumn += ' ·';
  let dateColumn = 'Class date (worksheet)';
  while (headers.includes(dateColumn)) dateColumn += ' ·';
  return {
    columns: [classColumn, dateColumn, ...headers],
    rows: parsed.flatMap(sheet => sheet.data.rows.map(row => ({
      ...Object.fromEntries(headers.map(header => [header, row[header] ?? ''])),
      [classColumn]: parseClassSheetName(sheet.name).className,
      [dateColumn]: parseClassSheetName(sheet.name).date,
    }))),
    classColumn,
    dateColumn,
    undatedSheets: parsed.filter(sheet => !parseClassSheetName(sheet.name).date).map(sheet => sheet.name),
    classSheets: parsed.map(sheet => sheet.name),
    skippedSheets,
  };
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
  return { className: find(['class', 'class name', 'class_name'], 0), customer: find(['email', 'customer', 'customer name', 'customer_email'], 1), revenue: find(['revenue', 'amount', 'total', 'paid'], 2), count: '', customerName: columns.find(c => c.trim().toLowerCase() === 'name') ?? '' };
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
  const customerNames = new Map<string, string>();
  const monthlyRevenue = new Map<string, number>();
  let undatedRevenue = 0, undatedRows = 0;
  rows.forEach((row, index) => {
    const count = mapping.count ? number(row[mapping.count] ?? '') : 1;
    if (!Number.isSafeInteger(count) || count < 0) throw new Error(`Row ${index + 2}: registrations must be nonnegative whole numbers.`);
    let amount = number(row[mapping.revenue] ?? '');
    if (!Number.isFinite(amount)) { invalidRevenue++; amount = 0; }
    const className = (row[mapping.className] ?? '').trim();
    const rawCustomer = (row[mapping.customer] ?? '').trim();
    const customer = /email/i.test(mapping.customer) || rawCustomer.includes('@') ? rawCustomer.toLowerCase() : rawCustomer;
    const customerName = mapping.customerName ? (row[mapping.customerName] ?? '').trim() : '';
    if (customer && customerName && !customerNames.has(customer)) customerNames.set(customer, customerName);
    totalRegistrations += count; totalRevenue += amount;
    if (mapping.classDate) {
      const date = row[mapping.classDate] ?? '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) add(monthlyRevenue, date.slice(0, 7), amount);
      else { undatedRevenue += amount; undatedRows++; }
    }
    if (className) { add(registrations, className, count); add(revenue, className, amount); } else missingClass++;
    if (customer) add(customers, customer, count); else missingCustomer++;
  });
  const rank = (map: Map<string, number>): Ranking[] => Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  const monthly = Array.from(monthlyRevenue).sort(([a], [b]) => a.localeCompare(b)).map(([month, value]) => ({
    name: new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`)),
    value,
  }));
  return { monthly, undatedRevenue, undatedRows, registrations: rank(registrations), revenue: rank(revenue), customers: rank(customers).filter(customer => customer.value > 1).slice(0, 2).map(customer => ({ ...customer, ...(customerNames.has(customer.name) ? { customerName: customerNames.get(customer.name) } : {}) })), invalidRevenue, missingClass, missingCustomer, totalRegistrations, totalRevenue };
}
export function rankingCsv(rows: Ranking[], metric: string) {
  // Prevent spreadsheet formula execution in exported customer/class names.
  const escapeName = (value: string) => /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  const hasCustomerNames = rows.some(row => row.customerName);
  const safe = rows.map(row => ({ ...(hasCustomerNames ? { 'Customer name': escapeName(row.customerName ?? '') } : {}), Name: /^[=+\-@\t\r]/.test(row.name) ? `'${row.name}` : row.name, [metric]: row.value }));
  return Papa.unparse(safe, { columns: [...(hasCustomerNames ? ['Customer name'] : []), 'Name', metric] });
}
export const demo = fromClassSheets([
  { name: 'Salsa - 27.09.26', grid: [['Email', 'Name', 'Revenue'], ['alex@example.com', 'Alex', 25], ['taylor@example.com', 'Taylor', 25], ['sam@example.com', 'Sam', 25]] },
  { name: 'Ballet - 03.10.26', grid: [['Name', 'Email', 'Revenue', 'Email Sent'], ['Sam', 'SAM@example.com', 30, 'Yes'], ['Morgan', 'morgan@example.com', 30, 'No']] },
  { name: 'Hip Hop - 01.11.26', grid: [['Email', 'Name', 'Revenue'], ['ALEX@example.com', 'Alex', 20], ['sam@example.com', 'Sam', 20], ['taylor@example.com', 'Taylor', 20]] },
]);
