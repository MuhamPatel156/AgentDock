import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {
 assessComponentQuality,
 publishCatalogVersion,
 listCatalogVersions,
 submitCatalogReport,
 listCatalogReports,
 moderateReport,
 APPROVED_LICENSES
} from '../lib/catalog.mjs';

test('assessComponentQuality enforces licensing, semver, secret hygiene and accessibility', () => {
 // 1. Clean valid component
 const clean = {
  name: 'Hero Banner',
  license: 'MIT',
  version: '1.0.0',
  html: '<section><h1>Welcome</h1><img src="logo.png" alt="Company logo"></section>',
  css: 'section { padding: 2rem; }'
 };
 const resClean = assessComponentQuality(clean);
 assert.equal(resClean.passed, true);
 assert.ok(resClean.qualityScore >= 0.9);

 // 2. Invalid license
 const badLicense = {...clean, license: 'PROPRIETARY-CUSTOM'};
 const resBadLicense = assessComponentQuality(badLicense);
 assert.equal(resBadLicense.passed, false);
 assert.ok(resBadLicense.issues.some(i => i.includes('approved open-source license')));

 // 3. Invalid semver
 const badVer = {...clean, version: 'v1'};
 const resBadVer = assessComponentQuality(badVer);
 assert.equal(resBadVer.passed, false);
 assert.ok(resBadVer.issues.some(i => i.includes('semver')));

 // 4. Secret embedded
 const secretComp = {...clean, html: '<div>API_KEY="sk-12345678901234567890123456789012"</div>'};
 const resSecret = assessComponentQuality(secretComp);
 assert.equal(resSecret.passed, false);
 assert.equal(resSecret.qualityScore, 0);

 // 5. Accessibility warning (missing alt)
 const missingAlt = {...clean, html: '<section><img src="pic.jpg"></section>'};
 const resAlt = assessComponentQuality(missingAlt);
 assert.equal(resAlt.passed, true);
 assert.ok(resAlt.issues.some(i => i.includes('Accessibility warning')));
 assert.ok(resAlt.qualityScore < 1.0);
});

test('publishCatalogVersion and version listing enforce author ownership and record versions', async t => {
 const {app} = await fixture(t);
 const author = await app.store.register('author-cat', 'password123456');
 const other = await app.store.register('other-cat', 'password123456');

 const compId = app.store.publish(author.id, {
  name: 'Modal Dialog',
  html: '<dialog open><p>Hello</p></dialog>',
  css: 'dialog { border: 1px solid #ccc; }'
 });

 const v1Data = {
  name: 'Modal Dialog',
  license: 'MIT',
  version: '1.0.0',
  html: '<dialog open><p>Hello V1</p></dialog>',
  css: 'dialog { border: 1px solid #ccc; }'
 };

 // Author publishes v1
 const v1 = publishCatalogVersion(app.store, author.id, compId, v1Data);
 assert.equal(v1.version, '1.0.0');
 assert.equal(v1.license, 'MIT');

 // List versions
 const versions = listCatalogVersions(app.store, compId);
 assert.equal(versions.length, 1);
 assert.equal(versions[0].version, '1.0.0');

 // Other user cannot publish versions
 assert.throws(
  () => publishCatalogVersion(app.store, other.id, compId, {...v1Data, version: '1.1.0'}),
  /Only the author can publish new versions/
 );
});

test('Catalog reports and moderation workflow unpublish or dismiss components', async t => {
 const {app} = await fixture(t);
 const admin = await app.store.register('admin-mod', 'password123456');
 const reporter = await app.store.register('reporter-mod', 'password123456');

 const compId = app.store.publish(admin.id, {
  name: 'Broken Widget',
  html: '<div onclick="crash()">Broken</div>',
  css: ''
 });

 // Submit report
 const report = submitCatalogReport(app.store, reporter.id, compId, 'broken', 'Widget crashes on click');
 assert.equal(report.status, 'open');

 // List open reports
 const reports = listCatalogReports(app.store, 'open');
 assert.equal(reports.length, 1);
 assert.equal(reports[0].id, report.id);

 // Moderate report: unpublish
 const modResult = moderateReport(app.store, admin.id, report.id, 'unpublish');
 assert.equal(modResult.status, 'resolved');
 assert.equal(modResult.action, 'unpublished');

 // Component is now unpublished
 const activeComps = app.store.components();
 assert.ok(!activeComps.some(c => c.id === compId));
});

test('HTTP API routes for catalog quality, versioning, reporting, and moderation work end-to-end', async t => {
 const {call, register} = await fixture(t);
 const owner = await register('owner-cat-http');
 const member = await register('member-cat-http');

 // 1. Licenses list
 const licRes = await call('/api/catalog/licenses', {cookie: member.cookie});
 assert.equal(licRes.status, 200);
 assert.ok(licRes.data.licenses.includes('MIT'));

 // 2. Quality check
 const qcRes = await call('/api/catalog/quality-check', {
  method: 'POST',
  cookie: member.cookie,
  body: {
   name: 'Card UI',
   license: 'MIT',
   version: '1.0.0',
   html: '<article><h2>Title</h2></article>',
   css: 'article { margin: 10px; }'
  }
 });
 assert.equal(qcRes.status, 200);
 assert.equal(qcRes.data.passed, true);

 // 3. Publish initial component
 const pubRes = await call('/api/community', {
  method: 'POST',
  cookie: member.cookie,
  body: {
   confirm: true,
   component: {
    name: 'Card UI',
    license: 'MIT',
    html: '<article><h2>Title</h2></article>',
    css: 'article { margin: 10px; }'
   }
  }
 });
 assert.equal(pubRes.status, 200);
 const compId = pubRes.data.id;

 // 4. Publish version
 const verRes = await call(`/api/catalog/${compId}/versions`, {
  method: 'POST',
  cookie: member.cookie,
  body: {
   name: 'Card UI',
   license: 'MIT',
   version: '1.0.0',
   html: '<article><h2>Title V1</h2></article>',
   css: 'article { margin: 10px; }'
  }
 });
 assert.equal(verRes.status, 200);
 assert.equal(verRes.data.version, '1.0.0');

 // 5. List versions
 const verList = await call(`/api/catalog/${compId}/versions`, {cookie: member.cookie});
 assert.equal(verList.status, 200);
 assert.equal(verList.data.versions.length, 1);

 // 6. Report component
 const repRes = await call(`/api/catalog/${compId}/report`, {
  method: 'POST',
  cookie: member.cookie,
  body: {reason: 'spam', details: 'Duplicate component test'}
 });
 assert.equal(repRes.status, 200);
 const repId = repRes.data.id;

 // 7. Moderation: Member forbidden (403), Owner allowed (200)
 const memMod = await call('/api/catalog/reports', {cookie: member.cookie});
 assert.equal(memMod.status, 403);

 const ownerMod = await call('/api/catalog/reports', {cookie: owner.cookie});
 assert.equal(ownerMod.status, 200);
 assert.ok(ownerMod.data.reports.length >= 1);

 // 8. Moderate report
 const actionRes = await call(`/api/catalog/reports/${repId}/moderate`, {
  method: 'POST',
  cookie: owner.cookie,
  body: {action: 'dismiss'}
 });
 assert.equal(actionRes.status, 200);
 assert.equal(actionRes.data.status, 'dismissed');
});
