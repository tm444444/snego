/* ==========================================================
   СНЕGO — 3D-модель снегоката для конструктора.
   Собрана кодом на Three.js по фото и рендерам базовой модели.
   Оси: X — вперёд (к лыже), Y — вверх, Z — вправо по ходу. Единица — метр (условно).
   ========================================================== */
(function () {
  'use strict';

  async function create(container, init) {
    init = init || {};
    const [THREE, { OrbitControls }, { RoundedBoxGeometry }, { RoomEnvironment }] = await Promise.all([
      import('three'),
      import('three/addons/controls/OrbitControls.js'),
      import('three/addons/geometries/RoundedBoxGeometry.js'),
      import('three/addons/environments/RoomEnvironment.js'),
    ]);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isSmall = Math.min(window.innerWidth, window.innerHeight) < 600;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const UP = V(0, 1, 0);
    const rad = THREE.MathUtils.degToRad;
    const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

    /* ---------- Рендерер и сцена ---------- */
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const BG = 0x0a0e14;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG);
    scene.fog = new THREE.Fog(BG, 6, 15);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.6;

    const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 60);

    /* ---------- Свет (основной — со стороны кожуха привода, слева по ходу) ---------- */
    scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x0a0e14, 0.55));

    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(2.6, 5, -3);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -2.4, right: 2.4, top: 2.4, bottom: -2.4, near: 0.5, far: 14 });
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.target.position.set(0, 0.4, 0);
    scene.add(key, key.target);

    const rim = new THREE.DirectionalLight(0x7cc4ff, 1.4);
    rim.position.set(-4, 3, 3);
    scene.add(rim);

    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-1.5, 1.5, -4);
    scene.add(fill);

    /* ---------- Текстуры из canvas ---------- */
    function canvasTex(w, h, draw, srgb = true) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(c);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    }

    // Камуфляжный «снежный» чехол батареи: пятна нескольких размеров, без шва на стыках
    const camoTex = canvasTex(1024, 1024, (g, w, h) => {
      let seed = 11;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      g.fillStyle = '#c3c8cc';
      g.fillRect(0, 0, w, h);
      const blot = (x, y, r, col) => {
        const parts = [];
        for (let k = 0; k < 5; k++) {
          const a = rnd() * Math.PI * 2, d = rnd() * r;
          parts.push([Math.cos(a) * d, Math.sin(a) * d, r * (0.4 + rnd() * 0.6)]);
        }
        g.fillStyle = col;
        for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) {
          const cx = x + ox, cy = y + oy;
          if (cx < -2 * r || cx > w + 2 * r || cy < -2 * r || cy > h + 2 * r) continue;
          g.beginPath();
          for (const [dx, dy, rr] of parts) { g.moveTo(cx + dx + rr, cy + dy); g.arc(cx + dx, cy + dy, rr, 0, Math.PI * 2); }
          g.fill();
        }
      };
      const layers = [
        [70, 60, 150, ['#eef1f3', '#f7f9fa', '#9aa1a7']],
        [240, 18, 60, ['#f4f6f7', '#dfe3e6', '#878e94', '#5b6167']],
        [420, 5, 20, ['#ffffff', '#6a7076', '#33373b', '#aab0b5']],
        [900, 1.5, 5, ['#2b2e31', '#f9fafb', '#4a4f54']],
      ];
      for (const [n, r0, r1, cols] of layers) {
        for (let i = 0; i < n; i++) blot(rnd() * w, rnd() * h, r0 + rnd() * (r1 - r0), cols[Math.floor(rnd() * cols.length)]);
      }
    });
    camoTex.wrapS = camoTex.wrapT = THREE.RepeatWrapping;

    // Рифлёный лист платформы
    const gripTex = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#17191d';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#2d3238';
      for (const [cx, cy, rx, ry] of [[32, 32, 22, 8], [96, 96, 22, 8], [96, 32, 8, 22], [32, 96, 8, 22]]) {
        g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill();
      }
    });
    gripTex.wrapS = gripTex.wrapT = THREE.RepeatWrapping;
    gripTex.repeat.set(15, 8);

    // Маленький экран на руле (без цифр — характеристики не утверждены)
    const dispTex = canvasTex(128, 72, (g, w, h) => {
      g.fillStyle = '#06101c';
      g.fillRect(0, 0, w, h);
      g.lineWidth = 9; g.lineCap = 'round';
      g.strokeStyle = '#17324f';
      g.beginPath(); g.arc(46, 50, 28, Math.PI, Math.PI * 2); g.stroke();
      g.strokeStyle = '#39A5F2';
      g.beginPath(); g.arc(46, 50, 28, Math.PI, Math.PI * 1.62); g.stroke();
      g.fillStyle = '#7fd0ff';
      for (let i = 0; i < 4; i++) g.fillRect(92, 52 - i * 12, 22, 8);
      g.fillStyle = 'rgba(255,255,255,.7)';
      g.fillRect(30, 58, 32, 4);
    });

    // Пол: мягкий круг света, уходящий в фон
    const floorTex = canvasTex(1024, 1024, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      grd.addColorStop(0, '#2a3646');
      grd.addColorStop(0.06, '#1f2935');
      grd.addColorStop(0.16, '#121922');
      grd.addColorStop(0.3, '#0a0e14');
      grd.addColorStop(1, '#0a0e14');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
    });

    // Мягкая точка для снежинок
    const dotTex = canvasTex(64, 64, (g) => {
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.4, 'rgba(255,255,255,.7)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
    });

    // Затухание луча фонаря (верх текстуры — у фонаря)
    const beamAlpha = canvasTex(4, 128, (g) => {
      const grd = g.createLinearGradient(0, 0, 0, 128);
      grd.addColorStop(0, '#fff');
      grd.addColorStop(0.35, '#777');
      grd.addColorStop(1, '#000');
      g.fillStyle = grd;
      g.fillRect(0, 0, 4, 128);
    }, false);

    // Экран телефона: простая «карта» с маршрутом
    const screenTex = canvasTex(256, 512, (g, w, h) => {
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#0f2a4a');
      bg.addColorStop(1, '#0a1a30');
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#1f4a78';
      g.lineWidth = 10;
      g.lineCap = 'round';
      [[[-20, 120], [140, 200], [280, 150]], [[60, -20], [90, 260], [40, 540]], [[-20, 380], [150, 330], [280, 420]], [[180, -20], [200, 300], [240, 540]]]
        .forEach((pts) => { g.beginPath(); g.moveTo(...pts[0]); g.quadraticCurveTo(...pts[1], ...pts[2]); g.stroke(); });
      g.strokeStyle = '#39A5F2';
      g.lineWidth = 12;
      g.beginPath(); g.moveTo(128, 470); g.bezierCurveTo(60, 380, 210, 300, 120, 170); g.lineTo(150, 80); g.stroke();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(128, 470, 16, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#39A5F2';
      g.beginPath(); g.arc(128, 470, 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.12)';
      g.fillRect(0, 0, w, 44);
    });

    /* ---------- Материалы ---------- */
    const std = (color, roughness, metalness, extra) =>
      new THREE.MeshStandardMaterial(Object.assign({ color, roughness, metalness }, extra || {}));

    const M = {
      // крашеная рама: сатиновая эмаль под лаком
      frame: new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(init.color || '#3FB7B4'), roughness: 0.38, metalness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3,
      }),
      rubber: std(0x17191c, 0.9, 0),
      ski: std(0x0d0e10, 0.62, 0.05, { envMapIntensity: 0.6 }),
      gloss: std(0x111316, 0.26, 0.35),
      motor: std(0x1b1e22, 0.55, 0.55),
      motorFin: std(0x2a2e33, 0.45, 0.7),
      alu: std(0xb9c1c9, 0.36, 0.9),
      wheel: std(0xd6dce1, 0.32, 0.45),
      hub: std(0x4a515a, 0.4, 0.8),
      bar: std(0x16181b, 0.42, 0.6),
      grip: std(0x0f1012, 0.85, 0),
      camo: std(0xffffff, 0.92, 0, { map: camoTex }),
      strap: std(0x0c0d0f, 0.75, 0),
      deck: std(0xffffff, 0.7, 0.35, { map: gripTex }),
      headlight: std(0xffffff, 0.2, 0, { emissive: 0xeaf6ff, emissiveIntensity: 2.2 }),
      tail: std(0x5a0000, 0.3, 0, { emissive: 0xe00000, emissiveIntensity: 1.6 }),
      red: std(0xc8102e, 0.4, 0.1),
      hv: std(0xff7a1a, 0.5, 0),
      display: new THREE.MeshBasicMaterial({ map: dispTex }),
      lens: std(0xffffff, 0.15, 0, { emissive: 0xf2fbff, emissiveIntensity: 3.2 }),
      led: std(0x39a5f2, 0.4, 0, { emissive: 0x39a5f2, emissiveIntensity: 3 }),
      guard: new THREE.MeshPhysicalMaterial({ color: 0xf1f4f7, roughness: 0.3, metalness: 0, clearcoat: 0.6, side: THREE.DoubleSide }),
      heat: std(0x3a1d12, 0.6, 0, { emissive: 0xff5a1f, emissiveIntensity: 0.9 }),
      heatLed: std(0x300000, 0.3, 0, { emissive: 0xff3b1f, emissiveIntensity: 3 }),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0xcfeaff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.3,
        side: THREE.DoubleSide, depthWrite: false, clearcoat: 1,
      }),
      trim: std(0x101215, 0.5, 0.2),
      phone: std(0x0d0f12, 0.3, 0.5),
      screen: new THREE.MeshBasicMaterial({ map: screenTex }),
      mat: std(0x131518, 0.95, 0),
      matRib: std(0x2c3035, 0.9, 0),
      box: std(0x17191d, 0.55, 0.15),
      brand: std(0x39a5f2, 0.4, 0.1),
      hitch: std(0x2c3138, 0.45, 0.6),
      chrome: std(0xe8edf2, 0.12, 1),
      beam: new THREE.MeshBasicMaterial({
        color: 0xd9ecff, transparent: true, opacity: 0, alphaMap: beamAlpha,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
      }),
    };

    // Камуфляж накладывается с трёх сторон сразу (по осям модели) — рисунок нигде не тянется.
    // Если шейдер не удастся дополнить, останется обычная развёртка.
    M.camo.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vTriPos;\nvarying vec3 vTriN;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTriPos = position;\nvTriN = normal;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vTriPos;\nvarying vec3 vTriN;')
        .replace('#include <map_fragment>', [
          'vec3 triW = pow(abs(normalize(vTriN)), vec3(4.0));',
          'triW /= (triW.x + triW.y + triW.z);',
          'vec3 triP = vTriPos * 2.1;',
          'vec4 sampledDiffuseColor = texture2D(map, triP.zy) * triW.x + texture2D(map, triP.xz) * triW.y + texture2D(map, triP.xy) * triW.z;',
          'diffuseColor *= sampledDiffuseColor;',
        ].join('\n'));
    };

    /* ---------- Помощники построения ---------- */
    const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 20);
    const unitSphere = new THREE.SphereGeometry(1, 20, 14);

    const bike = new THREE.Group();
    scene.add(bike);

    function mesh(geo, mat, parent, shadows = true) {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = shadows;
      m.receiveShadow = shadows;
      (parent || bike).add(m);
      return m;
    }
    function tube(a, b, r, mat, parent) {
      const m = mesh(unitCyl, mat || M.frame, parent);
      m.scale.set(r, a.distanceTo(b), r);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
      return m;
    }
    function joint(p, r, mat, parent) {
      const m = mesh(unitSphere, mat || M.frame, parent);
      m.position.copy(p);
      m.scale.setScalar(r);
      return m;
    }
    function box(w, h, d, mat, pos, parent) {
      const m = mesh(new THREE.BoxGeometry(w, h, d), mat, parent);
      m.position.copy(pos);
      return m;
    }
    function rbox(w, h, d, r, mat, pos, parent) {
      const m = mesh(new RoundedBoxGeometry(w, h, d, 4, r), mat, parent);
      m.position.copy(pos);
      return m;
    }
    function cyl(axis, r, len, mat, pos, parent, seg = 28) {
      const m = mesh(new THREE.CylinderGeometry(r, r, len, seg), mat, parent);
      m.position.copy(pos);
      if (axis === 'x') m.rotation.z = -Math.PI / 2;
      if (axis === 'z') m.rotation.x = Math.PI / 2;
      return m;
    }
    function curve(points, r, mat, parent, seg = 64) {
      const c = new THREE.CatmullRomCurve3(points);
      return mesh(new THREE.TubeGeometry(c, seg, r, 10, false), mat, parent);
    }
    // Труба по ломаной со скруглёнными углами
    function pipe(points, r, bend, mat, parent) {
      const path = new THREE.CurvePath();
      let prev = points[0].clone();
      for (let i = 1; i < points.length; i++) {
        const p = points[i];
        if (i < points.length - 1) {
          const dIn = p.clone().sub(points[i - 1]);
          const dOut = points[i + 1].clone().sub(p);
          const b = Math.min(bend, dIn.length() * 0.45, dOut.length() * 0.45);
          const a = p.clone().sub(dIn.normalize().multiplyScalar(b));
          const c = p.clone().add(dOut.normalize().multiplyScalar(b));
          path.add(new THREE.LineCurve3(prev, a));
          path.add(new THREE.QuadraticBezierCurve3(a, p.clone(), c));
          prev = c;
        } else {
          path.add(new THREE.LineCurve3(prev, p.clone()));
        }
      }
      const seg = Math.max(24, Math.ceil(path.getLength() / 0.012));
      return mesh(new THREE.TubeGeometry(path, seg, r, 12, false), mat || M.frame, parent);
    }
    function stadiumShape(h, R) {
      const s = new THREE.Shape();
      s.moveTo(-h, -R);
      s.lineTo(h, -R);
      s.absarc(h, 0, R, -Math.PI / 2, Math.PI / 2, false);
      s.lineTo(-h, R);
      s.absarc(-h, 0, R, Math.PI / 2, Math.PI * 1.5, false);
      return s;
    }
    // Сечение — скруглённый прямоугольник: полуширина hw по Z, от n0 до n1 по нормали (обход против часовой)
    function rrectSec(hw, n0, n1, r, k = 3) {
      r = Math.max(0.0005, Math.min(r, hw * 0.98, ((n1 - n0) / 2) * 0.98));
      const pts = [[0, n0]];   // обход начинается снизу по центру — там же шов текстуры
      const corners = [[hw - r, n0 + r, -Math.PI / 2], [hw - r, n1 - r, 0], [-hw + r, n1 - r, Math.PI / 2], [-hw + r, n0 + r, Math.PI]];
      for (const [cz, cn, a0] of corners) {
        for (let i = 0; i <= k; i++) {
          const a = a0 + ((Math.PI / 2) * i) / k;
          pts.push([cz + r * Math.cos(a), cn + r * Math.sin(a)]);
        }
      }
      return pts;
    }
    // Тело, протянутое вдоль линии в плоскости XY (симметрично относительно Z = 0).
    // path: [[x, y], …]; section(i) → [[z, n], …], где n откладывается по нормали к линии
    function sweepXY(path, section, uvScale = 1) {
      const pos = [], uv = [], idx = [], rings = [];
      const n = path.length;
      let K = 0, along = null;
      for (let i = 0; i < n; i++) {
        const a = path[Math.max(0, i - 1)], b = path[Math.min(n - 1, i + 1)];
        let tx = b[0] - a[0], ty = b[1] - a[1];
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl; ty /= tl;
        const nx = -ty, ny = tx;
        const sec = section(i);
        K = sec.length;
        const ring = [], around = [0];
        for (let j = 0; j <= K; j++) {
          const [z, h] = sec[j % K];
          if (j > 0) { const [pz, ph] = sec[j - 1]; around.push(around[j - 1] + Math.hypot(z - pz, h - ph)); }
          ring.push([path[i][0] + nx * h, path[i][1] + ny * h, z]);
        }
        // текстура: вдоль — по длине поверхности, поперёк — от верхней середины сечения
        if (!along) along = new Array(K + 1).fill(0);
        const prev = rings[i - 1];
        for (let j = 0; j <= K; j++) {
          const p = ring[j];
          if (prev) along[j] += Math.hypot(p[0] - prev[j][0], p[1] - prev[j][1], p[2] - prev[j][2]);
          pos.push(p[0], p[1], p[2]);
          uv.push(along[j] * uvScale, (around[j] - around[K] / 2) * uvScale);
        }
        rings.push(ring);
      }
      const S = K + 1;
      for (let i = 0; i < n - 1; i++) {
        for (let j = 0; j < K; j++) {
          const a = i * S + j, b = (i + 1) * S + j, c = (i + 1) * S + j + 1, d = i * S + j + 1;
          idx.push(a, b, d, b, c, d);
        }
      }
      // торцы — отдельными вершинами, чтобы грань была чёткой
      for (const [ri, flip] of [[0, false], [n - 1, true]]) {
        const ring = rings[ri];
        const base = pos.length / 3;
        let cx = 0, cy = 0, cz = 0;
        for (let j = 0; j < K; j++) { cx += ring[j][0]; cy += ring[j][1]; cz += ring[j][2]; }
        pos.push(cx / K, cy / K, cz / K);
        uv.push(0, 0);
        for (let j = 0; j < K; j++) { pos.push(ring[j][0], ring[j][1], ring[j][2]); uv.push(0, 0); }
        for (let j = 0; j < K; j++) {
          const p = base + 1 + j, q = base + 1 + ((j + 1) % K);
          if (flip) idx.push(base, q, p); else idx.push(base, p, q);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      // сгладить шов по замыканию сечения
      const nrm = g.attributes.normal;
      for (let i = 0; i < n; i++) {
        const a = i * S, b = i * S + K;
        const x = nrm.getX(a) + nrm.getX(b), y = nrm.getY(a) + nrm.getY(b), z = nrm.getZ(a) + nrm.getZ(b);
        const l = Math.hypot(x, y, z) || 1;
        nrm.setXYZ(a, x / l, y / l, z / l);
        nrm.setXYZ(b, x / l, y / l, z / l);
      }
      return g;
    }
    // Треугольное окно со скруглёнными углами (для боковин рамы)
    function roundedTri(pts, inset, cut) {
      const [p0, p1, p2] = pts;
      const a = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
      const b = Math.hypot(p0[0] - p2[0], p0[1] - p2[1]);
      const c = Math.hypot(p0[0] - p1[0], p0[1] - p1[1]);
      const per = a + b + c;
      const ix = (a * p0[0] + b * p1[0] + c * p2[0]) / per;
      const iy = (a * p0[1] + b * p1[1] + c * p2[1]) / per;
      const area = Math.abs((p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1])) / 2;
      const rin = (2 * area) / per;
      const f = (rin - inset) / rin;
      if (f < 0.25) return null;
      const q = pts.map(([x, y]) => [ix + (x - ix) * f, iy + (y - iy) * f]);
      const path = new THREE.Path();
      for (let i = 0; i < 3; i++) {
        const prev = q[(i + 2) % 3], cur = q[i], next = q[(i + 1) % 3];
        const l1 = Math.hypot(prev[0] - cur[0], prev[1] - cur[1]);
        const l2 = Math.hypot(next[0] - cur[0], next[1] - cur[1]);
        const k = Math.min(cut, l1 * 0.4, l2 * 0.4);
        const A = [cur[0] + ((prev[0] - cur[0]) / l1) * k, cur[1] + ((prev[1] - cur[1]) / l1) * k];
        const B = [cur[0] + ((next[0] - cur[0]) / l2) * k, cur[1] + ((next[1] - cur[1]) / l2) * k];
        if (i === 0) path.moveTo(A[0], A[1]); else path.lineTo(A[0], A[1]);
        path.quadraticCurveTo(cur[0], cur[1], B[0], B[1]);
      }
      path.closePath();
      return path;
    }

    /* ==========================================================
       БАЗОВАЯ МОДЕЛЬ
       ========================================================== */

    // ---- Опорные размеры ----
    const FZ = 0.25;                         // полуширина рамы
    const YB = 0.165, YT = 0.335;            // низ и верх боковин
    const XR = -1.24, XF = -0.06;            // зад и перед боковин
    const DECK = 0.352;                      // верх платформы
    const RACK_Y = 0.445;                    // высота задней дуги
    const REAR = V(-1.36, RACK_Y, 0);        // задняя точка дуги
    const COL0 = V(0.655, 0.115, 0);         // низ рулевой колонки (шарнир лыжи)
    const H = V(0.03, 1.07, 0);              // центр руля
    const colAt = (t) => COL0.clone().lerp(H, t);
    const COL_DIR = H.clone().sub(COL0).normalize();
    const COL_LEN = COL0.distanceTo(H);

    // ---- Гусеница ----
    const TR = { cx: -0.80, cy: 0.118, h: 0.43, R: 0.105, W: 0.38, t: 0.022 };
    {
      const outer = stadiumShape(TR.h, TR.R);
      outer.holes.push(stadiumShape(TR.h, TR.R - TR.t));
      const geo = new THREE.ExtrudeGeometry(outer, { depth: TR.W, bevelEnabled: false, curveSegments: 28 });
      geo.translate(0, 0, -TR.W / 2);
      mesh(geo, M.rubber).position.set(TR.cx, TR.cy, 0);

      // грунтозацепы «ёлочкой» по периметру
      const P = 4 * TR.h + 2 * Math.PI * TR.R;
      const at = (s) => {
        const { h, R } = TR;
        s = ((s % P) + P) % P;
        if (s < 2 * h) return [h - s, -R, 0, -1];
        s -= 2 * h;
        if (s < Math.PI * R) { const a = -Math.PI / 2 - s / R; return [-h + R * Math.cos(a), R * Math.sin(a), Math.cos(a), Math.sin(a)]; }
        s -= Math.PI * R;
        if (s < 2 * h) return [-h + s, R, 0, 1];
        s -= 2 * h;
        const a = Math.PI / 2 - s / R;
        return [h + R * Math.cos(a), R * Math.sin(a), Math.cos(a), Math.sin(a)];
      };
      const count = Math.floor(P / 0.056);
      const half = TR.W * 0.49;
      const o = new THREE.Object3D();
      o.rotation.order = 'ZYX';
      for (const sgn of [1, -1]) {
        const lugGeo = new THREE.BoxGeometry(0.024, 0.014, half);
        lugGeo.translate(0, 0, (sgn * half) / 2);
        const lugs = new THREE.InstancedMesh(lugGeo, M.rubber, count);
        lugs.castShadow = true;
        for (let i = 0; i < count; i++) {
          const [x, y, nx, ny] = at((i * P) / count);
          o.position.set(TR.cx + x + nx * 0.006, TR.cy + y + ny * 0.006, 0);
          o.rotation.set(0, sgn * 0.2, Math.atan2(ny, nx) - Math.PI / 2);
          o.updateMatrix();
          lugs.setMatrixAt(i, o.matrix);
        }
        bike.add(lugs);
      }

      // катки: резиновая шина, светлый диск, ступица
      const wheel = (x, y, z, r, w) => {
        cyl('z', r, w, M.rubber, V(x, y, z), null, 32);
        cyl('z', r * 0.78, w + 0.006, M.wheel, V(x, y, z), null, 32);
        cyl('z', r * 0.58, w + 0.009, M.hub, V(x, y, z), null, 32);
        cyl('z', r * 0.5, w + 0.012, M.wheel, V(x, y, z), null, 32);
        cyl('z', r * 0.24, w + 0.018, M.hub, V(x, y, z));
      };
      const wy = TR.cy - (TR.R - TR.t) + 0.055;
      const wz = 0.145;
      // три балансирные тележки по два катка
      for (const bx of [-1.06, -0.80, -0.54]) {
        for (const s of [-1, 1]) {
          for (const dx of [-0.064, 0.064]) wheel(bx + dx, wy, s * wz, 0.055, 0.03);
          rbox(0.17, 0.05, 0.008, 0.004, M.frame, V(bx, wy + 0.015, s * (wz + 0.026)));
          rbox(0.042, 0.105, 0.01, 0.004, M.frame, V(bx, 0.14, s * FZ));
          cyl('z', 0.013, 0.012, M.alu, V(bx, wy + 0.035, s * (FZ + 0.01)));
        }
        cyl('z', 0.009, 2 * FZ, M.hub, V(bx, wy + 0.035, 0));
        for (const dx of [-0.064, 0.064]) cyl('z', 0.006, 2 * (wz + 0.03), M.hub, V(bx + dx, wy, 0));
      }
      // ведущая звезда спереди и натяжной каток сзади
      for (const x of [TR.cx - TR.h, TR.cx + TR.h]) {
        for (const s of [-1, 1]) {
          wheel(x, TR.cy, s * wz, TR.R - TR.t - 0.003, 0.03);
          rbox(0.075, 0.1, 0.01, 0.004, M.frame, V(x, TR.cy + 0.035, s * FZ));
          cyl('z', 0.016, 0.012, M.alu, V(x, TR.cy, s * (FZ + 0.011)));
        }
        cyl('z', 0.011, 2 * FZ + 0.01, M.hub, V(x, TR.cy, 0));
      }
    }

    // ---- Рама: боковины с треугольными окнами ----
    {
      const sh = new THREE.Shape();
      const r = 0.012;
      sh.moveTo(XR + r, YB); sh.lineTo(XF - r, YB); sh.quadraticCurveTo(XF, YB, XF, YB + r);
      sh.lineTo(XF, YT - r); sh.quadraticCurveTo(XF, YT, XF - r, YT);
      sh.lineTo(XR + r, YT); sh.quadraticCurveTo(XR, YT, XR, YT - r);
      sh.lineTo(XR, YB + r); sh.quadraticCurveTo(XR, YB, XR + r, YB);

      const a = YB + 0.027, b = YT - 0.027;
      const xs0 = XR + 0.03, xs1 = XF - 0.03;
      const count = Math.round((xs1 - xs0) / 0.095);
      const step = (xs1 - xs0) / count;
      const node = (k) => [xs0 + k * step, k % 2 === 0 ? a : b];
      const wins = [[node(0), [xs0, b], node(1)]];
      for (let k = 0; k + 2 <= count; k++) wins.push([node(k), node(k + 1), node(k + 2)]);
      wins.push([node(count - 1), node(count), [xs1, node(count - 1)[1]]]);
      for (const w of wins) { const hole = roundedTri(w, 0.011, 0.02); if (hole) sh.holes.push(hole); }

      const geo = new THREE.ExtrudeGeometry(sh, {
        depth: 0.02, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 6,
      });
      geo.translate(0, 0, -0.01);
      const mid = (XR + XF) / 2, len = XF - XR + 0.012;
      for (const s of [-1, 1]) {
        mesh(geo, M.frame).position.z = s * FZ;
        rbox(len, 0.03, 0.036, 0.008, M.frame, V(mid, YT - 0.011, s * FZ));
        rbox(len, 0.028, 0.034, 0.008, M.frame, V(mid, YB + 0.01, s * FZ));
      }

      // болты в узлах
      const boltGeo = new THREE.CylinderGeometry(0.0065, 0.0065, 0.008, 10);
      boltGeo.rotateX(Math.PI / 2);
      const bolts = new THREE.InstancedMesh(boltGeo, M.alu, (count + 1) * 2);
      const o = new THREE.Object3D();
      let bi = 0;
      for (let k = 0; k <= count; k++) {
        for (const s of [-1, 1]) {
          o.position.set(node(k)[0], k % 2 === 0 ? YB + 0.01 : YT - 0.011, s * (FZ + 0.019));
          o.updateMatrix();
          bolts.setMatrixAt(bi++, o.matrix);
        }
      }
      bike.add(bolts);

      // тёмные стенки тоннеля гусеницы — за окнами боковин
      for (const s of [-1, 1]) box(XF - XR - 0.05, YT - YB - 0.03, 0.004, M.trim, V(mid, (YB + YT) / 2, s * (FZ - 0.03)));

      // поперечины под платформой и задняя стенка
      for (const x of [XR + 0.03, -0.92, -0.62, -0.32, XF - 0.03]) tube(V(x, YT - 0.012, -FZ), V(x, YT - 0.012, FZ), 0.012);
      rbox(0.012, 0.085, 2 * FZ, 0.004, M.frame, V(XR - 0.002, YT - 0.045, 0));

      // передняя часть: трубы к рулевой голове (большей частью под чехлом)
      for (const s of [-1, 1]) {
        tube(V(XF - 0.01, YB + 0.012, s * FZ), V(0.5, 0.25, s * 0.03), 0.015);
        tube(V(XF - 0.01, YT - 0.012, s * FZ), V(0.4, 0.46, s * 0.03), 0.015);
        joint(V(XF - 0.01, YB + 0.012, s * FZ), 0.017);
        joint(V(XF - 0.01, YT - 0.012, s * FZ), 0.018);
      }
      tube(colAt(0.1), colAt(0.37), 0.036);

      // платформа для ног из рифлёного листа и площадка под мотор
      box(0.95, 0.012, 2 * FZ + 0.03, M.deck, V(-0.765, DECK - 0.006, 0));
      rbox(0.3, 0.012, 2 * FZ + 0.03, 0.004, M.trim, V(-0.145, DECK - 0.006, 0));
      for (const s of [-1, 1]) {
        for (const x of [-1.2, -0.9, -0.6, -0.33]) cyl('y', 0.007, 0.004, M.alu, V(x, DECK + 0.001, s * 0.235), null, 12);
      }

      // задняя дуга-бампер с фонарём
      pipe([
        V(-0.96, YT + 0.008, -FZ), V(-1.07, RACK_Y, -FZ), V(REAR.x, RACK_Y, -FZ),
        V(REAR.x, RACK_Y, FZ), V(-1.07, RACK_Y, FZ), V(-0.96, YT + 0.008, FZ),
      ], 0.015, 0.07);
      for (const s of [-1, 1]) {
        tube(V(-1.22, YT, s * FZ), V(-1.22, RACK_Y, s * FZ), 0.012);
        tube(V(XR + 0.005, YB + 0.012, s * FZ), V(REAR.x + 0.012, RACK_Y - 0.01, s * FZ), 0.013);
      }
      box(0.03, 0.045, 0.16, M.trim, V(REAR.x - 0.004, RACK_Y - 0.042, 0));
      box(0.02, 0.033, 0.14, M.tail, V(REAR.x - 0.014, RACK_Y - 0.042, 0));
    }

    // ---- Кожух привода (слева по ходу) ----
    {
      const cx = -0.07, cy = 0.275, zc = -(FZ + 0.062);
      const geo = new THREE.ExtrudeGeometry(stadiumShape(0.19, 0.105), {
        depth: 0.04, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 4, curveSegments: 28,
      });
      mesh(geo, M.gloss).position.set(cx, cy, zc);
      const inner = new THREE.ExtrudeGeometry(stadiumShape(0.19, 0.078), { depth: 0.004, bevelEnabled: false, curveSegments: 28 });
      mesh(inner, M.motor).position.set(cx, cy, zc - 0.0115);
      for (const dx of [-0.19, 0, 0.19]) {
        for (const dy of [-0.092, 0.092]) cyl('z', 0.007, 0.006, M.alu, V(cx + dx, cy + dy, zc - 0.009), null, 12);
      }
      for (const dx of [-0.19, 0.19]) cyl('z', 0.026, 0.008, M.hub, V(cx + dx, cy, zc - 0.014));
    }

    // ---- Электромотор с контроллером ----
    {
      rbox(0.25, 0.105, 0.24, 0.018, M.motor, V(-0.145, 0.405, 0));
      // оребрённый корпус
      box(0.1, 0.085, 0.13, M.motor, V(-0.085, 0.498, 0));
      for (let i = 0; i < 6; i++) rbox(0.135, 0.007, 0.17, 0.003, M.motorFin, V(-0.085, 0.463 + i * 0.014, 0));
      rbox(0.12, 0.022, 0.15, 0.008, M.gloss, V(-0.085, 0.551, 0));
      // блок контроллера
      rbox(0.115, 0.088, 0.22, 0.022, M.gloss, V(-0.207, 0.502, 0));
      cyl('y', 0.02, 0.012, M.alu, V(-0.207, 0.55, 0.05));
      cyl('y', 0.008, 0.01, M.red, V(-0.207, 0.55, -0.06), null, 14);
      // торцевая крышка справа: кольцо и вентиляционные прорези
      const ex = -0.15, ey = 0.418, ez = 0.14;
      cyl('z', 0.076, 0.04, M.motor, V(ex, ey, ez), null, 40);
      const ring = mesh(new THREE.TorusGeometry(0.064, 0.006, 10, 40), M.alu);
      ring.position.set(ex, ey, ez + 0.02);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        const slot = box(0.024, 0.007, 0.004, M.hub, V(ex + 0.04 * Math.cos(a), ey + 0.04 * Math.sin(a), ez + 0.021));
        slot.rotation.z = a;
      }
      cyl('z', 0.02, 0.012, M.gloss, V(ex, ey, ez + 0.022));
      // силовой кабель от батареи к контроллеру
      curve([V(0.0, 0.5, 0.1), V(-0.06, 0.565, 0.115), V(-0.13, 0.585, 0.1), V(-0.19, 0.55, 0.085)], 0.007, M.hv, null, 24);
    }

    // ---- Батарейный отсек под камуфляжным чехлом ----
    {
      // сечения вдоль чехла: x, низ, верх, полуширина
      const BAG = [
        [-0.04, 0.25, 0.545, 0.165],
        [-0.028, 0.2, 0.605, 0.205],
        [0.02, 0.172, 0.638, 0.224],
        [0.09, 0.16, 0.648, 0.228],
        [0.18, 0.153, 0.636, 0.216],
        [0.27, 0.148, 0.6, 0.19],
        [0.36, 0.144, 0.528, 0.155],
        [0.42, 0.142, 0.478, 0.13],
        [0.48, 0.14, 0.415, 0.103],
        [0.54, 0.141, 0.325, 0.074],
        [0.595, 0.147, 0.232, 0.042],
        [0.628, 0.16, 0.185, 0.014],
      ];
      const c1 = new THREE.CatmullRomCurve3(BAG.map(([x, lo, hi]) => V(x, lo, hi)));
      const c2 = new THREE.CatmullRomCurve3(BAG.map(([x, , , w]) => V(x, w, 0)));
      c1.curveType = c2.curveType = 'catmullrom';
      const bagAt = (t) => { const p = c1.getPoint(t), q = c2.getPoint(t); return { x: p.x, lo: p.y, hi: p.z, w: Math.max(0.01, q.y) }; };
      const secOf = (s, grow = 0) => rrectSec(s.w + grow, s.lo - grow, s.hi + grow, Math.min(s.w, (s.hi - s.lo) / 2) * 0.62 + grow, 5);

      const N = 44;
      const st = Array.from({ length: N }, (_, i) => bagAt(i / (N - 1)));
      mesh(sweepXY(st.map((s) => [s.x, 0]), (i) => secOf(st[i]), 2.1), M.camo);

      // стяжные ремни с пряжками
      for (const t of [0.3, 0.52]) {
        const s = bagAt(t);
        mesh(sweepXY([[s.x - 0.014, 0], [s.x + 0.014, 0]], () => secOf(s, 0.005)), M.strap);
        rbox(0.034, 0.026, 0.008, 0.003, M.alu, V(s.x, (s.lo + s.hi) / 2 + 0.03, -(s.w + 0.007)));
      }
      // кант по верхнему шву
      curve(st.filter((_, i) => i % 3 === 0 && i > 2).map((s) => V(s.x, s.hi + 0.001, 0)), 0.006, M.strap, null, 80);
    }

    // ---- Рулевая колонка: профиль с облегчающими окнами ----
    {
      const u0 = 0.06 * COL_LEN, u1 = 0.985 * COL_LEN, hv = 0.025;
      const sh = new THREE.Shape();
      sh.moveTo(u0, -hv); sh.lineTo(u1, -hv); sh.lineTo(u1, hv); sh.lineTo(u0, hv); sh.closePath();
      for (let u = 0.42 * COL_LEN; u < u1 - 0.06; u += 0.082) {
        const slot = new THREE.Path();
        const a = 0.02, r = 0.0115;
        slot.moveTo(u - a, -r); slot.lineTo(u + a, -r); slot.absarc(u + a, 0, r, -Math.PI / 2, Math.PI / 2, false);
        slot.lineTo(u - a, r); slot.absarc(u - a, 0, r, Math.PI / 2, Math.PI * 1.5, false);
        sh.holes.push(slot);
      }
      const geo = new THREE.ExtrudeGeometry(sh, {
        depth: 0.034, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 8,
      });
      geo.translate(0, 0, -0.017);
      const beam = mesh(geo, M.frame);
      beam.position.copy(COL0);
      beam.rotation.z = Math.atan2(COL_DIR.y, COL_DIR.x);

      // манжета на выходе из чехла, хомут руля
      const boot = cyl('y', 0.046, 0.04, M.strap, colAt(0.385));
      boot.quaternion.setFromUnitVectors(UP, COL_DIR);
      const clamp = rbox(0.075, 0.06, 0.072, 0.012, M.trim, colAt(0.972));
      clamp.quaternion.setFromUnitVectors(UP, COL_DIR);
    }

    // ---- Руль: накладка-обтекатель с фарой, ручки, рычаги, экран ----
    {
      tube(V(H.x, H.y, -0.43), V(H.x, H.y, 0.43), 0.0125, M.bar);
      rbox(0.05, 0.046, 0.11, 0.01, M.trim, H);

      const pad = mesh(new THREE.CapsuleGeometry(0.042, 0.34, 8, 28), M.gloss);
      pad.rotation.x = Math.PI / 2;
      pad.scale.set(1.35, 1, 0.6);
      pad.position.set(H.x - 0.004, H.y + 0.016, 0);
      cyl('x', 0.026, 0.02, M.gloss, V(H.x + 0.056, H.y + 0.012, 0));
      cyl('x', 0.021, 0.006, M.headlight, V(H.x + 0.067, H.y + 0.012, 0));

      for (const s of [-1, 1]) {
        cyl('z', 0.02, 0.125, M.grip, V(H.x, H.y, s * 0.345));
        for (let i = 0; i < 4; i++) cyl('z', 0.0213, 0.006, M.grip, V(H.x, H.y, s * (0.305 + i * 0.027)));
        cyl('z', 0.026, 0.008, M.grip, V(H.x, H.y, s * 0.279));
        cyl('z', 0.022, 0.012, M.alu, V(H.x, H.y, s * 0.414));
        // рычаг с кронштейном
        rbox(0.032, 0.03, 0.022, 0.006, M.trim, V(H.x + 0.012, H.y - 0.004, s * 0.258));
        curve([
          V(H.x + 0.026, H.y - 0.006, s * 0.258), V(H.x + 0.052, H.y - 0.012, s * 0.295),
          V(H.x + 0.058, H.y - 0.014, s * 0.355), V(H.x + 0.05, H.y - 0.014, s * 0.412),
        ], 0.005, M.bar, null, 24);
        joint(V(H.x + 0.05, H.y - 0.014, s * 0.412), 0.008, M.bar);
      }
      // ручка газа справа, красная кнопка «стоп» на накладке
      cyl('z', 0.024, 0.03, M.trim, V(H.x, H.y, 0.238));
      cyl('y', 0.009, 0.012, M.red, V(H.x - 0.012, H.y + 0.043, 0.13), null, 14);

      // экран по центру
      const disp = new THREE.Group();
      disp.position.set(H.x - 0.03, H.y + 0.06, 0);
      disp.rotation.z = -1.0;
      bike.add(disp);
      rbox(0.014, 0.05, 0.082, 0.005, M.gloss, V(0.004, 0, 0), disp);
      const scr = mesh(new THREE.PlaneGeometry(0.068, 0.038), M.display, disp, false);
      scr.position.set(-0.0036, 0, 0);
      scr.rotation.y = -Math.PI / 2;
    }

    // ---- Тросы: от руля к мотору и вдоль колонки ----
    curve([V(H.x - 0.03, H.y - 0.012, 0.06), V(-0.085, 0.93, 0.075), V(-0.125, 0.78, 0.08), V(-0.115, 0.64, 0.07), V(-0.09, 0.565, 0.05)], 0.0055, M.strap);
    curve([
      V(H.x + 0.014, H.y - 0.02, -0.25), V(H.x + 0.05, H.y - 0.11, -0.12),
      colAt(0.8).add(V(0.035, 0.01, -0.035)), colAt(0.56).add(V(0.04, 0.012, -0.03)), colAt(0.4).add(V(0.02, 0, -0.025)),
    ], 0.0045, M.strap);

    // ---- Лыжа с загнутым носом-петлёй ----
    {
      const SK = { xb: 1.33, R: 0.16, hw: 0.15, t: 0.02 };
      const arc = (r, deg) => [SK.xb + r * Math.sin(rad(deg)), SK.R - r * Math.cos(rad(deg))];

      // чёрная основа: плоская часть и нос, загнутый вверх и назад
      const path = [], hw = [];
      for (const [x, y, w] of [[0.38, 0.016, 0.105], [0.4, 0.008, 0.125], [0.43, 0.003, 0.14], [0.47, 0, 0.148]]) { path.push([x, y]); hw.push(w); }
      for (let i = 0; i < 9; i++) { path.push([0.55 + i * 0.09, 0]); hw.push(SK.hw); }
      for (let d = 0; d <= 140; d += 7) {
        path.push(arc(SK.R, d));
        hw.push((SK.hw - 0.055 * smooth(d / 140)) * (d > 133 ? 0.74 : d > 126 ? 0.93 : 1));
      }
      mesh(sweepXY(path, (i) => rrectSec(hw[i], 0, SK.t, 0.008, 2)), M.ski);

      // цветная лента по лыже, переходящая в петлю и тягу к шарниру
      const bp = [], bs = [];
      for (let i = 0; i < 9; i++) { bp.push([0.44 + i * 0.11, SK.t]); bs.push([0.05, 0.012]); }
      const rIn = SK.R - SK.t;
      for (let d = 0; d <= 195; d += 7.5) {
        bp.push(arc(rIn, d));
        const f = smooth((d - 70) / 125);
        bs.push([0.05 - 0.03 * f, 0.012 + 0.02 * f]);
      }
      const A = arc(rIn, 195), E = [0.69, 0.133];
      for (let k = 1; k <= 6; k++) { bp.push([A[0] + ((E[0] - A[0]) * k) / 6, A[1] + ((E[1] - A[1]) * k) / 6]); bs.push([0.02, 0.032]); }
      mesh(sweepXY(bp, (i) => rrectSec(bs[i][0], 0, bs[i][1], Math.min(bs[i][0], bs[i][1] / 2) * 0.9, 3)), M.frame);

      // опора лыжи: плита, щёки, ось, корпус шарнира, отбойник
      rbox(0.24, 0.012, 0.17, 0.004, M.gloss, V(0.655, 0.038, 0));
      for (const s of [-1, 1]) {
        rbox(0.11, 0.075, 0.008, 0.003, M.frame, V(0.667, 0.08, s * 0.046));
        for (const dx of [-0.095, 0.095]) cyl('y', 0.007, 0.006, M.alu, V(0.655 + dx, 0.046, s * 0.065), null, 12);
      }
      cyl('z', 0.011, 0.118, M.alu, V(0.674, 0.088, 0));
      tube(colAt(-0.03), colAt(0.075), 0.031);
      rbox(0.05, 0.03, 0.06, 0.008, M.rubber, V(0.585, 0.058, 0));
    }

    /* ==========================================================
       ОПЦИИ — появляются на модели
       ========================================================== */
    const parts = {};

    function addPart(id, group, pivot) {
      if (!pivot) pivot = new THREE.Box3().setFromObject(group).getCenter(new THREE.Vector3());
      group.children.forEach((ch) => ch.position.sub(pivot));
      group.position.copy(pivot);
      group.visible = false;
      group.scale.setScalar(0.0001);
      bike.add(group);
      parts[id] = { group, level: 0, target: 0 };
    }

    // Свет опций живёт в сцене всегда (интенсивность 0) — чтобы не перекомпилировать шейдеры
    const spot = new THREE.SpotLight(0xeaf4ff, 0, 7, 0.5, 0.6, 1.6);
    spot.position.set(H.x + 0.12, H.y - 0.06, 0);
    spot.target.position.set(2.2, 0, 0);
    scene.add(spot, spot.target);
    const SPOT_MAX = 16;

    const ledLights = [-1, 1].map((s) => {
      const l = new THREE.PointLight(0x39a5f2, 0, 1.6, 2);
      l.position.set(-0.65, 0.12, s * 0.36);
      scene.add(l);
      return l;
    });
    const LED_MAX = 2.2;

    // 1. Мощные LED-фонари на руль
    {
      const g = new THREE.Group();
      const beamGeo = new THREE.ConeGeometry(0.42, 2.0, 32, 1, true);
      beamGeo.translate(0, -1.0, 0);
      for (const s of [-1, 1]) {
        const x = H.x + 0.07, y = H.y - 0.055, z = s * 0.16;
        cyl('x', 0.034, 0.075, M.gloss, V(x, y, z), g);
        cyl('x', 0.029, 0.006, M.lens, V(x + 0.04, y, z), g);
        const ring = mesh(new THREE.TorusGeometry(0.031, 0.004, 8, 32), M.alu, g);
        ring.position.set(x + 0.038, y, z);
        ring.rotation.y = Math.PI / 2;
        tube(V(H.x, H.y - 0.01, z), V(x - 0.01, y + 0.02, z), 0.008, M.alu, g);
        const beam = mesh(beamGeo, M.beam, g, false);
        beam.position.set(x + 0.045, y, z);
        beam.quaternion.setFromUnitVectors(V(0, -1, 0), V(1, -0.28, s * 0.06).normalize());
      }
      addPart('lights', g, V(H.x + 0.07, H.y - 0.055, 0));
    }

    // 2. LED-подсветка рамы
    {
      const g = new THREE.Group();
      for (const s of [-1, 1]) {
        box(XF - XR - 0.04, 0.012, 0.012, M.led, V((XR + XF) / 2, YB - 0.011, s * (FZ + 0.013)), g);
        box(0.25, 0.01, 0.01, M.led, V(-1.2, RACK_Y - 0.021, s * FZ), g);
      }
      addPart('frameLed', g);
    }

    // 3. Защита рук
    {
      const g = new THREE.Group();
      // изогнутый щиток (полуцилиндр) перед ручкой
      const shellGeo = new THREE.CylinderGeometry(0.078, 0.062, 0.12, 36, 1, true, 0, Math.PI);
      for (const s of [-1, 1]) {
        const sh = mesh(shellGeo, M.guard, g);
        sh.position.set(H.x + 0.008, H.y + 0.012, s * 0.35);
        sh.scale.set(1.05, 1, 1.0);
        curve([V(H.x, H.y, s * 0.27), V(H.x + 0.05, H.y, s * 0.28), V(H.x + 0.088, H.y, s * 0.34), V(H.x + 0.07, H.y, s * 0.41), V(H.x, H.y, s * 0.416)], 0.008, M.alu, g, 32);
      }
      addPart('handguards', g);
    }

    // 4. Подогрев ручек
    {
      const g = new THREE.Group();
      for (const s of [-1, 1]) cyl('z', 0.0228, 0.11, M.heat, V(H.x, H.y, s * 0.345), g);
      rbox(0.032, 0.022, 0.04, 0.006, M.gloss, V(H.x - 0.03, H.y + 0.04, -0.19), g);
      joint(V(H.x - 0.03, H.y + 0.053, -0.19), 0.007, M.heatLed, g);
      addPart('heatedGrips', g, V(H.x, H.y, 0));
    }

    // 5. Ветровое стекло
    {
      const g = new THREE.Group();
      const pivot = new THREE.Group();
      pivot.position.set(H.x + 0.07, H.y + 0.035, 0);
      pivot.rotation.z = 0.32;
      g.add(pivot);
      const R = 0.5, th = 0.95, hgt = 0.2;
      const glass = mesh(new THREE.CylinderGeometry(R, R, hgt, 40, 1, true, Math.PI / 2 - th / 2, th), M.glass, pivot, false);
      glass.position.set(-R, hgt / 2, 0);
      for (const y of [0.004, hgt]) {
        const pts = [];
        for (let i = 0; i <= 20; i++) {
          const a = Math.PI / 2 - th / 2 + (th * i) / 20;
          pts.push(V(-R + R * Math.sin(a), y, R * Math.cos(a)));
        }
        curve(pts, 0.005, M.trim, pivot, 40);
      }
      addPart('windscreen', g, V(H.x + 0.05, H.y + 0.11, 0));
    }

    // 6. Держатель телефона (справа от экрана)
    {
      const g = new THREE.Group();
      const pz = 0.125;
      tube(V(H.x - 0.02, H.y + 0.03, pz), V(H.x - 0.058, H.y + 0.16, pz), 0.008, M.alu, g);
      const ph = new THREE.Group();
      ph.position.set(H.x - 0.07, H.y + 0.17, pz);
      ph.rotation.z = -0.5;
      g.add(ph);
      rbox(0.016, 0.165, 0.088, 0.006, M.gloss, V(0.006, 0, 0), ph);
      rbox(0.01, 0.15, 0.072, 0.004, M.phone, V(-0.005, 0, 0), ph);
      const scr = mesh(new THREE.PlaneGeometry(0.064, 0.138), M.screen, ph, false);
      scr.position.set(-0.0105, 0, 0);
      scr.rotation.y = -Math.PI / 2;
      addPart('phoneMount', g, V(H.x - 0.03, H.y + 0.03, pz));
    }

    // 7. Резиновый коврик платформы
    {
      const g = new THREE.Group();
      box(0.86, 0.008, 0.44, M.mat, V(-0.76, DECK + 0.004, 0), g);
      for (let i = 0; i < 18; i++) box(0.012, 0.006, 0.4, M.matRib, V(-1.16 + i * 0.047, DECK + 0.011, 0), g);
      addPart('deckMat', g);
    }

    // 8. Задний кофр на дуге
    {
      const g = new THREE.Group();
      const by = RACK_Y + 0.157;
      box(0.3, 0.012, 0.46, M.alu, V(-1.21, RACK_Y + 0.021, 0), g);
      rbox(0.3, 0.26, 0.46, 0.035, M.box, V(-1.21, by, 0), g);
      for (const s of [-1, 1]) box(0.24, 0.035, 0.004, M.brand, V(-1.21, by, s * 0.231), g);
      box(0.004, 0.035, 0.4, M.brand, V(-1.362, by, 0), g);
      box(0.008, 0.03, 0.07, M.alu, V(-1.363, by + 0.085, 0), g);
      addPart('rearBox', g);
    }

    // 9. Сцепка для саней
    {
      const g = new THREE.Group();
      box(0.24, 0.03, 0.035, M.hitch, V(-1.36, 0.275, 0), g);
      for (const s of [-1, 1]) tube(V(XR, YB + 0.05, s * (FZ - 0.02)), V(-1.4, 0.275, s * 0.02), 0.01, M.hitch, g);
      box(0.06, 0.012, 0.06, M.hitch, V(-1.47, 0.296, 0), g);
      cyl('y', 0.012, 0.04, M.chrome, V(-1.47, 0.32, 0), g);
      joint(V(-1.47, 0.355, 0), 0.026, M.chrome, g);
      addPart('towHitch', g);
    }

    /* ---------- Пол, круг-подиум, снег ---------- */
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(30, 96),
      new THREE.MeshStandardMaterial({ map: floorTex, color: 0x70757c, roughness: 0.95, metalness: 0, envMapIntensity: 0.25 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.05, 2.07, 160),
      new THREE.MeshBasicMaterial({ color: 0x39a5f2, transparent: true, opacity: 0.35, fog: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.002;
    scene.add(ring);

    const SNOW = isSmall ? 260 : 520;
    const snowPos = new Float32Array(SNOW * 3);
    const snowVel = new Float32Array(SNOW);
    for (let i = 0; i < SNOW; i++) {
      snowPos[i * 3] = (Math.random() - 0.5) * 9;
      snowPos[i * 3 + 1] = Math.random() * 4;
      snowPos[i * 3 + 2] = (Math.random() - 0.5) * 9;
      snowVel[i] = 0.12 + Math.random() * 0.22;
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({
      size: 0.035, map: dotTex, transparent: true, opacity: 0.8, depthWrite: false, color: 0xffffff,
    }));
    scene.add(snow);

    /* ---------- Камера и управление ---------- */
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 0.9;
    controls.maxDistance = 9;
    controls.maxPolarAngle = Math.PI * 0.485;
    controls.rotateSpeed = 0.75;
    controls.zoomSpeed = 0.85;
    controls.autoRotate = !reduceMotion;
    controls.autoRotateSpeed = 0.8;

    // Ракурсы: общий — спереди слева, как на фото и рендерах (кожух привода на виду)
    const VIEWS = {
      home:        { t: V(0.05, 0.42, 0),           d: V(0.5, 0.26, -0.82),   r: 4.7 },
      lights:      { t: V(0.6, 0.7, 0),             d: V(0.62, 0.32, -0.72),  r: 3.1 },
      frameLed:    { t: V(-0.6, 0.25, 0),           d: V(-0.3, 0.3, -0.9),    r: 2.9 },
      handguards:  { t: V(H.x + 0.02, H.y - 0.02, 0), d: V(0.62, 0.42, -0.66),  r: 1.35 },
      heatedGrips: { t: V(H.x, H.y - 0.02, 0),      d: V(-0.68, 0.55, -0.48), r: 1.3 },
      windscreen:  { t: V(H.x + 0.06, H.y + 0.06, 0), d: V(0.8, 0.35, -0.5),    r: 1.5 },
      phoneMount:  { t: V(H.x - 0.04, H.y + 0.1, 0.08), d: V(-0.82, 0.5, -0.2),  r: 1.05 },
      deckMat:     { t: V(-0.76, 0.36, 0),          d: V(-0.25, 0.85, -0.5),  r: 2.0 },
      rearBox:     { t: V(-1.15, 0.55, 0),          d: V(-0.75, 0.35, -0.56), r: 2.3 },
      towHitch:    { t: V(-1.3, 0.3, 0),            d: V(-0.78, 0.3, -0.55),  r: 2.0 },
    };

    // Поправка расстояния для узких экранов (телефон в портрете): длинная модель должна помещаться по ширине
    function fitK() {
      const vf = THREE.MathUtils.degToRad(camera.fov);
      return Math.max(1, 0.36 / (Math.tan(vf / 2) * camera.aspect));
    }

    function placeCamera(view, scale = 1) {
      controls.target.copy(view.t);
      camera.position.copy(view.d).normalize().multiplyScalar(view.r * fitK() * scale).add(view.t);
      controls.update();
    }

    let tween = null;
    function flyTo(view, dur = 1100) {
      const fromT = controls.target.clone();
      const s0 = new THREE.Spherical().setFromVector3(camera.position.clone().sub(fromT));
      const s1 = new THREE.Spherical().setFromVector3(view.d.clone().normalize().multiplyScalar(view.r * fitK()));
      let dTheta = s1.theta - s0.theta;
      dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
      tween = { t0: performance.now(), dur: reduceMotion ? 1 : dur, fromT, toT: view.t.clone(), s0, s1, dTheta };
    }

    const listeners = { autorotate: [], interact: [] };
    const emit = (ev, v) => listeners[ev].forEach((fn) => fn(v));
    function setAutoRotate(on) {
      controls.autoRotate = !!on;
      emit('autorotate', controls.autoRotate);
    }
    controls.addEventListener('start', () => {
      tween = null;
      if (controls.autoRotate) setAutoRotate(false);
      emit('interact');
    });

    /* ---------- Цвет рамы (плавная смена) ---------- */
    let colorTween = null;
    function setColor(hex, animate = true) {
      const to = new THREE.Color(hex);
      if (!animate || reduceMotion) { M.frame.color.copy(to); colorTween = null; return; }
      colorTween = { from: M.frame.color.clone(), to, t0: performance.now() };
    }

    /* ---------- Опции ---------- */
    function setOption(id, on, opts = {}) {
      const p = parts[id];
      if (!p) return;
      p.target = on ? 1 : 0;
      if (opts.instant) {
        p.level = p.target;
        applyPart(id, p);
      }
      if (on && opts.focus && VIEWS[id]) {
        setAutoRotate(false);
        flyTo(VIEWS[id]);
      }
    }

    const easeOutBack = (x) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
    const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

    function applyPart(id, p) {
      const growing = p.target > 0;
      const s = growing ? easeOutBack(p.level) : p.level * p.level;
      p.group.scale.setScalar(Math.max(0.0001, s));
      p.group.visible = p.level > 0.001;
      if (id === 'lights') {
        spot.intensity = SPOT_MAX * p.level;
        M.beam.opacity = 0.14 * p.level;
      }
      if (id === 'frameLed') ledLights.forEach((l) => { l.intensity = LED_MAX * p.level; });
    }

    /* ---------- Размер ---------- */
    function resize() {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    // стартовые опции и вид
    (init.options || []).forEach((id) => setOption(id, true, { instant: true }));
    placeCamera(VIEWS.home, reduceMotion ? 1 : 1.45);
    if (!reduceMotion) flyTo(VIEWS.home, 1800);

    /* ---------- Цикл отрисовки ---------- */
    let raf = 0, running = false, last = performance.now();

    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (tween) {
        const k = Math.min(1, (now - tween.t0) / tween.dur);
        const e = easeInOut(k);
        controls.target.lerpVectors(tween.fromT, tween.toT, e);
        const sp = new THREE.Spherical(
          THREE.MathUtils.lerp(tween.s0.radius, tween.s1.radius, e),
          THREE.MathUtils.lerp(tween.s0.phi, tween.s1.phi, e),
          tween.s0.theta + tween.dTheta * e
        );
        camera.position.setFromSpherical(sp).add(controls.target);
        if (k >= 1) tween = null;
      }
      controls.update(dt);

      for (const id in parts) {
        const p = parts[id];
        if (p.level !== p.target) {
          p.level = p.target > p.level ? Math.min(1, p.level + dt / 0.55) : Math.max(0, p.level - dt / 0.3);
          applyPart(id, p);
        }
      }

      if (colorTween) {
        const k = Math.min(1, (now - colorTween.t0) / 450);
        M.frame.color.lerpColors(colorTween.from, colorTween.to, easeInOut(k));
        if (k >= 1) colorTween = null;
      }

      const t = now / 1000;
      M.heat.emissiveIntensity = 0.75 + 0.35 * Math.sin(t * 3);

      if (!reduceMotion) {
        const pos = snowGeo.attributes.position.array;
        for (let i = 0; i < SNOW; i++) {
          let y = pos[i * 3 + 1] - snowVel[i] * dt;
          if (y < 0) y += 4;
          pos[i * 3 + 1] = y;
          pos[i * 3] += Math.sin(t * 0.7 + i) * 0.0009;
        }
        snowGeo.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
    }

    function resume() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
    function pause() {
      running = false;
      cancelAnimationFrame(raf);
    }
    resume();

    return {
      setColor,
      setOption,
      setAutoRotate,
      get autoRotate() { return controls.autoRotate; },
      resetView() { flyTo(VIEWS.home, 1000); },
      on(ev, fn) { listeners[ev].push(fn); },
      // Снимок конфигурации с общего ракурса (камера потом возвращается на место)
      snapshot() {
        const pos = camera.position.clone(), tgt = controls.target.clone();
        try {
          controls.target.copy(VIEWS.home.t);
          camera.position.copy(VIEWS.home.d).normalize().multiplyScalar(VIEWS.home.r * fitK()).add(VIEWS.home.t);
          camera.lookAt(VIEWS.home.t);
          renderer.render(scene, camera);
          return renderer.domElement.toDataURL('image/jpeg', 0.86);
        } catch (e) {
          return null;
        } finally {
          camera.position.copy(pos);
          controls.target.copy(tgt);
          camera.lookAt(tgt);
        }
      },
      pause,
      resume,
    };
  }

  window.SnegoScene = { create };
})();
