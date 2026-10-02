# ShopInMada Backend

API métier de ShopInMada, construite avec **Node.js**, **Express**, **TypeScript** et **MongoDB/Mongoose**. Elle centralise les comptes, les boutiques et les opérations de la marketplace.

[![Node.js](https://img.shields.io/badge/Node.js-API-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4-333333?logo=express&logoColor=white)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47a248?logo=mongodb&logoColor=white)](https://mongoosejs.com/)

## Responsabilités

- Inscription, connexion, session, récupération de compte et vérification par OTP.
- Gestion des profils personnels et des boutiques vendeuses.
- Catalogue produits, variantes, recherche et téléversement d'images.
- Commandes, commentaires et abonnements.
- Protection des routes, validation des entrées, CSRF et contrôle d'origine CORS.

Les routes applicatives sont préfixées par `/api/v1`. Les images envoyées sont servies sous `/api/v1/uploads`.

## Prérequis

- Node.js et Corepack/Yarn (version déclarée : Yarn 4.5.3).
- Une instance MongoDB accessible.
- Un serveur SMTP pour les fonctions d'e-mail.

## Installation

Depuis le dossier `backend` :

```powershell
Copy-Item .env.example .env
corepack yarn install
corepack yarn dev
```

Par défaut, le serveur démarre sur `http://localhost:3000`. Le point d'entrée de santé/racine est `GET /api/v1`.

## Configuration

| Variable         | Description                                     | Exemple local                             |
| ---------------- | ----------------------------------------------- | ----------------------------------------- |
| `PORT`           | Port HTTP de l'API                              | `3000`                                    |
| `DB_URI`         | URI de connexion MongoDB                        | `mongodb://localhost:27017/shoppingMada`  |
| `TOKEN_SECRET`   | Secret de signature des jetons                  | Remplacer par une valeur aléatoire longue |
| `ALLOWED_ORIGIN` | Origine frontend autorisée par CORS             | `http://localhost:5173`                   |
| `SMTP_HOST`      | Hôte du serveur SMTP                            | `smtp.gmail.com`                          |
| `SMTP_PORT`      | Port SMTP                                       | `465`                                     |
| `SMTP_SECURE`    | Connexion SMTP TLS                              | `true`                                    |
| `EMAIL_USER`     | Adresse utilisée pour l'envoi                   | Votre adresse d'envoi                     |
| `EMAIL_PASSWORD` | Mot de passe SMTP ou mot de passe d'application | À conserver uniquement dans `.env`        |

Pour Gmail, utilisez un mot de passe d'application et activez la validation en deux étapes. Ne publiez jamais vos secrets, cookies ou fichiers `.env`.

## Scripts

| Commande              | Description                                |
| --------------------- | ------------------------------------------ |
| `corepack yarn dev`   | Développement avec redémarrage automatique |
| `corepack yarn build` | Compilation TypeScript dans `build/`       |
| `corepack yarn start` | Démarrage du build compilé                 |

## Tests

Des sources de tests Jest existent, mais Jest et `supertest` ne sont pas déclarés dans les dépendances actuelles. Le build de production TypeScript exclut les sources de tests.

## Droits d'utilisation

Ce backend est un projet client privé. **La réutilisation commerciale, la copie, la redistribution ou la republication de son code sont interdites sans autorisation écrite préalable du détenteur des droits.** Aucune licence de réutilisation n'est accordée par ce README.

## Contact

**Avotra Frederic** · FullCoding — Lead Developer

Software Engineering · Full-stack web & mobile · Backend & Software Architecture · Automation & AI

[GitHub](https://github.com/avotra-frederic) · [LinkedIn](https://linkedin.com/in/avotra-frederic) · [fred.avotra@gmail.com](mailto:fred.avotra@gmail.com)
