const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

// Extract phraseToMoment function from built file
const code = fs.readFileSync('main.js', 'utf8');
const match = code.match(/function phraseToMoment\([^]*?\n\}/);
if (!match) {
  throw new Error('phraseToMoment not found');
}
const funcSrc = match[0];

// Minimal moment.js stub used by the plugin
const MONTHS = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};
class Moment {
  constructor(date) { this.d = new Date(date); }
  clone() { return new Moment(this.d); }
  add(n, unit) { if (unit === 'day') this.d.setDate(this.d.getDate() + n); if (unit === 'year') this.d.setFullYear(this.d.getFullYear() + n); return this; }
  subtract(n, unit) { if (unit === 'day') this.d.setDate(this.d.getDate() - n); if (unit === 'year') this.d.setFullYear(this.d.getFullYear() - n); return this; }
  weekday() { return this.d.getDay(); }
  month(name) { this.d.setMonth(MONTHS[name.toLowerCase()]); return this; }
  date(n) { this.d.setDate(n); return this; }
  isValid() { return !isNaN(this.d); }
  isBefore(other, unit) {
    if (unit === 'day') {
      const a = new Date(this.d.getFullYear(), this.d.getMonth(), this.d.getDate());
      const b = new Date(other.d.getFullYear(), other.d.getMonth(), other.d.getDate());
      return a < b;
    }
    return this.d < other.d;
  }
}
function moment(date) { return new Moment(date ?? moment.now); }
moment.now = new Date('2024-05-08');

const WEEKDAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

const context = { moment, WEEKDAYS };
vm.createContext(context);
vm.runInContext(funcSrc, context);
const phraseToMoment = context.phraseToMoment;
const fmt = m => m.d.toISOString().slice(0,10);

assert.strictEqual(fmt(phraseToMoment('today')), '2024-05-08');
assert.strictEqual(fmt(phraseToMoment('yesterday')), '2024-05-07');
assert.strictEqual(fmt(phraseToMoment('tomorrow')), '2024-05-09');
assert.strictEqual(fmt(phraseToMoment('next Monday')), '2024-05-13');
assert.strictEqual(fmt(phraseToMoment('last Friday')), '2024-05-03');
assert.strictEqual(phraseToMoment('last today'), null);

console.log('All tests passed');
