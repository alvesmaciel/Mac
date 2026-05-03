/**
 * Time Detector - Auto-detecção de data e hora em descrições
 * Extrai referências de tempo do texto do usuário
 */

export class TimeDetector {
    constructor() {
        this.patterns = this.initializePatterns();
    }

    /**
     * Inicializa padrões de regex para detecção de tempo
     */
    initializePatterns() {
        return {
            // Hoje/Agora
            today: /\b(hoje|agora|neste dia)\b/i,
            
            // Ontem
            yesterday: /\b(ontem|dia anterior)\b/i,
            
            // Amanhã
            tomorrow: /\b(amanhã|próximo dia|amanh)\b/i,
            
            // Semana passada
            lastWeek: /\b(semana passada|última semana|semana anterior)\b/i,
            
            // Próxima semana
            nextWeek: /\b(próxima semana|semana que vem|semana que vêm)\b/i,
            
            // Mês passado
            lastMonth: /\b(mês passado|último mês|mês anterior)\b/i,
            
            // Próximo mês
            nextMonth: /\b(próximo mês|mês que vem|mês que vêm)\b/i,
            
            // Números de dias atrás
            daysAgo: /(\d+)\s*(dia|dias|d)\s*atrás/i,
            
            // Semanas atrás
            weeksAgo: /(\d+)\s*(semana|semanas|sem)\s*atrás/i,
            
            // Meses atrás
            monthsAgo: /(\d+)\s*(mês|meses|m)\s*atrás/i,
            
            // Data no formato DD/MM/YYYY
            dateFormat1: /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,
            
            // Data no formato DD-MM-YYYY
            dateFormat2: /(\d{1,2})-(\d{1,2})-(\d{2,4})/,
            
            // Data por extenso (português)
            dateExtended: /(\d{1,2})\s+de\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+(?:de\s+)?(\d{2,4})?/i,
            
            // Hora no formato HH:MM
            time24: /(\d{1,2}):(\d{2})(?::(\d{2}))?/,
            
            // Manhã, Tarde, Noite
            period: /\b(manhã|tarde|noite|madrugada)\b/i,
            
            // Nomes dos dias da semana
            dayName: /\b(segunda|terça|quarta|quinta|sexta|sábado|domingo)(?:-feira)?\b/i,
        };
    }

    /**
     * Detecta referência de tempo no texto
     */
    detectTime(text) {
        if (!text) return null;

        const normalized = text.toLowerCase();
        let timestamp = null;
        let confidence = 0;
        let details = {};

        // Verifica padrões em ordem de importância

        // 1. Data específica (DD/MM/YYYY)
        const dateMatch1 = text.match(this.patterns.dateFormat1);
        if (dateMatch1) {
            timestamp = this.parseDateFormat(dateMatch1[1], dateMatch1[2], dateMatch1[3]);
            confidence = 0.95;
            details.format = 'DD/MM/YYYY';
        }

        // 2. Data por extenso
        const dateMatch2 = text.match(this.patterns.dateExtended);
        if (dateMatch2 && !timestamp) {
            timestamp = this.parseDateExtended(dateMatch2[1], dateMatch2[2], dateMatch2[3]);
            confidence = 0.90;
            details.format = 'extenso';
        }

        // 3. Hoje
        if (this.patterns.today.test(normalized) && !timestamp) {
            timestamp = this.getToday();
            confidence = 0.85;
            details.reference = 'hoje';
        }

        // 4. Ontem
        if (this.patterns.yesterday.test(normalized) && !timestamp) {
            timestamp = this.getYesterday();
            confidence = 0.85;
            details.reference = 'ontem';
        }

        // 5. Amanhã
        if (this.patterns.tomorrow.test(normalized) && !timestamp) {
            timestamp = this.getTomorrow();
            confidence = 0.85;
            details.reference = 'amanhã';
        }

        // 6. X dias atrás
        const daysMatch = text.match(this.patterns.daysAgo);
        if (daysMatch && !timestamp) {
            const days = parseInt(daysMatch[1]);
            timestamp = this.getDaysAgo(days);
            confidence = 0.90;
            details.reference = `${days} dias atrás`;
        }

        // 7. X semanas atrás
        const weeksMatch = text.match(this.patterns.weeksAgo);
        if (weeksMatch && !timestamp) {
            const weeks = parseInt(weeksMatch[1]);
            timestamp = this.getDaysAgo(weeks * 7);
            confidence = 0.85;
            details.reference = `${weeks} semana(s) atrás`;
        }

        // 8. Semana passada
        if (this.patterns.lastWeek.test(normalized) && !timestamp) {
            timestamp = this.getLastWeekMonday();
            confidence = 0.70;
            details.reference = 'semana passada';
        }

        // 9. Próxima semana
        if (this.patterns.nextWeek.test(normalized) && !timestamp) {
            timestamp = this.getNextMonday();
            confidence = 0.70;
            details.reference = 'próxima semana';
        }

        // 10. Dia da semana (próxima ocorrência)
        const dayMatch = text.match(this.patterns.dayName);
        if (dayMatch && !timestamp) {
            const day = this.getDayFromName(dayMatch[1]);
            timestamp = this.getNextDayOfWeek(day);
            confidence = 0.75;
            details.reference = dayMatch[1];
        }

        // Detecta hora
        const timeMatch = text.match(this.patterns.time24);
        if (timeMatch) {
            const hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const seconds = timeMatch[3] ? parseInt(timeMatch[3]) : 0;

            if (timestamp) {
                // Combina data com hora
                const date = new Date(timestamp);
                date.setHours(hours, minutes, seconds);
                timestamp = date.getTime();
            } else {
                // Apenas hora, usa hoje
                timestamp = this.getToday();
                const date = new Date(timestamp);
                date.setHours(hours, minutes, seconds);
                timestamp = date.getTime();
            }

            details.time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        }

        // Detecta período do dia (sem hour específico)
        const periodMatch = text.match(this.patterns.period);
        if (periodMatch && timestamp && !timeMatch) {
            const period = periodMatch[1];
            const date = new Date(timestamp);

            switch (period) {
                case 'manhã':
                    date.setHours(9, 0, 0);
                    break;
                case 'tarde':
                    date.setHours(14, 0, 0);
                    break;
                case 'noite':
                    date.setHours(20, 0, 0);
                    break;
                case 'madrugada':
                    date.setHours(3, 0, 0);
                    break;
            }

            timestamp = date.getTime();
            details.period = period;
        }

        // Se nenhuma referência de tempo foi encontrada, usa agora
        if (!timestamp) {
            timestamp = Date.now();
            confidence = 0;
        }

        return {
            timestamp,
            confidence,
            details,
            formatted: this.formatDate(timestamp),
        };
    }

    /**
     * Faz parse de data no formato DD/MM/YYYY
     */
    parseDateFormat(day, month, year) {
        // Corrige ano de 2 dígitos
        let fullYear = parseInt(year);
        if (fullYear < 100) {
            fullYear = fullYear < 30 ? 2000 + fullYear : 1900 + fullYear;
        }

        const date = new Date(fullYear, parseInt(month) - 1, parseInt(day));
        date.setHours(0, 0, 0, 0);
        return date.getTime();
    }

    /**
     * Faz parse de data por extenso (português)
     */
    parseDateExtended(day, month, year) {
        const months = {
            janeiro: 0, fevereiro: 1, março: 2, abril: 3,
            maio: 4, junho: 5, julho: 6, agosto: 7,
            setembro: 8, outubro: 9, novembro: 10, dezembro: 11
        };

        const monthIndex = months[month.toLowerCase()];
        let fullYear = year ? parseInt(year) : new Date().getFullYear();

        if (fullYear < 100) {
            fullYear = fullYear < 30 ? 2000 + fullYear : 1900 + fullYear;
        }

        const date = new Date(fullYear, monthIndex, parseInt(day));
        date.setHours(0, 0, 0, 0);
        return date.getTime();
    }

    /**
     * Retorna timestamp de hoje às 00:00
     */
    getToday() {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        return date.getTime();
    }

    /**
     * Retorna timestamp de ontem às 00:00
     */
    getYesterday() {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
    }

    /**
     * Retorna timestamp de amanhã às 00:00
     */
    getTomorrow() {
        const date = new Date();
        date.setDate(date.getDate() + 1);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
    }

    /**
     * Retorna timestamp de X dias atrás
     */
    getDaysAgo(days) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
    }

    /**
     * Retorna segunda-feira da semana passada
     */
    getLastWeekMonday() {
        const date = new Date();
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1) - 7;
        date.setDate(diff);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
    }

    /**
     * Retorna próximo dia específico da semana
     */
    getNextDayOfWeek(dayOfWeek) {
        const date = new Date();
        const day = date.getDay();
        const daysAhead = dayOfWeek - day;

        if (daysAhead <= 0) {
            date.setDate(date.getDate() + daysAhead + 7);
        } else {
            date.setDate(date.getDate() + daysAhead);
        }

        date.setHours(0, 0, 0, 0);
        return date.getTime();
    }

    /**
     * Retorna próxima segunda-feira
     */
    getNextMonday() {
        return this.getNextDayOfWeek(1);
    }

    /**
     * Mapeia nome do dia para índice (0-6)
     */
    getDayFromName(name) {
        const days = {
            domingo: 0, segunda: 1, terça: 2, quarta: 3,
            quinta: 4, sexta: 5, sábado: 6
        };
        return days[name.toLowerCase()] || 1;
    }

    /**
     * Formata timestamp para string legível
     */
    formatDate(timestamp) {
        const date = new Date(timestamp);
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return date.toLocaleDateString('pt-BR', options);
    }

    /**
     * Extrai múltiplas referências de tempo de um texto
     */
    extractAllTimeReferences(text) {
        const references = [];

        if (this.patterns.today.test(text)) references.push('hoje');
        if (this.patterns.yesterday.test(text)) references.push('ontem');
        if (this.patterns.tomorrow.test(text)) references.push('amanhã');
        if (this.patterns.lastWeek.test(text)) references.push('semana passada');
        if (this.patterns.nextWeek.test(text)) references.push('próxima semana');

        return references;
    }
}

export const timeDetector = new TimeDetector();
