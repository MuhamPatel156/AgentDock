import {randomUUID} from 'node:crypto';
import {hasSecrets} from './agents.mjs';

export const APPROVED_LICENSES = new Set([
 'MIT',
 'Apache-2.0',
 'BSD-2-Clause',
 'BSD-3-Clause',
 'ISC',
 'CC0-1.0',
 'Unlicense'
]);

export function assessComponentQuality(component) {
 const issues = [];
 let score = 1.0;

 if (!component.name || typeof component.name !== 'string' || component.name.trim().length < 3) {
  issues.push('Component name must be at least 3 characters.');
  score -= 0.3;
 }

 if (!component.license || !APPROVED_LICENSES.has(component.license)) {
  issues.push(`License must be an approved open-source license: ${[...APPROVED_LICENSES].join(', ')}`);
  score -= 0.3;
 }

 if (!component.version || !/^\d+\.\d+\.\d+$/.test(component.version)) {
  issues.push('Version must follow semver format (e.g. 1.0.0).');
  score -= 0.2;
 }

 if (!component.html || typeof component.html !== 'string' || !component.html.trim()) {
  issues.push('Component HTML template cannot be empty.');
  score -= 0.3;
 }

 if (hasSecrets({html: component.html || '', css: component.css || ''})) {
  issues.push('Component contains potential secrets or credentials.');
  score = 0;
 }

 // Accessibility check: img must have alt attribute
 if (component.html && /<img\b(?![^>]*\balt\s*=)[^>]*>/i.test(component.html)) {
  issues.push('Accessibility warning: <img> tags should include an alt attribute.');
  score -= 0.1;
 }

 const finalScore = Math.max(0, Math.min(1.0, Math.round(score * 100) / 100));
 return {
  passed: issues.filter(i => !i.startsWith('Accessibility warning')).length === 0,
  qualityScore: finalScore,
  issues
 };
}

export function publishCatalogVersion(store, userId, componentId, data) {
 const quality = assessComponentQuality(data);
 if (!quality.passed) {
  throw Error(`Catalog quality check failed: ${quality.issues.join('; ')}`);
 }

 const comp = store.db.prepare('SELECT * FROM components WHERE id=?').get(componentId);
 if (!comp) throw Error('Component not found.');
 if (comp.user_id !== userId) throw Error('Only the author can publish new versions.');

 const id = randomUUID(), now = Date.now();
 store.db.prepare(
  'INSERT INTO catalog_versions (id, component_id, version, license, data, quality_score, created) VALUES (?, ?, ?, ?, ?, ?, ?)'
 ).run(id, componentId, data.version, data.license, JSON.stringify(data), quality.qualityScore, now);

 store.db.prepare('UPDATE components SET data=? WHERE id=?').run(JSON.stringify(data), componentId);

 return {
  id,
  componentId,
  version: data.version,
  license: data.license,
  qualityScore: quality.qualityScore,
  created: now
 };
}

export function listCatalogVersions(store, componentId) {
 return store.db.prepare(
  'SELECT id, component_id, version, license, quality_score, created FROM catalog_versions WHERE component_id=? ORDER BY created DESC'
 ).all(componentId);
}

export function submitCatalogReport(store, reporterId, componentId, reason, details = '') {
 const validReasons = ['malware', 'secrets', 'copyright', 'broken', 'spam'];
 if (!validReasons.includes(reason)) throw Error(`Invalid report reason. Choose from: ${validReasons.join(', ')}`);

 const id = randomUUID(), now = Date.now();
 store.db.prepare(
  'INSERT INTO catalog_reports (id, component_id, reporter_id, reason, details, status, created) VALUES (?, ?, ?, ?, ?, ?, ?)'
 ).run(id, componentId, reporterId, reason, String(details || '').slice(0, 500), 'open', now);

 return {id, componentId, status: 'open', created: now};
}

export function listCatalogReports(store, status = 'open') {
 return store.db.prepare(
  'SELECT r.*, c.data as component_data, u.username as reporter_username FROM catalog_reports r JOIN components c ON c.id=r.component_id JOIN users u ON u.id=r.reporter_id WHERE r.status=? ORDER BY r.created DESC'
 ).all(status);
}

export function moderateReport(store, adminUserId, reportId, action) {
 const report = store.db.prepare('SELECT * FROM catalog_reports WHERE id=?').get(reportId);
 if (!report) throw Error('Report not found.');

 if (action === 'unpublish') {
  store.unpublish(adminUserId, report.component_id, true);
  store.db.prepare("UPDATE catalog_reports SET status='resolved' WHERE id=?").run(reportId);
  return {action: 'unpublished', status: 'resolved'};
 } else if (action === 'dismiss') {
  store.db.prepare("UPDATE catalog_reports SET status='dismissed' WHERE id=?").run(reportId);
  return {action: 'dismissed', status: 'dismissed'};
 } else {
  throw Error(`Invalid moderation action: ${action}`);
 }
}
