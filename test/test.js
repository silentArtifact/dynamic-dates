(async () => {
  const assert = require('assert');
  const fs = require('fs');
  const vm = require('vm');

  const code = fs.readFileSync('main.js', 'utf8');
  const funcSrc = code.match(/function phraseToMoment\([^]*?\n\}/);
  if (!funcSrc) throw new Error('phraseToMoment not found');
  const classSrc = code.match(/class DDSuggest[^]*?\n\}/);
  if (!classSrc) throw new Error('DDSuggest class not found');

  /* ------------------------------------------------------------------ */
  /* Minimal runtime stubs                                              */
  /* ------------------------------------------------------------------ */
  const MONTHS = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };
  class Moment {
    constructor(date) { this.d = new Date(date); this._setDay = null; }
    clone() { const m = new Moment(this.d); m._setDay = this._setDay; return m; }
    add(n, unit) { if (unit === 'day') this.d.setDate(this.d.getDate() + n); if (unit === 'year') this.d.setFullYear(this.d.getFullYear() + n); return this; }
    subtract(n, unit) { if (unit === 'day') this.d.setDate(this.d.getDate() - n); if (unit === 'year') this.d.setFullYear(this.d.getFullYear() - n); return this; }
    weekday() { return this.d.getDay(); }
    month(name) { this.d.setMonth(MONTHS[name.toLowerCase()]); return this; }
    date(n) { this._setDay = n; this.d.setDate(n); return this; }
    isValid() { return !isNaN(this.d) && (this._setDay == null || this.d.getDate() === this._setDay); }
    isBefore(other, unit) {
      if (unit === 'day') {
        const a = new Date(this.d.getFullYear(), this.d.getMonth(), this.d.getDate());
        const b = new Date(other.d.getFullYear(), other.d.getMonth(), other.d.getDate());
        return a < b;
      }
      return this.d < other.d;
    }
    format(fmt) { if (fmt === 'YYYY-MM-DD') return this.d.toISOString().slice(0,10); return this.d.toISOString(); }
  }
  function moment(date) { return new Moment(date ?? moment.now); }
  moment.now = new Date('2024-05-08');

  class EditorSuggest { constructor(app) { this.app = app; this.context = null; } close() { this.closed = true; } }
  class KeyboardEvent { constructor(init) { Object.assign(this, init); } }

  const WEEKDAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const BASE_WORDS = ['today','yesterday','tomorrow', ...WEEKDAYS];
  const PHRASES = BASE_WORDS.flatMap(w => WEEKDAYS.includes(w) ? [w, `last ${w}`, `next ${w}`] : [w]);

  const context = { moment, WEEKDAYS, BASE_WORDS, PHRASES, EditorSuggest, KeyboardEvent };
  vm.createContext(context);
  vm.runInContext(funcSrc[0], context);
  vm.runInContext('this.DDSuggest=' + classSrc[0], context);

  const { phraseToMoment, DDSuggest } = context;
  const fmt = m => m.d.toISOString().slice(0,10);

  /* ------------------------------------------------------------------ */
  /* phraseToMoment cases                                               */
  /* ------------------------------------------------------------------ */
  assert.strictEqual(fmt(phraseToMoment('today')), '2024-05-08');
  assert.strictEqual(fmt(phraseToMoment('yesterday')), '2024-05-07');
  assert.strictEqual(fmt(phraseToMoment('tomorrow')), '2024-05-09');
  assert.strictEqual(fmt(phraseToMoment('next Monday')), '2024-05-13');
  assert.strictEqual(fmt(phraseToMoment('last Friday')), '2024-05-03');
  assert.strictEqual(phraseToMoment('last today'), null);

  // additional phrases
  assert.strictEqual(fmt(phraseToMoment('monday')), '2024-05-13');
  assert.strictEqual(fmt(phraseToMoment('friday')), '2024-05-10');
  assert.strictEqual(fmt(phraseToMoment('december 25')), '2024-12-25');
  assert.strictEqual(fmt(phraseToMoment('january 1')), '2025-01-01');
  assert.strictEqual(fmt(phraseToMoment('august 20th')), '2024-08-20');
  assert.strictEqual(phraseToMoment('february 30'), null);

  /* ------------------------------------------------------------------ */
  /* onTrigger guard rails                                             */
  /* ------------------------------------------------------------------ */
  const plugin = { settings: { dateFormat: 'YYYY-MM-DD', dailyFolder: '', autoCreate: false, keepAliasWithShift: true } };
  const app = { vault: {} };
  const sugg = new DDSuggest(app, plugin);

  assert.strictEqual(sugg.onTrigger({line:0,ch:2}, { getLine:()=>'ne' }, null), null);
  assert.ok(sugg.onTrigger({line:0,ch:3}, { getLine:()=>'tom' }, null));

  /* ------------------------------------------------------------------ */
  /* selectSuggestion link/alias behaviour                              */
  /* ------------------------------------------------------------------ */
  const inserted = [];
  const editor = { getLine:()=>'', replaceRange:(t)=>inserted.push(t) };
  sugg.context = { editor, start:{line:0,ch:0}, end:{line:0,ch:3}, query:'tom' };
  sugg.selectSuggestion('2024-05-09', new KeyboardEvent({ shiftKey:false }));
  assert.strictEqual(inserted.pop(), '[[2024-05-09|Tomorrow]]');

  sugg.context = { editor, start:{line:0,ch:0}, end:{line:0,ch:3}, query:'tom' };
  sugg.selectSuggestion('2024-05-09', new KeyboardEvent({ shiftKey:true }));
  assert.strictEqual(inserted.pop(), 'tom [[2024-05-09|Tomorrow]]');

  /* ------------------------------------------------------------------ */
  /* auto-create daily note                                            */
  /* ------------------------------------------------------------------ */
  plugin.settings.autoCreate = true;
  plugin.settings.dailyFolder = 'Daily';
  const calls = [];
  app.vault = {
    getAbstractFileByPath: (p) => { calls.push(['check', p]); return null; },
    createFolder: (p) => { calls.push(['mkdir', p]); return { then: r => r() }; },
    create: (p) => { calls.push(['create', p]); return { then: r => r() }; },
  };
  const ed2 = { getLine:()=>'', replaceRange:(t)=>calls.push(['insert', t]) };
  sugg.app = app;
  sugg.plugin = plugin;
  sugg.context = { editor: ed2, start:{line:0,ch:0}, end:{line:0,ch:8}, query:'tomorrow' };
  sugg.selectSuggestion('2024-05-09', new KeyboardEvent({ shiftKey:false }));
  await new Promise(r => setTimeout(r, 0));
  assert.deepStrictEqual(calls, [
    ['insert', '[[Daily/2024-05-09|Tomorrow]]'],
    ['check', 'Daily/2024-05-09.md'],
    ['check', 'Daily'],
    ['mkdir', 'Daily'],
    ['create', 'Daily/2024-05-09.md'],
  ]);

  console.log('All tests passed');
})();
