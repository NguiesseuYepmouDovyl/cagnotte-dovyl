// Page publique de la Cagnotte Dovyl (montants en euros, stockés en centimes)
(function () {
  const C = window.CAGNOTTE;
  const { rpc, fcfa, nombre, eur, versFcfa, lienContact, telLisible, echapper, dateRelative, copier, toast, objectif } = window.Outils;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const OBJECTIF = objectif(); // en euros

  let montant = 10;          // euros
  let moyen = null;          // carte | appli | orange_money
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
  $('#btn-wu').href = C.services.westernUnion;
  $('#lien-taptap').href = C.services.taptap;
  $('#lien-remitly').href = C.services.remitly;
  $('#lien-contact-pied').href = lienContact('Salut Dovyl, je viens de voir ta cagnotte PS5 + GTA VI.');
  if (C.lienCarte) { $('#carte-direct').hidden = false; $('#carte-wu').hidden = true; $('#btn-carte').href = C.lienCarte; }

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
  }
  choisirMontant(montant);
  $('#form-declaration').montant.addEventListener('input', (e) => (e.target.dataset.touche = '1'));

  /* ---------- Étape 2 : moyen de paiement ---------- */
  $$('.moyen').forEach((b) => b.addEventListener('click', () => choisirMoyen(b.dataset.moyen)));
  function choisirMoyen(m) {
    moyen = m;
    $$('.moyen').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.moyen === m)));
    ['carte', 'appli', 'orange_money'].forEach((id) => ($(`#p-${id}`).hidden = id !== m));
    // Les coordonnées servent aux transferts (pas au lien de paiement direct ni à Orange Money)
    $('#beneficiaire').hidden = !(m === 'appli' || (m === 'carte' && !C.lienCarte));
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
    btn.disabled = true; btn.textContent = 'Inscription…';
    try {
      await rpc('declarer_contribution', {
        p_nom: nom, p_anonyme: form.anonyme.checked, p_montant: centimes,
        p_message: form.message.value.trim(), p_reference: form.reference.value.trim(), p_moyen: moyen || 'autre',
      });
      const ref = form.reference.value.trim();
      const via = { carte: 'par carte', appli: 'par appli de transfert', orange_money: 'par Orange Money' }[moyen] || '';
      $('#btn-prevenir').href = lienContact(
        `Salut Dovyl, je viens d'envoyer ${eur(centimes / 100)} ${via} pour ta cagnotte PS5 + GTA VI.` +
        `\nPseudo : ${nom}${ref ? `\nRéférence : ${ref}` : ''}`);
      form.hidden = true;
      const merci = $('#merci');
      merci.hidden = false; merci.focus();
      form.querySelectorAll('.champ').forEach((c) => c.classList.remove('invalide'));
    } catch (err) {
      montrerErreur(err.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Inscrire ma contribution';
    }
  });

  $('#nouvelle-declaration').addEventListener('click', () => {
    form.reset(); delete form.montant.dataset.touche; choisirMontant(montant);
    $('#merci').hidden = true; form.hidden = false; form.nom.focus();
  });
})();
