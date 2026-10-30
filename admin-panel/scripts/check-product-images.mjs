import assert from 'node:assert/strict';
import { normalizePrimary, buildImageChanges, productSaveError } from '../src/services/productImages.js';

const saved = (id, is_primary = false) => ({ id, file: null, is_primary });
const uploaded = (is_primary = false) => ({ id: null, file: {}, is_primary });
const tests = [
  ['empty image collection is valid', () => assert.deepEqual(normalizePrimary([]), [])],
  ['first photo is the default primary', () => assert.deepEqual(normalizePrimary([saved(1), saved(2)]).map(image => image.is_primary), [true, false])],
  ['existing primary is preserved', () => assert.deepEqual(normalizePrimary([saved(1), saved(2, true)]).map(image => image.is_primary), [false, true])],
  ['multiple flags normalize to one without mutating state', () => {
    const images = [saved(1, true), saved(2, true)];
    assert.deepEqual(normalizePrimary(images).map(image => image.is_primary), [true, false]);
    assert.equal(images[1].is_primary, true);
  }],
  ['new-product primary index matches only uploaded files', () => assert.deepEqual(buildImageChanges([uploaded(), uploaded(true)], []), { remove_ids: [], primary: { upload_index: 1 } })],
  ['mixed saved/new photos use upload-relative indices', () => assert.deepEqual(buildImageChanges([uploaded(), saved(12), uploaded(true), saved(13)], [12, 13]), { remove_ids: [], primary: { upload_index: 1 } })],
  ['saved primary uses its stable ID', () => assert.deepEqual(buildImageChanges([uploaded(), saved(12, true)], [12, 13]), { remove_ids: [13], primary: { id: 12 } })],
  ['removing a primary promotes the first remaining photo', () => assert.deepEqual(buildImageChanges(normalizePrimary([saved(13)]), [12, 13]), { remove_ids: [12], primary: { id: 13 } })],
  ['removing the last photo explicitly clears primary', () => assert.deepEqual(buildImageChanges([], [12]), { remove_ids: [12], primary: null })],
  ['new empty products do not imply removals', () => assert.deepEqual(buildImageChanges([], []), { remove_ids: [], primary: null })],
  ['staged uploads do not manufacture saved-photo deletions', () => assert.deepEqual(buildImageChanges([saved(12)], [12]), { remove_ids: [], primary: { id: 12 } })],
  ['missing saved IDs block an unsafe save against an old backend', () => {
    assert.throws(() => buildImageChanges([saved(undefined)], [undefined]), /identifiers are missing/);
    assert.throws(() => buildImageChanges([], [undefined]), /identifiers are missing/);
  }],
  ['nested upload validation is readable', () => assert.equal(productSaveError({ response: { status: 400, data: { images: { 0: ['Upload a valid image.'] } } } }), 'Upload a valid image.')],
  ['ambiguous server failures do not expose raw traces or encourage blind retries', () => assert.match(productSaveError({ response: { status: 500, data: '<html>Traceback</html>' } }), /Reload the product/)],
  ['safe upload failure and missing-identifier messages remain actionable', () => {
    assert.equal(productSaveError({ response: { status: 503, data: { detail: 'Photo upload failed. No changes saved.' } } }), 'Photo upload failed. No changes saved.');
    assert.equal(productSaveError(new Error('Reload this product.')), 'Reload this product.');
  }],
];
for (const [name, run] of tests) { run(); console.log('PASS ' + name); }
console.log(`${tests.length} image-change payload checks passed.`);
