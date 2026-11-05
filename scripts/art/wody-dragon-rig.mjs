// WODY, the Wody dragon, as a layered rig: separate transparent layers (far wing, tail, body, head, jaw, near wing) that the theme engine
// animates (wing beats, hovering, breathing, tail sway, the jaw opening for the breath). Drawn from vector shapes with lit, scaled skin,
// so the project owns the artwork. Run: node scripts/art/wody-dragon-rig.mjs
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';

const W = 1200; const H = 1600;
const P = {
  fire:   { skin: ['#2a0b06', '#7c1f0d', '#c4421c', '#ff9b4a'], belly: ['#f6c27a', '#b8601f'], wing: ['#2b0905', '#8a2610', '#ff7a2e'], bone: '#3a0f08', horn: ['#fbe3b0', '#8d5a28'], eye: '#ffe27a', glow: '#ff6a1f', fx: 'cracks', mouth: '#ff7a1a' },
  ice:    { skin: ['#0b1c33', '#245585', '#4fa6d8', '#dff6ff'], belly: ['#f2fbff', '#9ccbe6'], wing: ['#0d2a4d', '#4a92c9', '#cdeeff'], bone: '#16385e', horn: ['#ffffff', '#8ec5e6'], eye: '#e9fbff', glow: '#6fdcff', fx: 'frost', mouth: '#9fe8ff' },
  storm:  { skin: ['#0b0f2a', '#232c78', '#4e62d8', '#b5c4ff'], belly: ['#dfe6ff', '#8a98e6'], wing: ['#0c1136', '#3345a8', '#9db0ff'], bone: '#151b52', horn: ['#f4f6ff', '#7f8fd0'], eye: '#ffffff', glow: '#8aa6ff', fx: 'bolts', mouth: '#bcd0ff' },
  shadow: { skin: ['#08040f', '#241044', '#4d2a86', '#9b6af0'], belly: ['#5b3596', '#241044'], wing: ['#07030f', '#2a1250', '#7a46d0'], bone: '#12082a', horn: ['#d9c3ff', '#5a3a8a'], eye: '#ff3b5c', glow: '#8b3fd9', fx: 'wisps', mouth: '#a24bff' },
  nature: { skin: ['#06180d', '#17542f', '#2fa860', '#b4eb98'], belly: ['#f1e4a0', '#8fc968'], wing: ['#07220f', '#1f6b3a', '#7fe69a'], bone: '#0c3018', horn: ['#fff0b4', '#a8802a'], eye: '#fff2a0', glow: '#e6c35a', fx: 'moss', mouth: '#ffd96a' },
};

// a tapered tube along a smooth path, drawn as overlapping circles (used for the tail)
function tube(pts, radii, steps = 90) {
  const cr = (p0, p1, p2, p3, t) => 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  const out = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [a, b, c, d] = [pts[Math.max(0, i - 1)], pts[i], pts[i + 1], pts[Math.min(pts.length - 1, i + 2)]];
    for (let s = 0; s < steps / (pts.length - 1); s += 1) {
      const t = s / (steps / (pts.length - 1));
      out.push({ x: cr(a[0], b[0], c[0], d[0], t), y: cr(a[1], b[1], c[1], d[1], t), r: radii[i] + (radii[i + 1] - radii[i]) * t });
    }
  }
  out.push({ x: pts.at(-1)[0], y: pts.at(-1)[1], r: radii.at(-1) });
  return out;
}

const defs = (c, id) => `<defs>
  <linearGradient id="skin${id}" x1="0.85" y1="0" x2="0.1" y2="1"><stop offset="0" stop-color="${c.skin[3]}"/><stop offset="0.22" stop-color="${c.skin[2]}"/><stop offset="0.6" stop-color="${c.skin[1]}"/><stop offset="1" stop-color="${c.skin[0]}"/></linearGradient>
  <linearGradient id="tooth${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffaf0"/><stop offset="0.7" stop-color="#eadfc6"/><stop offset="1" stop-color="#bfae8c"/></linearGradient>
  <linearGradient id="belly${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.belly[0]}"/><stop offset="1" stop-color="${c.belly[1]}"/></linearGradient>
  <linearGradient id="horn${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.horn[0]}"/><stop offset="1" stop-color="${c.horn[1]}"/></linearGradient>
  <linearGradient id="wing${id}" x1="0.1" y1="1" x2="0.9" y2="0"><stop offset="0" stop-color="${c.wing[0]}" stop-opacity="0.98"/><stop offset="0.55" stop-color="${c.wing[1]}" stop-opacity="0.9"/><stop offset="1" stop-color="${c.wing[2]}" stop-opacity="0.82"/></linearGradient>
  <radialGradient id="glow${id}"><stop offset="0" stop-color="${c.glow}" stop-opacity="0.85"/><stop offset="1" stop-color="${c.glow}" stop-opacity="0"/></radialGradient>
  <radialGradient id="eye${id}" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff"/><stop offset="0.35" stop-color="${c.eye}"/><stop offset="1" stop-color="${c.glow}" stop-opacity="0"/></radialGradient>
  <pattern id="scales${id}" width="26" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(12)"><path d="M0 11 Q13 22 26 11 M-13 0 Q0 11 13 0 M13 0 Q26 11 39 0" fill="none" stroke="#000" stroke-opacity="0.34" stroke-width="2.2"/><path d="M0 9 Q13 19 26 9" fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="1.6"/></pattern>
  <filter id="skinfx${id}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.028 0.034" numOctaves="3" seed="7" result="t"/>
    <feDiffuseLighting in="t" surfaceScale="5" diffuseConstant="1.15" lighting-color="#ffffff" result="d"><feDistantLight azimuth="300" elevation="48"/></feDiffuseLighting>
    <feComposite in="SourceGraphic" in2="d" operator="arithmetic" k1="0.9" k2="0.62" k3="0.18" k4="0" result="lit"/>
    <feComposite in="lit" in2="SourceAlpha" operator="in"/>
  </filter>
  <filter id="soft${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="soft4${id}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>
</defs>`;
const wrap = (c, id, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs(c, id)}${body}</svg>`;

// ------------------------------------------------------------------ parts
const TORSO = 'M 400 520 C 470 498 560 540 620 620 C 680 700 705 760 785 790 C 865 820 935 860 965 930 C 980 985 950 1035 900 1065 L 845 1092 C 805 1122 762 1132 722 1102 C 660 1062 640 1012 600 962 C 560 912 520 862 520 802 C 520 742 500 692 470 652 C 440 622 405 602 382 572 Z';


// dorsal spikes standing on the real back outline: the outline is read from the drawn torso, so the spikes always touch the skin
function spikes(c, id, back) {
  return back.map((p, i) => { const s = 46 - (i / Math.max(1, back.length - 1)) * 22; const nx = p.nx; const ny = p.ny; const tx = -ny; const ty = nx; const w = 15 - i * 0.4;
    const bx1 = p.x - tx * w - nx * 6; const by1 = p.y - ty * w - ny * 6; const bx2 = p.x + tx * w - nx * 6; const by2 = p.y + ty * w - ny * 6;
    return `<path d="M ${bx1.toFixed(1)} ${by1.toFixed(1)} L ${(p.x + nx * s + tx * 3).toFixed(1)} ${(p.y + ny * s + ty * 3).toFixed(1)} L ${bx2.toFixed(1)} ${by2.toFixed(1)} Z" fill="url(#horn${id})" stroke="${c.bone}" stroke-width="3" stroke-linejoin="round"/>`; }).join('');
}
async function backOutline(c) {
  const probe = await sharp(Buffer.from(wrap(c, 'probe', torso(c, 'probe', [])))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = probe; const top = (x) => { for (let y = 0; y < info.height; y += 1) if (data[(y * info.width + x) * 4 + 3] > 200) return y; return -1; };
  const xs = []; for (let x = 452; x <= 950; x += 34) xs.push(x);
  return xs.map((x) => { const y = top(x); const y0 = top(x - 14); const y1 = top(x + 14); if (y < 0 || y0 < 0 || y1 < 0) return null;
    let tx = 28; let ty = y1 - y0; const l = Math.hypot(tx, ty); tx /= l; ty /= l; return { x, y, nx: ty, ny: -tx }; }).filter(Boolean);
}

function torso(c, id, back = []) {
  const ridge = spikes(c, id, back);
  const hindLeg = `<path d="M 790 960 C 870 980 910 1040 880 1120 C 860 1180 800 1230 790 1290 L 700 1296 C 690 1250 730 1190 740 1130 C 700 1110 700 1040 730 990 Z" fill="url(#skin${id})" stroke="${c.skin[0]}" stroke-width="4"/>
    <path d="M 800 990 C 860 1010 880 1060 860 1110" stroke="#fff" stroke-opacity="0.18" stroke-width="14" fill="none" stroke-linecap="round"/><path d="M 700 1296 l -34 70 l 48 -44 l 6 66 l 34 -66 l 36 62 l 0 -80 Z" fill="url(#horn${id})" stroke="${c.bone}" stroke-width="3"/>`;
  const foreLeg = `<path d="M 580 880 C 540 930 560 990 610 1020 C 650 1048 640 1090 600 1120 L 640 1150 C 700 1110 720 1050 680 1000 C 650 960 650 920 620 880 Z" fill="url(#skin${id})" stroke="${c.skin[0]}" stroke-width="4"/>
    <path d="M 600 1120 l -40 52 l 58 -20 l -12 58 l 40 -44 l 18 40 l 14 -66 Z" fill="url(#horn${id})" stroke="${c.bone}" stroke-width="3"/>`;
  const fx = {
    cracks: `<g stroke="${c.glow}" stroke-width="3.4" fill="none" stroke-linecap="round" opacity="0.95" filter="url(#soft4${id})"><path d="M 640 700 l 22 38 l -14 30 l 26 36"/><path d="M 760 820 l 26 24 l -10 34 l 30 22"/><path d="M 700 960 l 20 -30 l 30 14"/></g><g stroke="#ffe9a8" stroke-width="1.6" fill="none"><path d="M 640 700 l 22 38 l -14 30 l 26 36"/><path d="M 760 820 l 26 24 l -10 34 l 30 22"/></g>`,
    frost: Array.from({ length: 16 }, (_, i) => { const x = 560 + (i * 53) % 380; const y = 640 + (i * 71) % 400; return `<path d="M ${x} ${y} l 8 -34 l 8 34 l -8 12 Z" fill="#effbff" opacity="0.8"/>`; }).join(''),
    bolts: `<g stroke="#e8efff" stroke-width="3" fill="none" stroke-linecap="round" filter="url(#soft4${id})"><path d="M 650 690 l 14 30 l -18 14 l 22 34 l -12 20"/><path d="M 800 830 l 18 22 l -14 18 l 24 30"/></g>`,
    wisps: Array.from({ length: 6 }, (_, i) => `<path d="M ${600 + i * 60} 1040 C ${570 + i * 60} 960 ${650 + i * 60} 900 ${610 + i * 60} 820" stroke="${c.glow}" stroke-opacity="0.35" stroke-width="12" fill="none" stroke-linecap="round" filter="url(#soft${id})"/>`).join(''),
    moss: Array.from({ length: 18 }, (_, i) => { const x = 540 + (i * 47) % 400; const y = 660 + (i * 83) % 380; return `<path d="M ${x} ${y} q 16 -22 32 0 q -16 22 -32 0 Z" fill="#7be27a" opacity="0.55" transform="rotate(${(i * 41) % 90 - 45} ${x} ${y})"/>`; }).join(''),
  }[c.fx];
  return `${foreLeg === '' ? '' : ''}
  <g>${hindLeg}</g>
  <path d="${TORSO}" fill="url(#skin${id})" stroke="${c.skin[0]}" stroke-width="5" filter="url(#skinfx${id})"/>
  <clipPath id="tc${id}"><path d="${TORSO}"/></clipPath>
  <g clip-path="url(#tc${id})">
    <rect width="${W}" height="${H}" fill="url(#scales${id})"/>
    <path d="M 388 575 C 450 650 500 700 505 800 C 510 880 570 930 610 980 C 650 1030 690 1085 735 1100" stroke="url(#belly${id})" stroke-width="64" fill="none" opacity="0.96"/>
    ${Array.from({ length: 20 }, (_, i) => { const t = i / 19; const pts = [[395, 585], [470, 665], [505, 760], [525, 850], [590, 950], [650, 1040], [730, 1098]]; const k = t * 6; const a = pts[Math.floor(k)]; const b = pts[Math.min(6, Math.floor(k) + 1)]; const f = k % 1; const x = a[0] + (b[0] - a[0]) * f; const y = a[1] + (b[1] - a[1]) * f; return `<path d="M ${x - 30} ${y - 6} q 30 16 62 -4" stroke="${c.skin[0]}" stroke-opacity="0.5" stroke-width="3" fill="none"/>`; }).join('')}
    <ellipse cx="800" cy="900" rx="170" ry="120" fill="${c.skin[3]}" opacity="0.18" filter="url(#soft${id})"/>
    <ellipse cx="560" cy="860" rx="90" ry="150" fill="url(#glow${id})" opacity="0.6"/>
    <path d="M 410 540 C 520 520 640 600 700 740" stroke="${c.skin[3]}" stroke-opacity="0.45" stroke-width="12" fill="none" filter="url(#soft4${id})"/>
    <g fill="none" stroke="#000" stroke-opacity="0.38" stroke-width="5" stroke-linecap="round" filter="url(#soft4${id})"><path d="M 560 760 C 620 780 690 800 740 840"/><path d="M 580 800 C 640 820 700 850 745 890"/><path d="M 600 840 C 650 862 700 892 735 930"/><path d="M 760 930 C 820 960 850 1000 840 1060"/></g>
    <ellipse cx="640" cy="760" rx="70" ry="95" fill="#000" opacity="0.22" filter="url(#soft${id})" transform="rotate(-24 640 760)"/>
    <ellipse cx="820" cy="1000" rx="90" ry="70" fill="${c.skin[3]}" opacity="0.2" filter="url(#soft${id})"/>
    ${fx}
  </g>
  ${foreLeg}${ridge}`;
}

function head(c, id) {
  const HEAD = 'M 500 506 C 472 458 410 436 340 452 L 206 498 C 176 508 174 540 204 548 L 330 566 C 400 584 458 596 508 580 L 540 546 Z';
  return `
  <!-- horns -->
  <path d="M 478 488 C 560 450 650 400 760 300 C 704 410 650 470 560 520 Z" fill="url(#horn${id})" stroke="${c.bone}" stroke-width="3"/>
  <path d="M 500 520 C 560 500 650 500 740 470 C 670 530 600 560 530 566 Z" fill="url(#horn${id})" stroke="${c.bone}" stroke-width="3" opacity="0.95"/>
  <!-- neck frill -->
  <path d="M 520 540 C 570 520 620 540 660 590 C 600 580 560 590 520 600 Z" fill="${c.wing[1]}" opacity="0.9" stroke="${c.bone}" stroke-width="3"/>
  <!-- mouth cavity -->
  <path d="M 214 548 L 330 568 C 400 586 458 598 508 582 L 500 616 C 430 630 330 620 236 592 Z" fill="#12030a"/>
  <clipPath id="mc${id}"><path d="M 214 548 L 330 568 C 400 586 458 598 508 582 L 500 616 C 430 630 330 620 236 592 Z"/></clipPath>
  <ellipse cx="370" cy="586" rx="110" ry="16" fill="${c.mouth}" opacity="0.5" filter="url(#soft4${id})" clip-path="url(#mc${id})"/>
  <!-- skull -->
  <path d="${HEAD}" fill="url(#skin${id})" stroke="${c.skin[0]}" stroke-width="5" filter="url(#skinfx${id})"/>
  <clipPath id="hc${id}"><path d="${HEAD}"/></clipPath>
  <g clip-path="url(#hc${id})">
    <rect width="${W}" height="${H}" fill="url(#scales${id})" opacity="0.8"/>
    <path d="M 220 490 C 300 470 380 458 470 476" stroke="${c.skin[3]}" stroke-opacity="0.55" stroke-width="9" fill="none" filter="url(#soft4${id})"/>
    <path d="M 330 462 C 380 470 420 470 450 486 L 420 500 C 392 488 360 482 330 482 Z" fill="${c.skin[0]}" opacity="0.65"/>
  </g>
  <!-- brow ridge, nostril, cheek spikes -->
  <path d="M 318 486 C 346 458 396 456 430 478" stroke="${c.skin[0]}" stroke-width="12" fill="none" stroke-linecap="round"/>
  <path d="M 318 484 C 346 456 396 454 430 476" stroke="${c.skin[3]}" stroke-opacity="0.7" stroke-width="3" fill="none" stroke-linecap="round"/>
  <ellipse cx="226" cy="512" rx="9" ry="5" fill="#000" opacity="0.8" transform="rotate(14 226 512)"/>
  <path d="M 470 560 l 40 14 l -20 -36 Z M 446 570 l 30 24 l -8 -40 Z" fill="url(#horn${id})" stroke="${c.bone}" stroke-width="2"/>
  <!-- upper teeth: a gum line with slim, slightly curved fangs that get smaller towards the back -->
  <path d="M 222 551 C 300 560 400 580 500 582" stroke="#4a1218" stroke-width="9" fill="none" stroke-linecap="round"/>
  ${[[240, 38], [276, 20], [308, 27], [342, 18], [376, 23], [412, 15], [446, 17]].map(([x, h], i) => { const y = 553 + (x - 236) * 0.1; return `<path d="M ${x} ${y} Q ${x + 2} ${y + h * 0.6} ${x + 7 + (i === 0 ? 1 : 0)} ${y + h} Q ${x + 11} ${y + h * 0.55} ${x + 14} ${y} Z" fill="url(#tooth${id})" stroke="#3a2418" stroke-width="1.2" stroke-linejoin="round"/>`; }).join('')}
  <!-- eye: narrowed and angry -->
  <ellipse cx="376" cy="498" rx="62" ry="34" fill="url(#eye${id})" filter="url(#soft4${id})"/>
  <path d="M 330 490 C 356 486 404 490 428 512 C 398 522 356 516 330 490 Z" fill="${c.eye}" stroke="#000" stroke-width="2.5"/>
  <path d="M 380 490 C 390 500 390 512 380 520 C 370 512 370 500 380 490 Z" fill="#0a0204"/>
  <ellipse cx="368" cy="502" rx="4" ry="2.6" fill="#fff" opacity="0.9"/>
  <path d="M 322 470 C 360 478 408 490 436 528 L 440 500 C 410 470 360 456 322 470 Z" fill="${c.skin[0]}" stroke="#000" stroke-width="2.5"/>
  <path d="M 326 470 C 362 478 408 488 434 520" stroke="${c.skin[3]}" stroke-opacity="0.75" stroke-width="3" fill="none"/>
  <!-- cheek and jaw horns, snout spikes, scar, nostril smoke -->
  <path d="M 500 548 C 540 560 566 590 574 626 C 540 604 512 592 490 586 Z" fill="url(#horn${id})" stroke="${c.bone}" stroke-width="3"/>
  <path d="M 420 566 C 440 600 440 634 428 664 C 410 630 392 604 380 580 Z" fill="url(#horn${id})" stroke="${c.bone}" stroke-width="3"/>
  <path d="M 262 508 l 14 -26 l 10 26 Z M 296 500 l 14 -30 l 10 30 Z" fill="url(#horn${id})" stroke="${c.bone}" stroke-width="2.5"/>
  <path d="M 300 522 l 20 36 M 306 520 l 22 38 M 313 519 l 20 36" stroke="#2a0a08" stroke-opacity="0.75" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="214" cy="506" rx="26" ry="16" fill="${c.glow}" opacity="0.5" filter="url(#soft4${id})"/>
  <path d="M 200 500 C 170 480 176 450 150 436 C 190 440 200 470 220 492 Z" fill="${c.skin[3]}" opacity="0.28" filter="url(#soft4${id})"/>`;
}

function jaw(c, id) {
  const J = 'M 214 556 L 330 580 C 400 598 462 610 510 590 L 486 632 C 420 658 330 650 250 618 C 226 606 210 580 214 556 Z';
  return `<path d="${J}" fill="url(#skin${id})" stroke="${c.skin[0]}" stroke-width="5" filter="url(#skinfx${id})"/>
  <path d="M 226 592 C 300 626 400 640 480 622" stroke="url(#belly${id})" stroke-width="16" fill="none" opacity="0.9"/>
  <path d="M 232 574 C 300 590 400 608 492 600" stroke="#4a1218" stroke-width="8" fill="none" stroke-linecap="round"/>
  ${[[262, 17], [304, 13], [346, 19], [388, 12], [428, 14]].map(([x, h]) => { const y = 586 + (x - 262) * 0.075; return `<path d="M ${x} ${y} Q ${x + 3} ${y - h * 0.55} ${x + 6} ${y - h} Q ${x + 10} ${y - h * 0.5} ${x + 12} ${y} Z" fill="url(#tooth${id})" stroke="#3a2418" stroke-width="1.2" stroke-linejoin="round"/>`; }).join('')}
  <path d="M 214 560 C 250 570 300 582 340 590" stroke="${c.skin[3]}" stroke-opacity="0.35" stroke-width="5" fill="none"/>`;
}

function wing(c, id, far) {
  const sh = far ? [715, 745] : [790, 785];
  const wrist = far ? [790, 370] : [915, 420];
  const tips = far ? [[975, 110], [1050, 290], [1000, 470], [880, 640]] : [[1180, 190], [1196, 430], [1150, 650], [1030, 790]];
  const arm = `M ${sh[0]} ${sh[1]} C ${sh[0] + 30} ${sh[1] - 120} ${wrist[0] - 50} ${wrist[1] + 100} ${wrist[0]} ${wrist[1]}`;
  const [t1, t2, t3, t4] = tips;
  const mem = `M ${sh[0]} ${sh[1]} C ${sh[0] + 30} ${sh[1] - 120} ${wrist[0] - 50} ${wrist[1] + 100} ${wrist[0]} ${wrist[1]} C ${(wrist[0] + t1[0]) / 2 + 20} ${(wrist[1] + t1[1]) / 2 - 20} ${t1[0] - 40} ${t1[1] + 30} ${t1[0]} ${t1[1]}
    C ${t1[0] - 30} ${(t1[1] + t2[1]) / 2 - 20} ${t2[0] - 70} ${(t1[1] + t2[1]) / 2 + 10} ${t2[0]} ${t2[1]}
    C ${t2[0] - 60} ${(t2[1] + t3[1]) / 2 - 10} ${t3[0] - 50} ${(t2[1] + t3[1]) / 2 + 20} ${t3[0]} ${t3[1]}
    C ${t3[0] - 50} ${t3[1] - 40} ${t4[0] + 40} ${t4[1] - 90} ${t4[0]} ${t4[1]}
    C ${t4[0] - 60} ${t4[1] - 10} ${sh[0] + 70} ${sh[1] + 30} ${sh[0]} ${sh[1] + 40} Z`;
  const bones = tips.map((t, i) => `<path d="M ${wrist[0]} ${wrist[1]} Q ${(wrist[0] + t[0]) / 2 + (i - 1) * 10} ${(wrist[1] + t[1]) / 2 + 20} ${t[0]} ${t[1]}" stroke="${c.bone}" stroke-width="${9 - i}" fill="none" stroke-linecap="round"/><path d="M ${wrist[0]} ${wrist[1]} Q ${(wrist[0] + t[0]) / 2 + (i - 1) * 10} ${(wrist[1] + t[1]) / 2 + 20} ${t[0]} ${t[1]}" stroke="${c.skin[3]}" stroke-opacity="0.35" stroke-width="2" fill="none"/>`).join('');
  const veins = tips.map((t) => `<path d="M ${(wrist[0] + sh[0]) / 2} ${(wrist[1] + sh[1]) / 2 + 40} Q ${(wrist[0] + t[0]) / 2 - 20} ${(wrist[1] + t[1]) / 2 + 60} ${t[0] - 30} ${t[1] + 70}" stroke="${c.bone}" stroke-opacity="0.35" stroke-width="2" fill="none"/>`).join('');
  return `<g opacity="${far ? 0.92 : 1}">
    <path d="${mem}" fill="url(#wing${id})" stroke="${c.bone}" stroke-width="5" stroke-linejoin="round"/>
    <clipPath id="wc${far ? 'f' : 'n'}${id}"><path d="${mem}"/></clipPath>
    <g clip-path="url(#wc${far ? 'f' : 'n'}${id})"><ellipse cx="${(wrist[0] + t3[0]) / 2}" cy="${(wrist[1] + t3[1]) / 2}" rx="150" ry="190" fill="${c.wing[2]}" opacity="0.22" filter="url(#soft${id})"/>${veins}</g>
    <path d="${arm}" stroke="${c.bone}" stroke-width="22" fill="none" stroke-linecap="round"/><path d="${arm}" stroke="url(#skin${id})" stroke-width="14" fill="none" stroke-linecap="round"/>
    ${bones}
    <circle cx="${wrist[0]}" cy="${wrist[1]}" r="15" fill="url(#horn${id})" stroke="${c.bone}" stroke-width="3"/><path d="M ${wrist[0] - 6} ${wrist[1] - 6} l 40 -64 l -2 64 Z" fill="url(#horn${id})" stroke="${c.bone}" stroke-width="3"/>
    ${far ? '' : `<path d="${arm}" stroke="${c.skin[3]}" stroke-opacity="0.5" stroke-width="3" fill="none" transform="translate(-3 -4)"/>`}
  </g>`;
}

function tail(c, id) {
  const pts = [[890, 1040], [1000, 1090], [1085, 1190], [1060, 1320], [950, 1410], [810, 1450], [690, 1425], [610, 1370]];
  const rad = [58, 50, 42, 34, 26, 18, 11, 5];
  const s = tube(pts, rad);
  const spikes = s.filter((_, i) => i % 7 === 3 && i < s.length - 8).map((p, i) => `<path d="M ${p.x - 8} ${p.y - p.r + 4} l 10 ${-(30 - i * 1.4)} l 12 ${30 - i * 1.4} Z" fill="url(#horn${id})" stroke="${c.bone}" stroke-width="2.5" transform="rotate(${-i * 4} ${p.x} ${p.y})"/>`).join('');
  const body = s.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${p.r.toFixed(1)}"/>`).join('');
  const blade = pts.at(-1);
  return `<g filter="url(#skinfx${id})"><g fill="url(#skin${id})" stroke="${c.skin[0]}" stroke-width="0">${body}</g></g>
  <g fill="none" stroke="${c.skin[0]}" stroke-opacity="0.5" stroke-width="3">${s.filter((_, i) => i % 6 === 0).map((p) => `<path d="M ${p.x - p.r * 0.7} ${p.y + 2} q ${p.r * 0.7} ${p.r * 0.4} ${p.r * 1.4} 0"/>`).join('')}</g>
  <g>${spikes}</g>
  <path d="M ${blade[0]} ${blade[1]} l -46 -36 l 8 38 l -34 20 l 44 6 Z" fill="url(#horn${id})" stroke="${c.bone}" stroke-width="3" transform="rotate(-20 ${blade[0]} ${blade[1]})"/>`;
}

export const PARTS = ['wing_far', 'tail', 'body', 'head', 'jaw', 'wing_near'];
const build = {
  wing_far: (c, id) => `<g transform="rotate(14 715 745)">${wing(c, id, true)}</g>`,
  tail, body: torso, // the body is built with its back outline, see below
  head: (c, id) => `<g transform="translate(500 590) scale(1.32) translate(-500 -590)">${head(c, id)}</g>`,
  jaw: (c, id) => `<g transform="translate(500 590) scale(1.32) translate(-500 -590)">${jaw(c, id)}</g>`,
  wing_near: (c, id) => `<g transform="rotate(-6 790 785)">${wing(c, id, false)}</g>`,
};
const out = new URL('../../public/themes/rig/', import.meta.url).pathname;
const which = process.argv[2] ? [process.argv[2]] : Object.keys(P);
for (const el of which) {
  const c = P[el]; mkdirSync(`${out}${el}`, { recursive: true });
  const layers = [];
  for (const part of PARTS) {
    const svg = wrap(c, part, part === 'body' ? torso(c, part, await backOutline(c)) : build[part](c, part));
    const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
    writeFileSync(`${out}${el}/${part}.webp`.replace('.webp', '.png'), png);
    layers.push({ input: png });
  }
  // the flat composite is the character image attached to the theme (preview, GIF and no-motion fallback)
  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers).png({ compressionLevel: 9 }).toFile(`${new URL('../../public/themes/', import.meta.url).pathname}wody-dragon-${el}.png`);
}
console.log('rig done', which.join(','));
