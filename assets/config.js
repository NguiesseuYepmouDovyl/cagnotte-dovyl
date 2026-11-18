// Réglages de la Cagnotte Dovyl — modifier ici, rien d'autre à toucher.
window.CAGNOTTE = {
  // Compte qui reçoit l'argent : Orange Money Cameroun (même solde que la carte prépayée Orange)
  numeroOrangeMoney: '695225850',
  // Nom exact du titulaire du compte Orange Money (demandé par les services de transfert)
  nomBeneficiaire: 'Nguiesseu Yepmou Dovyl',

  // Paiements vérifiés automatiquement par Notch Pay (fonction Supabase « notchpay »).
  // moyens : 'mobile' = Orange Money / MTN MoMo. Ajouter 'carte' quand Notch Pay aura activé
  // la carte bancaire sur le compte (canal « card » encore inactif au 18/11/2026).
  // La clé Notch Pay (sandbox ou production) se règle dans la fonction, pas ici.
  notchpay: { actif: true, moyens: ['mobile'] },

  // Ancienne option, inutile avec Notch Pay ci-dessus : lien de paiement fixe pour la carte.
  lienCarte: '',

  // Contact. Si un pseudo Telegram est renseigné (sans @), il remplace WhatsApp.
  telegram: '',
  numeroWhatsApp: '695225850',

  // Ce qu'on achète, prix en euros. L'objectif total = somme des prix.
  achats: [
    { id: 'ps5', nom: 'PS5', detail: 'Console avec lecteur de disque et une manette', prix: 550 },
    { id: 'gta', nom: 'GTA VI', detail: 'Le jeu, version disque', prix: 80 },
  ],

  // Date de sortie annoncée de GTA VI
  sortieGTA: '2026-11-19T00:00:00+01:00',

  // Montants proposés en un clic (euros)
  montantsRapides: [2, 5, 10, 20, 50, 100],

  // Paiement par carte sans appli : Western Union vers Orange Money Cameroun
  westernUnion: 'https://www.westernunion.com/fr/fr/providers/orange-money.html',

  // Applis qui envoient vers un numéro Orange Money Cameroun (affichées dans cet ordre)
  applis: [
    { nom: 'Revolut', desc: 'Envoi direct vers Orange Money', lien: 'https://www.revolut.com/fr-FR/money-transfer/send-money-with-orange-money/' },
    { nom: 'Taptap Send', desc: 'Souvent la moins chère', lien: 'https://www.taptapsend.com/fr' },
    { nom: 'Orange Money Europe', desc: "L'appli d'Orange, depuis l'Europe", lien: 'https://www.orangemoney.fr' },
    { nom: 'Remitly', desc: 'Appli ou site web', lien: 'https://www.remitly.com/fr/fr/cameroon' },
    { nom: 'WorldRemit', desc: 'Appli ou site web', lien: 'https://www.worldremit.com/fr/cameroon/mobile-money' },
    { nom: 'Ria', desc: 'Appli, site ou agence', lien: 'https://www.riamoneytransfer.com/fr-fr/send-money-to-cameroon/' },
  ],

  // Base de données (Supabase, offre gratuite). La clé publique est faite pour être visible.
  supabaseUrl: 'https://nmdmnhzhzdpsmjtrgeoq.supabase.co',
  supabaseCle: 'sb_publishable_iD3wMaGoD6COfuJ0TqTIEw_YoQXNGBk',
};
