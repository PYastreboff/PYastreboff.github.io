import * as THREE from '../js/three.module.js';

const TRACK_INNER = 22;
const TRACK_OUTER = 38;
const TRACK_MID = (TRACK_INNER + TRACK_OUTER) / 2;
const DRIVE_INNER = 23.4;
const DRIVE_OUTER = 36.6;

const STATIONS = [
  {
    name: 'LinkedIn',
    id: 'linkedin',
    desc: 'Professional profile',
    url: 'https://www.linkedin.com/in/peter-yastreboff-6a9664313/',
    angle: 1.05,
    color: 0x5eb8ff,
    aspect: 1,
  },
  {
    name: 'Portfolio',
    id: 'portfolio',
    desc: 'Selected work',
    url: 'https://petery.is-a.dev/',
    angle: 1.05 + (Math.PI * 2) / 3,
    color: 0x7dd3fc,
    aspect: 638 / 728,
  },
  {
    name: 'GitHub',
    id: 'github',
    desc: 'Code and repositories',
    url: 'https://github.com/PYastreboff',
    angle: 1.05 + (Math.PI * 4) / 3,
    color: 0xe6edf3,
    aspect: 1,
  },
];

const loadingEl = document.getElementById('loading');
const fallbackEl = document.getElementById('fallback');
const canvas = document.getElementById('scene');
const miniCanvas = document.getElementById('minimap');
const stationCard = document.getElementById('station-card');
const stationNameEl = stationCard.querySelector('.station-name');
const stationDescEl = stationCard.querySelector('.station-desc');
const stationOpenBtn = document.getElementById('station-open');
const hintEl = document.getElementById('hint');
const joystickEl = document.getElementById('joystick');
const knobEl = joystickEl.querySelector('.joy-knob');
const actionBtn = document.getElementById('btn-action');

const mobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820;
const lowPower = mobile || navigator.hardwareConcurrency <= 4;

function viewSize() {
  const vv = window.visualViewport;
  if (vv) return { w: Math.round(vv.width), h: Math.round(vv.height) };
  return { w: window.innerWidth, h: window.innerHeight };
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (err) {
    return false;
  }
}

if (!hasWebGL()) {
  fallbackEl.hidden = false;
  loadingEl.classList.add('hidden');
  throw new Error('WebGL unavailable');
}

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: !mobile,
  powerPreference: mobile ? 'low-power' : 'high-performance',
  alpha: false,
});
renderer.setClearColor(0x070814, 1);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = !lowPower;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070814);
scene.fog = new THREE.Fog(0x070814, 38, 118);

const camera = new THREE.PerspectiveCamera(mobile ? 62 : 54, 1, 0.1, 260);
const camOffset = new THREE.Vector3(0, mobile ? 7.2 : 4.4, mobile ? -13.2 : -9.6);
const lookOffset = new THREE.Vector3(0, 1.15, 7.2);
const camPos = new THREE.Vector3();
const lookPos = new THREE.Vector3();
const tmp = new THREE.Vector3();
const dummy = new THREE.Object3D();

scene.add(new THREE.HemisphereLight(0x9ec5ff, 0x0b1020, 0.85));

const moon = new THREE.DirectionalLight(0xdbe7ff, 1.45);
moon.position.set(28, 42, 12);
if (!lowPower) {
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.near = 8;
  moon.shadow.camera.far = 120;
  moon.shadow.camera.left = -48;
  moon.shadow.camera.right = 48;
  moon.shadow.camera.top = 48;
  moon.shadow.camera.bottom = -48;
}
scene.add(moon);

const fill = new THREE.DirectionalLight(0x7c6cff, 0.28);
fill.position.set(-30, 18, -20);
scene.add(fill);

function makeWindowTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0a1020';
  ctx.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 124; y += 7) {
    for (let x = 4; x < 60; x += 8) {
      if (Math.random() > 0.42) {
        const warm = Math.random() > 0.55;
        ctx.fillStyle = warm ? '#f5d0a6' : '#9dd7ff';
        ctx.globalAlpha = 0.28 + Math.random() * 0.55;
        ctx.fillRect(x, y, 3, 4);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeLabel(text, color) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);
  roundRect(ctx, 36, 24, 440, 80, 40);
  ctx.fillStyle = 'rgba(8,10,24,0.82)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.font = '600 42px Outfit, Inter, sans-serif';
  ctx.fillStyle = '#f4f7fb';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  sprite.scale.set(7.2, 1.8, 1);
  return sprite;
}

function canvasHoloTex(draw) {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeLinkedInTex() {
  return canvasHoloTex((ctx, size) => {
    const m = 58;
    roundRect(ctx, m, m, size - m * 2, size - m * 2, 78);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.font = '700 210px Outfit, Arial Black, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('in', size / 2 + 8, size / 2 + 18);
  });
}

function makeGitHubTex() {
  return canvasHoloTex((ctx, size) => {
    const pad = 52;
    const s = (size - pad * 2) / 98;
    ctx.save();
    ctx.translate(pad, pad + (size - pad * 2 - 96 * s) / 2);
    ctx.scale(s, s);
    const p = new Path2D(
      'M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z'
    );
    ctx.fillStyle = '#fff';
    ctx.fill(p);
    ctx.restore();
  });
}

function loadPortfolioTex() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const tex = canvasHoloTex((ctx, size) => {
        const pad = 36;
        const scale = Math.min((size - pad * 2) / img.width, (size - pad * 2) / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
      });
      resolve(tex);
    };
    img.onerror = () => resolve(makeLinkedInTex());
    img.src = 'img/logo.svg';
  });
}

function loadHoloTextures() {
  return loadPortfolioTex().then((portfolio) => ({
    linkedin: makeLinkedInTex(),
    github: makeGitHubTex(),
    portfolio,
  }));
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(110, 72),
  new THREE.MeshStandardMaterial({ color: 0x0a0d18, roughness: 1, metalness: 0 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const plaza = new THREE.Mesh(
  new THREE.CircleGeometry(TRACK_INNER - 1.4, 64),
  new THREE.MeshStandardMaterial({
    color: 0x101427,
    roughness: 0.55,
    metalness: 0.25,
    emissive: 0x0b1a33,
    emissiveIntensity: 0.35,
  })
);
plaza.rotation.x = -Math.PI / 2;
plaza.position.y = 0.02;
plaza.receiveShadow = true;
scene.add(plaza);

const road = new THREE.Mesh(
  new THREE.RingGeometry(TRACK_INNER, TRACK_OUTER, 128, 1),
  new THREE.MeshStandardMaterial({
    color: 0x22283f,
    roughness: 0.78,
    metalness: 0.12,
  })
);
road.rotation.x = -Math.PI / 2;
road.position.y = 0.03;
road.receiveShadow = true;
scene.add(road);

const curbMatIn = new THREE.MeshStandardMaterial({
  color: 0x38bdf8,
  emissive: 0x38bdf8,
  emissiveIntensity: 1.35,
  roughness: 0.35,
});
const curbMatOut = new THREE.MeshStandardMaterial({
  color: 0x818cf8,
  emissive: 0x818cf8,
  emissiveIntensity: 1.15,
  roughness: 0.35,
});
function addCurb(radius, mat) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.07, 8, 160), mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.y = 0.09;
  scene.add(mesh);
}
addCurb(TRACK_INNER, curbMatIn);
addCurb(TRACK_OUTER, curbMatOut);

const dashCount = mobile ? 48 : 72;
const dashGeo = new THREE.PlaneGeometry(0.16, 1.35);
dashGeo.rotateX(-Math.PI / 2);
const dashes = new THREE.InstancedMesh(
  dashGeo,
  new THREE.MeshBasicMaterial({ color: 0xd6e4ff, transparent: true, opacity: 0.55 }),
  dashCount
);
for (let i = 0; i < dashCount; i++) {
  const a = (i / dashCount) * Math.PI * 2;
  dummy.position.set(Math.cos(a) * TRACK_MID, 0.045, Math.sin(a) * TRACK_MID);
  dummy.rotation.set(0, -a, 0);
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
  dashes.setMatrixAt(i, dummy.matrix);
}
scene.add(dashes);

const dais = new THREE.Mesh(
  new THREE.CylinderGeometry(5.6, 6.1, 0.28, 48),
  new THREE.MeshStandardMaterial({
    color: 0x12182c,
    metalness: 0.45,
    roughness: 0.3,
    emissive: 0x1d4ed8,
    emissiveIntensity: 0.12,
  })
);
dais.position.y = 0.16;
dais.castShadow = true;
scene.add(dais);

const hoverRing = new THREE.Mesh(
  new THREE.TorusGeometry(3.8, 0.045, 10, 80),
  new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.1,
    metalness: 0.4,
    roughness: 0.25,
  })
);
hoverRing.rotation.x = Math.PI / 2;
hoverRing.position.y = 2.4;
scene.add(hoverRing);

const core = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.55, 0),
  new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.9,
    metalness: 0.6,
    roughness: 0.2,
  })
);
core.position.y = 2.4;
scene.add(core);

const starCount = mobile ? 500 : 1100;
const starPos = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  const a = Math.random() * Math.PI * 2;
  const r = 70 + Math.random() * 90;
  starPos[i * 3] = Math.cos(a) * r;
  starPos[i * 3 + 1] = 12 + Math.random() * 50;
  starPos[i * 3 + 2] = Math.sin(a) * r;
}
const stars = new THREE.BufferGeometry();
stars.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
scene.add(
  new THREE.Points(
    stars,
    new THREE.PointsMaterial({ color: 0xeff6ff, size: 0.28, sizeAttenuation: true, transparent: true, opacity: 0.85 })
  )
);

const buildingCount = mobile ? 42 : 70;
const winTex = makeWindowTexture();
const buildings = new THREE.InstancedMesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({
    map: winTex,
    emissiveMap: winTex,
    emissive: 0xffffff,
    emissiveIntensity: 0.65,
    roughness: 0.88,
    metalness: 0.08,
    color: 0x9fb7d6,
  }),
  buildingCount
);
buildings.castShadow = !lowPower;
buildings.receiveShadow = true;
for (let i = 0; i < buildingCount; i++) {
  const a = (i / buildingCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.08;
  const r = 68 + Math.random() * 26;
  const h = 5 + Math.random() * 26;
  dummy.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
  dummy.scale.set(3.2 + Math.random() * 4.4, h, 3.2 + Math.random() * 4.4);
  dummy.rotation.set(0, a, 0);
  dummy.updateMatrix();
  buildings.setMatrixAt(i, dummy.matrix);
}
scene.add(buildings);

const lampCount = mobile ? 16 : 24;
const lampMat = new THREE.MeshStandardMaterial({
  color: 0x111827,
  roughness: 0.5,
  metalness: 0.4,
});
const lampGlow = new THREE.MeshStandardMaterial({
  color: 0xf8fafc,
  emissive: 0xbfdbfe,
  emissiveIntensity: 1.4,
});
const lamps = new THREE.Group();
for (let i = 0; i < lampCount; i++) {
  const a = (i / lampCount) * Math.PI * 2;
  const r = TRACK_OUTER + 1.2;
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 3.5, 6), lampMat);
  pole.position.y = 1.75;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.1), lampMat);
  arm.position.set(0, 3.46, -1.0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), lampGlow);
  head.position.set(0, 3.22, -1.95);
  g.add(pole, arm, head);
  g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  g.lookAt(0, 0, 0);
  lamps.add(g);
}
scene.add(lamps);

function createCar() {
  const car = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.72,
    roughness: 0.28,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.55,
    metalness: 0.4,
    roughness: 0.32,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x93c5fd,
    transparent: true,
    opacity: 0.38,
    metalness: 0.9,
    roughness: 0.08,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.6, metalness: 0.3 });
  const head = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0xe0f2fe,
    emissiveIntensity: 1.6,
  });
  const tail = new THREE.MeshStandardMaterial({
    color: 0xfb7185,
    emissive: 0xef4444,
    emissiveIntensity: 0.9,
  });

  const lower = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.38, 4.35), body);
  lower.position.y = 0.52;
  lower.castShadow = true;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.52, 2.05), glass);
  cabin.position.set(0, 0.92, -0.18);
  cabin.castShadow = true;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.08, 1.7), body);
  roof.position.set(0, 1.18, -0.22);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 1.35), body);
  hood.position.set(0, 0.74, 1.28);
  hood.rotation.x = 0.08;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 4.2), accent);
  stripe.position.y = 0.73;
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.22, 0.28), dark);
  bumperF.position.set(0, 0.42, 2.18);
  const bumperR = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.22, 0.28), dark);
  bumperR.position.set(0, 0.42, -2.18);
  const hl1 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.08), head);
  hl1.position.set(-0.62, 0.58, 2.2);
  const hl2 = hl1.clone();
  hl2.position.x = 0.62;
  const tl1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.08), tail);
  tl1.position.set(-0.62, 0.58, -2.2);
  const tl2 = tl1.clone();
  tl2.position.x = 0.62;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.28), accent);
  wing.position.set(0, 0.92, -2.05);
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 3.6),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.05;

  const wheels = [];
  const tire = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 18);
  const rim = new THREE.CylinderGeometry(0.22, 0.22, 0.34, 12);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.8, roughness: 0.25 });
  const positions = [
    [-1.05, 0.42, 1.42],
    [1.05, 0.42, 1.42],
    [-1.05, 0.42, -1.42],
    [1.05, 0.42, -1.42],
  ];
  positions.forEach((p) => {
    const w = new THREE.Group();
    const t = new THREE.Mesh(tire, dark);
    const r = new THREE.Mesh(rim, rimMat);
    t.rotation.z = Math.PI / 2;
    r.rotation.z = Math.PI / 2;
    w.add(t, r);
    w.position.set(p[0], p[1], p[2]);
    w.castShadow = true;
    wheels.push(w);
    car.add(w);
  });

  car.add(lower, cabin, roof, hood, stripe, bumperF, bumperR, hl1, hl2, tl1, tl2, wing, glow);
  car.userData.wheels = wheels;
  return car;
}

const car = createCar();
car.position.set(0, 0, TRACK_MID);
car.rotation.y = Math.PI / 2;
scene.add(car);

function createGate(station) {
  const g = new THREE.Group();
  const col = station.color;
  const metal = new THREE.MeshStandardMaterial({
    color: 0x111827,
    metalness: 0.55,
    roughness: 0.32,
    emissive: col,
    emissiveIntensity: 0.08,
  });
  const neon = new THREE.MeshStandardMaterial({
    color: col,
    emissive: col,
    emissiveIntensity: 1.05,
    roughness: 0.3,
  });
  const innerR = TRACK_INNER - 0.55;
  const outerR = TRACK_OUTER + 0.55;
  const a = station.angle;
  const inward = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));

  function pillar(radius) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.28, 5.2, 0.28), metal);
    p.position.set(Math.cos(a) * radius, 2.6, Math.sin(a) * radius);
    p.castShadow = true;
    g.add(p);
  }
  pillar(innerR);
  pillar(outerR);

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(TRACK_OUTER - TRACK_INNER + 1.6, 0.22, 0.32), metal);
  lintel.position.set(inward.x * TRACK_MID, 5.25, inward.z * TRACK_MID);
  lintel.rotation.y = -a;
  lintel.castShadow = true;
  g.add(lintel);

  const strip = new THREE.Mesh(new THREE.BoxGeometry(TRACK_OUTER - TRACK_INNER - 1.6, 0.06, 0.12), neon);
  strip.position.set(inward.x * TRACK_MID, 5.08, inward.z * TRACK_MID);
  strip.rotation.y = -a;
  g.add(strip);

  for (let i = -1; i <= 1; i++) {
    const lr = TRACK_MID + i * 4.2;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), lampGlow);
    bulb.position.set(Math.cos(a) * lr, 4.88, Math.sin(a) * lr);
    g.add(bulb);
  }

  const origin = new THREE.Vector3(inward.x * TRACK_MID, 0, inward.z * TRACK_MID);

  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(2.15, 48),
    new THREE.MeshBasicMaterial({
      color: col,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.copy(origin);
  disc.position.y = 0.06;
  g.add(disc);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 2.45, 64),
    new THREE.MeshBasicMaterial({
      color: col,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(origin);
  ring.position.y = 0.07;
  g.add(ring);

  const innerRing = new THREE.Mesh(
    new THREE.RingGeometry(1.15, 1.28, 48),
    new THREE.MeshBasicMaterial({
      color: col,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.copy(origin);
  innerRing.position.y = 0.08;
  g.add(innerRing);

  const label = makeLabel(station.name, '#' + col.toString(16).padStart(6, '0'));
  label.position.set(inward.x * TRACK_MID, 6.35, inward.z * TRACK_MID);
  g.add(label);

  g.userData = station;
  g.userData.worldPos = origin;
  g.userData.holoRing = innerRing;
  return g;
}

const holos = [];

function attachHolo(gate, tex) {
  const station = gate.userData;
  const origin = station.worldPos;
  const col = new THREE.Color(station.color);
  const holo = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    color: col,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  const h = 2.7;
  const w = h * (station.aspect || 1);
  const geo = new THREE.PlaneGeometry(w, h);
  const plate = new THREE.Mesh(geo, mat);
  const back = new THREE.Mesh(geo, mat);
  back.rotation.y = Math.PI;
  holo.add(plate, back);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.55, 2.8, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: col,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  beam.position.y = -0.7;
  holo.add(beam);

  holo.position.copy(origin);
  holo.position.y = 2.15;
  holo.userData.baseY = 2.15;
  holo.userData.plate = plate;
  gate.add(holo);
  holos.push(holo);
}

const gates = STATIONS.map(createGate);
gates.forEach((g) => scene.add(g));
loadHoloTextures().then((texes) => {
  gates.forEach((g) => {
    const tex = texes[g.userData.id];
    if (tex) attachHolo(g, tex);
  });
});

const keys = new Set();
const joy = { x: 0, y: 0, active: false };
let joyPointer = null;
let near = null;

function openNear() {
  if (near && near.url) window.open(near.url, '_blank', 'noopener,noreferrer');
}

window.addEventListener(
  'keydown',
  (e) => {
    keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.code === 'KeyE') openNear();
  },
  { passive: false }
);
window.addEventListener('keyup', (e) => keys.delete(e.code));
stationOpenBtn.addEventListener('click', openNear);
actionBtn.addEventListener('click', openNear);

function setKnob(x, y) {
  knobEl.style.transform = `translate(${x}px, ${y}px)`;
}

function joyFromEvent(e) {
  const rect = joystickEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = e.clientX - cx;
  let dy = e.clientY - cy;
  const max = rect.width * 0.36;
  const mag = Math.hypot(dx, dy) || 1;
  if (mag > max) {
    dx = (dx / mag) * max;
    dy = (dy / mag) * max;
  }
  setKnob(dx, dy);
  joy.x = dx / max;
  joy.y = dy / max;
}

joystickEl.addEventListener('pointerdown', (e) => {
  joyPointer = e.pointerId;
  joystickEl.setPointerCapture(e.pointerId);
  joy.active = true;
  joyFromEvent(e);
  e.preventDefault();
});
joystickEl.addEventListener('pointermove', (e) => {
  if (!joy.active || e.pointerId !== joyPointer) return;
  joyFromEvent(e);
});
function endJoy(e) {
  if (e.pointerId !== joyPointer) return;
  joy.active = false;
  joy.x = 0;
  joy.y = 0;
  joyPointer = null;
  setKnob(0, 0);
}
joystickEl.addEventListener('pointerup', endJoy);
joystickEl.addEventListener('pointercancel', endJoy);
canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

let speed = 0;
const maxSpeed = mobile ? 14 : 20;
const accel = mobile ? 26 : 30;
const friction = 11;
const turnRate = mobile ? 1.85 : 2.15;
const clock = new THREE.Clock();
let hintFaded = false;

function resize() {
  const { w, h } = viewSize();
  camera.aspect = w / Math.max(h, 1);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
resize();
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);

function drawMinimap() {
  if (!miniCanvas) return;
  const ctx = miniCanvas.getContext('2d');
  const w = miniCanvas.width;
  const h = miniCanvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const scale = (w * 0.38) / TRACK_OUTER;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(8,10,24,0.72)';
  ctx.beginPath();
  ctx.arc(cx, cy, w / 2 - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(226,232,255,0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, w / 2 - 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(125,211,252,0.95)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(cx, cy, TRACK_MID * scale, 0, Math.PI * 2);
  ctx.stroke();
  STATIONS.forEach((st) => {
    ctx.fillStyle = '#' + st.color.toString(16).padStart(6, '0');
    ctx.beginPath();
    ctx.arc(cx + Math.cos(st.angle) * TRACK_MID * scale, cy + Math.sin(st.angle) * TRACK_MID * scale, 5, 0, Math.PI * 2);
    ctx.fill();
  });
  const ang = car.rotation.y;
  ctx.save();
  ctx.translate(cx + car.position.x * scale, cy + car.position.z * scale);
  ctx.rotate(ang);
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 6);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function setNear(station) {
  near = station;
  const ready = !!station;
  stationCard.classList.toggle('hidden', !ready);
  actionBtn.classList.toggle('ready', ready);
  actionBtn.disabled = !ready;
  if (station) {
    stationNameEl.textContent = station.name;
    stationDescEl.textContent = station.desc;
  }
}

function animate() {
  requestAnimationFrame(animate);
  if (document.hidden) return;
  const dt = Math.min(clock.getDelta(), 0.033);
  const t = clock.getElapsedTime();

  let throttle = 0;
  let steer = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) throttle += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) throttle -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) steer -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) steer += 1;
  if (joy.active) {
    throttle = THREE.MathUtils.clamp(-joy.y, -1, 1);
    steer = THREE.MathUtils.clamp(joy.x, -1, 1);
    if (Math.abs(throttle) < 0.12) throttle = 0;
    if (Math.abs(steer) < 0.12) steer = 0;
  }

  if (throttle !== 0) speed += throttle * accel * dt;
  else {
    if (speed > 0) speed = Math.max(0, speed - friction * dt);
    if (speed < 0) speed = Math.min(0, speed + friction * dt);
  }
  speed = THREE.MathUtils.clamp(speed, -maxSpeed * 0.45, maxSpeed);

  const wrap = (d) => {
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  };

  if (Math.abs(speed) > 0.2) {
    const dir = speed > 0 ? 1 : -1;
    car.rotation.y -= steer * turnRate * dir * dt;
  }

  const posA = Math.atan2(car.position.z, car.position.x);
  const cwYaw = Math.atan2(Math.sin(posA), -Math.cos(posA));
  const ccwYaw = Math.atan2(-Math.sin(posA), Math.cos(posA));
  const railYaw =
    Math.abs(wrap(cwYaw - car.rotation.y)) <= Math.abs(wrap(ccwYaw - car.rotation.y))
      ? cwYaw
      : ccwYaw;
  if (Math.abs(steer) < 0.18 && Math.abs(speed) > 1.2) {
    car.rotation.y += wrap(railYaw - car.rotation.y) * Math.min(1, 2.4 * dt);
  }

  tmp.set(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y));
  car.position.addScaledVector(tmp, speed * dt);

  const r = Math.hypot(car.position.x, car.position.z) || 1;
  if (r > DRIVE_OUTER) {
    car.position.x *= DRIVE_OUTER / r;
    car.position.z *= DRIVE_OUTER / r;
    speed *= 0.82;
  } else if (r < DRIVE_INNER) {
    car.position.x *= DRIVE_INNER / r;
    car.position.z *= DRIVE_INNER / r;
    speed *= 0.82;
  }
  car.position.y = 0;

  camPos.copy(camOffset).applyAxisAngle(tmp.set(0, 1, 0), car.rotation.y).add(car.position);
  lookPos.copy(lookOffset).applyAxisAngle(tmp.set(0, 1, 0), car.rotation.y).add(car.position);
  const follow = 1 - Math.exp(-16 * dt);
  camera.position.lerp(camPos, follow);
  camera.lookAt(lookPos);
  const wantFov = (mobile ? 62 : 54) + Math.abs(speed) * 0.22;
  camera.fov += (wantFov - camera.fov) * 0.06;
  camera.updateProjectionMatrix();

  let closest = null;
  let closestDist = 14;
  for (let i = 0; i < STATIONS.length; i++) {
    const st = STATIONS[i];
    const dx = car.position.x - Math.cos(st.angle) * TRACK_MID;
    const dz = car.position.z - Math.sin(st.angle) * TRACK_MID;
    const d = Math.hypot(dx, dz);
    if (d < closestDist) {
      closestDist = d;
      closest = st;
    }
  }
  if (closest !== near) setNear(closest);

  hoverRing.position.y = 2.35 + Math.sin(t * 1.15) * 0.18;
  hoverRing.rotation.z = t * 0.25;
  core.rotation.y = t * 0.7;
  core.rotation.x = t * 0.35;
  for (let i = 0; i < holos.length; i++) {
    const h = holos[i];
    h.rotation.y = t * 0.95 + i * 0.8;
    h.position.y = h.userData.baseY + Math.sin(t * 1.7 + i) * 0.12;
    if (h.userData.plate) {
      h.userData.plate.material.opacity = 0.78 + Math.sin(t * 3.2 + i) * 0.14;
    }
  }
  for (let i = 0; i < gates.length; i++) {
    const ring = gates[i].userData.holoRing;
    if (ring) ring.rotation.z = t * 0.9 + i;
  }
  car.userData.wheels.forEach((w) => {
    w.rotation.x += speed * dt * 1.55;
  });

  if (!hintFaded && t > 12 && hintEl) {
    hintEl.classList.add('faded');
    hintFaded = true;
  }

  drawMinimap();
  renderer.render(scene, camera);
  if (t > 0.15 && loadingEl && !loadingEl.classList.contains('hidden')) {
    loadingEl.classList.add('hidden');
  }
}

try {
  camera.position.copy(camOffset).applyAxisAngle(new THREE.Vector3(0, 1, 0), car.rotation.y).add(car.position);
  camera.lookAt(car.position.x, 1.4, car.position.z);
  animate();
} catch (err) {
  console.error(err);
  fallbackEl.hidden = false;
  loadingEl.classList.add('hidden');
}
