// Light or dark theme. Runs before the page draws so it never flashes the wrong one.
// No choice saved: follow the device setting. The header switch saves a choice on this device.
'use strict';
(function () {
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch { /* storage blocked: follow the device */ }
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;

  const dark = () => document.documentElement.dataset.theme === 'dark'
    || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);

  function label(btn) {
    btn.textContent = dark() ? 'Light mode' : 'Dark mode';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('theme');
    label(btn);
    btn.addEventListener('click', () => {
      const next = dark() ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch { /* the choice lasts for this visit only */ }
      label(btn);
    });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => label(btn));
  });
})();
