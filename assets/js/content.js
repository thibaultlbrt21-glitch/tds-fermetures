/* =========================================================================
   WEBLY — Hydratation du contenu éditable
   -------------------------------------------------------------------------
   Lit content/site.json et remplace le contenu correspondant dans la page.
   Le HTML garde des valeurs par défaut complètes : si le fichier est absent,
   illisible, ou que le réseau échoue, la page reste entière — bon pour le
   référencement et pour les navigateurs sans JavaScript.

   Rien n'est inventé ici : un champ vide laisse la valeur du HTML en place,
   et une liste vide masque toute sa section.

   Conventions dans index.html :
     data-cms="chemin.vers.la.valeur"   -> remplace le texte de l'élément
     data-cms-optional                  -> ...et le masque si le champ est vide
     data-cms-image="chemin.vers.image" -> remplace le src de l'image
     data-cms-list="prestations.liste"   -> conteneur reconstruit par un rendu dédié
     data-cms-lien="tel" | "mailto"      -> ...et met à jour le lien (href)
     data-cms-attr="alt"                 -> ...écrit la valeur dans cet attribut, pas dans le texte

   ========================================================================= */
(function () {
  "use strict";

  var SOURCE = "content/site.json";

  /* ---------- Utilitaires ---------- */

  function get(data, chemin) {
    var parties = String(chemin).split(".");
    var cur = data;
    for (var i = 0; i < parties.length; i++) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[parties[i]];
    }
    return cur;
  }

  function rempli(v) {
    return v !== undefined && v !== null && String(v).trim() !== "";
  }

  // Tout passe par textContent : aucun HTML venu du CMS n'est interprété.
  function el(balise, classe, texte) {
    var n = document.createElement(balise);
    if (classe) n.className = classe;
    if (texte !== null && texte !== undefined) n.textContent = texte;
    return n;
  }

  // Masquer ne suffit pas : le contenu d'exemple resterait lisible dans le
  // code source d'un site client. On vide aussi le conteneur.
  function videEtMasque(cible, noeud) {
    if (cible) cible.textContent = "";
    masque(noeud);
  }

  function masque(noeud) {
    if (!noeud) return;
    noeud.hidden = true;
    if (!noeud.id) return;
    document.querySelectorAll('a[href="#' + noeud.id + '"]').forEach(function (a) {
      var li = a.closest("li");
      (li || a).hidden = true;
    });
  }

  // « 06 58 00 82 26 » -> « +33658008226 » : le format que tous les
  // téléphones composent, y compris depuis l'étranger.
  function versTel(numero) {
    var n = String(numero).replace(/[^\d+]/g, "");
    if (/^0\d{9}$/.test(n)) n = "+33" + n.slice(1);
    return n;
  }

  // Le numéro figure dans plusieurs boutons « Appeler » : un seul champ du
  // CMS les met tous à jour.
  function hydrateTelephones(data) {
    var numero = get(data, "infos.telephone");
    if (!rempli(numero)) return;
    var tel = "tel:" + versTel(numero);
    document.querySelectorAll('a[href^="tel:"]').forEach(function (a) { a.setAttribute("href", tel); });
  }

  function sectionDe(noeud) { return noeud ? noeud.closest("section") : null; }

  function conteneur(cle) { return document.querySelector('[data-cms-list="' + cle + '"]'); }

  /* ---------- Textes et images ---------- */

  function hydrateTextes(data) {
    document.querySelectorAll("[data-cms]").forEach(function (noeud) {
      var valeur = get(data, noeud.getAttribute("data-cms"));
      var facultatif = noeud.hasAttribute("data-cms-optional");
      if (rempli(valeur) && noeud.hasAttribute("data-cms-attr")) {
        // data-cms-attr="alt" : la valeur va dans cet attribut, pas dans le texte.
        noeud.setAttribute(noeud.getAttribute("data-cms-attr"), valeur);
      } else if (rempli(valeur)) {
        noeud.textContent = valeur;
        noeud.hidden = false;
        var lien = noeud.getAttribute("data-cms-lien");
        if (lien === "tel") noeud.setAttribute("href", "tel:" + versTel(valeur));
        if (lien === "mailto") noeud.setAttribute("href", "mailto:" + String(valeur).trim());
      } else if (facultatif) {
        noeud.hidden = true;
      }
    });
  }

  function hydrateImages(data) {
    document.querySelectorAll("[data-cms-image]").forEach(function (img) {
      var src = get(data, img.getAttribute("data-cms-image"));
      if (!rempli(src)) return;
      // Le chemin du CMS fait autorité : on désactive la bascule
      // automatique .svg -> .jpg de main.js pour cette image.
      img.removeAttribute("data-photo");
      // Une autre photo que celle livrée : les variantes (srcset) ne
      // correspondent plus, le navigateur prend la photo choisie.
      if (img.getAttribute("src") !== src) { img.removeAttribute("srcset"); img.removeAttribute("sizes"); }
      img.setAttribute("src", src);
    });
  }

  /* ---------- Rendus dédiés ----------
     Une clé absente du JSON laisse le contenu du HTML en place (une faute
     de frappe n'efface pas une section) ; seule une liste vide la masque. */

  function rendPrestations(liste) {
    var cible = conteneur("prestations.liste");
    if (!cible) return;
    if (liste === undefined) return;
    if (!Array.isArray(liste) || !liste.length) { videEtMasque(cible, document.getElementById("prestations")); return; }

    cible.textContent = "";
    liste.forEach(function (m, i) {
      var carte = el("article", "metier");
      carte.setAttribute("data-tilt", "");
      var fond = el("div", "metier__profondeur");
      fond.appendChild(el("span", "metier__num", String(i + 1).padStart(2, "0")));
      fond.appendChild(el("h3", null, m.titre || ""));
      if (rempli(m.texte)) fond.appendChild(el("p", null, m.texte));
      carte.appendChild(fond);
      cible.appendChild(carte);
    });
  }

  function rendChantiers(liste) {
    var cible = conteneur("chantiers.ouvrages");
    if (!cible) return;
    if (liste === undefined) return;
    if (!Array.isArray(liste) || !liste.length) { videEtMasque(cible, document.getElementById("chantiers")); return; }

    cible.textContent = "";
    var categories = {};
    liste.forEach(function (o) {
      var bouton = el("button", "oeuvre");
      bouton.type = "button";
      if (rempli(o.credit)) bouton.setAttribute("data-credit", o.credit);
      bouton.setAttribute("data-categorie", o.categorie || "tout");
      if (rempli(o.categorie)) categories[o.categorie] = true;
      // « paysage » ou « portrait » : connu d'avance, la mosaïque ne bouge
      // pas au chargement des photos.
      if (o.format === "paysage" || o.format === "portrait") {
        bouton.setAttribute("data-format", o.format);
        if (o.format === "paysage") bouton.classList.add("oeuvre--paysage");
      }

      var img = document.createElement("img");
      // loading="lazy" avant src : posé après, l'image partirait tout de suite.
      img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");
      img.setAttribute("src", o.image || "");
      img.setAttribute("alt", rempli(o.alt) ? o.alt : (o.titre || ""));
      if (rempli(o.cadrage)) img.style.objectPosition = o.cadrage;
      bouton.appendChild(img);

      var voile = el("span", "oeuvre__voile");
      voile.appendChild(el("span", "oeuvre__titre", o.titre || ""));
      if (rempli(o.meta)) voile.appendChild(el("span", "oeuvre__meta", o.meta));
      bouton.appendChild(voile);

      cible.appendChild(bouton);
    });

    // Un filtre sans aucune réalisation ne sert à rien : on le retire.
    document.querySelectorAll(".filtre").forEach(function (f) {
      var cle = f.getAttribute("data-filtre");
      f.hidden = cle !== "tout" && !categories[cle];
    });
  }

  // Les photos de l'accueil. main.js construit ensuite la jauge et la
  // légende d'après les attributs data-legende et data-credit.
  function rendPhotosAccueil(liste) {
    var cible = conteneur("hero.photos");
    if (!cible || !Array.isArray(liste)) return;
    liste = liste.filter(function (p) { return p && rempli(p.image); });
    if (!liste.length) {
      var visuel = cible.closest(".hero__visuel");
      videEtMasque(cible, null);
      if (visuel) { visuel.textContent = ""; visuel.hidden = true; }
      return;
    }

    cible.textContent = "";
    liste.forEach(function (p, i) {
      var figure = el("figure", "hero__photo" + (i === 0 ? " est-active" : ""));
      if (rempli(p.legende)) figure.setAttribute("data-legende", p.legende);
      if (rempli(p.credit)) figure.setAttribute("data-credit", p.credit);
      var img = document.createElement("img");
      // Seule la première photo se charge avec la page ; main.js charge les
      // suivantes (data-src) au fil du diaporama.
      img.setAttribute(i === 0 ? "src" : "data-src", p.image);
      img.setAttribute("alt", rempli(p.alt) ? p.alt : "");
      if (rempli(p.cadrage)) img.style.objectPosition = p.cadrage;
      img.setAttribute("decoding", "async");
      if (i === 0) img.setAttribute("fetchpriority", "high");
      figure.appendChild(img);
      cible.appendChild(figure);
    });
  }

  // Le cadre orange qui désigne l'ouvrage sur la photo de réalisation :
  // « gauche haut largeur hauteur », en % de la photo. Vide = pas de cadre
  // (une autre photo n'a pas l'ouvrage au même endroit).
  function rendCadre(valeur) {
    var cadre = document.getElementById("cadreRealisation");
    if (!cadre) return;
    var v = String(valeur || "").trim().split(/[\s;,]+/).map(parseFloat);
    if (v.length !== 4 || v.some(isNaN)) { cadre.hidden = true; return; }
    cadre.hidden = false;
    cadre.style.left = v[0] + "%"; cadre.style.top = v[1] + "%";
    cadre.style.width = v[2] + "%"; cadre.style.height = v[3] + "%";
  }

  // Les engagements du bandeau orange : un titre et une phrase.
  function rendEngagements(liste) {
    var cible = conteneur("engagements");
    if (!cible) return;
    if (liste === undefined) return;
    if (!Array.isArray(liste) || !liste.length) { videEtMasque(cible, document.getElementById("engagements")); return; }

    cible.textContent = "";
    liste.forEach(function (e) {
      var bloc = el("div", "engagement");
      bloc.appendChild(el("h3", null, e.titre || ""));
      if (rempli(e.texte)) bloc.appendChild(el("p", null, e.texte));
      cible.appendChild(bloc);
    });
  }

  // Les dispositifs d'aide ont la même forme que les prestations, mais leur
  // « numéro » est un nom court (MaPrimeRénov', CEE...) et non un rang.
  function rendDispositifs(liste) {
    var cible = conteneur("aides.dispositifs");
    if (!cible) return;
    if (liste === undefined) return;
    if (!Array.isArray(liste) || !liste.length) { videEtMasque(cible, document.getElementById("aides")); return; }

    cible.textContent = "";
    liste.forEach(function (d) {
      var carte = el("article", "metier");
      carte.setAttribute("data-tilt", "");
      var fond = el("div", "metier__profondeur");
      fond.appendChild(el("span", "metier__num", d.sigle || ""));
      fond.appendChild(el("h3", null, d.titre || ""));
      if (rempli(d.texte)) fond.appendChild(el("p", null, d.texte));
      carte.appendChild(fond);
      cible.appendChild(carte);
    });
  }

  function rendEtapes(liste) {
    var cible = conteneur("processus.etapes");
    if (!cible) return;
    if (liste === undefined) return;
    if (!Array.isArray(liste) || !liste.length) { videEtMasque(cible, sectionDe(cible)); return; }

    cible.textContent = "";
    liste.forEach(function (e, i) {
      var etape = el("div", "etape");
      etape.appendChild(el("span", "etape__num", "Étape " + String(i + 1).padStart(2, "0")));
      etape.appendChild(el("h3", null, e.titre || ""));
      if (rempli(e.texte)) etape.appendChild(el("p", null, e.texte));
      cible.appendChild(etape);
    });
  }

  function rendGaranties(liste) {
    var cible = conteneur("devis.garanties");
    if (!cible) return;
    if (liste === undefined) return;
    if (!Array.isArray(liste) || !liste.length) { cible.textContent = ""; cible.hidden = true; return; }

    cible.textContent = "";
    liste.forEach(function (g, i) {
      var li = document.createElement("li");
      li.appendChild(el("span", null, String(i + 1).padStart(2, "0")));
      var corps = document.createElement("div");
      corps.appendChild(el("strong", null, g.titre || ""));
      if (rempli(g.texte)) corps.appendChild(document.createTextNode(" " + g.texte));
      li.appendChild(corps);
      cible.appendChild(li);
    });
  }

  function rendAvis(liste) {
    var cible = conteneur("avis");
    if (!cible) return;
    // Pas d'avis renseigné = section entièrement masquée. Jamais d'avis
    // inventé, jamais d'emplacement réservé sur un site en ligne.
    if (!Array.isArray(liste) || !liste.length) { videEtMasque(cible, document.getElementById("avis")); return; }

    cible.textContent = "";
    var section = document.getElementById("avis");
    if (section) section.hidden = false;
    liste.forEach(function (a) {
      var carte = el("article", "avis-carte");
      var note = parseInt(a.note, 10);
      if (!isNaN(note) && note > 0) {
        note = Math.min(note, 5);
        var etoiles = el("div", "avis-carte__etoiles", "★★★★★".slice(0, note));
        etoiles.setAttribute("aria-label", "Note : " + note + " sur 5");
        carte.appendChild(etoiles);
      }
      if (rempli(a.texte)) carte.appendChild(el("p", "avis-carte__texte", "« " + a.texte + " »"));
      var signature = [a.auteur, a.source].filter(rempli).join(" — ");
      if (signature) carte.appendChild(el("p", "avis-carte__nom", signature));
      cible.appendChild(carte);
    });
  }

  function rendHoraires(liste) {
    var table = conteneur("infos.horaires");
    if (!table || liste === undefined) return;
    // Pas d'horaires renseignés : rien d'affiché, plutôt qu'un « à renseigner ».
    if (!Array.isArray(liste) || !liste.length) { table.textContent = ""; table.hidden = true; return; }
    table.hidden = false;
    var corps = table.tBodies[0] || table;
    corps.textContent = "";
    liste.forEach(function (h) {
      var tr = document.createElement("tr");
      tr.appendChild(el("td", null, h.jours || ""));
      tr.appendChild(el("td", null, h.horaire || ""));
      corps.appendChild(tr);
    });
  }

  function rendZones(liste) {
    var cible = conteneur("infos.zones");
    if (!cible) return;
    if (liste === undefined) return;
    if (!Array.isArray(liste) || !liste.length) { cible.textContent = ""; cible.hidden = true; return; }
    cible.textContent = "";
    liste.forEach(function (z) { cible.appendChild(el("span", null, String(z))); });
  }

  function rendReseaux(liste) {
    var cible = conteneur("pied.reseaux");
    if (!cible) return;
    if (liste === undefined) return;
    if (!Array.isArray(liste) || !liste.length) { cible.textContent = ""; cible.hidden = true; return; }
    cible.textContent = "";
    cible.hidden = false;
    liste.forEach(function (r) {
      var li = document.createElement("li");
      // Sans adresse de profil valide (https uniquement), le nom s'affiche en
      // texte : jamais de lien mort, jamais de lien « javascript: ».
      if (!/^https:\/\//i.test(String(r.url || ""))) { li.appendChild(el("span", null, r.nom || "")); cible.appendChild(li); return; }
      var a = el("a", null, r.nom || "");
      a.setAttribute("href", r.url);
      a.setAttribute("rel", "noopener");
      a.setAttribute("target", "_blank");
      li.appendChild(a);
      cible.appendChild(li);
    });
  }

  /* ---------- Orchestration ---------- */

  function hydrate(data) {
    window.WEBLY_CONTENT = data;
    hydrateTextes(data);
    hydrateImages(data);
    hydrateTelephones(data);
    rendPhotosAccueil(get(data, "hero.photos"));
    if (data.realisation) rendCadre(data.realisation.cadre);
    else if (data.realisation === null) { var rea = document.getElementById("realisation"); if (rea) masque(rea); }
    rendEngagements(data.engagements);
    rendPrestations(get(data, "prestations.liste"));
    rendChantiers(get(data, "chantiers.ouvrages"));
    rendDispositifs(get(data, "aides.dispositifs"));
    rendEtapes(get(data, "processus.etapes"));
    rendGaranties(get(data, "devis.garanties"));
    rendAvis(data.avis);
    rendHoraires(get(data, "infos.horaires"));
    rendZones(get(data, "infos.zones"));
    rendReseaux(get(data, "pied.reseaux"));
    document.body.setAttribute("data-content", "loaded");
  }

  window.WEBLY_CONTENT = null;

  if (!window.Promise || !window.fetch) {
    window.WEBLY_CONTENT_READY = null;
    return;
  }

  window.WEBLY_CONTENT_READY = fetch(SOURCE, { cache: "no-cache" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      // Arrivé après le démarrage de main.js (réseau lent) : la page garde
      // son contenu HTML, déjà actif ; seule l'adresse de réception compte.
      if (window.WEBLY_DEMARRE) { window.WEBLY_CONTENT = data; return data; }
      try { hydrate(data); }
      catch (e) { console.warn("[Webly] Hydratation partielle :", e); }
      return data;
    })
    .catch(function (e) {
      // Cas normal en ouverture directe du fichier (file://) : le HTML livré
      // reste affiché tel quel, le site reste lisible.
      console.warn("[Webly] content/site.json non chargé — contenu par défaut du HTML :", e);
      return null;
    });
})();
