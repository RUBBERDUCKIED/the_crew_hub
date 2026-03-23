import { useState, useEffect, useRef, useMemo } from 'react';
import useAppStore from '../state/useAppStore.js';
import { parseQuoteDate } from '../helpers/quoteHelpers.js';

// ─────────────────────────────────────────────────────────────
// ReportsTab — Phase 12 React migration
// Canvas charts drawn via useRef + useEffect (no chart library).
// MutationObserver on tab panel redraw charts when tab becomes visible.
// ─────────────────────────────────────────────────────────────

const MONTHS       = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const TYPE_COLORS  = { Residential: '#1e7d93', Commercial: '#f97316', Storefront: '#6366f1' };
const LEAD_COLORS  = ['#1e7d93','#f97316','#6366f1','#10b981','#f0d000','#e11d48','#0ea5e9','#8b5cf6','#14b8a6','#f59e0b','#64748b','#ec4899'];
const UNREPORTED_COLOR = '#cbd5e1';

export default function ReportsTab() {
  const savedQuotes   = useAppStore(s => s.savedQuotes);
  const customers     = useAppStore(s => s.customers);
  const currentUserRole = useAppStore(s => s.currentUserRole);

  // Reports: admin and owner only
  if (currentUserRole !== 'owner' && currentUserRole !== 'admin') return null;

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Canvas refs
  const barRef     = useRef(null); // Monthly revenue
  const pieRef     = useRef(null); // Job type pie
  const leadPieRef = useRef(null); // Lead source pie
  const typeRevRef = useRef(null); // Revenue by type bars
  const winLossRef = useRef(null); // Win/loss trend
  const leadRevRef = useRef(null); // Lead source revenue bars

  // ── Data computation ──────────────────────────────────────
  const rd = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const thisMonth = now.getMonth();

    // Available years
    const years = [...new Set(savedQuotes.map(q => {
      const d = parseQuoteDate(q.date); return d ? d.getFullYear() : null;
    }).filter(Boolean))].sort((a, b) => b - a);
    if (!years.includes(currentYear)) years.unshift(currentYear);

    // Year-filtered quotes
    const yearQuotes = savedQuotes.filter(q => {
      const d = parseQuoteDate(q.date); return d && d.getFullYear() === selectedYear;
    });
    const completed    = yearQuotes.filter(q => q.receipted);
    const invoicedOnly = yearQuotes.filter(q => q.invoiced && !q.receipted);
    const won          = yearQuotes.filter(q => q.won === true || q.invoiced || q.receipted);
    const quoted       = yearQuotes.filter(q => q.won !== false);

    // KPIs
    const yearRevenue  = completed.reduce((s, q) => s + q.grand, 0);
    const outstanding  = invoicedOnly.reduce((s, q) => s + q.grand, 0);
    const winRate      = quoted.length ? Math.round(won.length / quoted.length * 100) : 0;
    const avgJob       = completed.length ? yearRevenue / completed.length : 0;

    // This month vs last month
    const thisMonthRev = completed.filter(q => {
      const d = parseQuoteDate(q.date);
      return d && d.getMonth() === thisMonth && d.getFullYear() === selectedYear;
    }).reduce((s, q) => s + q.grand, 0);
    const lastMonthRev = completed.filter(q => {
      const d = parseQuoteDate(q.date);
      const lm = thisMonth === 0 ? 11 : thisMonth - 1;
      const ly = thisMonth === 0 ? selectedYear - 1 : selectedYear;
      return d && d.getMonth() === lm && d.getFullYear() === ly;
    }).reduce((s, q) => s + q.grand, 0);
    const monthTrend = lastMonthRev > 0
      ? Math.round((thisMonthRev - lastMonthRev) / lastMonthRev * 100)
      : null;

    // Monthly revenue array
    const monthlyRev = Array(12).fill(0);
    completed.forEach(q => { const d = parseQuoteDate(q.date); if (d) monthlyRev[d.getMonth()] += q.grand; });

    // Type counts (for pie)
    const typeCounts = {};
    yearQuotes.forEach(q => { typeCounts[q.type] = (typeCounts[q.type] || 0) + 1; });

    // Win/loss by month
    const wonByMonth = Array(12).fill(0);
    const lostByMonth = Array(12).fill(0);
    yearQuotes.forEach(q => {
      const d = parseQuoteDate(q.date); if (!d) return;
      if (q.won === true || q.invoiced || q.receipted) wonByMonth[d.getMonth()]++;
      else if (q.won === false) lostByMonth[d.getMonth()]++;
    });

    // Lead source counts (all non-archived customers)
    const leadCounts = {};
    Object.values(customers).forEach(c => {
      if (!c.archived) {
        const key = c.leadSource || 'Unreported';
        leadCounts[key] = (leadCounts[key] || 0) + 1;
      }
    });

    // Lead source revenue
    const sourceRev = {};
    completed.forEach(q => {
      const cust = customers[q.customerId];
      const src = cust?.leadSource || 'Unreported';
      sourceRev[src] = (sourceRev[src] || 0) + q.grand;
    });

    // Top customers
    const custRev = {};
    completed.forEach(q => {
      const k = q.customerId || (q.name || 'Unknown').trim().toUpperCase();
      custRev[k] = (custRev[k] || 0) + q.grand;
    });
    const topCustomers = Object.entries(custRev).sort((a, b) => b[1] - a[1]).slice(0, 8);

    // Avg job value by type
    const typeAvg = {};
    ['Residential', 'Commercial', 'Storefront'].forEach(t => {
      const jobs = completed.filter(q => (q.type || 'Residential') === t);
      typeAvg[t] = { avg: jobs.length ? jobs.reduce((s, q) => s + q.grand, 0) / jobs.length : null, count: jobs.length };
    });

    // Revenue by type (for horizontal bars)
    const typeRev = { Residential: 0, Commercial: 0, Storefront: 0 };
    completed.forEach(q => { const t = q.type || 'Residential'; if (t in typeRev) typeRev[t] += q.grand; });

    return {
      years, yearQuotes, completed, invoicedOnly, won, quoted,
      yearRevenue, outstanding, winRate, avgJob,
      thisMonthRev, monthTrend, monthlyRev,
      typeCounts, typeRev, wonByMonth, lostByMonth,
      leadCounts, sourceRev, topCustomers, typeAvg,
      currentYear, thisMonth,
    };
  }, [savedQuotes, customers, selectedYear]);

  // ── Canvas drawing ─────────────────────────────────────────
  useEffect(() => {
    function drawAll() {
      // Guard: skip if the panel isn't visible yet (offsetWidth = 0)
      const barCanvas = barRef.current;
      if (!barCanvas || barCanvas.offsetWidth === 0) return;

      // ── Monthly Revenue bar chart ──
      {
        const bCtx = barCanvas.getContext('2d');
        barCanvas.width = barCanvas.parentElement?.offsetWidth || 340;
        const bW = barCanvas.width, bH = 180;
        barCanvas.height = bH;
        bCtx.clearRect(0, 0, bW, bH);
        const maxRev = Math.max(...rd.monthlyRev, 1);
        const barW = Math.floor((bW - 40) / 12) - 4;
        const padL = 40, padB = 28, chartH = bH - padB - 10;

        // Y-axis grid
        bCtx.strokeStyle = '#e2e8f0'; bCtx.lineWidth = 1;
        [0, 0.25, 0.5, 0.75, 1].forEach(f => {
          const y = 10 + chartH * (1 - f);
          bCtx.beginPath(); bCtx.moveTo(padL, y); bCtx.lineTo(bW, y); bCtx.stroke();
          bCtx.fillStyle = '#94a3b8'; bCtx.font = '600 9px Nunito,sans-serif'; bCtx.textAlign = 'right';
          bCtx.fillText('$' + (maxRev * f).toFixed(0), padL - 4, y + 3);
        });

        rd.monthlyRev.forEach((rev, m) => {
          const x = padL + m * ((bW - padL) / 12) + 2;
          const h = chartH * (rev / maxRev);
          const y = 10 + chartH - h;
          const isCurrentMonth = m === rd.thisMonth && rd.currentYear === selectedYear;
          bCtx.fillStyle = isCurrentMonth ? '#1e7d93' : '#7dd3dc';
          bCtx.beginPath();
          if (bCtx.roundRect) bCtx.roundRect(x, y, barW, h, [3, 3, 0, 0]);
          else bCtx.rect(x, y, barW, h);
          bCtx.fill();
          bCtx.fillStyle = '#64748b'; bCtx.font = '600 9px Nunito,sans-serif'; bCtx.textAlign = 'center';
          bCtx.fillText(MONTHS[m], x + barW / 2, bH - 8);
        });
      }

      // ── Job type pie / donut ──
      {
        const pieCanvas = pieRef.current;
        if (pieCanvas) {
          const pCtx = pieCanvas.getContext('2d');
          pCtx.clearRect(0, 0, 180, 180);
          const total = Object.values(rd.typeCounts).reduce((s, v) => s + v, 0) || 1;
          let startAngle = -Math.PI / 2;
          const cx = 90, cy = 90, r = 75;
          Object.entries(rd.typeCounts).forEach(([type, count]) => {
            const slice = (count / total) * Math.PI * 2;
            pCtx.beginPath();
            pCtx.moveTo(cx, cy);
            pCtx.arc(cx, cy, r, startAngle, startAngle + slice);
            pCtx.closePath();
            pCtx.fillStyle = TYPE_COLORS[type] || '#94a3b8';
            pCtx.fill();
            pCtx.strokeStyle = 'white'; pCtx.lineWidth = 2; pCtx.stroke();
            startAngle += slice;
          });
          // Donut hole
          pCtx.beginPath(); pCtx.arc(cx, cy, 38, 0, Math.PI * 2);
          pCtx.fillStyle = 'white'; pCtx.fill();
          pCtx.fillStyle = '#1a3a4a'; pCtx.font = '800 13px Nunito,sans-serif'; pCtx.textAlign = 'center';
          pCtx.fillText(rd.yearQuotes.length, cx, cy + 2);
          pCtx.fillStyle = '#94a3b8'; pCtx.font = '600 9px Nunito,sans-serif';
          pCtx.fillText('jobs', cx, cy + 14);
        }
      }

      // ── Lead source pie / donut ──
      {
        const leadPieCanvas = leadPieRef.current;
        if (leadPieCanvas) {
          const leadTotal = Object.values(rd.leadCounts).reduce((s, v) => s + v, 0) || 0;
          if (leadTotal > 0) {
            const lCtx = leadPieCanvas.getContext('2d');
            lCtx.clearRect(0, 0, 180, 180);
            let lAngle = -Math.PI / 2;
            const lcx = 90, lcy = 90, lr = 75;
            Object.entries(rd.leadCounts).forEach(([source, count], idx) => {
              const slice = (count / leadTotal) * Math.PI * 2;
              lCtx.beginPath();
              lCtx.moveTo(lcx, lcy);
              lCtx.arc(lcx, lcy, lr, lAngle, lAngle + slice);
              lCtx.closePath();
              lCtx.fillStyle = source === 'Unreported' ? UNREPORTED_COLOR : LEAD_COLORS[idx % LEAD_COLORS.length];
              lCtx.fill();
              lCtx.strokeStyle = 'white'; lCtx.lineWidth = 2; lCtx.stroke();
              lAngle += slice;
            });
            // Donut hole
            lCtx.beginPath(); lCtx.arc(lcx, lcy, 38, 0, Math.PI * 2);
            lCtx.fillStyle = 'white'; lCtx.fill();
            lCtx.fillStyle = '#1a3a4a'; lCtx.font = '800 13px Nunito,sans-serif'; lCtx.textAlign = 'center';
            lCtx.fillText(leadTotal, lcx, lcy + 2);
            lCtx.fillStyle = '#94a3b8'; lCtx.font = '600 9px Nunito,sans-serif';
            lCtx.fillText('tracked', lcx, lcy + 14);
          }
        }
      }

      // ── Revenue by type (horizontal bars) ──
      {
        const typeCanvas = typeRevRef.current;
        if (typeCanvas) {
          const ctx = typeCanvas.getContext('2d');
          typeCanvas.width = typeCanvas.parentElement?.offsetWidth || 300;
          const cW = typeCanvas.width, cH = 120;
          typeCanvas.height = cH;
          ctx.clearRect(0, 0, cW, cH);
          const types = Object.keys(rd.typeRev);
          const maxRev = Math.max(...Object.values(rd.typeRev), 1);
          const barH = 24, gap = (cH - 16) / types.length, padL = 92, padR = 68, padT = 8;
          types.forEach((type, i) => {
            const rev = rd.typeRev[type];
            const y = padT + i * gap;
            const barW = Math.max(0, (rev / maxRev) * (cW - padL - padR));
            ctx.fillStyle = '#64748b'; ctx.font = '700 11px Nunito,sans-serif'; ctx.textAlign = 'right';
            ctx.fillText(type, padL - 8, y + barH / 2 + 4);
            ctx.fillStyle = '#f1f5f9'; ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(padL, y, cW - padL - padR, barH, 4);
            else ctx.rect(padL, y, cW - padL - padR, barH);
            ctx.fill();
            if (barW > 0) {
              ctx.fillStyle = TYPE_COLORS[type] || '#94a3b8'; ctx.beginPath();
              if (ctx.roundRect) ctx.roundRect(padL, y, barW, barH, 4);
              else ctx.rect(padL, y, barW, barH);
              ctx.fill();
            }
            ctx.fillStyle = '#1a3a4a'; ctx.font = '800 11px Nunito,sans-serif'; ctx.textAlign = 'left';
            ctx.fillText('$' + rev.toFixed(0), padL + barW + 6, y + barH / 2 + 4);
          });
        }
      }

      // ── Win/Loss trend bars ──
      {
        const winCanvas = winLossRef.current;
        if (winCanvas) {
          const ctx = winCanvas.getContext('2d');
          winCanvas.width = winCanvas.parentElement?.offsetWidth || 300;
          const cW = winCanvas.width, cH = 120;
          winCanvas.height = cH;
          ctx.clearRect(0, 0, cW, cH);
          const maxVal = Math.max(...rd.wonByMonth, ...rd.lostByMonth, 1);
          const padL = 22, padB = 22, padT = 8, chartH = cH - padB - padT;
          const slotW = (cW - padL) / 12;
          const bW = Math.max(2, Math.floor(slotW / 2) - 2);

          ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
          [0, 0.5, 1].forEach(f => {
            const y = padT + chartH * (1 - f);
            ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(cW, y); ctx.stroke();
            if (f > 0) {
              ctx.fillStyle = '#94a3b8'; ctx.font = '600 8px Nunito,sans-serif'; ctx.textAlign = 'right';
              ctx.fillText(Math.round(maxVal * f), padL - 2, y + 3);
            }
          });

          MONTHS.forEach((mon, m) => {
            const x = padL + m * slotW;
            const wH = chartH * (rd.wonByMonth[m] / maxVal);
            if (wH > 0) {
              ctx.fillStyle = '#10b981'; ctx.beginPath();
              if (ctx.roundRect) ctx.roundRect(x + 1, padT + chartH - wH, bW, wH, [2, 2, 0, 0]);
              else ctx.rect(x + 1, padT + chartH - wH, bW, wH);
              ctx.fill();
            }
            const lH = chartH * (rd.lostByMonth[m] / maxVal);
            if (lH > 0) {
              ctx.fillStyle = '#f87171'; ctx.beginPath();
              if (ctx.roundRect) ctx.roundRect(x + bW + 3, padT + chartH - lH, bW, lH, [2, 2, 0, 0]);
              else ctx.rect(x + bW + 3, padT + chartH - lH, bW, lH);
              ctx.fill();
            }
            ctx.fillStyle = '#94a3b8'; ctx.font = '600 8px Nunito,sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(mon, x + slotW / 2, cH - 6);
          });
        }
      }

      // ── Lead source revenue bars ──
      {
        const leadRevCanvas = leadRevRef.current;
        if (leadRevCanvas) {
          const sorted = Object.entries(rd.sourceRev).sort((a, b) => b[1] - a[1]);
          if (sorted.length > 0) {
            const ctx = leadRevCanvas.getContext('2d');
            leadRevCanvas.width = leadRevCanvas.parentElement?.offsetWidth || 280;
            const cW = leadRevCanvas.width;
            const barH = 22, gap = 10, padL = 92, padR = 68, padT = 6;
            const cH = padT + sorted.length * (barH + gap);
            leadRevCanvas.height = cH;
            ctx.clearRect(0, 0, cW, cH);
            const maxRev = sorted[0][1] || 1;
            sorted.forEach(([src, rev], i) => {
              const y = padT + i * (barH + gap);
              const barW = Math.max(0, (rev / maxRev) * (cW - padL - padR));
              const color = src === 'Unreported' ? UNREPORTED_COLOR : LEAD_COLORS[i % LEAD_COLORS.length];
              ctx.fillStyle = '#64748b'; ctx.font = '700 10px Nunito,sans-serif'; ctx.textAlign = 'right';
              const label = src.length > 13 ? src.slice(0, 12) + '…' : src;
              ctx.fillText(label, padL - 6, y + barH / 2 + 4);
              ctx.fillStyle = '#f1f5f9'; ctx.beginPath();
              if (ctx.roundRect) ctx.roundRect(padL, y, cW - padL - padR, barH, 4);
              else ctx.rect(padL, y, cW - padL - padR, barH);
              ctx.fill();
              if (barW > 0) {
                ctx.fillStyle = color; ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(padL, y, barW, barH, 4);
                else ctx.rect(padL, y, barW, barH);
                ctx.fill();
              }
              ctx.fillStyle = '#1a3a4a'; ctx.font = '800 10px Nunito,sans-serif'; ctx.textAlign = 'left';
              ctx.fillText('$' + rev.toFixed(0), padL + barW + 6, y + barH / 2 + 4);
            });
          }
        }
      }
    }

    // Initial draw
    drawAll();

    // Re-draw when tab becomes visible (class changes on #tab-reports)
    const panel = document.getElementById('tab-reports');
    if (!panel) return;
    const observer = new MutationObserver(drawAll);
    observer.observe(panel, { attributes: true, attributeFilter: ['class', 'style'] });
    return () => observer.disconnect();
  }, [rd, selectedYear]);

  // ── Export functions ───────────────────────────────────────
  function handleExportCSV() {
    const { completed } = rd;
    if (!completed.length) { alert('No completed jobs for ' + selectedYear + ' to export.'); return; }
    const esc = v => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
    const headers = ['Date', 'Quote #', 'Customer', 'Type', 'Address', 'Subtotal', 'Total', 'Payment Method', 'Lead Source'];
    const rows = completed.map(q => {
      const cust = customers[q.customerId];
      return [
        q.date || '', q.quoteNum || '', q.name || '', q.type || '', q.address || '',
        (q.subtotal || 0).toFixed(2), (q.grand || 0).toFixed(2),
        q.paymentMethod || '', cust?.leadSource || '',
      ].map(esc).join(',');
    });
    const csv = [headers.map(esc).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `CrewHub-Report-${selectedYear}.csv`; a.click();
  }

  function handleExportPDF() {
    const { completed, won, quoted, yearRevenue, winRate, avgJob, monthlyRev, topCustomers } = rd;
    const w = window.open('', '_blank');
    if (!w) { alert('Please allow pop-ups to export PDF.'); return; }
    const top5 = topCustomers.slice(0, 5);
    w.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"><title>Crew Hub Report ${selectedYear}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#1a3a4a;max-width:800px;margin:0 auto;padding:40px 20px;}
        h1{color:#1e7d93;} h2{color:#1e7d93;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin-top:32px;}
        .kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:20px 0;}
        .kpi{background:#f4fbfc;border-radius:12px;padding:16px;text-align:center;}
        .kpi-val{font-size:28px;font-weight:900;color:#1e7d93;} .kpi-label{font-size:12px;color:#6b9aaa;font-weight:600;margin-top:4px;}
        table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px;}
        th{background:#1e7d93;color:white;padding:8px 12px;text-align:left;}
        td{padding:8px 12px;border-bottom:1px solid #e2e8f0;}
        tr:nth-child(even) td{background:#f4fbfc;}
        @media print{body{padding:0;}}
      </style>
    </head><body>
      <h1>📊 Crew Hub Business Report — ${selectedYear}</h1>
      <p style="color:#6b9aaa;font-size:13px;">Generated ${new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-val">$${yearRevenue.toFixed(2)}</div><div class="kpi-label">Total Revenue</div></div>
        <div class="kpi"><div class="kpi-val">${completed.length}</div><div class="kpi-label">Jobs Complete</div></div>
        <div class="kpi"><div class="kpi-val">${winRate}%</div><div class="kpi-label">Win Rate</div></div>
        <div class="kpi"><div class="kpi-val">$${avgJob.toFixed(2)}</div><div class="kpi-label">Avg Job Value</div></div>
        <div class="kpi"><div class="kpi-val">${won.length}</div><div class="kpi-label">Jobs Won</div></div>
        <div class="kpi"><div class="kpi-val">${quoted.length}</div><div class="kpi-label">Total Quoted</div></div>
      </div>
      <h2>Monthly Revenue</h2>
      <table><tr><th>Month</th><th>Revenue</th></tr>
        ${MONTHS.map((m, i) => `<tr><td>${m}</td><td>$${monthlyRev[i].toFixed(2)}</td></tr>`).join('')}
      </table>
      <h2>Top Customers</h2>
      <table><tr><th>Customer</th><th>Revenue</th></tr>
        ${top5.map(([k, rev]) => {
          const cust = customers[k];
          const name = cust
            ? (cust.company ? `${cust.company} · ${cust.name}` : cust.name)
            : (savedQuotes.find(q => (q.customerId || (q.name || '').trim().toUpperCase()) === k)?.name || k);
          return `<tr><td>${name}</td><td>$${rev.toFixed(2)}</td></tr>`;
        }).join('')}
      </table>
      <script>window.onload = () => window.print();<\/script>
    </body></html>`);
    w.document.close();
  }

  function handleExportJSON() {
    if (window.exportJSON) window.exportJSON();
  }

  // ── Render ─────────────────────────────────────────────────
  const leadTotal = Object.values(rd.leadCounts).reduce((s, v) => s + v, 0);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 60px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--teal-dark)' }}>📊 Business Reports</div>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(parseInt(e.target.value))}
            style={{ padding: '6px 14px', border: '2px solid var(--gray)', borderRadius: 20, fontFamily: "'Nunito',sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--teal-dark)', background: 'white', cursor: 'pointer' }}
          >
            {rd.years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="crm-btn crm-btn-teal" onClick={handleExportCSV} style={{ fontSize: 13 }}>📥 Export CSV</button>
          <button className="crm-btn" onClick={handleExportPDF} style={{ fontSize: 13, background: 'white', border: '2px solid var(--teal)', color: 'var(--teal-dark)' }}>📄 Export PDF</button>
          <button className="crm-btn crm-btn-outline" onClick={handleExportJSON} style={{ fontSize: 13 }}>⬇️ Export Backup</button>
        </div>
      </div>

      {/* KPI stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Revenue (Year)', value: `$${rd.yearRevenue.toFixed(2)}`, sub: `${rd.completed.length} jobs`, color: 'var(--teal-dark)' },
          { label: 'This Month',     value: `$${rd.thisMonthRev.toFixed(2)}`, sub: rd.monthTrend !== null ? (rd.monthTrend > 0 ? `▲ ${rd.monthTrend}% vs last month` : `▼ ${Math.abs(rd.monthTrend)}% vs last month`) : 'no prior data', subColor: rd.monthTrend > 0 ? '#16a34a' : rd.monthTrend < 0 ? '#dc2626' : 'var(--muted)' },
          { label: 'Jobs Complete',  value: rd.completed.length, sub: 'receipted' },
          { label: 'Win Rate',       value: `${rd.winRate}%`, sub: `${rd.won.length} won of ${rd.quoted.length} quoted` },
          { label: 'Avg Job Value',  value: `$${rd.avgJob.toFixed(2)}`, sub: 'per completed job' },
          { label: 'Outstanding',    value: `$${rd.outstanding.toFixed(2)}`, sub: 'invoiced, not receipted', color: '#b45309', border: '2px solid #fbbf24', labelColor: '#b45309', clickable: true },
        ].map(({ label, value, sub, color, subColor, border, labelColor, clickable }) => (
          <div
            key={label}
            className="stat-card"
            style={{ textAlign: 'center', border, overflow: 'hidden', cursor: clickable ? 'pointer' : 'default' }}
            title={clickable ? 'View invoiced jobs in pipeline' : undefined}
            onClick={clickable ? () => {
              window.dispatchEvent(new CustomEvent('pipeline:setFilter', { detail: { stage: 'invoiced', type: 'all' } }));
              const btn = document.querySelector('[onclick*="switchTab(\'pipeline\'"]');
              if (btn && window.switchTab) window.switchTab('pipeline', btn);
            } : undefined}
          >
            <div className="stat-label" style={labelColor ? { color: labelColor } : {}}>{label}</div>
            <div className="stat-val" style={{ color: color || 'var(--text)', fontSize: 'clamp(16px, 2.8vw, 26px)', wordBreak: 'break-word', lineHeight: 1.2 }}>{value}</div>
            <div className="stat-sub" style={subColor ? { color: subColor } : {}}>{sub}{clickable && <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>→ view</span>}</div>
          </div>
        ))}
      </div>

      {/* Monthly Revenue bar chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="stat-card" style={{ gridColumn: '1/2' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--teal-dark)', marginBottom: 14 }}>Monthly Revenue</div>
          <canvas ref={barRef} height={180} style={{ width: '100%' }} />
        </div>

        {/* Job type pie */}
        <div className="stat-card" style={{ gridColumn: '2/3', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--teal-dark)', marginBottom: 14, alignSelf: 'flex-start' }}>Jobs by Type</div>
          <canvas ref={pieRef} width={180} height={180} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 14 }}>
            {Object.entries(rd.typeCounts).map(([type, count]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: TYPE_COLORS[type] || '#94a3b8', flexShrink: 0 }} />
                {type} <span style={{ color: 'var(--muted)', fontWeight: 600 }}>({count})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue by type + Win/Loss trend */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="stat-card">
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--teal-dark)', marginBottom: 14 }}>Revenue by Property Type</div>
          <canvas ref={typeRevRef} height={120} style={{ width: '100%' }} />
        </div>
        <div className="stat-card">
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--teal-dark)', marginBottom: 6 }}>Win / Loss by Month</div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>■ Won</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#f87171' }}>■ Lost</span>
          </div>
          <canvas ref={winLossRef} height={120} style={{ width: '100%' }} />
        </div>
      </div>

      {/* Avg job value by type */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
        {Object.entries(rd.typeAvg).map(([type, { avg, count }]) => (
          <div key={type} className="stat-card" style={{ textAlign: 'center', borderTop: `4px solid ${TYPE_COLORS[type]}` }}>
            <div className="stat-label">{type}</div>
            <div className="stat-val" style={{ color: TYPE_COLORS[type] }}>{avg !== null ? '$' + avg.toFixed(0) : 'N/A'}</div>
            <div className="stat-sub">avg value · {count} job{count !== 1 ? 's' : ''}</div>
          </div>
        ))}
      </div>

      {/* Lead source: pie + revenue bars */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        {/* Lead source pie */}
        <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--teal-dark)', marginBottom: 14, alignSelf: 'flex-start' }}>How Customers Found Us</div>
          {leadTotal === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 600, padding: '20px 0' }}>No lead source data recorded yet.</div>
          ) : (
            <>
              <canvas ref={leadPieRef} width={180} height={180} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 14 }}>
                {Object.entries(rd.leadCounts).sort((a, b) => b[1] - a[1]).map(([source, count], idx) => (
                  <div key={source} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: source === 'Unreported' ? UNREPORTED_COLOR : LEAD_COLORS[idx % LEAD_COLORS.length], flexShrink: 0 }} />
                    {source} <span style={{ color: 'var(--muted)', fontWeight: 600 }}>({count} · {Math.round(count / leadTotal * 100)}%)</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Lead source revenue bars */}
        <div className="stat-card">
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--teal-dark)', marginBottom: 14 }}>Revenue by Lead Source</div>
          {Object.keys(rd.sourceRev).length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 600, padding: '20px 0' }}>No revenue data yet.</div>
          ) : (
            <canvas ref={leadRevRef} style={{ width: '100%' }} />
          )}
        </div>
      </div>

      {/* Top customers */}
      <div className="stat-card">
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--teal-dark)', marginBottom: 14 }}>Top Customers (by revenue)</div>
        {rd.topCustomers.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, fontWeight: 600 }}>No completed jobs yet for this year.</div>
        ) : rd.topCustomers.map(([k, rev]) => {
          const maxRev = rd.topCustomers[0]?.[1] || 1;
          const pct = Math.round(rev / maxRev * 100);
          const custRecord = customers[k];
          const displayName = custRecord
            ? (custRecord.company ? `${custRecord.company} · ${custRecord.name}` : custRecord.name)
            : (savedQuotes.find(q => (q.customerId || (q.name || '').trim().toUpperCase()) === k)?.name || k);
          return (
            <div key={k} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{displayName}</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--teal-dark)' }}>${rev.toFixed(2)}</span>
              </div>
              <div style={{ background: '#e2e8f0', borderRadius: 20, height: 8, overflow: 'hidden' }}>
                <div style={{ background: 'var(--teal)', width: `${pct}%`, height: '100%', borderRadius: 20, transition: 'width 0.4s' }} />
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
