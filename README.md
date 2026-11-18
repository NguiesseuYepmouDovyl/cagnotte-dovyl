# Cagnotte Dovyl

Cagnotte en ligne pour s'offrir une PS5 et GTA VI. Les contributeurs choisissent un montant en euros, puis la façon de payer :

- **Carte bancaire** : via le site Western Union (sans appli), ou directement sur la page si un lien de paiement Notch Pay est configuré.
- **Appli de transfert** : Taptap Send ou Remitly, vers Orange Money Cameroun.
- **Orange Money** : pour les personnes au Cameroun, avec le code USSD pré-rempli.

Chacun inscrit ensuite son nom au tableau d'honneur. L'inscription reste en attente jusqu'à ce que Dovyl la valide dans l'espace admin, après avoir vu l'argent arriver.

![Aperçu](assets/apercu.png)

## Organisation

| Fichier | Rôle |
|---|---|
| `index.html` | Page publique : compteur, piste à paliers, choix du paiement, tableau d'honneur |
| `admin.html` | Espace Dovyl : valider ou refuser les inscriptions, ajouter une contribution, changer le code |
| `assets/config.js` | **Tous les réglages** : numéro, nom du bénéficiaire, prix, lien de paiement par carte |
| `assets/app.js`, `assets/admin.js` | Logique des deux pages |

Le site est statique, hébergé sur GitHub Pages : https://nguiesseuyepmoudovyl.github.io/cagnotte-dovyl/. Les contributions sont stockées dans une base Supabase gratuite, accessible uniquement par des fonctions SQL : la page publique ne voit que les contributions validées, et l'administration exige un code vérifié côté serveur (empreinte bcrypt, blocage après 8 essais ratés).

## Activer le paiement par carte directement sur le site

1. Créer un compte sur [Notch Pay](https://business.notchpay.co) et le relier au compte Orange Money.
2. Dans le tableau de bord, créer un lien de paiement (rubrique « Quicks »).
3. Coller ce lien dans `lienCarte` de `assets/config.js`, puis publier.

Le bouton « Payer par carte » remplace alors les instructions Western Union.

## Lancer en local

```bash
python -m http.server 8765
```

Puis ouvrir http://localhost:8765.
