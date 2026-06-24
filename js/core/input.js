/*
  input.js
  Rastreia o estado do teclado em tempo real via eventos DOM.
  Uso: Input.isDown('KeyW') retorna true enquanto a tecla estiver pressionada.
*/

const Input = (() => {
  const held = {};

  // teclas bloqueadas para evitar scroll da página
  const BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

  window.addEventListener('keydown', e => {
    held[e.code] = true;
    if (BLOCK.has(e.code)) e.preventDefault();
  });

  window.addEventListener('keyup', e => {
    held[e.code] = false;
  });

  // limpa ao perder foco, evita teclas presas
  window.addEventListener('blur', () => {
    Object.keys(held).forEach(k => { held[k] = false; });
  });

  return {
    /** @param {string} code – e.code (ex.: 'KeyW', 'Space', 'ShiftLeft') */
    isDown(code) { return held[code] === true; }
  };
})();
