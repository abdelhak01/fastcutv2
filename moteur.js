/**
 * FASTCUT — moteur geometrique
 *
 * Reconstruit un polygone a partir de ses cotes et de diagonales
 * mesurees, sans supposer aucun angle droit ni parallelisme.
 *
 * Deux ameliorations majeures par rapport a la version precedente :
 *
 * 1. RESOLUTION GLOBALE (Gauss-Newton) au lieu d'une construction
 *    sommet par sommet. La construction en chaine se trompait sur les
 *    formes a decroche : a chaque etape elle choisissait entre deux
 *    positions possibles, et un mauvais choix faussait tout le reste.
 *
 * 2. DETECTION D'AMBIGUITE. On resout depuis plusieurs points de
 *    depart : si on obtient plusieurs formes differentes respectant
 *    toutes les mesures, c'est que les mesures ne suffisent pas a
 *    decrire la piece. L'application le signale au lieu de sortir
 *    silencieusement une forme fausse.
 */

// ---------------------------------------------------------------
// Utilitaires geometriques
// ---------------------------------------------------------------
export const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

export function bbox(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    minX: Math.min(...xs), maxX: Math.max(...xs),
    minY: Math.min(...ys), maxY: Math.max(...ys),
  };
}

export function aireSignee(points) {
  let s = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % n];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

export function contourSeCroise(points) {
  const n = points.length;
  const orient = (a, b, c) => {
    const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    return Math.abs(v) < 1e-9 ? 0 : v > 0 ? 1 : -1;
  };
  const croise = (p1, p2, p3, p4) =>
    orient(p1, p2, p3) !== orient(p1, p2, p4) &&
    orient(p3, p4, p1) !== orient(p3, p4, p2);

  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (croise(points[i], points[(i + 1) % n], points[j], points[(j + 1) % n]))
        return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------
// Definition des mesures attendues pour n cotes
// ---------------------------------------------------------------
/**
 * Diagonales demandees : reparties plutot que toutes issues du meme
 * sommet. Une diagonale "en eventail" depuis un seul coin laisse les
 * zones eloignees mal tenues (c'est ce qui faisait echouer les formes
 * a decroche). On alterne donc les points d'attache.
 */
export function diagonalesRequises(n) {
  const paires = [];
  // Triangulation en eventail alterne : V0-V2, V1-V3, V0-V4, V1-V5...
  for (let k = 2; k <= n - 2; k++) {
    const ancre = k % 2 === 0 ? 0 : 1;
    if (Math.abs(k - ancre) >= 2 && !(ancre === 0 && k === n - 1)) {
      paires.push([ancre, k]);
    }
  }
  return paires.slice(0, Math.max(n - 3, 0));
}

export function parametresPourForme(n) {
  const params = [];
  for (let i = 1; i <= n; i++) params.push({ cle: `cote_${i}`, type: "cote", index: i });
  diagonalesRequises(n).forEach(([a, b], i) => {
    params.push({ cle: `diag_${i + 1}`, type: "diagonale", de: a, vers: b, index: i + 1 });
  });
  return params;
}

// ---------------------------------------------------------------
// Solveur : Gauss-Newton sur toutes les positions a la fois
// ---------------------------------------------------------------
function residus(V, cotes, diagonales) {
  const n = cotes.length;
  const r = [];
  for (let i = 1; i < n; i++) r.push(dist(V[i], V[(i + 1) % n]) - cotes[i]);
  for (const { de, vers, longueur } of diagonales) r.push(dist(V[de], V[vers]) - longueur);
  return r;
}

function resoudre(cotes, diagonales, depart, maxIter = 120) {
  const n = cotes.length;
  // V0 et V1 sont fixes : (0,0) et (cote_1, 0). Inconnues : V2..V(n-1)
  let x = depart.slice();

  for (let iter = 0; iter < maxIter; iter++) {
    const V = [[0, 0], [cotes[0], 0]];
    for (let i = 0; i < n - 2; i++) V.push([x[2 * i], x[2 * i + 1]]);

    const r = residus(V, cotes, diagonales);
    const errMax = Math.max(...r.map(Math.abs));
    if (errMax < 1e-7) break;

    // Jacobienne numerique
    const m = r.length, p = x.length;
    const J = [];
    const h = 1e-6;
    for (let j = 0; j < p; j++) {
      const xh = x.slice();
      xh[j] += h;
      const Vh = [[0, 0], [cotes[0], 0]];
      for (let i = 0; i < n - 2; i++) Vh.push([xh[2 * i], xh[2 * i + 1]]);
      const rh = residus(Vh, cotes, diagonales);
      J.push(rh.map((v, k) => (v - r[k]) / h));
    }

    // Normale : (JtJ + lambda I) dx = -Jt r   (Levenberg amorti)
    const JtJ = Array.from({ length: p }, () => new Array(p).fill(0));
    const Jtr = new Array(p).fill(0);
    for (let a = 0; a < p; a++) {
      for (let b = 0; b < p; b++) {
        let s = 0;
        for (let k = 0; k < m; k++) s += J[a][k] * J[b][k];
        JtJ[a][b] = s;
      }
      let s = 0;
      for (let k = 0; k < m; k++) s += J[a][k] * r[k];
      Jtr[a] = s;
      JtJ[a][a] += 1e-8;
    }

    const dx = resoudreSysteme(JtJ, Jtr.map((v) => -v));
    if (!dx) break;

    let pas = 1.0;
    let ameliore = false;
    for (let essai = 0; essai < 12; essai++) {
      const xTest = x.map((v, i) => v + pas * dx[i]);
      const Vt = [[0, 0], [cotes[0], 0]];
      for (let i = 0; i < n - 2; i++) Vt.push([xTest[2 * i], xTest[2 * i + 1]]);
      const rt = residus(Vt, cotes, diagonales);
      if (Math.max(...rt.map(Math.abs)) < errMax) {
        x = xTest;
        ameliore = true;
        break;
      }
      pas *= 0.5;
    }
    if (!ameliore) break;
  }

  const V = [[0, 0], [cotes[0], 0]];
  for (let i = 0; i < n - 2; i++) V.push([x[2 * i], x[2 * i + 1]]);
  const r = residus(V, cotes, diagonales);
  return { points: V, erreur: Math.max(...r.map(Math.abs)) };
}

function resoudreSysteme(A, b) {
  const n = b.length;
  const M = A.map((ligne, i) => [...ligne, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let l = col + 1; l < n; l++)
      if (Math.abs(M[l][col]) > Math.abs(M[pivot][col])) pivot = l;
    if (Math.abs(M[pivot][col]) < 1e-14) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let l = 0; l < n; l++) {
      if (l === col) continue;
      const f = M[l][col] / M[col][col];
      for (let c = col; c <= n; c++) M[l][c] -= f * M[col][c];
    }
  }
  return M.map((ligne, i) => ligne[n] / ligne[i][i] !== undefined ? ligne[n] / M[i][i] : 0);
}

// ---------------------------------------------------------------
// Point d'entree : calcule la ou les formes possibles
// ---------------------------------------------------------------
const TOLERANCE_MM = 1.0;      // ecart max accepte sur une mesure
const SEUIL_DISTINCT_MM = 3.0; // au-dela, deux formes sont differentes

export function calculerFormes(nCotes, valeurs) {
  const cotes = [];
  for (let i = 1; i <= nCotes; i++) {
    const v = parseFloat(valeurs[`cote_${i}`]);
    if (!isFinite(v) || v <= 0) return { etat: "incomplet", formes: [] };
    cotes.push(v);
  }

  const diagonales = [];
  const paires = diagonalesRequises(nCotes);
  for (let i = 0; i < paires.length; i++) {
    const v = parseFloat(valeurs[`diag_${i + 1}`]);
    if (!isFinite(v) || v <= 0) return { etat: "incomplet", formes: [] };
    diagonales.push({ de: paires[i][0], vers: paires[i][1], longueur: v });
  }

  // Plusieurs departs pseudo-aleatoires (deterministes)
  const perimetre = cotes.reduce((a, b) => a + b, 0);
  const solutions = [];
  let graine = 12345;
  const alea = () => {
    graine = (graine * 1103515245 + 12345) & 0x7fffffff;
    return graine / 0x7fffffff;
  };

  for (let essai = 0; essai < 120; essai++) {
    const depart = [];
    for (let i = 0; i < nCotes - 2; i++) {
      const ang = alea() * Math.PI;
      const ray = (0.15 + alea() * 0.85) * perimetre / 3;
      depart.push(cotes[0] / 2 + ray * Math.cos(ang), ray * Math.sin(ang));
    }

    const { points, erreur } = resoudre(cotes, diagonales, depart);
    if (erreur > TOLERANCE_MM) continue;
    if (contourSeCroise(points)) continue;

    // Rejeter les formes degenerees : aire negligeable, ou sommets confondus
    const aire = Math.abs(aireSignee(points));
    if (aire < perimetre * perimetre * 1e-4) continue;
    let degenere = false;
    for (let i = 0; i < points.length && !degenere; i++)
      for (let j = i + 1; j < points.length; j++)
        if (dist(points[i], points[j]) < 1e-3) { degenere = true; break; }
    if (degenere) continue;

    // On ne renverse pas les points (cela casserait la correspondance
    // cote_i <-> segment Vi-Vi+1). On se contente d'ecarter les
    // solutions d'orientation horaire : la meme forme existe aussi en
    // anti-horaire et sera trouvee par un autre point de depart.
    if (aireSignee(points) < 0) continue;

    const nouveau = !solutions.some((s) =>
      s.points.every((p, i) => dist(p, points[i]) < SEUIL_DISTINCT_MM));
    if (nouveau) solutions.push({ points, erreur, aire });
  }

  if (solutions.length === 0) return { etat: "incoherent", formes: [] };

  solutions.sort((a, b) => a.erreur - b.erreur);
  if (solutions.length === 1) return { etat: "ok", formes: solutions };
  return { etat: "ambigu", formes: solutions.slice(0, 4) };
}

// ---------------------------------------------------------------
// Controle croise : propose une mesure de verification
// ---------------------------------------------------------------
/**
 * Choisit une diagonale qui n'a PAS servi au calcul, et donne sa
 * longueur attendue. L'operateur la mesure sur le gabarit : si l'ecart
 * est important, c'est qu'un releve est faux.
 * On privilegie la plus longue (la plus facile a mesurer precisement).
 */
export function mesureDeControle(points) {
  const n = points.length;
  const utilisees = new Set(
    diagonalesRequises(n).map(([a, b]) => `${a}-${b}`)
  );
  let meilleure = null;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (utilisees.has(`${i}-${j}`) || utilisees.has(`${j}-${i}`)) continue;
      const L = dist(points[i], points[j]);
      if (!meilleure || L > meilleure.longueur)
        meilleure = { de: i, vers: j, longueur: L };
    }
  }
  return meilleure;
}

// ---------------------------------------------------------------
// Sens de rotation : detecte une saisie faite a l'envers
// ---------------------------------------------------------------
export function retournerForme(points) {
  // Miroir horizontal, puis renumerotation pour garder V0 en premier
  const miroir = points.map(([x, y]) => [-x, y]);
  return [miroir[0], ...miroir.slice(1).reverse()];
}

// ---------------------------------------------------------------
// Transformations : arrondi de coin, surplus rectiligne, marge
// ---------------------------------------------------------------
export function arrondirCoin(points, i, rayon) {
  const n = points.length;
  const Pp = points[(i - 1 + n) % n], Pc = points[i], Pn = points[(i + 1) % n];
  const v1 = [Pp[0] - Pc[0], Pp[1] - Pc[1]];
  const v2 = [Pn[0] - Pc[0], Pn[1] - Pc[1]];
  const l1 = Math.hypot(...v1), l2 = Math.hypot(...v2);
  const d1 = [v1[0] / l1, v1[1] / l1], d2 = [v2[0] / l2, v2[1] / l2];

  const cosA = Math.max(-1, Math.min(1, d1[0] * d2[0] + d1[1] * d2[1]));
  const angle = Math.acos(cosA);
  if (angle < 1e-6 || angle > Math.PI - 1e-6) return null;

  const dTan = rayon / Math.tan(angle / 2);
  if (dTan >= l1 || dTan >= l2) return null;

  const T1 = [Pc[0] + d1[0] * dTan, Pc[1] + d1[1] * dTan];
  const T2 = [Pc[0] + d2[0] * dTan, Pc[1] + d2[1] * dTan];

  const bis = [d1[0] + d2[0], d1[1] + d2[1]];
  const lb = Math.hypot(...bis);
  const centre = [
    Pc[0] + (bis[0] / lb) * (rayon / Math.sin(angle / 2)),
    Pc[1] + (bis[1] / lb) * (rayon / Math.sin(angle / 2)),
  ];

  let a1 = Math.atan2(T1[1] - centre[1], T1[0] - centre[0]);
  let a2 = Math.atan2(T2[1] - centre[1], T2[0] - centre[0]);
  let diff = a2 - a1;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;

  const arc = [];
  const seg = 16;
  for (let k = 0; k <= seg; k++) {
    const a = a1 + (diff * k) / seg;
    arc.push([centre[0] + rayon * Math.cos(a), centre[1] + rayon * Math.sin(a)]);
  }
  return [T1, ...arc, T2];
}

export function appliquerArrondis(points, arrondis) {
  const parCoin = {};
  arrondis.forEach((a) => { if (a.rayon > 0) parCoin[a.coin] = a.rayon; });
  const sortie = [];
  points.forEach((p, i) => {
    if (parCoin[i]) {
      const remplacement = arrondirCoin(points, i, parCoin[i]);
      sortie.push(...(remplacement || [p]));
    } else sortie.push(p);
  });
  return sortie;
}

export function offsetRectiligne(points, mm) {
  if (!mm) return points;
  const n = points.length;
  const signe = aireSignee(points) > 0 ? 1 : -1;
  const droites = [];
  for (let i = 0; i < n; i++) {
    const P1 = points[i], P2 = points[(i + 1) % n];
    let dx = P2[0] - P1[0], dy = P2[1] - P1[1];
    const l = Math.hypot(dx, dy);
    dx /= l; dy /= l;
    const nx = dy * signe, ny = -dx * signe;
    droites.push({ P: [P1[0] + nx * mm, P1[1] + ny * mm], d: [dx, dy] });
  }
  const sortie = [];
  for (let i = 0; i < n; i++) {
    const A = droites[(i - 1 + n) % n], B = droites[i];
    const den = A.d[0] * B.d[1] - A.d[1] * B.d[0];
    if (Math.abs(den) < 1e-9) { sortie.push(points[i]); continue; }
    const t = ((B.P[0] - A.P[0]) * B.d[1] - (B.P[1] - A.P[1]) * B.d[0]) / den;
    sortie.push([A.P[0] + t * A.d[0], A.P[1] + t * A.d[1]]);
  }
  return sortie;
}

export function rectangleMarge(points, marge) {
  const b = bbox(points);
  return [
    [b.minX - marge, b.minY - marge],
    [b.maxX + marge, b.minY - marge],
    [b.maxX + marge, b.maxY + marge],
    [b.minX - marge, b.maxY + marge],
  ];
}

// ---------------------------------------------------------------
// Silhouettes de reference pour les vignettes et le croquis de mesure
// ---------------------------------------------------------------
/**
 * Formes irregulieres representatives des gabarits reellement
 * rencontres (garde-corps, panneaux rampants, decroches), plutot que
 * des polygones reguliers qui ne ressemblent a rien de concret.
 * Coordonnees dans un carre 0-100, origine en bas a gauche.
 */
export const SILHOUETTES = {
  3: [[4, 8], [92, 8], [78, 82]],
  4: [[6, 10], [88, 10], [96, 76], [20, 68]],
  5: [[6, 8], [78, 8], [96, 44], [70, 86], [16, 62]],
  6: [[5, 10], [70, 10], [94, 58], [72, 62], [62, 84], [14, 70]],
  7: [[6, 8], [62, 8], [86, 30], [96, 66], [64, 88], [26, 80], [10, 44]],
  8: [[8, 10], [58, 6], [88, 22], [96, 56], [74, 84], [40, 90], [12, 74], [4, 40]],
};
