# TODO

Revue globale du projet (septembre 2026). Classé par gravité.

## Bugs qui touchent aux données

- [ ] **Perte de précision des `bigint` > 2^53** : les données passent en JSON puis par
      `JSON.parse` dans le webview. Avec des IDs de type snowflake, un update ou un delete par PK
      peut viser une autre ligne, ou aucune.
- [ ] **Impossible de saisir une PK sans valeur par défaut à l'insert.** `insert_row` insère
      maintenant les colonnes de PK qui ont une valeur, mais `TableValueEditor` affiche une PK
      vide comme « générée par Postgres », sans champ de saisie (sauf si c'est aussi une FK).
      Cas concernés : PK en texte ou en `uuid` sans défaut.
- [ ] **Les défauts qui sont des expressions sont envoyés comme des littéraux.** Le panneau
      d'insert préremplit une colonne qui n'est pas dans la PK avec son `column_default`, par
      exemple `gen_random_uuid()`, qui part en `'gen_random_uuid()'::uuid` et fait échouer
      l'insert. (`now()` passe par chance : Postgres accepte `'now()'` comme date.) Il faudrait
      envoyer le mot-clé `default` tant que l'utilisateur n'a pas modifié la valeur.

## Multi-fenêtres

- [ ] **`menu-event` et `generate-query` sont envoyés à toutes les fenêtres** (`app.emit`). Un
      « Export CSV » dans la fenêtre A exporte aussi la fenêtre B (deuxième boîte de dialogue ou
      presse-papier écrasé). Deux générations AI en parallèle mélangent leurs historiques.
      Utiliser les callbacks `action` des `MenuItem` côté JS, et un `tauri::ipc::Channel` pour
      le streaming AI.

## Qualité et robustesse

- [ ] **`pnpm test` : 33 anciens tests de `values.test.ts` échouent.** Ils décrivent un
      comportement que le code n'a pas (`NULL` au lieu de `null`, pas de cast sur les types
      géométriques, réseau et range, types composites, `point` depuis un objet…). Il faut
      décider pour chacun du bon comportement, puis aligner le code ou le test.
- [ ] **`pnpm check` échoue** sur `vite.config.js` : `process` n'est pas typé, il manque
      `@types/node`.
- [ ] **Filtres `=` qui ne trouvent jamais la ligne** :
    - `float4` : `"col" = 3.14` compare en `float8` et ne matche pas la valeur arrondie en
      `float4` ; il faudrait un littéral non typé (`'3.14'`) ou un cast `::float4` ;
    - `json` / `jsonb` : la valeur tapée passe par `JSON.stringify` et devient une chaîne JSON
      (`'"{...}"'`) au lieu d'un objet.
- [ ] **`is_loading` reste à `true`** quand `load_tables` ou `select_table` sortent en erreur.
      Le toast « Connected to… » s'affiche aussi à chaque refresh.
- [ ] **Deux clics rapides sur deux tables** peuvent afficher les lignes de la première sous
      les colonnes de la seconde : l'ancienne réponse n'est jamais ignorée.
- [ ] `operators_for_column` ajoute `"<="` deux fois et oublie `">="`.
- [ ] `fetch_enum_values` filtre sur `typname` sans le schéma : deux enums du même nom dans deux
      schémas mélangent leurs valeurs.

## Backend et sécurité

- [ ] **Une nouvelle connexion Postgres (TCP + TLS) à chaque commande.** Ouvrir une table en
      déclenche 2 ou 3. Garder un pool (`deadpool-postgres`) dans le `State` Tauri, avec une clé
      par connection string.
- [ ] **Le SSL ne se comporte pas comme libpq.** `sslmode=require` vérifie le certificat
      (native-tls), alors que libpq ne le vérifie pas en `require` : les serveurs à certificat
      auto-signé échouent. `prefer` (le défaut) n'essaie pas le TLS, et `sslrootcert` est ignoré.
- [ ] **Mots de passe et clé OpenRouter stockés en clair** dans les fichiers du store. Utiliser
      le trousseau de l'OS (crate `keyring`).
- [ ] **L'agent AI utilise une connexion en lecture-écriture.** Ajouter
      `SET default_transaction_read_only = on` sur cette connexion.
- [ ] **Nettoyage** : `tauri-plugin-sql`, `global-shortcut` et `persisted-scope` sont chargés
      mais jamais utilisés côté front. Restreindre la permission `fs` en écriture sur
      `$HOME/**`, et définir une CSP au lieu de `csp: null`.
