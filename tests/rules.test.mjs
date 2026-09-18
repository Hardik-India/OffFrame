import test from 'node:test';
import assert from 'node:assert/strict';
import { eventState, profileSchema, escapeXml } from '../lib/rules.mjs';
const config = { opensAt: '2026-09-19T13:00:00+05:30', closesAt: '2026-09-19T13:45:00+05:30' };
test('submission window includes opening and excludes closing, across IST/UTC', () => {
  assert.equal(eventState(config, new Date('2026-09-19T07:29:59.999Z')), 'upcoming');
  assert.equal(eventState(config, new Date('2026-09-19T07:30:00Z')), 'open');
  assert.equal(eventState(config, new Date('2026-09-19T08:14:59.999Z')), 'open');
  assert.equal(eventState(config, new Date('2026-09-19T08:15:00Z')), 'closed');
});
test('absent, reversed and invalid schedules fail closed', () => {
  for(const value of [null, {}, { opensAt:'bad', closesAt:'bad' }, { opensAt:config.closesAt, closesAt:config.opensAt }]) assert.equal(eventState(value), 'unconfigured');
});
test('normalize email and enforce bcrypt byte limit, including Unicode', () => {
  const profile = { email:'  STUDENT@EXAMPLE.COM ', name:'A Student', college:'Test College', branch:'CSE', year:'2nd Year', password:'Example123!' };
  assert.equal(profileSchema.parse(profile).email, 'student@example.com');
  assert.equal(profileSchema.safeParse({...profile,password:'é'.repeat(37)}).success, false);
  assert.equal(profileSchema.safeParse({...profile,email:'invalid'}).success, false);
});
test('ID card strings cannot inject SVG markup', () => { assert.equal(escapeXml('<script>"A&B"</script>'), '&lt;script&gt;&quot;A&amp;B&quot;&lt;/script&gt;'); });
