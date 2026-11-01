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
  computeExpiryAlerts,
  normalizeExpiryDate,
  parseTagsInput,
  normalizeTags,
  collectTags,
} from './vault-logic.ts';
import { suggestTags } from './tag-suggestions.ts';

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

test('normalizeExpiryDate accepts dates and rejects garbage', () => {
  assert.equal(normalizeExpiryDate('2027-03-15'), '2027-03-15');
  assert.equal(normalizeExpiryDate('2027-03-15T10:00:00.000Z'), '2027-03-15');
  assert.equal(normalizeExpiryDate('לא תאריך'), undefined);
  assert.equal(normalizeExpiryDate(42), undefined);
});

test('computeExpiryAlerts flags urgency levels and skips far dates', () => {
  const mk = (id: string, expiresAt?: string) =>
    createVaultItem(
      { title: id, module: 'documents', expiresAt, fileName: 'x.pdf', fileSize: 1, mimeType: 'application/pdf' },
      '2026-10-01T09:00:00'
    );
  const now = new Date('2026-11-01T12:00:00');
  const alerts = computeExpiryAlerts(
    [mk('expired', '2026-10-20'), mk('week', '2026-11-05'), mk('month', '2026-11-25'), mk('far', '2027-06-01'), mk('none')],
    now
  );
  assert.deepEqual(
    alerts.map((a) => [a.item.title, a.level]),
    [['expired', 'expired'], ['week', 'week'], ['month', 'month']]
  );
  assert.equal(alerts[0].daysLeft, -12);
});

test('filterAndSortItems: favorites first, tag filter, sort modes, trash', () => {
  const fav = createVaultItem(
    { title: 'אהוב ישן', module: 'documents', favorite: true, tags: ['חשוב'], fileName: 'a.pdf', fileSize: 10, mimeType: 'application/pdf' },
    '2026-10-01T09:00:00'
  );
  const plain = createVaultItem(
    { title: 'רגיל חדש', module: 'documents', tags: ['עבודה'], fileName: 'b.pdf', fileSize: 900, mimeType: 'application/pdf' },
    '2026-10-20T09:00:00'
  );
  const trashed = { ...fav, id: 'item_trashed', deletedAt: '2026-10-30T00:00:00.000Z' };
  const all = [fav, plain, trashed];

  // Trash excluded by default, only with deleted:'only'.
  assert.equal(filterAndSortItems(all, { moduleFilter: 'all', searchQuery: '' }).length, 2);
  const trashOnly = filterAndSortItems(all, { moduleFilter: 'all', searchQuery: '', deleted: 'only' });
  assert.equal(trashOnly.length, 1);
  assert.equal(trashOnly[0].deletedAt, '2026-10-30T00:00:00.000Z');

  // Favorites float first even when newer items exist.
  const newest = filterAndSortItems(all, { moduleFilter: 'all', searchQuery: '' });
  assert.equal(newest[0].title, 'אהוב ישן');

  // Tag filter.
  assert.equal(
    filterAndSortItems(all, { moduleFilter: 'all', tagFilter: 'עבודה', searchQuery: '' }).length,
    1
  );

  // Sort modes — favorites still float first, so compare within the pair
  // of non-favorite items (sizes 900 vs 5).
  const small = createVaultItem(
    { title: 'קטן', module: 'documents', fileName: 'c.pdf', fileSize: 5, mimeType: 'application/pdf' },
    '2026-10-10T09:00:00'
  );
  const bySize = filterAndSortItems([plain, small], { moduleFilter: 'all', searchQuery: '', sortOrder: 'size' });
  assert.deepEqual(bySize.map((i) => i.title), ['רגיל חדש', 'קטן']);
  assert.equal(
    filterAndSortItems(all, { moduleFilter: 'all', searchQuery: '', sortOrder: 'oldest' })[0].title,
    'אהוב ישן'
  );
});

test('collectTags counts and orders tags across items', () => {
  const a = createVaultItem({ title: 'a', module: 'documents', tags: ['חשוב', 'עבודה'], fileName: 'a.pdf', fileSize: 1, mimeType: 'application/pdf' }, '2026-10-01T09:00:00');
  const b = createVaultItem({ title: 'b', module: 'documents', tags: ['חשוב'], fileName: 'b.pdf', fileSize: 1, mimeType: 'application/pdf' }, '2026-10-02T09:00:00');
  const tags = collectTags([a, b, { ...b, id: 'x', deletedAt: '2026-10-03T00:00:00.000Z' }]);
  assert.deepEqual(tags, [
    { tag: 'חשוב', count: 2 },
    { tag: 'עבודה', count: 1 },
  ]);
});

test('suggestTags matches Hebrew keyword families', () => {
  assert.deepEqual(suggestTags('קבלה מבנק לאומי', 'receipt-123.pdf', 'documents'), ['קבלות', 'בנק']);
  assert.deepEqual(suggestTags('דרכון סריקה', 'passport.pdf', 'documents'), ['תעודות']);
  assert.deepEqual(suggestTags('תמונת משפחה', 'fam.jpg', 'photos'), ['משפחה']);
  assert.deepEqual(suggestTags('קובץ רנדומלי', 'xyz.bin', 'documents'), []);
});
