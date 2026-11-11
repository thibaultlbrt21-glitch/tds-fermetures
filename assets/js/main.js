(function () {
  "use strict";

  /* =========================================================
     CONFIG — tout se règle ici
     ========================================================= */
  var SITE_CONFIG = {
    // Adresse qui reçoit les demandes de devis (l'e-mail « Client » de la
    // carte de visite). Elle peut aussi être changée dans content/site.json,
    // qui l'emporte.
    devisEmail: "tiagotdsfermetures.21@hotmail.com",

    // Service qui transforme le formulaire en e-mail, par exemple
    // FormSubmit : "https://formsubmit.co/ajax/" (à la toute première
    // demande, il envoie à l'adresse ci-dessus un e-mail « Activate Form »
    // sur lequel il faut cliquer une fois). Vide : aucun service tiers, la
    // demande est préparée et le visiteur l'envoie depuis sa messagerie.
    // Vide tant que le site n'est pas sur son domaine définitif ; à
    // réactiver alors, en mettant à jour la politique de confidentialité,
    // la mention sous le formulaire, la phrase d'introduction du devis
    // (index.html et site.json) et la Content-Security-Policy.
    serviceEnvoi: "",

    // Durée d'affichage de chaque photo de l'accueil, en millisecondes.
    dureePhoto: 6500
  };

  function boot() {
  // content.js n'hydrate plus la page une fois les écouteurs posés : un
  // site.json arrivé après le délai remplacerait des éléments déjà actifs.
  window.WEBLY_DEMARRE = true;

  var reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var pointeurFin = window.matchMedia("(pointer: fine)").matches;

  var entete = document.getElementById("entete");
  var hero = document.querySelector(".hero");

  /* ---------- En-tête ---------- */
  // Au plus une mise à jour par image affichée, et seulement quand l'état
  // change. La hauteur de l'accueil est lue une fois (et au redimensionnement),
  // jamais pendant le défilement : la lire forcerait un recalcul de la page.
  var hauteurHero = 0;
  var pose = null, descendu = null, defilementPrevu = false;
  function mesure() { hauteurHero = hero ? hero.offsetHeight : window.innerHeight; }
  function auDefilement() {
    defilementPrevu = false;
    var y = window.scrollY;
    var p = y > 40, d = y > hauteurHero * 0.6;
    if (entete && p !== pose) { pose = p; entete.classList.toggle("est-pose", p); }
    if (d !== descendu) { descendu = d; document.body.classList.toggle("est-descendu", d); }
  }
  mesure();
  auDefilement();

  // Barre d'appel masquée pendant que le devis est à l'écran : elle
  // recouvrait le formulaire, et le panneau final propose déjà d'appeler.
  var sectionDevis = document.getElementById("devis");
  if (sectionDevis && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entrees) {
      document.body.classList.toggle("devis-visible", entrees[0].isIntersecting);
    }).observe(sectionDevis);
  }
  window.addEventListener("scroll", function () {
    if (!defilementPrevu) { defilementPrevu = true; window.requestAnimationFrame(auDefilement); }
  }, { passive: true });
  window.addEventListener("resize", function () {
    mesure(); auDefilement();
    // Tablette tournée avec le menu ouvert : le menu n'existe plus en
    // grand écran, la page ne doit pas rester bloquée.
    if (window.innerWidth > 1100) fermeMenu();
  }, { passive: true });

  /* ---------- Menu mobile ---------- */
  var burger = document.getElementById("burger");
  var menuMobile = document.getElementById("menuMobile");
  var fermerMenu = document.getElementById("fermerMenu");

  // Menu ouvert : le reste de la page devient inerte, la touche Tab reste
  // dans le menu. Fermé, le menu est invisible et hors de l'ordre du
  // clavier (visibility: hidden dans la feuille de style).
  var horsMenu = [entete, document.getElementById("principal"), document.querySelector(".pied"),
    document.querySelector(".appel-mobile"), document.querySelector(".skip-link")];
  function fermeMenu() {
    if (!menuMobile || !menuMobile.classList.contains("est-ouvert")) return;
    menuMobile.classList.remove("est-ouvert");
    burger.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    horsMenu.forEach(function (el) { if (el) el.inert = false; });
  }
  function ouvreMenu() {
    menuMobile.classList.add("est-ouvert");
    burger.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    horsMenu.forEach(function (el) { if (el) el.inert = true; });
    var premier = menuMobile.querySelector("a");
    if (premier) premier.focus();
  }
  if (burger && menuMobile) {
    burger.addEventListener("click", function () {
      if (menuMobile.classList.contains("est-ouvert")) fermeMenu(); else ouvreMenu();
    });
    if (fermerMenu) fermerMenu.addEventListener("click", function () { fermeMenu(); burger.focus(); });
    menuMobile.querySelectorAll("a").forEach(function (a) { a.addEventListener("click", fermeMenu); });
    document.addEventListener("keydown", function (e) {
      if (!menuMobile.classList.contains("est-ouvert")) return;
      if (e.key === "Escape") { fermeMenu(); burger.focus(); return; }
      if (e.key === "Tab") {
        var cibles = menuMobile.querySelectorAll("a, button");
        var premier = cibles[0], dernier = cibles[cibles.length - 1];
        if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
        else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
      }
    });
  }

  /* ---------- Apparitions au défilement ---------- */
  var aReveler = document.querySelectorAll(".apparait");
  if (aReveler.length) {
    if (reduit || !("IntersectionObserver" in window)) {
      aReveler.forEach(function (el) { el.classList.add("est-visible"); });
    } else {
      var io = new IntersectionObserver(function (entrees) {
        entrees.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("est-visible"); io.unobserve(e.target); }
        });
      // Seuil 0 : un bloc plus haut que l'écran (la galerie, sur un
      // téléphone à l'horizontale) n'atteindrait jamais 10 % visibles.
      }, { threshold: 0, rootMargin: "0px 0px -50px 0px" });
      aReveler.forEach(function (el) { io.observe(el); });
    }
  }

  /* ---------- Étapes du processus ---------- */
  var etapes = document.querySelectorAll(".etape");
  if (etapes.length && "IntersectionObserver" in window && !reduit) {
    var restantes = etapes.length;
    var ioEtapes = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("est-vue");
        ioEtapes.unobserve(e.target);
        if (--restantes === 0) ioEtapes.disconnect();
      });
    }, { threshold: 0.5 });
    etapes.forEach(function (el) { ioEtapes.observe(el); });
  } else {
    etapes.forEach(function (el) { el.classList.add("est-vue"); });
  }

  /* ---------- Réalisation : le portail s'ouvre ---------- */
  // Le panneau à lames coulisse une seule fois, quand la photo est bien à
  // l'écran. Pas de script, pas d'IntersectionObserver ou mouvement réduit :
  // le panneau n'existe pas et la photo s'affiche directement.
  var figureRea = document.getElementById("figureRealisation");
  if (figureRea && !reduit && "IntersectionObserver" in window) {
    document.documentElement.classList.add("anim-portail");
    // Ouverture quand 70 % de la photo est visible — ou, si l'écran est
    // trop bas pour ça, quand elle occupe déjà 60 % de sa hauteur.
    var ioRea = new IntersectionObserver(function (entrees) {
      var e = entrees[0];
      if (!e.isIntersecting) return;
      if (e.intersectionRatio < 0.7 && e.intersectionRect.height < window.innerHeight * 0.6) return;
      figureRea.classList.add("est-ouverte");
      ioRea.disconnect();
    }, { threshold: [0.25, 0.4, 0.55, 0.7] });
    ioRea.observe(figureRea);
  }

  /* ---------- Photos de l'accueil : fondu enchaîné ---------- */
  // Une jauge par photo (cliquable), la légende et le crédit de la photo
  // affichée, et un bouton Pause : un contenu qui change tout seul doit
  // pouvoir être arrêté. En mouvement réduit, rien ne défile.
  var photos = Array.prototype.slice.call(document.querySelectorAll(".hero__photo"));
  var repere = document.getElementById("repereAccueil");
  if (hero && !photos.length) hero.classList.add("hero--sans-photo");
  if (repere && !photos.length) repere.hidden = true;
  if (repere && photos.length) {
    var jaugePhotos = repere.querySelector(".hero__jauge");
    var numPhoto = repere.querySelector(".hero__legende-num");
    var textePhoto = repere.querySelector(".hero__legende-texte");
    var creditPhoto = repere.querySelector(".hero__legende-credit");
    var pause = repere.querySelector(".hero__pause");
    var photoCourante = 0;
    var minuteur = null;
    var enPause = reduit;
    var deux = function (n) { return String(n).padStart(2, "0"); };

    var traits = photos.map(function (photo, i) {
      var trait = document.createElement("button");
      trait.type = "button";
      trait.setAttribute("aria-label", "Photo " + (i + 1) + " : " + (photo.getAttribute("data-legende") || ""));
      trait.addEventListener("click", function () { montrePhoto(i); relance(); });
      jaugePhotos.appendChild(trait);
      return trait;
    });

    // Seule la première photo se charge avec la page (data-src sur les
    // autres) : chacune est demandée quand elle s'affiche, la suivante
    // pendant que la précédente est à l'écran.
    var charge = function (photo) {
      var img = photo && photo.querySelector("img[data-src]");
      if (!img) return;
      img.setAttribute("src", img.getAttribute("data-src"));
      img.removeAttribute("data-src");
    };
    var legende = repere.querySelector(".hero__legende");
    var montrePhoto = function (i) {
      photoCourante = (i + photos.length) % photos.length;
      charge(photos[photoCourante]);
      photos.forEach(function (p, j) { p.classList.toggle("est-active", j === photoCourante); });
      traits.forEach(function (t, j) { t.setAttribute("aria-current", String(j === photoCourante)); });
      var photo = photos[photoCourante];
      charge(photos[(photoCourante + 1) % photos.length]);
      numPhoto.textContent = deux(photoCourante + 1) + " / " + deux(photos.length);
      textePhoto.textContent = photo.getAttribute("data-legende") || "";
      creditPhoto.textContent = photo.getAttribute("data-credit") || "";
      creditPhoto.hidden = !creditPhoto.textContent;
    };
    var aLEcran = true;
    var relance = function () {
      window.clearInterval(minuteur);
      var defile = !enPause && aLEcran && !document.hidden && photos.length > 1;
      // La légende n'est annoncée aux lecteurs d'écran que quand le
      // visiteur change lui-même de photo, pas toutes les 6,5 s.
      if (legende) legende.setAttribute("aria-live", defile ? "off" : "polite");
      if (defile) {
        minuteur = window.setInterval(function () { montrePhoto(photoCourante + 1); }, SITE_CONFIG.dureePhoto);
      }
    };

    repere.classList.toggle("est-fixe", photos.length < 2);
    pause.textContent = enPause ? "Lecture" : "Pause";
    pause.addEventListener("click", function () {
      enPause = !enPause;
      pause.textContent = enPause ? "Lecture" : "Pause";
      relance();
    });
    // Onglet en arrière-plan ou accueil sorti de l'écran : le fondu s'arrête,
    // pour laisser toute la puissance au défilement ; il reprend au retour.
    document.addEventListener("visibilitychange", relance);
    if ("IntersectionObserver" in window && hero) {
      new IntersectionObserver(function (entrees) {
        aLEcran = entrees[0].isIntersecting;
        relance();
      }).observe(hero);
    }

    montrePhoto(0);
    relance();
  }

  /* ---------- Cartes en relief ---------- */
  // Le basculement suit le curseur : c'est ce qui donne l'impression que la
  // carte est un objet posé, pas une image. Désactivé au doigt et en
  // mouvement réduit, où l'effet n'apporte rien.
  // La carte n'est promue sur la carte graphique que pendant le survol.
  if (pointeurFin && !reduit) {
    document.querySelectorAll("[data-tilt]").forEach(function (carte) {
      var cadre = null;
      carte.addEventListener("pointermove", function (e) {
        if (cadre) return;
        cadre = window.requestAnimationFrame(function () {
          cadre = null;
          var r = carte.getBoundingClientRect();
          var x = (e.clientX - r.left) / r.width - 0.5;
          var y = (e.clientY - r.top) / r.height - 0.5;
          carte.style.transform =
            "perspective(900px) rotateY(" + (x * 7).toFixed(2) + "deg) rotateX(" +
            (-y * 7).toFixed(2) + "deg) translateZ(6px)";
        });
      });
      carte.addEventListener("pointerleave", function () {
        if (cadre) { window.cancelAnimationFrame(cadre); cadre = null; }
        carte.style.transform = "";
      });
    });
  }

  /* =========================================================
     EN IMAGES — mosaïque, filtres et visionneuse
     ========================================================= */
  var galerie = document.getElementById("galerie");
  var oeuvres = galerie ? Array.prototype.slice.call(galerie.querySelectorAll(".oeuvre")) : [];
  var filtres = Array.prototype.slice.call(document.querySelectorAll(".filtre"));

  // Une photo en largeur occupe deux colonnes de la mosaïque. Le format est
  // indiqué dans le HTML (classe oeuvre--paysage, champ « format » du JSON)
  // pour que la mosaïque ne bouge pas au chargement ; à défaut, il est lu
  // sur l'image elle-même.
  oeuvres.forEach(function (o) {
    var img = o.querySelector("img");
    if (!img || o.hasAttribute("data-format")) return;
    var classe = function () {
      if (img.naturalWidth) o.classList.toggle("oeuvre--paysage", img.naturalWidth > img.naturalHeight * 1.15);
    };
    if (img.complete) classe(); else img.addEventListener("load", classe);
  });

  function oeuvresVisibles() {
    return oeuvres.filter(function (o) { return !o.classList.contains("est-masquee"); });
  }

  filtres.forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      var choix = bouton.getAttribute("data-filtre");
      filtres.forEach(function (b) { b.setAttribute("aria-pressed", String(b === bouton)); });
      oeuvres.forEach(function (o) {
        var garde = choix === "tout" || o.getAttribute("data-categorie") === choix;
        o.classList.toggle("est-masquee", !garde);
      });
    });
  });

  var visionneuse = document.getElementById("visionneuse");
  var vueImage = document.getElementById("visionneuseImage");
  var vueLegende = document.getElementById("visionneuseLegende");
  var focusAvant = null;
  var positionVue = 0;

  function montreVue(position) {
    var liste = oeuvresVisibles();
    if (!liste.length) return;
    positionVue = (position + liste.length) % liste.length;
    var oeuvre = liste[positionVue];
    var img = oeuvre.querySelector("img");
    var titre = oeuvre.querySelector(".oeuvre__titre");
    var meta = oeuvre.querySelector(".oeuvre__meta");
    vueImage.src = img.getAttribute("src");
    vueImage.alt = img.getAttribute("alt") || "";
    // Sans doublon : le sous-titre et le crédit peuvent être identiques.
    vueLegende.textContent = [titre && titre.textContent, meta && meta.textContent, oeuvre.getAttribute("data-credit")]
      .filter(function (v, i, a) { return v && a.indexOf(v) === i; }).join(" · ");
  }

  function ouvreVue(oeuvre) {
    focusAvant = document.activeElement;
    montreVue(oeuvresVisibles().indexOf(oeuvre));
    visionneuse.classList.add("est-ouverte");
    document.body.style.overflow = "hidden";
    visionneuse.querySelector("[data-fermer-visionneuse]").focus();
  }
  function fermeVue() {
    visionneuse.classList.remove("est-ouverte");
    document.body.style.overflow = "";
    if (focusAvant) focusAvant.focus();
  }

  if (visionneuse && oeuvres.length) {
    oeuvres.forEach(function (o) {
      o.addEventListener("click", function () { ouvreVue(o); });
    });
    visionneuse.querySelector("[data-fermer-visionneuse]").addEventListener("click", fermeVue);
    visionneuse.querySelector("[data-visionneuse-prec]").addEventListener("click", function () { montreVue(positionVue - 1); });
    visionneuse.querySelector("[data-visionneuse-suiv]").addEventListener("click", function () { montreVue(positionVue + 1); });
    visionneuse.addEventListener("click", function (e) { if (e.target === visionneuse) fermeVue(); });

    document.addEventListener("keydown", function (e) {
      if (!visionneuse.classList.contains("est-ouverte")) return;
      if (e.key === "Escape") { fermeVue(); return; }
      if (e.key === "ArrowLeft") { montreVue(positionVue - 1); return; }
      if (e.key === "ArrowRight") { montreVue(positionVue + 1); return; }
      if (e.key === "Tab") {
        // Seulement les boutons affichés (les flèches peuvent être masquées).
        var cibles = Array.prototype.filter.call(visionneuse.querySelectorAll("button"),
          function (b) { return b.offsetParent !== null; });
        var premier = cibles[0], dernier = cibles[cibles.length - 1];
        if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
        else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
      }
    });
  }

  /* =========================================================
     DEVIS — formulaire par étapes
     Validation réelle, puis envoi à l'adresse de l'entreprise par le
     service configuré (SITE_CONFIG.serviceEnvoi). Sans service, ou si
     l'envoi échoue, la demande n'est pas perdue : le visiteur l'envoie
     depuis sa propre messagerie, déjà rédigée, ou appelle.
     ========================================================= */
  var form = document.getElementById("formDevis");
  if (form) {
    var volets = Array.prototype.slice.call(form.querySelectorAll(".volet"));
    var jauge = Array.prototype.slice.call(form.querySelectorAll(".devis__jauge span"));
    var btnPrec = document.getElementById("precedent");
    var btnSuiv = document.getElementById("suivant");
    var btnEnvoi = document.getElementById("envoyer");
    // Sans service d'envoi, le site prépare la demande ; avec, il l'envoie.
    if (SITE_CONFIG.serviceEnvoi) btnEnvoi.textContent = "Envoyer la demande";
    var etat = document.getElementById("etatDevis");
    var annonce = document.getElementById("etapeCourante");
    var courante = 0;
    var changement = 0; // heure du dernier changement d'étape

    // « focalise » : seulement quand le visiteur change lui-même d'étape.
    // Au chargement, déplacer le focus dans le formulaire volerait la
    // première touche Tab et ferait démarrer un lecteur d'écran en milieu
    // de page.
    function montreVolet(position, focalise) {
      courante = Math.max(0, Math.min(volets.length - 1, position));
      changement = Date.now();
      volets.forEach(function (v, i) { v.classList.toggle("est-active", i === courante); });
      jauge.forEach(function (s, i) { s.classList.toggle("est-faite", i <= courante); });
      btnPrec.hidden = courante === 0;
      btnSuiv.hidden = courante === volets.length - 1;
      btnEnvoi.hidden = courante !== volets.length - 1;
      if (annonce) annonce.textContent = "Étape " + (courante + 1) + " sur " + volets.length;
      etat.textContent = "";
      etat.className = "devis__etat";
      var aide = document.getElementById("secoursDevis");
      if (aide) aide.hidden = true;
      btnEnvoi.classList.add("btn--plein");
      var premier = volets[courante].querySelector("input, select, textarea");
      if (focalise && premier) premier.focus({ preventScroll: true });
      // Le haut du formulaire est sorti de l'écran (étape précédente plus
      // longue) : on y remonte pour montrer le titre de la nouvelle étape.
      if (focalise && form.getBoundingClientRect().top < 80) {
        form.scrollIntoView({ block: "start", behavior: reduit ? "auto" : "smooth" });
      }
    }

    function messageErreur(champ) {
      if (champ.validity.valueMissing) return "Champ obligatoire.";
      if (champ.validity.typeMismatch && champ.type === "email") return "Vérifiez l'adresse e-mail (exemple\u00a0: vous@exemple.fr).";
      if (champ.validity.patternMismatch && champ.type === "tel") return "Vérifiez le numéro (exemple\u00a0: 06 12 34 56 78).";
      return "";
    }

    function valideVolet(position) {
      var volet = volets[position];
      var ok = true;

      // Étape 1 : un choix d'ouvrage est nécessaire pour chiffrer quoi que ce soit.
      var radios = volet.querySelectorAll('input[type="radio"][required]');
      if (radios.length) {
        var coche = volet.querySelector('input[type="radio"]:checked');
        var err = document.getElementById("ouvrageErreur");
        if (err) err.textContent = coche ? "" : "Choisissez un type d'ouvrage.";
        if (!coche) ok = false;
      }

      volet.querySelectorAll("input[required], select[required]").forEach(function (champ) {
        if (champ.type === "radio") return;
        var err = document.getElementById(champ.id + "Erreur");
        var message = messageErreur(champ);
        if (err) err.textContent = message;
        champ.setAttribute("aria-invalid", message ? "true" : "false");
        if (message) ok = false;
      });
      return ok;
    }

    // Efface l'erreur dès que le visiteur corrige : pas de rouge qui s'incruste.
    form.querySelectorAll("input, select").forEach(function (champ) {
      var evenement = champ.type === "radio" ? "change" : "input";
      champ.addEventListener(evenement, function () {
        if (champ.type === "radio") {
          var err = document.getElementById("ouvrageErreur");
          if (err) err.textContent = "";
          if (etat.classList.contains("est-ko")) { etat.textContent = ""; etat.className = "devis__etat"; }
          return;
        }
        var e = document.getElementById(champ.id + "Erreur");
        if (e && e.textContent) {
          e.textContent = messageErreur(champ);
          champ.setAttribute("aria-invalid", e.textContent ? "true" : "false");
        }
      });
    });

    btnSuiv.addEventListener("click", function () {
      if (tropTot()) return;
      if (!valideVolet(courante)) {
        etat.textContent = "Merci de compléter cette étape.";
        etat.className = "devis__etat est-ko";
        return;
      }
      montreVolet(courante + 1, true);
    });
    btnPrec.addEventListener("click", function () { montreVolet(courante - 1, true); });

    function valeur(id) {
      var el = document.getElementById(id);
      return el ? el.value.trim() : "";
    }

    function destinataire() {
      var contenu = window.WEBLY_CONTENT;
      return (contenu && contenu.devis && contenu.devis.email_reception) || SITE_CONFIG.devisEmail;
    }

    // La demande, champ par champ, dans l'ordre où elle se lit.
    function demande() {
      var ouvrage = form.querySelector('input[name="ouvrage"]:checked');
      ouvrage = ouvrage ? ouvrage.value : "Non précisé";
      var lignes = [
        ["Projet", ouvrage],
        ["Quantité ou dimensions", valeur("quantite")],
        ["Motorisation", valeur("motorisation")],
        ["Type de projet", valeur("typePose")],
        ["Âge du logement", valeur("anciennete")],
        ["Délai", valeur("delai")],
        ["Budget", valeur("budget")],
        ["Commune", valeur("adresseChantier")],
        ["Nom", valeur("nom")],
        ["E-mail", valeur("courriel")],
        ["Téléphone", valeur("telephone")],
        // En dernier : la seule ligne longue. Si une messagerie tronque un
        // lien trop long, les coordonnées sont déjà passées.
        ["Description", valeur("details")]
      ].filter(function (l) {
        // Les choix laissés par défaut n'apprennent rien à Tiago.
        return l[1] !== "" && l[1] !== "Non précisé" && l[1] !== "Non défini";
      });
      var sujet = ouvrage === "Service après-vente" ?
        "Demande de SAV — " + valeur("nom") :
        "Demande de devis — " + ouvrage + " — " + valeur("nom");
      return { sujet: sujet, lignes: lignes };
    }

    // Le visiteur envoie l'e-mail en son nom : il doit se lire comme un
    // message de sa part, pas comme une notification de robot.
    function texteDemande(d) {
      return ["Bonjour,", "", "Voici ma demande, préparée sur le site de TDS Fermetures :", ""]
        .concat(d.lignes.map(function (l) { return l[0] + " : " + l[1].replace(/\r?\n/g, "\r\n"); }))
        .concat(["", "Merci de me recontacter."]).join("\r\n");
    }

    function lienMessagerie(d) {
      return "mailto:" + destinataire() +
        "?subject=" + encodeURIComponent(d.sujet) + "&body=" + encodeURIComponent(texteDemande(d));
    }

    // « Copier ma demande » : pour qui n'a pas de messagerie installée
    // (webmail seulement). Proposé seulement si le navigateur sait copier.
    // Le lien est recalculé au clic : le visiteur a pu corriger un champ
    // après avoir préparé sa demande.
    var lienMail = document.getElementById("secoursMail");
    if (lienMail) lienMail.addEventListener("click", function () {
      lienMail.setAttribute("href", lienMessagerie(demande()));
    });

    var copieBloc = document.getElementById("copieBloc");
    var copieBtn = document.getElementById("copieDevis");
    var copieEtat = document.getElementById("copieEtat");
    if (copieBloc && copieBtn && navigator.clipboard && window.isSecureContext) {
      copieBloc.hidden = false;
      copieBtn.addEventListener("click", function () {
        var d = demande();
        navigator.clipboard.writeText((d.sujet + "\n\n" + texteDemande(d)).replace(/\r\n/g, "\n")).then(function () {
          copieEtat.textContent = "Demande copiée.";
        }, function () {
          copieEtat.textContent = "La copie n'a pas fonctionné.";
        });
      });
    }

    var secours = document.getElementById("secoursDevis");
    var merci = document.getElementById("merciDevis");

    function reussite() {
      form.hidden = true;
      merci.hidden = false;
      merci.focus({ preventScroll: true });
      merci.scrollIntoView({ block: "center", behavior: reduit ? "auto" : "smooth" });
    }

    // Le panneau « Envoyer par ma messagerie / Appeler » : affiché quand
    // aucun service d'envoi n'est configuré, ou quand l'envoi a échoué.
    function proposeMessagerie(d, message) {
      btnEnvoi.disabled = false;
      etat.textContent = message;
      etat.className = "devis__etat";
      var lien = document.getElementById("secoursMail");
      lien.setAttribute("href", lienMessagerie(d));
      // Un seul bouton orange : l'action qui reste à faire.
      btnEnvoi.classList.remove("btn--plein");
      if (copieEtat) copieEtat.textContent = "";
      secours.hidden = false;
      lien.focus({ preventScroll: true });
      secours.scrollIntoView({ block: "nearest", behavior: reduit ? "auto" : "smooth" });
    }

    function envoieDevis() {
      var d = demande();
      secours.hidden = true;

      // Sans service configuré (ou navigateur trop ancien) : messagerie.
      if (!SITE_CONFIG.serviceEnvoi || !window.fetch) {
        proposeMessagerie(d, "Votre demande est prête.");
        return;
      }

      var donnees = {
        _subject: d.sujet,
        _template: "table",
        _captcha: "false",
        // « email » : FormSubmit s'en sert comme adresse de réponse, pour que
        // Tiago puisse répondre directement au client.
        email: valeur("courriel")
      };
      d.lignes.forEach(function (l) { if (l[0] !== "E-mail") donnees[l[0]] = l[1]; });

      btnEnvoi.disabled = true;
      etat.textContent = "Envoi en cours…";
      etat.className = "devis__etat";

      var controle = window.AbortController ? new AbortController() : null;
      var minuteur = window.setTimeout(function () { if (controle) controle.abort(); }, 15000);

      fetch(SITE_CONFIG.serviceEnvoi + encodeURIComponent(destinataire()), {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(donnees),
        signal: controle ? controle.signal : undefined
      })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; });
        })
        .then(function (res) {
          window.clearTimeout(minuteur);
          // FormSubmit répond { success: "true" } quand l'e-mail est parti.
          if (res.ok && String(res.j.success) === "true") reussite();
          else proposeMessagerie(d, "L'envoi automatique n'a pas abouti.");
        })
        .catch(function () {
          window.clearTimeout(minuteur);
          proposeMessagerie(d, "L'envoi automatique n'a pas abouti.");
        });
    }

    // Un clic arrivé juste après un changement d'étape (double-clic sur
    // « Suivant ») ne doit pas valoir « Envoyer » sur l'étape suivante.
    function tropTot() { return Date.now() - changement < 400; }
    btnEnvoi.addEventListener("click", function (e) { if (tropTot()) e.preventDefault(); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      // Touche Entrée (ou « OK » du clavier d'un téléphone) avant la
      // dernière étape : on passe à l'étape suivante, on n'envoie pas.
      if (courante < volets.length - 1) { if (!tropTot()) btnSuiv.click(); return; }

      // Piège à robots rempli : on fait comme si tout allait bien, sans rien
      // envoyer.
      // (Seulement avec l'envoi automatique : en mode messagerie, rien ne
      // part sans le visiteur, et un remplissage automatique du navigateur
      // ne doit pas afficher un faux « merci ».)
      var piege = document.getElementById("siteWeb");
      if (piege && piege.value && SITE_CONFIG.serviceEnvoi) { reussite(); return; }

      // On revalide toutes les étapes : le visiteur a pu revenir en arrière
      // et vider un champ déjà validé.
      for (var i = 0; i < volets.length; i++) {
        if (!valideVolet(i)) {
          montreVolet(i, true);
          etat.textContent = "Merci de compléter cette étape.";
          etat.className = "devis__etat est-ko";
          return;
        }
      }

      envoieDevis();
    });

    montreVolet(0, false);
  }

  /* ---------- Année ---------- */
  var annee = document.getElementById("annee");
  if (annee) annee.textContent = new Date().getFullYear();

  } /* fin de boot() */

  /* =========================================================
     Départ — on attend content.js sans jamais le laisser bloquer
     la page : au-delà de 1,5 s, on démarre avec le contenu du HTML.
     ========================================================= */
  var pret = window.WEBLY_CONTENT_READY;
  if (pret && typeof pret.then === "function") {
    var delai = new Promise(function (resoudre) { window.setTimeout(resoudre, 1500); });
    Promise.race([pret, delai]).then(boot, boot);
  } else {
    boot();
  }
})();
