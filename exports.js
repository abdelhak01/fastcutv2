/**
 * FASTCUT — exports complementaires
 *
 * - Fiche de decoupe : document imprimable (via la fonction d'impression
 *   du navigateur, qui permet d'enregistrer en PDF). Pas de bibliotheque
 *   externe : l'application doit rester autonome et fonctionner hors ligne.
 * - Tableau : format CSV avec separateur point-virgule et BOM UTF-8,
 *   ouvert directement par Excel en double-cliquant.
 */

// ---------------------------------------------------------------
// Fiche de decoupe imprimable
// ---------------------------------------------------------------
export function ouvrirFicheDecoupe(projet, panneaux, dessinerPanneau) {
  const date = new Date().toLocaleDateString('fr-FR');
  const surface = panneaux.reduce((t, p) => t + p.w * p.h, 0) / 1e6;

  const lignes = panneaux.map((p, i) => {
    const g = dessinerPanneau(p);
    const qualite = (p.erreur ?? 0) < 0.3 ? 'net'
      : (p.erreur ?? 0) < 1 ? 'approximatif' : 'à vérifier';
    return `
      <section class="panneau">
        <div class="dessin">${g || ''}</div>
        <div class="infos">
          <h2>${echapper(p.ref)}</h2>
          <table>
            <tr><th>Plaque brute</th><td>${p.w} × ${p.h} mm</td></tr>
            <tr><th>Forme</th><td>${p.nCotes} côtés</td></tr>
            ${p.epaisseur ? `<tr><th>Épaisseur</th><td>${echapper(p.epaisseur)} mm</td></tr>` : ''}
            <tr><th>Marge</th><td>${p.marge?.actif ? p.marge.valeur + ' mm' : '—'}</td></tr>
            <tr><th>Surplus</th><td>${p.rectiligne?.actif ? p.rectiligne.valeur + ' mm' : '—'}</td></tr>
            <tr><th>Relevé</th><td>${qualite} (${(p.erreur ?? 0).toFixed(2)} mm)</td></tr>
            ${p.note ? `<tr><th>Note</th><td>${echapper(p.note)}</td></tr>` : ''}
          </table>
          ${mesuresListe(p)}
        </div>
      </section>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Fiche de découpe — ${echapper(projet)}</title>
<style>
  @page{size:A4;margin:14mm}
  *{box-sizing:border-box}
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#1c2733;margin:0;font-size:12px}
  header{border-bottom:2px solid #2563c9;padding-bottom:10px;margin-bottom:18px;
    display:flex;align-items:flex-end;gap:14px}
  header h1{margin:0;font-size:20px;letter-spacing:.03em}
  header .meta{margin-left:auto;text-align:right;font-size:11px;color:#5a6b7d;line-height:1.6}
  .panneau{display:flex;gap:16px;padding:14px 0;border-bottom:1px solid #dde5ed;
    page-break-inside:avoid}
  .dessin{flex:0 0 232px;height:160px;background:#f4f7fa;border-radius:6px;padding:6px}
  .dessin svg{width:100%;height:100%}
  .infos{flex:1;min-width:0}
  .infos h2{margin:0 0 8px;font-size:15px}
  table{border-collapse:collapse;font-size:11px;margin-bottom:8px}
  th{text-align:left;color:#5a6b7d;font-weight:500;padding:2px 14px 2px 0;white-space:nowrap}
  td{padding:2px 0}
  .mesures{font-size:10px;color:#5a6b7d;line-height:1.7}
  .mesures b{color:#1c2733;font-weight:600}
  footer{margin-top:20px;padding-top:10px;border-top:1px solid #dde5ed;
    font-size:10px;color:#5a6b7d;display:flex}
  .avert{color:#b0521f}
  @media print{ .noprint{display:none} }
</style></head><body>
<header>
  <h1>FASTCUT</h1>
  <div>
    <div style="font-size:14px;font-weight:600">${echapper(projet) || 'Sans titre'}</div>
    <div style="font-size:11px;color:#5a6b7d">Fiche de découpe</div>
  </div>
  <div class="meta">
    ${date}<br>${panneaux.length} panneau${panneaux.length > 1 ? 'x' : ''}
    · ${surface.toFixed(2)} m²
  </div>
</header>
${lignes}
<footer>
  <span class="avert">Vérifier les cotes avant découpe.</span>
  <span style="margin-left:auto">Abdelhak AITADDI · +212 666 951 305</span>
</footer>
<div class="noprint" style="position:fixed;bottom:16px;right:16px">
  <button onclick="window.print()" style="padding:11px 18px;border:none;border-radius:8px;
    background:#2563c9;color:#fff;font-size:14px;cursor:pointer">Imprimer / PDF</button>
</div>
</body></html>`;

  const f = window.open('', '_blank');
  if (!f) return false;
  f.document.write(html);
  f.document.close();
  return true;
}

function mesuresListe(p) {
  const cotes = [];
  const diags = [];
  Object.entries(p.valeurs || {}).forEach(([cle, v]) => {
    const n = Math.round(parseFloat(v));
    if (cle.startsWith('cote_')) cotes.push(`c${cle.slice(5)} <b>${n}</b>`);
    else if (cle.startsWith('diag_')) diags.push(`d${cle.slice(5)} <b>${n}</b>`);
  });
  return `<div class="mesures">
    Côtés : ${cotes.join(' · ')}
    ${diags.length ? `<br>Diagonales : ${diags.join(' · ')}` : ''}
  </div>`;
}

function echapper(t) {
  return String(t ?? '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ---------------------------------------------------------------
// Tableau pour Excel (CSV ; separateur point-virgule)
// ---------------------------------------------------------------
export function construireCSV(projet, panneaux) {
  const maxCotes = Math.max(...panneaux.map((p) => p.nCotes), 3);
  const maxDiags = Math.max(...panneaux.map((p) => Math.max(p.nCotes - 3, 0)), 0);

  const entetes = ['Projet', 'Reference', 'Cotes', 'Largeur_mm', 'Hauteur_mm',
    'Surface_m2', 'Epaisseur_mm', 'Marge_mm', 'Surplus_mm', 'Ecart_mm', 'Note'];
  for (let i = 1; i <= maxCotes; i++) entetes.push(`Cote_${i}`);
  for (let i = 1; i <= maxDiags; i++) entetes.push(`Diagonale_${i}`);

  const cellule = (v) => {
    const t = String(v ?? '');
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };

  const lignes = panneaux.map((p) => {
    const l = [
      projet, p.ref, p.nCotes, p.w, p.h,
      ((p.w * p.h) / 1e6).toFixed(3).replace('.', ','),
      p.epaisseur || '',
      p.marge?.actif ? p.marge.valeur : 0,
      p.rectiligne?.actif ? p.rectiligne.valeur : 0,
      (p.erreur ?? 0).toFixed(2).replace('.', ','),
      p.note || '',
    ];
    for (let i = 1; i <= maxCotes; i++) {
      const v = p.valeurs?.[`cote_${i}`];
      l.push(v ? String(Math.round(parseFloat(v) * 100) / 100).replace('.', ',') : '');
    }
    for (let i = 1; i <= maxDiags; i++) {
      const v = p.valeurs?.[`diag_${i}`];
      l.push(v ? String(Math.round(parseFloat(v) * 100) / 100).replace('.', ',') : '');
    }
    return l.map(cellule).join(';');
  });

  // BOM UTF-8 : sans lui, Excel affiche mal les accents
  return '\uFEFF' + [entetes.join(';'), ...lignes].join('\r\n');
}

export function telechargerTexte(contenu, nomFichier, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([contenu], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------
// Sauvegarde / restauration de tous les projets
// ---------------------------------------------------------------
export function exporterSauvegarde(projets) {
  return JSON.stringify({
    application: 'FASTCUT',
    version: 2,
    date: new Date().toISOString(),
    projets,
  }, null, 2);
}

export function lireSauvegarde(texte) {
  try {
    const d = JSON.parse(texte);
    if (d.application !== 'FASTCUT' || !d.projets) return null;
    return d.projets;
  } catch {
    return null;
  }
}
