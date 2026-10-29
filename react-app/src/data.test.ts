import { describe, expect, it } from 'vitest';
import { defaultMapping, fromGrid, googleUrl, parseCsv, rankingCsv, summarize } from './data';

describe('spreadsheet insights', () => {
  it('parses quoted CSV and computes counts independently of revenue', () => {
    const data = parseCsv('Class,Customer,Revenue,Count\nSalsa,Alex,"$1,200.50",2\nBallet,Sam,30,1\nSalsa,Alex,-20,1');
    const result = summarize(data.rows, { ...defaultMapping(data.columns), count: 'Count' });
    expect(result.registrations[0]).toEqual({ name: 'Salsa', value: 3 });
    expect(result.revenue[0]).toEqual({ name: 'Salsa', value: 1180.5 });
    expect(result.customers[0]).toEqual({ name: 'Alex', value: 3 });
  });
  it('reports missing identifiers and invalid revenue', () => {
    const data = parseCsv('Class,Customer,Revenue\nSalsa,Alex,\n,Sam,10\nBallet,,bad');
    const result = summarize(data.rows, defaultMapping(data.columns));
    expect(result.invalidRevenue).toBe(2);
    expect(result.missingClass).toBe(1);
    expect(result.missingCustomer).toBe(1);
    expect(result.totalRegistrations).toBe(3);
  });
  it('rejects fractional counts and duplicate mappings', () => {
    const data = parseCsv('Class,Customer,Revenue,Count\nSalsa,Alex,25,1.5');
    const mapping = defaultMapping(data.columns);
    expect(() => summarize(data.rows, { ...mapping, count: 'Count' })).toThrow('whole numbers');
    expect(() => summarize(data.rows, { ...mapping, customer: mapping.className })).toThrow('different column');
  });
  it('shows only the top two repeat customers, grouped by normalized email', () => {
    const data = fromGrid([
      ['Class', 'Email', 'Name', 'Revenue'],
      ['Salsa', ' Alex@example.com ', 'Alex', 20],
      ['Ballet', 'ALEX@EXAMPLE.COM', 'Alexander', 30],
      ['Salsa', 'sam@example.com', 'Sam', 20],
      ['Ballet', 'sam@example.com', 'Sam', 30],
      ['Hip Hop', 'sam@example.com', 'Sam', 10],
      ['Salsa', 'taylor@example.com', 'Taylor', 20],
      ['Ballet', 'taylor@example.com', 'Taylor', 30],
      ['Salsa', 'once@example.com', 'Once', 20],
    ]);
    const result = summarize(data.rows, defaultMapping(data.columns));
    expect(result.customers).toEqual([
      { name: 'sam@example.com', customerName: 'Sam', value: 3 },
      { name: 'alex@example.com', customerName: 'Alex', value: 2 },
    ]);
    const single = fromGrid([['Class', 'Email', 'Revenue'], ['Salsa', 'one@example.com', 20]]);
    expect(summarize(single.rows, defaultMapping(single.columns)).customers).toEqual([]);
  });
  it('validates sheet links and preserves the tab selection', () => {
    expect(googleUrl('https://docs.google.com/spreadsheets/d/abc123/edit#gid=42')).toContain('gid=42');
    expect(() => googleUrl('https://example.com/spreadsheets/d/abc')).toThrow();
    expect(() => googleUrl('https://docs.google.com/spreadsheets/d/abc/edit#gid=invalid')).toThrow();
  });
  it('rejects malformed headers and escapes formula-like export names', () => {
    expect(() => parseCsv('Class,Class,Revenue\nA,B,1')).toThrow('unique');
    expect(rankingCsv([{ name: '=SUM(A1)', value: 2 }], 'Bookings')).toContain("'=SUM(A1)");
  });
});
