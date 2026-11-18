# Cagnotte Dovyl

Cagnotte en ligne pour s'offrir une PS5 et GTA VI. Les contributeurs choisissent un montant en euros, puis la façon de payer :

- **Mobile Money (Cameroun)** : Orange Money ou MTN MoMo via Notch Pay. Le paiement est vérifié automatiquement et le nom s'ajoute tout seul au tableau d'honneur. Un volet « à la main » garde le code USSD Orange Money pré-rempli et l'envoi depuis une appli bancaire camerounaise (Ecobank, UBA…).
- **Carte bancaire** : via le site Western Union (sans appli), vers Orange Money Cameroun.
- **Appli de transfert** : Revolut, Taptap Send, Orange Money Europe, Remitly, WorldRemit ou Ria, vers Orange Money Cameroun (liste réglable dans `assets/config.js`).

Pour la carte et les applis, le site ne voit pas le paiement : chacun inscrit son nom après l'envoi et sa contribution compte tout de suite. Dovyl compare avec ses SMS Orange Money et retire ou supprime dans l'espace admin les inscriptions sans argent derrière.

![Aperçu](assets/apercu.png)

## Organisation

| Fichier | Rôle |
|---|---|
| `index.html` | Page publique : compteur, piste à paliers, choix du paiement, tableau d'honneur |
| `admin.html` | Espace Dovyl : retirer ou supprimer une inscription, ajouter une contribution, changer le code |
| `assets/config.js` | **Tous les réglages** : numéro, nom du bénéficiaire, prix, applis, moyens payés via Notch Pay |
| `assets/app.js`, `assets/admin.js` | Logique des deux pages |
| `supabase/migrations/` | Schéma complet de la base (tables, fonctions, droits) |
| `supabase/functions/notchpay/` | Fonction serveur des paiements Notch Pay |

Le site est statique, hébergé sur GitHub Pages : https://nguiesseuyepmoudovyl.github.io/cagnotte-dovyl/. Les contributions sont stockées dans une base Supabase gratuite, accessible uniquement par des fonctions SQL : la page publique ne voit que les contributions validées, et l'administration exige un code vérifié côté serveur (empreinte bcrypt, blocage après 8 essais ratés).

## Paiements Notch Pay

1. Le site envoie le nom, le montant et le numéro Mobile Money à la fonction `notchpay`, qui crée le paiement chez Notch Pay (en euros, converti en FCFA par Notch Pay) et renvoie la page de paiement.
2. Le contributeur valide sur son téléphone, puis Notch Pay le renvoie sur le site.
3. La fonction relit le paiement **directement chez Notch Pay** : la contribution n'est créée que si le statut est « complete » et que le montant correspond. Un retour ou un webhook falsifié ne peut donc rien valider.
4. Filets de sécurité : le webhook Notch Pay déclenche la même vérification, et l'ouverture de l'espace admin revérifie les paiements restés en suspens.

**Réglages**

- Clé : la fonction utilise la clé publique de test par défaut. Pour passer en production, définir le secret `NOTCHPAY_PUBLIC_KEY` (clé `pk_live…`) dans Supabase → Edge Functions → Secrets.
- Webhook (recommandé) : dans Notch Pay → Paramètres → Webhooks, ajouter `https://nmdmnhzhzdpsmjtrgeoq.supabase.co/functions/v1/notchpay` avec l'événement `payment.complete`. Pour vérifier les signatures, définir aussi le secret `NOTCHPAY_HASH_KEY`.
- Carte bancaire via Notch Pay : quand Notch Pay aura activé le canal carte sur le compte, ajouter `'carte'` à `notchpay.moyens` dans `assets/config.js`.

## Lancer en local

```bash
python -m http.server 8765
```

Puis ouvrir http://localhost:8765.
