/**
 * Settings Panel - Painel de configurações para automações
 * Ativar/desativar recursos, gerenciar preferências
 */

import { appStorage } from '../../shared/storage.js';

export class SettingsPanel {
    constructor() {
        this.settings = appStorage.get('automationSettings') || this.getDefaultSettings();
        this.isOpen = false;
    }

    /**
     * Configurações padrão
     */
    getDefaultSettings() {
        return {
            // Chat Features
            chatTypingEffect: true,
            chatShowTypingIndicator: true,
            chatAutoSave: true,
            chatContextRemembering: true,

            // Duplicate Detection
            duplicateDetection: true,
            duplicateSensitivity: 0.85, // 0-1
            duplicateTimeWindow: 30, // minutos

            // Pattern Analysis
            patternAnalysis: true,
            anomalyDetection: true,
            weeklyAnalysis: true,

            // Smart Alerts
            smartAlerts: true,
            alertsNotification: true,
            alertsCriticalOnly: false,

            // Auto-Categorization
            autoCateg: true,
            autoCategConfidenceThreshold: 0.85,
            learnFromCorrections: true,

            // Auto-Correction
            autoCorrection: true,
            correctionAggressiveness: 0.5, // 0-1 (quanto maior, mais corrige)

            // Recurring Transactions
            recurringDetection: true,
            recurringAutoLaunch: false, // Segurança: precisa ativar manualmente
            recurringMinOccurrences: 3,

            // Time Detection
            timeDetection: true,
            autoDateFromText: true,

            // Fallback Engine
            fallbackSuggestions: true,
            fallbackAutoApply: false,

            // Weekly Analysis
            weeklyAnalysisDay: 0, // 0=domingo, 1=seg, etc
            weeklyAnalysisHour: 9,

            // General
            language: 'pt-BR',
            theme: 'auto',
        };
    }

    /**
     * Cria elemento visual do painel
     */
    createPanelElement() {
        const overlay = document.createElement('div');
        overlay.className = 'settings-overlay';
        overlay.addEventListener('click', () => this.close());

        const panel = document.createElement('div');
        panel.className = 'settings-panel';
        panel.addEventListener('click', (e) => e.stopPropagation());

        // Header
        const header = document.createElement('div');
        header.className = 'settings-header';
        header.innerHTML = `
            <h2>⚙️ Configurações de Automação</h2>
            <button class="settings-close">✕</button>
        `;
        header.querySelector('.settings-close').addEventListener('click', () => this.close());

        // Content
        const content = document.createElement('div');
        content.className = 'settings-content';
        content.innerHTML = this.buildSettingsHTML();

        // Bind events
        content.querySelectorAll('[data-setting]').forEach(el => {
            el.addEventListener('change', () => this.handleSettingChange(el));
        });

        // Footer
        const footer = document.createElement('div');
        footer.className = 'settings-footer';
        footer.innerHTML = `
            <button class="btn btn-secondary" id="resetSettings">Restaurar Padrão</button>
            <button class="btn btn-primary" id="closeSettings">Fechar</button>
        `;
        footer.querySelector('#resetSettings').addEventListener('click', () => this.reset());
        footer.querySelector('#closeSettings').addEventListener('click', () => this.close());

        panel.appendChild(header);
        panel.appendChild(content);
        panel.appendChild(footer);

        overlay.appendChild(panel);

        return overlay;
    }

    /**
     * Constrói HTML das configurações
     */
    buildSettingsHTML() {
        return `
            <div class="settings-group">
                <h3>💬 Chat</h3>
                <div class="setting-item">
                    <label>
                        <input type="checkbox" data-setting="chatTypingEffect" ${this.settings.chatTypingEffect ? 'checked' : ''}>
                        <span>Efeito de digitação (ChatGPT)</span>
                        <small>Mostra caracteres sendo digitados em tempo real</small>
                    </label>
                </div>
                <div class="setting-item">
                    <label>
                        <input type="checkbox" data-setting="chatContextRemembering" ${this.settings.chatContextRemembering ? 'checked' : ''}>
                        <span>Memória de contexto</span>
                        <small>Lembra padrões de conversa anteriores</small>
                    </label>
                </div>
                <div class="setting-item">
                    <label>
                        <input type="checkbox" data-setting="chatAutoSave" ${this.settings.chatAutoSave ? 'checked' : ''}>
                        <span>Salvar automaticamente</span>
                        <small>Salva histórico do chat em background</small>
                    </label>
                </div>
            </div>

            <div class="settings-group">
                <h3>🔍 Análise Inteligente</h3>
                <div class="setting-item">
                    <label>
                        <input type="checkbox" data-setting="duplicateDetection" ${this.settings.duplicateDetection ? 'checked' : ''}>
                        <span>Detectar duplicidades</span>
                        <small>Identifica transações duplicadas (mesmo valor/categoria)</small>
                    </label>
                </div>
                <div class="setting-item">
                    <label>Sensibilidade de duplicidade</label>
                    <input type="range" data-setting="duplicateSensitivity" min="0.5" max="1" step="0.05" value="${this.settings.duplicateSensitivity}">
                    <small>Valor: ${(this.settings.duplicateSensitivity * 100).toFixed(0)}%</small>
                </div>
                <div class="setting-item">
                    <label>
                        <input type="checkbox" data-setting="patternAnalysis" ${this.settings.patternAnalysis ? 'checked' : ''}>
                        <span>Análise de padrões</span>
                        <small>Detecta tendências e hábitos de gasto</small>
                    </label>
                </div>
                <div class="setting-item">
                    <label>
                        <input type="checkbox" data-setting="anomalyDetection" ${this.settings.anomalyDetection ? 'checked' : ''}>
                        <span>Detectar anomalias</span>
                        <small>Alerta sobre transações atípicas</small>
                    </label>
                </div>
                <div class="setting-item">
                    <label>
                        <input type="checkbox" data-setting="weeklyAnalysis" ${this.settings.weeklyAnalysis ? 'checked' : ''}>
                        <span>Análise semanal automática</span>
                        <small>Gera relatório automático toda semana</small>
                    </label>
                </div>
            </div>

            <div class="settings-group">
                <h3>🔔 Alertas</h3>
                <div class="setting-item">
                    <label>
                        <input type="checkbox" data-setting="smartAlerts" ${this.settings.smartAlerts ? 'checked' : ''}>
                        <span>Alertas inteligentes</span>
                        <small>Notifica sobre eventos importantes</small>
                    </label>
                </div>
                <div class="setting-item">
                    <label>
                        <input type="checkbox" data-setting="alertsCriticalOnly" ${this.settings.alertsCriticalOnly ? 'checked' : ''}>
                        <span>Apenas alertas críticos</span>
                        <small>Filtra apenas avisos urgentes</small>
                    </label>
                </div>
            </div>

            <div class="settings-group">
                <h3>🏷️ Categorização</h3>
                <div class="setting-item">
                    <label>
                        <input type="checkbox" data-setting="autoCateg" ${this.settings.autoCateg ? 'checked' : ''}>
                        <span>Auto-categorização</span>
                        <small>Categoriza automaticamente novas transações</small>
                    </label>
                </div>
                <div class="setting-item">
                    <label>Confiança mínima:</label>
                    <input type="range" data-setting="autoCategConfidenceThreshold" min="0.5" max="1" step="0.05" value="${this.settings.autoCategConfidenceThreshold}">
                    <small>${(this.settings.autoCategConfidenceThreshold * 100).toFixed(0)}%</small>
                </div>
                <div class="setting-item">
                    <label>
                        <input type="checkbox" data-setting="learnFromCorrections" ${this.settings.learnFromCorrections ? 'checked' : ''}>
                        <span>Aprender com correções</span>
                        <small>Melhora sugestões com base em suas correções</small>
                    </label>
                </div>
            </div>

            <div class="settings-group">
                <h3>✏️ Correção Automática</h3>
                <div class="setting-item">
                    <label>
                        <input type="checkbox" data-setting="autoCorrection" ${this.settings.autoCorrection ? 'checked' : ''}>
                        <span>Auto-correção</span>
                        <small>Corrige typos e erros de digitação</small>
                    </label>
                </div>
                <div class="setting-item">
                    <label>Agressividade:</label>
                    <input type="range" data-setting="correctionAggressiveness" min="0" max="1" step="0.1" value="${this.settings.correctionAggressiveness}">
                    <small>${Math.round(this.settings.correctionAggressiveness * 100)}% (mais agressivo = mais corrige)</small>
                </div>
            </div>

            <div class="settings-group">
                <h3>🔁 Transações Recorrentes</h3>
                <div class="setting-item">
                    <label>
                        <input type="checkbox" data-setting="recurringDetection" ${this.settings.recurringDetection ? 'checked' : ''}>
                        <span>Detectar recorrências</span>
                        <small>Identifica padrões de transações periódicas</small>
                    </label>
                </div>
                <div class="setting-item">
                    <label>
                        <input type="checkbox" data-setting="recurringAutoLaunch" ${this.settings.recurringAutoLaunch ? 'checked' : ''}>
                        <span>Lançar automaticamente</span>
                        <small>⚠️ Cria automaticamente transações recorrentes confirmadas</small>
                    </label>
                </div>
            </div>

            <div class="settings-group">
                <h3>📅 Data/Hora</h3>
                <div class="setting-item">
                    <label>
                        <input type="checkbox" data-setting="timeDetection" ${this.settings.timeDetection ? 'checked' : ''}>
                        <span>Detectar data/hora</span>
                        <small>Extrai automaticamente datas do texto ("ontem", "3 dias atrás")</small>
                    </label>
                </div>
            </div>

            <div class="settings-group">
                <h3>💡 Sugestões</h3>
                <div class="setting-item">
                    <label>
                        <input type="checkbox" data-setting="fallbackSuggestions" ${this.settings.fallbackSuggestions ? 'checked' : ''}>
                        <span>Sugestões inteligentes</span>
                        <small>Oferece alternativas quando não entende entrada</small>
                    </label>
                </div>
            </div>
        `;
    }

    /**
     * Handler para mudança de configuração
     */
    handleSettingChange(element) {
        const key = element.getAttribute('data-setting');
        const value = element.type === 'checkbox' ? element.checked : element.value;

        this.settings[key] = value;
        this.save();

        // Feedback visual
        element.parentElement.classList.add('setting-changed');
        setTimeout(() => element.parentElement.classList.remove('setting-changed'), 500);
    }

    /**
     * Abre painel
     */
    open() {
        if (this.isOpen) return;

        const panel = this.createPanelElement();
        document.body.appendChild(panel);
        this.isOpen = true;

        // Animação de entrada
        setTimeout(() => panel.classList.add('visible'), 10);
    }

    /**
     * Fecha painel
     */
    close() {
        const overlay = document.querySelector('.settings-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        }
        this.isOpen = false;
    }

    /**
     * Reseta para configurações padrão
     */
    reset() {
        if (confirm('Restaurar todas as configurações para padrão?')) {
            this.settings = this.getDefaultSettings();
            this.save();
            this.close();
            this.open();
        }
    }

    /**
     * Salva configurações
     */
    save() {
        appStorage.set('automationSettings', this.settings);
    }

    /**
     * Restaura configurações
     */
    restore() {
        const saved = appStorage.get('automationSettings');
        if (saved) {
            this.settings = { ...this.getDefaultSettings(), ...saved };
        }
    }

    /**
     * Retorna valor de configuração
     */
    get(key, defaultValue = null) {
        return this.settings[key] !== undefined ? this.settings[key] : defaultValue;
    }

    /**
     * Define valor de configuração
     */
    set(key, value) {
        this.settings[key] = value;
        this.save();
    }

    /**
     * Cria botão de configurações para o header
     */
    createHeaderButton() {
        const btn = document.createElement('button');
        btn.id = 'settingsBtn';
        btn.title = 'Configurações';
        btn.className = 'header-action-btn settings-btn';
        btn.innerHTML = '⚙️ Config';
        btn.addEventListener('click', () => this.open());
        return btn;
    }
}

export const settingsPanel = new SettingsPanel();
