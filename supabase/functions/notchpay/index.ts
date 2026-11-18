// Fonction Supabase « notchpay » : paiements Mobile Money (et plus tard carte) via Notch Pay.
//
// Actions (POST JSON) :
//   { action: 'creer', nom, montant (centimes €), message, anonyme, contact, moyen, retour }
//       → crée le paiement chez Notch Pay et renvoie l'URL de la page de paiement
//   { action: 'verifier', id?, reference? }
//       → relit le paiement chez Notch Pay et, s'il est payé, ajoute la contribution
//   { action: 'rattraper' }
//       → revérifie les paiements restés « initiés » (contributeur parti avant le retour)
//   webhook Notch Pay (corps { event|type, data })
//       → même vérification que « verifier »
//
// La vérité vient toujours de l'API Notch Pay (GET /payments/{référence}) :
// un webhook ou un retour falsifié ne peut pas valider un paiement.

const NP_CLE_PUBLIQUE = Deno.env.get('NOTCHPAY_PUBLIC_KEY') ??
  'pk_test.RccOGI8QTBcP2cDNCXA7hePiusXnZOoMkkoLwPq8bcGCPqt7aWy6AQOsPNOe7I8OahAk2fJ9zB7q5o9opred7GzCpvmkxSWmPMAbF8ODduAVN0kTOkgdCnxRR6NjC';
const NP_CLE_HACHAGE = Deno.env.get('NOTCHPAY_HASH_KEY') ?? '';
const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const SITE = 'https://nguiesseuyepmoudovyl.github.io/cagnotte-dovyl/';
// Adresses où Notch Pay peut renvoyer le contributeur après paiement (GitHub Pages est bloqué
// par certains opérateurs camerounais : miroir prévu sur Cloudflare Pages ou Netlify)
const ORIGINES_RETOUR = [
  'https://nguiesseuyepmoudovyl.github.io', 'https://cagnotte-dovyl.pages.dev', 'https://cagnotte-dovyl.netlify.app',
  'http://localhost:8765', 'http://127.0.0.1:8765',
];
const origineAutorisee = (o: string) =>
  ORIGINES_RETOUR.includes(o) || /^https:\/\/[a-z0-9-]+\.cagnotte-dovyl\.pages\.dev$/.test(o);
const MODE_TEST = NP_CLE_PUBLIQUE.startsWith('pk_test');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
};
const json = (corps: unknown, statut = 200) =>
  new Response(JSON.stringify(corps), { status: statut, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });

class ErreurClient extends Error {}

/* ---------- Base Supabase (clé de service, côté serveur uniquement) ---------- */
async function sb(chemin: string, init: RequestInit = {}) {
  const rep = await fetch(`${SB_URL}/rest/v1/${chemin}`, {
    ...init,
    headers: {
      apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`,
      'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}),
    },
  });
  const texte = await rep.text();
  const data = texte ? JSON.parse(texte) : null;
  if (!rep.ok) {
    const msg = data?.message ?? 'Erreur de base de données';
    throw rep.status < 500 && !msg.includes('permission') ? new ErreurClient(msg) : new Error(msg);
  }
  return data;
}
const rpc = (nom: string, params: Record<string, unknown>) => sb(`rpc/${nom}`, { method: 'POST', body: JSON.stringify(params) });

type Paiement = { id: string; nom: string; anonyme: boolean; montant: number; moyen: string; reference_np: string | null; statut: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function trouverPaiement(id?: string, reference?: string): Promise<Paiement | null> {
  let filtre = '';
  if (id && UUID.test(id)) filtre = `id=eq.${id}`;
  else if (reference && /^[\w.\-]{6,80}$/.test(reference)) filtre = `reference_np=eq.${encodeURIComponent(reference)}`;
  else return null;
  const lignes = await sb(`paiements_notchpay?${filtre}&select=id,nom,anonyme,montant,moyen,reference_np,statut&limit=1`);
  return lignes?.[0] ?? null;
}
const majPaiement = (id: string, champs: Record<string, unknown>) =>
  sb(`paiements_notchpay?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(champs) });

/* ---------- API Notch Pay ---------- */
async function np(methode: string, chemin: string, corps?: unknown) {
  const rep = await fetch(`https://api.notchpay.co${chemin}`, {
    method: methode,
    headers: { Authorization: NP_CLE_PUBLIQUE, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const data = await rep.json().catch(() => null);
  return { ok: rep.ok, statut: rep.status, data };
}

/* ---------- Actions ---------- */
function lireContact(brut: unknown): { email?: string; phone?: string } {
  const c = String(brut ?? '').trim();
  if (c.includes('@')) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c) || c.length > 120) throw new ErreurClient('Adresse e-mail invalide.');
    return { email: c };
  }
  let chiffres = c.replace(/\D/g, '');
  if (/^6\d{8}$/.test(chiffres)) chiffres = '237' + chiffres;           // numéro camerounais sans indicatif
  if (!/^\d{8,15}$/.test(chiffres)) throw new ErreurClient('Indiquez votre numéro Mobile Money (ex. 690112233) ou un e-mail.');
  return { phone: chiffres };
}

async function creer(b: Record<string, unknown>) {
  const nom = String(b.nom ?? '').trim();
  const montant = Math.round(Number(b.montant));
  const message = String(b.message ?? '').trim().slice(0, 240);
  if (nom.length < 2 || nom.length > 40) throw new ErreurClient('Indiquez votre nom ou un pseudo (2 à 40 caractères).');
  if (!(montant >= 100 && montant <= 75000)) throw new ErreurClient('Le paiement Mobile Money accepte de 1 € à 750 €.');
  const contact = lireContact(b.contact);
  const moyen = b.moyen === 'carte' ? 'carte' : 'mobile';

  let retour = SITE;
  try {
    const u = new URL(String(b.retour ?? ''));
    if (origineAutorisee(u.origin)) retour = u.origin + u.pathname;
  } catch { /* adresse de retour absente ou invalide : site public */ }

  const id: string = await rpc('np_creer', { p_nom: nom, p_anonyme: !!b.anonyme, p_montant: montant, p_message: message, p_moyen: moyen });
  const init = await np('POST', '/payments', {
    amount: montant / 100, currency: 'EUR', ...contact,
    description: 'Cagnotte Dovyl : PS5 + GTA VI', reference: id,
    callback: `${retour}?paiement=retour&id=${id}`,
    ...(moyen === 'mobile' ? { locked_country: 'CM' } : {}),
  });
  const url = init.data?.authorization_url;
  const ref = init.data?.transaction?.reference;
  if (!init.ok || !url || !ref) {
    await majPaiement(id, { statut: 'echoue', termine_le: new Date().toISOString() });
    console.error('Init Notch Pay refusée', init.statut, JSON.stringify(init.data));
    throw new ErreurClient('Le service de paiement ne répond pas, réessayez dans un instant.');
  }
  await majPaiement(id, { reference_np: ref });
  return { url, id };
}

async function verifier(id?: string, reference?: string) {
  const p = await trouverPaiement(id, reference);
  if (!p) return { statut: 'inconnu' };
  const nomAffiche = p.anonyme ? 'Anonyme' : p.nom;
  if (p.statut === 'complete') return { statut: 'complete', nom: nomAffiche, montant: p.montant };
  if (p.statut === 'echoue' || !p.reference_np) return { statut: p.statut === 'echoue' ? 'echoue' : 'en_cours' };

  const lu = await np('GET', `/payments/${encodeURIComponent(p.reference_np)}`);
  const t = lu.data?.transaction;
  if (!lu.ok || !t) return { statut: 'en_cours' };

  const memePaiement = t.reference === p.reference_np && (t.trxref === p.id || t.merchant_reference === p.id);
  const bonMontant = t.currency === 'EUR' && Math.round(Number(t.amount) * 100) === p.montant;
  const bonEnvironnement = MODE_TEST || !t.sandbox;
  if (!memePaiement || !bonMontant || !bonEnvironnement) {
    console.error('Paiement incohérent', p.id, JSON.stringify({ ref: t.reference, trxref: t.trxref, amount: t.amount, currency: t.currency, sandbox: t.sandbox }));
    return { statut: 'en_cours' };
  }
  if (t.status === 'complete') {
    await rpc('np_confirmer', { p_id: p.id, p_reference: t.reference });
    return { statut: 'complete', nom: nomAffiche, montant: p.montant };
  }
  if (['failed', 'canceled', 'expired', 'rejected'].includes(t.status)) {
    await majPaiement(p.id, { statut: 'echoue', termine_le: new Date().toISOString() });
    return { statut: 'echoue' };
  }
  return { statut: 'en_cours' };
}

async function rattraper() {
  const depuis = new Date(Date.now() - 48 * 3600e3).toISOString();
  const avant = new Date(Date.now() - 60e3).toISOString();
  const lignes: { id: string }[] = await sb(
    `paiements_notchpay?statut=eq.initie&reference_np=not.is.null&cree_le=gt.${depuis}&cree_le=lt.${avant}&select=id&order=cree_le.desc&limit=15`);
  let confirmes = 0;
  for (const l of lignes ?? []) {
    const r = await verifier(l.id).catch(() => null);
    if (r?.statut === 'complete') confirmes++;
  }
  return { verifies: lignes?.length ?? 0, confirmes };
}

async function signatureValide(brut: string, signature: string | null) {
  if (!NP_CLE_HACHAGE) return true; // facultatif : la confirmation relit de toute façon l'API Notch Pay
  if (!signature) return false;
  const cle = await crypto.subtle.importKey('raw', new TextEncoder().encode(NP_CLE_HACHAGE), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', cle, new TextEncoder().encode(brut)));
  const attendu = Array.from(sig, (o) => o.toString(16).padStart(2, '0')).join('');
  return attendu.length === signature.length && attendu === signature.toLowerCase();
}

/* ---------- Point d'entrée ---------- */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ erreur: 'Méthode non autorisée' }, 405);

  const brut = await req.text();
  let b: Record<string, any>;
  try { b = JSON.parse(brut || '{}'); } catch { return json({ erreur: 'Requête invalide' }, 400); }

  try {
    // Webhook Notch Pay
    if (!b.action && (b.event || b.type)) {
      if (!(await signatureValide(brut, req.headers.get('x-notch-signature')))) return json({ erreur: 'Signature invalide' }, 401);
      const d = b.data ?? {};
      if (String(b.event ?? b.type).startsWith('payment.')) {
        await verifier(d.trxref ?? d.merchant_reference, d.reference).catch((e) => console.error('Webhook', e));
      }
      return json({ ok: true });
    }
    switch (b.action) {
      case 'creer': return json(await creer(b));
      case 'verifier': return json(await verifier(b.id, b.reference));
      case 'rattraper': return json(await rattraper());
      default: return json({ erreur: 'Action inconnue' }, 400);
    }
  } catch (e) {
    if (e instanceof ErreurClient) return json({ erreur: e.message }, 400);
    console.error(e);
    return json({ erreur: 'Erreur du serveur, réessayez dans un instant.' }, 500);
  }
});
