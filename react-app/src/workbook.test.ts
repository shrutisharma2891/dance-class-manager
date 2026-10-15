import { describe, expect, it } from 'vitest';
import { Workbook } from 'exceljs';
import { fromClassSheets, defaultMapping, summarize } from './data';
import { readClassWorkbook } from './workbook';

describe('one class per Excel worksheet', () => {
  it('reads an actual XLSX and combines class totals and repeat customers across sheets', async () => {
    const workbook = new Workbook();
    workbook.addWorksheet('Salsa').addRows([
      ['Customer', 'Revenue', 'Count'], ['Alex', '$100', 2], ['Sam', 25, 1],
    ]);
    workbook.addWorksheet('Ballet').addRows([
      ['Count', 'Revenue', 'Customer'], [1, 40, 'Alex'], [3, 90, 'Taylor'],
    ]);
    workbook.addWorksheet('Empty');
    workbook.addWorksheet('No bookings yet').addRow(['Customer', 'Revenue', 'Count']);
    const bytes = await workbook.xlsx.writeBuffer();
    const data = await readClassWorkbook(Uint8Array.from(new Uint8Array(bytes)).buffer);
    const result = summarize(data.rows, { ...defaultMapping(data.columns), className: data.classColumn!, count: 'Count' });
    expect(data.classSheets).toEqual(['Salsa', 'Ballet']);
    expect(data.skippedSheets).toEqual(['Empty', 'No bookings yet']);
    expect(result.registrations).toEqual([{ name: 'Ballet', value: 4 }, { name: 'Salsa', value: 3 }]);
    expect(result.revenue).toEqual([{ name: 'Ballet', value: 130 }, { name: 'Salsa', value: 125 }]);
    expect(result.customers).toContainEqual({ name: 'Alex', value: 3 });
    expect(result.totalRegistrations).toBe(7);
    expect(result.totalRevenue).toBe(255);
  });
  it('uses sheet names even when the sheet contains a class column', () => {
    const data = fromClassSheets([{ name: 'Salsa', grid: [['Class (worksheet)', 'Customer', 'Revenue'], ['Wrong class', 'Alex', 20]] }]);
    expect(data.classColumn).not.toBe('Class (worksheet)');
    expect(data.rows[0][data.classColumn!]).toBe('Salsa');
  });
  it('accepts customer/revenue-only sheets and ignores blank rows', () => {
    const data = fromClassSheets([{ name: 'Salsa', grid: [[], ['Customer', 'Revenue'], ['Alex', 25], ['', '']] }]);
    const result = summarize(data.rows, { ...defaultMapping(data.columns), className: data.classColumn! });
    expect(result.registrations).toEqual([{ name: 'Salsa', value: 1 }]);
  });
  it('identifies incompatible or malformed sheets instead of silently losing bookings', () => {
    expect(() => fromClassSheets([
      { name: 'Salsa', grid: [['Customer', 'Revenue'], ['Alex', 25]] },
      { name: 'Ballet', grid: [['Name', 'Amount'], ['Sam', 30]] },
    ])).toThrow('Ballet');
    expect(() => fromClassSheets([{ name: 'Bad headers', grid: [['Customer', 'Customer'], ['Alex', 25]] }])).toThrow('Bad headers');
    expect(() => fromClassSheets([{ name: 'Empty', grid: [] }])).toThrow('No class sheets');
  });
});
