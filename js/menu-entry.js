/*
  menu-entry.js
  Autoriza a navegação para jogo.html gravando uma flag no sessionStorage.
  Sem essa flag, jogo.html redireciona automaticamente para o menu.
*/

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
