import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
const packageCopy = dockerfile.indexOf('COPY package*.json ./');
const install = dockerfile.indexOf('RUN npm ci --maxsockets=5');

assert.notEqual(packageCopy, -1, 'Frontend Dockerfile must copy package manifests before installing dependencies');
assert.notEqual(install, -1, 'Frontend Dockerfile must use npm ci');
assert.ok(packageCopy < install, 'package manifests must be copied before npm ci');
assert.doesNotMatch(dockerfile, /npm install|legacy-peer-deps/, 'Docker build must not bypass the lockfile or peer-dependency checks');

console.log('Frontend Docker dependency policy: OK');
