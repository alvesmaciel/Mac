import { messageActions } from './message-actions.js';

export class TypingEffects {
    async typeMessage(container, text, speed = 24, options = {}) {
        const { cls = 'msg--response type-unknown', author = 'AutoFinance' } = options;
        const { element } = messageActions.createMessageBubble('', 'response', null, author);
        element.className = `msg ${cls}`;

        const bubble = element.querySelector('.msg-content');
        const bubbleWrapper = element.querySelector('.msg-bubble');
        bubbleWrapper.setAttribute('data-typing', 'true');

        container.appendChild(element);
        container.scrollTop = container.scrollHeight;

        return new Promise((resolve) => {
            let index = 0;
            let rendered = '';

            const type = () => {
                if (index >= text.length) {
                    bubbleWrapper.removeAttribute('data-typing');
                    resolve(element);
                    return;
                }

                const char = text[index];
                rendered += char;
                bubble.innerHTML = rendered;
                index += 1;
                container.scrollTop = container.scrollHeight;

                const delay = /[.!?,;\s]/.test(char) ? speed * 1.4 : speed;
                setTimeout(type, delay);
            };

            type();
        });
    }

    showTypingIndicator(container, author = 'AutoFinance') {
        const { element } = messageActions.createMessageBubble(
            '<div class="typing-dots"><span></span><span></span><span></span></div>',
            'response',
            null,
            author,
        );
        element.className = 'msg msg--response msg--typing-indicator';
        container.appendChild(element);
        container.scrollTop = container.scrollHeight;
        return element;
    }

    removeTypingIndicator(typingEl) {
        if (!typingEl?.parentElement) return;
        typingEl.style.opacity = '0';
        typingEl.style.transform = 'scale(0.96)';
        typingEl.style.transition = 'all 0.18s ease';
        setTimeout(() => typingEl.remove(), 180);
    }

    fadeInMessage(element, duration = 220) {
        element.style.opacity = '0';
        element.style.transform = 'translateY(8px)';
        element.style.transition = `all ${duration}ms ease`;
        element.offsetHeight;
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
    }
}

export const typingEffects = new TypingEffects();
