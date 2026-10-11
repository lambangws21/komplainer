import test from 'node:test';
import assert from 'node:assert/strict';
import { announcementSettings, canReceiveAnnouncement, visibleAnnouncements } from '../src/lib/announcement-policy.mjs';
const admin = { id: 'admin-1', role: 'admin' };
const pic = { id: 'pic-1', role: 'petugas' };
const reporter = { id: 'reporter-1', role: 'pelapor' };
const now = Date.parse('2026-10-09T00:00:00Z');
const base = { active: true, createdAt: '2026-10-08T00:00:00Z' };

test('legacy announcements stay visible to all authenticated roles', () => {
  for (const user of [admin, pic, reporter]) assert.equal(canReceiveAnnouncement(base, user), true);
  assert.equal(canReceiveAnnouncement(base, null), false);
  assert.deepEqual(announcementSettings({}), { audience: 'all', priority: 'info', recipientIds: [] });
});
test('role targeting excludes other roles including admin notice view', () => {
  for (const target of [admin, pic, reporter]) {
    for (const viewer of [admin, pic, reporter]) assert.equal(canReceiveAnnouncement({ audience: target.role }, viewer), viewer.role === target.role);
  }
  assert.equal(canReceiveAnnouncement({ audience: 'invalid' }, reporter), false);
});
test('personal announcements are visible only to explicit recipients', () => {
  const item = { audience: 'users', recipientIds: [pic.id] };
  assert.equal(canReceiveAnnouncement(item, pic), true);
  assert.equal(canReceiveAnnouncement(item, admin), false);
  assert.equal(canReceiveAnnouncement(item, reporter), false);
  assert.equal(canReceiveAnnouncement({ audience: 'users' }, pic), false);
});
test('recipient selection rejects empty, malformed, and excessive lists', () => {
  for (const recipientIds of [[], null, 'pic-1', [''], ['  '], [123], Array(101).fill(pic.id)]) assert.throws(() => announcementSettings({ audience: 'users', recipientIds }));
  assert.throws(() => announcementSettings({ audience: 'unknown' }));
  assert.throws(() => announcementSettings({ priority: 'unknown' }));
  assert.deepEqual(announcementSettings({ audience: 'users', recipientIds: [pic.id, pic.id], priority: 'important' }).recipientIds, [pic.id]);
  assert.deepEqual(announcementSettings({ audience: 'all', recipientIds: [pic.id] }).recipientIds, []);
});
test('expiry, inactive and dismissal filtering stays independent per account', () => {
  const items = [
    { ...base, id: 'read', dismissedBy: [pic.id] },
    { ...base, id: 'inactive', active: false },
    { ...base, id: 'expired', expiresAt: new Date(now).toISOString() },
    { ...base, id: 'malformed-expiry', expiresAt: 'invalid' },
    { ...base, id: 'personal', audience: 'users', recipientIds: [pic.id] },
  ];
  assert.deepEqual(visibleAnnouncements(items, { forUser: pic, now }).map((item) => item.id), ['personal']);
  assert.deepEqual(visibleAnnouncements(items, { forUser: reporter, now }).map((item) => item.id), ['read']);
  assert.equal(visibleAnnouncements(items, { onlyActive: false, now }).length, 5);
  const personal = visibleAnnouncements(items, { forUser: pic, now })[0];
  assert.equal('recipientIds' in personal, false);
  assert.equal('dismissedBy' in personal, false);
  assert.equal(items[4].recipientIds[0], pic.id);
});
test('important announcements appear before newer general information', () => {
  const items = [{ ...base, id: 'new', createdAt: '2026-10-09T00:00:00Z' }, { ...base, id: 'important', priority: 'important' }];
  assert.deepEqual(visibleAnnouncements(items, { forUser: pic, now }).map((item) => item.id), ['important', 'new']);
});
