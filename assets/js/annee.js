/* Année du pied de page des pages légales (fichier séparé : la
   Content-Security-Policy n'autorise aucun script écrit dans la page). */
(function () {
  var annee = document.getElementById("annee");
  if (annee) annee.textContent = new Date().getFullYear();
})();
