import { formatBRL, round2 } from '../../shared/utils.js';

const CHART_COLORS = ['#2D6A4F', '#1A4D7C', '#B7791F', '#C0392B', '#5B3A8C', '#2E7D6B', '#8B5E0C', '#A93226'];

export class ChartsPanel {
    constructor({ onToggle } = {}) {
        this.onToggle = onToggle;
        this.graphsHidden = true;
        this.pieChartInstance = null;
        this.barChartInstance = null;
        this.graphSection = document.getElementById('graphSection');
        this.toggleButton = document.getElementById('graphToggleBtn');
        this.toggleButton.addEventListener('click', () => this.toggle());
    }

    toggle() {
        this.graphsHidden = !this.graphsHidden;
        this.graphSection.classList.toggle('hidden', this.graphsHidden);
        this.toggleButton.innerHTML = this.graphsHidden
            ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg> Ver graficos'
            : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg> Ocultar graficos';

        if (!this.graphsHidden) {
            this.graphSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        this.onToggle?.(this.graphsHidden);
        return this.graphsHidden;
    }

    render(store) {
        if (this.graphsHidden) return;
        this.renderPieChart(store);
        this.renderBarChart(store);
    }

    refreshIfVisible(store) {
        if (!this.graphsHidden) this.render(store);
    }

    getChartTextColor() {
        return getComputedStyle(document.documentElement).getPropertyValue('--ink-muted').trim() || '#6B6760';
    }

    getChartGridColor() {
        return getComputedStyle(document.documentElement).getPropertyValue('--cream-dark').trim() || '#EDE9E0';
    }

    renderPieChart(store) {
        const ctx = document.getElementById('pieChart').getContext('2d');
        const totalsByCategory = {};

        [...store.expenses, ...store.debts].forEach((tx) => {
            totalsByCategory[tx.category] = round2((totalsByCategory[tx.category] || 0) + tx.value);
        });

        const labels = Object.keys(totalsByCategory);
        const data = Object.values(totalsByCategory);

        if (this.pieChartInstance) this.pieChartInstance.destroy();

        this.pieChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: CHART_COLORS.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: getComputedStyle(document.documentElement).getPropertyValue('--panel-bg').trim() || '#fff',
                }],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { family: 'DM Sans', size: 11 },
                            color: this.getChartTextColor(),
                            padding: 12,
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => ` ${formatBRL(context.raw)}`,
                        },
                    },
                },
                cutout: '60%',
            },
        });
    }

    renderBarChart(store) {
        const ctx = document.getElementById('barChart').getContext('2d');
        if (this.barChartInstance) this.barChartInstance.destroy();

        const totals = store.getTotals();
        this.barChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Recebido', 'Gasto', 'A Pagar', 'A Receber'],
                datasets: [{
                    label: 'R$',
                    data: [totals.income, totals.expenses, totals.debts, totals.receivables],
                    backgroundColor: ['#2D6A4F', '#C0392B', '#B7791F', '#1A4D7C'],
                    borderRadius: 6,
                    borderSkipped: false,
                }],
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => ` ${formatBRL(context.raw)}`,
                        },
                    },
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { family: 'DM Sans', size: 11 }, color: this.getChartTextColor() },
                    },
                    y: {
                        grid: { color: this.getChartGridColor() },
                        ticks: {
                            font: { family: 'DM Mono', size: 10 },
                            color: this.getChartTextColor(),
                            callback: (value) => formatBRL(value),
                        },
                    },
                },
            },
        });
    }
}
