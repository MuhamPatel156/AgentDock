// Schema migration engine for AgentDock SQLite database
export const MIGRATIONS = [
 {
  version: 1,
  name: '001_initial_schema',
  up(db) {
   db.exec(`
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,password TEXT NOT NULL,admin INTEGER NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS workspaces(user_id TEXT PRIMARY KEY REFERENCES users(id),revision INTEGER NOT NULL,data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS components(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),data TEXT NOT NULL,published INTEGER NOT NULL DEFAULT 1,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS releases(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,files TEXT NOT NULL,created INTEGER NOT NULL,active INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS usage(day TEXT NOT NULL,user_id TEXT NOT NULL,reserved INTEGER NOT NULL,PRIMARY KEY(day,user_id));
    CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL,details TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS project_secrets(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),project_id TEXT NOT NULL,key TEXT NOT NULL,encrypted_value TEXT NOT NULL,iv TEXT NOT NULL,tag TEXT NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL,UNIQUE(user_id,project_id,key));
    CREATE TABLE IF NOT EXISTS verification_reports(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),project_id TEXT NOT NULL,data TEXT NOT NULL,created INTEGER NOT NULL);
   `);
  }
 },
 {
  version: 2,
  name: '002_project_databases_and_files',
  up(db) {
   db.exec(`
    CREATE TABLE IF NOT EXISTS project_databases(
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      filename TEXT NOT NULL,
      created INTEGER NOT NULL,
      updated INTEGER NOT NULL,
      UNIQUE(user_id, project_id, name)
    );
    CREATE TABLE IF NOT EXISTS project_files(
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      project_id TEXT NOT NULL,
      path TEXT NOT NULL,
      size INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      created INTEGER NOT NULL,
      updated INTEGER NOT NULL,
      UNIQUE(user_id, project_id, path)
    );
   `);
  }
 },
 {
  version: 3,
  name: '003_instance_backups',
  up(db) {
   db.exec(`
    CREATE TABLE IF NOT EXISTS instance_backups(
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      filename TEXT NOT NULL,
      size INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      migration_version INTEGER NOT NULL,
      created INTEGER NOT NULL
    );
   `);
  }
 },
 {
  version: 4,
  name: '004_auth_recovery_and_rbac',
  up(db) {
   db.exec(`
    CREATE TABLE IF NOT EXISTS password_resets(
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      expires INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS recovery_keys(
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      key_hash TEXT NOT NULL,
      created INTEGER NOT NULL
    );
   `);
  }
 },
 {
  version: 5,
  name: '005_worker_queue_and_jobs',
  up(db) {
   db.exec(`
    CREATE TABLE IF NOT EXISTS worker_jobs(
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      result TEXT,
      error TEXT,
      created INTEGER NOT NULL,
      started INTEGER,
      finished INTEGER
    );
   `);
  }
 },
 {
  version: 6,
  name: '006_github_oauth_and_repos',
  up(db) {
   db.exec(`
    CREATE TABLE IF NOT EXISTS github_accounts(
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      github_user TEXT NOT NULL,
      encrypted_token TEXT NOT NULL,
      iv TEXT NOT NULL,
      tag TEXT NOT NULL,
      scopes TEXT NOT NULL,
      created INTEGER NOT NULL,
      updated INTEGER NOT NULL,
      UNIQUE(user_id, github_user)
    );
    CREATE TABLE IF NOT EXISTS project_repos(
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      project_id TEXT NOT NULL,
      repository TEXT NOT NULL,
      branch TEXT NOT NULL DEFAULT 'main',
      verified INTEGER NOT NULL DEFAULT 0,
      created INTEGER NOT NULL,
      UNIQUE(user_id, project_id)
    );
   `);
  }
 },
 {
  version: 7,
  name: '007_deployments_domains_and_rollback',
  up(db) {
   db.exec(`
    CREATE TABLE IF NOT EXISTS deployments(
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      project_id TEXT NOT NULL,
      target TEXT NOT NULL,
      version TEXT NOT NULL,
      status TEXT NOT NULL,
      url TEXT,
      files_snapshot TEXT NOT NULL,
      created INTEGER NOT NULL,
      updated INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS custom_domains(
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      project_id TEXT NOT NULL,
      domain TEXT NOT NULL UNIQUE,
      verified INTEGER NOT NULL DEFAULT 0,
      created INTEGER NOT NULL
    );
   `);
  }
 },
 {
  version: 8,
  name: '008_collaboration_and_reviews',
  up(db) {
   db.exec(`
    CREATE TABLE IF NOT EXISTS project_members(
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id),
      role TEXT NOT NULL,
      invited_by TEXT NOT NULL REFERENCES users(id),
      created INTEGER NOT NULL,
      UNIQUE(project_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS project_reviews(
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      author_id TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      changes TEXT NOT NULL,
      status TEXT NOT NULL,
      reviewer_id TEXT,
      comment TEXT,
      created INTEGER NOT NULL,
      updated INTEGER NOT NULL
    );
   `);
  }
 },
 {
  version: 9,
  name: '009_catalog_moderation_and_versioning',
  up(db) {
   db.exec(`
    CREATE TABLE IF NOT EXISTS catalog_versions(
      id TEXT PRIMARY KEY,
      component_id TEXT NOT NULL REFERENCES components(id),
      version TEXT NOT NULL,
      license TEXT NOT NULL,
      data TEXT NOT NULL,
      quality_score REAL NOT NULL,
      created INTEGER NOT NULL,
      UNIQUE(component_id, version)
    );
    CREATE TABLE IF NOT EXISTS catalog_reports(
      id TEXT PRIMARY KEY,
      component_id TEXT NOT NULL REFERENCES components(id),
      reporter_id TEXT NOT NULL REFERENCES users(id),
      reason TEXT NOT NULL,
      details TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created INTEGER NOT NULL
    );
   `);
  }
 },
 {
  version: 10,
  name: '010_beta_invitations_and_budgets',
  up(db) {
   db.exec(`
    CREATE TABLE IF NOT EXISTS beta_invitations(
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      invited_email TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      max_uses INTEGER NOT NULL DEFAULT 1,
      use_count INTEGER NOT NULL DEFAULT 0,
      expires INTEGER,
      revoked INTEGER NOT NULL DEFAULT 0,
      created INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS beta_claims(
      id TEXT PRIMARY KEY,
      invitation_id TEXT NOT NULL REFERENCES beta_invitations(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      claimed_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS budget_caps(
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL DEFAULT 'user',
      user_id TEXT REFERENCES users(id),
      daily_token_cap INTEGER NOT NULL DEFAULT 100000,
      monthly_token_cap INTEGER NOT NULL DEFAULT 2000000,
      max_concurrent_containers INTEGER NOT NULL DEFAULT 2,
      max_storage_bytes INTEGER NOT NULL DEFAULT 52428800,
      alert_threshold_percent INTEGER NOT NULL DEFAULT 80,
      created INTEGER NOT NULL,
      updated INTEGER NOT NULL,
      UNIQUE(scope, user_id)
    );
   `);
  }
 },
 {
  version: 11,
  name: '011_billing_subscriptions_and_usage',
  up(db) {
   db.exec(`
    CREATE TABLE IF NOT EXISTS customer_subscriptions(
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
      plan TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'active',
      current_period_start INTEGER NOT NULL,
      current_period_end INTEGER NOT NULL,
      cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
      created INTEGER NOT NULL,
      updated INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS invoices(
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      subscription_id TEXT REFERENCES customer_subscriptions(id),
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'usd',
      status TEXT NOT NULL DEFAULT 'paid',
      line_items TEXT NOT NULL,
      paid_at INTEGER,
      created INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS billing_customers(
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      customer_id TEXT NOT NULL UNIQUE,
      payment_method_status TEXT NOT NULL DEFAULT 'valid',
      billing_email TEXT,
      created INTEGER NOT NULL,
      updated INTEGER NOT NULL
    );
   `);
  }
 }
];

export function initMigrationsTable(db) {
 db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations(
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at INTEGER NOT NULL
  );
 `);
}

export function getMigrationStatus(db) {
 initMigrationsTable(db);
 const rows = db.prepare('SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC').all();
 const appliedVersions = new Set(rows.map(r => r.version));
 const currentVersion = rows.length > 0 ? rows[rows.length - 1].version : 0;
 const pending = MIGRATIONS.filter(m => !appliedVersions.has(m.version));
 return {
  currentVersion,
  applied: rows,
  pending: pending.map(m => ({version: m.version, name: m.name}))
 };
}

export function runMigrations(db) {
 initMigrationsTable(db);
 const rows = db.prepare('SELECT version FROM schema_migrations').all();
 const appliedVersions = new Set(rows.map(r => r.version));
 let appliedCount = 0;

 for (const migration of MIGRATIONS) {
  if (!appliedVersions.has(migration.version)) {
   db.exec('BEGIN IMMEDIATE');
   try {
    migration.up(db);
    db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
     migration.version,
     migration.name,
     Date.now()
    );
    db.exec('COMMIT');
    appliedCount++;
   } catch (err) {
    db.exec('ROLLBACK');
    throw new Error(`Migration ${migration.name} (v${migration.version}) failed: ${err.message}`);
   }
  }
 }

 return {
  appliedCount,
  status: getMigrationStatus(db)
 };
}
