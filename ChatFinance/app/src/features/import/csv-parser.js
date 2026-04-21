/**
 * CSV Parser - Parser para arquivos CSV de extrato bancário/faturas
 * Detecta automaticamente o formato e importa transações
 */

export class CSVParser {
    constructor() {
        this.formats = this.initFormats();
        this.detectedFormat = null;
    }

    /**
     * Formatos conhecidos de arquivos CSV
     */
    initFormats() {
        return {
            'bradesco': {
                name: 'Bradesco',
                delimiter: ',',
                headers: ['Data', 'Descrição', 'Valor', 'Saldo'],
                dateFormat: 'DD/MM/YYYY',
                valueFormat: 'number_comma',
                mappers: {
                    date: 0,
                    description: 1,
                    value: 2,
                    balance: 3,
                },
            },
            'itau': {
                name: 'Itaú',
                delimiter: ',',
                headers: ['Data', 'Lançamento', 'Débito', 'Crédito', 'Saldo'],
                dateFormat: 'DD/MM/YYYY',
                valueFormat: 'number_comma',
                mappers: {
                    date: 0,
                    description: 1,
                    debit: 2,
                    credit: 3,
                    balance: 4,
                },
            },
            'caixa': {
                name: 'Caixa',
                delimiter: ';',
                headers: ['Data', 'Descrição', 'Valor'],
                dateFormat: 'DD/MM/YYYY',
                valueFormat: 'number_comma',
                mappers: {
                    date: 0,
                    description: 1,
                    value: 2,
                },
            },
            'generic': {
                name: 'Genérico',
                delimiter: ',',
                headers: ['Data', 'Descrição', 'Valor'],
                dateFormat: 'DD/MM/YYYY',
                valueFormat: 'number_comma',
                mappers: {
                    date: 0,
                    description: 1,
                    value: 2,
                },
            },
        };
    }

    /**
     * Parse de arquivo CSV
     */
    parse(csvContent) {
        const lines = csvContent.trim().split('\n');
        if (lines.length < 2) return { error: 'Arquivo CSV vazio' };

        // Detecta formato automaticamente
        const format = this.detectFormat(lines[0]);
        if (!format) return { error: 'Formato CSV não reconhecido' };

        this.detectedFormat = format;

        const transactions = [];
        const errors = [];

        // Pula header
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const result = this.parseLine(line, format);
            if (result.error) {
                errors.push({ line: i + 1, error: result.error });
            } else {
                transactions.push(result);
            }
        }

        return {
            success: transactions.length > 0,
            format: format.name,
            transactions,
            errors,
            total: transactions.length,
        };
    }

    /**
     * Detecta formato do CSV
     */
    detectFormat(headerLine) {
        // Testa cada delimitador
        for (const format of Object.values(this.formats)) {
            const fields = headerLine.split(format.delimiter);
            const normalizedFields = fields.map(f => f.toLowerCase().trim());
            const normalizedHeaders = format.headers.map(h => h.toLowerCase());

            // Conta matches
            const matches = normalizedFields.filter(f =>
                normalizedHeaders.some(h => this.similarity(f, h) > 0.7)
            ).length;

            if (matches >= format.headers.length * 0.6) {
                return format;
            }
        }

        return this.formats.generic;
    }

    /**
     * Parse de uma linha
     */
    parseLine(line, format) {
        const fields = line.split(format.delimiter).map(f => f.trim());

        const mappers = format.mappers;
        const transaction = {};

        try {
            // Data
            if (mappers.date !== undefined && fields[mappers.date]) {
                transaction.date = this.parseDate(fields[mappers.date], format.dateFormat);
                transaction.timestamp = transaction.date.getTime();
            }

            // Descrição
            if (mappers.description !== undefined && fields[mappers.description]) {
                transaction.description = fields[mappers.description];
            }

            // Valor (débito/crédito ou valor único)
            if (mappers.debit !== undefined && mappers.credit !== undefined) {
                const debit = this.parseValue(fields[mappers.debit], format.valueFormat);
                const credit = this.parseValue(fields[mappers.credit], format.valueFormat);

                if (debit > 0) {
                    transaction.type = 'expense';
                    transaction.value = debit;
                } else if (credit > 0) {
                    transaction.type = 'income';
                    transaction.value = credit;
                } else {
                    return { error: 'Nenhum valor encontrado' };
                }
            } else if (mappers.value !== undefined && fields[mappers.value]) {
                const value = this.parseValue(fields[mappers.value], format.valueFormat);
                transaction.type = value < 0 ? 'expense' : 'income';
                transaction.value = Math.abs(value);
            } else {
                return { error: 'Valor não encontrado' };
            }

            // Categoria automática
            transaction.category = this.guessCategory(transaction.description);

            // Validação
            if (!transaction.date || !transaction.value || !transaction.type) {
                return { error: 'Transação incompleta' };
            }

            return transaction;
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Parse de data
     */
    parseDate(dateStr, format) {
        if (format === 'DD/MM/YYYY') {
            const [day, month, year] = dateStr.split('/');
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }
        if (format === 'MM/DD/YYYY') {
            const [month, day, year] = dateStr.split('/');
            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }
        if (format === 'YYYY-MM-DD') {
            return new Date(dateStr);
        }
        return new Date();
    }

    /**
     * Parse de valor numérico
     */
    parseValue(valueStr, format) {
        if (!valueStr) return 0;

        valueStr = valueStr.trim();

        // Remove parênteses (negativo)
        const isNegative = valueStr.includes('(') && valueStr.includes(')');
        valueStr = valueStr.replace(/[()]/g, '');

        // Formato com ponto de milhar e vírgula decimal (brasileiro)
        if (format === 'number_comma') {
            valueStr = valueStr.replace(/\./g, '').replace(',', '.');
        }

        // Formato com vírgula de milhar e ponto decimal (inglês)
        if (format === 'number_period') {
            valueStr = valueStr.replace(/,/g, '');
        }

        let value = parseFloat(valueStr);

        return isNegative ? -value : value;
    }

    /**
     * Adivinha categoria baseado em descrição
     */
    guessCategory(description) {
        const desc = description.toLowerCase();

        const categories = {
            'Alimentação': ['restaurante', 'comida', 'pizza', 'hamburguer', 'mercado', 'supermercado', 'padaria', 'café'],
            'Transporte': ['uber', 'táxi', 'gasolina', 'combustível', 'estacionamento', 'ônibus', 'passagem'],
            'Saúde': ['farmácia', 'médico', 'hospital', 'dentista', 'spa'],
            'Utilities': ['energia', 'água', 'gás', 'internet', 'telefone'],
            'Entretenimento': ['cinema', 'show', 'netflix', 'spotify'],
            'Compras': ['loja', 'roupas', 'sapatos', 'amazon', 'shopping'],
        };

        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(kw => desc.includes(kw))) {
                return category;
            }
        }

        return 'Geral';
    }

    /**
     * Calcula similaridade de string
     */
    similarity(a, b) {
        const longer = a.length > b.length ? a : b;
        const shorter = a.length > b.length ? b : a;

        if (longer.length === 0) return 1.0;

        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    /**
     * Distância de Levenshtein
     */
    levenshteinDistance(a, b) {
        const matrix = [];

        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    }

    /**
     * Retorna formatos suportados
     */
    getSupportedFormats() {
        return Object.entries(this.formats).map(([key, format]) => ({
            id: key,
            name: format.name,
        }));
    }
}

export const csvParser = new CSVParser();
