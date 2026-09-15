# FASTCUT

Relève les cotes d'un gabarit, récupère un DXF prêt pour la découpe.

---

## Construire l'APK

L'application est **embarquée dans l'APK** : une fois installée, elle
fonctionne sans connexion et sans dépendre d'une adresse internet.

### Sur GitHub

1. Sur ton dépôt (`fastcutv2` ou un nouveau), téléverse **tous les
   fichiers de ce dossier**, en conservant l'arborescence :
   - à la racine : `index.html`, `moteur.js`, `dxf.js`, `exports.js`,
     `manifest.json`, `sw.js`, les trois icônes
   - le dossier `apk/` complet
   - le fichier `.github/workflows/build_apk.yml` (ce chemin exact)

2. Onglet **Actions** → **Construire l'APK FASTCUT** → **Run workflow**.

3. Compte 5 à 10 minutes.

4. En bas de l'exécution, section **Artifacts** : télécharge
   `FASTCUT-apk`, dézippe → tu as `FASTCUT.apk`.

### Installer sur la tablette

Transfère le `.apk`, ouvre-le. Android demandera d'autoriser
l'installation depuis une source inconnue : c'est normal pour un fichier
qui ne vient pas du Play Store.

### Garde `fastcut.keystore`

Ce fichier est inclus dans le téléchargement. **Conserve-le** : sans
lui, tu ne pourras plus publier de mise à jour — Android refuse une
mise à jour signée par une autre clé.

---

## Relever un gabarit

1. Choisis le nombre de côtés.
2. Ouvre l'onglet **Croquis de mesure** : il indique par quel coin
   partir (point rouge), l'ordre de numérotation des côtés, et quelles
   diagonales relever.
3. Tourne **toujours dans le même sens**.
4. Saisis les cotes ; l'aperçu se dessine au fur et à mesure.

### Ce que l'application contrôle

| Message | Signification |
|---|---|
| **Forme calculée** — écart < 0,3 mm | Relevé net |
| **Forme calculée** — écart 0,3 à 1 mm | Relevé approximatif : vérifie avant de découper |
| **Forme calculée** — écart > 1 mm | Une mesure est probablement fausse |
| **Plusieurs formes possibles** | Ces mesures décrivent plusieurs pièces. Compare avec **Agrandir**, choisis celle du gabarit. |
| **Mesures incohérentes** | Ces longueurs ne forment pas une pièce fermée. |

**Vérifier** propose une mesure de contrôle à relever sur le gabarit.
**Retourner** sert si les côtés ont été relevés dans l'autre sens.

---

## Les fichiers produits

Tout va dans le dossier **Téléchargements** de la tablette :

- **DXF** — un fichier par panneau
- **Fiche** — document imprimable avec le croquis coté de chaque panneau
- **Excel** — tableau `.csv` de la commande
- **Sauvegarder tout** (page Projets) — tous tes projets dans un fichier.
  **À faire régulièrement** : sans sauvegarde, tout est perdu si la
  tablette est réinitialisée.

---

## Structure du dossier

| Élément | Rôle |
|---|---|
| `index.html` | Interface et logique |
| `moteur.js` | Calcul des formes, détection des cas ambigus |
| `dxf.js` | Génération des DXF (format R12, compatible AutoCAD) |
| `exports.js` | Fiche imprimable, Excel, sauvegarde |
| `manifest.json`, `sw.js`, icônes | Pour l'usage en navigateur |
| `apk/` | Projet Android (l'app web y est copiée à la compilation) |
| `.github/workflows/` | Compilation automatique de l'APK |

---

Abdelhak AITADDI · +212 666 951 305
