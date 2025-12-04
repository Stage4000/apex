import { test, describe } from 'node:test';
import assert from 'node:assert';
import { WhitelistService } from './whitelist.js';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Sample whitelist.sqf content for testing
const sampleWhitelistContent = `/*/ 
File: whitelist.sqf
Author: Test
__________________________________________________________________________/*/

_type = param [0,''];
private _return = [];
//================================================== WHITELISTED ROLES + SKINS ACCESS
if (_type isEqualTo 'S3') then {
\t_return = [
\t\t'76561198000000001',
\t\t'76561198000000002'
\t];
};
//================================================== CAS JET
if (_type isEqualTo 'CAS') then {
\t_return = [
\t\t'76561198000000003'
\t];
};
//================================================= COMMANDER
if (_type isEqualTo 'S1') then {
\t_return = [
\t];
};
//================================================= OPFOR
if (_type isEqualTo 'OPFOR') then {
\t_return = [
\t];
};
//================================================== ALL STAFF IDS
if (_type isEqualTo 'ALL') then {
\t_return = [
\t\t'76561198000000001',
\t\t'76561198000000002',
\t\t'76561198000000003'
\t];
};
//================================================== ADMIN IDs
if (_type isEqualTo 'ADMIN') then {
\t_return = [
\t\t'76561198000000001'
\t];
};
//================================================== MODERATOR IDS
if (_type isEqualTo 'MODERATOR') then {
\t_return = [
\t\t'76561198000000002'
\t];
};
//================================================== TRUSTED NON-STAFF IDS
if (_type isEqualTo 'TRUSTED') then {
\t_return = [
\t];
};
//================================================== MEDIA IDS
if (_type isEqualTo 'MEDIA') then {
\t_return = [
\t];
};
//================================================== ZEUS IDs
if (_type isEqualTo 'CURATOR') then {
\t_return = [
\t];
};
//================================================== DEVELOPER IDS
if (_type isEqualTo 'DEVELOPER') then {
\t_return = [
\t\t'76561198000000003'
\t];
};
_return;`;

describe('WhitelistService', async () => {
  let testDir;
  let testFilePath;
  let service;

  // Setup before tests
  testDir = join(tmpdir(), `whitelist-test-${Date.now()}`);
  await mkdir(testDir, { recursive: true });
  testFilePath = join(testDir, 'whitelist.sqf');
  await writeFile(testFilePath, sampleWhitelistContent, 'utf-8');
  service = new WhitelistService(testFilePath);

  test('should parse whitelist content correctly', async () => {
    const whitelists = await service.parseWhitelist();

    assert.strictEqual(whitelists.get('S3').length, 2);
    assert.ok(whitelists.get('S3').includes('76561198000000001'));
    assert.ok(whitelists.get('S3').includes('76561198000000002'));

    assert.strictEqual(whitelists.get('CAS').length, 1);
    assert.ok(whitelists.get('CAS').includes('76561198000000003'));

    assert.strictEqual(whitelists.get('S1').length, 0);
    assert.strictEqual(whitelists.get('OPFOR').length, 0);

    assert.strictEqual(whitelists.get('ALL').length, 3);
    assert.strictEqual(whitelists.get('ADMIN').length, 1);
    assert.strictEqual(whitelists.get('MODERATOR').length, 1);
    assert.strictEqual(whitelists.get('DEVELOPER').length, 1);
  });

  test('should add UID to whitelist', async () => {
    // Reset file
    await writeFile(testFilePath, sampleWhitelistContent, 'utf-8');
    service = new WhitelistService(testFilePath);

    const result = await service.addUid('ADMIN', '76561198000000099');

    assert.strictEqual(result.success, true);

    const whitelists = await service.parseWhitelist();
    assert.ok(whitelists.get('ADMIN').includes('76561198000000099'));
  });

  test('should reject invalid UID format', async () => {
    const result = await service.addUid('ADMIN', 'invalid-uid');

    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('Invalid Steam UID format'));
  });

  test('should reject invalid role', async () => {
    const result = await service.addUid('INVALID_ROLE', '76561198000000001');

    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('Invalid role'));
  });

  test('should prevent duplicate UIDs', async () => {
    // Reset file
    await writeFile(testFilePath, sampleWhitelistContent, 'utf-8');
    service = new WhitelistService(testFilePath);

    const result = await service.addUid('ADMIN', '76561198000000001');

    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('already in the'));
  });

  test('should remove UID from whitelist', async () => {
    // Reset file
    await writeFile(testFilePath, sampleWhitelistContent, 'utf-8');
    service = new WhitelistService(testFilePath);

    const result = await service.removeUid('ADMIN', '76561198000000001');

    assert.strictEqual(result.success, true);

    const whitelists = await service.parseWhitelist();
    assert.ok(!whitelists.get('ADMIN').includes('76561198000000001'));
  });

  test('should fail to remove non-existent UID', async () => {
    // Reset file
    await writeFile(testFilePath, sampleWhitelistContent, 'utf-8');
    service = new WhitelistService(testFilePath);

    const result = await service.removeUid('ADMIN', '76561198000000099');

    assert.strictEqual(result.success, false);
    assert.ok(result.message.includes('is not in the'));
  });

  test('should get UIDs for a role', async () => {
    // Reset file
    await writeFile(testFilePath, sampleWhitelistContent, 'utf-8');
    service = new WhitelistService(testFilePath);

    const uids = await service.getUids('S3');

    assert.strictEqual(uids.length, 2);
    assert.ok(uids.includes('76561198000000001'));
    assert.ok(uids.includes('76561198000000002'));
  });

  // Cleanup
  test.after(async () => {
    try {
      await unlink(testFilePath);
    } catch {
      // Ignore cleanup errors
    }
  });
});
