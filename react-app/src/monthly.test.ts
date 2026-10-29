import { describe, expect, it } from 'vitest';
import { defaultMapping, fromClassSheets, parseClassSheetName, summarize } from './data';

describe('monthly earnings from worksheet dates', () => {
  it('parses day.month.year with two or four digit years and class-name hyphens', () => {
    expect(parseClassSheetName(' Uff Teri Adaa - 31.10.26 ')).toEqual({ className: 'Uff Teri Adaa', date: '2026-10-31' });
    expect(parseClassSheetName('Hip - Hop - 1.11.2026')).toEqual({ className: 'Hip - Hop', date: '2026-11-01' });
    expect(parseClassSheetName('Salsa - 29.02.24').date).toBe('2024-02-29');
    for (const name of ['Salsa', 'Salsa - 31.09.26', 'Salsa - 29.02.25', 'Salsa - 10.13.26', 'Salsa - 00.10.26'])
      expect(parseClassSheetName(name).date).toBe('');
  });
  it('sorts months chronologically, combines class sessions, and separates years', () => {
    const sheet = (name: string, amount: number) => ({ name, grid: [['Email', 'Name', 'Revenue'], ['alex@example.com', 'Alex', amount]] });
    const data = fromClassSheets([
      sheet('Salsa - 01.11.26', 50), sheet('Salsa - 27.09.26', 20),
      sheet('Ballet - 03.10.26', 30), sheet('Ballet - 04.10.26', -5),
      sheet('Salsa - 27.09.27', 100), sheet('Undated', 10), sheet('Bad date - 31.09.26', 5),
    ]);
    const result = summarize(data.rows, { ...defaultMapping(data.columns), className: data.classColumn!, classDate: data.dateColumn });
    expect(result.monthly).toEqual([
      { name: 'September 2026', value: 20 }, { name: 'October 2026', value: 25 },
      { name: 'November 2026', value: 50 }, { name: 'September 2027', value: 100 },
    ]);
    expect(result.revenue).toContainEqual({ name: 'Salsa', value: 170 });
    expect(result.undatedRows).toBe(2);
    expect(result.undatedRevenue).toBe(15);
    expect(result.totalRevenue).toBe(210);
    expect(result.monthly.reduce((total, month) => total + month.value, 0) + result.undatedRevenue).toBe(result.totalRevenue);
    expect(data.undatedSheets).toEqual(['Undated', 'Bad date - 31.09.26']);
  });
  it('retains zero-revenue dated months and reports invalid revenue', () => {
    const data = fromClassSheets([{ name: 'Salsa - 27.09.26', grid: [['Email', 'Revenue'], ['one@example.com', 'not entered']] }]);
    const result = summarize(data.rows, { ...defaultMapping(data.columns), className: data.classColumn!, classDate: data.dateColumn });
    expect(result.monthly).toEqual([{ name: 'September 2026', value: 0 }]);
    expect(result.invalidRevenue).toBe(1);
  });
});
