# Delivered by Drones

### [Slides](https://docs.google.com/presentation/d/10FbXRhKX-OXOxwQFqdM4Un4Uo_--1Qd-7WFBkudNuoY/edit?usp=sharing)

Jogo 3D de entrega com drone desenvolvido para a cadeira de Computação Gráfica.  
O jogador pilota um drone por uma cidade procedural, passando por aros e entregando encomendas em 5 missões progressivas.

https://github.com/user-attachments/assets/5acfe417-1ee1-4de1-8355-069067fbbda6


---

## Como rodar

O projeto roda direto no navegador, sem instalação de dependências.

1. Clone ou baixe o repositório
2. Abra um servidor HTTP local na raiz do projeto — por exemplo:
   ```bash
   # Python
   python -m http.server 8080

   # Node.js (npx)
   npx serve .
   ```
3. Acesse `http://localhost:8080` no navegador
4. Clique em **Jogar** no menu para iniciar

> Abrir o `index.html` direto pelo sistema de arquivos (`file://`) não funciona devido a restrições de CORS no carregamento dos modelos `.obj`.

---

## Controles

| Tecla | Ação |
|---|---|
| `W` / `S` | Avançar / Recuar |
| `A` / `D` | Girar esquerda / direita |
| `Espaço` | Subir |
| `Shift` | Descer |
| `Esc` | Pausar / Retomar |

---

## Estrutura do projeto

```
cg-3d-game/
├── index.html          # Menu principal
├── jogo.html           # Página do jogo
├── creditos.html       # Página de créditos
├── controles.html      # Página de controles
├── styles.css          # Estilos do jogo (HUD, telas de pausa e resultado)
├── menu.css            # Estilos do menu e subpáginas
└── js/
    ├── game.js         # Loop principal, física e inicialização WebGL
    ├── renderer.js     # Renderização da cena (céu, chão, drone)
    ├── city.js         # Geração e renderização da cidade
    ├── mission.js      # Lógica e renderização das missões
    ├── minimap.js      # Minimapa 2D sobreposto ao jogo
    ├── menu-scene.js   # Fundo 3D animado do menu
    ├── menu-entry.js   # Controle de acesso ao jogo via sessionStorage
    ├── core/
    │   ├── shaders.js      # Código-fonte GLSL dos shaders (Vertex + Fragment)
    │   ├── geometry.js     # Geometrias primitivas (cubo, disco, toro)
    │   ├── input.js        # Rastreamento de teclado em tempo real
    │   └── obj-loader.js   # Parser de arquivos .obj e upload para a GPU
    ├── lib/
    │   └── gl-matrix-min.js  # Biblioteca de álgebra linear (mat4, mat3, vec3)
    ├── objects/            # Modelos 3D em formato .obj
    └── textures/           # Texturas (corpo do drone, sol, lua, personagens)
```

---

## O que cada arquivo faz

### Páginas HTML

| Arquivo | Descrição |
|---|---|
| `index.html` | Menu principal com fundo 3D animado da cidade |
| `jogo.html` | Tela do jogo; contém o canvas WebGL e o HUD |
| `creditos.html` | Lista de desenvolvedores e créditos dos assets |
| `controles.html` | Explicação dos controles do drone |

### JavaScript principal (`js/`)

**`game.js`**  
Ponto de entrada do jogo. Inicializa o contexto WebGL, compila os shaders, carrega todos os modelos `.obj` (drone, hélices, seta, presente), e executa o loop principal com `requestAnimationFrame`. Cuida da física do drone (aceleração, atrito, boost ao passar por aros), câmera em terceira pessoa, ciclo dia/noite, tela de pausa, e tela de resultados finais.

**`renderer.js`**  
Responsável por desenhar todos os elementos visuais da cena: céu gradiente com sol e lua em órbita, chão com textura de grama, malha de ruas, faixas de pedestre, e o drone (corpo OBJ + hélices animadas + faróis + caixa de carga). Implementa névoa atmosférica e iluminação que varia entre dia e noite.

**`city.js`**  
Gera a cidade proceduralmente a partir de arrays de dados fixos. Renderiza prédios com janelas emissivas à noite, ruas, calçadas, parque central, árvores, carros, postes, bancos, hidrantes e latas de lixo. Também faz a detecção de colisão do drone com os prédios.

**`mission.js`**  
Define as 5 missões do jogo e gerencia toda a sua lógica: fases (coleta → voo pelos aros → entrega), detecção de cruzamento dos aros, pontuação com decaimento por tempo, diálogos de aceite estilo visual novel, HUD de missão, e tela de resultado com ranking (C / B / A / S).

**`minimap.js`**  
Cria um canvas 2D sobreposto ao jogo com o minimapa. Mostra a posição do drone, os pontos de coleta (verde) e entrega (laranja), e os aros da missão atual. O fundo da cidade é pré-renderizado uma vez para melhor desempenho.

**`menu-scene.js`**  
Renderiza a cidade 3D estática como fundo animado do menu principal e das subpáginas (créditos, controles). Usa o mesmo pipeline WebGL do jogo, mas com câmera fixa e sem lógica de gameplay.

**`menu-entry.js`**  
Grava uma flag no `sessionStorage` ao clicar em "Jogar". O `jogo.html` verifica essa flag ao carregar — sem ela, redireciona o jogador de volta ao menu.

### Core (`js/core/`)

**`shaders.js`**  
Contém os shaders GLSL como strings. O Vertex Shader transforma vértices e calcula posições para iluminação. O Fragment Shader implementa Blinn-Phong com suporte a textura, cor emissiva, névoa atmosférica e modo especial para árvores (separação automática tronco/copa).

**`geometry.js`**  
Gera as geometrias primitivas usadas na cena como `Float32Array` prontos para a GPU: cubo (6 faces, normals por face), disco (para zonas de coleta/entrega) e toro paramétrico (para os aros das missões).

**`input.js`**  
Mantém um mapa do estado atual do teclado (`keydown`/`keyup`). Bloqueia o scroll da página para as teclas de movimento. Expõe `Input.isDown('KeyW')` para consulta por frame.

**`obj-loader.js`**  
Parser próprio de arquivos `.obj`. Lê os tokens `v`, `vn`, `vt` e `f`, triangula faces em leque, gera normais flat quando o arquivo não as inclui, e organiza os dados em `Float32Array` não-indexados para `gl.drawArrays`. Também suporta segmentos por material (`usemtl`) para colorir partes distintas de um mesmo modelo.

---

## Créditos

**Desenvolvedores**
- Kalil Rodrigues
- Gabryella Rodrigues
- Lucas Holanda

**Modelos autorais**
- Drone (`drone.obj`, `helix1–4.obj`) — modelado pela equipe
- Seta de direção (`Arrow.obj`) — modelada pela equipe
- Cidade, prédios, ruas, postes e hidrantes — gerados proceduralmente pela equipe

**Assets de terceiros**
- Modelo de carro (`Car.obj`) — wufudufu
- Modelo de banco (`Bench_LowRes.obj`) — raccoonice
- Modelo de lata de lixo (`caixa de lixo.obj`) — tarcisio1
- Modelo de presente (`GiftBox_blend.obj`) — Elias
- Modelos de árvores (`arvore.obj`) — paulsendesign
- Fotografias dos personagens (diálogos) — imagens de terceiros
- Texturas do sol e da lua — imagens de terceiros
