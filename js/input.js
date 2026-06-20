/* ================================================================
   input.js – rastreamento do estado do teclado via eventos DOM.

   Uso: Input.isDown('KeyW')  → true enquanto W estiver pressionado
   ================================================================ */

const Input = (() => {
  const held = {};

  /* Teclas que causam scroll no navegador – prevenimos o padrão */
  const BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

  window.addEventListener('keydown', e => {
    held[e.code] = true;
    if (BLOCK.has(e.code)) e.preventDefault();
  });

  window.addEventListener('keyup', e => {
    held[e.code] = false;
  });

  /* Limpa o estado se a janela perder o foco (evita teclas "presas") */
  window.addEventListener('blur', () => {
    Object.keys(held).forEach(k => { held[k] = false; });
  });

  return {
    /** @param {string} code – e.code (ex.: 'KeyW', 'Space', 'ShiftLeft') */
    isDown(code) { return held[code] === true; }
  };
})();
