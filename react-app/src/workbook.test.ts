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
    // Formatting outside the data must not create blank header columns.
    workbook.getWorksheet('Salsa')!.getCell('H1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    const bytes = await workbook.xlsx.writeBuffer();
    const data = await readClassWorkbook(Uint8Array.from(new Uint8Array(bytes)).buffer);
    const result = summarize(data.rows, { ...defaultMapping(data.columns), className: data.classColumn!, count: 'Count' });
    expect(data.classSheets).toEqual(['Salsa', 'Ballet']);
    expect(data.skippedSheets).toEqual(['Empty (empty or header-only)', 'No bookings yet (empty or header-only)']);
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
  it('combines sample-style headers and skips non-class tabs with a notice', () => {
    const data = fromClassSheets([
      { name: 'Salsa ', grid: [['Email', 'Name', 'Revenue'], ['Alex@example.com', 'Alex', 25]] },
      { name: 'Ballet', grid: [['Email', 'Name', 'Revenue', 'Email Sent', 'Venue Change'], ['alex@example.com', 'Alex', 30, 'Yes', 'No']] },
      { name: 'Hip Hop', grid: [[' email ', 'name', 'revenue', 'Column 2'], ['sam@example.com', 'Sam', 20, 'Yes']] },
      { name: '5-Class Pass', grid: [['Email', 'Name', 'Classes'], ['alex@example.com', 'Alex', 'Salsa, Ballet']] },
      { name: 'Sheet1', grid: [] },
    ]);
    const result = summarize(data.rows, { ...defaultMapping(data.columns), className: data.classColumn! });
    expect(data.classSheets).toEqual(['Salsa', 'Ballet', 'Hip Hop']);
    expect(data.skippedSheets).toContain('5-Class Pass (missing Email/customer or Revenue column)');
    expect(result.totalRegistrations).toBe(3);
    expect(result.totalRevenue).toBe(75);
    expect(result.customers).toEqual([{ name: 'alex@example.com', customerName: 'Alex', value: 2 }]);
  });
  it('identifies malformed sheets instead of silently losing bookings', () => {
    expect(() => fromClassSheets([{ name: 'Bad headers', grid: [['Customer', 'Customer'], ['Alex', 25]] }])).toThrow('Bad headers');
    expect(() => fromClassSheets([{ name: 'Empty', grid: [] }])).toThrow('No class sheets');
  });
});
