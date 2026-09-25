# TODO

Revue globale du projet (septembre 2026). Classé par gravité.

## Bugs qui touchent aux données

- [ ] **Clés primaires composites ignorées.** Seule la première colonne de la PK est utilisée
      (`columns.find(col => col.is_primary_key === "YES")`). Sur une PK `(a, b)`,
      `delete_selection` fait `where a = any(...)` et supprime toutes les lignes qui ont le même
      `a`. `update_row` modifie aussi plusieurs lignes.
- [ ] **« Set to NULL » / « Set to default » du menu contextuel ne font rien.** La ligne passée à
      `update_row` ne contient pas la PK, donc la requête finit en `WHERE id = null`, qui ne touche
      aucune ligne (le toast affiche quand même un succès). « Set default » envoie en plus
      `column_default` (ex. `nextval(...)`) comme une chaîne au lieu du mot-clé `DEFAULT`.
- [ ] **Noms de colonnes jamais entre guillemets** : update, insert, delete, filtres WHERE,
      `order by`, colonnes sélectionnées, « Set all to NULL », export SQL. Toute colonne en
      camelCase (`"userId"`, ce que fait Prisma) ou qui porte un mot réservé (`order`, `user`)
      fait échouer la requête. `fullname` n'échappe pas non plus les `"`.
- [ ] **`value_to_sql` n'échappe pas les apostrophes dans plusieurs cas** :
    - `varchar` passe par le cas par défaut `'${value}'::varchar` sans échappement ;
    - les opérateurs `like` / `ilike` / `~` font `'${value}'` sans échappement ;
    - un nombre dont le type n'est pas reconnu plante avec `value.includes is not a function`
      (c'est le cas de `numeric`, que `row_to_json` renvoie comme nombre JSON) ;
    - les tableaux : le nom de type Postgres est `_text` / `_int4` et jamais `text_array`, donc
      les éléments ne sont ni mis entre guillemets ni échappés.
- [ ] **Perte de précision des `bigint` > 2^53** : les données passent en JSON puis par
      `JSON.parse` dans le webview. Avec des IDs de type snowflake, un update ou un delete par PK
      peut viser une autre ligne, ou aucune.
- [ ] **Insert impossible quand la PK n'a pas de valeur par défaut** : `insert_row` et
      `upsert_row` excluent toujours les colonnes de la PK (tables de jointure, PK en `uuid` ou
      en texte sans défaut).

## Multi-fenêtres

- [ ] **`menu-event` et `generate-query` sont envoyés à toutes les fenêtres** (`app.emit`). Un
      « Export CSV » dans la fenêtre A exporte aussi la fenêtre B (deuxième boîte de dialogue ou
      presse-papier écrasé). Deux générations AI en parallèle mélangent leurs historiques.
      Utiliser les callbacks `action` des `MenuItem` côté JS, et un `tauri::ipc::Channel` pour
      le streaming AI.

## Qualité et robustesse

- [ ] **`pnpm test` : les tests de `values.test.ts` échouent.** Ils décrivent un comportement
      que le code n'a pas (`NULL` au lieu de `null`, types `real` / `double_precision` qui ne
      sont pas des `typname`, types composites, `point` depuis un objet…). Aligner le code et les
      tests.
- [ ] **`pnpm check` échoue** sur `vite.config.js` : `process` n'est pas typé, il manque
      `@types/node`.
- [ ] **`is_loading` reste à `true`** quand `load_tables` ou `select_table` sortent en erreur.
      Le toast « Connected to… » s'affiche aussi à chaque refresh.
- [ ] **Deux clics rapides sur deux tables** peuvent afficher les lignes de la première sous
      les colonnes de la seconde : l'ancienne réponse n'est jamais ignorée.
- [ ] `operators_for_column` ajoute `"<="` deux fois et oublie `">="`.
- [ ] `upsert_row` teste `primary_key_value ?` : une PK égale à `0` part en insert.
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
