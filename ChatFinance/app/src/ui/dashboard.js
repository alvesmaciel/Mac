import { formatBRL } from '../shared/utils.js';

export class FinanceDashboard {
    constructor() {
        this.balanceEl = document.getElementById('kpiBalance');
        this.incomeEl = document.getElementById('kpiIncome');
        this.expenseEl = document.getElementById('kpiExpense');
        this.debtEl = document.getElementById('kpiDebt');
        this.receivableEl = document.getElementById('kpiReceivable');
    }

    render(totals) {
        this.renderKpi(this.balanceEl, totals.balance, totals.balance > 0 ? 'amount-pos-kpi' : totals.balance < 0 ? 'amount-neg-kpi' : '');
        this.renderKpi(this.incomeEl, totals.income);
        this.renderKpi(this.expenseEl, totals.expenses);
        this.renderKpi(this.debtEl, totals.debts);
        this.renderKpi(this.receivableEl, totals.receivables);
    }

    renderKpi(element, value, extraClass = '') {
        element.textContent = formatBRL(value);
        element.classList.remove('amount-pos-kpi', 'amount-neg-kpi');
        if (extraClass) element.classList.add(extraClass);

        element.style.transform = 'scale(1.07)';
        setTimeout(() => {
            element.style.transform = 'scale(1)';
        }, 170);
    }
}
