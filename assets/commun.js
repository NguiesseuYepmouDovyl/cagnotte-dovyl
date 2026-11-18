// Outils partagés entre la page publique et l'espace admin.
(function () {
  const C = window.CAGNOTTE;

  async function rpc(nom, params) {
    let rep;
    try {
      rep = await fetch(`${C.supabaseUrl}/rest/v1/rpc/${nom}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: C.supabaseCle },
        body: JSON.stringify(params || {}),
      });
    } catch (e) {
      throw new Error('Connexion impossible. Vérifiez votre accès internet puis réessayez.');
    }
    const texte = await rep.text();
    const data = texte ? JSON.parse(texte) : null;
    if (!rep.ok) {
      const msg = (data && (data.message || data.hint)) || 'Le serveur a refusé la demande.';
      throw new Error(msg.includes('check constraint') ? 'Une valeur saisie est invalide.' : msg);
    }
    return data;
  }

  const espaces = (s) => s.replace(/ | /g, ' ');
  const fcfa = (n) => `${espaces(Math.round(n || 0).toLocaleString('fr-FR'))} FCFA`;
  const nombre = (n) => espaces(Math.round(n || 0).toLocaleString('fr-FR'));
  // Montant en euros (nombre décimal) : « 12 € » ou « 12,50 € »
  const eur = (n) => {
    const v = Math.round((n || 0) * 100) / 100;
    return espaces(v.toLocaleString('fr-FR', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })) + ' €';
  };
  const TAUX_FCFA = 655.957; // parité fixe euro / franc CFA
  const versFcfa = (euros) => Math.round(euros * TAUX_FCFA);
  const lienContact = (texte) => C.telegram
    ? `https://t.me/${C.telegram}`
    : `https://wa.me/237${C.numeroWhatsApp}${texte ? `?text=${encodeURIComponent(texte)}` : ''}`;
  const telLisible = (t) => t.replace(/(\d)(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');

  function echapper(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function dateRelative(iso) {
    const d = new Date(iso);
    const s = (Date.now() - d.getTime()) / 1000;
    if (s < 60) return "à l'instant";
    if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
    if (s < 86400 * 7) { const j = Math.floor(s / 86400); return `il y a ${j} jour${j > 1 ? 's' : ''}`; }
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  }

  async function copier(texte) {
    try { await navigator.clipboard.writeText(texte); return true; }
    catch (e) {
      const t = document.createElement('textarea');
      t.value = texte; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
      t.remove(); return ok;
    }
  }

  let minuteur;
  function toast(msg, type) {
    let el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg; el.className = `toast visible ${type || ''}`;
    clearTimeout(minuteur); minuteur = setTimeout(() => (el.className = 'toast'), 3200);
  }

  const objectif = () => C.achats.reduce((s, a) => s + a.prix, 0);

  window.Outils = { rpc, fcfa, nombre, eur, versFcfa, lienContact, telLisible, echapper, dateRelative, copier, toast, objectif };
})();
