import { FinanceStore } from './core/store.js';
import { FinanceParser } from './core/parser.js';
import { ChatPanel } from './features/chat/chat-panel.js';
import { ChartsPanel } from './features/charts/charts-panel.js';
import { TransactionsTable } from './features/transactions/transactions-table.js';
import { FinanceDashboard } from './ui/dashboard.js';
import { ThemeController } from './ui/theme-controller.js';
import { ReportGenerator } from './features/report/report-generator.js';
import { WorkspaceManager } from './features/workspaces/workspace-manager.js';
import { WorkspaceUI } from './features/workspaces/workspace-ui.js';
import { escHtml, formatBRL } from './shared/utils.js';

const REPORT_THRESHOLD = 3;

export class AutoFinanceApp {
    constructor() {
        this.parser    = new FinanceParser();
        this.wsManager = new WorkspaceManager();
        this.wsUI      = new WorkspaceUI(this.wsManager, (id) => this._switchWorkspace(id));

        this.store = this._makeStore(this.wsManager.getActiveId());

        this.dashboard = new FinanceDashboard();
        this.charts    = new ChartsPanel({ onToggle: () => this.renderAll() });
        this.theme     = new ThemeController({ onThemeChange: () => this.charts.refreshIfVisible(this.store) });

        this.table = new TransactionsTable({
            onDelete: (id, type) => this.handleDelete(id, type),
            onUpdate: (id, data) => this.handleUpdate(id, data),
        });

        this.chat = new ChatPanel({
            parser: this.parser,
            store: this.store,
            onStateChange: () => this.renderAll(),
        });
        
    }

    /* ═══════════════════════════════════ */
    /* 🔥 RESPOSTAS INTELIGENTES DO CHAT  */
    /* ═══════════════════════════════════ */

    smartReply(data) {
        const value = formatBRL(data.value);

        const variations = {
            expense: [
                `Ok, registrei ${value} em ${data.category}`,
                `${value} gasto anotado`,
                `Anotado: ${value} (${data.category})`
            ],
            income: [
                `Boa! Entrou ${value} 💰`,
                `${value} recebido`,
                `Receita registrada: ${value}`
            ],
            debt: [
                `Conta anotada: ${value}`,
                `${value} pendente registrada`
            ],
            receivable: [
                `Você tem ${value} a receber`
            ]
        };

        const list = variations[data.type] || [`Registrei ${value}`];

        return list[Math.floor(Math.random() * list.length)];
    }

    /* ══ Workspace helpers ═══════════════════════ */

    _makeStore(wsId) {
        return new FinanceStore(this.wsManager.storeKey(wsId));
    }

    _switchWorkspace(wsId) {
        this.store.save(this.chat.getHistory());

        this.store      = this._makeStore(wsId);
        this.chat.store = this.store;

        const saved = this.store.load();

        if (saved?.chatHistory?.length) {
            this.chat.restoreHistory(saved.chatHistory);
        } else {
            this.chat.renderWelcome();
        }

        this._updateDocTitle();
        this.renderAll();

        if (this.store.hasTransactions()) {
            const ws = this.wsManager.getActive();

            const bubble = this.chat.addBubble(
                `📁 Espaço <strong>${escHtml(ws.name)}</strong>: ${this.store.getAllTransactions().length} transação(ões) carregada(s).`,
                'msg--response type-income',
            );

            setTimeout(() => {
                bubble.classList.add('fade-out');
                setTimeout(() => bubble.remove(), 300);
            }, 4000);
        }
    }

    _updateDocTitle() {
        const ws = this.wsManager.getActive();
        document.title = ws ? `AutoFinance — ${ws.name}` : 'AutoFinance';
    }

    /* ══ Boot ════════════════════════════════════ */

    boot() {
        this.theme.boot();
        this.chat.bind();
        this.bindClearAll();
        this.bindReportButton();

        this.wsUI.mount();
        this._updateDocTitle();

        const saved = this.store.load();

        if (saved?.chatHistory?.length) {
            this.chat.restoreHistory(saved.chatHistory);
        } else {
            this.chat.renderWelcome();
        }

        this.renderAll();

        if (this.store.hasTransactions()) {
            const bubble = this.chat.addBubble(
                `📊 Dados restaurados: <strong>${this.store.getAllTransactions().length}</strong> transações carregadas.`,
                'msg--response type-income',
            );

            this.chat.persist();

            setTimeout(() => {
                bubble.classList.add('fade-out');
                setTimeout(() => bubble.remove(), 300);
            }, 5000);
        }
    }

    /* ══ Render ══════════════════════════════════ */

    renderAll() {
        this.dashboard.render(this.store.getTotals());
        this.table.render(this.store.getAllTransactions());
        this.charts.render(this.store);
        this.store.save(this.chat.getHistory());
        this._updateReportButton();
        this.wsUI.refresh();
    }

    /* ══ Handlers ════════════════════════════════ */

    handleDelete(id, type) {
        const removed = this.store.deleteById(id, type);
        if (!removed) return;

        this.chat.addBubble(
            `❌ Removido: <strong>${formatBRL(removed.value)}</strong> | ${escHtml(removed.category)}` +
            (removed.description !== '-' ? ` <span style="opacity:.6">(${escHtml(removed.description)})</span>` : ''),
            'msg--response type-unknown',
        );

        this.renderAll();
    }

    handleUpdate(id, newData) {
        const updated = this.store.updateTransaction(id, newData);
        if (!updated) return;

        this.chat.addBubble(
            `✏️ Atualizado: <strong>${formatBRL(updated.value)}</strong> (${escHtml(updated.category)})`,
            'msg--response type-income'
        );

        this.renderAll();
    }

    bindClearAll() {
        document.getElementById('clearBtn')?.addEventListener('click', () => {
            const ws = this.wsManager.getActive();

            if (!confirm(`Limpar todas as transações de "${ws.name}"?`)) return;

            this.store.clear();
            this.chat.renderWelcome();

            this.chat.addBubble(
                `🧹 Tudo limpo! Comece adicionando novas transações.`,
                'msg--response'
            );

            this.renderAll();
        });
    }

    bindReportButton() {
        const btn = document.getElementById('reportBtn');
        if (!btn) return;

        this._reportBtn = btn;

        btn.addEventListener('click', () => {
            const count = this.store.getAllTransactions().length;

            if (count < REPORT_THRESHOLD) {
                this.chat.addBubble(
                    `⚠️ Adicione pelo menos <strong>${REPORT_THRESHOLD} transações</strong> para gerar relatório.<br>
                     Você tem ${count}.`,
                    'msg--response type-unknown',
                );
                return;
            }

            this.chat.addBubble(
                `📄 Gerando relatório...`,
                'msg--response type-income'
            );

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
            : `Adicione ${REPORT_THRESHOLD - count} transação(ões)`;
    }
}