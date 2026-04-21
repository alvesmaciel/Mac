/**
 * Typing Effects Module - ChatGPT-like animations
 * Simulação de digitação em tempo real
 */

export class TypingEffects {
    /**
     * Efeito de digitação com velocidade realista
     */
     async typeMessage(container, text, speed = 30) {
        const div = document.createElement('div');
        div.className = 'msg msg--response';

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.setAttribute('data-typing', 'true');

        div.appendChild(bubble);
        container.appendChild(div);

        return new Promise(resolve => {
            let i = 0;
            let displayedText = '';

            const type = () => {
                if (i < text.length) {
                    const char = text[i];
                    displayedText += char;
                    bubble.innerHTML = displayedText;
                    
                    // Cálculo adaptativo: letras normais rápidas, pontuação + espaços lentos
                    const delay = /[.!?,;\s]/.test(char) ? speed * 1.5 : speed;
                    
                    i++;
                    container.scrollTop = container.scrollHeight;
                    setTimeout(type, delay);
                } else {
                    bubble.removeAttribute('data-typing');
                    resolve(div);
                }
            };

            type();
        });
    }

    /**
     * Efeito de "digitando..." com cursor piscante
     */
     showTypingIndicator(container) {
        const div = document.createElement('div');
        div.className = 'msg msg--response msg--typing-indicator';

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';

        const dots = document.createElement('div');
        dots.className = 'typing-dots';
        dots.innerHTML = '<span></span><span></span><span></span>';

        bubble.appendChild(dots);
        div.appendChild(bubble);
        container.appendChild(div);

        container.scrollTop = container.scrollHeight;

        return div;
    }

    /**
     * Remove indicador de digitação
     */
     removeTypingIndicator(typingEl) {
        if (typingEl && typingEl.parentElement) {
            typingEl.style.opacity = '0';
            typingEl.style.transform = 'scale(0.9)';
            typingEl.style.transition = 'all 0.2s ease';
            
            setTimeout(() => typingEl.remove(), 200);
        }
    }

    /**
     * Efeito de fade-in para mensagens
     */
     fadeInMessage(element, duration = 300) {
        element.style.opacity = '0';
        element.style.transform = 'translateY(10px)';
        element.style.transition = `all ${duration}ms ease`;

        // Force reflow para garantir a transição
        element.offsetHeight;

        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';

        return new Promise(resolve => {
            setTimeout(resolve, duration);
        });
    }

    /**
     * Efeito de "thinking" antes de responder
     */
     showThinkingBubble(container) {
        const div = document.createElement('div');
        div.className = 'msg msg--response msg--thinking';

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble msg-thinking';

        const thinking = document.createElement('div');
        thinking.className = 'thinking-indicator';
        thinking.innerHTML = '<span>💭</span> Pensando...';

        bubble.appendChild(thinking);
        div.appendChild(bubble);
        container.appendChild(div);

        container.scrollTop = container.scrollHeight;

        return div;
    }

    /**
     * Remove bubble de thinking
     */
     removeThinkingBubble(thinkingEl) {
        if (thinkingEl && thinkingEl.parentElement) {
            thinkingEl.style.opacity = '0';
            setTimeout(() => thinkingEl.remove(), 200);
        }
    }

    /**
     * Efeito de erro com shake
     */
     shakeError(element) {
        element.classList.add('shake-error');
        setTimeout(() => element.classList.remove('shake-error'), 500);
    }

    /**
     * Efeito de sucesso com pulse
     */
     pulseSuccess(element) {
        element.classList.add('pulse-success');
        setTimeout(() => element.classList.remove('pulse-success'), 600);
    }

    /**
     * Animação de destaque para nova mensagem
     */
     highlightMessage(element, duration = 1000) {
        element.classList.add('highlight-new');
        setTimeout(() => element.classList.remove('highlight-new'), duration);
    }

    /**
     * Efeito de scroll suave para última mensagem
     */
     smoothScrollToBottom(container, duration = 500) {
        const targetScroll = container.scrollHeight - container.clientHeight;
        const startScroll = container.scrollTop;
        const distance = targetScroll - startScroll;

        let start = null;

        const scroll = (timestamp) => {
            if (!start) start = timestamp;
            const progress = (timestamp - start) / duration;

            if (progress < 1) {
                container.scrollTop = startScroll + (distance * this.easeInOutCubic(progress));
                requestAnimationFrame(scroll);
            } else {
                container.scrollTop = targetScroll;
            }
        };

        requestAnimationFrame(scroll);
    }

    /**
     * Easing function (Cubic Bezier)
     */
     easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    /**
     * Copia mensagem com feedback visual
     */
     async copyWithFeedback(text, feedbackElement) {
        try {
            await navigator.clipboard.writeText(text);
            
            const originalText = feedbackElement.innerHTML;
            feedbackElement.innerHTML = '✅ Copiado!';
            feedbackElement.classList.add('copy-success');

            setTimeout(() => {
                feedbackElement.innerHTML = originalText;
                feedbackElement.classList.remove('copy-success');
            }, 2000);

            return true;
        } catch (error) {
            console.error('Erro ao copiar:', error);
            return false;
        }
    }

    /**
     * Animação de loading com progresso
     */
     createProgressBar(container) {
        const div = document.createElement('div');
        div.className = 'msg msg--loading';

        const bar = document.createElement('div');
        bar.className = 'progress-bar';

        const fill = document.createElement('div');
        fill.className = 'progress-fill';

        bar.appendChild(fill);
        div.appendChild(bar);
        container.appendChild(div);

        // Simula progresso suave até 90%
        let progress = 0;
        const interval = setInterval(() => {
            progress = Math.min(progress + Math.random() * 30, 90);
            fill.style.width = progress + '%';
        }, 300);

        return {
            element: div,
            complete: () => {
                fill.style.width = '100%';
                clearInterval(interval);
                setTimeout(() => {
                    div.style.opacity = '0';
                    div.style.transition = 'opacity 0.3s ease';
                    setTimeout(() => div.remove(), 300);
                }, 500);
            }
        };
    }
}


export const typingEffects = new TypingEffects();

