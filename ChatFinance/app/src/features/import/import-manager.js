/**
 * Import Manager - Gerenciador central de importações
 * Suporta CSV, PDF e OCR com histórico de importações
 */

import { appStorage } from '../../shared/storage.js';
import { csvParser } from './csv-parser.js';

export class ImportManager {
    constructor(store) {
        this.store = store;
        this.importHistory = appStorage.get('importHistory') || [];
        this.duplicateStrategy = 'skip'; // 'skip' | 'merge' | 'replace'
    }

    /**
     * Importa arquivo baseado no tipo
     */
    async importFile(file, options = {}) {
        const type = this.detectFileType(file);
        if (!type) {
            return { error: 'Tipo de arquivo não suportado' };
        }

        try {
            let result = null;

            switch (type) {
                case 'csv':
                    result = await this.importCSV(file, options);
                    break;
                case 'pdf':
                    result = await this.importPDF(file, options);
                    break;
                default:
                    return { error: 'Tipo não implementado' };
            }

            if (result.success) {
                this.recordImport({
                    type,
                    filename: file.name,
                    size: file.size,
                    transactionsCount: result.total || result.transactions.length,
                    timestamp: Date.now(),
                });
            }

            return result;
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Detecta tipo de arquivo
     */
    detectFileType(file) {
        const name = file.name.toLowerCase();
        const mime = file.type;

        if (name.endsWith('.csv') || mime === 'text/csv') return 'csv';
        if (name.endsWith('.pdf') || mime === 'application/pdf') return 'pdf';
        if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'excel';
        if (name.endsWith('.txt')) return 'txt';

        return null;
    }

    /**
     * Importa arquivo CSV
     */
    async importCSV(file, options = {}) {
        const content = await this.readFileAsText(file);
        const result = csvParser.parse(content);

        if (!result.success) {
            return { error: 'Erro ao processar CSV' };
        }

        return this.processTransactions(result.transactions, {
            ...options,
            source: 'csv',
            format: result.format,
        });
    }

    /**
     * Importa arquivo PDF
     * Nota: Requer bibliotecas externas (pdfjs, pdfextract, etc)
     */
    async importPDF(file, options = {}) {
        // Implementação futura com biblioteca PDF.js
        return {
            error: 'Importação de PDF requer configuração. Use CSV por enquanto.',
            suggestion: 'Converta seu PDF para CSV ou tente OCR',
        };
    }

    /**
     * Processa transações importadas
     */
    async processTransactions(transactions, metadata = {}) {
        const duplicates = [];
        const imported = [];
        const skipped = [];

        for (const tx of transactions) {
            // Verifica duplicata
            const duplicate = this.findDuplicate(tx);

            if (duplicate && this.duplicateStrategy === 'skip') {
                skipped.push({
                    transaction: tx,
                    duplicate,
                    reason: 'Duplicata encontrada',
                });
            } else if (duplicate && this.duplicateStrategy === 'merge') {
                // Mescla dados se forem consistentes
                const merged = { ...duplicate, ...tx };
                this.store.updateTransaction(duplicate.id, merged);
                imported.push(merged);
                duplicates.push(duplicate);
            } else {
                // Adiciona nova transação
                const added = this.store.addTransaction(tx);
                imported.push(added);
            }
        }

        this.store.save();

        return {
            success: true,
            imported: imported.length,
            skipped: skipped.length,
            duplicates: duplicates.length,
            total: transactions.length,
            errors: [],
            metadata,
            details: {
                imported,
                skipped,
                duplicates,
            },
        };
    }

    /**
     * Encontra transação duplicada
     */
    findDuplicate(transaction) {
        const allTx = this.store.getAllTransactions();

        for (const existing of allTx) {
            // Verifica similaridade
            if (
                existing.type === transaction.type &&
                Math.abs(existing.value - transaction.value) < 0.01 &&
                existing.category === transaction.category &&
                this.dateSimilar(existing.timestamp, transaction.timestamp)
            ) {
                return existing;
            }
        }

        return null;
    }

    /**
     * Verifica se datas são similares (mesmo dia)
     */
    dateSimilar(ts1, ts2) {
        const date1 = new Date(ts1 || Date.now());
        const date2 = new Date(ts2 || Date.now());

        date1.setHours(0, 0, 0, 0);
        date2.setHours(0, 0, 0, 0);

        return date1.getTime() === date2.getTime();
    }

    /**
     * Lê arquivo como texto
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Erro ao ler arquivo'));
            reader.readAsText(file);
        });
    }

    /**
     * Registra importação no histórico
     */
    recordImport(data) {
        this.importHistory.push({
            id: `import_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            ...data,
        });

        // Mantém apenas últimas 50 importações
        if (this.importHistory.length > 50) {
            this.importHistory = this.importHistory.slice(-50);
        }

        this.save();
    }

    /**
     * Retorna histórico de importações
     */
    getImportHistory() {
        return this.importHistory;
    }

    /**
     * Desfaz última importação
     */
    undoLastImport() {
        if (this.importHistory.length === 0) return false;

        const lastImport = this.importHistory[this.importHistory.length - 1];
        // TODO: Implementar rollback de transações
        // Por enquanto, apenas remove do histórico

        this.importHistory.pop();
        this.save();

        return true;
    }

    /**
     * Define estratégia para duplicatas
     */
    setDuplicateStrategy(strategy) {
        if (['skip', 'merge', 'replace'].includes(strategy)) {
            this.duplicateStrategy = strategy;
            return true;
        }
        return false;
    }

    /**
     * Gera relatório de importação
     */
    generateImportReport(importedTransactions) {
        const report = {
            totalTransactions: importedTransactions.length,
            byType: {},
            byCategory: {},
            totalAmount: 0,
            dateRange: null,
        };

        const timestamps = [];

        importedTransactions.forEach(tx => {
            // Por tipo
            if (!report.byType[tx.type]) {
                report.byType[tx.type] = { count: 0, total: 0 };
            }
            report.byType[tx.type].count++;
            report.byType[tx.type].total += tx.value;

            // Por categoria
            if (!report.byCategory[tx.category]) {
                report.byCategory[tx.category] = { count: 0, total: 0 };
            }
            report.byCategory[tx.category].count++;
            report.byCategory[tx.category].total += tx.value;

            // Total e datas
            report.totalAmount += tx.value;
            timestamps.push(tx.timestamp || Date.now());
        });

        if (timestamps.length > 0) {
            report.dateRange = {
                from: new Date(Math.min(...timestamps)),
                to: new Date(Math.max(...timestamps)),
            };
        }

        return report;
    }

    /**
     * Salva configurações
     */
    save() {
        appStorage.set('importHistory', this.importHistory);
    }

    /**
     * Retorna formatos suportados
     */
    getSupportedFormats() {
        return [
            { id: 'csv', name: 'CSV (Extrato Bancário)', icon: '📊' },
            { id: 'pdf', name: 'PDF (Fatura)', icon: '📄', disabled: true },
            { id: 'ocr', name: 'OCR (Recibo fotografado)', icon: '📸', disabled: true },
        ];
    }
}

export const importManager = null;
