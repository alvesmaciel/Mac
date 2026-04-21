/**
 * Import UI - Interface de importação de arquivos
 * Permite escolher formato e fazer upload
 */

export class ImportUI {
    constructor(importManager) {
        this.importManager = importManager;
        this.isOpen = false;
    }

    /**
     * Cria modal de importação
     */
    createModal() {
        const overlay = document.createElement('div');
        overlay.className = 'import-overlay';
        overlay.addEventListener('click', () => this.close());

        const modal = document.createElement('div');
        modal.className = 'import-modal';
        modal.addEventListener('click', (e) => e.stopPropagation());

        // Header
        const header = document.createElement('div');
        header.className = 'import-header';
        header.innerHTML = `
            <h2>📥 Importar Transações</h2>
            <button class="import-close">✕</button>
        `;
        header.querySelector('.import-close').addEventListener('click', () => this.close());

        // Conteúdo
        const content = document.createElement('div');
        content.className = 'import-content';
        content.innerHTML = `
            <div class="import-section">
                <h3>Escolha o formato do arquivo</h3>
                <div class="format-grid" id="formatGrid"></div>
            </div>

            <div class="import-section hidden" id="uploadSection">
                <h3>Carregar arquivo</h3>
                <div class="upload-area" id="uploadArea">
                    <div class="upload-icon">📁</div>
                    <p>Arraste o arquivo aqui ou clique para selecionar</p>
                    <input type="file" id="fileInput" class="file-input" accept=".csv,.pdf">
                </div>
                <div class="file-info" id="fileInfo"></div>
            </div>

            <div class="import-section hidden" id="previewSection">
                <h3>Pré-visualização</h3>
                <div class="preview-table" id="previewTable"></div>
                <div class="import-options">
                    <label>
                        <input type="radio" name="duplicateStrategy" value="skip" checked>
                        <span>Pular duplicatas</span>
                    </label>
                    <label>
                        <input type="radio" name="duplicateStrategy" value="merge">
                        <span>Mesclar com existentes</span>
                    </label>
                </div>
            </div>

            <div class="import-progress hidden" id="progressSection">
                <div class="progress-bar">
                    <div class="progress-fill" id="progressFill"></div>
                </div>
                <p id="progressText">Importando...</p>
            </div>

            <div class="import-result hidden" id="resultSection"></div>
        `;

        // Build format grid
        const formatGrid = content.querySelector('#formatGrid');
        this.importManager.getSupportedFormats().forEach(format => {
            const card = this.createFormatCard(format);
            formatGrid.appendChild(card);
        });

        // Bind upload events
        this.bindUploadEvents(content);

        // Footer
        const footer = document.createElement('div');
        footer.className = 'import-footer';
        footer.innerHTML = `
            <button class="btn btn-secondary" id="backBtn" style="display: none;">← Voltar</button>
            <button class="btn btn-primary" id="importBtn" style="display: none;">Importar</button>
            <button class="btn btn-secondary" id="closeBtn">Fechar</button>
        `;

        footer.querySelector('#closeBtn').addEventListener('click', () => this.close());

        modal.appendChild(header);
        modal.appendChild(content);
        modal.appendChild(footer);
        overlay.appendChild(modal);

        return { overlay, modal, content, footer };
    }

    /**
     * Cria card de formato
     */
    createFormatCard(format) {
        const card = document.createElement('div');
        card.className = `format-card ${format.disabled ? 'disabled' : ''}`;

        card.innerHTML = `
            <div class="format-icon">${format.icon}</div>
            <div class="format-name">${format.name}</div>
            ${format.disabled ? '<div class="format-badge">Em breve</div>' : ''}
        `;

        if (!format.disabled) {
            card.addEventListener('click', () => this.selectFormat(format));
        }

        return card;
    }

    /**
     * Seleciona formato
     */
    selectFormat(format) {
        document.querySelectorAll('.format-card').forEach(c => c.classList.remove('selected'));
        event.currentTarget.classList.add('selected');

        this.selectedFormat = format;

        // Mostra seção de upload
        document.getElementById('formatGrid').parentElement.classList.add('hidden');
        document.getElementById('uploadSection').classList.remove('hidden');
        document.getElementById('backBtn').style.display = 'block';
    }

    /**
     * Bind eventos de upload
     */
    bindUploadEvents(content) {
        const uploadArea = content.querySelector('#uploadArea');
        const fileInput = content.querySelector('#fileInput');

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            this.handleFileSelect(e.dataTransfer.files[0], content);
        });

        // Click to select
        uploadArea.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileSelect(e.target.files[0], content);
            }
        });
    }

    /**
     * Handler para arquivo selecionado
     */
    async handleFileSelect(file, content) {
        if (!file) return;

        const fileInfo = content.querySelector('#fileInfo');
        fileInfo.innerHTML = `
            <div class="file-details">
                <p><strong>Arquivo:</strong> ${file.name}</p>
                <p><strong>Tamanho:</strong> ${(file.size / 1024).toFixed(2)} KB</p>
                <p><strong>Tipo:</strong> ${file.type || 'Não identificado'}</p>
            </div>
        `;

        this.selectedFile = file;

        // Preview
        const previewResult = await this.generatePreview(file);
        if (previewResult.success) {
            this.showPreview(previewResult, content);
        } else {
            fileInfo.innerHTML += `<div class="error">Erro: ${previewResult.error}</div>`;
        }
    }

    /**
     * Gera preview do arquivo
     */
    async generatePreview(file) {
        try {
            const result = await this.importManager.importFile(file, { previewOnly: true });

            if (!result.success) {
                return { success: false, error: result.error || 'Erro ao processar arquivo' };
            }

            return {
                success: true,
                transactions: result.details?.imported || result.imported || [],
                total: result.imported,
                duplicates: result.duplicates,
                errors: result.errors,
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Mostra preview
     */
    showPreview(previewResult, content) {
        document.getElementById('uploadSection').classList.add('hidden');
        document.getElementById('previewSection').classList.remove('hidden');
        document.getElementById('importBtn').style.display = 'block';

        const previewTable = content.querySelector('#previewTable');
        const transactions = previewResult.transactions.slice(0, 5);

        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Descrição</th>
                        <th>Categoria</th>
                        <th>Valor</th>
                        <th>Tipo</th>
                    </tr>
                </thead>
                <tbody>
        `;

        transactions.forEach(tx => {
            const date = new Date(tx.timestamp).toLocaleDateString('pt-BR');
            html += `
                <tr>
                    <td>${date}</td>
                    <td>${tx.description || '-'}</td>
                    <td>${tx.category || '-'}</td>
                    <td>R$ ${tx.value.toFixed(2)}</td>
                    <td>${tx.type}</td>
                </tr>
            `;
        });

        html += `</tbody></table>`;

        if (previewResult.total > 5) {
            html += `<p class="preview-info">... e mais ${previewResult.total - 5} transações</p>`;
        }

        html += `<div class="preview-stats">
            <p><strong>Total a importar:</strong> ${previewResult.total} transações</p>
            <p><strong>Duplicatas detectadas:</strong> ${previewResult.duplicates} (serão puladas)</p>
        </div>`;

        previewTable.innerHTML = html;

        // Bind importBtn
        document.getElementById('importBtn').onclick = () => this.performImport(content);
        document.getElementById('backBtn').onclick = () => this.goBack(content);
    }

    /**
     * Executa importação
     */
    async performImport(content) {
        document.getElementById('previewSection').classList.add('hidden');
        document.getElementById('progressSection').classList.remove('hidden');
        document.getElementById('importBtn').style.display = 'none';

        const strategy = document.querySelector('input[name="duplicateStrategy"]:checked').value;
        this.importManager.setDuplicateStrategy(strategy);

        // Simula progress
        let progress = 0;
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');

        const interval = setInterval(() => {
            progress = Math.min(progress + Math.random() * 30, 90);
            progressFill.style.width = progress + '%';
        }, 300);

        // Executa importação
        const result = await this.importManager.importFile(this.selectedFile, { strategy });

        clearInterval(interval);
        progressFill.style.width = '100%';

        // Resultado
        document.getElementById('progressSection').classList.add('hidden');
        document.getElementById('resultSection').classList.remove('hidden');

        this.showResult(result, content);
    }

    /**
     * Mostra resultado
     */
    showResult(result, content) {
        const resultSection = content.querySelector('#resultSection');

        const status = result.success ? '✅ Sucesso' : '❌ Erro';
        const statusClass = result.success ? 'success' : 'error';

        let html = `
            <div class="result-status ${statusClass}">
                <h3>${status}</h3>
                <p>${result.success ? `${result.imported} transações importadas com sucesso!` : result.error}</p>
            </div>

            <div class="result-details">
                <p><strong>Importadas:</strong> ${result.imported || 0}</p>
                <p><strong>Puladas:</strong> ${result.skipped || 0}</p>
                <p><strong>Duplicatas:</strong> ${result.duplicates || 0}</p>
            </div>
        `;

        resultSection.innerHTML = html;
    }

    /**
     * Volta na navegação
     */
    goBack(content) {
        document.getElementById('formatGrid').parentElement.classList.remove('hidden');
        document.getElementById('uploadSection').classList.add('hidden');
        document.getElementById('previewSection').classList.add('hidden');
        document.getElementById('backBtn').style.display = 'none';
        document.getElementById('importBtn').style.display = 'none';
    }

    /**
     * Abre modal
     */
    open() {
        if (this.isOpen) return;

        const { overlay } = this.createModal();
        document.body.appendChild(overlay);
        this.isOpen = true;

        setTimeout(() => overlay.classList.add('visible'), 10);
    }

    /**
     * Fecha modal
     */
    close() {
        const overlay = document.querySelector('.import-overlay');
        if (overlay) {
            overlay.classList.remove('visible');
            setTimeout(() => overlay.remove(), 300);
        }
        this.isOpen = false;
    }

    /**
     * Cria botão para header
     */
    createHeaderButton() {
        const btn = document.createElement('button');
        btn.id = 'importBtn';
        btn.title = 'Importar transações';
        btn.className = 'header-action-btn import-btn';
        btn.innerHTML = '📥 Importar';
        btn.addEventListener('click', () => this.open());
        return btn;
    }
}

export const importUI = null;
