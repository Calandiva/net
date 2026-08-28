// 진입점.

import { mountShell } from './ui/shell.js';

function boot() {
  const root = document.getElementById('app');
  if (!root) return;
  mountShell(root);
  const b = document.getElementById('boot');
  if (b) b.remove();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
