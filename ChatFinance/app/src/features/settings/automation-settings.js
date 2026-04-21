import { appStorage } from '../../shared/storage.js';

const SETTING_GROUPS = [
    {
        title: 'Chat',
        items: [
            {
                key: 'chatTypingEffect',
                title: 'Resposta com digitacao gradual',
                description: 'Mostra a resposta sendo escrita aos poucos para dar ritmo e previsibilidade ao chat.',
                type: 'boolean',
            },
            {
                key: 'chatContextRemembering',
                title: 'Memoria de contexto',
                description: 'Usa o historico da conversa para manter continuidade nas proximas mensagens.',
                type: 'boolean',
            },
            {
                key: 'fallbackSuggestions',
                title: 'Sugestoes quando houver ambiguidade',
                description: 'Quando a frase vier incompleta, o sistema tenta oferecer caminhos mais provaveis.',
                type: 'boolean',
            },
        ],
    },
    {
        title: 'Automacoes',
        items: [
            {
                key: 'autoCorrection',
                title: 'Auto-correcao',
                description: 'Ajusta erros comuns de digitacao antes do parser interpretar a mensagem.',
                type: 'boolean',
            },
            {
                key: 'autoCateg',
                title: 'Auto-categorizacao evolutiva',
                description: 'Sugere e aplica categorias com base no historico e nos termos mais frequentes.',
                type: 'boolean',
            },
            {
                key: 'duplicateDetection',
                title: 'Deteccao de duplicidade',
                description: 'Compara valor, categoria, descricao e data para evitar lancamentos repetidos.',
                type: 'boolean',
            },
            {
                key: 'recurringDetection',
                title: 'Lancamentos recorrentes',
                description: 'Procura repeticoes naturais para identificar contas e movimentos periodicos.',
                type: 'boolean',
            },
            {
                key: 'smartAlerts',
                title: 'Alertas inteligentes',
                description: 'Avisa sobre duplicidade, valor fora do padrao e excesso em categorias.',
                type: 'boolean',
            },
            {
                key: 'weeklyAnalysis',
                title: 'Analise semanal automatica',
                description: 'Prepara um resumo semanal para uso futuro no painel, sem interromper o fluxo atual.',
                type: 'boolean',
            },
            {
                key: 'timeDetection',
                title: 'Auto-deteccao de tempo',
                description: 'Interpreta termos como hoje, ontem e amanha para gravar a data correta.',
                type: 'boolean',
            },
        ],
    },
    {
        title: 'Ajustes finos',
        items: [
            {
                key: 'duplicateSensitivity',
                title: 'Sensibilidade da duplicidade',
                description: 'Quanto maior, mais parecido o lancamento precisa ser para virar alerta.',
                type: 'range',
                min: 0.5,
                max: 1,
                step: 0.05,
                format: (value) => `${Math.round(Number(value) * 100)}%`,
            },
            {
                key: 'autoCategConfidenceThreshold',
                title: 'Confianca minima da categorizacao',
                description: 'Define o limite minimo para a sugestao automatica de categoria.',
                type: 'range',
                min: 0.5,
                max: 1,
                step: 0.05,
                format: (value) => `${Math.round(Number(value) * 100)}%`,
            },
        ],
    },
];

export class SettingsPanel {
    constructor() {
        this.settings = { ...this.getDefaultSettings(), ...(appStorage.get('automationSettings') || {}) };
    }

    getDefaultSettings() {
        return {
            chatTypingEffect: true,
            chatContextRemembering: true,
            chatAutoSave: true,
            duplicateDetection: true,
            duplicateSensitivity: 0.85,
            patternAnalysis: true,
            anomalyDetection: true,
            weeklyAnalysis: true,
            smartAlerts: true,
            autoCateg: true,
            autoCategConfidenceThreshold: 0.85,
            learnFromCorrections: true,
            autoCorrection: true,
            recurringDetection: true,
            recurringAutoLaunch: false,
            timeDetection: true,
            fallbackSuggestions: true,
            language: 'pt-BR',
            theme: 'auto',
        };
    }

    save() {
        appStorage.set('automationSettings', this.settings);
        document.dispatchEvent(
            new CustomEvent('automation-settings-changed', {
                detail: { settings: this.settings },
            }),
        );
    }

    get(key, defaultValue = null) {
        return this.settings[key] !== undefined ? this.settings[key] : defaultValue;
    }

    set(key, value) {
        this.settings[key] = value;
        this.save();
    }

    reset() {
        this.settings = this.getDefaultSettings();
        this.save();
    }

    buildCard(item) {
        const value = this.settings[item.key];
        const status = item.type === 'boolean'
            ? (value ? 'Ativado' : 'Desativado')
            : item.format(Number(value));

        const control = item.type === 'boolean'
            ? `
                <label class="settings-switch">
                    <input type="checkbox" data-setting="${item.key}" ${value ? 'checked' : ''}>
                    <span class="settings-switch-ui"></span>
                </label>
            `
            : `
                <div class="settings-range-wrap">
                    <input
                        type="range"
                        data-setting="${item.key}"
                        min="${item.min}"
                        max="${item.max}"
                        step="${item.step}"
                        value="${value}"
                    >
                </div>
            `;

        return `
            <article class="settings-card" data-setting-card="${item.key}">
                <div class="settings-card-copy">
                    <div class="settings-card-title-row">
                        <h3>${item.title}</h3>
                        <span class="settings-status" data-setting-status="${item.key}">${status}</span>
                    </div>
                    <p>${item.description}</p>
                </div>
                <div class="settings-card-control">
                    ${control}
                </div>
            </article>
        `;
    }

    renderPage(container) {
        container.innerHTML = `
            <section class="settings-page">
                <div class="settings-page-header">
                    <div>
                        <span class="page-kicker">Configuracao cognitiva</span>
                        <h2>Controle as automacoes sem sair do contexto</h2>
                        <p>As alteracoes abaixo entram em vigor de forma imediata e o texto de status muda assim que voce interage.</p>
                    </div>
                    <button class="btn btn-secondary" id="resetAutomationSettings">Restaurar padrao</button>
                </div>
                ${SETTING_GROUPS.map((group) => `
                    <section class="settings-block">
                        <div class="settings-block-head">
                            <h3>${group.title}</h3>
                        </div>
                        <div class="settings-grid">
                            ${group.items.map((item) => this.buildCard(item)).join('')}
                        </div>
                    </section>
                `).join('')}
            </section>
        `;

        container.querySelectorAll('[data-setting]').forEach((element) => {
            element.addEventListener('input', () => this.handleSettingChange(element));
            element.addEventListener('change', () => this.handleSettingChange(element));
        });

        container.querySelector('#resetAutomationSettings')?.addEventListener('click', () => {
            if (!confirm('Restaurar configuracoes padrao das automacoes?')) return;
            this.reset();
            this.renderPage(container);
        });
    }

    handleSettingChange(element) {
        const key = element.dataset.setting;
        const rawValue = element.type === 'checkbox' ? element.checked : Number(element.value);
        this.settings[key] = rawValue;
        this.save();

        const statusEl = document.querySelector(`[data-setting-status="${key}"]`);
        if (statusEl) {
            const item = SETTING_GROUPS.flatMap((section) => section.items).find((entry) => entry.key === key);
            statusEl.textContent = item?.type === 'range' ? item.format(rawValue) : (rawValue ? 'Ativado' : 'Desativado');
        }

        const card = document.querySelector(`[data-setting-card="${key}"]`);
        if (card) {
            card.classList.add('setting-changed');
            setTimeout(() => card.classList.remove('setting-changed'), 350);
        }
    }
}

export const settingsPanel = new SettingsPanel();
