/* ==========================================================
   СНЕGO — логика сайта: вкладки, конструктор, цена, заявка
   ========================================================== */
(function () {
  'use strict';

  /* ---------- Данные ---------- */
  const BASE_PRICE = 200000;

  const COLORS = [
    { id: 'teal', name: 'Бирюзовый', hex: '#3FB7B4', note: 'как на фото' },
    { id: 'blue', name: 'Голубой СНЕGO', hex: '#39A5F2' },
    { id: 'navy', name: 'Тёмно-синий', hex: '#0B2D55' },
    { id: 'graphite', name: 'Графит', hex: '#3C434C' },
    { id: 'snow', name: 'Снежно-белый', hex: '#EEF2F5' },
    { id: 'orange', name: 'Сигнальный оранжевый', hex: '#FF7A1A' },
  ];

  // Список опций и цены — пример для теста (в брифе помечены как «уточнить»)
  const OPTIONS = [
    { id: 'lights', group: 'Свет', price: 5000, name: 'Мощные LED-фонари на руль', desc: 'Два прожектора по бокам от фары — светят далеко вперёд.' },
    { id: 'frameLed', group: 'Свет', price: 4000, name: 'LED-подсветка рамы', desc: 'Светящиеся ленты вдоль рамы: снегокат заметно сбоку в темноте.' },
    { id: 'handguards', group: 'Комфорт', price: 3000, name: 'Защита рук', desc: 'Щитки перед ручками: от ветра, веток и снега.' },
    { id: 'heatedGrips', group: 'Комфорт', price: 2000, name: 'Подогрев ручек', desc: 'Ручки с подогревом и кнопка включения на руле.' },
    { id: 'windscreen', group: 'Комфорт', price: 3000, name: 'Ветровое стекло', desc: 'Прозрачный щиток над обтекателем руля.' },
    { id: 'phoneMount', group: 'Комфорт', price: 2000, name: 'Держатель телефона', desc: 'Крепление по центру руля — карта перед глазами.' },
    { id: 'deckMat', group: 'Комфорт', price: 2000, name: 'Резиновый коврик платформы', desc: 'Рифлёный коврик на площадку для ног — ботинки не скользят.' },
    { id: 'rearBox', group: 'Груз и буксировка', price: 4000, name: 'Задний кофр', desc: 'Закрытый ящик на заднем бампере для термоса и мелочей.' },
    { id: 'towHitch', group: 'Груз и буксировка', price: 3000, name: 'Сцепка для саней', desc: 'Фаркоп сзади, чтобы прицепить сани-волокушу.' },
  ];
  const OPT = Object.fromEntries(OPTIONS.map((o) => [o.id, o]));

  // Точки на фото (в процентах от ширины и высоты снимка)
  const PHOTO_PARTS = [
    { x: 67.3, y: 65.4, name: 'Фирменная рама с платформой для ног' },
    { x: 70.2, y: 73.5, name: 'Резиновая гусеница с опорными катками' },
    { x: 29.3, y: 78.1, name: 'Передняя лыжа с загнутым носом-петлёй' },
    { x: 47.3, y: 47.6, name: 'Длинная наклонная рулевая колонка' },
    { x: 55.6, y: 30.9, name: 'Руль с обтекателем и фарой' },
    { x: 54.1, y: 59.3, name: 'Электромотор и кожух привода' },
    { x: 43.9, y: 64.3, name: 'Батарейный отсек под камуфляжным чехлом' },
    { x: 77.1, y: 63.4, name: 'Задний бампер с фонарём' },
  ];

  /* ---------- Утилиты ---------- */
  const $ = (s, root) => (root || document).querySelector(s);
  const nf = new Intl.NumberFormat('ru-RU');
  const fmt = (n) => nf.format(n).replace(/\s/g, ' ') + ' ₽';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const colorById = (id) => COLORS.find((c) => c.id === id) || COLORS[0];
  function plural(n, one, few, many) {
    const a = n % 10, b = n % 100;
    if (a === 1 && b !== 11) return one;
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
    return many;
  }

  /* ---------- Состояние (запоминаем только выбор опций) ---------- */
  const STORE_KEY = 'snego-config-v1';
  const state = (function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && COLORS.some((c) => c.id === s.color) && Array.isArray(s.options)) {
        return { color: s.color, options: new Set(s.options.filter((id) => OPT[id])) };
      }
    } catch (e) { /* нет доступа к localStorage — не страшно */ }
    return { color: 'teal', options: new Set() };
  })();
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ color: state.color, options: [...state.options] })); } catch (e) { /* ок */ }
  }
  const totalPrice = () => BASE_PRICE + [...state.options].reduce((sum, id) => sum + OPT[id].price, 0);

  /* ==========================================================
     Главная
     ========================================================== */
  $('#year').textContent = new Date().getFullYear();

  // Точки на фото + легенда
  (function photoHotspots() {
    const spots = $('#hotspots');
    const legend = $('#legend');
    const setActive = (i) => {
      spots.querySelectorAll('.hotspot').forEach((el, k) => el.classList.toggle('is-active', k === i));
      legend.querySelectorAll('li').forEach((el, k) => el.classList.toggle('is-active', k === i));
    };
    PHOTO_PARTS.forEach((p, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'hotspot';
      b.style.left = p.x + '%';
      b.style.top = p.y + '%';
      b.textContent = i + 1;
      b.setAttribute('aria-label', p.name);
      b.title = p.name;
      b.addEventListener('click', () => setActive(b.classList.contains('is-active') ? -1 : i));
      b.addEventListener('mouseenter', () => setActive(i));
      spots.appendChild(b);

      const li = document.createElement('li');
      li.innerHTML = '<b>' + (i + 1) + '</b><span></span>';
      li.querySelector('span').textContent = p.name;
      li.addEventListener('mouseenter', () => setActive(i));
      legend.appendChild(li);
    });
    spots.addEventListener('mouseleave', () => setActive(-1));
    legend.addEventListener('mouseleave', () => setActive(-1));
  })();

  // Чипы с опциями в тизере
  $('#teaserChips').innerHTML = OPTIONS.map((o) => '<li>' + o.name + '<span>+' + fmt(o.price) + '</span></li>').join('');

  /* ==========================================================
     Вкладки (#configurator — конструктор, остальное — главная)
     ========================================================== */
  const viewHome = $('#viewHome');
  const viewConfig = $('#viewConfig');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  let scene3d = null;
  let scenePromise = null;

  function route() {
    const isConfig = location.hash === '#configurator';
    viewHome.hidden = isConfig;
    viewConfig.hidden = !isConfig;
    document.body.classList.toggle('is-config', isConfig);
    document.querySelectorAll('.nav a').forEach((a) => {
      a.classList.toggle('is-active', isConfig && a.dataset.link === 'configurator');
    });
    themeMeta.content = isConfig ? '#0a0e14' : '#39A5F2';

    if (isConfig) {
      document.title = 'Конструктор — СНЕGO';
      window.scrollTo(0, 0);
      ensureScene();
      if (scene3d) scene3d.resume();
    } else {
      document.title = 'СНЕGO — электрический снегокат';
      if (scene3d) scene3d.pause();
      const id = location.hash.slice(1);
      const target = id && document.getElementById(id);
      if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
    }
  }
  window.addEventListener('hashchange', route);

  /* ==========================================================
     Конструктор
     ========================================================== */
  const stage = $('#stage');
  const loader = $('#stageLoader');
  const hint = $('#stageHint');
  const toastEl = $('#toast');
  const btnRotate = $('#btnRotate');
  const totalEl = $('#total');
  const totalSub = $('#totalSub');

  const coarse = window.matchMedia('(pointer: coarse)').matches;
  hint.textContent = coarse ? 'Вращайте пальцем · щипок — масштаб' : 'Вращайте мышью · колесо — масштаб';
  let hintTimer = 0;
  const hideHint = () => hint.classList.add('is-hidden');

  let toastTimer = 0;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 1800);
  }

  function hasWebGL() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) {
      return false;
    }
  }

  function loaderError(text) {
    loader.classList.add('is-error');
    loader.innerHTML = '<p></p>';
    loader.querySelector('p').textContent = text;
    const retry = document.createElement('button');
    retry.className = 'btn btn-blue btn-sm';
    retry.type = 'button';
    retry.textContent = 'Попробовать ещё раз';
    retry.addEventListener('click', () => location.reload());
    loader.appendChild(retry);
  }

  function ensureScene() {
    if (scenePromise) return scenePromise;
    if (!window.SnegoScene || !hasWebGL()) {
      loaderError('Браузер не поддерживает 3D (WebGL). Опции и цену можно выбрать и без модели.');
      scenePromise = Promise.resolve(null);
      return scenePromise;
    }
    scenePromise = window.SnegoScene.create($('#stageCanvas'), {
      color: colorById(state.color).hex,
      options: [...state.options],
    }).then((s) => {
      scene3d = s;
      loader.classList.add('is-done');
      btnRotate.setAttribute('aria-pressed', String(s.autoRotate));
      s.on('autorotate', (on) => btnRotate.setAttribute('aria-pressed', String(on)));
      s.on('interact', hideHint);
      hintTimer = setTimeout(hideHint, 7000);
      if (location.hash !== '#configurator') s.pause();
      return s;
    }).catch((err) => {
      console.error(err);
      loaderError('Не удалось загрузить 3D-модель. Проверьте подключение к интернету и обновите страницу. Опции и цену можно выбрать и без неё.');
      return null;
    });
    return scenePromise;
  }

  // Кнопки над сценой
  btnRotate.addEventListener('click', () => { if (scene3d) scene3d.setAutoRotate(!scene3d.autoRotate); });
  $('#btnReset').addEventListener('click', () => { if (scene3d) scene3d.resetView(); });
  const btnFull = $('#btnFull');
  if (!stage.requestFullscreen) btnFull.hidden = true;
  btnFull.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else stage.requestFullscreen().catch(() => {});
  });

  /* ---------- Цвет рамы ---------- */
  const swatches = $('#swatches');
  const swatchName = $('#swatchName');
  COLORS.forEach((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.style.setProperty('--c', c.hex);
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', c.name);
    b.title = c.name;
    b.dataset.id = c.id;
    b.addEventListener('click', () => setColor(c.id));
    swatches.appendChild(b);
  });
  swatches.addEventListener('keydown', (e) => {
    const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    const i = COLORS.findIndex((c) => c.id === state.color);
    const next = COLORS[(i + dir + COLORS.length) % COLORS.length];
    setColor(next.id);
    swatches.querySelector('[data-id="' + next.id + '"]').focus();
  });

  function renderColor() {
    const c = colorById(state.color);
    swatches.querySelectorAll('.swatch').forEach((b) => {
      const on = b.dataset.id === c.id;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    swatchName.innerHTML = '<b></b>' + (c.note ? ' · ' + c.note : '');
    swatchName.querySelector('b').textContent = c.name;
    $('#stageColorName').textContent = c.name;
  }
  function setColor(id) {
    if (state.color === id) return;
    state.color = id;
    save();
    renderColor();
    if (scene3d) scene3d.setColor(colorById(id).hex);
  }

  /* ---------- Опции ---------- */
  const groupsEl = $('#optionGroups');
  [...new Set(OPTIONS.map((o) => o.group))].forEach((groupName) => {
    const wrap = document.createElement('div');
    wrap.className = 'panel-group';
    const h = document.createElement('h2');
    h.className = 'group-title';
    h.textContent = groupName;
    wrap.appendChild(h);
    OPTIONS.filter((o) => o.group === groupName).forEach((o) => {
      const label = document.createElement('label');
      label.className = 'opt';
      label.innerHTML =
        '<input type="checkbox">' +
        '<span class="opt-name"></span>' +
        '<span class="opt-desc"></span>' +
        '<span class="opt-side"><span class="opt-price"></span><span class="switch" aria-hidden="true"></span></span>';
      const input = label.querySelector('input');
      input.dataset.id = o.id;
      input.checked = state.options.has(o.id);
      label.querySelector('.opt-name').textContent = o.name;
      label.querySelector('.opt-desc').textContent = o.desc;
      label.querySelector('.opt-price').textContent = '+' + fmt(o.price);
      input.addEventListener('change', () => toggleOption(o.id, input.checked));
      wrap.appendChild(label);
    });
    groupsEl.appendChild(wrap);
  });

  function toggleOption(id, on) {
    if (on) state.options.add(id);
    else state.options.delete(id);
    save();
    updateTotals(true);
    if (scene3d) scene3d.setOption(id, on, { focus: true });
    toast((on ? 'Добавлено: ' : 'Убрано: ') + OPT[id].name + (on ? ' · +' + fmt(OPT[id].price) : ''));
  }

  /* ---------- Цена ---------- */
  let shownTotal = totalPrice();
  let totalRaf = 0;
  function updateTotals(animate) {
    const to = totalPrice();
    const from = shownTotal;
    shownTotal = to;
    const n = state.options.size;
    totalSub.textContent = n
      ? 'База ' + fmt(BASE_PRICE) + ' + ' + n + ' ' + plural(n, 'опция', 'опции', 'опций') + ' на ' + fmt(to - BASE_PRICE)
      : 'База ' + fmt(BASE_PRICE) + ' · без опций';

    cancelAnimationFrame(totalRaf);
    if (!animate || reduceMotion || from === to) {
      totalEl.textContent = fmt(to);
      return;
    }
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 450);
      const e = 1 - Math.pow(1 - k, 3);
      totalEl.textContent = fmt(Math.round((from + (to - from) * e) / 100) * 100);
      if (k < 1) totalRaf = requestAnimationFrame(step);
    };
    totalRaf = requestAnimationFrame(step);
    totalEl.classList.remove('bump');
    void totalEl.offsetWidth;
    totalEl.classList.add('bump');
  }

  $('#btnClear').addEventListener('click', () => {
    if (!state.options.size && state.color === 'teal') return;
    [...state.options].forEach((id) => { if (scene3d) scene3d.setOption(id, false); });
    state.options.clear();
    groupsEl.querySelectorAll('input').forEach((i) => { i.checked = false; });
    setColor('teal');
    save();
    updateTotals(true);
    if (scene3d) scene3d.resetView();
    toast('Вернули базовую комплектацию');
  });

  /* ==========================================================
     Заявка (тест: никуда не отправляется)
     ========================================================== */
  const dialog = $('#orderDialog');
  const form = $('#orderForm');
  const formError = $('#formError');
  const orderStep = $('#orderStep');
  const doneStep = $('#doneStep');
  let summaryText = '';

  function configLines() {
    const c = colorById(state.color);
    const lines = [
      ['Снегокат СНЕGO, базовая комплектация', fmt(BASE_PRICE)],
      ['Цвет рамы: ' + c.name, 'без доплаты'],
    ];
    OPTIONS.forEach((o) => { if (state.options.has(o.id)) lines.push([o.name, '+' + fmt(o.price)]); });
    return lines;
  }

  function openOrder() {
    const list = $('#summaryList');
    list.innerHTML = '';
    configLines().forEach(([name, price]) => {
      const li = document.createElement('li');
      const a = document.createElement('span');
      const b = document.createElement('span');
      a.textContent = name;
      b.textContent = price;
      li.append(a, b);
      list.appendChild(li);
    });
    $('#summaryTotal').textContent = fmt(totalPrice());

    const shotEl = $('#summaryShot');
    const shot = scene3d ? scene3d.snapshot() : null;
    shotEl.hidden = !shot;
    if (shot) shotEl.src = shot;

    orderStep.hidden = false;
    doneStep.hidden = true;
    formError.textContent = '';
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    if (scene3d) scene3d.pause();
    dialog.showModal();
  }

  $('#btnOrder').addEventListener('click', openOrder);
  $('#dialogClose').addEventListener('click', () => dialog.close());
  $('#btnBack').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { if (scene3d && location.hash === '#configurator') scene3d.resume(); });
  dialog.addEventListener('click', (e) => {
    if (e.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) dialog.close();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = form.elements;
    const name = f.namedItem('name');
    const phone = f.namedItem('phone');
    const errors = [];
    [name, phone].forEach((el) => el.removeAttribute('aria-invalid'));
    if (!name.value.trim()) { errors.push('укажите имя'); name.setAttribute('aria-invalid', 'true'); }
    if (phone.value.replace(/\D/g, '').length < 10) { errors.push('проверьте телефон'); phone.setAttribute('aria-invalid', 'true'); }
    if (errors.length) {
      formError.textContent = 'Пожалуйста, ' + errors.join(' и ') + '.';
      (name.getAttribute('aria-invalid') ? name : phone).focus();
      return;
    }

    const city = f.namedItem('city').value.trim();
    const comment = f.namedItem('comment').value.trim();
    const lines = [
      'Заявка на снегокат СНЕGO (тестовый сайт — не отправлена)',
      '',
      ...configLines().map(([n, p]) => '• ' + n + ' — ' + p),
      'Итого: ' + fmt(totalPrice()),
      '',
      'Имя: ' + name.value.trim(),
      'Телефон: ' + phone.value.trim(),
    ];
    if (city) lines.push('Город: ' + city);
    if (comment) lines.push('Комментарий: ' + comment);
    summaryText = lines.join('\n').replace(/ /g, ' ');

    form.reset();
    orderStep.hidden = true;
    doneStep.hidden = false;
    $('#btnCopy').textContent = 'Скопировать сводку';
  });

  $('#btnCopy').addEventListener('click', async () => {
    const btn = $('#btnCopy');
    try {
      await navigator.clipboard.writeText(summaryText);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = summaryText;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      dialog.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (err) { /* ок */ }
      ta.remove();
    }
    btn.textContent = 'Скопировано ✓';
  });

  /* ---------- Старт ---------- */
  renderColor();
  updateTotals(false);
  route();
})();
