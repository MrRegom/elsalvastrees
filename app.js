/* ====== CONFIG: cambia aquí tus datos reales ====== */
const CONFIG = {
  address:   'Agrega aquí tu dirección',
  hours:     'Lun – Sáb · 10:00 a 19:00',
  phone:     '+56 9 0000 0000',
  instagram: '@elsalvastrees',
  whatsapp:  '56900000000',
  waText:    'Hola! Vi su página y quiero consultar por…'
};

/* Puntos sobre cada foto (u = horizontal 0..1, v = vertical 0..1) */
const INTERIOR_SPOTS = [
  { u: .30, v: .50, t: 'la caja' },
  { u: .12, v: .42, t: 'collares y correas' },
  { u: .84, v: .40, t: 'pared de peluches' },
  { u: .27, v: .17, t: 'camas y transportadores' },
  { u: .62, v: .45, t: 'alimento y accesorios' }
];
const EXTERIOR_SPOTS = [
  { u: .07, v: .50, t: 'aquí se entra' },
  { u: .24, v: .50, t: 'ropa y detalles' },
  { u: .57, v: .62, t: 'un sillón para esperar' },
  { u: .70, v: .45, t: 'los guacamayos' },
  { u: .42, v: .12, t: 'techo de caña' }
];

const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const R = 10;
const uToYaw = u => Math.PI - u * 2 * Math.PI;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

/* ====== visor 360 (cilindro) reutilizable ====== */
function createViewer(root, { src, startU, spots, onReady }) {
  const q = s => root.querySelector(s);
  const host = q('.pano'), layer = q('.hs-layer'), hint = q('.hint');
  const bAuto = q('.b-auto'), bGyro = q('.b-gyro');

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, 1, .1, 100);
  camera.rotation.order = 'YXZ';

  let H = 1, yaw = uToYaw(startU), pitch = 0, fov = 92, tFov = 92, vYaw = 0;
  let auto = true, dragging = false, lastInput = 0, ready = false, visible = false;

  new THREE.TextureLoader().load(src, tex => {
    H = 2 * Math.PI * R / (tex.image.width / tex.image.height);
    const g = new THREE.CylinderGeometry(R, R, H, 128, 1, true);
    g.scale(-1, 1, 1);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })));
    spots.forEach(sp => {
      const th = sp.u * 2 * Math.PI;
      sp.pos = new THREE.Vector3(-R * Math.sin(th) * .98, (.5 - sp.v) * H, R * Math.cos(th) * .98);
      sp.el = document.createElement('div');
      sp.el.className = 'hs';
      sp.el.innerHTML = `<i></i><b>${sp.t}</b>`;
      sp.el.onpointerdown = e => e.stopPropagation();
      sp.el.onclick = () => lookAt(sp.u);
      layer.appendChild(sp.el);
    });
    ready = true;
    onReady && onReady();
  });

  function stopAuto() { auto = false; bAuto.classList.remove('on'); lastInput = performance.now(); }
  function lookAt(u) {
    const from = yaw, d = wrap(uToYaw(u) - from), t0 = performance.now();
    tFov = 56; stopAuto();
    const step = t => {
      const k = Math.min(1, (t - t0) / 1000), e = 1 - Math.pow(1 - k, 3);
      yaw = from + d * e; if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  const pts = new Map(); let pinch0 = 0;
  host.addEventListener('pointerdown', e => {
    host.setPointerCapture(e.pointerId); pts.set(e.pointerId, e);
    dragging = true; host.classList.add('drag'); stopAuto(); hint.classList.add('gone');
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
  });
  host.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return;
    if (pts.size === 2) {
      pts.set(e.pointerId, e);
      const [a, b] = [...pts.values()], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      tFov = clamp(tFov * pinch0 / d, 35, 100); pinch0 = d; return;
    }
    const k = fov / host.clientHeight * Math.PI / 180;
    const dx = e.clientX - p.clientX, dy = e.clientY - p.clientY;
    yaw += dx * k; vYaw = dx * k; pitch += dy * k;
    pts.set(e.pointerId, e);
  });
  const up = e => { pts.delete(e.pointerId); if (!pts.size) { dragging = false; host.classList.remove('drag'); } };
  host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
  host.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.shiftKey) return;           // la rueda normal sigue haciendo scroll de la página
    e.preventDefault(); tFov = clamp(tFov + e.deltaY * .04, 35, 100); stopAuto();
  }, { passive: false });
  host.addEventListener('keydown', e => {
    const s = .08;
    if (e.key === 'ArrowLeft') yaw += s;
    if (e.key === 'ArrowRight') yaw -= s;
    if (e.key === 'ArrowUp') pitch -= s;
    if (e.key === 'ArrowDown') pitch += s;
    stopAuto();
  });
  bAuto.onclick = () => { auto = !auto; bAuto.classList.toggle('on', auto); };
  q('.b-zin').onclick = () => tFov = clamp(tFov - 12, 35, 100);
  q('.b-zout').onclick = () => tFov = clamp(tFov + 12, 35, 100);

  let gyro = false, g0 = null;
  if (matchMedia('(pointer:coarse)').matches && 'DeviceOrientationEvent' in window) bGyro.hidden = false;
  bGyro.onclick = async () => {
    if (gyro) { gyro = false; bGyro.classList.remove('on'); return; }
    try { if (DeviceOrientationEvent.requestPermission && (await DeviceOrientationEvent.requestPermission()) !== 'granted') return; } catch { return; }
    gyro = true; g0 = null; stopAuto(); bGyro.classList.add('on');
  };
  addEventListener('deviceorientation', e => {
    if (!gyro || !visible || e.alpha == null) return;
    if (!g0) g0 = { a: e.alpha, y: yaw };
    yaw = g0.y + (e.alpha - g0.a) * Math.PI / 180;
    pitch = clamp((e.beta - 90) * Math.PI / 180, -1, 1);
  });

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();
  new IntersectionObserver(([e]) => visible = e.isIntersecting).observe(root);

  const v3 = new THREE.Vector3(), fwd = new THREE.Vector3();
  (function frame() {
    requestAnimationFrame(frame);
    if (!ready || !visible) return;
    if (!auto && !dragging && !gyro && performance.now() - lastInput > 9000) { auto = true; bAuto.classList.add('on'); }
    if (auto && !dragging) yaw += .0014;
    if (!dragging) { yaw += vYaw; vYaw *= .93; }
    fov += (tFov - fov) * .12;
    camera.fov = fov; camera.updateProjectionMatrix();
    const lim = Math.max(0, Math.atan(H / 2 / R) - THREE.MathUtils.degToRad(fov / 2));
    pitch = clamp(pitch, -lim, lim);
    camera.rotation.set(pitch, yaw, 0);
    renderer.render(scene, camera);

    camera.getWorldDirection(fwd);
    const w = host.clientWidth, h = host.clientHeight;
    spots.forEach(sp => {
      v3.copy(sp.pos);
      const front = v3.dot(fwd) > 0;
      v3.project(camera);
      const off = !front || Math.abs(v3.x) > 1.05 || Math.abs(v3.y) > 1.05;
      sp.el.style.opacity = off ? 0 : 1;
      sp.el.style.pointerEvents = off ? 'none' : 'auto';
      if (!off) sp.el.style.transform = `translate(${(v3.x * .5 + .5) * w - 11}px,${(-v3.y * .5 + .5) * h - 11}px)`;
    });
  })();
  setTimeout(() => hint.classList.add('gone'), 8000);
  return { lookAt };
}

const inside = createViewer($('#top'), {
  src: 'assets/interior.jpg', startU: .30, spots: INTERIOR_SPOTS,
  onReady: () => $('#loader').classList.add('gone')
});
createViewer($('#afuera'), { src: 'assets/exterior.jpg', startU: .64, spots: EXTERIOR_SPOTS });

/* ====== página ====== */
document.querySelectorAll('.pola').forEach(p => p.onclick = () => {
  scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => inside.lookAt(parseFloat(p.dataset.u)), 500);
});
document.querySelectorAll('[data-cfg]').forEach(el => el.textContent = CONFIG[el.dataset.cfg]);
$('#wa').href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(CONFIG.waText)}`;
$('#yr').textContent = new Date().getFullYear();
