// WODY in real 3D: a procedural dragon built with three.js (lofted body, neck and tail, skinned-style wings with finger bones and a membrane,
// a head with a jaw, horns, fangs and glowing eyes, four legs with claws, back spikes) lit with a key light, a coloured rim light and soft
// fill, with scaled PBR skin, a living flight cycle and an elemental breath made of particles. Everything is generated in code, no model files.
import * as THREE from 'three';

const PAL = {
  fire:   { skin: '#c4421c', dark: '#3a0e07', belly: '#f0b868', wing: '#a52d12', wingTip: '#ff8a3a', horn: '#f3dcae', eye: '#ffd24a', glow: '#ff6a1f', fx: ['#fff3b0', '#ff9a2a', '#e0360d', '#400a04'] },
  ice:    { skin: '#4fa6d8', dark: '#0e2a4a', belly: '#eefaff', wing: '#4a92c9', wingTip: '#d6f3ff', horn: '#ffffff', eye: '#eaffff', glow: '#6fdcff', fx: ['#ffffff', '#b9f0ff', '#58c4f0', '#0e3a66'] },
  storm:  { skin: '#4e62d8', dark: '#111a58', belly: '#dfe6ff', wing: '#3345a8', wingTip: '#b9c8ff', horn: '#f4f6ff', eye: '#ffffff', glow: '#8aa6ff', fx: ['#ffffff', '#c4d2ff', '#6f86ff', '#18236b'] },
  shadow: { skin: '#4d2a86', dark: '#10061f', belly: '#6a3fb0', wing: '#2a1250', wingTip: '#9b6af0', horn: '#d9c3ff', eye: '#ff3b5c', glow: '#8b3fd9', fx: ['#f0d4ff', '#b06cff', '#5e22b0', '#14052a'] },
  nature: { skin: '#2fa860', dark: '#08240f', belly: '#efe39c', wing: '#1f6b3a', wingTip: '#8ff0a6', horn: '#fff0b4', eye: '#fff2a0', glow: '#e6c35a', fx: ['#faffc4', '#b6f07a', '#3fb64a', '#0b3a14'] },
};

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function scaleTextures(skin, dark) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  const b = document.createElement('canvas'); b.width = 256; b.height = 256; const h = b.getContext('2d');
  g.fillStyle = skin; g.fillRect(0, 0, 256, 256); h.fillStyle = '#404040'; h.fillRect(0, 0, 256, 256);
  const cols = 10; const rows = 18; const sw = 256 / cols; const rs = 256 / rows;
  for (let r = 0; r < rows; r += 1) {
    for (let k = 0; k < cols; k += 1) {
      for (const [ox, oy] of [[0, 0], [-256, 0], [256, 0], [0, -256], [0, 256], [-256, -256], [256, 256], [-256, 256], [256, -256]]) {
        const x = k * sw + (r % 2 ? sw / 2 : 0) + ox; const y = r * rs + oy; if (x < -40 || x > 296 || y < -40 || y > 296) continue;
        const gr = g.createRadialGradient(x, y - rs * 0.2, 1, x, y, sw * 0.6);
        gr.addColorStop(0, 'rgba(255,255,255,0.3)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.02)'); gr.addColorStop(1, dark);
        g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, sw * 0.56, rs * 1.0, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.6; g.stroke();
        const hg = h.createRadialGradient(x, y - rs * 0.15, 1, x, y, sw * 0.6); hg.addColorStop(0, '#ffffff'); hg.addColorStop(0.7, '#8a8a8a'); hg.addColorStop(1, '#000000');
        h.fillStyle = hg; h.beginPath(); h.ellipse(x, y, sw * 0.56, rs * 1.0, 0, 0, Math.PI * 2); h.fill();
      }
    }
  }
  const map = new THREE.CanvasTexture(c); const bump = new THREE.CanvasTexture(b);
  for (const t of [map, bump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, bump };
}

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}

// a tapered, elliptical tube along a curve, rebuilt every frame so the body can flex
function makeTube(rings, sides) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array((rings + 1) * (sides + 1) * 3); const uv = new Float32Array((rings + 1) * (sides + 1) * 2); const col = new Float32Array((rings + 1) * (sides + 1) * 3);
  const idx = [];
  for (let i = 0; i <= rings; i += 1) for (let j = 0; j <= sides; j += 1) { uv[(i * (sides + 1) + j) * 2] = (j / sides) * 3; uv[(i * (sides + 1) + j) * 2 + 1] = (i / rings) * 12; }
  for (let i = 0; i < rings; i += 1) for (let j = 0; j < sides; j += 1) { const a = i * (sides + 1) + j; const b = a + sides + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setIndex(idx);
  return geo;
}

function limb(mat, clawMat, r0, r1) {
  const g = new THREE.Group(); const up = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, 1, 10), mat); const lo = new THREE.Mesh(new THREE.CylinderGeometry(r1 * 0.55, r1, 1, 10), mat);
  const foot = new THREE.Mesh(new THREE.SphereGeometry(r1 * 0.9, 10, 8), mat); g.add(up, lo, foot);
  const claws = [];
  for (let i = -1; i <= 1; i += 1) { const c = new THREE.Mesh(new THREE.ConeGeometry(r1 * 0.22, r1 * 1.5, 6), clawMat); g.add(c); claws.push(c); c.userData.k = i; }
  return { g, up, lo, foot, claws };
}

function between(mesh, a, b) { // place a unit-height cylinder from a to b
  const d = b.clone().sub(a); const len = d.length() || 0.001; mesh.position.copy(a).add(b).multiplyScalar(0.5); mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
}

export function createDragon(container, { element = 'fire', animate = true, onReady, onFail } = {}) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' }); } catch (e) { if (onFail) onFail(e); return { dispose() {}, breathe() {} }; }
  const pal = PAL[element] || PAL.fire;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block'; container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 3 / 4, 0.1, 100); camera.position.set(0.2, 0.5, 17.5); camera.lookAt(-0.55, 0.45, 0);
  scene.add(new THREE.HemisphereLight(0xbfd2ff, 0x2a1410, 0.75));
  const key = new THREE.DirectionalLight(0xfff0e0, 2.6); key.position.set(-4, 7, 8); scene.add(key);
  const rim = new THREE.DirectionalLight(new THREE.Color(pal.glow), 2.4); rim.position.set(6, 3, -6); scene.add(rim);
  const under = new THREE.PointLight(new THREE.Color(pal.glow), 6, 9); under.position.set(-1, -1, 3); scene.add(under);
  const mouthLight = new THREE.PointLight(new THREE.Color(pal.glow), 0, 8); scene.add(mouthLight);

  const { map, bump } = scaleTextures(pal.skin, pal.dark);
  const skinMat = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.1, roughness: 0.5, metalness: 0.18, vertexColors: true });
  const solid = (hex, rough = 0.45, metal = 0.1) => new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal });
  const legMat = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1, roughness: 0.5, metalness: 0.15, color: pal.skin });
  const hornMat = solid(pal.horn, 0.35, 0.2); const clawMat = solid(pal.horn, 0.3, 0.25);
  const wingMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide, transparent: true, opacity: 0.94, emissive: new THREE.Color(pal.wing), emissiveIntensity: 0.12 });
  const boneMat = solid(pal.dark, 0.5, 0.15); const eyeMat = new THREE.MeshBasicMaterial({ color: pal.eye });

  const root = new THREE.Group(); scene.add(root);
  const RINGS = 120; const SIDES = 22;
  const bodyGeo = makeTube(RINGS, SIDES); const body = new THREE.Mesh(bodyGeo, skinMat); body.frustumCulled = false; root.add(body);

  // head
  const head = new THREE.Group(); root.add(head);
  const ell = (sx, sy, sz, x, y, z, mat = skinMat) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); return m; };
  const headMat = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1, roughness: 0.5, metalness: 0.18, color: pal.skin });
  head.add(ell(0.62, 0.4, 0.42, 0, 0, 0, headMat), ell(0.7, 0.25, 0.28, -0.62, -0.06, 0, headMat));
  head.add(ell(0.2, 0.1, 0.3, -0.12, 0.3, 0, headMat));
  const jaw = new THREE.Group(); jaw.position.set(-0.05, -0.2, 0); head.add(jaw);
  jaw.add(ell(0.66, 0.13, 0.24, -0.5, -0.06, 0, headMat));
  const teeth = [];
  const tooth = (x, y, z, h, flip, parent) => { const t = new THREE.Mesh(new THREE.ConeGeometry(0.035, h, 6), solid('#fff8ea', 0.3)); t.position.set(x, y, z); if (flip) t.rotation.z = Math.PI; parent.add(t); teeth.push(t); };
  for (let i = 0; i < 9; i += 1) for (const s of [-1, 1]) { tooth(-0.2 - i * 0.1, -0.2, s * (0.17 - i * 0.008), i % 3 === 0 ? 0.2 : 0.12, true, head); if (i > 0) tooth(-0.2 - i * 0.1, 0.02, s * (0.15 - i * 0.006), i % 3 === 1 ? 0.17 : 0.1, false, jaw); }
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), eyeMat); e.position.set(-0.3, 0.12, s * 0.33); e.scale.set(1.5, 0.7, 0.6); e.rotation.y = s * 0.2; head.add(e); eyes.push(e);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.11), solid(pal.dark, 0.5)); lid.position.set(-0.3, 0.2, s * 0.34); lid.rotation.z = -0.38; lid.rotation.x = -s * 0.12; head.add(lid);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 1.15, 10), hornMat); horn.position.set(0.5, 0.45, s * 0.22); horn.rotation.z = -1.15; horn.rotation.x = s * 0.35; head.add(horn);
    const horn2 = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.6, 8), hornMat); horn2.position.set(0.28, 0.12, s * 0.4); horn2.rotation.z = -1.7; horn2.rotation.x = s * 0.9; head.add(horn2);
    for (let k = 0; k < 3; k += 1) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.2 - k * 0.03, 6), hornMat); sp.position.set(0.1 - k * 0.2, -0.25, s * (0.36 - k * 0.03)); sp.rotation.z = Math.PI * 0.8; sp.rotation.x = s * 0.7; head.add(sp); }
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), solid('#000')); nostril.position.set(-1.28, 0.02, s * 0.1); head.add(nostril);
  }
  for (let k = 0; k < 4; k += 1) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 6), hornMat); sp.position.set(-0.25 - k * 0.18, 0.2 - k * 0.012, 0); head.add(sp); }
  head.scale.setScalar(1.45);

  // spikes along the spine
  const spikes = []; for (let i = 0; i < 26; i += 1) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.4, 7), hornMat); root.add(sp); spikes.push(sp); }
  // legs
  const hind = [1, -1].map((s) => { const l = limb(legMat, clawMat, 0.3, 0.2); root.add(l.g); l.s = s; return l; });
  const fore = [1, -1].map((s) => { const l = limb(legMat, clawMat, 0.2, 0.14); root.add(l.g); l.s = s; return l; });
  // wings
  const makeWing = (s) => {
    const g = new THREE.Group(); root.add(g);
    const parts = { s, g, arm: [new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 1, 8), boneMat), new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1, 8), boneMat)], fingers: [], mem: null, thumb: new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.6, 8), hornMat) };
    for (let i = 0; i < 4; i += 1) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.05 - i * 0.004, 1, 6), boneMat); parts.fingers.push(f); g.add(f); }
    g.add(...parts.arm, parts.thumb);
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9 * 3 * 3 * 3), 3)); mg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(9 * 3 * 3 * 3), 3));
    parts.mem = new THREE.Mesh(mg, wingMat); parts.mem.frustumCulled = false; g.add(parts.mem); return parts;
  };
  const wings = [makeWing(1), makeWing(-1)];

  // breath particles
  const N = 260; const pg = new THREE.BufferGeometry(); const pp = new Float32Array(N * 3); const pc = new Float32Array(N * 3); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.55, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true })); pts.frustumCulled = false; scene.add(pts);
  const life = new Float32Array(N); const vel = Array.from({ length: N }, () => V(0, 0, 0)); const fxCols = pal.fx.map((h) => new THREE.Color(h)); let breath = 0; let emitCarry = 0;
  for (let i = 0; i < N; i += 1) { life[i] = 0; pp[i * 3 + 1] = -99; }

  const tmp = { p: [], n: V(0, 0, 1) };
  const baseSpine = [V(-1.7, 3.55, 0), V(-1.45, 3.1, 0), V(-1.05, 2.4, 0), V(-0.45, 1.7, 0), V(0.15, 1.1, 0), V(0.65, 0.5, 0), V(1.05, -0.15, 0), V(1.35, -0.85, 0.05), V(1.55, -1.6, 0.3), V(1.3, -2.3, 0.6), V(0.7, -2.75, 0.75), V(0.05, -2.8, 0.6), V(-0.45, -2.5, 0.45)];
  const radius = (t) => { const k = [[0, 0.16], [0.08, 0.2], [0.22, 0.3], [0.38, 0.5], [0.5, 0.62], [0.6, 0.56], [0.68, 0.4], [0.8, 0.24], [0.92, 0.13], [1, 0.02]]; for (let i = 1; i < k.length; i += 1) if (t <= k[i][0]) { const f = (t - k[i - 1][0]) / (k[i][0] - k[i - 1][0]); return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * f; } return 0.02; };
  const cDark = new THREE.Color(pal.dark); const cSkin = new THREE.Color(pal.skin); const cBelly = new THREE.Color(pal.belly); const cTmp = new THREE.Color();

  const frame = (t) => {
    const flap = Math.sin(t * 2.3); const bob = Math.sin(t * 1.15);
    root.position.y = bob * 0.16; root.rotation.z = bob * 0.012;
    const spine = baseSpine.map((p, i) => { const f = i / (baseSpine.length - 1); return V(p.x + Math.sin(t * 1.3 - f * 3) * 0.04 * f, p.y + Math.sin(t * 2.3 - f * 2) * 0.03 + (f > 0.55 ? Math.sin(t * 1.7 - f * 4) * 0.07 * (f - 0.45) : 0), p.z + Math.sin(t * 1.5 - f * 5) * (f > 0.5 ? 0.45 * (f - 0.45) : 0.05)); });
    spine[0].x += Math.sin(t * 0.9) * 0.05; spine[1].x += Math.sin(t * 0.9 - 0.4) * 0.05;
    const curve = new THREE.CatmullRomCurve3(spine, false, 'catmullrom', 0.5);
    const pos = bodyGeo.attributes.position.array; const col = bodyGeo.attributes.color.array; const pt = V(0, 0, 0); const tg = V(0, 0, 0); const side = V(0, 0, 1); const nrm = V(0, 0, 0);
    for (let i = 0; i <= RINGS; i += 1) {
      const u = i / RINGS; curve.getPointAt(u, pt); curve.getTangentAt(u, tg); nrm.crossVectors(side, tg).normalize();
      const r = radius(u) * (1 + (u > 0.3 && u < 0.62 ? Math.sin(t * 1.15 + 1) * 0.025 : 0)); const wz = u < 0.36 ? 1 : 1.12; const hy = u > 0.4 && u < 0.7 ? 1.06 : 0.9;
      for (let j = 0; j <= SIDES; j += 1) {
        const a = (j / SIDES) * Math.PI * 2; const ca = Math.cos(a); const sa = Math.sin(a); const k = (i * (SIDES + 1) + j) * 3;
        pos[k] = pt.x + nrm.x * sa * r * hy + side.x * ca * r * wz; pos[k + 1] = pt.y + nrm.y * sa * r * hy + side.y * ca * r * wz; pos[k + 2] = pt.z + nrm.z * sa * r * hy + side.z * ca * r * wz;
        const belly = Math.max(0, -sa + (u > 0.12 && u < 0.7 ? 0 : -0.35)); cTmp.copy(cSkin).lerp(cBelly, Math.min(1, belly ** 2.2 * (u > 0.7 ? 0 : 1))).lerp(cDark, Math.max(0, sa * -0.0) + (1 - Math.min(1, 0.55 + sa * 0.5)) * 0.35);
        col[k] = cTmp.r; col[k + 1] = cTmp.g; col[k + 2] = cTmp.b;
      }
    }
    bodyGeo.attributes.position.needsUpdate = true; bodyGeo.attributes.color.needsUpdate = true; bodyGeo.computeVertexNormals();
    // head follows the first point of the spine
    curve.getPointAt(0.0, pt); curve.getTangentAt(0.0, tg); const dir = tg.clone().negate();
    head.position.copy(pt).addScaledVector(dir, 0.12); const want = V(-1, 0.05, 0).lerp(dir, 0.35).normalize(); head.quaternion.setFromUnitVectors(V(-1, 0, 0), want);
    head.rotateZ(Math.sin(t * 0.9) * 0.05);
    const open = breath > 0 ? 0.55 + Math.sin(t * 12) * 0.05 : Math.max(0, Math.sin(t * 0.7 - 1.2)) * 0.12 + 0.03; jaw.rotation.z = open;
    // spikes
    spikes.forEach((sp, i) => { const u = 0.04 + (i / spikes.length) * 0.92; curve.getPointAt(u, pt); curve.getTangentAt(u, tg); nrm.crossVectors(side, tg).normalize(); const r = radius(u) * 0.95; const s = (1 - u * 0.55) * (u > 0.12 ? 1 : 0.6); sp.position.copy(pt).addScaledVector(nrm, -r * -0.0).addScaledVector(V(0, 0, 0), 1); sp.position.add(nrm.clone().multiplyScalar(r * (-1 * 0 + 1) * (nrm.y > 0 ? 1 : -1) * 0.9)); sp.scale.setScalar(s); sp.quaternion.setFromUnitVectors(V(0, 1, 0), nrm.y > 0 ? nrm : nrm.clone().negate()); });
    // legs
    const hip = curve.getPointAt(0.52); const chest = curve.getPointAt(0.36);
    const placeLeg = (l, anchor, foot, knee, sz) => { const a = anchor.clone().add(V(0, 0, l.s * sz)); const f = foot.clone().add(V(0, 0, l.s * (sz + 0.18))); const k = knee.clone().add(V(0, 0, l.s * (sz + 0.3))); between(l.up, a, k); between(l.lo, k, f); l.foot.position.copy(f); l.claws.forEach((c) => { c.position.copy(f).add(V(-0.26, -0.12, c.userData.k * 0.12)); c.rotation.z = Math.PI / 2 + 0.5; }); };
    const dang = Math.sin(t * 1.15 + 0.6) * 0.07;
    hind.forEach((l) => placeLeg(l, hip.clone().add(V(0.1, -0.1, 0)), V(0.55 + dang, -1.95, 0), V(1.55, -0.95, 0), 0.38));
    fore.forEach((l) => placeLeg(l, chest.clone().add(V(-0.05, -0.1, 0)), V(-0.5 + dang, 0.15, 0), V(-0.15, 0.15 + 0.5, 0), 0.28));
    // wings
    const ws = curve.getPointAt(0.4);
    wings.forEach((w) => {
      const s = w.s; w.g.scale.setScalar(0.72); w.g.position.copy(ws).add(V(0.05, 0.42, s * 0.2)); const fl = flap * 0.5 + 0.12; w.g.rotation.set(s * -fl * 0.9, s * 0.16 * -1 + s * 0.14 * -fl, 0);
      const spread = 0.5 + (flap + 1) * 0.12; const S = V(0, 0, 0); const E = V(0.55, 0.95, s * 0.42); const W = V(1.25, 2.2, s * 0.55);
      const L = [2.5, 2.9, 2.7, 2.1]; const base = [1.35, 0.98, 0.55, 0.05];
      const tips = L.map((len, i) => { const a = base[i] - (1 - spread) * 0.35 * (i + 1) * 0.3; return W.clone().add(V(Math.cos(a) * len, Math.sin(a) * len + Math.sin(t * 2.3 - i * 0.6) * 0.12 * i, s * (0.35 + i * 0.28))); });
      const B = V(0.2, -1.0 - 0.15, 0.0);
      between(w.arm[0], S, E); between(w.arm[1], E, W); w.fingers.forEach((f, i) => between(f, W, tips[i]));
      w.thumb.position.copy(W).add(V(-0.05, 0.22, 0)); w.thumb.rotation.z = 0.5;
      const verts = []; const colors = []; const cs = new THREE.Color(pal.wing); const ct = new THREE.Color(pal.wingTip); const cb = new THREE.Color(pal.dark);
      const sc = (a, b, f) => a.clone().lerp(b, f);
      const mids = tips.slice(0, 3).map((p, i) => sc(sc(p, tips[i + 1], 0.5), W, 0.28)); const midB = sc(sc(tips[3], B, 0.5), W, 0.22);
      const tri = (p, q, r) => { for (const v of [p, q, r]) { verts.push(v.x, v.y, v.z); const d = v.distanceTo(W) / 3.2; cTmp.copy(cs).lerp(ct, Math.min(1, d)); if (v.distanceTo(S) < 1.1) cTmp.lerp(cb, 0.6); colors.push(cTmp.r, cTmp.g, cTmp.b); } };
      tri(W, tips[0], mids[0]); tri(W, mids[0], tips[1]); tri(W, tips[1], mids[1]); tri(W, mids[1], tips[2]); tri(W, tips[2], mids[2]); tri(W, mids[2], tips[3]); tri(W, tips[3], midB); tri(W, midB, B); tri(W, B, S); tri(W, S, E);
      const mpos = w.mem.geometry.attributes.position; const mcol = w.mem.geometry.attributes.color; mpos.array.fill(0); mcol.array.fill(0); mpos.array.set(verts); mcol.array.set(colors); mpos.needsUpdate = true; mcol.needsUpdate = true; w.mem.geometry.setDrawRange(0, verts.length / 3); w.mem.geometry.computeVertexNormals();
    });
    eyes.forEach((e) => { e.scale.y = 0.7 * (Math.sin(t * 0.5) > 0.985 ? 0.1 : 1); });
    // breath
    const m = V(-1.6, -0.05, 0).applyMatrix4(head.matrixWorld); const hd = V(-1, 0, 0).transformDirection(head.matrixWorld);
    mouthLight.position.copy(m); mouthLight.intensity = breath > 0 ? 8 + Math.random() * 3 : 0;
    return { m, hd };
  };

  const size = () => { const w = container.clientWidth || 300; const h = container.clientHeight || 400; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = 34; camera.updateProjectionMatrix(); };
  size(); const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(size) : null; if (ro) ro.observe(container);
  const mouse = { x: 0 }; const onMove = (e) => { mouse.x = (e.clientX / window.innerWidth - 0.5) * 2; };
  if (animate) window.addEventListener('pointermove', onMove, { passive: true });

  const clock = new THREE.Clock(); let raf = 0; let started = false; let nextBreath = 3.5; let t = animate ? 0 : 1.6; let last = null;
  const emit = (dt) => {
    emitCarry += dt * 150; const want = Math.floor(emitCarry); emitCarry -= want; let n = want;
    for (let i = 0; i < N && n > 0; i += 1) if (life[i] <= 0) {
      n -= 1; life[i] = 0.7 + Math.random() * 0.6; const sp = 5 + Math.random() * 3.5; const jx = (Math.random() - 0.5) * 0.9; const jy = (Math.random() - 0.5) * 0.9; const jz = (Math.random() - 0.5) * 0.9;
      pp[i * 3] = last.m.x; pp[i * 3 + 1] = last.m.y; pp[i * 3 + 2] = last.m.z; vel[i].set(last.hd.x * sp + jx, last.hd.y * sp + jy + 0.3, last.hd.z * sp + jz);
    }
  };
  const tick = () => {
    const dt = Math.min(clock.getDelta(), 0.05); if (animate) t += dt;
    root.rotation.y = -0.55 + (animate ? mouse.x * 0.15 : 0);
    if (animate) { nextBreath -= dt; if (nextBreath <= 0 && breath <= 0) { breath = 1.5; nextBreath = 7 + Math.random() * 3; } }
    last = frame(t);
    if (breath > 0) { breath -= dt; emit(dt); }
    for (let i = 0; i < N; i += 1) {
      if (life[i] > 0) {
        life[i] -= dt; vel[i].multiplyScalar(0.985); vel[i].y += dt * 0.9; pp[i * 3] += vel[i].x * dt; pp[i * 3 + 1] += vel[i].y * dt; pp[i * 3 + 2] += vel[i].z * dt;
        const f = Math.max(0, life[i]) / 1.3; const k = Math.min(3, Math.floor((1 - f) * 4)); const c = fxCols[k]; const fade = Math.min(1, f * 2.2); pc[i * 3] = c.r * fade; pc[i * 3 + 1] = c.g * fade; pc[i * 3 + 2] = c.b * fade;
      } else { pc[i * 3] = pc[i * 3 + 1] = pc[i * 3 + 2] = 0; }
    }
    pg.attributes.position.needsUpdate = true; pg.attributes.color.needsUpdate = true;
    renderer.render(scene, camera);
    if (!started) { started = true; if (onReady) onReady(); }
    if (animate) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); } else if (animate) { clock.getDelta(); raf = requestAnimationFrame(tick); } };
  document.addEventListener('visibilitychange', onVis);
  const onLost = (e) => { e.preventDefault(); cancelAnimationFrame(raf); if (onFail) onFail(new Error('context lost')); };
  renderer.domElement.addEventListener('webglcontextlost', onLost);

  return {
    breathe() { if (breath <= 0) breath = 1.5; },
    dispose() {
      cancelAnimationFrame(raf); if (ro) ro.disconnect(); window.removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', onVis);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); [map, bump, skinMat, wingMat].forEach((x) => x.dispose()); renderer.dispose();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
    },
  };
}
