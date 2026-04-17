import { formatBRL, round2 } from '../../shared/utils.js';

/* ═══════════════════════════════════════════════════
   ReportGenerator
   Usage: ReportGenerator.open(store)
═══════════════════════════════════════════════════ */

export class ReportGenerator {

    /* ── public entry point ── */
    static open(store) {
        const snapshot = ReportGenerator._buildSnapshot(store);
        const html     = ReportGenerator._buildHTML(snapshot);
        const win      = window.open('', '_blank');
        if (!win) { alert('Permita pop-ups para gerar o relatório.'); return; }
        win.document.write(html);
        win.document.close();
    }

    /* ══ SNAPSHOT ══════════════════════════════════ */
    static _buildSnapshot(store) {
        const all  = store.getAllTransactions();
        const dates = all.map(t => t.date).sort();

        return {
            generatedAt    : new Date().toISOString(),
            firstDate      : dates[0]  ?? new Date().toISOString(),
            lastDate       : dates[dates.length - 1] ?? new Date().toISOString(),
            totalTx        : all.length,
            totals         : store.getTotals(),
            transactions   : all,
            monthlyTotals  : ReportGenerator._monthlyTotals(all),
            categoryTotals : ReportGenerator._categoryTotals(all),
            insights       : ReportGenerator._buildInsights(store.getTotals(), all),
            userName       : ReportGenerator._userName(),
        };
    }

    static _monthlyTotals(txs) {
        const map = {};
        txs.forEach(tx => {
            const key = tx.date.slice(0, 7);          // YYYY-MM
            if (!map[key]) map[key] = { income: 0, expenses: 0 };
            if (tx.type === 'income')  map[key].income   = round2(map[key].income   + tx.value);
            if (tx.type === 'expense') map[key].expenses = round2(map[key].expenses + tx.value);
        });
        return map;
    }

    static _categoryTotals(txs) {
        const map = {};
        txs
            .filter(tx => tx.type === 'expense' || tx.type === 'debt')
            .forEach(tx => {
                map[tx.category] = round2((map[tx.category] ?? 0) + tx.value);
            });
        return map;
    }

    static _buildInsights(totals, txs) {
        const insights = [];
        const { income, expenses, debts, receivables, balance } = totals;

        // savings rate
        if (income > 0) {
            const rate = round2((income - expenses) / income * 100);
            if (rate >= 20) {
                insights.push(`Parabéns! Sua taxa de poupança é de <strong>${rate}%</strong> — um ótimo resultado. Continue priorizando as reservas.`);
            } else if (rate >= 0) {
                insights.push(`Sua taxa de poupança é de <strong>${rate}%</strong>. O ideal recomendado é acima de 20% — há espaço para melhorar.`);
            } else {
                insights.push(`Atenção: seus gastos superaram sua receita em <strong>${formatBRL(Math.abs(rate / 100 * income))}</strong>. Revise as despesas com urgência.`);
            }
        }

        // top category
        const catEntries = Object.entries(_categoryTotalsFromTxs(txs)).sort((a, b) => b[1] - a[1]);
        if (catEntries.length > 0 && expenses > 0) {
            const [topCat, topVal] = catEntries[0];
            const pct = round2(topVal / (expenses + totals.debts) * 100);
            if (pct >= 40) {
                insights.push(`Quase metade dos seus gastos está concentrada em <strong>${topCat}</strong> (${pct}% — ${formatBRL(topVal)}). Uma redução de 10% aqui representaria <strong>${formatBRL(round2(topVal * 0.1))}</strong> de economia.`);
            } else {
                insights.push(`Sua maior categoria de gasto é <strong>${topCat}</strong> com ${formatBRL(topVal)} (${pct}% do total gasto).`);
            }
        }

        // debt warning
        if (debts > 0) {
            insights.push(`Você tem <strong>${formatBRL(debts)}</strong> a pagar registrado. Quitar antes do vencimento evita juros e mantém o saldo saudável.`);
        }

        // receivables check
        if (receivables > 0 && receivables > balance) {
            insights.push(`Seu saldo atual (${formatBRL(balance)}) é menor que o valor a receber (${formatBRL(receivables)}). Confirme os recebimentos pendentes para uma visão mais precisa.`);
        }

        // month-over-month
        const monthly = ReportGenerator._monthlyTotals(txs);
        const months  = Object.keys(monthly).sort();
        if (months.length >= 2) {
            const prev = monthly[months[months.length - 2]];
            const curr = monthly[months[months.length - 1]];
            const delta = round2(curr.expenses - prev.expenses);
            if (delta > 0) {
                insights.push(`Seus gastos em ${_fmtMonth(months[months.length - 1])} foram <strong>${formatBRL(delta)} maiores</strong> do que em ${_fmtMonth(months[months.length - 2])}. Verifique o que gerou esse aumento.`);
            } else if (delta < 0) {
                insights.push(`Ótimo: seus gastos em ${_fmtMonth(months[months.length - 1])} caíram <strong>${formatBRL(Math.abs(delta))}</strong> em relação ao mês anterior.`);
            }
        }

        return insights.slice(0, 5);
    }

    static _userName() {
        try {
            const u = JSON.parse(localStorage.getItem('af_logged') ?? '{}');
            return u.name ?? '';
        } catch { return ''; }
    }

    /* ══ HTML TEMPLATE ════════════════════════════ */
    static _buildHTML(s) {
        const months  = Object.keys(s.monthlyTotals).sort();
        const catEntries = Object.entries(s.categoryTotals).sort((a, b) => b[1] - a[1]);
        const totalSpend = round2(s.totals.expenses + s.totals.debts);

        // collapse tiny categories into "Outros"
        let chartCats = [], chartVals = [];
        let outros = 0;
        catEntries.forEach(([cat, val]) => {
            const pct = totalSpend > 0 ? val / totalSpend * 100 : 0;
            if (pct < 2) { outros += val; }
            else { chartCats.push(cat); chartVals.push(val); }
        });
        if (outros > 0) { chartCats.push('Outros'); chartVals.push(round2(outros)); }

        // savings rate for cover
        const savingsRate = s.totals.income > 0
            ? round2((s.totals.income - s.totals.expenses) / s.totals.income * 100)
            : null;

        const periodDays = Math.max(1, Math.round(
            (new Date(s.lastDate) - new Date(s.firstDate)) / 86400000
        ));

        const CHART_COLORS = ['#2D6A4F','#1A4D7C','#B7791F','#C0392B','#5B3A8C','#2E7D6B','#8B5E0C','#A93226','#6B6760','#1C7A8A'];

        return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>AutoFinance — Relatório</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --cream:#F7F4EE;--cream-dark:#EDE9E0;--cream-deep:#DDD9CE;
  --ink:#1C1A17;--ink-muted:#6B6760;--ink-faint:#ABA89F;
  --green:#2D6A4F;--green-light:#E8F5EE;
  --red:#C0392B;--red-light:#FDECEA;
  --amber:#B7791F;--amber-light:#FEF3C7;
  --blue:#1A4D7C;--blue-light:#E8F0FA;
  --font-display:'DM Serif Display',serif;
  --font-mono:'DM Mono',monospace;
  --font-body:'DM Sans',sans-serif;
  --radius:10px;
}
html{background:var(--cream);color:var(--ink);font-family:var(--font-body);font-size:15px;-webkit-font-smoothing:antialiased}
body{max-width:900px;margin:0 auto;padding:2.5rem 2rem 4rem}

/* ── print btn ── */
.print-btn{position:fixed;top:1.2rem;right:1.5rem;display:flex;align-items:center;gap:.4rem;padding:.42rem .9rem;border:1.5px solid var(--cream-deep);border-radius:var(--radius);background:#fff;font-family:var(--font-body);font-size:.75rem;font-weight:500;color:var(--ink-muted);cursor:pointer;z-index:100}
.print-btn:hover{border-color:var(--ink);color:var(--ink)}
@media print{.print-btn{display:none}}

/* ── cover ── */
.cover{border-bottom:1.5px solid var(--cream-deep);padding-bottom:2rem;margin-bottom:2.5rem}
.cover-top{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;margin-bottom:1.5rem}
.af-logo{display:flex;align-items:center;gap:.55rem}
.logo-mark{width:30px;height:30px;background:var(--ink);color:var(--cream);font-family:var(--font-mono);font-size:.68rem;font-weight:500;letter-spacing:.05em;border-radius:6px;display:flex;align-items:center;justify-content:center}
.logo-text{font-family:var(--font-display);font-size:1.15rem;color:var(--ink)}
.cover-meta{font-family:var(--font-mono);font-size:.72rem;color:var(--ink-faint);text-align:right;line-height:1.7}
.cover-title{font-family:var(--font-display);font-size:2.2rem;color:var(--ink);margin-bottom:.5rem;line-height:1.1}
.cover-summary{font-size:.88rem;color:var(--ink-muted);line-height:1.7;max-width:640px;margin-bottom:1rem}
.savings-badge{display:inline-flex;align-items:center;gap:.45rem;padding:.35rem .8rem;border-radius:99px;font-family:var(--font-mono);font-size:.75rem;font-weight:500}
.savings-badge.good{background:var(--green-light);color:var(--green)}
.savings-badge.warn{background:var(--amber-light);color:var(--amber)}
.savings-badge.bad{background:var(--red-light);color:var(--red)}

/* ── section headings ── */
.section-title{font-family:var(--font-display);font-size:1.3rem;color:var(--ink);margin-bottom:1.2rem}
.section{margin-bottom:3rem}

/* ── KPI strip ── */
.kpi-strip{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:.8rem;margin-bottom:2.5rem}
.kpi-card{background:#fff;border-radius:var(--radius);padding:.9rem 1rem;border:1.5px solid transparent}
.kpi-label{display:block;font-size:.64rem;font-weight:500;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-muted);margin-bottom:.4rem}
.kpi-value{display:block;font-family:var(--font-mono);font-size:1.1rem;font-weight:500;color:var(--ink)}
.kpi--balance{border-color:var(--cream-deep)}
.kpi--income{border-left:3px solid var(--green)}.kpi--income .kpi-value{color:var(--green)}
.kpi--expense{border-left:3px solid var(--red)}.kpi--expense .kpi-value{color:var(--red)}
.kpi--receivable{border-left:3px solid var(--blue)}.kpi--receivable .kpi-value{color:var(--blue)}
.kpi--debt{border-left:3px solid var(--amber)}.kpi--debt .kpi-value{color:var(--amber)}
.trend-up{color:var(--green);font-size:.8rem;margin-left:.3rem}
.trend-down{color:var(--red);font-size:.8rem;margin-left:.3rem}

/* ── charts ── */
.charts-grid{display:grid;grid-template-columns:1.3fr 1fr;gap:1.2rem;margin-bottom:2.5rem}
@media(max-width:680px){.charts-grid{grid-template-columns:1fr}}
.chart-card{background:#fff;border-radius:var(--radius);padding:1.2rem;border:1.5px solid var(--cream-dark)}
.chart-label{font-size:.68rem;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-muted);margin-bottom:.6rem}
.chart-legend{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:.8rem;font-size:.72rem;color:var(--ink-muted)}
.legend-dot{width:9px;height:9px;border-radius:2px;display:inline-block;margin-right:4px;vertical-align:middle}
.chart-canvas-wrap{position:relative;width:100%;height:220px}

/* ── category table ── */
.cat-table{width:100%;border-collapse:collapse;font-size:.82rem;margin-bottom:.5rem}
.cat-table thead tr{background:var(--cream-dark)}
.cat-table th{padding:.55rem .9rem;text-align:left;font-size:.64rem;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-muted)}
.cat-table tbody tr{border-bottom:1px solid var(--cream-dark)}
.cat-table tbody tr:last-child{border-bottom:none}
.cat-table td{padding:.6rem .9rem;vertical-align:middle}
.cat-table tbody tr:first-child td{font-weight:500}
.pct-bar-wrap{width:90px;background:var(--cream-deep);border-radius:99px;height:5px;overflow:hidden;display:inline-block;vertical-align:middle;margin-right:.5rem}
.pct-bar-fill{height:100%;border-radius:99px;background:var(--red)}
.cat-amount{font-family:var(--font-mono);font-size:.8rem}

/* ── tx table ── */
.tx-table-wrap{background:#fff;border-radius:var(--radius);border:1.5px solid var(--cream-dark);overflow:hidden;margin-bottom:2rem}
.tx-table{width:100%;border-collapse:collapse;font-size:.8rem;table-layout:fixed}
.tx-table colgroup col:nth-child(1){width:96px}
.tx-table colgroup col:nth-child(2){width:90px}
.tx-table colgroup col:nth-child(3){width:auto}
.tx-table colgroup col:nth-child(4){width:130px}
.tx-table colgroup col:nth-child(5){width:115px}
.tx-table thead tr{background:var(--cream-dark);border-bottom:1.5px solid var(--cream-deep)}
.tx-table th{padding:.6rem .85rem;text-align:left;font-size:.63rem;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-muted)}
.tx-table tbody tr{border-bottom:1px solid var(--cream-dark)}
.tx-table tbody tr:last-child{border-bottom:none}
.tx-table tbody tr:nth-child(even){background:rgba(247,244,238,.6)}
.tx-table td{padding:.62rem .85rem;vertical-align:middle;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tx-table td.val{font-family:var(--font-mono);font-size:.78rem;text-align:right}
.tx-table td.date-cell{font-family:var(--font-mono);font-size:.72rem;color:var(--ink-muted)}
.type-badge{display:inline-flex;align-items:center;padding:.18rem .55rem;border-radius:99px;font-size:.66rem;font-weight:500;white-space:nowrap}
.badge-income{background:var(--green-light);color:var(--green)}
.badge-expense{background:var(--red-light);color:var(--red)}
.badge-receivable{background:var(--blue-light);color:var(--blue)}
.badge-debt{background:var(--amber-light);color:var(--amber)}

/* ── insights ── */
.insights-list{display:flex;flex-direction:column;gap:.75rem}
.insight-item{display:flex;gap:.85rem;background:#fff;border-radius:var(--radius);padding:1rem 1.1rem;border:1.5px solid var(--cream-dark);align-items:flex-start}
.insight-num{width:22px;height:22px;border-radius:50%;background:var(--cream-deep);color:var(--ink-muted);font-family:var(--font-mono);font-size:.7rem;font-weight:500;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.insight-text{font-size:.84rem;color:var(--ink-muted);line-height:1.65}
.insight-text strong{color:var(--ink);font-weight:500}

/* ── footer ── */
.report-footer{border-top:1.5px solid var(--cream-deep);padding-top:1.2rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem}
.footer-left{font-family:var(--font-mono);font-size:.68rem;color:var(--ink-faint)}
.footer-right{font-size:.72rem;color:var(--ink-faint)}

@media print{
  body{max-width:100%;padding:1cm}
  .charts-grid{grid-template-columns:1fr 1fr}
  .kpi-strip{grid-template-columns:repeat(5,1fr)}
  .tx-table-wrap{page-break-inside:auto}
  .tx-table tbody tr{page-break-inside:avoid}
  .section{page-break-inside:avoid}
}
</style>
</head>
<body>

<button class="print-btn" onclick="window.print()">
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
  Imprimir
</button>

<!-- ══ COVER ══ -->
<div class="cover">
  <div class="cover-top">
    <div class="af-logo">
      <div class="logo-mark">AF</div>
      <span class="logo-text">AutoFinance</span>
    </div>
    <div class="cover-meta">
      ${s.userName ? `<div>${_escHtml(s.userName)}</div>` : ''}
      <div>Gerado em ${_fmtDate(s.generatedAt)}</div>
      <div>Período: ${_fmtDate(s.firstDate)} – ${_fmtDate(s.lastDate)} (${periodDays} dias)</div>
    </div>
  </div>
  <h1 class="cover-title">Relatório Financeiro</h1>
  <p class="cover-summary">
    ${_buildSummaryParagraph(s, savingsRate, periodDays)}
  </p>
  ${savingsRate !== null ? `
  <span class="savings-badge ${savingsRate >= 20 ? 'good' : savingsRate >= 0 ? 'warn' : 'bad'}">
    ${savingsRate >= 20 ? '▲' : savingsRate >= 0 ? '→' : '▼'} Taxa de poupança: ${savingsRate}%
  </span>` : ''}
</div>

<!-- ══ KPI STRIP ══ -->
<div class="section">
  <h2 class="section-title">Visão Geral</h2>
  <div class="kpi-strip">
    <div class="kpi-card kpi--balance">
      <span class="kpi-label">Saldo Total</span>
      <span class="kpi-value">${formatBRL(s.totals.balance)}<span class="${s.totals.balance >= 0 ? 'trend-up' : 'trend-down'}">${s.totals.balance >= 0 ? '▲' : '▼'}</span></span>
    </div>
    <div class="kpi-card kpi--income">
      <span class="kpi-label">Total Recebido</span>
      <span class="kpi-value">${formatBRL(s.totals.income)}</span>
    </div>
    <div class="kpi-card kpi--expense">
      <span class="kpi-label">Total Gasto</span>
      <span class="kpi-value">${formatBRL(s.totals.expenses)}</span>
    </div>
    <div class="kpi-card kpi--receivable">
      <span class="kpi-label">A Receber</span>
      <span class="kpi-value">${formatBRL(s.totals.receivables)}</span>
    </div>
    <div class="kpi-card kpi--debt">
      <span class="kpi-label">A Pagar</span>
      <span class="kpi-value">${formatBRL(s.totals.debts)}</span>
    </div>
  </div>
</div>

<!-- ══ CHARTS ══ -->
${months.length > 0 || chartCats.length > 0 ? `
<div class="section">
  <h2 class="section-title">Análise Visual</h2>
  <div class="charts-grid">

    ${months.length > 0 ? `
    <div class="chart-card">
      <p class="chart-label">Receita vs Despesa por Mês</p>
      <div class="chart-legend">
        <span><span class="legend-dot" style="background:#2D6A4F"></span>Receita</span>
        <span><span class="legend-dot" style="background:#C0392B"></span>Despesa</span>
      </div>
      <div class="chart-canvas-wrap">
        <canvas id="barChart" role="img" aria-label="Gráfico de barras: receita vs despesa por mês"></canvas>
      </div>
    </div>` : ''}

    ${chartCats.length > 0 ? `
    <div class="chart-card">
      <p class="chart-label">Gastos por Categoria</p>
      <div class="chart-canvas-wrap" style="height:200px">
        <canvas id="pieChart" role="img" aria-label="Gráfico de rosca: distribuição de gastos por categoria"></canvas>
      </div>
    </div>` : ''}

  </div>
</div>` : ''}

<!-- ══ CATEGORY TABLE ══ -->
${catEntries.length > 0 ? `
<div class="section">
  <h2 class="section-title">Breakdown por Categoria</h2>
  <div class="tx-table-wrap">
    <table class="cat-table">
      <thead><tr><th>Categoria</th><th>Valor</th><th>% do Total</th><th>Distribuição</th></tr></thead>
      <tbody>
        ${catEntries.map(([cat, val]) => {
            const pct = totalSpend > 0 ? round2(val / totalSpend * 100) : 0;
            return `<tr>
              <td>${_escHtml(cat)}</td>
              <td class="cat-amount">${formatBRL(val)}</td>
              <td style="font-family:var(--font-mono);font-size:.78rem">${pct}%</td>
              <td>
                <div style="display:flex;align-items:center">
                  <div class="pct-bar-wrap"><div class="pct-bar-fill" style="width:${Math.min(pct,100)}%"></div></div>
                  <span style="font-size:.7rem;color:var(--ink-faint)">${pct}%</span>
                </div>
              </td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>
  ${catEntries.length > 0 && totalSpend > 0 ? `<p style="font-size:.78rem;color:var(--ink-muted);margin-top:.5rem">Maior categoria: <strong style="color:var(--ink)">${catEntries[0][0]}</strong> com ${formatBRL(catEntries[0][1])} (${round2(catEntries[0][1] / totalSpend * 100)}% do total gasto).</p>` : ''}
</div>` : ''}

<!-- ══ TRANSACTIONS TABLE ══ -->
<div class="section">
  <h2 class="section-title">Todas as Transações</h2>
  <div class="tx-table-wrap">
    <table class="tx-table">
      <colgroup><col/><col/><col/><col/><col/></colgroup>
      <thead>
        <tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Categoria</th><th style="text-align:right">Valor</th></tr>
      </thead>
      <tbody>
        ${[...s.transactions].sort((a,b) => b.date.localeCompare(a.date)).map(tx => `
        <tr>
          <td class="date-cell">${_fmtDateShort(tx.date)}</td>
          <td><span class="type-badge badge-${tx.type}">${_typeLabel(tx.type)}</span></td>
          <td title="${_escHtml(tx.description)}">${_escHtml(tx.description)}</td>
          <td style="color:var(--ink-muted);font-size:.76rem">${_escHtml(tx.category)}</td>
          <td class="val" style="color:${tx.type==='income'?'var(--green)':tx.type==='expense'?'var(--red)':tx.type==='debt'?'var(--amber)':'var(--blue)'}">${formatBRL(tx.value)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
  <p style="font-size:.73rem;color:var(--ink-faint);margin-top:.35rem">${s.totalTx} transação(ões) no total.</p>
</div>

<!-- ══ INSIGHTS ══ -->
${s.insights.length > 0 ? `
<div class="section">
  <h2 class="section-title">Insights e Recomendações</h2>
  <div class="insights-list">
    ${s.insights.map((text, i) => `
    <div class="insight-item">
      <div class="insight-num">${i + 1}</div>
      <p class="insight-text">${text}</p>
    </div>`).join('')}
  </div>
</div>` : ''}

<!-- ══ FOOTER ══ -->
<div class="report-footer">
  <span class="footer-left">AutoFinance · Relatório gerado em ${_fmtDate(s.generatedAt)}</span>
  <span class="footer-right">Este relatório é baseado nos dados registrados pelo usuário e não constitui aconselhamento financeiro.</span>
</div>

<script>
(function(){
  const monthly = ${JSON.stringify(s.monthlyTotals)};
  const months  = Object.keys(monthly).sort();
  const chartCats = ${JSON.stringify(chartCats)};
  const chartVals = ${JSON.stringify(chartVals)};
  const COLORS = ${JSON.stringify(CHART_COLORS)};

  // Bar chart
  const barCtx = document.getElementById('barChart');
  if (barCtx && months.length > 0) {
    new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: months.map(m => {
          const [y, mo] = m.split('-');
          return new Date(+y, +mo - 1).toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
        }),
        datasets: [
          { label: 'Receita',  data: months.map(m => monthly[m].income),   backgroundColor: '#2D6A4F', borderRadius: 5, borderSkipped: false },
          { label: 'Despesa', data: months.map(m => monthly[m].expenses), backgroundColor: '#C0392B', borderRadius: 5, borderSkipped: false },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + ctx.raw.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: 'DM Mono', size: 11 }, color: '#6B6760' } },
          y: { grid: { color: '#EDE9E0' }, ticks: { font: { family: 'DM Mono', size: 10 }, color: '#6B6760', callback: v => 'R$' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v) } },
        },
      },
    });
  }

  // Pie / doughnut chart
  const pieCtx = document.getElementById('pieChart');
  if (pieCtx && chartCats.length > 0) {
    new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: chartCats,
        datasets: [{ data: chartVals, backgroundColor: COLORS.slice(0, chartCats.length), borderWidth: 2, borderColor: '#fff' }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'DM Sans', size: 11 }, color: '#6B6760', padding: 10, boxWidth: 10 } },
          tooltip: { callbacks: { label: ctx => ' ' + ctx.label + ': ' + ctx.raw.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) } },
        },
        cutout: '62%',
      },
    });
  }
})();
</script>
</body>
</html>`;
    }
}

/* ══ private helpers ══════════════════════════════ */

function _categoryTotalsFromTxs(txs) {
    const map = {};
    txs.filter(tx => tx.type === 'expense' || tx.type === 'debt')
       .forEach(tx => { map[tx.category] = round2((map[tx.category] ?? 0) + tx.value); });
    return map;
}

function _buildSummaryParagraph(s, savingsRate, periodDays) {
    const parts = [];
    parts.push(`Este relatório cobre <strong>${periodDays} dia${periodDays !== 1 ? 's' : ''}</strong> de movimentações financeiras, com <strong>${s.totalTx} transação(ões)</strong> registrada(s).`);
    if (s.totals.income > 0) {
        parts.push(`Seu saldo atual é de <strong>${formatBRL(s.totals.balance)}</strong>, com ${formatBRL(s.totals.income)} recebidos e ${formatBRL(s.totals.expenses)} gastos no período.`);
    } else {
        parts.push(`Nenhuma receita foi registrada no período. Total gasto: <strong>${formatBRL(s.totals.expenses)}</strong>.`);
    }
    if (savingsRate !== null && savingsRate >= 0) {
        parts.push(`Taxa de poupança: <strong>${savingsRate}%</strong>.`);
    }
    return parts.join(' ');
}

function _fmtDate(iso) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function _fmtDateShort(iso) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function _fmtMonth(yyyyMM) {
    const [y, m] = yyyyMM.split('-');
    return new Date(+y, +m - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
}

function _escHtml(val) {
    return String(val ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _typeLabel(type) {
    return { income: 'Receita', expense: 'Gasto', debt: 'A Pagar', receivable: 'A Receber' }[type] ?? type;
}