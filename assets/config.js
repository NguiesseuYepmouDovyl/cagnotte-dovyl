// Réglages de la Cagnotte Dovyl — modifier ici, rien d'autre à toucher.
window.CAGNOTTE = {
  // Compte qui reçoit l'argent : Orange Money Cameroun (même solde que la carte prépayée Orange)
  numeroOrangeMoney: '695225850',
  // Nom exact du titulaire du compte Orange Money (demandé par les services de transfert)
  nomBeneficiaire: 'Nguiesseu Yepmou Dovyl',

  // Paiement par carte direct sur le site : coller ici un lien de paiement Notch Pay
  // (ex. 'https://pay.notchpay.co/xxxx'). Laisser vide tant que le compte n'existe pas.
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

  // Services de transfert qui paient vers Orange Money Cameroun
  services: {
    westernUnion: 'https://www.westernunion.com/fr/fr/providers/orange-money.html',
    taptap: 'https://www.taptapsend.com/fr',
    remitly: 'https://www.remitly.com/fr/fr/cameroon',
  },

  // Base de données (Supabase, offre gratuite). La clé publique est faite pour être visible.
  supabaseUrl: 'https://nmdmnhzhzdpsmjtrgeoq.supabase.co',
  supabaseCle: 'sb_publishable_iD3wMaGoD6COfuJ0TqTIEw_YoQXNGBk',
};
