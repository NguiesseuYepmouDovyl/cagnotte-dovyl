// Espace Dovyl : les inscriptions comptent d'office, Dovyl retire ou supprime les fausses
(function () {
  const { rpc, fcfa, nombre, eur, versFcfa, echapper, dateRelative, toast, objectif } = window.Outils;
  const MOYENS = { carte: 'Carte bancaire', appli: 'Appli de transfert', orange_money: 'Orange Money', autre: 'Autre' };
  const $ = (s) => document.querySelector(s);
  const CLE = 'cagnotte-code';

  let code = null;
  let toutes = [];
  let filtre = 'validee';

  const lire = () => { try { return sessionStorage.getItem(CLE); } catch (e) { return null; } };
  const ecrire = (v) => { try { v ? sessionStorage.setItem(CLE, v) : sessionStorage.removeItem(CLE); } catch (e) {} };

  function afficherAdmin(oui) {
    $('#vue-connexion').hidden = oui;
    $('#vue-admin').hidden = !oui;
    $('#deconnexion').hidden = !oui;
  }

  async function connecter(c) {
    const ok = await rpc('admin_connexion', { p_code: c });
    if (!ok) return false;
    code = c; ecrire(c); afficherAdmin(true);
    await charger();
    return true;
  }

  $('#form-connexion').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#erreur-connexion'); err.hidden = true;
    const btn = e.target.querySelector('button'); btn.disabled = true;
    try {
      if (!(await connecter(e.target.code.value.trim()))) {
        err.textContent = 'Code incorrect. Après 8 essais ratés, l\'accès est bloqué 15 minutes.';
        err.hidden = false;
      }
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    btn.disabled = false;
  });

  $('#deconnexion').addEventListener('click', () => {
    code = null; ecrire(null); afficherAdmin(false);
    $('#form-connexion').reset();
  });

  function sessionExpiree() {
    code = null; ecrire(null); afficherAdmin(false);
    toast('Code refusé, reconnecte-toi.', 'erreur');
  }

  async function charger() {
    const data = await rpc('admin_lister', { p_code: code });
    if (data === null) return sessionExpiree();
    toutes = data;
    dessiner();
  }

  function dessiner() {
    const total = toutes.filter((c) => c.statut === 'validee').reduce((s, c) => s + c.montant, 0) / 100;
    const compte = (s) => toutes.filter((c) => c.statut === s).length;
    $('#r-total').textContent = eur(total);
    $('#r-nombre').textContent = nombre(compte('validee'));
    $('#r-objectif').textContent = `${Math.min(100, Math.round((total / objectif()) * 100))} %`;
    ['en_attente', 'validee', 'rejetee'].forEach((s) => ($(`#c-${s}`).textContent = `(${compte(s)})`));
    // Onglet « À vérifier » : seulement s'il reste d'anciennes inscriptions en attente
    $('#onglet-attente').hidden = compte('en_attente') === 0 && filtre !== 'en_attente';
    $('#aide-filtre').hidden = filtre !== 'validee';

    const liste = toutes.filter((c) => c.statut === filtre);
    $('#vide').hidden = liste.length > 0;
    const btnSupprimer = (id) => `<button class="btn btn-refuser btn-petit" data-action="supprimer" data-id="${id}" type="button"><svg class="ic"><use href="#i-corbeille"/></svg>Supprimer</button>`;
    $('#liste').innerHTML = liste.map((c) => {
      const actions = {
        en_attente: `<button class="btn btn-valider btn-petit" data-action="validee" data-id="${c.id}" type="button"><svg class="ic"><use href="#i-ok"/></svg>Compter</button>
                     <button class="btn btn-refuser btn-petit" data-action="rejetee" data-id="${c.id}" type="button"><svg class="ic"><use href="#i-non"/></svg>Retirer</button>`,
        validee: `<button class="btn btn-discret btn-petit" data-action="rejetee" data-id="${c.id}" type="button"><svg class="ic"><use href="#i-non"/></svg>Retirer du compteur</button>
                  ${btnSupprimer(c.id)}`,
        rejetee: `<button class="btn btn-discret btn-petit" data-action="validee" data-id="${c.id}" type="button"><svg class="ic"><use href="#i-retour"/></svg>Remettre dans le compteur</button>
                  ${btnSupprimer(c.id)}`,
      }[c.statut];
      return `<li class="contrib ${c.statut}">
        <span class="contrib-nom">${echapper(c.nom)}${c.anonyme ? ' <em>(affiché Anonyme)</em>' : ''}</span>
        <span class="contrib-montant">${eur(c.montant / 100)}</span>
        <span class="contrib-infos">
          <span>${dateRelative(c.cree_le)}</span>
          <span>≈ ${fcfa(versFcfa(c.montant / 100))}</span>
          ${c.moyen ? `<span>${MOYENS[c.moyen] || ''}</span>` : ''}
          ${c.reference ? `<span>Réf. <code>${echapper(c.reference)}</code></span>` : '<span>Pas de référence</span>'}
          ${c.source === 'admin' ? '<span>Ajoutée par toi</span>' : ''}
        </span>
        ${c.message ? `<p class="contrib-msg">« ${echapper(c.message)} »</p>` : ''}
        <div class="contrib-actions">${actions}</div>
      </li>`;
    }).join('');
  }

  document.querySelectorAll('.onglets-admin button').forEach((b) =>
    b.addEventListener('click', () => {
      filtre = b.dataset.filtre;
      document.querySelectorAll('.onglets-admin button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      dessiner();
    }));

  $('#liste').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-action]');
    if (!b) return;
    const { action, id } = b.dataset;
    if (action === 'supprimer' && !confirm('Supprimer définitivement cette inscription ?')) return;
    b.disabled = true;
    try {
      const ok = action === 'supprimer'
        ? await rpc('admin_supprimer', { p_code: code, p_id: id })
        : await rpc('admin_statuer', { p_code: code, p_id: id, p_statut: action });
      if (!ok) return sessionExpiree();
      toast({ validee: 'Contribution remise dans le compteur', rejetee: 'Contribution retirée du compteur', en_attente: 'Remise à vérifier', supprimer: 'Inscription supprimée' }[action]);
      await charger();
    } catch (ex) { toast(ex.message, 'erreur'); b.disabled = false; }
  });

  $('#form-ajout').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const montant = Math.round(parseFloat(String(f.montant.value).replace(',', '.')) * 100);
    if (f.nom.value.trim().length < 2 || !(montant >= 100)) return toast('Nom (2 caractères) et montant (1 € min.) requis.', 'erreur');
    try {
      const ok = await rpc('admin_ajouter', { p_code: code, p_nom: f.nom.value.trim(), p_anonyme: f.anonyme.checked, p_montant: montant, p_message: f.message.value.trim() });
      if (!ok) return sessionExpiree();
      f.reset(); toast('Contribution ajoutée au compteur'); await charger();
    } catch (ex) { toast(ex.message, 'erreur'); }
  });

  $('#form-code').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.nouveau.value !== f.confirmation.value) return toast('Les deux codes ne sont pas identiques.', 'erreur');
    try {
      const ok = await rpc('admin_changer_code', { p_code: code, p_nouveau: f.nouveau.value });
      if (!ok) return sessionExpiree();
      code = f.nouveau.value; ecrire(code); f.reset();
      toast('Code changé. Note-le bien, il remplace celui du fichier.');
    } catch (ex) { toast(ex.message, 'erreur'); }
  });

  // Reconnexion automatique pendant la session du navigateur
  const memo = lire();
  if (memo) connecter(memo).catch(() => afficherAdmin(false));
  setInterval(() => { if (code && !document.hidden) charger().catch(() => {}); }, 45000);
})();
