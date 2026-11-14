import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openStore } from '../apps/api/store.mjs';

test('education migration archives legacy identities without relabelling history and is idempotent',()=>{
  const dir=mkdtempSync(join(tmpdir(),'build-bot-education-migration-')),file=join(dir,'app.sqlite'),legacy=new DatabaseSync(file);
  legacy.exec(`CREATE TABLE organizations(id TEXT PRIMARY KEY,name TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE agents(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,slug TEXT NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL,accent TEXT NOT NULL,UNIQUE(organization_id,slug));`);
  legacy.prepare('INSERT INTO organizations VALUES(?,?,?)').run('org','Legacy workspace','2026-01-01T00:00:00.000Z');
  legacy.prepare('INSERT INTO agents VALUES(?,?,?,?,?,?)').run('chief-original','org','chief','CHIEF','AI Executive Orchestrator','#3478ed');
  legacy.prepare('INSERT INTO agents VALUES(?,?,?,?,?,?)').run('finance-original','org','finance-manager','Finance Manager','Financial monitoring','#19ad68');
  legacy.close();
  let db=openStore(file);
  assert.equal(db.prepare("SELECT id FROM agents WHERE organization_id='org' AND slug='chief'").get().id,'chief-original');
  assert.equal(db.prepare("SELECT archived_at FROM agents WHERE id='finance-original'").get().archived_at!==null,true);
  assert.equal(db.prepare("SELECT name FROM legacy_agent_archive WHERE agent_id='finance-original'").get().name,'Finance Manager');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM agents WHERE organization_id='org' AND kind='built_in' AND archived_at IS NULL").get().n,11);
  assert.equal(db.prepare("SELECT name FROM agents WHERE organization_id='org' AND slug='student-records'").get().name,'Student Records Manager');
  db.close();db=openStore(file);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM agents WHERE organization_id='org' AND kind='built_in' AND archived_at IS NULL").get().n,11);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM legacy_agent_archive WHERE organization_id='org'").get().n,1);
  db.close();rmSync(dir,{recursive:true,force:true});
});
