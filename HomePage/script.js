/* ─────────────────────────────────────────────────────────────
   MAC Studio — script.js
   Floating orbits, parallax, reveal, cursor, canvas lines
────────────────────────────────────────────────────────────── */

/* ── App data ───────────────────────────────────────────────── */
const APPS = [
  { 
    id: 0, 
    name: 'FinanceApp', 
    desc: 'Track your expenses intelligently', 
    link: '../ChatFinance/app/',
    category: 'Finanças',
    version: 'v1.2.1',
    previewImg: 'homepage/assets/preview-finance.jpg',
    features: [
      'Análise automática de gastos',
      'Categorização com IA',
      'Insights em tempo real',
      'Relatórios personalizados'
    ]
  },
  { 
    id: 1, 
    name: 'TaskFlow',   
    desc: 'Organize your daily tasks',         
    link: './homepage/assets/register/index.html',
    category: 'Produtividade',
    version: 'v1.1.0',
    previewImg: 'homepage/assets/preview-taskflow.jpg',
    features: [
      'Priorização adaptativa',
      'Fluxos intuitivos',
      'Lembretes inteligentes',
      'Integração calendário'
    ]
  },
  { 
    id: 2, 
    name: 'NoteAI',     
    desc: 'Smart note-taking powered by AI',   
    link: './homepage/assets/login/index.html',
    category: 'Anotações',
    version: 'v1.0.3',
    previewImg: 'homepage/assets/preview-noteai.jpg',
    features: [
      'Organização automática',
      'Conexões entre notas',
      'Resumos inteligentes',
      'Captura de ideias'
    ]
  },
];

/* ── DOM refs ───────────────────────────────────────────────── */
const navbar         = document.getElementById('navbar');
const navToggle      = document.getElementById('navToggle');
const canvas         = document.getElementById('orbitCanvas');
const ctx            = canvas.getContext('2d');
const heroCenter     = document.getElementById('heroCenter');
const cursorDot      = document.getElementById('cursor');
const cursorFollower = document.getElementById('cursorFollower');
const nodes          = APPS.map(a => document.getElementById(`node-${a.id}`));

/* ── State ──────────────────────────────────────────────────── */
let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let followerPos = { x: mouse.x, y: mouse.y };
let raf;

/* ═══════════════════════════════════════════════════════════════
   1. CANVAS RESIZE
═══════════════════════════════════════════════════════════════ */
function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', () => { resizeCanvas(); computeOrbits(); });

/* ═══════════════════════════════════════════════════════════════
   2. ORBIT MATH
   Each node orbits the viewport center on an ellipse,
   with its own radius, speed, and phase offset.
═══════════════════════════════════════════════════════════════ */
const ORBIT_CONFIG = [
  { rx: 0.28, ry: 0.23, speed: 0.00012, phase: 0       },   // FinanceApp
  { rx: 0.27, ry: 0.20, speed: 0.00012, phase: 2.094   },   // TaskFlow  (2π/3)
  { rx: 0.21, ry: 0.16, speed: 0.00012, phase: 4.189   },   // NoteAI   (4π/3)
];


// Current positions (screen coords) updated every frame
let nodePos = APPS.map(() => ({ x: 0, y: 0 }));

function getCenter() {
  return { cx: window.innerWidth / 2, cy: window.innerHeight / 2 };
}

let currentT = 0;
let hoveredNodeIndex = -1;
let savedAngles = [0, 0, 0];

function computeOrbits(t = 0) {
  if (hoveredNodeIndex === -1) {
    currentT = t;
  }

  const { cx, cy } = getCenter();

  APPS.forEach((_, i) => {
    const cfg = ORBIT_CONFIG[i];
    let angle;

    if (i === hoveredNodeIndex) {
      angle = savedAngles[i];
    } else {
      angle = currentT * cfg.speed + cfg.phase;
    }

    const rx = window.innerWidth * cfg.rx;
    const ry = window.innerHeight * cfg.ry;

    const x = cx + Math.cos(angle) * rx;
    const y = cy + Math.sin(angle) * ry;

    nodePos[i] = { x, y };
  });
}



/* ═══════════════════════════════════════════════════════════════
   3. CANVAS LINE DRAWING
   Draws thin gradient lines from each node to the center.
═══════════════════════════════════════════════════════════════ */
function drawLines() {
  const { cx, cy } = getCenter();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  nodePos.forEach(pos => {
    const grad = ctx.createLinearGradient(cx, cy, pos.x, pos.y);
    grad.addColorStop(0,   'rgba(0,0,0,0.0)');
    grad.addColorStop(0.3, 'rgba(0,0,0,0.06)');
    grad.addColorStop(1,   'rgba(0,0,0,0.0)');

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

/* ═══════════════════════════════════════════════════════════════
   4. NODE DOM POSITIONING
═══════════════════════════════════════════════════════════════ */
function positionNodes() {
  nodes.forEach((node, i) => {
    if (!node) return;
    node.style.left = nodePos[i].x + 'px';
    node.style.top  = nodePos[i].y + 'px';
  });
}

/* ═══════════════════════════════════════════════════════════════
   5. PARALLAX
   Center logo drifts subtly opposite to mouse.
═══════════════════════════════════════════════════════════════ */
function applyParallax() {
  if (!heroCenter) return;
  const { cx, cy } = getCenter();
  const dx = (mouse.x - cx) / cx;
  const dy = (mouse.y - cy) / cy;
  const strength = 12; // px
  heroCenter.style.transform =
    `translate(calc(-50% + ${-dx * strength}px), calc(-50% + ${-dy * strength}px))`;
}

/* ═══════════════════════════════════════════════════════════════
   6. CUSTOM CURSOR
═══════════════════════════════════════════════════════════════ */
document.addEventListener('mousemove', e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  cursorDot.style.left = e.clientX + 'px';
  cursorDot.style.top  = e.clientY + 'px';
});

function animateFollower() {
  const ease = 0.12;
  followerPos.x += (mouse.x - followerPos.x) * ease;
  followerPos.y += (mouse.y - followerPos.y) * ease;
  cursorFollower.style.left = followerPos.x + 'px';
  cursorFollower.style.top  = followerPos.y + 'px';
}

// Hover effect on interactive elements
const hoverEls = document.querySelectorAll(
  'a, button, .app-node, .app-card, .nav-link, .contact-email'
);
hoverEls.forEach(el => {
  el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
  el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
});

/* ═══════════════════════════════════════════════════════════════
   7. MAIN ANIMATION LOOP
═══════════════════════════════════════════════════════════════ */
// Only animate the hero section when visible
const heroEl = document.getElementById('hero');
let heroVisible = true;

const heroObserver = new IntersectionObserver(entries => {
  heroVisible = entries[0].isIntersecting;
}, { threshold: 0.01 });
heroObserver.observe(heroEl);

function mainLoop(t) {
  raf = requestAnimationFrame(mainLoop);
  animateFollower();

  if (heroVisible) {
    computeOrbits(t);
    positionNodes();
    drawLines();
    applyParallax();
  }
}
requestAnimationFrame(mainLoop);

/* ═══════════════════════════════════════════════════════════════
   8. APP NODE CLICK
═══════════════════════════════════════════════════════════════ */
nodes.forEach((node, i) => {
  if (!node) return;

  // Hover pause orbit
  node.addEventListener('mouseenter', () => {
    hoveredNodeIndex = i;
    const cfg = ORBIT_CONFIG[i];
    savedAngles[i] = currentT * cfg.speed + cfg.phase;
  });


  node.addEventListener('mouseleave', () => {
    hoveredNodeIndex = -1;
  });

  // Click modal
  node.addEventListener('click', (e) => {
    e.stopPropagation();
    openAppModal(i, node);
  });
});


/* ═══════════════════════════════════════════════════════════════
   9. NAVBAR SCROLL BEHAVIOR
═══════════════════════════════════════════════════════════════ */
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

/* ═══════════════════════════════════════════════════════════════
   10. MOBILE NAV TOGGLE
═══════════════════════════════════════════════════════════════ */
const navLinks = document.querySelector('.nav-links');
navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  // Animate spans
  const spans = navToggle.querySelectorAll('span');
  if (navLinks.classList.contains('open')) {
    spans[0].style.transform = 'translateY(3.25px) rotate(45deg)';
    spans[1].style.transform = 'translateY(-3.25px) rotate(-45deg)';
  } else {
    spans[0].style.transform = '';
    spans[1].style.transform = '';
  }
});

// Close menu on link click
navLinks.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    const spans = navToggle.querySelectorAll('span');
    spans[0].style.transform = '';
    spans[1].style.transform = '';
  });
});

/* ═══════════════════════════════════════════════════════════════
   11. SCROLL REVEAL (IntersectionObserver)
═══════════════════════════════════════════════════════════════ */
const revealEls = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry, idx) => {
    if (entry.isIntersecting) {
      // Small stagger based on sibling index
      const siblings = [...entry.target.parentElement.querySelectorAll('.reveal')];
      const i = siblings.indexOf(entry.target);
      entry.target.style.transitionDelay = `${i * 0.09}s`;
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.12,
  rootMargin: '0px 0px -40px 0px'
});

revealEls.forEach(el => revealObserver.observe(el));

/* ═══════════════════════════════════════════════════════════════
   12. SMOOTH SCROLL (for older browsers without scroll-behavior)
═══════════════════════════════════════════════════════════════ */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = target.getBoundingClientRect().top + window.scrollY - 60;
    window.scrollTo({ top: offset, behavior: 'smooth' });
  });
});

/* ═══════════════════════════════════════════════════════════════
   13. COUNTER ANIMATION (stats section)
═══════════════════════════════════════════════════════════════ */
function animateCounter(el, to, duration = 1200) {
  const isNumeric = !isNaN(parseInt(to));
  if (!isNumeric) return; // skip "10k+", "2024" etc — too short
  let start = null;
  const from = 0;
  function step(ts) {
    if (!start) start = ts;
    const prog = Math.min((ts - start) / duration, 1);
    const ease = 1 - Math.pow(1 - prog, 3); // cubic ease out
    el.textContent = Math.round(from + (parseInt(to) - from) * ease);
    if (prog < 1) requestAnimationFrame(step);
    else el.textContent = to; // restore original (e.g. "3")
  }
  requestAnimationFrame(step);
}

const statsObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const nums = entry.target.querySelectorAll('.stat-number');
      nums.forEach(n => {
        const original = n.textContent.trim();
        if (!isNaN(parseInt(original)) && !original.includes('k')) {
          animateCounter(n, original);
        }
      });
      statsObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

const statsEl = document.querySelector('.about-stats');
if (statsEl) statsObserver.observe(statsEl);

/* ═══════════════════════════════════════════════════════════════
   14. PAGE LOAD — initial node positions
═══════════════════════════════════════════════════════════════ */
// Set initial position immediately before first RAF fires
computeOrbits(0);
positionNodes();

// Modal system
const modalOverlay = document.getElementById('modalOverlay');
const appModal = document.getElementById('appModal');
const modalClose = document.getElementById('modalClose');
const modalName = document.getElementById('modalName');
const modalDesc = document.getElementById('modalFullDesc');
const modalIcon = document.getElementById('modalIcon');
const modalLink = document.getElementById('modalLink');


const FULL_DESC = [
  `FinanceApp: Controle financeiro inteligente com análise automática de gastos, categorização avançada e insights personalizados para melhorar sua vida financeira.`,
  
  `TaskFlow: Organize tarefas diárias com clareza. Priorização adaptativa, fluxos de trabalho intuitivos, lembretes inteligentes e integração com calendário. Produtividade sem complexidade.`,
  
  `NoteAI: Anotações inteligentes com IA. Captura automática de ideias, organização inteligente, conexões entre notas e resumos automáticos. Seus pensamentos, perfeitamente estruturados.`
];

function openAppModal(i, node) {
  hoveredNodeIndex = -1; // resume all
  const app = APPS[i];
  
  // Clone icon
  const iconSvg = node.querySelector('.node-icon svg').cloneNode(true);
  modalIcon.innerHTML = '';
  modalIcon.appendChild(iconSvg);
  
  modalName.textContent = app.name;
  
  // New fields
  modalCategory.textContent = app.category;
  modalVersion.textContent = `v${app.version}`;
  modalPreview.src = app.previewImg;
  modalPreview.onerror = () => { modalPreview.style.display = 'none'; };
  modalFeatures.innerHTML = app.features.map(f => `<li>• ${f}</li>`).join('');
  
  modalDesc.textContent = FULL_DESC[i];
  modalLink.href = app.link || '#';
  
  // Add app theme
  appModal.dataset.app = i;
  
  appModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeAppModal() {
  appModal.classList.remove('active');
  document.body.style.overflow = '';
}

// Events
modalOverlay.addEventListener('click', closeAppModal);
modalClose.addEventListener('click', closeAppModal);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && appModal.classList.contains('active')) {
    closeAppModal();
  }
});

