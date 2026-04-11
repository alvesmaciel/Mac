import { FinanceStore } from './core/store.js';
import { FinanceParser } from './core/parser.js';
import { ChatPanel } from './features/chat/chat-panel.js';
import { ChartsPanel } from './features/charts/charts-panel.js';
import { TransactionsTable } from './features/transactions/transactions-table.js';
import { FinanceDashboard } from './ui/dashboard.js';
import { ThemeController } from './ui/theme-controller.js';
import { escHtml, formatBRL } from './shared/utils.js';

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

        const saved = this.store.load();

        if (saved?.chatHistory?.length) {
            this.chat.restoreHistory(saved.chatHistory);
        } else {
            this.chat.renderWelcome();
        }

        this.renderAll();

        if (this.store.hasTransactions()) {

            const bubble = this.chat.addBubble(
                `Dados restaurados: <strong>${this.store.getAllTransactions().length}</strong> transacao(oes) carregada(s).`,
                'msg--response type-income'
            );

            this.chat.persist();

            setTimeout(() => {
                bubble.remove();
            }, 5000);
        }
    }

    renderAll() {
        this.dashboard.render(this.store.getTotals());
        this.table.render(this.store.getAllTransactions());
        this.charts.render(this.store);
        this.store.save(this.chat.getHistory());
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
            if (!confirm('Limpar todas as transacoes e o historico do chat?')) return;
            this.store.clear();
            this.chat.renderWelcome();
            this.renderAll();
        });
    }
}

setTimeout(() => {
    bubble.classList.add('fade-out');

    setTimeout(() => {
        bubble.remove();
    }, 300);

}, 5000);