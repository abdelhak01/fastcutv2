/**
 * FASTCUT — generation DXF
 *
 * Format R12 (AC1009) avec sections HEADER et ENTITIES uniquement.
 * La section TABLES est volontairement absente : AutoCAD rejette le
 * fichier entier si elle est incomplete, et les calques cites dans les
 * entites sont crees automatiquement a l'ouverture.
 *
 * Entites : POLYLINE/VERTEX/SEQEND (R12) plutot que LWPOLYLINE (R14+),
 * pour une compatibilite maximale. Fins de ligne CRLF.
 */

const l = (code, valeur) => `${code}\r\n${valeur}\r\n`;

export function construireDXF(contour, rectangleMarge, reference, projet, date) {
  const tous = rectangleMarge ? [...contour, ...rectangleMarge] : contour;
  const xs = tous.map((p) => p[0]);
  const ys = tous.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  let out = "";

  // ---- HEADER ----
  out += l(0, "SECTION") + l(2, "HEADER");
  out += l(9, "$ACADVER") + l(1, "AC1009");
  out += l(9, "$INSUNITS") + l(70, 4);            // 4 = millimetres
  out += l(9, "$EXTMIN") + l(10, minX.toFixed(4)) + l(20, minY.toFixed(4)) + l(30, "0.0");
  out += l(9, "$EXTMAX") + l(10, maxX.toFixed(4)) + l(20, maxY.toFixed(4)) + l(30, "0.0");
  out += l(0, "ENDSEC");

  // ---- ENTITIES ----
  out += l(0, "SECTION") + l(2, "ENTITIES");

  const polyligne = (points, calque) => {
    out += l(0, "POLYLINE") + l(8, calque) + l(66, 1) + l(70, 1);
    out += l(10, "0.0") + l(20, "0.0") + l(30, "0.0");
    points.forEach(([x, y]) => {
      out += l(0, "VERTEX") + l(8, calque);
      out += l(10, x.toFixed(4)) + l(20, y.toFixed(4)) + l(30, "0.0");
    });
    out += l(0, "SEQEND") + l(8, calque);
  };

  const texte = (contenu, x, y, hauteur) => {
    out += l(0, "TEXT") + l(8, "REPERE");
    out += l(10, x.toFixed(4)) + l(20, y.toFixed(4)) + l(30, "0.0");
    out += l(40, hauteur.toFixed(1)) + l(1, contenu);
  };

  polyligne(contour, "DECOUPE");

  let ox, oy;
  if (rectangleMarge) {
    polyligne(rectangleMarge, "PLAQUE_BRUTE");
    ox = rectangleMarge[0][0] + 10;
    oy = rectangleMarge[0][1] + 10;
  } else {
    ox = minX + 10;
    oy = minY + 10;
  }

  texte(nettoyer(reference), ox, oy, 25);
  const infos = [projet, date].filter(Boolean).map(nettoyer).join(" - ");
  if (infos) texte(infos, ox, oy - 32, 14);

  out += l(0, "ENDSEC") + l(0, "EOF");
  return out;
}

/** Retire les caracteres non-ASCII, qui peuvent bloquer la lecture. */
function nettoyer(texte) {
  return String(texte || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "_");
}

export function telechargerDXF(contenu, nomFichier) {
  enregistrerFichier(contenu, nomFichier, "application/dxf");
}

/**
 * Enregistre un fichier, en s'adaptant au contexte :
 * - dans l'application Android, via la passerelle native (le
 *   telechargement classique ne fonctionne pas dans une WebView) ;
 * - dans un navigateur, par un lien de telechargement ordinaire.
 */
export function enregistrerFichier(contenu, nomFichier, typeMime) {
  const passerelle = typeof window !== "undefined" && window.AndroidFichiers;

  if (passerelle && passerelle.disponible && passerelle.disponible()) {
    // Encodage base64 compatible avec les accents
    const octets = new TextEncoder().encode(contenu);
    let binaire = "";
    for (const o of octets) binaire += String.fromCharCode(o);
    passerelle.enregistrer(nomFichier, btoa(binaire), typeMime);
    return;
  }

  const blob = new Blob([contenu], { type: typeMime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
