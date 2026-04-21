export class ImportUI {
    constructor(importManager) {
        this.importManager = importManager;
        this.selectedFormat = null;
        this.selectedFile = null;
        this.onImportComplete = null;
    }

    renderPage(container, { onImportComplete } = {}) {
        this.onImportComplete = onImportComplete || null;

        container.innerHTML = `
            <section class="import-page">
                <div class="import-page-header">
                    <div>
                        <span class="page-kicker">Entrada assistida</span>
                        <h2>Importe com previsao antes de gravar</h2>
                        <p>CSV ja funciona com preview e tratamento de duplicidade. PDF e OCR ficaram expostos como proximas etapas do produto.</p>
                    </div>
                </div>

                <div class="import-layout">
                    <section class="import-block">
                        <h3>Escolha o formato</h3>
                        <div class="format-grid" id="formatGrid"></div>
                    </section>

                    <section class="import-block">
                        <h3>Carregar arquivo</h3>
                        <label class="upload-area" id="uploadArea">
                            <div class="upload-icon">Arquivo</div>
                            <p>Arraste aqui ou clique para selecionar um arquivo.</p>
                            <input type="file" id="fileInput" class="file-input" accept=".csv,.pdf">
                        </label>
                        <div class="file-info" id="fileInfo">
                            <div class="import-placeholder">Selecione um formato e depois um arquivo para continuar.</div>
                        </div>
                    </section>
                </div>

                <section class="import-block" id="previewSection">
                    <div class="import-block-head">
                        <h3>Pre-visualizacao</h3>
                        <div class="import-options">
                            <label>
                                <input type="radio" name="duplicateStrategy" value="skip" checked>
                                <span>Pular duplicatas</span>
                            </label>
                            <label>
                                <input type="radio" name="duplicateStrategy" value="merge">
                                <span>Mesclar registros</span>
                            </label>
                        </div>
                    </div>
                    <div class="preview-table" id="previewTable">
                        <div class="import-placeholder">O preview aparecera aqui assim que o arquivo for processado.</div>
                    </div>
                    <div class="import-actions">
                        <button class="btn btn-primary" id="runImportBtn" disabled>Importar agora</button>
                    </div>
                </section>
            </section>
        `;

        const formatGrid = container.querySelector('#formatGrid');
        this.importManager.getSupportedFormats().forEach((format) => {
            formatGrid.appendChild(this.createFormatCard(format, container));
        });

        this.bindUploadEvents(container);
    }

    createFormatCard(format, container) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `format-card ${format.disabled ? 'disabled' : ''}`;
        card.innerHTML = `
            <div class="format-icon">${format.icon}</div>
            <div class="format-name">${format.name}</div>
            <div class="format-description">${format.description || ''}</div>
            ${format.disabled ? '<div class="format-badge">Em breve</div>' : ''}
        `;

        if (!format.disabled) {
            card.addEventListener('click', () => {
                container.querySelectorAll('.format-card').forEach((item) => item.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedFormat = format.id;
                container.querySelector('#fileInfo').innerHTML = `
                    <div class="file-details">
                        <p><strong>Formato:</strong> ${format.name}</p>
                        <p>Agora escolha um arquivo para gerar o preview.</p>
                    </div>
                `;
            });
        }

        return card;
    }

    bindUploadEvents(container) {
        const uploadArea = container.querySelector('#uploadArea');
        const fileInput = container.querySelector('#fileInput');
        const runImportBtn = container.querySelector('#runImportBtn');

        uploadArea.addEventListener('dragover', (event) => {
            event.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (event) => {
            event.preventDefault();
            uploadArea.classList.remove('dragover');
            this.handleFileSelect(event.dataTransfer.files?.[0], container);
        });

        fileInput.addEventListener('change', (event) => {
            this.handleFileSelect(event.target.files?.[0], container);
        });

        runImportBtn.addEventListener('click', () => this.performImport(container));
    }

    async handleFileSelect(file, container) {
        if (!file) return;
        if (!this.selectedFormat) {
            container.querySelector('#fileInfo').innerHTML = '<div class="error">Escolha o formato antes de selecionar o arquivo.</div>';
            return;
        }

        this.selectedFile = file;

        container.querySelector('#fileInfo').innerHTML = `
            <div class="file-details">
                <p><strong>Arquivo:</strong> ${file.name}</p>
                <p><strong>Tamanho:</strong> ${(file.size / 1024).toFixed(2)} KB</p>
                <p><strong>Tipo:</strong> ${file.type || 'Nao identificado'}</p>
            </div>
        `;

        const previewResult = await this.generatePreview(file);
        if (!previewResult.success) {
            container.querySelector('#previewTable').innerHTML = `<div class="error">${previewResult.error}</div>`;
            container.querySelector('#runImportBtn').disabled = true;
            return;
        }

        this.showPreview(previewResult, container);
    }

    async generatePreview(file) {
        try {
            const result = await this.importManager.importFile(file, { previewOnly: true });
            if (!result.success) {
                return { success: false, error: result.error || 'Erro ao processar arquivo.' };
            }

            return {
                success: true,
                transactions: result.details?.imported || [],
                total: result.total || 0,
                duplicates: result.duplicates || 0,
                skipped: result.skipped || 0,
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    showPreview(previewResult, container) {
        const rows = previewResult.transactions.slice(0, 8).map((tx) => {
            const date = new Date(tx.timestamp || tx.date || Date.now()).toLocaleDateString('pt-BR');
            return `
                <tr>
                    <td>${date}</td>
                    <td>${tx.description || '-'}</td>
                    <td>${tx.category || '-'}</td>
                    <td>${Number(tx.value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td>${tx.type || '-'}</td>
                </tr>
            `;
        }).join('');

        container.querySelector('#previewTable').innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Data</th>
                        <th>Descricao</th>
                        <th>Categoria</th>
                        <th>Valor</th>
                        <th>Tipo</th>
                    </tr>
                </thead>
                <tbody>${rows || '<tr><td colspan="5">Nenhuma transacao encontrada no preview.</td></tr>'}</tbody>
            </table>
            <div class="preview-stats">
                <p><strong>Total identificado:</strong> ${previewResult.total}</p>
                <p><strong>Possiveis duplicatas:</strong> ${previewResult.duplicates}</p>
                <p><strong>Puladas no preview:</strong> ${previewResult.skipped}</p>
            </div>
        `;

        container.querySelector('#runImportBtn').disabled = previewResult.total === 0;
    }

    async performImport(container) {
        if (!this.selectedFile) return;

        const duplicateStrategy = container.querySelector('input[name="duplicateStrategy"]:checked')?.value || 'skip';
        this.importManager.setDuplicateStrategy(duplicateStrategy);

        const button = container.querySelector('#runImportBtn');
        button.disabled = true;
        button.textContent = 'Importando...';

        const result = await this.importManager.importFile(this.selectedFile, { strategy: duplicateStrategy });

        button.disabled = false;
        button.textContent = 'Importar agora';

        if (!result.success) {
            container.querySelector('#previewTable').insertAdjacentHTML('beforeend', `<div class="error">${result.error}</div>`);
            return;
        }

        if (typeof this.onImportComplete === 'function') {
            this.onImportComplete(result);
        }
    }
}

export const importUI = null;
