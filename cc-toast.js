/* ─────────────────────────────────────────────────────────────
   CC-TOAST.JS · P3 (16.10.2026) · management apps only
   The grey iPhone alert box ("casa-castel.vercel.app says …") becomes the
   app's own small toast at the bottom — same look as the "Saved" toasts.
   · only alert() — OK/Cancel questions (confirm / prompt) stay as they are (P4)
   · several messages in a row are shown one after the other
   · longer messages stay longer (3–9 s)
   · NOT loaded by the tenant app or the cleaners' app
   ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.__ccAlertToast) return;
  window.__ccAlertToast = true;

  var queue = [], busy = false, el = null;

  function node() {
    if (el && el.isConnected) return el;
    el = document.createElement('div');
    el.id = 'ccAlertToast';
    el.className = 'cc-alert-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    (document.body || document.documentElement).appendChild(el);
    return el;
  }

  function next() {
    if (!queue.length) { busy = false; return; }
    busy = true;
    var msg = queue.shift(), t = node();
    t.textContent = msg;
    t.classList.add('show');
    var ms = Math.min(9000, Math.max(3000, 1800 + msg.length * 45));
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(next, 260);
    }, ms);
  }

  window.alert = function (msg) {
    var m = String(msg == null ? '' : msg).trim();
    if (!m) return;
    if (queue[queue.length - 1] === m) return;      // the same message twice in a row → once
    queue.push(m);
    if (!busy) next();
  };
})();
