/* GADAPAD, shared front end behaviour. */

document.addEventListener('DOMContentLoaded', async () => {
  burger();
  reveal();
  countUp();
  bars();
  stickyHeader();
  tabs();
  accordions();
  countdowns();
  dropdowns();
  modals();
  toastTriggers();
  exampleCards();

  if (window.giwaWeb3) {
    await window.giwaWeb3.init();
    wallet();
  }
});

/* ---------------- example listings, not wired to a real launch page ---------------- */
function exampleCards() {
  document.querySelectorAll('[data-example]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const name = el.getAttribute('data-example');
      showToast('info', name, name + ' is an example listing to show the format. Ondol Protocol is the one live launch, try it from the Launchpad.');
    });
  });
}

/* ---------------- nav ---------------- */
function burger() {
  const b = document.querySelector('[data-burger]');
  const n = document.querySelector('.nav');
  if (!b || !n) return;
  b.addEventListener('click', () => n.classList.toggle('open'));
  n.querySelectorAll('a').forEach(a => a.addEventListener('click', () => n.classList.remove('open')));
}

/* ---------------- header goes glass once it leaves the hero ---------------- */
function stickyHeader() {
  const h = document.querySelector('.hdr');
  if (!h) return;
  let queued = false;
  const apply = () => { h.classList.toggle('solid', window.scrollY > 40); queued = false; };
  apply();
  window.addEventListener('scroll', () => {
    if (!queued) { requestAnimationFrame(apply); queued = true; }
  }, { passive: true });
}

/* ---------------- reveal on scroll ---------------- */
function reveal() {
  const t = document.querySelectorAll('[data-rev], [data-rev-g]');
  if (!t.length) return;
  if (!('IntersectionObserver' in window)) { t.forEach(e => e.classList.add('seen')); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
  t.forEach(e => io.observe(e));
}

/* ---------------- figures count up when they scroll into view ---------------- */
function countUp() {
  const t = document.querySelectorAll('[data-num]');
  if (!t.length) return;
  const run = el => {
    const target = parseFloat(el.getAttribute('data-num'));
    const tpl = el.getAttribute('data-fmt') || '{n}';
    const dur = 1400, t0 = performance.now();
    const tick = now => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = tpl.replace('{n}', Math.round(target * eased).toLocaleString('en-US'));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (!('IntersectionObserver' in window)) { t.forEach(run); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
  }, { threshold: 0.5 });
  t.forEach(e => io.observe(e));
}

/* ---------------- progress bars fill on reveal ---------------- */
function bars() {
  const t = document.querySelectorAll('.bar i[data-fill]');
  if (!t.length) return;
  const run = el => { el.style.width = el.getAttribute('data-fill') + '%'; };
  if (!('IntersectionObserver' in window)) { t.forEach(run); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { setTimeout(() => run(e.target), 120); io.unobserve(e.target); } });
  }, { threshold: 0.4 });
  t.forEach(e => io.observe(e));
}

/* ---------------- tabs ---------------- */
function tabs() {
  document.querySelectorAll('.tabs').forEach(group => {
    const key = group.getAttribute('data-tabs');
    const btns = group.querySelectorAll('.tab');
    btns.forEach(b => {
      b.addEventListener('click', () => {
        const to = b.getAttribute('data-tab');
        btns.forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        document.querySelectorAll('.pane[data-group="' + key + '"]').forEach(p => {
          p.classList.toggle('on', p.getAttribute('data-tab') === to);
        });
      });
    });
  });
  // deep link, eg project.html#treasury
  if (location.hash) {
    const target = document.querySelector('.tab[data-tab="' + location.hash.slice(1) + '"]');
    if (target) target.click();
  }
}

/* ---------------- accordion ---------------- */
function accordions() {
  document.querySelectorAll('.acc button').forEach(b => {
    b.addEventListener('click', () => b.closest('.acc').classList.toggle('open'));
  });
}

/* ---------------- countdowns ---------------- */
function countdowns() {
  document.querySelectorAll('[data-until]').forEach(el => {
    const target = new Date(el.getAttribute('data-until')).getTime();
    const cells = el.querySelectorAll('b');
    const tick = () => {
      let d = Math.max(0, target - Date.now());
      const day = Math.floor(d / 864e5); d -= day * 864e5;
      const hr = Math.floor(d / 36e5); d -= hr * 36e5;
      const mn = Math.floor(d / 6e4); d -= mn * 6e4;
      const sc = Math.floor(d / 1e3);
      [day, hr, mn, sc].forEach((v, i) => { if (cells[i]) cells[i].textContent = String(v).padStart(2, '0'); });
    };
    tick();
    setInterval(tick, 1000);
  });
}

/* ---------------- dropdowns ---------------- */
function dropdowns() {
  document.querySelectorAll('[data-drop]').forEach(trigger => {
    const panel = document.getElementById(trigger.getAttribute('data-drop'));
    if (!panel) return;
    trigger.addEventListener('click', e => { e.stopPropagation(); panel.classList.toggle('open'); });
    document.addEventListener('click', e => { if (!panel.contains(e.target)) panel.classList.remove('open'); });
  });
}

/* ---------------- modal ---------------- */
function modals() {
  document.querySelectorAll('[data-open]').forEach(b => {
    b.addEventListener('click', () => {
      const m = document.getElementById(b.getAttribute('data-open'));
      if (m) m.classList.add('open');
    });
  });
  document.querySelectorAll('[data-close]').forEach(b => {
    b.addEventListener('click', () => b.closest('.ov').classList.remove('open'));
  });
  document.querySelectorAll('.ov').forEach(ov => {
    ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); });
  });
}

/* ---------------- toasts ---------------- */
window.showToast = function (kind, title, msg, tx) {
  let stack = document.querySelector('.toasts');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toasts';
    document.body.appendChild(stack);
  }
  const el = document.createElement('div');
  el.className = 'toast ' + (kind === 'success' ? 'ok' : kind === 'danger' ? 'bad' : '');
  const link = tx
    ? '<br><a href="https://sepolia-explorer.giwa.io/tx/' + tx + '" target="_blank" rel="noopener">View on GIWA Explorer</a>'
    : '';
  el.innerHTML = '<div><b>' + title + '</b><p>' + msg + link + '</p></div><button aria-label="Dismiss">&times;</button>';
  el.querySelector('button').addEventListener('click', () => el.remove());
  stack.appendChild(el);
  setTimeout(() => el.remove(), 6500);
};

function toastTriggers() {
  document.querySelectorAll('[data-toast]').forEach(b => {
    b.addEventListener('click', () => {
      const [kind, title, msg] = b.getAttribute('data-toast').split('|');
      showToast(kind, title, msg);
    });
  });
}

/* ---------------- wallet ---------------- */
function wallet() {
  const slot = document.getElementById('walletSlot');
  if (!slot) return;

  function render() {
    const acc = window.giwaWeb3.account;
    if (acc) {
      const short = acc.slice(0, 6) + '…' + acc.slice(-4);
      slot.innerHTML = '<div style="position:relative"><button class="wallet" data-drop="wdrop"><i></i><span>' + short + '</span></button>' +
        '<div class="drop glass" id="wdrop">' +
        '<button id="faucetBtn">Claim 100,000 testnet GKRW</button>' +
        '<a href="portfolio.html">Portfolio and claims</a>' +
        '<a href="profile.html">Verification and settings</a>' +
        '<button id="dc" style="color:var(--no)">Disconnect</button>' +
        '</div></div>';
      dropdowns();
      document.getElementById('dc').addEventListener('click', () => {
        window.giwaWeb3.account = null;
        try { localStorage.removeItem('gadapad_wallet'); } catch (e) {}
        render();
        showToast('info', 'Disconnected', 'Your wallet is no longer connected.');
      });
      const faucetBtn = document.getElementById('faucetBtn');
      if (faucetBtn) faucetBtn.addEventListener('click', async () => {
        faucetBtn.disabled = true;
        const original = faucetBtn.textContent;
        try {
          const remaining = await window.giwaWeb3.faucetCooldownRemaining(acc);
          if (remaining > 0) {
            const hrs = Math.ceil(remaining / 3600);
            showToast('info', 'Cooldown active', 'This wallet already claimed within the last 24 hours. Try again in about ' + hrs + 'h.');
            faucetBtn.disabled = false;
            return;
          }
          faucetBtn.textContent = 'Confirm in wallet…';
          const tx = await window.giwaWeb3.requestGKRWFaucet();
          showToast('info', 'Faucet requested', '100,000 GKRW is on its way to your wallet.', tx);
        } catch (err) {
          showToast('danger', 'Faucet request failed', (err && err.message) || 'The transaction was rejected or reverted.');
        } finally {
          faucetBtn.disabled = false;
          faucetBtn.textContent = original;
        }
      });
    } else {
      slot.innerHTML = '<button class="btn btn-p btn-sm" id="connectBtn">Connect wallet</button>';
      document.getElementById('connectBtn').addEventListener('click', connect);
    }
  }

  async function connect() {
    const b = document.getElementById('connectBtn');
    b.disabled = true;
    b.textContent = 'Connecting…';
    try {
      const acc = await window.giwaWeb3.connectWallet();
      if (acc) {
        showToast('success', 'Wallet connected', acc.slice(0, 6) + '…' + acc.slice(-4) + ' is connected to GIWA Sepolia.');
        try { localStorage.setItem('gadapad_wallet', '1'); } catch (e) {}
        document.dispatchEvent(new CustomEvent('gadapad:walletConnected', { detail: { account: acc } }));
        render();
      } else {
        b.disabled = false;
        b.textContent = 'Connect wallet';
      }
    } catch (err) {
      b.disabled = false;
      b.textContent = 'Connect wallet';
      showToast('danger', 'Connection failed', err.message || 'The wallet request was rejected.');
    }
  }

  window.giwaWeb3.onStateChange(render);
  render();
}
