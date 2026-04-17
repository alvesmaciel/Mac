/* ── 3D Particle Canvas — paleta neutra ── */
(function () {
    const canvas = document.getElementById('bg-canvas');
    const ctx = canvas.getContext('2d');
    let W, H, nodes = [], mouse = { x: -999, y: -999 };

    function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
    window.addEventListener('resize', resize);
    resize();

    // Tons neutros para as partículas
    const TONES = [
        { r: 255, g: 255, b: 255 },  // branco puro
        { r: 200, g: 200, b: 200 },  // cinza claro
        { r: 140, g: 140, b: 140 },  // cinza médio
        { r: 80, g: 80, b: 80 },  // cinza escuro
    ];

    for (let i = 0; i < 72; i++) {
        nodes.push({
            x: Math.random() * W,
            y: Math.random() * H,
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
        const fov = 500, s = fov / (fov + n.z);
        return { x: W / 2 + (n.x - W / 2) * s, y: H / 2 + (n.y - H / 2) * s, s };
    }

    const LINK_DIST = 165;

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
            if (d < 130) { n.vx += dx / d * .009; n.vy += dy / d * .009; }
        });

        // Connections
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const pi = project(nodes[i]), pj = project(nodes[j]);
                const dx = pi.x - pj.x, dy = pi.y - pj.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < LINK_DIST) {
                    const alpha = (1 - dist / LINK_DIST) * 0.14;
                    const t = nodes[i].tone;
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(${t.r},${t.g},${t.b},${alpha})`;
                    ctx.lineWidth = (pi.s + pj.s) * .3;
                    ctx.moveTo(pi.x, pi.y);
                    ctx.lineTo(pj.x, pj.y);
                    ctx.stroke();
                }
            }
        }

        // Nodes
        nodes.forEach(n => {
            const p = project(n);
            const size = n.r * p.s * 2.6;
            const alpha = p.s * .65;
            const t = n.tone;
            const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 5);
            grd.addColorStop(0, `rgba(${t.r},${t.g},${t.b},${alpha * .35})`);
            grd.addColorStop(1, `rgba(${t.r},${t.g},${t.b},0)`);
            ctx.beginPath(); ctx.fillStyle = grd;
            ctx.arc(p.x, p.y, size * 5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.fillStyle = `rgba(${t.r},${t.g},${t.b},${alpha})`;
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

/* ── Login ── */
document.getElementById('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const pass = document.getElementById('password').value;
    const btn = document.getElementById('loginBtn');
    const errMsg = document.getElementById('errorMsg');

    errMsg.classList.remove('visible');

    if (!email || !pass) {
        errMsg.textContent = 'Preencha e-mail e senha.';
        errMsg.classList.add('visible');
        return;
    }

    btn.classList.add('loading');
    btn.textContent = 'Verificando...';

    setTimeout(() => {
        const users = JSON.parse(localStorage.getItem('af_users') || '[]');
        const user = users.find(u => u.email === email && u.password === pass);

        if (user || (email === 'demo@autofinance.com' && pass === 'demo123')) {
            localStorage.setItem('af_logged', JSON.stringify({ email, name: user?.name || 'Demo' }));
            btn.textContent = '✓ Redirecionando...';
            setTimeout(() => { window.location.href = './index.html'; }, 500);
        } else {
            btn.classList.remove('loading');
            btn.textContent = 'Entrar no painel';
            errMsg.textContent = 'E-mail ou senha incorretos.';
            errMsg.classList.add('visible');
            const card = document.querySelector('.card');
            card.style.animation = 'none';
            card.offsetHeight;
            card.style.animation = 'shake .4s ease';
        }
    }, 1100);
});

const s = document.createElement('style');
s.textContent = `@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}40%{transform:translateX(7px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}`;
document.head.appendChild(s);