# TODO

Revue globale du projet (septembre 2026). Classé par gravité. Chaque point indique où se trouve le
code et une piste de correction.

## Contexte pour reprendre

### Déjà fait (PR #56, mergée)

Toute la génération du SQL côté front passe maintenant par des helpers de
`src/lib/table/values.ts` :

- `quote_ident(name)` : met les noms de schéma, de table ou de colonne entre guillemets doubles.
  Toujours l'utiliser, jamais `${column_name}` en brut ;
- `quote_literal(value)` : met une chaîne entre apostrophes et double celles qu'elle contient ;
- `value_to_sql(column, value)` : convertit une valeur lue par `row_to_json` en littéral SQL.
  Le cas par défaut ajoute un cast sur le nom `pg_type` (`'x'::inet`) ; `bit` n'est jamais
  casté (`::bit` veut dire `bit(1)`) ;
- `sql_to_value(column, sql)` : retire les apostrophes et le cast d'un `column_default`
  (`'draft'::character varying` donne `draft`) ;
- `primary_key_condition(pks, rows)` : construit `("a", "b") in ((1, 2), …)` et gère les PK
  composites.

Dans `src/lib/table/pg_context.svelte.ts`, `get_primary_keys()` renvoie toutes les colonnes de
la PK, et `pick_primary_keys(row)` ne garde que leurs valeurs, pour construire un update
partiel. `data_type` contient le `typname` Postgres (`varchar`, `bpchar`, `int4`, `_text` pour
`text[]`), jamais le nom SQL affiché.

### Vérifier qu'une correction ne casse rien

1. `pnpm test` : 30 tests échouent déjà, tous dans les anciens blocs de `values.test.ts` (voir
   plus bas). Tout nouvel échec est une régression.
2. `src/lib/table/pg_context.test.ts` fait tourner le vrai `PgContext` avec `svelte` et
   `@tauri-apps/api/core` mockés, et vérifie le SQL envoyé à `raw_query` et les arguments de
   `get_table_data`. Y ajouter un cas pour chaque flux modifié.
3. Pour tout ce qui touche au SQL généré, le tester sur un vrai Postgres (Homebrew
   `postgresql@16`) :
   ```sh
   initdb -D /tmp/pgt -U postgres && pg_ctl -D /tmp/pgt -o "-p 54329 -k ''" start
   psql -h 127.0.0.1 -p 54329 -U postgres
   ```
   `-k ''` écoute seulement en TCP, parce qu'un chemin de socket trop long fait échouer le
   démarrage.
   Méthode qui a marché : créer une table avec beaucoup de types (valeurs avec apostrophes,
   antislashs, `NULL` dans les tableaux, camelCase, mots réservés), lire les lignes avec
   `row_to_json` comme l'app, les réécrire avec le SQL généré (update, insert, export),
   vérifier qu'elles reviennent identiques, et comparer avec `main` (`git worktree`).
4. Tester le flux dans l'app avec `pnpm tauri dev`.

Façon de travailler : une branche, un commit par problème, puis une PR.

## Multi-fenêtres

- [ ] **`menu-event` et `generate-query` sont envoyés à toutes les fenêtres.**
      `app.emit("menu-event")` (`src-tauri/src/lib.rs:26`) est écouté par
      `table_context_menu.svelte.ts:74` : un « Export CSV » dans la fenêtre A exporte aussi la
      fenêtre B (deuxième boîte de dialogue, presse-papier écrasé). `app.emit("generate-query")`
      (`src-tauri/src/commands/generate_query.rs:98`) est écouté par
      `query_generator_context.svelte.ts:174` : deux générations AI en parallèle mélangent leurs
      historiques. Piste : les callbacks `action` des `MenuItem` côté JS pour le menu, et un
      `tauri::ipc::Channel` passé à la commande pour le streaming AI.

## Qualité et robustesse

- [ ] **`pnpm test` : 30 anciens tests de `values.test.ts` échouent.** Ils sont dans les blocs
      d'origine (`NULL handling`, types géométriques, réseau, range, bit, composites, types
      système…) et décrivent un comportement que le code n'a jamais eu : `NULL` au lieu de
      `null`, pas de cast sur les types sans cas dédié, `point` depuis un objet. Il faut décider
      pour chacun du bon comportement, puis aligner le code ou le test. Les blocs ajoutés depuis passent tous.
- [ ] **Tableaux de composites impossibles à mettre à jour.** Les colonnes composites passent
      par `jsonb_populate_record(null::<type>, '<json>')` (`value_to_sql`, grâce à
      `composite_type` renvoyé par `list_table_columns`), mais un `pair[]` (`_pair`) est encore
      envoyé en `'{"{\"a\":1}"}'` et Postgres le refuse. Comme le formulaire d'update envoie
      toutes les colonnes, la table entière reste bloquée. Piste : renvoyer aussi le type
      composite des éléments, et générer (testé sur Postgres 16) :
      `array(select jsonb_populate_record(null::pair, e) from jsonb_array_elements('[…]')
      with ordinality as x(e, i) order by i)`.

## Backend et sécurité

- [ ] **Une nouvelle connexion Postgres (TCP + TLS) à chaque commande.** Chaque commande de
      `src-tauri/src/commands/` appelle `pg_connect`. Ouvrir une table en déclenche 2 ou 3.
      Piste : garder un pool (`deadpool-postgres`) dans le `State` Tauri, avec une clé par
      connection string.
- [ ] **Le SSL ne se comporte pas comme libpq** (`src-tauri/src/pg/pg_connect.rs:44`).
      `sslmode=require` vérifie le certificat (native-tls), alors que libpq ne le vérifie pas en
      `require` : les serveurs à certificat auto-signé échouent. `prefer` (le défaut) n'essaie
      pas le TLS, et `sslrootcert` est ignoré.
- [ ] **Mots de passe et clé OpenRouter stockés en clair** dans les fichiers du store
      (`connections.json` via `connections_context.svelte.ts`, et `openrouter_api_key` via
      `query_generator_context.svelte.ts`). Piste : le trousseau de l'OS (crate `keyring`),
      derrière des commandes Tauri.
- [ ] **L'agent AI utilise une connexion en lecture-écriture**
      (`src-tauri/src/commands/generate_query.rs:68`). Ajouter
      `SET default_transaction_read_only = on` juste après la connexion.
- [ ] **Nettoyage** : `tauri-plugin-sql`, `global-shortcut` et `persisted-scope` sont chargés
      (`src-tauri/src/lib.rs:13-20`) mais jamais utilisés côté front. Restreindre la permission
      `fs` en écriture sur `$HOME/**` (`src-tauri/capabilities/allow-dialogs-fs.json`), et
      définir une CSP au lieu de `"csp": null` (`src-tauri/tauri.conf.json:26`).
