import { formatBRL, round2 } from '../../shared/utils.js';

export class ReportGenerator {
    static open(store) {
        try {
            const snapshot = ReportGenerator._buildSnapshot(store);
            const html = ReportGenerator._buildHTML(snapshot);
            const win = window.open('', '_blank');

            if (!win) {
                alert('Permita pop-ups para gerar o relatorio.');
                return;
            }

            win.document.open();
            win.document.write(html);
            win.document.close();
            win.focus();
        } catch (error) {
            console.error('Erro ao gerar relatorio:', error);
            alert('Nao foi possivel abrir o relatorio. Verifique os dados das transacoes e tente novamente.');
        }
    }

    static _buildSnapshot(store) {
        const all = store.getAllTransactions().map((tx) => ReportGenerator._normalizeTx(tx));
        const dates = all.map((tx) => tx.date).sort();

        return {
            generatedAt: new Date().toISOString(),
            firstDate: dates[0] ?? new Date().toISOString().slice(0, 10),
            lastDate: dates[dates.length - 1] ?? new Date().toISOString().slice(0, 10),
            totalTx: all.length,
            totals: store.getTotals(),
            transactions: all,
            monthlyTotals: ReportGenerator._monthlyTotals(all),
            categoryTotals: ReportGenerator._categoryTotals(all),
            insights: ReportGenerator._buildInsights(store.getTotals(), all),
            userName: ReportGenerator._userName(),
        };
    }

    static _normalizeTx(tx) {
        const timestamp = tx.timestamp ?? (tx.date ? new Date(tx.date).getTime() : Date.now());
        const date = tx.date || new Date(timestamp).toISOString().slice(0, 10);

        return {
            ...tx,
            timestamp,
            date,
            description: tx.description || '-',
            category: tx.category || 'Geral',
            value: Number(tx.value || 0),
        };
    }

    static _monthlyTotals(txs) {
        const map = {};
        txs.forEach((tx) => {
            const key = tx.date.slice(0, 7);
            if (!map[key]) map[key] = { income: 0, expenses: 0 };
            if (tx.type === 'income') map[key].income = round2(map[key].income + tx.value);
            if (tx.type === 'expense') map[key].expenses = round2(map[key].expenses + tx.value);
        });
        return map;
    }

    static _categoryTotals(txs) {
        const map = {};
        txs
            .filter((tx) => tx.type === 'expense' || tx.type === 'debt')
            .forEach((tx) => {
                map[tx.category] = round2((map[tx.category] ?? 0) + tx.value);
            });
        return map;
    }

    static _buildInsights(totals, txs) {
        const insights = [];
        const { income, expenses, debts, receivables, balance } = totals;

        if (income > 0) {
            const rate = round2(((income - expenses) / income) * 100);
            if (rate >= 20) {
                insights.push(`Parabens! Sua taxa de poupanca esta em <strong>${rate}%</strong>, um resultado muito saudavel.`);
            } else if (rate >= 0) {
                insights.push(`Sua taxa de poupanca esta em <strong>${rate}%</strong>. Ainda ha espaco para aproximar de 20%.`);
            } else {
                insights.push(`Atencao: os gastos superaram a receita em <strong>${formatBRL(Math.abs((rate / 100) * income))}</strong>.`);
            }
        }

        const catEntries = Object.entries(_categoryTotalsFromTxs(txs)).sort((a, b) => b[1] - a[1]);
        if (catEntries.length > 0 && (expenses + debts) > 0) {
            const [topCat, topVal] = catEntries[0];
            const pct = round2((topVal / (expenses + debts)) * 100);
            insights.push(`A maior concentracao de gastos esta em <strong>${topCat}</strong>, com ${formatBRL(topVal)} (${pct}% do total).`);
        }

        if (debts > 0) {
            insights.push(`Ha <strong>${formatBRL(debts)}</strong> registrados como valores a pagar.`);
        }

        if (receivables > 0 && receivables > balance) {
            insights.push(`O valor a receber (${formatBRL(receivables)}) esta acima do saldo atual (${formatBRL(balance)}).`);
        }

        const monthly = ReportGenerator._monthlyTotals(txs);
        const months = Object.keys(monthly).sort();
        if (months.length >= 2) {
            const prev = monthly[months[months.length - 2]];
            const curr = monthly[months[months.length - 1]];
            const delta = round2(curr.expenses - prev.expenses);
            if (delta > 0) {
                insights.push(`Os gastos de ${_fmtMonth(months[months.length - 1])} ficaram ${formatBRL(delta)} acima do mes anterior.`);
            } else if (delta < 0) {
                insights.push(`Os gastos de ${_fmtMonth(months[months.length - 1])} cairam ${formatBRL(Math.abs(delta))} em relacao ao mes anterior.`);
            }
        }

        return insights.slice(0, 5);
    }

    static _userName() {
        try {
            const user = JSON.parse(localStorage.getItem('af_logged') ?? '{}');
            return user.name ?? '';
        } catch {
            return '';
        }
    }

    static _buildHTML(snapshot) {
        const months = Object.keys(snapshot.monthlyTotals).sort();
        const catEntries = Object.entries(snapshot.categoryTotals).sort((a, b) => b[1] - a[1]);
        const totalSpend = round2(snapshot.totals.expenses + snapshot.totals.debts);
        const normalizedTransactions = [...snapshot.transactions].sort((a, b) => b.timestamp - a.timestamp);

        const chartCats = [];
        const chartVals = [];
        let outros = 0;

        catEntries.forEach(([cat, val]) => {
            const pct = totalSpend > 0 ? (val / totalSpend) * 100 : 0;
            if (pct < 2) outros += val;
            else {
                chartCats.push(cat);
                chartVals.push(val);
            }
        });

        if (outros > 0) {
            chartCats.push('Outros');
            chartVals.push(round2(outros));
        }

        const savingsRate = snapshot.totals.income > 0
            ? round2(((snapshot.totals.income - snapshot.totals.expenses) / snapshot.totals.income) * 100)
            : null;

        const periodDays = Math.max(
            1,
            Math.round((new Date(snapshot.lastDate) - new Date(snapshot.firstDate)) / 86400000),
        );

        const chartColors = ['#2D6A4F', '#1A4D7C', '#B7791F', '#C0392B', '#5B3A8C', '#2E7D6B', '#8B5E0C', '#A93226', '#6B6760', '#1C7A8A'];

        return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>AutoFinance - Relatorio</title>
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
.print-btn{position:fixed;top:1.2rem;right:1.5rem;display:flex;align-items:center;gap:.4rem;padding:.42rem .9rem;border:1.5px solid var(--cream-deep);border-radius:var(--radius);background:#fff;font-family:var(--font-body);font-size:.75rem;font-weight:500;color:var(--ink-muted);cursor:pointer;z-index:100}
.print-btn:hover{border-color:var(--ink);color:var(--ink)}
@media print{.print-btn{display:none}}
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
.section-title{font-family:var(--font-display);font-size:1.3rem;color:var(--ink);margin-bottom:1.2rem}
.section{margin-bottom:3rem}
.kpi-strip{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:.8rem;margin-bottom:2.5rem}
.kpi-card{background:#fff;border-radius:var(--radius);padding:.9rem 1rem;border:1.5px solid transparent}
.kpi-label{display:block;font-size:.64rem;font-weight:500;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-muted);margin-bottom:.4rem}
.kpi-value{display:block;font-family:var(--font-mono);font-size:1.1rem;font-weight:500;color:var(--ink)}
.kpi--balance{border-color:var(--cream-deep)}
.kpi--income{border-left:3px solid var(--green)}.kpi--income .kpi-value{color:var(--green)}
.kpi--expense{border-left:3px solid var(--red)}.kpi--expense .kpi-value{color:var(--red)}
.kpi--receivable{border-left:3px solid var(--blue)}.kpi--receivable .kpi-value{color:var(--blue)}
.kpi--debt{border-left:3px solid var(--amber)}.kpi--debt .kpi-value{color:var(--amber)}
.charts-grid{display:grid;grid-template-columns:1.3fr 1fr;gap:1.2rem;margin-bottom:2.5rem}
@media(max-width:680px){.charts-grid{grid-template-columns:1fr}}
.chart-card{background:#fff;border-radius:var(--radius);padding:1.2rem;border:1.5px solid var(--cream-dark)}
.chart-label{font-size:.68rem;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-muted);margin-bottom:.6rem}
.chart-canvas-wrap{position:relative;width:100%;height:220px}
.cat-table,.tx-table{width:100%;border-collapse:collapse}
.tx-table-wrap{background:#fff;border-radius:var(--radius);border:1.5px solid var(--cream-dark);overflow:hidden}
.cat-table th,.tx-table th{padding:.6rem .85rem;text-align:left;font-size:.63rem;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-muted);background:var(--cream-dark)}
.cat-table td,.tx-table td{padding:.62rem .85rem;border-bottom:1px solid var(--cream-dark);font-size:.8rem}
.tx-table td.val{font-family:var(--font-mono);text-align:right}
.tx-table td.date-cell{font-family:var(--font-mono);font-size:.72rem;color:var(--ink-muted)}
.type-badge{display:inline-flex;align-items:center;padding:.18rem .55rem;border-radius:99px;font-size:.66rem;font-weight:500;white-space:nowrap}
.badge-income{background:var(--green-light);color:var(--green)}
.badge-expense{background:var(--red-light);color:var(--red)}
.badge-receivable{background:var(--blue-light);color:var(--blue)}
.badge-debt{background:var(--amber-light);color:var(--amber)}
.insights-list{display:flex;flex-direction:column;gap:.75rem}
.insight-item{display:flex;gap:.85rem;background:#fff;border-radius:var(--radius);padding:1rem 1.1rem;border:1.5px solid var(--cream-dark);align-items:flex-start}
.insight-num{width:22px;height:22px;border-radius:50%;background:var(--cream-deep);color:var(--ink-muted);font-family:var(--font-mono);font-size:.7rem;font-weight:500;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.insight-text{font-size:.84rem;color:var(--ink-muted);line-height:1.65}
.insight-text strong{color:var(--ink);font-weight:500}
.report-footer{border-top:1.5px solid var(--cream-deep);padding-top:1.2rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem}
.footer-left{font-family:var(--font-mono);font-size:.68rem;color:var(--ink-faint)}
.footer-right{font-size:.72rem;color:var(--ink-faint)}
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">Imprimir</button>

<div class="cover">
  <div class="cover-top">
    <div class="af-logo">
      <div class="logo-mark">AF</div>
      <span class="logo-text">AutoFinance</span>
    </div>
    <div class="cover-meta">
      ${snapshot.userName ? `<div>${_escHtml(snapshot.userName)}</div>` : ''}
      <div>Gerado em ${_fmtDate(snapshot.generatedAt)}</div>
      <div>Periodo: ${_fmtDate(snapshot.firstDate)} - ${_fmtDate(snapshot.lastDate)} (${periodDays} dias)</div>
    </div>
  </div>
  <h1 class="cover-title">Relatorio Financeiro</h1>
  <p class="cover-summary">${_buildSummaryParagraph(snapshot, savingsRate, periodDays)}</p>
  ${savingsRate !== null ? `<span class="savings-badge ${savingsRate >= 20 ? 'good' : savingsRate >= 0 ? 'warn' : 'bad'}">Taxa de poupanca: ${savingsRate}%</span>` : ''}
</div>

<div class="section">
  <h2 class="section-title">Visao Geral</h2>
  <div class="kpi-strip">
    <div class="kpi-card kpi--balance"><span class="kpi-label">Saldo Total</span><span class="kpi-value">${formatBRL(snapshot.totals.balance)}</span></div>
    <div class="kpi-card kpi--income"><span class="kpi-label">Total Recebido</span><span class="kpi-value">${formatBRL(snapshot.totals.income)}</span></div>
    <div class="kpi-card kpi--expense"><span class="kpi-label">Total Gasto</span><span class="kpi-value">${formatBRL(snapshot.totals.expenses)}</span></div>
    <div class="kpi-card kpi--receivable"><span class="kpi-label">A Receber</span><span class="kpi-value">${formatBRL(snapshot.totals.receivables)}</span></div>
    <div class="kpi-card kpi--debt"><span class="kpi-label">A Pagar</span><span class="kpi-value">${formatBRL(snapshot.totals.debts)}</span></div>
  </div>
</div>

${months.length > 0 || chartCats.length > 0 ? `
<div class="section">
  <h2 class="section-title">Analise Visual</h2>
  <div class="charts-grid">
    ${months.length > 0 ? `<div class="chart-card"><p class="chart-label">Receita vs Despesa por Mes</p><div class="chart-canvas-wrap"><canvas id="barChart"></canvas></div></div>` : ''}
    ${chartCats.length > 0 ? `<div class="chart-card"><p class="chart-label">Gastos por Categoria</p><div class="chart-canvas-wrap"><canvas id="pieChart"></canvas></div></div>` : ''}
  </div>
</div>` : ''}

${catEntries.length > 0 ? `
<div class="section">
  <h2 class="section-title">Breakdown por Categoria</h2>
  <div class="tx-table-wrap">
    <table class="cat-table">
      <thead><tr><th>Categoria</th><th>Valor</th><th>% do Total</th></tr></thead>
      <tbody>
        ${catEntries.map(([cat, val]) => {
            const pct = totalSpend > 0 ? round2((val / totalSpend) * 100) : 0;
            return `<tr><td>${_escHtml(cat)}</td><td>${formatBRL(val)}</td><td>${pct}%</td></tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>
</div>` : ''}

<div class="section">
  <h2 class="section-title">Todas as Transacoes</h2>
  <div class="tx-table-wrap">
    <table class="tx-table">
      <thead><tr><th>Data</th><th>Tipo</th><th>Descricao</th><th>Categoria</th><th style="text-align:right">Valor</th></tr></thead>
      <tbody>
        ${normalizedTransactions.map((tx) => `
          <tr>
            <td class="date-cell">${_fmtDateShort(tx.date)}</td>
            <td><span class="type-badge badge-${tx.type}">${_typeLabel(tx.type)}</span></td>
            <td>${_escHtml(tx.description)}</td>
            <td>${_escHtml(tx.category)}</td>
            <td class="val" style="color:${tx.type === 'income' ? 'var(--green)' : tx.type === 'expense' ? 'var(--red)' : tx.type === 'debt' ? 'var(--amber)' : 'var(--blue)'}">${formatBRL(tx.value)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</div>

${snapshot.insights.length > 0 ? `
<div class="section">
  <h2 class="section-title">Insights e Recomendacoes</h2>
  <div class="insights-list">
    ${snapshot.insights.map((text, index) => `<div class="insight-item"><div class="insight-num">${index + 1}</div><p class="insight-text">${text}</p></div>`).join('')}
  </div>
</div>` : ''}

<div class="report-footer">
  <span class="footer-left">AutoFinance - Relatorio gerado em ${_fmtDate(snapshot.generatedAt)}</span>
  <span class="footer-right">Baseado nos dados registrados no app.</span>
</div>

<script>
(function(){
  const monthly = ${JSON.stringify(snapshot.monthlyTotals)};
  const months = Object.keys(monthly).sort();
  const chartCats = ${JSON.stringify(chartCats)};
  const chartVals = ${JSON.stringify(chartVals)};
  const colors = ${JSON.stringify(chartColors)};

  const barCtx = document.getElementById('barChart');
  if (barCtx && months.length > 0) {
    new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: months.map((m) => {
          const parts = m.split('-');
          return new Date(Number(parts[0]), Number(parts[1]) - 1).toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
        }),
        datasets: [
          { label: 'Receita', data: months.map((m) => monthly[m].income), backgroundColor: '#2D6A4F', borderRadius: 5, borderSkipped: false },
          { label: 'Despesa', data: months.map((m) => monthly[m].expenses), backgroundColor: '#C0392B', borderRadius: 5, borderSkipped: false }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true }
        }
      }
    });
  }

  const pieCtx = document.getElementById('pieChart');
  if (pieCtx && chartCats.length > 0) {
    new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: chartCats,
        datasets: [{ data: chartVals, backgroundColor: colors.slice(0, chartCats.length), borderWidth: 2, borderColor: '#fff' }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%'
      }
    });
  }
})();
</script>
</body>
</html>`;
    }
}

function _categoryTotalsFromTxs(txs) {
    const map = {};
    txs
        .filter((tx) => tx.type === 'expense' || tx.type === 'debt')
        .forEach((tx) => {
            map[tx.category] = round2((map[tx.category] ?? 0) + tx.value);
        });
    return map;
}

function _buildSummaryParagraph(snapshot, savingsRate, periodDays) {
    const parts = [];
    parts.push(`Este relatorio cobre <strong>${periodDays} dia${periodDays !== 1 ? 's' : ''}</strong> de movimentacoes financeiras, com <strong>${snapshot.totalTx} transacao(oes)</strong> registrada(s).`);

    if (snapshot.totals.income > 0) {
        parts.push(`Seu saldo atual e <strong>${formatBRL(snapshot.totals.balance)}</strong>, com ${formatBRL(snapshot.totals.income)} recebidos e ${formatBRL(snapshot.totals.expenses)} gastos no periodo.`);
    } else {
        parts.push(`Nenhuma receita foi registrada no periodo. Total gasto: <strong>${formatBRL(snapshot.totals.expenses)}</strong>.`);
    }

    if (savingsRate !== null && savingsRate >= 0) {
        parts.push(`Taxa de poupanca: <strong>${savingsRate}%</strong>.`);
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
    const parts = yyyyMM.split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
}

function _escHtml(val) {
    return String(val ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function _typeLabel(type) {
    return {
        income: 'Receita',
        expense: 'Gasto',
        debt: 'A Pagar',
        receivable: 'A Receber',
    }[type] ?? type;
}
