/* ============================================================
   RADAR TABASCO — App (GitHub Pages)
   ============================================================ */
(function () {
  'use strict';

  const CFG = window.RADAR_CONFIG || {};
  const TABASCO = [[17.25, -94.15], [18.70, -90.95]];
  const CATEGORIAS = ['Bloqueo', 'Manifestación', 'Paro o toma', 'Afectación vial', 'Accidente', 'Inundación y clima',
    'Apagones / CFE', 'Agua', 'Incendio o fuga', 'Seguridad', 'Político / oposición', 'Programas Bienestar', 'Otro'];
  const NIVEL_TXT = { rojo: 'Urgente', naranja: 'Atención', amarillo: 'Seguimiento' };

  const st = {
    clave: leer('radar_clave'), usuario: null, servidor: {},
    fecha: null, hoy: null, panel: null, filtro: 'todas', cat: '',
    mapa: null, capaPines: null, capaLluvia: null, capaTermo: null,
    timerPanel: null, timerDur: null, timerTv: null, timerReloj: null
  };

  // ---------------- utilidades ----------------
  function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function guardar(k, v) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
  const $ = s => document.querySelector(s);
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function urlSegura(u) { return /^https?:\/\//i.test(String(u || '')) ? esc(u) : '#'; }
  function hora(ms) { if (!ms) return ''; const d = new Date(ms); return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }); }
  function fechaLarga(iso) {
    const d = new Date(iso + 'T12:00:00');
    const t = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function hace(ms) {
    if (!ms) return '';
    const m = Math.round((Date.now() - ms) / 60000);
    if (m < 1) return 'ahora';
    if (m < 60) return 'hace ' + m + ' min';
    const h = Math.floor(m / 60);
    if (h < 24) return 'hace ' + h + ' h';
    return 'hace ' + Math.floor(h / 24) + ' d';
  }
  function duracion(ms) {
    const m = Math.max(0, Math.floor(ms / 60000));
    const h = Math.floor(m / 60), d = Math.floor(h / 24);
    if (d > 0) return d + ' d ' + (h % 24) + ' h';
    if (h > 0) return h + ' h ' + (m % 60) + ' min';
    return m + ' min';
  }
  function toast(t, ms) {
    const el = $('#toast'); el.textContent = t; el.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => el.hidden = true, ms || 2800);
  }
  function hoyLocal() {
    const d = new Date(); const p = n => ('0' + n).slice(-2);
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function esNoche() { const h = new Date().getHours(); return h >= 23 || h < 7; }

  const ICONOS = {
    'Bloqueo': '<path d="M3 10h18v4H3z"/><path d="M6 10l3 4M11 10l3 4M16 10l3 4M5 14v5M19 14v5"/>',
    'Manifestación': '<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>',
    'Paro o toma': '<rect x="5" y="4" width="4" height="16" rx="1"/><rect x="15" y="4" width="4" height="16" rx="1"/>',
    'Afectación vial': '<path d="M6 21l3-18M18 21l-3-18M12 5v2M12 11v2M12 17v2"/>',
    'Accidente': '<path d="M5 17h14l-2-6H7z"/><circle cx="8" cy="18" r="1.5"/><circle cx="16" cy="18" r="1.5"/><path d="M12 3v4M7 5l2 2M17 5l-2 2"/>',
    'Inundación y clima': '<path d="M2 16c2 0 2-1.5 4-1.5S8 16 10 16s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5"/><path d="M2 20c2 0 2-1.5 4-1.5S8 20 10 20s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5"/><path d="M12 3v8M9 8l3 3 3-3"/>',
    'Apagones / CFE': '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    'Agua': '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    'Incendio o fuga': '<path d="M12 22c4 0 7-3 7-7 0-5-4-6-5-11-3 2-4 5-4 7-1-1-2-2-2-4-2 2-3 5-3 8 0 4 3 7 7 7z"/>',
    'Seguridad': '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    'Político / oposición': '<path d="M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M2 10l10-6 10 6z"/>',
    'Programas Bienestar': '<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>',
    'Otro': '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>'
  };
  function icono(cat) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONOS[cat] || ICONOS['Otro']) + '</svg>'; }

  // ---------------- API ----------------
  async function api(accion, params) {
    if (!CFG.API_URL || /PEGA_AQUI/.test(CFG.API_URL)) throw new Error('Falta la URL de la API en config.js');
    const q = new URLSearchParams(Object.assign({ accion: accion, clave: st.clave || '' }, params || {}));
    const r = await fetch(CFG.API_URL + '?' + q.toString(), { redirect: 'follow' });
    const j = await r.json();
    if (!j.ok && j.error === 'clave') { salir(true); throw new Error('Clave no válida'); }
    if (!j.ok) throw new Error(j.detalle || j.error || 'Error');
    return j;
  }

  // ---------------- sesión ----------------
  async function entrar(clave) {
    st.clave = clave;
    const j = await api('login');
    st.usuario = j.usuario; st.servidor = j.config || {};
    guardar('radar_clave', clave);
    $('#login').hidden = true; $('#app').hidden = false;
    $('#menu-usuario').textContent = 'Sesión: ' + j.usuario.nombre;
    iniciarPush();
    enrutar();
  }
  function salir(porClave) {
    guardar('radar_clave', null); st.clave = null;
    $('#app').hidden = true; $('#login').hidden = false;
    if (porClave) { const e = $('#login-error'); e.textContent = 'Clave no válida o desactivada.'; e.hidden = false; }
  }

  $('#form-login').addEventListener('submit', async ev => {
    ev.preventDefault();
    const b = ev.target.querySelector('button'); b.disabled = true; b.textContent = 'Entrando…';
    $('#login-error').hidden = true;
    try { await entrar($('#clave').value.trim()); }
    catch (e) { const er = $('#login-error'); er.textContent = e.message; er.hidden = false; }
    b.disabled = false; b.textContent = 'Entrar';
  });

  // ---------------- notificaciones (OneSignal) ----------------
  function esIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function instalada() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }

  function iniciarPush() {
    const appId = CFG.ONESIGNAL_APP_ID && !/PEGA_AQUI/.test(CFG.ONESIGNAL_APP_ID) ? CFG.ONESIGNAL_APP_ID : st.servidor.onesignalAppId;
    if (!appId) return;
    if (esIOS() && !instalada()) { mostrarAvisoPush('ios'); return; }
    if (window.OneSignalDeferred) return;
    window.OneSignalDeferred = [];
    const s = document.createElement('script');
    s.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'; s.defer = true;
    document.head.appendChild(s);
    const base = location.pathname.replace(/[^/]*$/, ''); // ej. /radar/
    OneSignalDeferred.push(async function (OneSignal) {
      try {
        await OneSignal.init({
          appId: appId,
          serviceWorkerPath: base.replace(/^\//, '') + 'push/onesignal/OneSignalSDKWorker.js',
          serviceWorkerParam: { scope: base + 'push/onesignal/' },
          allowLocalhostAsSecureOrigin: true
        });
        await OneSignal.login(String(st.usuario.id));
        window._os = OneSignal;
        actualizarAvisoPush();
        OneSignal.Notifications.addEventListener('permissionChange', actualizarAvisoPush);
      } catch (e) { console.warn('OneSignal', e); }
    });
  }
  function actualizarAvisoPush() {
    const os = window._os;
    if (!os) return;
    const ok = os.Notifications.permission && os.User.PushSubscription.optedIn;
    if (ok) { $('#aviso-push').hidden = true; $('#m-push').textContent = 'Notificaciones activadas ✓'; }
    else mostrarAvisoPush('activar');
  }
  function mostrarAvisoPush(tipo) {
    const b = $('#aviso-push');
    b.hidden = false;
    if (tipo === 'ios') {
      b.innerHTML = '📲 Para recibir alertas en iPhone: toca <b>Compartir</b> → <b>Agregar a pantalla de inicio</b> y abre la app desde el ícono.';
      b.onclick = null;
    } else {
      b.innerHTML = '🔔 Toca aquí para activar las notificaciones en este teléfono';
      b.onclick = pedirPermiso;
    }
  }
  async function pedirPermiso() {
    const os = window._os;
    if (!os) { toast(esIOS() && !instalada() ? 'Primero agrega la app a tu pantalla de inicio' : 'Cargando notificaciones, intenta en unos segundos'); return; }
    try {
      await os.Notifications.requestPermission();
      if (os.Notifications.permission && !os.User.PushSubscription.optedIn) await os.User.PushSubscription.optIn();
    } catch (e) {}
    actualizarAvisoPush();
    if (os.Notifications.permission) toast('Notificaciones activadas');
    else toast('Permiso negado. Actívalo en los ajustes del navegador.', 4500);
  }

  // ---------------- enrutador ----------------
  window.addEventListener('hashchange', enrutar);
  function enrutar() {
    if (!st.clave) return;
    const h = location.hash || '#/mapa';
    const partes = h.replace(/^#\//, '').split('/');
    const ruta = partes[0] || 'mapa', id = partes[1];
    limpiarTimers();
    document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('activo', a.dataset.tab === ruta));
    const enMapa = ruta === 'mapa';
    $('#v-mapa').hidden = !enMapa;
    $('#v-otra').hidden = enMapa;
    $('#tabs').hidden = ['alerta', 'tarjeta', 'tv'].indexOf(ruta) !== -1;
    window.scrollTo(0, 0);
    if (enMapa) return vistaMapa();
    const v = { alerta: vistaDetalle, tarjeta: vistaTarjeta, lectura: vistaLectura, agenda: vistaAgenda, actores: vistaActores, tv: vistaTv }[ruta];
    (v || vistaMapa)(id);
  }
  function limpiarTimers() {
    ['timerPanel', 'timerDur', 'timerTv', 'timerReloj'].forEach(k => { clearInterval(st[k]); st[k] = null; });
    if (st.tvMapa) { clearInterval(st.tvMapa._lluviaT); st.tvMapa.remove(); st.tvMapa = null; }
  }
  function otra(html) { const v = $('#v-otra'); v.innerHTML = html; return v; }
  function cargando(texto) { otra('<div class="pagina"><div class="cargando">' + esc(texto || 'Cargando…') + '</div></div>'); }
  function errorVista(e) { otra('<div class="pagina"><div class="vacio">No se pudo cargar: ' + esc(e.message) + '<br><br><button class="btn" onclick="location.reload()">Reintentar</button></div></div>'); }

  // ---------------- MAPA ----------------
  function crearMapa(el, interactivo) {
    const m = L.map(el, { zoomControl: false, attributionControl: true, zoomSnap: 0.25,
      dragging: interactivo !== false, scrollWheelZoom: interactivo !== false, touchZoom: interactivo !== false, doubleClickZoom: interactivo !== false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
    }).addTo(m);
    return m;
  }

  function vistaMapa() {
    if (!st.mapa) {
      st.mapa = crearMapa('mapa');
      st.mapa.fitBounds(TABASCO);
      st.capaPines = L.layerGroup().addTo(st.mapa);
      const sel = $('#filtro-cat');
      CATEGORIAS.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o); });
    }
    setTimeout(() => st.mapa.invalidateSize(), 50);
    $('#aviso-noche').hidden = !esNoche();
    cargarPanel();
    st.timerPanel = setInterval(() => { if (!st.fecha || st.fecha === st.hoy) cargarPanel(true); }, 60000);
  }

  async function cargarPanel(silencioso) {
    try {
      const j = await api('panel', st.fecha ? { fecha: st.fecha } : {});
      st.panel = j; st.hoy = j.hoy; st.servidor = Object.assign(st.servidor, j.config || {});
      pintarEstado(j.estado);
      pintarPanel();
      if (st.capaTermo) pintarTermometro();
    } catch (e) { if (!silencioso) toast('Sin conexión: ' + e.message); pintarEstado(null); }
  }

  function pintarEstado(e) {
    const p = $('#punto-estado'), t = $('#txt-estado');
    if (!e) { p.className = 'punto mal'; t.textContent = 'Sin conexión con el servidor'; return; }
    const fresco = e.ultimoMs && (Date.now() - e.ultimoMs) < 25 * 60000;
    const horaTxt = e.ultimo ? e.ultimo.split(' ')[1] : '—';
    if (e.activo && fresco) { p.className = 'punto ok'; t.textContent = 'Monitoreando · revisado ' + horaTxt; }
    else { p.className = 'punto mal'; t.textContent = (e.activo ? 'Retrasado' : 'Monitoreo apagado') + ' · última revisión ' + horaTxt; }
  }

  function filtrar(lista) {
    return lista.filter(e => (st.filtro !== 'urgentes' || e.nivel !== 'amarillo') && (!st.cat || e.categoria === st.cat));
  }

  function pintarPanel() {
    const j = st.panel; if (!j) return;
    const esHoy = j.fecha === j.hoy;
    $('#k-rojo').textContent = j.conteo.rojo; $('#k-naranja').textContent = j.conteo.naranja; $('#k-amarillo').textContent = j.conteo.amarillo;
    $('#titulo-dia').textContent = esHoy ? 'Hoy' : fechaLarga(j.fecha);
    const dia = filtrar(j.dia);
    $('#sub-dia').textContent = (esHoy ? fechaLarga(j.fecha) + ' · ' : '') + j.dia.length + ' alertas';
    $('#fecha').value = j.fecha; $('#fecha').max = j.hoy;
    $('#btn-hoy').hidden = esHoy;

    // Pines: hoy = activos (laten los rojos); otro día = todo lo de ese día
    st.capaPines.clearLayers();
    const enMapa = filtrar(esHoy ? j.activos : j.dia);
    enMapa.forEach(e => {
      if (!isFinite(e.lat) || !isFinite(e.lon)) return;
      const late = esHoy && e.nivel === 'rojo' && ['Nueva', 'En seguimiento'].indexOf(e.estatus) !== -1;
      const tam = e.nivel === 'rojo' ? 18 : 14;
      const ic = L.divIcon({ className: '', iconSize: [tam, tam], iconAnchor: [tam / 2, tam / 2],
        html: '<div class="pin ' + e.nivel + (late ? ' late' : '') + (esHoy ? '' : ' apagado') + '" style="width:' + tam + 'px;height:' + tam + 'px"></div>' });
      L.marker([e.lat, e.lon], { icon: ic, zIndexOffset: e.urgencia * 100, title: e.titulo })
        .bindTooltip(esc(e.categoria + ' · ' + (e.municipio || '') + (e.aprox ? ' (aprox.)' : '')), { direction: 'top', offset: [0, -8] })
        .on('click', () => location.hash = '#/alerta/' + e.id)
        .addTo(st.capaPines);
    });

    const cont = $('#lista');
    if (!dia.length) { cont.innerHTML = '<div class="vacio">' + (j.dia.length ? 'Sin alertas con este filtro' : 'Sin alertas registradas ' + (esHoy ? 'hoy' : 'ese día') + ' 👌') + '</div>'; return; }
    cont.innerHTML = dia.map(tarjetaHtml).join('');
    cont.querySelectorAll('.tarjeta').forEach(t => t.addEventListener('click', () => location.hash = '#/alerta/' + t.dataset.id));
  }

  function fotoHtml(e, clase) {
    if (!e.foto) return '<div class="' + clase + '">' + icono(e.categoria) + '</div>';
    return '<div class="' + clase + (e.sensible ? ' sensible' : '') + '"><img loading="lazy" referrerpolicy="no-referrer" src="' + urlSegura(e.foto) +
      '" alt="" onerror="this.parentNode.innerHTML=\'' + icono(e.categoria).replace(/"/g, '&quot;').replace(/'/g, '') + '\'">' +
      (e.sensible ? '<span class="velo">Imagen sensible</span>' : '') + '</div>';
  }

  function tarjetaHtml(e) {
    const cerrada = ['Atendida', 'Concluida', 'Archivada'].indexOf(e.estatus) !== -1;
    return '<a class="tarjeta' + (cerrada ? ' apagada' : '') + '" data-id="' + esc(e.id) + '" href="#/alerta/' + esc(e.id) + '">' +
      fotoHtml(e, 'foto') +
      '<div class="info"><span class="etiqueta ' + e.nivel + '"><i class="dot ' + e.nivel + '"></i>' + esc(NIVEL_TXT[e.nivel]) + ' · ' + esc(e.categoria) +
      (cerrada ? ' · ' + esc(e.estatus) : '') + '</span>' +
      '<span class="tit">' + esc((e.municipio ? e.municipio + ' — ' : '') + e.titulo) + '</span>' +
      '<span class="res">' + esc(e.resumen) + '</span>' +
      '<span class="meta">' + esc(hora(e.creado)) + ' · ' + esc(hace(e.actualizado)) + (e.fuentes > 1 ? ' · ' + e.fuentes + ' fuentes' : '') + '</span></div></a>';
  }

  // filtros y controles del mapa
  document.querySelectorAll('[data-filtro]').forEach(b => b.addEventListener('click', () => {
    st.filtro = b.dataset.filtro;
    document.querySelectorAll('[data-filtro]').forEach(x => x.classList.toggle('activo', x === b));
    pintarPanel();
  }));
  $('#filtro-cat').addEventListener('change', e => { st.cat = e.target.value; e.target.classList.toggle('activo', !!st.cat); pintarPanel(); });
  $('#fecha').addEventListener('change', e => { st.fecha = e.target.value || null; cargarPanel(); });
  $('#btn-hoy').addEventListener('click', () => { st.fecha = null; cargarPanel(); });
  $('#btn-refrescar').addEventListener('click', () => { cargarPanel(); toast('Actualizado'); });
  $('#btn-lluvia').addEventListener('click', e => alternarLluvia(st.mapa, e.currentTarget));
  $('#btn-termo').addEventListener('click', e => {
    const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    e.currentTarget.setAttribute('aria-pressed', String(on));
    if (on) { st.capaTermo = L.layerGroup().addTo(st.mapa); pintarTermometro(); }
    else if (st.capaTermo) { st.mapa.removeLayer(st.capaTermo); st.capaTermo = null; }
  });

  function colorTermo(r) { return r > 0.75 ? '#FF4D4F' : r > 0.5 ? '#FF7A45' : r > 0.25 ? '#FFA94D' : '#F5D04A'; }
  function pintarTermometro() {
    if (!st.capaTermo || !st.panel) return;
    st.capaTermo.clearLayers();
    const t = st.panel.termometro || [];
    const max = Math.max.apply(null, t.map(x => x.peso).concat([1]));
    t.forEach(x => {
      const r = x.peso / max;
      L.circleMarker([x.lat, x.lon], { radius: 10 + r * 26, color: colorTermo(r), weight: 1, fillColor: colorTermo(r), fillOpacity: 0.28 })
        .bindTooltip(esc(x.municipio + ': ' + x.n + ' alertas en 7 días'), { direction: 'top' }).addTo(st.capaTermo);
    });
  }

  async function alternarLluvia(mapa, boton) {
    const on = boton.getAttribute('aria-pressed') !== 'true';
    boton.setAttribute('aria-pressed', String(on));
    if (mapa._lluvia) { mapa.removeLayer(mapa._lluvia); mapa._lluvia = null; clearInterval(mapa._lluviaT); }
    if (!on) return;
    const poner = async () => {
      try {
        let capa;
        const owm = st.servidor.owmKey || CFG.OWM_API_KEY;
        if (owm) {
          capa = L.tileLayer('https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=' + encodeURIComponent(owm),
            { opacity: 0.75, attribution: 'Lluvia &copy; OpenWeather' });
        } else {
          const r = await fetch('https://api.rainviewer.com/public/weather-maps.json');
          const j = await r.json();
          const fr = j.radar && j.radar.past && j.radar.past[j.radar.past.length - 1];
          if (!fr) throw new Error('sin radar');
          capa = L.tileLayer(j.host + fr.path + '/256/{z}/{x}/{y}/2/1_0.png',
            { opacity: 0.7, maxNativeZoom: 7, maxZoom: 19, attribution: 'Radar &copy; RainViewer' });
        }
        if (mapa._lluvia) mapa.removeLayer(mapa._lluvia);
        mapa._lluvia = capa.addTo(mapa);
      } catch (e) { toast('No se pudo cargar la capa de lluvia'); }
    };
    await poner();
    mapa._lluviaT = setInterval(poner, 10 * 60000);
  }

  // ---------------- DETALLE ----------------
  async function vistaDetalle(id) {
    cargando('Cargando alerta…');
    let j;
    try { j = await api('evento', { id: id }); } catch (e) { return errorVista(e); }
    const e = j.evento, notas = j.notas;
    const abierta = ['Nueva', 'En seguimiento'].indexOf(e.estatus) !== -1;
    const v = otra(
      '<div class="pagina">' +
      '<div class="cab-volver"><a class="btn-icono" href="#/mapa" aria-label="Volver"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></a>' +
      '<div class="tags"><span class="tag ' + e.nivel + '"><i class="dot ' + e.nivel + '"></i>' + esc(NIVEL_TXT[e.nivel].toUpperCase()) + ' · ' + esc(e.categoria.toUpperCase()) + '</span>' +
      (e.vial ? '<span class="tag naranja">Afecta vialidad</span>' : '') + '</div></div>' +
      '<div id="mini" class="mini-mapa"></div>' +
      '<div><h1>' + esc(e.titulo) + '</h1>' +
      '<div class="fila" style="margin-top:6px"><span class="sub">' + esc([e.municipio, e.lugar].filter(Boolean).join(' · ')) + (e.aprox ? ' (ubicación aproximada)' : '') + '</span>' +
      '<span id="dur" class="duracion' + (abierta ? '' : ' cerrada') + '"></span></div></div>' +
      (e.foto ? fotoHtml(e, 'foto-grande').replace('Imagen sensible', 'Imagen sensible · toca para ver') : '') +
      '<p class="panorama" style="margin:0">' + esc(e.resumen) + '</p>' +
      (e.actores ? '<div class="sub">👥 ' + esc(e.actores) + '</div>' : '') +
      '<div class="seccion-t">Línea de tiempo</div><div class="linea">' +
      notas.map(n => '<div class="paso"><div class="riel"><i class="' + (n.urgencia >= 4 ? 'rojo' : n.urgencia === 3 ? 'naranja' : 'amarillo') + '"></i><b></b></div>' +
        '<div class="cont"><span class="hora">' + esc(hora(n.hora)) + '</span><span class="txt">' + esc(n.resumen || n.titulo) +
        '<br><a href="' + urlSegura(n.link) + '" target="_blank" rel="noopener">' + esc(n.origen + ' · ' + n.medio) + ' ↗</a></span></div></div>').join('') +
      (abierta ? '' : '<div class="paso"><div class="riel"><i></i></div><div class="cont"><span class="hora">' + esc(hora(e.cerrado || e.actualizado)) + '</span><span class="txt">' + esc(e.estatus) + '</span></div></div>') +
      '</div>' +
      '<a class="btn btn-primario" href="#/tarjeta/' + esc(e.id) + '"><svg viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/></svg>Tarjeta para el delegado</a>' +
      '<div class="seccion-t">Estatus</div><div class="estatus">' +
      ['Nueva', 'En seguimiento', 'Atendida'].map(s => '<button data-est="' + s + '" class="' + (e.estatus === s ? 'activo' : '') + '">' + s + '</button>').join('') + '</div>' +
      '<div class="sub">' + (e.estatus === 'En seguimiento' ? 'El punto se queda en el mapa hasta que alguien lo marque como atendido.' :
        e.estatus === 'Nueva' ? 'Si nadie lo atiende, se archiva solo a las 12 horas.' : 'Estatus actual: ' + esc(e.estatus)) + '</div>' +
      '</div>');

    // Foto sensible: tocar para ver
    const fg = v.querySelector('.foto-grande.sensible');
    if (fg) fg.addEventListener('click', () => fg.classList.remove('sensible'), { once: true });

    // Mini mapa
    setTimeout(() => {
      if (!isFinite(e.lat)) return;
      const m = crearMapa('mini', false);
      m.setView([e.lat, e.lon], e.aprox ? 12 : 14);
      const ic = L.divIcon({ className: '', iconSize: [20, 20], iconAnchor: [10, 10],
        html: '<div class="pin ' + e.nivel + (abierta && e.nivel === 'rojo' ? ' late' : '') + '" style="width:20px;height:20px"></div>' });
      L.marker([e.lat, e.lon], { icon: ic }).addTo(m);
    }, 30);

    // Duración
    const pintaDur = () => {
      const fin = abierta ? Date.now() : (e.cerrado || e.actualizado);
      $('#dur').innerHTML = (abierta ? '<span class="punto ok" style="background:var(--rojo)"></span>Activo ' : 'Duró ') + esc(duracion(fin - e.creado));
    };
    pintaDur(); if (abierta) st.timerDur = setInterval(pintaDur, 30000);

    v.querySelectorAll('[data-est]').forEach(b => b.addEventListener('click', async () => {
      const est = b.dataset.est;
      b.disabled = true;
      try { await api('estatus', { id: e.id, estatus: est }); toast('Estatus: ' + est); vistaDetalle(id); }
      catch (er) { toast('No se pudo guardar: ' + er.message); b.disabled = false; }
    }));
  }

  // ---------------- TARJETA ----------------
  async function vistaTarjeta(id, regenerar) {
    cargando(regenerar ? 'Redactando de nuevo…' : 'Redactando la tarjeta…');
    let j;
    try { j = await api('tarjeta', regenerar ? { id: id, regenerar: '1' } : { id: id }); } catch (e) { return errorVista(e); }
    const t = j.tarjeta || {};
    const ahora = new Date(j.generada || Date.now());
    const fechaTxt = ahora.toLocaleDateString('es-MX') + ' · ' + hora(ahora.getTime());
    const hechos = Array.isArray(t.hechos) ? t.hechos : [];
    const v = otra('<div class="pagina">' +
      '<div class="cab-volver"><a class="btn-icono" href="#/alerta/' + esc(id) + '" aria-label="Volver"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></a>' +
      '<div><h1>Tarjeta para el delegado</h1><div class="sub">Redactada por IA · revísala antes de enviar</div></div></div>' +
      '<article class="doc"><div class="doc-cab"><b>TARJETA INFORMATIVA</b><span>' + esc(fechaTxt) + '</span></div>' +
      '<div><div class="k">Asunto</div><div class="v" style="font-weight:600">' + esc(t.asunto) + '</div></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div><div class="k">Lugar</div><div class="v">' + esc(t.lugar) + '</div></div>' +
      '<div><div class="k">Estatus</div><div class="v" style="color:#B42318;font-weight:600">' + esc(t.estatus) + '</div></div></div>' +
      '<div><div class="k">Hechos</div><ul>' + hechos.map(h => '<li>' + esc(h) + '</li>').join('') + '</ul></div>' +
      (t.actores ? '<div><div class="k">Actores</div><div class="v">' + esc(t.actores) + '</div></div>' : '') +
      (t.recomendacion ? '<div><div class="k">Atención sugerida</div><div class="v">' + esc(t.recomendacion) + '</div></div>' : '') +
      '<div><div class="k">Fuentes</div><div class="v" style="font-size:12.5px;color:#374151">' + esc(t.fuentes) + '</div></div></article>' +
      '<button id="t-wa" class="btn btn-wa">Enviar por WhatsApp</button>' +
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">' +
      '<button id="t-copiar" class="btn">Copiar</button><button id="t-pdf" class="btn">PDF</button><button id="t-otra" class="btn">Redactar otra vez</button></div>' +
      '</div>');

    const texto = '*TARJETA INFORMATIVA*\n' + fechaTxt + '\n\n*Asunto:* ' + (t.asunto || '') + '\n*Lugar:* ' + (t.lugar || '') +
      '\n*Estatus:* ' + (t.estatus || '') + '\n\n*Hechos:*\n' + hechos.map(h => '• ' + h).join('\n') +
      (t.actores ? '\n\n*Actores:* ' + t.actores : '') + (t.recomendacion ? '\n*Atención sugerida:* ' + t.recomendacion : '') +
      '\n\n_Fuentes: ' + (t.fuentes || '') + '_';
    v.querySelector('#t-wa').onclick = () => window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
    v.querySelector('#t-copiar').onclick = async () => {
      try { await navigator.clipboard.writeText(texto); toast('Copiada. Pégala en WhatsApp.'); }
      catch (e) { if (navigator.share) navigator.share({ text: texto }); else toast('No se pudo copiar'); }
    };
    v.querySelector('#t-pdf').onclick = () => window.print();
    v.querySelector('#t-otra').onclick = () => vistaTarjeta(id, true);
  }

  // ---------------- LECTURA ----------------
  function barras(serie, color) {
    const max = Math.max.apply(null, serie.concat([1]));
    return '<svg width="70" height="40" viewBox="0 0 70 40" role="img" aria-label="Menciones de los últimos 7 días">' +
      serie.map((v, i) => { const h = Math.max(3, Math.round(v / max * 38)); return '<rect x="' + (i * 10) + '" y="' + (40 - h) + '" width="7" height="' + h + '" rx="1.5" fill="' + (i >= 5 ? color : '#3A4757') + '"/>'; }).join('') + '</svg>';
  }

  async function vistaLectura(_, regenerar) {
    cargando(regenerar ? 'Generando la lectura rápida…' : 'Cargando lectura rápida…');
    let j;
    try { j = await api('lectura', regenerar ? { regenerar: '1' } : {}); } catch (e) { return errorVista(e); }
    const l = j.lectura;
    const tend = j.tendencias || [];
    const v = otra('<div class="pagina">' +
      '<div class="fila"><div><h1>Lectura rápida</h1><div class="sub">' + (j.generada ? 'Actualizada ' + esc(new Date(j.generada).toLocaleString('es-MX', { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })) : 'Aún no se genera') + '</div></div>' +
      '<button id="l-gen" class="btn">Generar ahora</button></div>' +
      (l ? '<div class="caja panorama">' + esc(l.panorama) + '</div>' +
        ((l.importantes || []).length ? '<div class="seccion-t">Lo más importante</div>' + l.importantes.map((x, i) =>
          '<a class="importante" ' + (x.evento_id ? 'href="#/alerta/' + esc(x.evento_id) + '"' : '') + '><span class="n ' + esc(x.nivel) + '">' + (i + 1) + '</span><span style="font-size:14px;line-height:1.4">' + esc(x.texto) + '</span></a>').join('') : '') +
        (l.politico ? '<div class="seccion-t">Político</div><div style="font-size:14px;line-height:1.45">' + esc(l.politico) + '</div>' : '') +
        (l.clima ? '<div class="seccion-t">Clima</div><div style="font-size:14px;line-height:1.45">' + esc(l.clima) + '</div>' : '') +
        (l.proximos ? '<div class="seccion-t">Próximas 24 h</div><div style="font-size:14px;line-height:1.45">' + esc(l.proximos) + '</div>' : '')
        : '<div class="vacio">Se genera sola a las 7:00 y a las 19:00. Toca “Generar ahora” para tenerla ya.</div>') +
      '<div class="seccion-t" style="color:var(--naranja-t)">Alerta temprana · temas que crecen</div>' +
      (tend.length ? tend.map(t => '<div class="tendencia ' + t.nivel + '"><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:600">' +
        esc(t.tema.charAt(0).toUpperCase() + t.tema.slice(1)) + (t.municipio ? ' en ' + esc(t.municipio) : '') + '</div><div class="sub" style="color:' + (t.nivel === 'alta' ? '#E3C9A8' : 'var(--texto2)') + '">' +
        t.u48 + ' menciones en 48 h' + (t.base ? ' (lo normal: ' + t.base + ')' : '') + (t.nivel === 'alta' ? ' · riesgo de que escale' : ' · en aumento') + '</div></div>' +
        barras(t.serie || [], t.nivel === 'alta' ? '#FFA94D' : '#F5D04A') + '</div>').join('')
        : '<div class="sub">Ningún tema está creciendo fuera de lo normal.</div>') +
      '</div>');
    v.querySelector('#l-gen').onclick = () => vistaLectura(null, true);
  }

  // ---------------- AGENDA ----------------
  async function vistaAgenda() {
    cargando('Cargando agenda…');
    let j;
    try { j = await api('agenda'); } catch (e) { return errorVista(e); }
    const manana = (() => { const d = new Date(j.hoy + 'T12:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
    const grupos = {};
    j.agenda.forEach(a => { (grupos[a.fecha] = grupos[a.fecha] || []).push(a); });
    const etiqueta = f => f === j.hoy ? 'Hoy' : f === manana ? 'Mañana' : fechaLarga(f);
    const v = otra('<div class="pagina"><div><h1>Agenda</h1><div class="sub">Marchas, paros y convocatorias detectadas. Toca la campana para recibir aviso 1 hora antes.</div></div>' +
      (Object.keys(grupos).length ? Object.keys(grupos).map(f => '<div class="seccion-t">' + esc(etiqueta(f)) + '</div>' + grupos[f].map(a =>
        '<div class="ag-item"><div class="ag-hora">' + (a.hora ? esc(a.hora) : '<small>Sin hora</small>') + '</div>' +
        '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px"><span class="etiqueta naranja">' + esc(a.tipo) + '</span>' +
        '<span class="tit">' + esc(a.descripcion) + '</span><span class="sub">' + esc([a.lugar, a.municipio].filter(Boolean).join(' · ')) + '</span>' +
        '<a class="meta" href="' + urlSegura(a.link) + '" target="_blank" rel="noopener">' + esc(a.medio) + ' ↗</a></div>' +
        (a.hora ? '<button class="campana' + (a.aviso ? ' on' : '') + '" data-id="' + esc(a.id) + '" aria-pressed="' + a.aviso + '" aria-label="Aviso una hora antes"><svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg></button>' : '') +
        '</div>').join('')).join('') : '<div class="vacio">No hay convocatorias detectadas por ahora.</div>') + '</div>');
    v.querySelectorAll('.campana').forEach(b => b.addEventListener('click', async () => {
      const on = !b.classList.contains('on');
      b.disabled = true;
      try {
        await api('avisar', { id: b.dataset.id, on: on ? '1' : '0' });
        b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on));
        toast(on ? 'Te avisaremos 1 hora antes' : 'Aviso quitado');
        if (on && !(window._os && window._os.Notifications.permission)) setTimeout(() => toast('Activa las notificaciones en el menú ⋮ para recibir el aviso', 4000), 2900);
      } catch (e) { toast('No se pudo guardar'); }
      b.disabled = false;
    }));
  }

  // ---------------- ACTORES ----------------
  async function vistaActores(_, rango) {
    rango = rango || 'semana';
    cargando('Cargando actores…');
    let j;
    try { j = await api('actores', { rango: rango }); } catch (e) { return errorVista(e); }
    const v = otra('<div class="pagina"><div class="fila"><div><h1>Actores</h1><div class="sub">Actividad pública ' + (rango === 'mes' ? 'del último mes' : 'de la última semana') + '</div></div>' +
      '<div class="segmento"><button data-r="semana" class="' + (rango === 'semana' ? 'activo' : '') + '">Semana</button><button data-r="mes" class="' + (rango === 'mes' ? 'activo' : '') + '">Mes</button></div></div>' +
      j.actores.map(a => {
        const tot = a.menciones || 0;
        const pc = k => tot ? Math.round((a.tonos[k] || 0) / tot * 100) : 0;
        return '<div class="actor"><div class="fila"><div style="display:flex;gap:12px;align-items:center;min-width:0"><div class="avatar">' + esc(a.nombre.charAt(0)) + '</div>' +
          '<div style="min-width:0"><div style="font-size:15px;font-weight:600">' + esc(a.nombre) + '</div><div class="sub">' + esc(a.cargo) + '</div></div></div>' +
          '<div style="text-align:right"><div style="font-size:22px;font-weight:700">' + tot + '</div><div class="sub">menciones</div></div></div>' +
          (tot ? '<div><div class="tono"><span class="c" style="width:' + pc('crítico') + '%"></span><span class="n" style="width:' + pc('neutral') + '%"></span><span class="f" style="width:' + pc('favorable') + '%"></span></div>' +
            '<div class="sub" style="margin-top:4px">Hacia el gobierno: crítico ' + pc('crítico') + '% · neutral ' + pc('neutral') + '% · favorable ' + pc('favorable') + '%</div></div>' +
            (a.temas.length ? '<div class="temas">' + a.temas.map(t => '<span>' + esc(t) + '</span>').join('') + '</div>' : '') +
            (a.ultima ? '<div class="sub" style="color:var(--texto2);line-height:1.4">Última: ' + esc(a.ultima.resumen) + ' · ' + esc(hace(a.ultima.fecha)) + ' · <a href="' + urlSegura(a.ultima.link) + '" target="_blank" rel="noopener">' + esc(a.ultima.medio) + '</a></div>' : '') +
            (a.recientes.length > 1 ? '<details><summary>Ver ' + a.recientes.length + ' más recientes</summary>' + a.recientes.map(r =>
              '<div class="sub" style="margin-top:8px;line-height:1.4">' + esc(hace(r.fecha)) + ' · ' + esc(r.tono) + ' · ' + esc(r.resumen) + ' · <a href="' + urlSegura(r.link) + '" target="_blank" rel="noopener">' + esc(r.medio) + '</a></div>').join('') + '</details>' : '')
            : '<div class="sub">Sin menciones en este periodo.</div>') +
          '</div>';
      }).join('') + '</div>');
    v.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => vistaActores(null, b.dataset.r)));
  }

  // ---------------- MODO TV ----------------
  async function vistaTv() {
    const v = otra('<div class="tv"><header class="tv-cab"><div style="display:flex;align-items:center;gap:18px"><span class="marca">RADAR TABASCO</span>' +
      '<span class="estado" style="font-size:15px"><span id="tv-punto" class="punto"></span><span id="tv-estado">Conectando…</span></span></div>' +
      '<div style="display:flex;align-items:baseline;gap:14px"><span id="tv-fecha" class="sub" style="font-size:15px"></span><span id="tv-reloj" class="tv-reloj"></span>' +
      '<a href="#/mapa" class="btn" style="min-height:36px">Salir</a></div></header>' +
      '<div class="tv-cuerpo"><div class="tv-mapa"><div id="tv-mapa" style="position:absolute;inset:0"></div>' +
      '<button id="tv-sonido" class="tv-sonido">🔊 Toca para activar el sonido de alertas</button></div>' +
      '<aside class="tv-lado"><div class="kpis"><div class="kpi rojo"><b id="tk-r">–</b><span>Urgentes</span></div><div class="kpi naranja"><b id="tk-n">–</b><span>Atención</span></div><div class="kpi amarillo"><b id="tk-a">–</b><span>Seguimiento</span></div></div>' +
      '<div class="tv-caja"><span class="seccion-t">Termómetro semanal por municipio</span><div id="tv-termo" class="termo"></div></div>' +
      '<div class="tv-caja tv-vivo"><span class="seccion-t">En vivo</span><div id="tv-vivo" style="display:flex;flex-direction:column;gap:10px"></div></div></aside></div>' +
      '<footer class="tv-pie"><span id="tv-cinta" class="cinta"></span></footer></div>');

    const reloj = () => {
      const d = new Date();
      $('#tv-reloj').textContent = hora(d.getTime());
      $('#tv-fecha').textContent = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    };
    reloj(); st.timerReloj = setInterval(reloj, 15000);

    st.tvMapa = crearMapa('tv-mapa');
    st.tvMapa.fitBounds(TABASCO);
    const pines = L.layerGroup().addTo(st.tvMapa);
    const btnLluvia = document.createElement('button'); btnLluvia.setAttribute('aria-pressed', 'false');
    alternarLluvia(st.tvMapa, btnLluvia);

    let sonido = false, conocidos = null, ctx = null;
    v.querySelector('#tv-sonido').onclick = e => {
      sonido = true; e.currentTarget.remove();
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (er) {}
      if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
    };
    const pitar = () => {
      if (!sonido || !ctx) return;
      [0, 0.35, 0.7].forEach(t => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.25, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.25);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.26);
      });
    };

    const cargar = async () => {
      let j;
      try { j = await api('tv'); } catch (e) { $('#tv-punto').className = 'punto mal'; $('#tv-estado').textContent = 'Sin conexión'; return; }
      const fresco = j.estado.ultimoMs && (Date.now() - j.estado.ultimoMs) < 25 * 60000;
      $('#tv-punto').className = 'punto ' + (j.estado.activo && fresco ? 'ok' : 'mal');
      $('#tv-estado').textContent = (j.estado.activo && fresco ? 'Monitoreando' : 'Retrasado') + ' · última revisión ' + (j.estado.ultimo ? j.estado.ultimo.split(' ')[1] : '—');
      $('#tk-r').textContent = j.conteo.rojo; $('#tk-n').textContent = j.conteo.naranja; $('#tk-a').textContent = j.conteo.amarillo;

      pines.clearLayers();
      j.activos.forEach(e => {
        if (!isFinite(e.lat)) return;
        const tam = e.nivel === 'rojo' ? 22 : 16;
        L.marker([e.lat, e.lon], { icon: L.divIcon({ className: '', iconSize: [tam, tam], iconAnchor: [tam / 2, tam / 2],
          html: '<div class="pin ' + e.nivel + (e.nivel === 'rojo' ? ' late' : '') + '" style="width:' + tam + 'px;height:' + tam + 'px"></div>' }) })
          .bindTooltip(esc(e.municipio + ': ' + e.titulo), { permanent: e.nivel === 'rojo', direction: 'top', offset: [0, -10] }).addTo(pines);
      });

      const rojos = j.activos.filter(e => e.nivel === 'rojo').map(e => e.id);
      if (conocidos && rojos.some(id => conocidos.indexOf(id) === -1)) pitar();
      conocidos = rojos;

      const t = (j.termometro || []).slice(0, 6);
      const max = Math.max.apply(null, t.map(x => x.peso).concat([1]));
      $('#tv-termo').innerHTML = t.length ? t.map(x => '<span>' + esc(x.municipio) + '</span><i style="width:' + Math.round(x.peso / max * 100) + '%;background:' + colorTermo(x.peso / max) + '"></i><span class="mono sub">' + x.n + '</span>').join('')
        : '<span class="sub" style="grid-column:1/-1">Sin alertas en 7 días</span>';

      $('#tv-vivo').innerHTML = j.dia.filter(e => e.estatus !== 'Archivada').slice(0, 9).map(e =>
        '<div class="tv-item"><span class="h">' + esc(hora(e.actualizado)) + '</span><div><div class="e etiqueta ' + e.nivel + '">' + esc(NIVEL_TXT[e.nivel] + ' · ' + e.categoria) +
        (['Nueva', 'En seguimiento'].indexOf(e.estatus) !== -1 && e.nivel === 'rojo' ? ' · ' + esc(duracion(Date.now() - e.creado)) : '') + '</div>' +
        '<div class="t">' + esc((e.municipio ? e.municipio + ': ' : '') + e.titulo) + '</div></div></div>').join('') || '<div class="sub">Sin alertas hoy</div>';

      const cinta = [];
      (j.tendencias || []).forEach(x => cinta.push('📈 ' + x.tema + (x.municipio ? ' en ' + x.municipio : '') + ': ' + x.u48 + ' menciones en 48 h'));
      (j.proximos || []).forEach(a => cinta.push('📅 ' + a.fecha.slice(5).split('-').reverse().join('/') + (a.hora ? ' ' + a.hora : '') + ' · ' + a.tipo + ': ' + a.descripcion));
      if (j.lectura && j.lectura.panorama) cinta.unshift('📰 ' + j.lectura.panorama);
      $('#tv-cinta').innerHTML = cinta.map(esc).join('<span style="color:#4B5563">·</span>') || 'Sin novedades';
    };
    await cargar();
    st.timerTv = setInterval(cargar, 60000);
  }

  // ---------------- menú ----------------
  $('#btn-menu').addEventListener('click', () => $('#menu').hidden = false);
  $('#m-cerrar').addEventListener('click', () => $('#menu').hidden = true);
  $('#menu').addEventListener('click', e => { if (e.target.id === 'menu') $('#menu').hidden = true; });
  $('#m-salir').addEventListener('click', () => { $('#menu').hidden = true; salir(false); });
  $('#m-push').addEventListener('click', () => { $('#menu').hidden = true; pedirPermiso(); });
  document.querySelectorAll('#menu a').forEach(a => a.addEventListener('click', () => $('#menu').hidden = true));

  // ---------------- arranque ----------------
  if (st.clave) entrar(st.clave).catch(() => { $('#login').hidden = false; });
  else $('#login').hidden = false;
})();
