Génial \! Je vais m'inspirer de cette structure pour créer un README percutant pour votre classe `Api` (`AK API HTTP`), en mettant en avant le besoin qu'elle résout et sa valeur ajoutée.

-----

# 🚀 AK API HTTP Client

Une classe TypeScript robuste et flexible pour gérer toutes vos interactions API \! ✨

AK API HTTP Client est une solution complète conçue pour simplifier la consommation d'APIs RESTful dans vos applications TypeScript/JavaScript. Finie la gestion répétitive de l'authentification, des re-tentatives, et des erreurs – AK API HTTP Client vous offre une interface élégante et configurable pour toutes vos requêtes HTTP.

-----

## 🎯 Pourquoi AK API HTTP Client ?

En tant que développeurs, interagir avec des APIs est une tâche quotidienne. Cependant, ce processus est rarement aussi simple qu'un `fetch('/data')`. Nous sommes souvent confrontés à des défis tels que :

  * **Gestion des Tokens d'Authentification :** Comment s'assurer que chaque requête authentifiée inclut le bon token, et que ce token est rafraîchi ou invalidé si nécessaire ?
  * **Re-tentatives (Retries) :** Que faire en cas d'erreurs réseau temporaires ou d'indisponibilité du serveur ? Faut-il re-tenter la requête ? Combien de fois ? Avec quel délai ?
  * **Gestion des Erreurs Centralisée :** Comment capturer et traiter uniformément les erreurs HTTP (401, 404, 500, etc.) à travers toute l'application, en offrant des messages clairs à l'utilisateur ou en déclenchant des actions spécifiques (ex: déconnexion) ?
  * **Multiples Services / Base URLs :** Comment configurer facilement différents endpoints pour des services publics et privés, ou même pour des microservices distincts, sans dupliquer le code ?
  * **Intercepteurs Personnalisés :** Comment ajouter des logiques pré/post-requête globales (logging, transformation des payloads, ajout de headers spécifiques) ?

AK API HTTP Client est né pour transformer ces complexités en une **expérience fluide, sécurisée et maintenable.**

Imaginez :

  * Vous envoyez une requête, et le **token d'authentification est automatiquement attaché** s'il est disponible.
  * Une erreur 500 survient, et la **requête est automatiquement re-tentée** après un court délai, sans que vous ayez à écrire la logique de retry.
  * Un token expire (erreur 401), et l'**utilisateur est automatiquement déconnecté**, et une erreur spécifique est propagée.
  * Vous pouvez facilement passer d'un service "public" à un service "privé" juste en changeant un paramètre.

-----

## ⚡ Fonctionnalités Clés

  * **Gestion d'Authentification Intégrée :**
      * S'intègre avec vos fonctions `getSession` et `signOut` pour gérer les tokens d'accès.
      * Attache automatiquement l'en-tête `Authorization: Bearer <token>` aux requêtes des services configurés pour l'authentification.
      * Déclenche une déconnexion automatique en cas de réponse 401 Unauthorized.
  * **Stratégie de Re-tentatives Robuste :**
      * Re-tente automatiquement les requêtes en cas d'erreurs serveur (5xx) jusqu'à un nombre maximum de tentatives configurable, avec un délai entre chaque tentative.
  * **Gestion des Erreurs Centralisée :**
      * Capture et normalise les erreurs via une classe `ApiError` personnalisée.
      * Permet de définir un callback `onRequestError` global pour traiter toutes les erreurs de requête de manière uniforme (logging, affichage de toasts, etc.).
  * **Configuration Multi-services :**
      * Définissez plusieurs services (ex: `public`, `private`, `service_analytics`, `service_payments`) chacun avec sa propre URL de base et son statut d'authentification.
      * Passez facilement d'un service à l'autre lors de l'envoi des requêtes.
  * **Intercepteurs Personnalisables :**
      * Exécutez vos propres logiques avant l'envoi des requêtes (`onRequest`) ou après la réception des réponses (`onResponse`), que ce soit en cas de succès ou d'erreur.
      * Permet la modification des configurations de requête et des réponses.
  * **Débogage Intégré :**
      * Un mode `debug` pour afficher les logs détaillés des requêtes et des réponses dans la console.
  * **API Intuitive pour les Requêtes HTTP :**
      * Méthodes standard `get`, `post`, `put`, `patch`, `delete`.
      * Construction automatique des URL avec les paramètres de recherche.
      * Gestion transparente des corps de requête (JSON par défaut).
  * **Mise à jour Dynamique de la Configuration :**
      * Changez les `baseUrl`, `timeout`, `headers`, ou d'autres options de configuration à tout moment, sans avoir à recréer l'instance.

-----

## 🚀 Installation

```bash
npm install axios ak-api-http
# ou
yarn add axios ak-api-http
# ou
pnpm add axios ak-api-http
```

Assurez-vous d'avoir `axios` installé, car `AK API HTTP Client` l'utilise en tant que peer dependency.

-----

## ⚡ Démarrage Rapide

```typescript
import { Api, ApiError, AuthenticationError } from 'ak-api-http'; // Assurez-vous d'utiliser le bon chemin

// 1️⃣ Définir vos fonctions de session et de déconnexion
// Ces fonctions sont responsables de récupérer le token actuel et de déconnecter l'utilisateur.
interface MySession {
  accessToken: string;
  expiresAt: number;
}

const getMySession = async (): Promise<MySession | null> => {
  // Remplacez par votre logique réelle (ex: localStorage, Context API, Redux, NextAuth, etc.)
  const token = localStorage.getItem('my_auth_token');
  if (token) {
    return { accessToken: token, expiresAt: Date.now() + 3600 * 1000 };
  }
  return null;
};

const mySignOut = async (): Promise<void> => {
  // Remplacez par votre logique réelle de déconnexion
  localStorage.removeItem('my_auth_token');
  console.log("Utilisateur déconnecté.");
  // Rediriger vers la page de connexion, etc.
};

// 2️⃣ Initialiser votre client API
const api = new Api({
  baseUrl: 'https://api.myapp.com/v1',
  timeout: 15000, // 15 secondes
  enableAuth: true, // Active la gestion de l'authentification
  getSession: getMySession,
  signOut: mySignOut,
  maxRetries: 2, // Re-tenter les erreurs 5xx jusqu'à 2 fois
  retryDelay: 2000, // Attendre 2 secondes entre les tentatives
  debug: true, // Afficher les logs dans la console

  // Intercepteur de requête personnalisé : ajouter un header par défaut
  onRequest: (config) => {
    config.headers = {
      ...config.headers,
      'X-Client-Info': 'WebApp/1.0',
    };
    console.log('[onRequest] Requête envoyée:', config.method, config.url);
    return config;
  },

  // Intercepteur de réponse personnalisé : log des réponses et gestion des erreurs
  onResponse: (response) => {
    console.log('[onResponse] Réponse reçue:', response.status, response.config.url);
    // Vous pouvez transformer la réponse ici, par exemple, dé-encapsuler des données
    // if (response.data && response.data.payload) {
    //   return { ...response, data: response.data.payload };
    // }
    return response;
  },

  // Gestionnaire d'erreur de requête personnalisé
  onRequestError: (error: ApiError) => {
    console.error('[onRequestError] Une erreur API est survenue:', error.message, error.status, error.code, error.context);
    // Afficher un message à l'utilisateur, envoyer à un service de monitoring d'erreurs, etc.
    if (error instanceof AuthenticationError) {
      alert("Votre session a expiré. Veuillez vous reconnecter.");
    } else if (error.status === 404) {
      alert("Ressource non trouvée.");
    }
  },

  // Configuration de services multiples (si votre application interagit avec plusieurs APIs)
  services: {
    public: { url: 'https://public-api.myapp.com' },
    private: { url: 'https://api.myapp.com/v1', enableAuth: true },
    // Exemple de service spécifique qui n'utilise pas l'auth, même si enableAuth est true globalement
    analytics: { url: 'https://analytics.myapp.com', enableAuth: false },
  },
});

// 3️⃣ Utiliser le client API pour faire des requêtes

async function fetchData() {
  try {
    // Requête GET classique vers le service privé par défaut
    const users = await api.get<{ id: string; name: string }[]>('/users');
    console.log('Liste des utilisateurs:', users);

    // Requête POST avec des données
    const newUser = await api.post<{ id: string; name: string }>('/users', { name: 'Alice' });
    console.log('Nouvel utilisateur créé:', newUser);

    // Requête GET avec des paramètres de recherche
    const products = await api.get<{ name: string }[]>('/products', { category: 'electronics', limit: 10 });
    console.log('Produits électroniques:', products);

    // Requête vers un service spécifique (ex: sans authentification)
    const stats = await api.get<{ visits: number }>('/page-views', undefined, 'analytics');
    console.log('Statistiques de visite:', stats);

    // Simuler une déconnexion pour voir l'effet
    localStorage.setItem('my_auth_token', 'invalid-token'); // Simule un token invalide

    // Test d'une requête qui échouera avec 401
    // (cela déclenchera mySignOut et la gestion d'erreur 401)
    await api.get('/protected-resource');

  } catch (error) {
    console.error("Erreur attrapée au niveau de l'appelant:", error);
    if (error instanceof ApiError) {
      // Vous pouvez utiliser les propriétés spécifiques de ApiError ici
      console.error(`Détails de l'erreur: Status=${error.status}, Code=${error.code}`);
    }
  }
}

// Pour tester, vous pouvez appeler fetchData()
// fetchData();

// ---
// **Exemple de gestion de session pour un framework comme Next.js ou SvelteKit :**
// Si vous utilisez NextAuth.js ou SvelteKit Auth, vos fonctions getSession et signOut
// pourraient ressembler à ceci :

// import { getSession, signOut } from 'next-auth/react'; // ou import { auth } from '@sveltejs/auth'

// const getNextAuthSession = async () => {
//   const session = await getSession(); // Ou getServerSession() pour le serveur
//   return session ? { accessToken: session.accessToken as string } : null;
// };

// const nextAuthSignOut = async () => {
//   await signOut({ redirect: true, callbackUrl: '/login' });
// };

// const apiWithNextAuth = new Api({
//   baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
//   enableAuth: true,
//   getSession: getNextAuthSession,
//   signOut: nextAuthSignOut,
//   // ... autres configurations
// });
```

-----

## 📚 API Reference

### `new Api(options: ApiConfig)`

Crée une nouvelle instance du client API.

  * `options`: Un objet de type `ApiConfig` pour configurer le client.

### `ApiConfig` Interface

```typescript
interface ApiConfig {
  baseUrl: string; // URL de base par défaut pour toutes les requêtes
  timeout?: number; // Délai d'attente maximum pour une requête en ms (par défaut: 10000)
  headers?: Record<string, string>; // En-têtes HTTP par défaut
  enableAuth?: boolean; // Active/désactive la gestion de l'authentification (par défaut: true)
  maxRetries?: number; // Nombre maximum de re-tentatives pour les erreurs 5xx (par défaut: 3)
  retryDelay?: number; // Délai en ms entre les re-tentatives (par défaut: 1000)
  debug?: boolean; // Active les logs de débogage dans la console (par défaut: false)

  services?: { // Configuration de services multiples
    public: ServiceConfig;
    private: ServiceConfig;
  } & Partial<Record<ServiceType, ServiceConfig>>;
  // Vous pouvez définir vos propres ServiceType pour des services personnalisés.

  getSession?: GetSessionFunction; // Fonction pour récupérer la session/token actuel
  signOut?: SignOutFunction; // Fonction pour déconnecter l'utilisateur

  onRequest?: RequestInterceptor; // Intercepteur personnalisé avant l'envoi de la requête
  onResponse?: ResponseInterceptor; // Intercepteur personnalisé après la réception de la réponse (succès)
  onRequestError?: (error: ApiError) => void; // Callback pour gérer les erreurs API de manière centralisée
}

// Définitions des types clés
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type SearchParams = Record<string, string | number | boolean | undefined>;
type ServiceType = string; // Ou une union de littéraux spécifiques comme "service_1" | "my_crm_api"
interface ServiceConfig {
  url: string;
  enableAuth?: boolean; // Surcharge enableAuth pour ce service spécifique
}
interface SessionData {
  accessToken?: string;
  [key: string]: any;
}
type GetSessionFunction = () => Promise<SessionData | null>;
type SignOutFunction = () => Promise<void>;
type RequestInterceptor = (config: AxiosRequestConfig) => AxiosRequestConfig | Promise<AxiosRequestConfig>;
type ResponseInterceptor = (response: AxiosResponse) => AxiosResponse | Promise<AxiosResponse>;
```

### Méthodes de Requête

Toutes les méthodes de requête (`get`, `post`, `put`, `patch`, `delete`) retournent une `Promise<T>` où `T` est le type de données attendu de la réponse.

  * `public get<T = any>(endpoint: string, searchParams?: SearchParams, service?: "public" | "private" | ServiceType, config?: AxiosRequestConfig): Promise<T>`
  * `public post<T = any>(endpoint: string, data?: any, service?: "public" | "private" | ServiceType, config?: AxiosRequestConfig): Promise<T>`
  * `public put<T = any>(endpoint: string, data?: any, service?: "public" | "private" | ServiceType, config?: AxiosRequestConfig): Promise<T>`
  * `public patch<T = any>(endpoint: string, data?: any, service?: "public" | "private" | ServiceType, config?: AxiosRequestConfig): Promise<T>`
  * `public delete<T = any>(endpoint: string, service?: "public" | "private" | ServiceType, config?: AxiosRequestConfig): Promise<T>`

**Paramètres communs :**

  * `endpoint`: Le chemin de l'API (ex: `/users`, `/products/123`).
  * `data`: Le corps de la requête (pour `POST`, `PUT`, `PATCH`).
  * `searchParams`: Un objet pour construire les paramètres de requête (ex: `{ page: 1, limit: 10 }` devient `?page=1&limit=10`).
  * `service`: Le nom du service à utiliser (défini dans `ApiConfig.services`). Par défaut, `'private'`.
  * `config`: Un objet `AxiosRequestConfig` pour des options spécifiques à la requête (ex: `headers`, `cancelToken`).

### Classes d'Erreurs Personnalisées

  * **`ApiError extends Error`**: L'erreur de base pour toutes les erreurs provenant de l'API. Contient des propriétés `status`, `code`, et `context`.
  * **`AuthenticationError extends ApiError`**: Une erreur spécifique pour les problèmes d'authentification (status 401).

### Méthodes Utilitaires Publiques

  * `public updateConfig(newConfig: Partial<ApiConfig>): void`: Met à jour une partie de la configuration de l'instance `Api`.
  * `public getConfig(): ApiConfig`: Retourne la configuration actuelle de l'instance `Api`.
  * `public clearToken(): void`: Supprime le token d'authentification actuellement en cache.
  * `public setToken(token: string): void`: Définit manuellement le token d'authentification.
  * `public isAuthEnabled(): boolean`: Indique si l'authentification est activée pour cette instance.
  * `public updateAuthFunctions(getSession?: GetSessionFunction, signOut?: SignOutFunction): void`: Met à jour les fonctions `getSession` et `signOut` à la volée.

-----

## 🎯 Cas d'usage Recommandés

AK API HTTP Client est une solution idéale pour :

  * ✅ Les **applications web front-end** (React, Vue, Angular, Vanilla JS) nécessitant une gestion robuste des APIs.
  * ✅ Les **clients Node.js** qui interagissent avec des services RESTful et nécessitent des fonctionnalités avancées comme les retries et l'authentification.
  * ✅ Les projets où la **sécurité et la résilience des requêtes** sont primordiales.
  * ✅ Les applications avec une architecture **multi-services ou microservices**, nécessitant des configurations d'API distinctes.
  * ✅ La mise en place d'une **couche de service unifiée et typée** pour la communication avec votre backend.

-----

## ⚠️ Éviter Pour :

  * Les requêtes HTTP très basiques et isolées où `fetch` natif serait suffisant sans besoin d'authentification, de retries, ou de gestion d'erreurs centralisée.
  * Les projets sans TypeScript (bien que la librairie fonctionne en JavaScript, vous perdriez les avantages de typage et de sécurité).

-----

## 🤝 Contribution

Les contributions sont les bienvenues \! N'hésitez pas à proposer des améliorations, des corrections de bugs ou de nouvelles fonctionnalités.

1.  Fork le projet.
2.  Créez une branche pour votre fonctionnalité (`git checkout -b feature/ma-super-feature`).
3.  Commitez vos changements (`git commit -m 'Ajout d'une super fonctionnalité'`).
4.  Poussez vers votre branche (`git push origin feature/ma-super-feature`).
5.  Ouvrez une Pull Request.

### Développement local

```bash
git clone https://github.com/AndersonKouadio/ak-api-http.git # Remplacez par le vrai repo si différent
cd ak-api-http
npm install

# Lancer les tests
npm test
npm run test:watch
npm run test:coverage

# Compiler le projet
npm run build

# Linter le code (et corriger automatiquement)
npm run lint
npm run lint:fix
```

-----

## 📄 Licence

Ce projet est sous licence MIT.

-----

## 🙏 Remerciements

  * **Axios** pour son excellence en matière de client HTTP.
  * **TypeScript** pour la sécurité et la robustesse des types.
  * La communauté open source pour l'inspiration et les outils.

\<div align="center"\> Fait avec ❤️ pour des interactions API sans prise de tête. \<br\> ⭐ Star ce repo • 🐦 Suivre \<a href="[https://x.com/andy\_jojo01](https://x.com/andy_jojo01)"\>sur X\</a\> • 📖 Lire la doc (ce README \!) \</div\>