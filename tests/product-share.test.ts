import { test } from 'node:test';
import assert from 'node:assert/strict';
import { productShare } from '../lib/product-share';

test('product sharing includes the store, public title and encoded product URL', () => {
  const share = productShare({ name: 'Sunday Sauce & Friends', slug: 'sundaysauce' }, { id: 'abc', title: 'Classic Dad Hat | Yupoong 6245CM' });
  assert.equal(share.title, 'Classic Dad Hat | Sunday Sauce & Friends');
  assert.ok(!share.caption.includes('Yupoong'));
  assert.ok(share.caption.includes(share.url));
  assert.equal(new URL(share.x).searchParams.get('text'), share.text);
  assert.equal(new URL(share.x).searchParams.get('url'), share.url);
  assert.equal(new URL(share.facebook).searchParams.get('u'), share.url);
  assert.equal(new URL(share.email).searchParams.get('subject'), share.title);
  assert.ok(new URL(share.email).searchParams.get('body')?.includes(share.url));
  assert.equal(share.instagramImage, `${share.url}/share-image?format=square`);
});
