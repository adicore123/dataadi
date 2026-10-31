import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectModuleFromMime,
  formatTimestampHe,
  formatFileSizeHe,
  formatDuration,
  createFolder,
  createVaultItem,
  filterAndSortItems,
  computeModuleCounts,
  computeFolderCounts,
  parseTagsInput,
  normalizeTags,
} from './vault-logic.ts';

test('detectModuleFromMime routes images, audio, and documents accurately', () => {
  assert.equal(detectModuleFromMime('image/jpeg', 'photo.jpg'), 'photos');
  assert.equal(detectModuleFromMime('', 'scan.PNG'), 'photos');
  assert.equal(detectModuleFromMime('audio/mpeg', 'note.mp3'), 'recordings');
  assert.equal(detectModuleFromMime('application/octet-stream', 'voice.m4a'), 'recordings');
  assert.equal(detectModuleFromMime('application/pdf', 'contract.pdf'), 'documents');
  assert.equal(detectModuleFromMime('text/plain', 'summary.txt'), 'documents');
});

test('formatTimestampHe generates deterministic DD.MM.YYYY and HH:MM strings', () => {
  const result = formatTimestampHe('2026-10-30T14:07:00');
  assert.equal(result.formattedDate, '30.10.2026');
  assert.equal(result.formattedTime, '14:07');
});

test('createFolder validates name/module and stamps a folder_ id', () => {
  assert.throws(() => createFolder('   ', 'documents'), /נא להזין שם לתיקייה/);
  const folder = createFolder('  קבלות וחשבוניות  ', 'documents', '2026-10-30T12:00:00');
  assert.equal(folder.name, 'קבלות וחשבוניות');
  assert.equal(folder.module, 'documents');
  assert.equal(folder.formattedDate, '30.10.2026');
  assert.ok(folder.id.startsWith('folder_'));
});

test('parseTagsInput splits, trims, dedupes and caps tags', () => {
  assert.deepEqual(parseTagsInput('חשוב, עבודה ,חשוב'), ['חשוב', 'עבודה']);
  assert.deepEqual(parseTagsInput('#2026; מס הכנסה'), ['2026', 'מס הכנסה']);
  assert.deepEqual(parseTagsInput('   '), []);
  const many = parseTagsInput(Array.from({length: 12}, (_, i) => `t${i}`).join(','));
  assert.equal(many.length, 8);
  assert.equal(parseTagsInput('x'.repeat(80))[0].length, 40);
  assert.deepEqual(normalizeTags(['a', 5, 'a', null]), ['a']);
  assert.deepEqual(normalizeTags('not-an-array'), []);
});

test('createVaultItem validates title, stamps date/time, folder and tags', () => {
  assert.throws(() => {
    createVaultItem({
      title: '   ',
      module: 'documents',
      fileName: 'empty.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
    });
  }, /חובה להזין כותרת/);

  const docItem = createVaultItem(
    {
      title: 'חוזה שכירות',
      module: 'documents',
      folderId: 'folder_123',
      folderName: 'נדל"ן',
      tags: ['חשוב', '2026'],
      fileName: 'lease.pdf',
      fileSize: 2000,
      mimeType: 'application/pdf',
    },
    '2026-10-30T11:45:00'
  );

  assert.equal(docItem.module, 'documents');
  assert.equal(docItem.folderId, 'folder_123', 'folders apply to documents too');
  assert.equal(docItem.folderName, 'נדל"ן');
  assert.deepEqual(docItem.tags, ['חשוב', '2026']);
  assert.equal(docItem.formattedDate, '30.10.2026');
  assert.equal(docItem.formattedTime, '11:45');
});

test('filterAndSortItems filters by module, folder (any module), tags and search', () => {
  const folderDoc = createVaultItem(
    {
      title: 'חוזה מהבנק',
      module: 'documents',
      folderId: 'fld_bank',
      folderName: 'בנק',
      tags: ['דחוף'],
      fileName: 'bank.pdf',
      fileSize: 1000,
      mimeType: 'application/pdf',
    },
    '2026-10-30T10:00:00'
  );
  const looseDoc = createVaultItem(
    {
      title: 'מסמך חופשי',
      module: 'documents',
      fileName: 'free.pdf',
      fileSize: 1000,
      mimeType: 'application/pdf',
    },
    '2026-10-30T11:00:00'
  );
  const photo = createVaultItem(
    {
      title: 'תמונת דרכון',
      module: 'photos',
      folderId: 'fld_docs',
      folderName: 'תעודות',
      fileName: 'passport.jpg',
      fileSize: 1000,
      mimeType: 'image/jpeg',
    },
    '2026-10-30T12:00:00'
  );

  const allItems = [folderDoc, looseDoc, photo];

  const bankOnly = filterAndSortItems(allItems, {
    moduleFilter: 'documents',
    folderFilter: 'fld_bank',
    searchQuery: '',
  });
  assert.equal(bankOnly.length, 1);
  assert.equal(bankOnly[0].title, 'חוזה מהבנק');

  const docFolderCounts = computeFolderCounts(allItems);
  assert.equal(docFolderCounts['fld_bank'], 1);
  assert.equal(docFolderCounts['fld_docs'], 1);

  const modCounts = computeModuleCounts(allItems);
  assert.equal(modCounts.all, 3);
  assert.equal(modCounts.documents, 2);
  assert.equal(modCounts.photos, 1);

  // Search hits folder names and tags too (module labels are also searched,
  // so the probe tag must not collide with "מסמכים חשובים").
  assert.equal(
    filterAndSortItems(allItems, { moduleFilter: 'all', searchQuery: 'בנק' }).length,
    1
  );
  assert.equal(
    filterAndSortItems(allItems, { moduleFilter: 'all', searchQuery: 'דחוף' }).length,
    1
  );
});

test('formatFileSizeHe and formatDuration format numbers cleanly', () => {
  assert.equal(formatFileSizeHe(512), '512 B');
  assert.equal(formatFileSizeHe(2048), '2.0 KB');
  assert.equal(formatDuration(65), '01:05');
});
