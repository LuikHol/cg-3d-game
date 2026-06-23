/* ================================================================
   minimapa.js – Minimapa 2D em Canvas mostrando drone e missões
   ================================================================ */

class MiniMap {
  constructor(size = 200) {
    this.size = size;
    
    // Cria o canvas do minimapa
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = size;
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '10px';
    this.canvas.style.right = '10px';
    this.canvas.style.border = '2px solid #fff';
    this.canvas.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    this.canvas.style.zIndex = '9999';
    this.canvas.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
    
    this.ctx = this.canvas.getContext('2d');
    document.body.appendChild(this.canvas);
    
    // Repositiona o HUD de missão para embaixo do minimapa
    const missionHud = document.getElementById('mission-hud');
    if (missionHud) {
      missionHud.style.position = 'fixed';
      missionHud.style.top = (10 + size + 8) + 'px';
      missionHud.style.right = '10px';
      missionHud.style.left = 'auto';
      missionHud.style.width = size + 'px';
      missionHud.style.bottom = 'auto';
    }
    
    // Escala: mapeia coordenadas 3D do mundo para pixels do minimapa
    this.scale = 1.2; // pixels por unidade de mundo
    this.centerX = size / 2;
    this.centerY = size / 2;
  }

  /**
   * Desenha o minimapa com drone, pontos de coleta/entrega e aros
   * @param {Array} dronePos - Posição do drone [x, y, z]
   * @param {Object} mission - Objeto de missão com def e phase
   */
  draw(dronePos, mission) {
    const ctx = this.ctx;
    
    // Fundo: background estático da cidade (ou fallback sólido)
    if (this._cityBg) {
      ctx.drawImage(this._cityBg, 0, 0);
    } else {
      ctx.fillStyle = 'rgba(10, 10, 20, 0.9)';
      ctx.fillRect(0, 0, this.size, this.size);
    }
    
    // Grade de referência
    ctx.strokeStyle = 'rgba(100, 100, 120, 0.3)';
    ctx.lineWidth = 0.5;
    for (let i = -80; i <= 80; i += 20) {
      const px = this.worldToScreenX(i);
      const pz = this.worldToScreenY(i);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, this.size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pz);
      ctx.lineTo(this.size, pz);
      ctx.stroke();
    }
    
    // Desenha a missão atual se existir
    if (mission && mission.def) {
      const def = mission.def;
      
      // Ponto de coleta (verde)
      this.drawPoint(def.pickup.x, def.pickup.z, 5, '#00ff00', '◆');
      
      // Ponto de entrega (azul)
      this.drawPoint(def.delivery.x, def.delivery.z, 5, '#00aaff', '◆');
      
      // Aros - só mostra quando em flying ou delivery
      if (mission.phase === 'flying' || mission.phase === 'delivery') {
        for (let i = 0; i < def.hoops.length; i++) {
          const hoop = def.hoops[i];
          const isCurrent = i === mission.currentHoop;
          this.drawPoint(
            hoop.pos[0],
            hoop.pos[2],
            isCurrent ? 6 : 4,
            isCurrent ? '#ffff00' : '#cccccc',
            isCurrent ? '●' : '○'
          );
        }
      }
    }
    
    
    // Drone (vermelho/laranja)
    this.drawPoint(dronePos[0], dronePos[2], 7, '#ff4444', '⬤', true);
    
    // Labels
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MAP', this.centerX, this.size - 5);
  }

  
  initCityLayer(city) {
    const bg  = document.createElement('canvas');
    bg.width  = bg.height = this.size;
    const bx  = bg.getContext('2d');
    const S   = this.size;
    const sc  = this.scale;
    const wx  = x => this.centerX + x * sc;
    const wz  = z => this.centerY + z * sc;

    const RHM = city.ROAD_HALF_MAIN;
    const RHS = city.ROAD_HALF_SEC;
    const SWM = city.SIDEWALK_W_MAIN;
    const SWS = city.SIDEWALK_W_SEC;

    /* ── Grama ───────────────────────────────────────────────── */
    bx.fillStyle = '#1a3a10';
    bx.fillRect(0, 0, S, S);

    /* ── Calçadas principais ─────────────────────────────────── */
    bx.fillStyle = '#4a4a48';
    for (const zSide of [RHM, -(RHM + SWM)]) {
      bx.fillRect(0, wz(zSide), S, SWM * sc);
    }
    for (const xSide of [RHM, -(RHM + SWM)]) {
      bx.fillRect(wx(xSide), 0, SWM * sc, S);
    }

    /* ── Calçadas secundárias ────────────────────────────────── */
    bx.fillStyle = '#434341';
    for (const zOff of [-40, 40]) {
      for (const side of [1, -1]) {
        bx.fillRect(0, wz(zOff + side * RHS), S, SWS * sc);
      }
    }
    for (const xOff of [-40, 40]) {
      for (const side of [1, -1]) {
        bx.fillRect(wx(xOff + side * RHS), 0, SWS * sc, S);
      }
    }

    /* ── Vias secundárias ────────────────────────────────────── */
    bx.fillStyle = '#2e2e2e';
    for (const zOff of [-40, 40]) {
      bx.fillRect(0, wz(zOff - RHS), S, RHS * 2 * sc);
    }
    for (const xOff of [-40, 40]) {
      bx.fillRect(wx(xOff - RHS), 0, RHS * 2 * sc, S);
    }

    /* ── Vias principais ─────────────────────────────────────── */
    bx.fillStyle = '#333333';
    bx.fillRect(0,          wz(-RHM), S,          RHM * 2 * sc);
    bx.fillRect(wx(-RHM),   0,        RHM * 2 * sc, S);

    /* ── Praça ───────────────────────────────────────────────── */
    bx.fillStyle = '#2d6e18';
    bx.fillRect(
      wx(city.PARK_CX - city.PARK_HW), wz(city.PARK_CZ - city.PARK_HZ),
      city.PARK_HW * 2 * sc,           city.PARK_HZ * 2 * sc
    );

    /* ── Prédios ─────────────────────────────────────────────── */
    for (const b of city.buildings) {
      const bw = b[2], bd = b[3];
      const r  = Math.round(b[5] * 160 + 50);
      const g  = Math.round(b[6] * 160 + 50);
      const bl = Math.round(b[7] * 160 + 50);
      bx.fillStyle   = `rgb(${r},${g},${bl})`;
      bx.fillRect(wx(b[0] - bw / 2), wz(b[1] - bd / 2), bw * sc, bd * sc);
      bx.strokeStyle = 'rgba(0,0,0,0.5)';
      bx.lineWidth   = 0.5;
      bx.strokeRect(wx(b[0] - bw / 2), wz(b[1] - bd / 2), bw * sc, bd * sc);
    }

    /* ── Árvores ─────────────────────────────────────────────── */
    bx.fillStyle = '#3a8a22';
    for (const t of city.treeInstances) {
      const sx = wx(t.x), sz = wz(t.z);
      if (sx < 0 || sx > S || sz < 0 || sz > S) continue;
      bx.fillRect(sx - 1, sz - 1, 2, 2);
    }

    /* ── Grade de orientação suave ───────────────────────────── */
    bx.strokeStyle = 'rgba(255,255,255,0.04)';
    bx.lineWidth   = 0.5;
    for (let i = -80; i <= 80; i += 20) {
      bx.beginPath(); bx.moveTo(wx(i), 0);   bx.lineTo(wx(i), S);   bx.stroke();
      bx.beginPath(); bx.moveTo(0,     wz(i)); bx.lineTo(S, wz(i)); bx.stroke();
    }

    this._cityBg = bg;
  }


  /**
   * Desenha um ponto no minimapa
   * @param {number} worldX
   * @param {number} worldZ
   * @param {number} radius
   * @param {string} color
   * @param {string} label
   * @param {boolean} highlight
   */
  drawPoint(worldX, worldZ, radius, color, label, highlight = false) {
    const screenX = this.worldToScreenX(worldX);
    const screenY = this.worldToScreenY(worldZ);
    
    // Verifica se está dentro do quadrado do minimapa
    if (screenX < 2 || screenX > this.size - 2 || screenY < 2 || screenY > this.size - 2) return;
    
    // Desenha halo se for highlight (drone)
    if (highlight) {
      this.ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(screenX, screenY, radius * 1.8, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    
    // Círculo preenchido
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Bordas
    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  }

  /**
   * Converte coordenada X do mundo para pixel da tela
   */
  worldToScreenX(x) {
    return this.centerX + (x * this.scale);
  }

  /**
   * Converte coordenada Z do mundo para pixel da tela (invertido para match visual)
   */
  worldToScreenY(z) {
    return this.centerY + (z * this.scale);
  }

  /**
   * Ajusta a opacidade do minimapa
   */
  setOpacity(isPaused) {
    this.canvas.style.opacity = isPaused ? '0.4' : '1';
  }

  /**
   * Remove o minimapa do DOM
   */
  destroy() {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}
