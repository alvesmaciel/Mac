import { appStorage } from '../../shared/storage.js';
import { csvParser } from './csv-parser.js';

export class ImportManager {
    constructor(store) {
        this.store = store;
        this.importHistory = appStorage.get('importHistory') || [];
        this.duplicateStrategy = 'skip';
    }

    async importFile(file, options = {}) {
        const type = this.detectFileType(file);
        if (!type) {
            return { success: false, error: 'Tipo de arquivo nao suportado.' };
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
                    return { success: false, error: 'Tipo ainda nao implementado.' };
            }

            if (result.success && !options.previewOnly) {
                this.recordImport({
                    type,
                    filename: file.name,
                    size: file.size,
                    transactionsCount: result.total || 0,
                    timestamp: Date.now(),
                });
            }

            return result;
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    detectFileType(file) {
        const name = file.name.toLowerCase();
        const mime = file.type;

        if (name.endsWith('.csv') || mime === 'text/csv') return 'csv';
        if (name.endsWith('.pdf') || mime === 'application/pdf') return 'pdf';
        if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'excel';
        if (name.endsWith('.txt')) return 'txt';
        return null;
    }

    async importCSV(file, options = {}) {
        const content = await this.readFileAsText(file);
        const result = csvParser.parse(content);

        if (!result.success) {
            return { success: false, error: 'Erro ao processar CSV.' };
        }

        return this.processTransactions(result.transactions, {
            ...options,
            source: 'csv',
            format: result.format,
        });
    }

    async importPDF() {
        return {
            success: false,
            error: 'Importacao de PDF ainda nao esta implementada. Use CSV por enquanto.',
            suggestion: 'Converta o PDF para CSV ate a integracao com leitor de fatura ser adicionada.',
        };
    }

    async processTransactions(transactions, metadata = {}) {
        const duplicates = [];
        const imported = [];
        const skipped = [];

        for (const tx of transactions) {
            const duplicate = this.findDuplicate(tx);

            if (duplicate && this.duplicateStrategy === 'skip') {
                skipped.push({
                    transaction: tx,
                    duplicate,
                    reason: 'Duplicata encontrada',
                });
            } else if (duplicate && this.duplicateStrategy === 'merge') {
                if (metadata.previewOnly) {
                    imported.push({ ...duplicate, ...tx });
                    duplicates.push(duplicate);
                } else {
                    const merged = { ...duplicate, ...tx, type: tx.type || duplicate.type };
                    this.store.updateTransaction(duplicate.id, merged);
                    imported.push(merged);
                    duplicates.push(duplicate);
                }
            } else {
                imported.push(metadata.previewOnly ? tx : this.store.addTransaction(tx));
            }
        }

        if (!metadata.previewOnly) {
            this.store.save();
        }

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

    findDuplicate(transaction) {
        return this.store.getAllTransactions().find((existing) => (
            existing.type === transaction.type &&
            Math.abs(existing.value - transaction.value) < 0.01 &&
            existing.category === transaction.category &&
            this.dateSimilar(existing.timestamp, transaction.timestamp)
        )) || null;
    }

    dateSimilar(ts1, ts2) {
        const date1 = new Date(ts1 || Date.now());
        const date2 = new Date(ts2 || Date.now());
        date1.setHours(0, 0, 0, 0);
        date2.setHours(0, 0, 0, 0);
        return date1.getTime() === date2.getTime();
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
            reader.readAsText(file);
        });
    }

    recordImport(data) {
        this.importHistory.push({
            id: `import_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            ...data,
        });

        if (this.importHistory.length > 50) {
            this.importHistory = this.importHistory.slice(-50);
        }

        this.save();
    }

    getImportHistory() {
        return this.importHistory;
    }

    undoLastImport() {
        if (this.importHistory.length === 0) return false;
        this.importHistory.pop();
        this.save();
        return true;
    }

    setDuplicateStrategy(strategy) {
        if (['skip', 'merge', 'replace'].includes(strategy)) {
            this.duplicateStrategy = strategy;
            return true;
        }
        return false;
    }

    generateImportReport(importedTransactions) {
        const report = {
            totalTransactions: importedTransactions.length,
            byType: {},
            byCategory: {},
            totalAmount: 0,
            dateRange: null,
        };

        const timestamps = [];
        importedTransactions.forEach((tx) => {
            if (!report.byType[tx.type]) report.byType[tx.type] = { count: 0, total: 0 };
            if (!report.byCategory[tx.category]) report.byCategory[tx.category] = { count: 0, total: 0 };

            report.byType[tx.type].count += 1;
            report.byType[tx.type].total += tx.value;
            report.byCategory[tx.category].count += 1;
            report.byCategory[tx.category].total += tx.value;
            report.totalAmount += tx.value;
            timestamps.push(tx.timestamp || Date.now());
        });

        if (timestamps.length) {
            report.dateRange = {
                from: new Date(Math.min(...timestamps)),
                to: new Date(Math.max(...timestamps)),
            };
        }

        return report;
    }

    save() {
        appStorage.set('importHistory', this.importHistory);
    }

    getSupportedFormats() {
        return [
            {
                id: 'csv',
                name: 'CSV (Extrato bancario)',
                icon: 'CSV',
                description: 'Ja habilitado para extratos e planilhas exportadas.',
            },
            {
                id: 'pdf',
                name: 'PDF (Fatura)',
                icon: 'PDF',
                disabled: true,
                description: 'Leitura de fatura planejada para a proxima etapa.',
            },
            {
                id: 'ocr',
                name: 'OCR (Recibo)',
                icon: 'OCR',
                disabled: true,
                description: 'Planejado para fotos e comprovantes.',
            },
        ];
    }
}

export const importManager = null;
