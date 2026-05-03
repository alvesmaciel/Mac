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
import { DuplicateDetector } from './features/automation/duplicate-detector.js';
import { PatternAnalyzer } from './features/automation/pattern-analyzer.js';
import { SmartAlerts } from './features/automation/smart-alerts.js';
import { RecurringDetector } from './features/automation/recurring-detector.js';
import { SmartCategorizer } from './features/automation/smart-categorizer.js';
import { AutoCorrection } from './features/automation/auto-correction.js';
import { ImportManager } from './features/import/import-manager.js';
import { ImportUI } from './features/import/import-ui.js';
import { settingsPanel } from './features/settings/automation-settings.js';

const REPORT_THRESHOLD = 3;

const supabaseClient = supabase.createClient(
    'https://smaojgaqishjnvhlewkz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtYW9qZ2FxaXNoam52aGxld2t6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNTUyMzEsImV4cCI6MjA5MjczMTIzMX0.4g8xDwRhnLgOnhH3SY5MpEuSAA2833Je63COfJ1HlZ0'
);

const { data, error } = await supabaseClient
  .from('transactions')
  .select('*');


export class AutoFinanceApp {
    constructor() {
        this.parser = new FinanceParser();
        this.wsManager = new WorkspaceManager();
        this.wsUI = new WorkspaceUI(this.wsManager, (id) => this._switchWorkspace(id));
        this.store = this._makeStore(this.wsManager.getActiveId());

        this.dashboard = new FinanceDashboard();
        this.charts = new ChartsPanel({ onToggle: () => this.renderAll() });
        this.theme = new ThemeController({
            onThemeChange: () => this.charts.refreshIfVisible(this.store),
        });

        this.table = new TransactionsTable({
            onDelete: (id, type) => this.handleDelete(id, type),
            onUpdate: (id, data) => this.handleUpdate(id, data),
        });

        this.duplicateDetector = new DuplicateDetector(this.store);
        this.patternAnalyzer = new PatternAnalyzer(this.store);
        this.smartCategorizer = new SmartCategorizer(this.store);
        this.autoCorrection = new AutoCorrection(this.store);
        this.recurringDetector = new RecurringDetector(this.store);
        this.smartAlerts = new SmartAlerts(this.store, this.duplicateDetector, this.patternAnalyzer);

        this.importManager = new ImportManager(this.store);
        this.importUI = new ImportUI(this.importManager);

        this.chat = new ChatPanel({
            parser: this.parser,
            store: this.store,
            settings: settingsPanel,
            onStateChange: () => this.renderAll(),
            categorizer: this.smartCategorizer,
            duplicateDetector: this.duplicateDetector,
            alerts: this.smartAlerts,
            autoCorrection: this.autoCorrection,
            recurringDetector: this.recurringDetector,
        });

        this.activeView = 'dashboard';
        this.homeSections = [];
        this.viewContainer = null;
        this.viewTitle = null;
        this.viewSubtitle = null;
        this.viewButtons = [];
        this.graphButton = null;
        this.reportButton = null;
    }

    _makeStore(wsId) {
        return new FinanceStore(this.wsManager.storeKey(wsId));
    }

    _syncModuleStores() {
        this.chat.store = this.store;
        this.duplicateDetector.store = this.store;
        this.patternAnalyzer.store = this.store;
        this.smartCategorizer.store = this.store;
        this.recurringDetector.store = this.store;
        this.smartAlerts.store = this.store;
        this.importManager.store = this.store;
    }

    _switchWorkspace(wsId) {
        this.store.save(this.chat.getHistory());

        this.store = this._makeStore(wsId);
        this.store.load();
        this._syncModuleStores();

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
                `Espaco <strong>${escHtml(ws.name)}</strong>: ${this.store.getAllTransactions().length} transacao(oes) carregada(s).`,
                'msg--response type-income',
                'Sistema',
            );

            setTimeout(() => {
                bubble.classList.add('fade-out');
                setTimeout(() => bubble.remove(), 300);
            }, 3500);
        }
    }

    _updateDocTitle() {
        const ws = this.wsManager.getActive();
        document.title = ws ? `AutoFinance - ${ws.name}` : 'AutoFinance';
    }

    boot() {
        window.app = this;
        this.duplicateDetector.sensitivity = settingsPanel.get('duplicateSensitivity', 0.85);
        this.smartAlerts.toggle(settingsPanel.get('smartAlerts', true));
        this.theme.boot();
        this.chat.bind();
        this.bindClearAll();
        this.bindReportButton();
        this.bindViewNavigation();
        this.bindAutomationEvents();

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
                `Dados restaurados: <strong>${this.store.getAllTransactions().length}</strong> transacoes carregadas.`,
                'msg--response type-income',
                'Sistema',
            );

            this.chat.persist();

            setTimeout(() => {
                bubble.classList.add('fade-out');
                setTimeout(() => bubble.remove(), 300);
            }, 4000);
        }
    }

    bindAutomationEvents() {
        document.addEventListener('automation-settings-changed', (event) => {
            const settings = event.detail?.settings || settingsPanel.settings;
            this.duplicateDetector.sensitivity = settings.duplicateSensitivity ?? this.duplicateDetector.sensitivity;
            this.smartAlerts.toggle(settings.smartAlerts !== false);
        });

        window.addEventListener('chatMessageEdited', (event) => {
            const { messageId, newText, transactionId } = event.detail || {};
            this.handleEditedMessage(messageId, newText, transactionId);
        });

        window.addEventListener('chatMessageDeleted', (event) => {
            const { transactionId } = event.detail || {};
            if (!transactionId) return;

            const removed = this.store.deleteTransactionById(Number(transactionId));
            if (removed) {
                this.chat.addBubble(
                    `Mensagem removida. A transacao vinculada de <strong>${formatBRL(removed.value)}</strong> tambem foi excluida.`,
                    'msg--response type-unknown',
                    'AutoFinance',
                );
                this.renderAll();
            }
        });
    }

    bindViewNavigation() {
        this.viewContainer = document.getElementById('dashboardView');
        this.viewTitle = document.getElementById('dashViewTitle');
        this.viewSubtitle = document.getElementById('dashViewSubtitle');
        this.homeSections = Array.from(document.querySelectorAll('[data-home-section]'));
        this.viewButtons = Array.from(document.querySelectorAll('[data-view]'));
        this.graphButton = document.getElementById('graphToggleBtn');
        this.reportButton = document.getElementById('reportBtn');

        this.viewButtons.forEach((button) => {
            button.addEventListener('click', () => this.setActiveView(button.dataset.view));
        });
    }

    setActiveView(view) {
        this.activeView = view;

        this.viewButtons.forEach((button) => {
            button.classList.toggle('is-active', button.dataset.view === view);
        });

        const isDashboard = view === 'dashboard';
        this.homeSections.forEach((section) => {
            section.classList.toggle('hidden', !isDashboard);
        });
        [this.graphButton, this.reportButton].forEach((button) => {
            button?.classList.toggle('hidden', !isDashboard);
        });

        this.viewContainer.classList.toggle('hidden', isDashboard);

        if (isDashboard) {
            this.viewTitle.textContent = 'Painel Financeiro';
            this.viewSubtitle.textContent = 'Acompanhe saldos, transacoes e graficos em tempo real.';
            this.viewContainer.innerHTML = '';
            return;
        }

        if (view === 'settings') {
            this.viewTitle.textContent = 'Configuracoes e automacoes';
            this.viewSubtitle.textContent = 'Ative so o que fizer sentido para o usuario e veja o efeito de cada recurso.';
            settingsPanel.renderPage(this.viewContainer);
            return;
        }

        if (view === 'import') {
            this.viewTitle.textContent = 'Central de importacao';
            this.viewSubtitle.textContent = 'Importe extratos com previsao, tratamento de duplicidade e proximos formatos planejados.';
            this.importUI.renderPage(this.viewContainer, {
                onImportComplete: (result) => this.handleImportComplete(result),
            });
        }
    }

    handleImportComplete(result) {
        this.renderAll();
        this.setActiveView('dashboard');
        this.chat.addBubble(
            `Importacao concluida. <strong>${result?.imported || 0}</strong> transacao(oes) adicionada(s) e <strong>${result?.skipped || 0}</strong> pulada(s).`,
            'msg--response type-income',
            'Importador',
        );
    }

    renderAll() {
        this.dashboard.render(this.store.getTotals());
        this.table.render(this.store.getAllTransactions());
        this.charts.render(this.store);
        this.store.save(this.chat.getHistory());
        this._updateReportButton();
        this.wsUI.refresh();

        if (this.activeView === 'settings' && this.viewContainer) {
            settingsPanel.renderPage(this.viewContainer);
        }
        if (this.activeView === 'import' && this.viewContainer) {
            this.importUI.renderPage(this.viewContainer, {
                onImportComplete: (result) => this.handleImportComplete(result),
            });
        }
    }

    handleDelete(id, type) {
        const removed = this.store.deleteById(id, type);
        if (!removed) return;

        this.chat.addBubble(
            `Removido: <strong>${formatBRL(removed.value)}</strong> | ${escHtml(removed.category)}` +
                (removed.description !== '-' ? ` <span style="opacity:.6">(${escHtml(removed.description)})</span>` : ''),
            'msg--response type-unknown',
            'AutoFinance',
        );

        this.renderAll();
    }

    handleUpdate(id, newData) {
        const updated = this.store.updateTransaction(id, newData);
        if (!updated) return;

        if (settingsPanel.get('learnFromCorrections', true) && updated.description && updated.category) {
            this.smartCategorizer.learnFromUser(updated.description, updated.category, updated.type);
        }

        this.chat.addBubble(
            `Atualizado: <strong>${formatBRL(updated.value)}</strong> (${escHtml(updated.category)})`,
            'msg--response type-income',
            'AutoFinance',
        );

        this.renderAll();
    }

    handleEditedMessage(messageId, newText, transactionId) {
        if (transactionId) {
            this.store.deleteTransactionById(Number(transactionId));
        }

        const corrected = settingsPanel.get('autoCorrection', true)
            ? this.autoCorrection.correct(newText)
            : newText;
        const parsed = this.parser.parse(corrected);

        if (!parsed || parsed.type === 'multi' || !parsed.value || parsed.type?.startsWith('cmd_')) {
            this.chat.addBubble(
                'Nao consegui transformar a edicao em uma transacao valida.',
                'msg--response type-unknown',
                'AutoFinance',
            );
            this.renderAll();
            return;
        }

        if (settingsPanel.get('autoCateg', true) && parsed.description) {
            const suggestion = this.smartCategorizer.suggestCategory(parsed.description, parsed.type);
            if (suggestion?.category) {
                parsed.category = suggestion.category;
            }
        }

        const tx = this.store.addTransaction(parsed);
        if (settingsPanel.get('learnFromCorrections', true) && tx.description && tx.category) {
            this.smartCategorizer.learnFromUser(tx.description, tx.category, tx.type);
        }

        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageEl) {
            messageEl.setAttribute('data-transaction-id', tx.id);
        }

        this.renderAll();

        this.chat.addBubble(
            `Edicao aplicada: <strong>${formatBRL(tx.value)}</strong> em ${escHtml(tx.category)}.`,
            'msg--response type-income',
            'AutoFinance',
        );
    }

    bindClearAll() {
        document.getElementById('clearBtn')?.addEventListener('click', () => {
            const ws = this.wsManager.getActive();
            if (!confirm(`Limpar todas as transacoes de "${ws.name}"?`)) return;

            this.store.clear();
            this.chat.renderWelcome();
            this.chat.addBubble(
                'Tudo limpo. Voce pode recomecar pelo chat ou usar a central de importacao.',
                'msg--response',
                'Sistema',
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
                    `Adicione pelo menos <strong>${REPORT_THRESHOLD} transacoes</strong> para gerar o relatorio. Agora voce tem ${count}.`,
                    'msg--response type-unknown',
                    'Relatorios',
                );
                return;
            }

            this.chat.addBubble(
                'Gerando relatorio financeiro.',
                'msg--response type-income',
                'Relatorios',
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
        this._reportBtn.style.cursor = ready ? 'pointer' : 'not-allowed';
        this._reportBtn.title = ready
            ? 'Gerar relatorio financeiro'
            : `Adicione ${REPORT_THRESHOLD - count} transacao(oes)`;
    }

    
}
