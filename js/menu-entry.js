/* ================================================================
   menu-entry.js - controla entrada no jogo a partir do menu
   ================================================================ */

(function () {
  'use strict';

  const START_KEY = 'dbd:start-from-menu';
  const links = document.querySelectorAll('a.play[href*="jogo.html"]');

  links.forEach(link => {
    link.addEventListener('click', () => {
      try {
        sessionStorage.setItem(START_KEY, '1');
      } catch (_) {
        // Ignora se storage estiver indisponivel.
      }
    });
  });
})();
