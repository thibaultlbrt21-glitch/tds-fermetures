<?php
/*
 * TDS Fermetures — envoi des demandes de devis.
 *
 * Le formulaire du site (assets/js/main.js) envoie ici les champs de la
 * demande. Ce script les vérifie, puis les envoie par e-mail à la boîte de
 * Tiago, depuis l'adresse contact@tds-fermetures.fr (serveur SMTP de
 * Hostinger). « Répondre » dans la messagerie de Tiago répond au client.
 *
 * Le mot de passe de contact@ n'est JAMAIS dans ce dépôt (il est public) :
 * il est dans config-devis.php, un fichier créé à la main sur le serveur,
 * dans le dossier qui contient public_html (donc hors d'atteinte du web) :
 *
 *     <?php return ['mot_de_passe' => '...'];
 *
 * Ouvrir cette adresse dans un navigateur (GET) indique seulement si le
 * script fonctionne et s'il trouve ce fichier ; rien n'est envoyé.
 */

declare(strict_types=1);

const DESTINATAIRE = 'tiagotdsfermetures.21@hotmail.com';
const EXPEDITEUR = 'contact@tds-fermetures.fr';
const NOM_EXPEDITEUR = 'Site TDS Fermetures';
const DOMAINES = ['tds-fermetures.fr', 'www.tds-fermetures.fr'];
const MAX_PAR_HEURE = 5; // demandes par adresse IP

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function repondre(int $code, array $donnees): void
{
    http_response_code($code);
    echo json_encode($donnees, JSON_UNESCAPED_UNICODE);
    exit;
}

function fichierConfig(): string
{
    return dirname(__DIR__) . '/config-devis.php';
}

function config(): ?array
{
    $f = fichierConfig();
    if (!is_file($f)) return null;
    $c = include $f;
    if (!is_array($c) || empty($c['mot_de_passe']) || !is_string($c['mot_de_passe'])) return null;
    return $c;
}

// ---------- Vérification à la main (GET) ----------
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    $pret = config() !== null;
    repondre(200, [
        'php' => true,
        'pret' => $pret,
        'message' => $pret
            ? 'Le script fonctionne et le mot de passe est en place.'
            : 'Le script fonctionne, mais le fichier config-devis.php est introuvable ou incomplet. '
              . 'Il doit être dans le dossier « ' . basename(dirname(__DIR__)) . ' », à côté de public_html.',
    ]);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    repondre(405, ['ok' => false]);
}

// ---------- Seules les pages du site peuvent envoyer ----------
$origine = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
$hote = strtolower((string) parse_url($origine, PHP_URL_HOST));
if (!in_array($hote, DOMAINES, true)) {
    repondre(403, ['ok' => false]);
}

// ---------- Lecture des champs ----------
$brut = file_get_contents('php://input', false, null, 0, 20000);
$entree = json_decode((string) $brut, true);
if (!is_array($entree)) repondre(400, ['ok' => false]);

// Piège à robots rempli : on fait comme si tout allait bien.
if (!empty($entree['siteWeb'])) repondre(200, ['ok' => true]);

// Champ => [libellé, longueur maximale]. Tout autre champ est ignoré.
$champs = [
    'ouvrage'         => ['Projet', 60],
    'quantite'        => ['Quantité ou dimensions', 80],
    'motorisation'    => ['Motorisation', 60],
    'typePose'        => ['Type de projet', 60],
    'anciennete'      => ['Âge du logement', 60],
    'delai'           => ['Délai', 60],
    'budget'          => ['Budget', 60],
    'adresseChantier' => ['Commune', 80],
    'nom'             => ['Nom', 80],
    'courriel'        => ['E-mail', 120],
    'telephone'       => ['Téléphone', 30],
    'details'         => ['Description', 600],
];

$v = [];
foreach ($champs as $cle => [$libelle, $max]) {
    $texte = isset($entree[$cle]) && is_string($entree[$cle]) ? trim($entree[$cle]) : '';
    // Retours à la ligne permis seulement dans la description.
    $texte = $cle === 'details'
        ? preg_replace('/\r\n?/', "\n", $texte)
        : preg_replace('/[\r\n\t]+/', ' ', $texte);
    $texte = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', (string) $texte);
    $v[$cle] = mb_substr((string) $texte, 0, $max);
}

if ($v['ouvrage'] === '' || $v['nom'] === '' || $v['telephone'] === ''
    || !filter_var($v['courriel'], FILTER_VALIDATE_EMAIL)
    || !preg_match('/^[0-9+().\s-]{6,20}$/', $v['telephone'])) {
    repondre(422, ['ok' => false]);
}

// ---------- Limite : quelques demandes par heure et par visiteur ----------
// L'adresse IP n'est gardée que sous forme d'empreinte, une heure au plus.
$journal = dirname(__DIR__) . '/devis-limite.json';
$empreinte = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|tds-devis');
$maintenant = time();
$h = @fopen($journal, 'c+');
if ($h && flock($h, LOCK_EX)) {
    $liste = json_decode((string) stream_get_contents($h), true);
    $liste = is_array($liste) ? $liste : [];
    foreach ($liste as $k => $dates) {
        $liste[$k] = array_values(array_filter((array) $dates, fn ($t) => $t > $maintenant - 3600));
        if (!$liste[$k]) unset($liste[$k]);
    }
    if (count($liste[$empreinte] ?? []) >= MAX_PAR_HEURE) {
        flock($h, LOCK_UN);
        fclose($h);
        repondre(429, ['ok' => false]);
    }
    $liste[$empreinte][] = $maintenant;
    ftruncate($h, 0);
    rewind($h);
    fwrite($h, json_encode($liste));
    flock($h, LOCK_UN);
    fclose($h);
}

$cfg = config();
if ($cfg === null) repondre(503, ['ok' => false]);

// ---------- Message ----------
$sujet = $v['ouvrage'] === 'Service après-vente'
    ? 'Demande de SAV — ' . $v['nom']
    : 'Demande de devis — ' . $v['ouvrage'] . ' — ' . $v['nom'];

$lignes = ['Nouvelle demande reçue depuis le site tds-fermetures.fr', ''];
foreach ($champs as $cle => [$libelle]) {
    if ($cle === 'details') continue;
    if ($v[$cle] === '' || $v[$cle] === 'Non précisé' || $v[$cle] === 'Non défini') continue;
    $lignes[] = $libelle . ' : ' . $v[$cle];
}
if ($v['details'] !== '') {
    $lignes[] = '';
    $lignes[] = 'Description :';
    $lignes[] = $v['details'];
}
$lignes[] = '';
$lignes[] = '—';
$lignes[] = 'Pour répondre au client, utilisez simplement « Répondre ».';
$corps = str_replace("\n", "\r\n", implode("\n", $lignes));

function entete(string $texte): string
{
    return '=?UTF-8?B?' . base64_encode($texte) . '?=';
}

$entetes = [
    'Date: ' . date('r'),
    'From: ' . entete(NOM_EXPEDITEUR) . ' <' . EXPEDITEUR . '>',
    'To: <' . DESTINATAIRE . '>',
    'Reply-To: ' . entete($v['nom']) . ' <' . $v['courriel'] . '>',
    'Subject: ' . entete($sujet),
    'Message-ID: <' . bin2hex(random_bytes(12)) . '@tds-fermetures.fr>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
];
$message = implode("\r\n", $entetes) . "\r\n\r\n" . rtrim(chunk_split(base64_encode($corps), 76, "\r\n"));

// ---------- Envoi par le serveur SMTP de Hostinger ----------
function smtp(array $cfg, string $message): bool
{
    // Serveur SMTP de Hostinger, en SSL (port 465). Modifiable dans
    // config-devis.php avec la clé « serveur », sans toucher au script.
    $serveur = $cfg['serveur'] ?? 'ssl://smtp.hostinger.com:465';
    $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
    $fp = @stream_socket_client($serveur, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) return false;
    stream_set_timeout($fp, 15);

    $lire = function () use ($fp): string {
        $tout = '';
        while (($ligne = fgets($fp, 1024)) !== false) {
            $tout .= $ligne;
            if (strlen($ligne) < 4 || $ligne[3] === ' ') break;
        }
        return $tout;
    };
    $dire = function (string $commande, array $codes) use ($fp, $lire): bool {
        if ($commande !== '') fwrite($fp, $commande . "\r\n");
        $reponse = $lire();
        return in_array((int) substr($reponse, 0, 3), $codes, true);
    };

    $ok = $dire('', [220])
        && $dire('EHLO tds-fermetures.fr', [250])
        && $dire('AUTH LOGIN', [334])
        && $dire(base64_encode(EXPEDITEUR), [334])
        && $dire(base64_encode($cfg['mot_de_passe']), [235])
        && $dire('MAIL FROM:<' . EXPEDITEUR . '>', [250])
        && $dire('RCPT TO:<' . DESTINATAIRE . '>', [250, 251])
        && $dire('DATA', [354])
        && $dire($message . "\r\n.", [250]);
    @fwrite($fp, "QUIT\r\n");
    fclose($fp);
    return $ok;
}

$envoye = smtp($cfg, $message);
repondre($envoye ? 200 : 502, ['ok' => $envoye]);
