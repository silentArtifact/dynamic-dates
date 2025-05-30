(async () => {
  const assert = require('assert');
  const fs = require('fs');
  const vm = require('vm');

  const code = fs.readFileSync('main.js', 'utf8');
  const funcSrc = code.match(/function phraseToMoment\([^]*?\n\}/);
  if (!funcSrc) throw new Error('phraseToMoment not found');
  const classSrc = code.match(/class DDSuggest[^]*?\n\}/);
  if (!classSrc) throw new Error('DDSuggest class not found');
  const pluginSrc = code.match(/class DynamicDates[^]*?\n\}/);
  if (!pluginSrc) throw new Error('DynamicDates class not found');
  const settingsSrc = code.match(/const DEFAULT_SETTINGS =[^]*?};/);
  if (!settingsSrc) throw new Error('DEFAULT_SETTINGS not found');

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
    add(n, unit) {
      if (unit === 'day') this.d.setDate(this.d.getDate() + n);
      if (unit === 'year') this.d.setFullYear(this.d.getFullYear() + n);
      if (unit === 'month') this.d.setMonth(this.d.getMonth() + n);
      return this;
    }
    subtract(n, unit) {
      if (unit === 'day') this.d.setDate(this.d.getDate() - n);
      if (unit === 'year') this.d.setFullYear(this.d.getFullYear() - n);
      if (unit === 'month') this.d.setMonth(this.d.getMonth() - n);
      return this;
    }
    year(y) { if (y == null) return this.d.getFullYear(); this.d.setFullYear(y); return this; }
    weekday() { return this.d.getDay(); }
    month(name) { this.d.setMonth(MONTHS[name.toLowerCase()]); return this; }
    date(n) { if (n == null) return this.d.getDate(); this._setDay = n; this.d.setDate(n); return this; }
    isValid() { return !isNaN(this.d) && (this._setDay == null || this.d.getDate() === this._setDay); }
    isBefore(other, unit) {
      if (unit === 'day') {
        const a = new Date(this.d.getFullYear(), this.d.getMonth(), this.d.getDate());
        const b = new Date(other.d.getFullYear(), other.d.getMonth(), other.d.getDate());
        return a < b;
      }
      return this.d < other.d;
    }
    format(fmt) {
      if (fmt === 'YYYY-MM-DD') return this.d.toISOString().slice(0,10);
      if (fmt === 'MMMM Do') {
        const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const day = this.d.getDate();
        const suf = (day%10===1&&day!==11)?'st':(day%10===2&&day!==12)?'nd':(day%10===3&&day!==13)?'rd':'th';
        return months[this.d.getMonth()] + ' ' + day + suf;
      }
      return this.d.toISOString();
    }
  }
  function moment(date) { return new Moment(date ?? moment.now); }
  moment.now = new Date('2024-05-08');

  class EditorSuggest { constructor(app) { this.app = app; this.context = null; } close() { this.closed = true; } }
  class KeyboardEvent { constructor(init) { Object.assign(this, init); } }
  class Plugin { constructor() { this.app = { vault:{}, workspace:{} }; } }
  class PluginSettingTab {}
  class Setting {
    setName(){ return this; }
    setDesc(){ return this; }
    addText(){ return this; }
    addToggle(){ return this; }
    addDropdown(){ return this; }
    addButton(){ return this; }
    addExtraButton(){ return this; }
  }

  const WEEKDAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const BASE_WORDS = ['today','yesterday','tomorrow', ...WEEKDAYS];
  const PHRASES = BASE_WORDS.flatMap(w => WEEKDAYS.includes(w) ? [w, `last ${w}`, `next ${w}`] : [w]);

  const obsidian_1 = { moment, EditorSuggest, KeyboardEvent, Plugin, PluginSettingTab, Setting };
  const context = { moment, WEEKDAYS, BASE_WORDS, PHRASES, EditorSuggest, KeyboardEvent, Plugin, PluginSettingTab, Setting, obsidian_1 };
  vm.createContext(context);
  vm.runInContext(funcSrc[0], context);
  vm.runInContext(settingsSrc[0], context);
  vm.runInContext('this.DDSuggest=' + classSrc[0], context);
  vm.runInContext('this.DynamicDates=' + pluginSrc[0], context);

  const { phraseToMoment, DDSuggest, DynamicDates } = context;
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
  assert.strictEqual(fmt(phraseToMoment('in 3 days')), '2024-05-11');
  assert.strictEqual(fmt(phraseToMoment('3 days ago')), '2024-05-05');
  assert.strictEqual(fmt(phraseToMoment('jan 1')), '2025-01-01');
  assert.strictEqual(fmt(phraseToMoment('last may 1')), '2024-05-01');
  assert.strictEqual(fmt(phraseToMoment('the 24th')), '2024-05-24');

  /* ------------------------------------------------------------------ */
  /* onTrigger guard rails                                             */
  /* ------------------------------------------------------------------ */
  const plugin = { settings: { dateFormat: 'YYYY-MM-DD', autoCreate: false, acceptKey:'Tab', noAliasWithShift: true, aliasFormat:'capitalize', openOnCreate:false }, dailyFolder:'', allPhrases: () => PHRASES, getDailyFolder(){ return this.dailyFolder; } };
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
  sugg.selectSuggestion('2024-05-09', new KeyboardEvent({ shiftKey:false, key:'Tab' }));
  assert.strictEqual(inserted.pop(), '[[2024-05-09|Tomorrow]]');

  sugg.context = { editor, start:{line:0,ch:0}, end:{line:0,ch:3}, query:'tom' };
  sugg.selectSuggestion('2024-05-09', new KeyboardEvent({ shiftKey:true, key:'Tab' }));
  assert.strictEqual(inserted.pop(), '[[2024-05-09]]');

  plugin.settings.aliasFormat = 'keep';
  sugg.context = { editor, start:{line:0,ch:0}, end:{line:0,ch:3}, query:'tom' };
  sugg.selectSuggestion('2024-05-09', new KeyboardEvent({ shiftKey:false, key:'Tab' }));
  assert.strictEqual(inserted.pop(), '[[2024-05-09|tom]]');

  plugin.settings.aliasFormat = 'date';
  sugg.context = { editor, start:{line:0,ch:0}, end:{line:0,ch:3}, query:'tom' };
  sugg.selectSuggestion('2024-05-09', new KeyboardEvent({ shiftKey:false, key:'Tab' }));
  assert.strictEqual(inserted.pop(), '[[2024-05-09|May 9th]]');

  plugin.settings.aliasFormat = 'capitalize';

  // ensure qualifiers remain lowercase
  sugg.context = { editor, start:{line:0,ch:0}, end:{line:0,ch:8}, query:'last thu' };
  sugg.selectSuggestion('2024-05-02', new KeyboardEvent({ shiftKey:false, key:'Tab' }));
  assert.strictEqual(inserted.pop(), '[[2024-05-02|last Thursday]]');

  // preserve user capitalization of qualifiers
  sugg.context = { editor, start:{line:0,ch:0}, end:{line:0,ch:8}, query:'Last thu' };
  sugg.selectSuggestion('2024-05-02', new KeyboardEvent({ shiftKey:false, key:'Tab' }));
  assert.strictEqual(inserted.pop(), '[[2024-05-02|Last Thursday]]');

  /* ------------------------------------------------------------------ */
  /* auto-create daily note                                            */
  /* ------------------------------------------------------------------ */
  plugin.settings.autoCreate = true;
  plugin.dailyFolder = 'Daily';
  plugin.settings.openOnCreate = true;
  const calls = [];
  app.vault = {
    getAbstractFileByPath: (p) => {
      calls.push(['check', p]);
      if (p === 'tpl.md') return { path: p };
      return null;
    },
    read: (f) => { calls.push(['read', f.path]); return '# hello'; },
    createFolder: (p) => { calls.push(['mkdir', p]); return { then: r => r() }; },
    create: (p, d) => { calls.push(['create', p, d]); return { then: r => r() }; },
  };
  app.internalPlugins = { plugins: { 'daily-notes': { instance: { options: { template: 'tpl.md' } } } } };
  app.workspace = { openLinkText:(p)=>calls.push(['open', p]) };
  const ed2 = { getLine:()=>'', replaceRange:(t)=>calls.push(['insert', t]) };
  sugg.app = app;
  sugg.plugin = plugin;
  sugg.context = { editor: ed2, start:{line:0,ch:0}, end:{line:0,ch:8}, query:'tomorrow' };
  sugg.selectSuggestion('2024-05-09', new KeyboardEvent({ shiftKey:false, key:'Tab' }));
  await new Promise(r => setTimeout(r, 0));
  assert.deepStrictEqual(calls, [
    ['insert', '[[Daily/2024-05-09|Tomorrow]]'],
    ['check', 'Daily/2024-05-09.md'],
    ['check', 'Daily'],
    ['mkdir', 'Daily'],
    ['check', 'tpl.md'],
    ['read', 'tpl.md'],
    ['create', 'Daily/2024-05-09.md', '# hello'],
    ['open', 'Daily/2024-05-09.md'],
  ]);

  /* ------------------------------------------------------------------ */
  /* convertText utility                                               */
  /* ------------------------------------------------------------------ */
  const inst = new DynamicDates();
  inst.settings = Object.assign({}, plugin.settings, { aliasFormat: 'date' });
  const converted = inst.convertText('see you tomorrow');
  assert.strictEqual(converted, 'see you [[2024-05-09|May 9th]]');


  /* ------------------------------------------------------------------ */
  /* linkForPhrase variations                                           */
  /* ------------------------------------------------------------------ */
  const lf = new DynamicDates();
  lf.settings = Object.assign({}, plugin.settings);
  lf.getDailyFolder = () => 'Journal';
  assert.strictEqual(lf.linkForPhrase('tomorrow'), '[[Journal/2024-05-09|Tomorrow]]');
  lf.settings.aliasFormat = 'keep';
  assert.strictEqual(lf.linkForPhrase('tomorrow'), '[[Journal/2024-05-09|tomorrow]]');
  lf.settings.aliasFormat = 'date';
  assert.strictEqual(lf.linkForPhrase('tomorrow'), '[[Journal/2024-05-09|May 9th]]');
  assert.strictEqual(lf.linkForPhrase('nonsense'), null);

  /* ------------------------------------------------------------------ */
  /* convertText edge cases                                             */
  /* ------------------------------------------------------------------ */
  lf.getDailyFolder = () => '';
  const multi = lf.convertText('today and Tomorrow and next Monday');
  assert.strictEqual(multi,
    '[[2024-05-08|May 8th]] and [[2024-05-09|May 9th]] and [[2024-05-13|May 13th]]');
  const noReplace = lf.convertText('see you tomorrowland');
  assert.strictEqual(noReplace, 'see you tomorrowland');
  const partial = lf.convertText('nottoday tomorrow');
  assert.strictEqual(partial, 'nottoday [[2024-05-09|May 9th]]');

  /* ------------------------------------------------------------------ */
  /* onTrigger additional guard rails                                   */
  /* ------------------------------------------------------------------ */
  const tPlugin = { settings: Object.assign({}, plugin.settings, { autoCreate: false }), dailyFolder:'Daily', allPhrases: () => PHRASES, getDailyFolder(){ return this.dailyFolder; } };
  const tApp = { vault:{}, workspace:{} };
  const tSugg = new DDSuggest(tApp, tPlugin);
  assert.strictEqual(tSugg.onTrigger({line:0,ch:4}, { getLine:()=> 'next' }, null), null);
  assert.ok(tSugg.onTrigger({line:0,ch:11}, { getLine:()=> 'next friday' }, null));

  /* ------------------------------------------------------------------ */
  /* getSuggestions and acceptKey behaviour                             */
  /* ------------------------------------------------------------------ */
  const suggs = tSugg.getSuggestions({ query: 'tom' });
  assert.deepStrictEqual(Array.from(suggs), ['2024-05-09']);
  tPlugin.settings.acceptKey = 'Enter';
  const inserted2 = [];
  tSugg.context = { editor: { replaceRange:(t)=>inserted2.push(t), getLine:()=>'' }, start:{line:0,ch:0}, end:{line:0,ch:3}, query:'tom' };
  tSugg.selectSuggestion('2024-05-09', new KeyboardEvent({ key:'Tab', shiftKey:false }));
  assert.strictEqual(inserted2.length, 0);
  const ev1 = new KeyboardEvent({ key:'Enter', shiftKey:false });
  let called1 = false;
  ev1.preventDefault = () => { called1 = true; };
  tSugg.selectSuggestion('2024-05-09', ev1);
  assert.ok(called1);
  assert.strictEqual(inserted2.pop(), '[[Daily/2024-05-09|Tomorrow]]');

  const ev2 = new KeyboardEvent({ key:'Enter', shiftKey:true });
  let called2 = false;
  ev2.preventDefault = () => { called2 = true; };
  tSugg.context = { editor: { replaceRange:(t)=>inserted2.push(t), getLine:()=>'' }, start:{line:0,ch:0}, end:{line:0,ch:3}, query:'tom' };
  tSugg.selectSuggestion('2024-05-09', ev2);
  assert.ok(called2);
  assert.strictEqual(inserted2.pop(), '[[Daily/2024-05-09]]');

  /* ------------------------------------------------------------------ */
  /* load and save custom dates                                         */
  /* ------------------------------------------------------------------ */
  const lsPlugin = new DynamicDates();
  let saved = null;
  lsPlugin.loadData = async () => ({ customDates: { 'Mid Year': '06-01' } });
  lsPlugin.saveData = async (d) => { saved = d; };
  await lsPlugin.loadSettings();
  assert.ok(lsPlugin.allPhrases().includes('mid year'));
  assert.strictEqual(fmt(phraseToMoment('mid year')), '2024-06-01');
  lsPlugin.settings.customDates['Quarter End'] = '09-30';
  await lsPlugin.saveSettings();
  assert.strictEqual(saved.customDates['Quarter End'], '09-30');
  assert.strictEqual(fmt(phraseToMoment('quarter end')), '2024-09-30');

  /* ------------------------------------------------------------------ */
  /* custom dates feature                                               */
  /* ------------------------------------------------------------------ */
  phraseToMoment.customDates = { 'fall start': '08-22' };
  assert.strictEqual(fmt(phraseToMoment('fall start')), '2024-08-22');
  moment.now = new Date('2024-09-30');
  assert.strictEqual(fmt(phraseToMoment('fall start')), '2025-08-22');
  moment.now = new Date('2024-05-08');
  const cPlugin = new DynamicDates();
  cPlugin.settings = Object.assign({}, plugin.settings, { customDates: { 'fall start':'08-22' } });
  phraseToMoment.customDates = { 'fall start':'08-22' };
  const cSugg = new DDSuggest({ vault:{}, workspace:{} }, cPlugin);
  const list = cSugg.getSuggestions({ query:'fall st' });
  assert.ok(list.includes('2024-08-22'));
  const converted2 = cPlugin.convertText('see you fall start');
  assert.strictEqual(converted2, 'see you [[2024-08-22|Fall Start]]');

  console.log('All tests passed');
})();
