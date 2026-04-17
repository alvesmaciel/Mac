import { FinanceStore } from './core/store.js';
import { FinanceParser } from './core/parser.js';
import { ChatPanel } from './features/chat/chat-panel.js';
import { ChartsPanel } from './features/charts/charts-panel.js';
import { TransactionsTable } from './features/transactions/transactions-table.js';
import { FinanceDashboard } from './ui/dashboard.js';
import { ThemeController } from './ui/theme-controller.js';
import { ReportGenerator } from './features/report/report-generator.js';
import { escHtml, formatBRL } from './shared/utils.js';

const REPORT_THRESHOLD = 3; // minimum transactions to unlock report

export class AutoFinanceApp {
    constructor() {
        this.store = new FinanceStore();
        this.parser = new FinanceParser();
        this.dashboard = new FinanceDashboard();
        this.charts = new ChartsPanel({
            onToggle: () => this.renderAll(),
        });
        this.theme = new ThemeController({
            onThemeChange: () => this.charts.refreshIfVisible(this.store),
        });
        this.table = new TransactionsTable({
            onDelete: (id, type) => this.handleDelete(id, type),
            onUpdate: (id, newData) => this.handleUpdate(id, newData),
        });
        this.chat = new ChatPanel({
            parser: this.parser,
            store: this.store,
            onStateChange: () => this.renderAll(),
        });
    }

    boot() {
        this.theme.boot();
        this.chat.bind();
        this.bindClearAll();
        this.bindReportButton();

        const saved = this.store.load();

        if (saved?.chatHistory?.length) {
            this.chat.restoreHistory(saved.chatHistory);
        } else {
            this.chat.renderWelcome();
        }

        this.renderAll();

        if (this.store.hasTransactions()) {
            const bubble = this.chat.addBubble(
                `Dados restaurados: <strong>${this.store.getAllTransactions().length}</strong> transação(ões) carregada(s).`,
                'msg--response type-income'
            );

            this.chat.persist();

            setTimeout(() => {
                bubble.classList.add('fade-out');
                setTimeout(() => bubble.remove(), 300);
            }, 5000);
        }
    }

    renderAll() {
        this.dashboard.render(this.store.getTotals());
        this.table.render(this.store.getAllTransactions());
        this.charts.render(this.store);
        this.store.save(this.chat.getHistory());
        this._updateReportButton();
    }

    handleDelete(id, type) {
        const removed = this.store.deleteById(id, type);
        if (!removed) return;

        this.chat.addBubble(
            `Removido: <strong>${formatBRL(removed.value)}</strong> | ${escHtml(removed.category)}${removed.description !== '-' ? ` <span style="opacity:.6">(${escHtml(removed.description)})</span>` : ''}`,
            'msg--response type-unknown'
        );
        this.renderAll();
    }

    handleUpdate(id, newData) {
        const updated = this.store.updateTransaction(id, newData);
        if (!updated) return;
        this.renderAll();
    }

    bindClearAll() {
        document.getElementById('clearBtn').addEventListener('click', () => {
            if (!confirm('Limpar todas as transações e o histórico do chat?')) return;
            this.store.clear();
            this.chat.renderWelcome();
            this.renderAll();
        });
    }

    bindReportButton() {
        // The HTML has a duplicate id="graphToggleBtn" on the report button.
        // We select by text content as a safe fallback, but ideally rename it
        // to id="reportBtn" in index.html.
        const btn = document.getElementById('reportBtn')
            ?? [...document.querySelectorAll('.graph-toggle-btn')]
                .find(b => b.textContent.includes('Relatório'));

        if (!btn) return;

        this._reportBtn = btn;

        btn.addEventListener('click', () => {
            const count = this.store.getAllTransactions().length;
            if (count < REPORT_THRESHOLD) {
                this.chat.addBubble(
                    `Adicione pelo menos <strong>${REPORT_THRESHOLD} transações</strong> para gerar um relatório. Você tem ${count} até agora.`,
                    'msg--response type-unknown'
                );
                return;
            }
            ReportGenerator.open(this.store);
        });

        this._updateReportButton();
    }

    _updateReportButton() {
        if (!this._reportBtn) return;
        const count = this.store.getAllTransactions().length;
        const ready = count >= REPORT_THRESHOLD;
        this._reportBtn.style.opacity = ready ? '1' : '0.5';
        this._reportBtn.style.cursor  = ready ? 'pointer' : 'not-allowed';
        this._reportBtn.title = ready
            ? 'Gerar relatório financeiro'
            : `Adicione ${REPORT_THRESHOLD - count} transação(ões) para desbloquear o relatório`;
    }
}