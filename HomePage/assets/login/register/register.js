
/* ── 3D Canvas — 100% neutral ── */
(function () {
    const canvas = document.getElementById('bg-canvas');
    const ctx = canvas.getContext('2d');
    let W, H, nodes = [], mouse = { x: -999, y: -999 };

    function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
    window.addEventListener('resize', resize);
    resize();

    const TONES = [
        { r: 255, g: 255, b: 255 },
        { r: 210, g: 210, b: 210 },
        { r: 150, g: 150, b: 150 },
        { r: 90, g: 90, b: 90 },
    ];

    for (let i = 0; i < 68; i++) {
        nodes.push({
            x: Math.random() * W, y: Math.random() * H,
            z: Math.random() * 700 + 100,
            vx: (Math.random() - .5) * .35,
            vy: (Math.random() - .5) * .28,
            vz: (Math.random() - .5) * .7,
            r: Math.random() * 1.4 + .4,
            tone: TONES[Math.floor(Math.random() * TONES.length)],
        });
    }

    window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });

    function project(n) {
        const s = 500 / (500 + n.z);
        return { x: W / 2 + (n.x - W / 2) * s, y: H / 2 + (n.y - H / 2) * s, s };
    }

    function frame() {
        ctx.clearRect(0, 0, W, H);

        nodes.forEach(n => {
            n.x += n.vx; n.y += n.vy; n.z += n.vz;
            if (n.x < 0 || n.x > W) n.vx *= -1;
            if (n.y < 0 || n.y > H) n.vy *= -1;
            if (n.z < 60 || n.z > 900) n.vz *= -1;
            const p = project(n);
            const dx = p.x - mouse.x, dy = p.y - mouse.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 130) { n.vx += dx / d * .008; n.vy += dy / d * .008; }
        });

        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const pi = project(nodes[i]), pj = project(nodes[j]);
                const dx = pi.x - pj.x, dy = pi.y - pj.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 160) {
                    const a = (1 - dist / 160) * 0.13;
                    const t = nodes[i].tone;
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(${t.r},${t.g},${t.b},${a})`;
                    ctx.lineWidth = (pi.s + pj.s) * .28;
                    ctx.moveTo(pi.x, pi.y); ctx.lineTo(pj.x, pj.y); ctx.stroke();
                }
            }
        }

        nodes.forEach(n => {
            const p = project(n), size = n.r * p.s * 2.5, a = p.s * .6;
            const t = n.tone;
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 5);
            g.addColorStop(0, `rgba(${t.r},${t.g},${t.b},${a * .3})`);
            g.addColorStop(1, `rgba(${t.r},${t.g},${t.b},0)`);
            ctx.beginPath(); ctx.fillStyle = g;
            ctx.arc(p.x, p.y, size * 5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.fillStyle = `rgba(${t.r},${t.g},${t.b},${a})`;
            ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
        });

        requestAnimationFrame(frame);
    }
    frame();
})();

/* ── Password toggle ── */
document.getElementById('pwdToggle').addEventListener('click', function () {
    const inp = document.getElementById('password');
    const icon = document.getElementById('eyeIcon');
    if (inp.type === 'password') {
        inp.type = 'text';
        icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`;
    } else {
        inp.type = 'password';
        icon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
    }
});

/* ── Password strength ── */
document.getElementById('password').addEventListener('input', function () {
    const val = this.value;
    const el = document.getElementById('pwdStrength');
    const fill = document.getElementById('strengthFill');
    const label = document.getElementById('strengthLabel');
    const s2 = document.getElementById('step2');

    if (!val) { el.classList.remove('visible'); s2.classList.remove('active', 'done'); return; }
    el.classList.add('visible');

    let score = 0;
    if (val.length >= 8) score++;
    if (val.length >= 12) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    // Escala de cinza para força
    const levels = [
        { pct: '16%', color: '#555', text: 'Muito fraca' },
        { pct: '33%', color: '#777', text: 'Fraca' },
        { pct: '55%', color: '#999', text: 'Média' },
        { pct: '78%', color: '#bbb', text: 'Forte' },
        { pct: '100%', color: '#eee', text: 'Muito forte ✓' },
    ];

    const l = levels[Math.min(score - 1, 4)] || levels[0];
    fill.style.width = l.pct;
    fill.style.background = l.color;
    label.textContent = l.text;
    label.style.color = l.color;

    if (score >= 3) { s2.classList.add('active'); s2.classList.remove('done'); }
    if (score >= 4) { s2.classList.add('done'); }
});

/* ── Confirm match ── */
document.getElementById('confirmPassword').addEventListener('input', function () {
    const pwd = document.getElementById('password').value;
    const s3 = document.getElementById('step3');
    if (this.value && this.value === pwd) {
        this.style.borderColor = 'rgba(200,200,200,.5)';
        s3.classList.add('active', 'done');
    } else {
        this.style.borderColor = '';
        s3.classList.remove('active', 'done');
    }
});

/* ── Register ── */
document.getElementById('registerForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const first = document.getElementById('firstName').value.trim();
    const last = document.getElementById('lastName').value.trim();
    const email = document.getElementById('email').value.trim();
    const pass = document.getElementById('password').value;
    const confirm = document.getElementById('confirmPassword').value;
    const terms = document.getElementById('terms').checked;
    const btn = document.getElementById('registerBtn');
    const msg = document.getElementById('msgBox');

    msg.className = 'msg-box';
    msg.textContent = '';

    if (!first || !last) { msg.textContent = 'Preencha nome e sobrenome.'; msg.className = 'msg-box error'; return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = 'E-mail inválido.'; msg.className = 'msg-box error'; return; }
    if (pass.length < 8) { msg.textContent = 'Senha com no mínimo 8 caracteres.'; msg.className = 'msg-box error'; return; }
    if (pass !== confirm) { msg.textContent = 'As senhas não coincidem.'; msg.className = 'msg-box error'; return; }
    if (!terms) { msg.textContent = 'Aceite os termos para continuar.'; msg.className = 'msg-box error'; return; }

    const users = JSON.parse(localStorage.getItem('af_users') || '[]');
    if (users.find(u => u.email === email)) { msg.textContent = 'Este e-mail já está cadastrado.'; msg.className = 'msg-box error'; return; }

    btn.classList.add('loading');
    btn.textContent = 'Criando conta...';

    setTimeout(() => {
        users.push({ name: `${first} ${last}`, email, password: pass });
        localStorage.setItem('af_users', JSON.stringify(users));
        localStorage.setItem('af_logged', JSON.stringify({ email, name: `${first} ${last}` }));

        btn.classList.remove('loading');
        btn.style.background = '#E0E0E0';
        btn.textContent = '✓ Conta criada! Redirecionando...';
        msg.textContent = `Bem-vindo(a), ${first}!`;
        msg.className = 'msg-box success';

        setTimeout(() => { window.location.href = './index.html'; }, 1100);
    }, 1300);
});