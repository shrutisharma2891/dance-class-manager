import { fromClassSheets } from './data';

export async function readClassWorkbook(buffer: ArrayBuffer) {
  const { Workbook } = await import('exceljs');
  const book = new Workbook();
  await book.xlsx.load(buffer);
  const sheets = book.worksheets.map(sheet => {
    const grid: string[][] = [];
    sheet.eachRow({ includeEmpty: true }, row => {
      const cells: string[] = [];
      for (let i = 1; i <= sheet.columnCount; i++) cells.push(row.getCell(i).text);
      // Excel formatting can extend columnCount beyond the actual table.
      while (cells.length && !cells[cells.length - 1].trim()) cells.pop();
      grid.push(cells);
    });
    return { name: sheet.name, grid };
  });
  return fromClassSheets(sheets);
}
