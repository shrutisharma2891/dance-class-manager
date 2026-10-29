import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { defaultMapping, demo, googleUrl, parseCsv, rankingCsv, summarize } from './data';
import type { Dataset, Mapping, Ranking } from './data';
import { readClassWorkbook } from './workbook';
import './styles.css';

function Chart({ title, subtitle, rows, color, metric }: { title: string; subtitle: string; rows: Ranking[]; color: string; metric: string }) {
  function download() {
    const url = URL.createObjectURL(new Blob([rankingCsv(rows, metric)], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `${metric}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  return <section className="card chart"><div className="chart-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="secondary" onClick={download}>Export CSV ↓</button></div>
    {rows.length ? <div role="img" aria-label={title}><ResponsiveContainer width="100%" height={Math.max(280, rows.length * 42)}><BarChart data={rows} layout="vertical" margin={{ top: 10, right: 35, bottom: 10, left: 0 }}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number"/><YAxis type="category" dataKey="name" width={115} tick={{ fontSize: 12 }}/><Tooltip cursor={{ fill: '#f3f4fa' }}/><Bar dataKey="value" name={metric} fill={color} radius={[0, 5, 5, 0]}/></BarChart></ResponsiveContainer></div> : <p>No matching data. Repeat customers must have more than one booking.</p>}
    <details><summary>View ranking table</summary><table><thead><tr><th>Name / email</th>{rows.some(r => r.customerName) && <th>Customer name</th>}<th>{metric}</th></tr></thead><tbody>{rows.map(r => <tr key={r.name}><td>{r.name}</td>{rows.some(row => row.customerName) && <td>{r.customerName ?? "—"}</td>}<td>{r.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td></tr>)}</tbody></table></details>
  </section>;
}
function App() {
  const [data, setData] = useState<Dataset>(demo), [mapping, setMapping] = useState<Mapping>(({ ...defaultMapping(demo.columns), className: demo.classColumn! }));
  const [source, setSource] = useState('Demo dataset'), [link, setLink] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const request = useRef(0);
  function load(next: Dataset, label: string) {
    const mapping = defaultMapping(next.columns);
    if (next.classColumn) mapping.className = next.classColumn;
    setData(next); setMapping(mapping); setSource(label); setError('');
  }
  async function upload(file?: File) {
    if (!file) return;
    const id = ++request.current; setBusy(true); setError('');
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Choose a file smaller than 20 MB.');
      if (file.name.toLowerCase().endsWith('.csv')) {
        const next = parseCsv(await file.text());
        if (id !== request.current) return;
        load(next, file.name);
      } else if (file.name.toLowerCase().endsWith('.xlsx')) {
        const next = await readClassWorkbook(await file.arrayBuffer());
        if (id !== request.current) return;
        load(next, file.name);
      } else throw new Error('Choose a CSV or XLSX file.');
    } catch (e) { if (id === request.current) setError(e instanceof Error ? e.message : 'Could not read file.'); }
    finally { if (id === request.current) setBusy(false); }
  }
  async function loadGoogle(event: React.FormEvent) {
    event.preventDefault(); const id = ++request.current; setBusy(true); setError('');
    try {
      const response = await fetch(googleUrl(link), { signal: AbortSignal.timeout(30000), credentials: 'omit' });
      if (!response.ok) throw new Error('Google could not return the sheet. Check link sharing or upload an export.');
      const text = await response.text();
      if (/^\s*(<!doctype|<html)/i.test(text)) throw new Error('This sheet requires sign-in. Upload a CSV or XLSX export instead.');
      const next = parseCsv(text);
      if (id !== request.current) return;
      load(next, 'Google Sheets');
    } catch (e) { if (id === request.current) setError(`${e instanceof Error ? e.message : 'Import failed.'} If browser access is blocked, download the sheet and upload it here.`); }
    finally { if (id === request.current) setBusy(false); }
  }
  const result = useMemo(() => { try { return { value: summarize(data.rows, mapping), error: '' }; } catch (e) { return { value: null, error: e instanceof Error ? e.message : 'Invalid mapping.' }; } }, [data, mapping]);
  const stats = result.value;
  return <main><header><div className="brand">◈ STUDIO INSIGHTS</div><span className="badge">React edition</span></header>
    <div className="intro"><div className="eyebrow">YOUR STUDIO, AT A GLANCE</div><h1>Every booking tells a story.</h1><p>Discover the classes your customers love — and what drives your revenue.</p></div>
    <section className="card"><h2>Connect your spreadsheet</h2><p>Upload a private export or connect a publicly viewable Google Sheet. Your files are processed in this browser.</p>
      <div className="inputs"><label className="upload">↑ Upload CSV or Excel<input type="file" accept=".csv,.xlsx" disabled={busy} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }}/></label><span className="or">or</span><form onSubmit={loadGoogle}><label className="sr-only" htmlFor="sheet-link">Google Sheets link</label><input id="sheet-link" type="url" required placeholder="Paste your Google Sheets link…" value={link} onChange={e => setLink(e.target.value)}/><button disabled={busy}>{busy ? 'Loading…' : 'Connect sheet'}</button></form></div>
      <div className="source"><span>Current source: <strong>{source}</strong> · {data.rows.length} rows</span><button className="text-button" disabled={busy} onClick={() => { request.current++; load(demo, 'Demo dataset'); }}>Try demo data</button></div>
      <p className="hint">Excel: use one worksheet per class, named after the class, with Email, Name, and Revenue columns. Extra columns may differ between sheets. All class sheets are combined automatically. Google links import only the selected tab; download as Excel to import all tabs.</p>
      <p className="hint">Google links need “Anyone with the link can view”. Keep customer data private by uploading an export instead.</p>
      {data.classSheets && <p role="status" className="hint">Imported {data.classSheets.length} class sheets: {data.classSheets.join(', ')}. Class names come from worksheet names.{!!data.skippedSheets?.length && ` Skipped sheets: ${data.skippedSheets.join(', ')}.`}</p>}
      {error && <p role="alert" className="alert">{error} The previous dataset remains displayed.</p>}
    </section>
    <section className="card"><h2>Match your columns</h2><div className="mapping">{([['className', 'Class name'], ['customer', 'Customer email'], ['revenue', 'Revenue received per row'], ['count', 'Registration counting'], ['customerName', 'Customer display name']] as const).map(([key, label]) => <label key={key}>{label}<select value={mapping[key] ?? ''} disabled={key === 'className' && !!data.classColumn} onChange={e => setMapping({ ...mapping, [key]: e.target.value })}>{key === 'count' && <option value="">One registration per row</option>}{key === 'customerName' && <option value="">No display name</option>}{data.columns.filter(c => key === 'className' || c !== data.classColumn).map(c => <option key={c} value={c}>{c}</option>)}</select></label>)}</div><p className="hint">Revenue is summed once per row, never multiplied by registrations. Use one currency and decimal-point amounts (1,200.50). All rows, including cancellations and refunds, are included. Emails are matched without capitalization or surrounding whitespace. Repeat customers have more than one booking; names are for display only.</p></section>
    {result.error && <p className="alert" role="alert">{result.error}</p>}
    {stats && <>{(stats.invalidRevenue > 0 || stats.missingClass > 0 || stats.missingCustomer > 0) && <p role="status" className="alert">{stats.invalidRevenue} rows have invalid or missing revenue (counted as zero). {stats.missingClass} rows have no class; {stats.missingCustomer} have no customer and are excluded from the respective rankings.</p>}
      <div className="metrics"><div><span>Total registrations</span><strong>{stats.totalRegistrations.toLocaleString()}</strong></div><div><span>Total revenue · sheet currency</span><strong>{stats.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></div><div><span>Classes in your studio</span><strong>{stats.registrations.length}</strong></div></div>
      <div className="charts"><Chart title="Most popular classes" subtitle="Ranked by total registrations" rows={stats.registrations} color="#7460df" metric="Registrations"/><Chart title="Revenue by class" subtitle="Ranked by revenue received" rows={stats.revenue} color="#299b8c" metric="Revenue"/></div><Chart title="Top 2 repeat customers" subtitle="Grouped by email · more than one booking · ties sorted alphabetically" rows={stats.customers} color="#d18b43" metric="Bookings"/>
    </>}
    <details className="card preview"><summary>Preview spreadsheet · first 20 rows</summary><div className="table-scroll"><table><thead><tr>{data.columns.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{data.rows.slice(0, 20).map((r, i) => <tr key={i}>{data.columns.map(c => <td key={c}>{r[c]}</td>)}</tr>)}</tbody></table></div></details><footer>Dance Class Insights · Built for your next great class.</footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
