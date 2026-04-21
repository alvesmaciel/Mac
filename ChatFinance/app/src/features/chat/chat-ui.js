export function renderUserMessage(container, text) {
    const div = document.createElement('div');
    div.className = 'msg msg--user';

    div.innerHTML = `<div class="msg-bubble">${text}</div>`;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

export async function typeMessage(container, text) {

    const div = document.createElement('div');
    div.className = 'msg msg--response';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';

    div.appendChild(bubble);
    container.appendChild(div);

    let i = 0;

    return new Promise(resolve => {
        const interval = setInterval(() => {
            bubble.textContent += text[i];
            i++;

            container.scrollTop = container.scrollHeight;

            if (i >= text.length) {
                clearInterval(interval);
                resolve();
            }
        }, 10);
    });
}

export function showTyping(container) {
    const div = document.createElement('div');
    div.className = 'msg msg--response';

    div.innerHTML = `<div class="msg-bubble">Digitando...</div>`;
    container.appendChild(div);

    container.scrollTop = container.scrollHeight;

    return div;
}