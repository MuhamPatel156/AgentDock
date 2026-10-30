import {readdir, rm, stat} from 'node:fs/promises';
import path from 'node:path';

export async function sweepOrphans(dataDir, {maxAgeMs = 7200000} = {}) {
	if (!dataDir) throw Error('Data directory required.');
	const summary = {sweptFolders: 0, sweptFiles: 0, errors: []};
	const now = Date.now();

	// 1. Sweep old runtime staging folders
	const runtimeDir = path.join(dataDir, 'runtime');
	try {
		const entries = await readdir(runtimeDir, {withFileTypes: true});
		for (const ent of entries) {
			if (ent.isDirectory()) {
				const full = path.join(runtimeDir, ent.name);
				try {
					const s = await stat(full);
					if (now - s.mtimeMs >= maxAgeMs) {
						await rm(full, {recursive: true, force: true});
						summary.sweptFolders++;
					}
				} catch (e) {
					summary.errors.push(e.message);
				}
			}
		}
	} catch (err) {
		if (err.code !== 'ENOENT') summary.errors.push(err.message);
	}

	// 2. Sweep old export staging folders
	const exportsDir = path.join(dataDir, 'exports');
	try {
		const entries = await readdir(exportsDir, {withFileTypes: true});
		for (const ent of entries) {
			if (ent.isDirectory()) {
				const full = path.join(exportsDir, ent.name);
				try {
					const s = await stat(full);
					if (now - s.mtimeMs >= maxAgeMs) {
						await rm(full, {recursive: true, force: true});
						summary.sweptFolders++;
					}
				} catch (e) {
					summary.errors.push(e.message);
				}
			}
		}
	} catch (err) {
		if (err.code !== 'ENOENT') summary.errors.push(err.message);
	}

	return summary;
}
