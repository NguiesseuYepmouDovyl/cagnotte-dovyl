// Page publique de la Cagnotte Dovyl (montants en euros, stockés en centimes)
(function () {
  const C = window.CAGNOTTE;
  const { rpc, paiement, fcfa, nombre, eur, versFcfa, lienContact, telLisible, echapper, dateRelative, copier, toast, objectif } = window.Outils;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const OBJECTIF = objectif(); // en euros

  let montant = 10;          // euros
  let moyen = null;          // carte | appli | mobile
  let contributions = [];
  let ordre = 'montant';
  let scoreAffiche = 0;
  let premierChargement = true;

  /* ---------- Textes issus de la config ---------- */
  $('#objectif').textContent = eur(OBJECTIF);
  const num = C.numeroOrangeMoney;
  $$('.num-intl').forEach((el) => (el.textContent = `+237 ${num.slice(0, 3)} ${num.slice(3, 5)} ${num.slice(5, 7)} ${num.slice(7)}`));
  $$('.num-local').forEach((el) => (el.textContent = telLisible(num)));
  $$('.nom-benef').forEach((el) => (el.textContent = C.nomBeneficiaire));
  $('#btn-wu').href = C.westernUnion;
  $('#services').innerHTML = C.applis.map((a) =>
    `<a class="service" href="${echapper(a.lien)}" target="_blank" rel="noopener">
      <span class="service-nom">${echapper(a.nom)}</span>
      <span class="service-desc">${echapper(a.desc)}</span>
      <svg class="ic" aria-hidden="true"><use href="#i-externe"/></svg>
    </a>`).join('');
  $('#lien-contact-pied').href = lienContact('Salut Dovyl, je viens de voir ta cagnotte PS5 + GTA VI.');
  if (C.notchpay && C.notchpay.actif && C.notchpay.moyens.includes('carte')) {
    // Carte via Notch Pay : le bouton de paiement est celui de l'étape 3
    $('#carte-direct').hidden = false; $('#carte-wu').hidden = true; $('#btn-carte').hidden = true;
  } else if (C.lienCarte) { $('#carte-direct').hidden = false; $('#carte-wu').hidden = true; $('#btn-carte').href = C.lienCarte; }

  /* ---------- Étape 1 : montant ---------- */
  const zoneMontants = $('#montants');
  C.montantsRapides.forEach((m) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'montant'; b.setAttribute('role', 'radio');
    b.dataset.montant = m; b.textContent = eur(m);
    b.addEventListener('click', () => { $('#montant-libre').value = ''; choisirMontant(m); });
    zoneMontants.appendChild(b);
  });
  $('#montant-libre').addEventListener('input', (e) => {
    const v = parseFloat(String(e.target.value).replace(',', '.'));
    if (v >= 1) choisirMontant(Math.round(v * 100) / 100, true);
  });

  function choisirMontant(m, libre) {
    montant = m;
    zoneMontants.querySelectorAll('.montant').forEach((b) =>
      b.setAttribute('aria-checked', String(!libre && Number(b.dataset.montant) === m)));
    $$('.txt-montant').forEach((el) => (el.textContent = eur(m)));
    $('.txt-montant-carte').textContent = `Payer ${eur(m)} par carte`;
    const f = versFcfa(m);
    const code = `#150*1*1*${num}*${f}#`;
    $('#btn-ussd').href = `tel:${encodeURIComponent(code)}`;
    $('#btn-ussd-texte').textContent = `Envoyer ${fcfa(f)}`;
    $('#code-ussd').textContent = code;
    const champ = $('#form-declaration').montant;
    if (!champ.dataset.touche) champ.value = m;
    majMode();
  }
  $('#form-declaration').montant.addEventListener('input', (e) => { e.target.dataset.touche = '1'; majMode(); });

  /* ---------- Étape 2 : moyen de paiement ---------- */
  $$('.moyen').forEach((b) => b.addEventListener('click', () => choisirMoyen(b.dataset.moyen)));
  function choisirMoyen(m) {
    moyen = m;
    $$('.moyen').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.moyen === m)));
    ['carte', 'appli', 'mobile'].forEach((id) => ($(`#p-${id}`).hidden = id !== m));
    // Les coordonnées servent aux transferts (pas au lien de paiement direct ni au Mobile Money)
    $('#beneficiaire').hidden = !(m === 'appli' || (m === 'carte' && !C.lienCarte && !viaNotchPay()));
    majMode();
  }
  $('#om-manuel').addEventListener('toggle', () => {
    const volet = $('#mobile-np');
    if (volet) volet.hidden = $('#om-manuel').open;
    majMode();
  });

  // Paiement par Notch Pay (vérifié automatiquement) ou simple inscription après un envoi manuel
  function viaNotchPay(ignorerManuel) {
    const np = C.notchpay;
    if (!np || !np.actif || !moyen || !np.moyens.includes(moyen)) return false;
    return ignorerManuel || !(moyen === 'mobile' && $('#om-manuel').open);
  }
  function majMode() {
    const np = viaNotchPay();
    const f = $('#form-declaration');
    $('#champ-contact').hidden = !np;
    $('#champ-reference').hidden = np;
    $('#libelle-montant').textContent = np ? 'Montant' : 'Montant envoyé';
    $('#aide-etape3').textContent = np
      ? 'Indiquez votre nom et votre numéro Mobile Money, puis payez : votre nom s\'ajoute au tableau dès que le paiement passe.'
      : 'Une fois l\'argent envoyé, inscrivez-vous : votre nom s\'affiche tout de suite dans le tableau d\'honneur.';
    const euros = parseFloat(String(f.montant.value).replace(',', '.'));
    $('#btn-declarer').textContent = np
      ? `Payer ${euros >= 1 ? eur(euros) : ''} avec ${moyen === 'carte' ? 'ma carte' : 'Mobile Money'}`.replace('  ', ' ')
      : 'Inscrire ma contribution';
  }
  choisirMontant(montant);

  // Pas de Notch Pay configuré : on retire le volet automatique et le choix « à la main » devient la seule option
  if (!C.notchpay || !C.notchpay.actif || !C.notchpay.moyens.includes('mobile')) {
    $('#mobile-np').remove(); $('#om-manuel').open = true; $('#om-manuel').classList.add('seul');
  }

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copier]');
    if (!b) return;
    const valeurs = { numero: `+237${num}`, 'numero-local': num, nom: C.nomBeneficiaire };
    const ok = await copier(valeurs[b.dataset.copier]);
    toast(ok ? (b.dataset.copier === 'nom' ? 'Nom copié' : 'Numéro copié') : 'Copie impossible, notez-le à la main', ok ? '' : 'erreur');
  });

  /* ---------- Compte à rebours GTA VI ---------- */
  function majRebours() {
    const ms = new Date(C.sortieGTA).getTime() - Date.now();
    const el = $('#compte-rebours');
    if (ms <= 0) { el.textContent = 'sorti'; return; }
    const h = Math.ceil(ms / 3600000);
    if (h <= 24) el.textContent = `dans ${h} h`;
    else { const j = Math.ceil(ms / 86400000); el.textContent = j === 1 ? 'demain' : `dans ${j} jours`; }
  }
  majRebours(); setInterval(majRebours, 60000);

  /* ---------- Score et piste ---------- */
  const scoreTexte = (v) => eur(v).replace(' €', '');
  function animerScore(cible) {
    const el = $('#score');
    if (reduit || !premierChargement || document.hidden) { el.textContent = scoreTexte(cible); scoreAffiche = cible; return; }
    const depart = scoreAffiche, debut = performance.now(), duree = 1400;
    // Sécurité : la valeur finale s'affiche même si l'animation est suspendue
    setTimeout(() => { el.textContent = scoreTexte(cible); scoreAffiche = cible; }, duree + 200);
    function pas(t) {
      const p = Math.min(1, (t - debut) / duree);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = p < 1 ? nombre(depart + (cible - depart) * e) : scoreTexte(cible);
      if (p < 1) requestAnimationFrame(pas); else scoreAffiche = cible;
    }
    requestAnimationFrame(pas);
  }

  function dessinerPiste(total) {
    const pct = Math.min(100, (total / OBJECTIF) * 100);
    $('#jauge').style.width = `${pct}%`;
    const piste = $('#piste');
    piste.setAttribute('aria-valuenow', Math.round(pct));
    piste.setAttribute('aria-valuetext', `${eur(total)} sur ${eur(OBJECTIF)}`);
    let cumul = 0;
    const zone = $('#paliers');
    zone.innerHTML = '';
    C.achats.forEach((a, i) => {
      cumul += a.prix;
      const d = document.createElement('div');
      d.className = `palier${total >= cumul ? ' atteint' : ''}`;
      d.style.left = `${(cumul / OBJECTIF) * 100}%`;
      if (i < C.achats.length - 1) d.style.setProperty('--decal', '1');
      d.innerHTML = `<b>${echapper(a.nom)}</b><span>${eur(cumul)}</span>`;
      zone.appendChild(d);
    });
  }

  function dessinerAchats(total) {
    let cumul = 0;
    $('#liste-achats').innerHTML = C.achats.map((a) => {
      const avant = cumul; cumul += a.prix;
      const paye = total >= cumul;
      let statut;
      if (paye) statut = 'Payé grâce à vous';
      else if (total > avant) statut = `Il manque ${eur(cumul - total)}`;
      else if (avant === 0) statut = total === 0 ? 'En attente des premières contributions' : `Il manque ${eur(cumul - total)}`;
      else statut = `Débloqué après ${eur(avant)} collectés`;
      return `<li class="achat${paye ? ' paye' : ''}">
        <span class="achat-nom">${echapper(a.nom)}</span>
        <span class="achat-prix">${eur(a.prix)}</span>
        <span class="achat-detail">${echapper(a.detail)}</span>
        <span class="achat-statut">${statut}</span>
      </li>`;
    }).join('') + `<li class="achat achat-total"><span class="achat-nom">Objectif</span><span class="achat-prix">${eur(OBJECTIF)}</span></li>`;
  }

  /* ---------- Tableau d'honneur ---------- */
  function dessinerClassement() {
    const ol = $('#classement');
    const liste = [...contributions].sort((a, b) =>
      ordre === 'montant' ? b.montant - a.montant || new Date(a.le) - new Date(b.le) : new Date(b.le) - new Date(a.le));
    ol.classList.toggle('par-date', ordre === 'date');
    $('#classement-vide').hidden = liste.length > 0;
    ol.innerHTML = liste.map((c, i) => `
      <li class="ligne">
        <span class="ligne-rang">${ordre === 'montant' ? String(i + 1).padStart(2, '0') : ''}</span>
        <span class="ligne-nom">${echapper(c.nom)}</span>
        <span class="ligne-montant">${eur(c.montant / 100)}</span>
        ${c.message ? `<p class="ligne-msg">${echapper(c.message)}</p>` : ''}
        <span class="ligne-quand">${dateRelative(c.le)}</span>
      </li>`).join('');
  }
  $$('.onglets button').forEach((b) =>
    b.addEventListener('click', () => {
      ordre = b.dataset.ordre;
      $$('.onglets button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      dessinerClassement();
    }));

  /* ---------- Chargement ---------- */
  async function charger() {
    try {
      const [etat, liste] = await Promise.all([rpc('etat_cagnotte'), rpc('tableau_honneur', { p_limite: 100 })]);
      contributions = liste || [];
      const total = etat.total / 100;
      $('#hors-ligne').hidden = true;
      animerScore(total);
      dessinerPiste(total);
      dessinerAchats(total);
      $('#nb-contrib').textContent = nombre(etat.contributions);
      $('#reste').textContent = total >= OBJECTIF ? 'rien' : eur(OBJECTIF - total);
      dessinerClassement();
    } catch (e) {
      $('#hors-ligne').hidden = false;
      if (premierChargement) { dessinerPiste(0); dessinerAchats(0); dessinerClassement(); }
    }
    premierChargement = false;
  }
  charger();
  setInterval(() => { if (!document.hidden) charger(); }, 30000);

  /* ---------- Étape 3 : inscription ---------- */
  const form = $('#form-declaration');
  const erreur = $('#erreur-form');
  function montrerErreur(msg, champ) {
    erreur.textContent = msg; erreur.hidden = false;
    form.querySelectorAll('.champ').forEach((c) => c.classList.remove('invalide'));
    if (champ) { champ.closest('.champ').classList.add('invalide'); champ.focus(); }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    erreur.hidden = true;
    const nom = form.nom.value.trim();
    const euros = parseFloat(String(form.montant.value).replace(',', '.'));
    const centimes = Math.round(euros * 100);
    if (nom.length < 2) return montrerErreur('Indiquez votre nom ou un pseudo (2 caractères minimum).', form.nom);
    if (!(centimes >= 100)) return montrerErreur('Indiquez le montant envoyé, 1 € minimum.', form.montant);
    if (centimes > 2000000) return montrerErreur('Ce montant dépasse la limite. Écrivez directement à Dovyl.', form.montant);

    const btn = $('#btn-declarer');

    // Paiement Notch Pay : la contribution sera créée par le serveur une fois le paiement confirmé
    if (viaNotchPay()) {
      const contact = form.contact.value.trim();
      if (contact.length < 6) return montrerErreur('Indiquez votre numéro Mobile Money (ex. 690112233) ou un e-mail.', form.contact);
      if (centimes > 75000) return montrerErreur('Le paiement Mobile Money accepte jusqu\'à 750 €. Pour plus, choisissez un autre moyen.', form.montant);
      btn.disabled = true; btn.textContent = 'Ouverture de la page de paiement…';
      try {
        const r = await paiement('creer', {
          nom, anonyme: form.anonyme.checked, montant: centimes, message: form.message.value.trim(),
          contact, moyen, retour: location.origin + location.pathname,
        });
        location.href = r.url;
      } catch (err) {
        montrerErreur(err.message);
        btn.disabled = false; majMode();
      }
      return;
    }

    btn.disabled = true; btn.textContent = 'Inscription…';
    try {
      await rpc('declarer_contribution', {
        p_nom: nom, p_anonyme: form.anonyme.checked, p_montant: centimes,
        p_message: form.message.value.trim(), p_reference: form.reference.value.trim(),
        p_moyen: (moyen === 'mobile' ? 'orange_money' : moyen) || 'autre', // à la main = Orange Money direct
      });
      const ref = form.reference.value.trim();
      const via = { carte: 'par carte', appli: 'par appli de transfert', mobile: 'par Orange Money' }[moyen] || '';
      $('#btn-prevenir').href = lienContact(
        `Salut Dovyl, je viens d'envoyer ${eur(centimes / 100)} ${via} pour ta cagnotte PS5 + GTA VI.` +
        `\nPseudo : ${nom}${ref ? `\nRéférence : ${ref}` : ''}`);
      charger(); // le compteur et le tableau se mettent à jour tout de suite
      form.hidden = true;
      const merci = $('#merci');
      merci.hidden = false; merci.focus();
      form.querySelectorAll('.champ').forEach((c) => c.classList.remove('invalide'));
    } catch (err) {
      montrerErreur(err.message);
    } finally {
      btn.disabled = false; majMode();
    }
  });

  /* ---------- Retour de la page de paiement Notch Pay ---------- */
  (async function retourPaiement() {
    const params = new URLSearchParams(location.search.replace(/\?/g, '&'));
    if (params.get('paiement') !== 'retour') return;
    const id = params.get('id') || params.get('trxref');
    const reference = params.get('reference');
    history.replaceState(null, '', location.pathname + location.hash);
    const boite = $('#retour-paiement');
    const afficher = (classe, html) => {
      boite.className = `retour-paiement ${classe}`; boite.innerHTML = html; boite.hidden = false;
      boite.scrollIntoView({ block: 'center' }); boite.focus({ preventScroll: true });
    };
    afficher('attente', '<p><strong>Vérification du paiement…</strong></p><p>Quelques secondes, le temps que Notch Pay confirme.</p>');
    let r = { statut: 'en_cours' };
    for (let essai = 0; essai < 8 && r.statut === 'en_cours'; essai++) {
      if (essai) await new Promise((ok) => setTimeout(ok, 3000));
      try { r = await paiement('verifier', { id, reference }); } catch (e) { r = { statut: 'en_cours' }; }
    }
    if (r.statut === 'complete') {
      afficher('ok', `<p><strong>Merci ${echapper(r.nom)}, paiement reçu !</strong></p><p>${eur(r.montant / 100)} ajoutés à la cagnotte, votre nom est dans le tableau d'honneur.</p>`);
      charger();
    } else if (r.statut === 'echoue') {
      afficher('erreur', '<p><strong>Le paiement n\'a pas abouti.</strong></p><p>Aucun montant n\'a été prélevé. Vous pouvez réessayer ci-dessous.</p>');
    } else {
      afficher('attente', '<p><strong>Paiement en cours de confirmation.</strong></p><p>Si vous avez validé sur votre téléphone, votre nom apparaîtra dans quelques minutes.</p>');
    }
  })();

  $('#nouvelle-declaration').addEventListener('click', () => {
    form.reset(); delete form.montant.dataset.touche; choisirMontant(montant);
    $('#merci').hidden = true; form.hidden = false; form.nom.focus();
  });
})();
