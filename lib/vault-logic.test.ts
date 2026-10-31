import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectModuleFromMime,
  formatTimestampHe,
  formatFileSizeHe,
  formatDuration,
  createPhotoAlbum,
  createVaultItem,
  filterAndSortItems,
  computeModuleCounts,
  computeAlbumPhotoCounts,
  getInitialSeedItems,
} from './vault-logic.ts';

test('getInitialSeedItems returns a 100% clean empty array', () => {
  assert.deepEqual(getInitialSeedItems(), []);
});

test('detectModuleFromMime routes images, audio, and documents accurately', () => {
  assert.equal(detectModuleFromMime('image/jpeg', 'photo.jpg'), 'photos');
  assert.equal(detectModuleFromMime('', 'scan.PNG'), 'photos');
  assert.equal(detectModuleFromMime('audio/mpeg', 'note.mp3'), 'recordings');
  assert.equal(detectModuleFromMime('application/octet-stream', 'voice.m4a'), 'recordings');
  assert.equal(detectModuleFromMime('application/pdf', 'contract.pdf'), 'documents');
  assert.equal(detectModuleFromMime('text/plain', 'summary.txt'), 'documents');
});

test('formatTimestampHe generates deterministic DD.MM.YYYY and HH:MM strings', () => {
  const iso = '2026-10-30T14:07:00';
  const result = formatTimestampHe(iso);
  assert.equal(result.formattedDate, '30.10.2026');
  assert.equal(result.formattedTime, '14:07');
  assert.equal(result.fullLabel, '30.10.2026 · 14:07');
});

test('createPhotoAlbum validates album name and assigns ID and date', () => {
  assert.throws(() => createPhotoAlbum('   '), /נא להזין שם לאלבום/);
  const album = createPhotoAlbum('  קבלות וחשבוניות  ', '2026-10-30T12:00:00');
  assert.equal(album.name, 'קבלות וחשבוניות');
  assert.equal(album.formattedDate, '30.10.2026');
  assert.ok(album.id.startsWith('album_'));
});

test('createVaultItem validates title, stamps date/time, and attaches photo album', () => {
  assert.throws(() => {
    createVaultItem({
      title: '   ',
      module: 'documents',
      fileName: 'empty.pdf',
      fileSize: 1024,
      mimeType: 'application/pdf',
    });
  }, /חובה להזין כותרת/);

  const photoItem = createVaultItem(
    {
      title: 'צילום קבלה מהנייד',
      module: 'photos',
      albumId: 'album_123',
      albumName: 'חשבוניות 2026',
      fileName: 'receipt.jpg',
      fileSize: 40960,
      mimeType: 'image/jpeg',
      source: 'mobile-share',
    },
    '2026-10-30T11:45:00'
  );

  assert.equal(photoItem.title, 'צילום קבלה מהנייד');
  assert.equal(photoItem.module, 'photos');
  assert.equal(photoItem.albumId, 'album_123');
  assert.equal(photoItem.albumName, 'חשבוניות 2026');
  assert.equal(photoItem.formattedDate, '30.10.2026');
  assert.equal(photoItem.formattedTime, '11:45');
});

test('filterAndSortItems filters by module, photo albumId, and search query', () => {
  const item1 = createVaultItem(
    {
      title: 'תמונה מאתר בנייה',
      module: 'photos',
      albumId: 'alb_site',
      albumName: 'אתר בנייה',
      fileName: 'site.jpg',
      fileSize: 1000,
      mimeType: 'image/jpeg',
    },
    '2026-10-30T10:00:00'
  );
  const item2 = createVaultItem(
    {
      title: 'תמונת משרד',
      module: 'photos',
      albumId: 'alb_office',
      albumName: 'משרד',
      fileName: 'office.jpg',
      fileSize: 1000,
      mimeType: 'image/jpeg',
    },
    '2026-10-30T11:00:00'
  );
  const doc1 = createVaultItem(
    {
      title: 'חוזה שכירות',
      module: 'documents',
      fileName: 'lease.pdf',
      fileSize: 2000,
      mimeType: 'application/pdf',
    },
    '2026-10-30T12:00:00'
  );

  const allItems = [item1, item2, doc1];

  const siteAlbumOnly = filterAndSortItems(allItems, {
    moduleFilter: 'photos',
    albumFilter: 'alb_site',
    searchQuery: '',
  });
  assert.equal(siteAlbumOnly.length, 1);
  assert.equal(siteAlbumOnly[0].title, 'תמונה מאתר בנייה');

  const albumCounts = computeAlbumPhotoCounts(allItems);
  assert.equal(albumCounts['alb_site'], 1);
  assert.equal(albumCounts['alb_office'], 1);

  const modCounts = computeModuleCounts(allItems);
  assert.equal(modCounts.all, 3);
  assert.equal(modCounts.photos, 2);
  assert.equal(modCounts.documents, 1);
  assert.equal(modCounts.recordings, 0);
});

test('formatFileSizeHe and formatDuration format numbers cleanly', () => {
  assert.equal(formatFileSizeHe(512), '512 B');
  assert.equal(formatFileSizeHe(2048), '2.0 KB');
  assert.equal(formatDuration(65), '01:05');
});
