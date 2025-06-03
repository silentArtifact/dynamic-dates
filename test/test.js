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
  const helpersSrc = code.match(/function nthWeekdayOfMonth[^]*?function needsYearAlias[^]*?function isHolidayQualifier[^]*?\n\}/);
  if (!helpersSrc) throw new Error('helper functions not found');
  const helpersCode = helpersSrc[0].replace(/const DEFAULT_SETTINGS[^]*?};/, '');

  /* ------------------------------------------------------------------ */
  /* Minimal runtime stubs                                              */
  /* ------------------------------------------------------------------ */
  const MONTH_INDEX = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };
  const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
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
    month(name) { this.d.setMonth(MONTH_INDEX[name.toLowerCase()]); return this; }
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
      const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      if (fmt === 'MMMM Do') {
        const day = this.d.getDate();
        const suf = (day%10===1&&day!==11)?'st':(day%10===2&&day!==12)?'nd':(day%10===3&&day!==13)?'rd':'th';
        return months[this.d.getMonth()] + ' ' + day + suf;
      }
      if (fmt === 'MMMM Do, YYYY') {
        const day = this.d.getDate();
        const suf = (day%10===1&&day!==11)?'st':(day%10===2&&day!==12)?'nd':(day%10===3&&day!==13)?'rd':'th';
        return months[this.d.getMonth()] + ' ' + day + suf + ', ' + this.d.getFullYear();
      }
      if (fmt === 'HH:mm') {
        return this.d.toISOString().slice(11,16);
      }
      if (fmt === 'YYYY') {
        return String(this.d.getFullYear());
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

  const obsidian_1 = {
    moment,
    EditorSuggest,
    KeyboardEvent,
    Plugin,
    PluginSettingTab,
    Setting,
    normalizePath: p => p.replace(/\\/g, '/')
  };
  const context = { moment, WEEKDAYS, MONTHS, BASE_WORDS, EditorSuggest, KeyboardEvent, Plugin, PluginSettingTab, Setting, obsidian_1 };
  vm.createContext(context);
  vm.runInContext('this.MONTH_ABBR = this.MONTHS.map(m => m.slice(0,3));', context);
  vm.runInContext('this.expandMonthName = function(name){ const idx = this.MONTH_ABBR.indexOf(name.slice(0,3).toLowerCase()); return idx >= 0 ? this.MONTHS[idx] : name; };', context);
  vm.runInContext(helpersCode, context);
  vm.runInContext('this.HOLIDAY_PHRASES = HOLIDAY_PHRASES;', context);
  vm.runInContext('this.PHRASES = this.BASE_WORDS.flatMap(w => this.WEEKDAYS.includes(w) ? [w, "last " + w, "next " + w] : [w]).concat(this.HOLIDAY_PHRASES.flatMap(h => [h, "last " + h, "next " + h]));', context);
  vm.runInContext(funcSrc[0], context);
  vm.runInContext(settingsSrc[0], context);
  vm.runInContext('this.DDSuggest=' + classSrc[0], context);
  vm.runInContext('this.DynamicDates=' + pluginSrc[0], context);

  const PHRASES = context.PHRASES;

  const {
    phraseToMoment,
    DDSuggest,
    DynamicDates,
    nthWeekdayOfMonth,
    lastWeekdayOfMonth,
    weekdayOnOrBefore,
    easter,
    isProperNoun,
    properCase,
    formatWordPart,
    formatWord,
    needsYearAlias,
    isHolidayQualifier,
  } = context;
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
  assert.strictEqual(fmt(phraseToMoment('the tuesday previous')), '2024-05-07');
  assert.strictEqual(fmt(phraseToMoment('the monday before')), '2024-05-06');
  assert.strictEqual(fmt(phraseToMoment('first tuesday in july')), '2024-07-02');
  assert.strictEqual(fmt(phraseToMoment('second thursday of june')), '2024-06-13');
  assert.strictEqual(fmt(phraseToMoment('last friday of november')), '2024-11-29');
  assert.strictEqual(fmt(phraseToMoment('may 1, 2023')), '2023-05-01');
  assert.strictEqual(fmt(phraseToMoment('may 1st, 2023')), '2023-05-01');
  assert.strictEqual(fmt(phraseToMoment('may 1, 23')), '2023-05-01');
  assert.strictEqual(fmt(phraseToMoment('may 1st, 23')), '2023-05-01');
  assert.strictEqual(fmt(phraseToMoment('memorial day')), '2024-05-27');
  assert.strictEqual(fmt(phraseToMoment('labor day')), '2024-09-02');
  assert.strictEqual(fmt(phraseToMoment('thanksgiving')), '2024-11-28');
  assert.strictEqual(fmt(phraseToMoment('mlk day')), '2025-01-20');
  assert.strictEqual(fmt(phraseToMoment('martin luther king day')), '2025-01-20');
  assert.strictEqual(fmt(phraseToMoment("new year's day")), '2025-01-01');
  assert.strictEqual(fmt(phraseToMoment('last christmas')), '2023-12-25');
  assert.strictEqual(fmt(phraseToMoment('christmas 24')), '2024-12-25');
  assert.strictEqual(fmt(phraseToMoment('christmas of 2025')), '2025-12-25');
  assert.strictEqual(fmt(phraseToMoment("valentine's day")), '2025-02-14');
  assert.strictEqual(fmt(phraseToMoment('easter')), '2025-04-20');
  assert.strictEqual(fmt(phraseToMoment('victoria day')), '2024-05-20');
  assert.strictEqual(fmt(phraseToMoment('canada day')), '2024-07-01');
  assert.strictEqual(fmt(phraseToMoment('canadian thanksgiving')), '2024-10-14');
  assert.strictEqual(fmt(phraseToMoment('boxing day')), '2024-12-26');

  // holiday toggles
  phraseToMoment.holidayGroups = { 'US Federal Holidays': false };
  phraseToMoment.holidayOverrides = {};
  assert.strictEqual(phraseToMoment('memorial day'), null);

  phraseToMoment.holidayGroups = { 'US Federal Holidays': true };
  phraseToMoment.holidayOverrides = { 'memorial day': false };
  assert.strictEqual(phraseToMoment('memorial day'), null);

  phraseToMoment.holidayGroups = { 'US Federal Holidays': false };
  phraseToMoment.holidayOverrides = { 'memorial day': true };
  assert.strictEqual(fmt(phraseToMoment('memorial day')), '2024-05-27');
  phraseToMoment.holidayGroups = { 'US Federal Holidays': true };
  phraseToMoment.holidayOverrides = {};

  phraseToMoment.holidayGroups = { 'US Cultural Holidays': false };
  assert.strictEqual(phraseToMoment("valentine's day"), null);
  phraseToMoment.holidayGroups = { 'US Cultural Holidays': true };
  assert.strictEqual(fmt(phraseToMoment("valentine's day")), '2025-02-14');

  phraseToMoment.holidayGroups = { 'Christian Holidays': false };
  assert.strictEqual(phraseToMoment('easter'), null);
  phraseToMoment.holidayGroups = { 'Christian Holidays': true };
  assert.strictEqual(fmt(phraseToMoment('easter')), '2025-04-20');

  /* ------------------------------------------------------------------ */
  /* onTrigger guard rails                                             */
  /* ------------------------------------------------------------------ */
  const plugin = { settings: { dateFormat: 'YYYY-MM-DD', acceptKey:'Tab', noAliasWithShift: true }, dailyFolder:'', allPhrases: () => PHRASES, getDailyFolder(){ return this.dailyFolder; }, getDailySettings(){ return { folder:this.dailyFolder, template:'tpl.md', format:'YYYY-MM-DD' }; }, getDateFormat(){ return this.getDailySettings().format; }, customCanonical(){ return null; } };
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
  await sugg.selectSuggestion('2024-05-09', new KeyboardEvent({ shiftKey:false, key:'Tab' }));
  assert.strictEqual(inserted.pop(), '[[2024-05-09|tomorrow]]');

  sugg.context = { editor, start:{line:0,ch:0}, end:{line:0,ch:3}, query:'tom' };
  await sugg.selectSuggestion('2024-05-09', new KeyboardEvent({ shiftKey:true, key:'Tab' }));
  assert.strictEqual(inserted.pop(), '[[2024-05-09]]');

  // preserve typed casing for non-proper words
  sugg.context = { editor, start:{line:0,ch:0}, end:{line:0,ch:8}, query:'tomorrow' };
  await sugg.selectSuggestion('2024-05-09', new KeyboardEvent({ shiftKey:false, key:'Tab' }));
  assert.strictEqual(inserted.pop(), '[[2024-05-09|tomorrow]]');

  // ensure qualifiers remain lowercase
  sugg.context = { editor, start:{line:0,ch:0}, end:{line:0,ch:8}, query:'last thu' };
  await sugg.selectSuggestion('2024-05-02', new KeyboardEvent({ shiftKey:false, key:'Tab' }));
  assert.strictEqual(inserted.pop(), '[[2024-05-02|last Thursday]]');

  // preserve user capitalization of qualifiers
  sugg.context = { editor, start:{line:0,ch:0}, end:{line:0,ch:8}, query:'Last thu' };
  await sugg.selectSuggestion('2024-05-02', new KeyboardEvent({ shiftKey:false, key:'Tab' }));
  assert.strictEqual(inserted.pop(), '[[2024-05-02|Last Thursday]]');

  // month/day with qualifier should append year
  sugg.context = { editor, start:{line:0,ch:0}, end:{line:0,ch:11}, query:'last may 1' };
  await sugg.selectSuggestion('2024-05-01', new KeyboardEvent({ shiftKey:false, key:'Tab' }));
  assert.strictEqual(inserted.pop(), '[[2024-05-01|May 1st, 2024]]');

  // holiday with qualifier should keep phrase
  sugg.context = { editor, start:{line:0,ch:0}, end:{line:0,ch:14}, query:'last halloween' };
  await sugg.selectSuggestion('2023-10-31', new KeyboardEvent({ shiftKey:false, key:'Tab' }));
  assert.strictEqual(inserted.pop(), '[[2023-10-31|last Halloween]]');


  /* ------------------------------------------------------------------ */
  /* convertText utility                                               */
  /* ------------------------------------------------------------------ */
  const inst = new DynamicDates();
  const converted = inst.convertText('see you tomorrow');
  assert.strictEqual(converted, 'see you [[2024-05-09|tomorrow]]');


  /* ------------------------------------------------------------------ */
  /* linkForPhrase variations                                           */
  /* ------------------------------------------------------------------ */
  const lf = new DynamicDates();
  lf.settings = Object.assign({}, plugin.settings);
  lf.getDailyFolder = () => 'Journal';
  assert.strictEqual(lf.linkForPhrase('tomorrow'), '[[2024-05-09|tomorrow]]');
  assert.strictEqual(lf.linkForPhrase('last may 1'), '[[2024-05-01|last May 1]]');
  assert.strictEqual(lf.linkForPhrase('may 1, 2023'), '[[2023-05-01|May 1, 2023]]');
  assert.strictEqual(lf.linkForPhrase('may 1st, 23'), '[[2023-05-01|May 1st, 23]]');
  assert.strictEqual(lf.linkForPhrase('nonsense'), null);

  /* ------------------------------------------------------------------ */
  /* convertText edge cases                                             */
  /* ------------------------------------------------------------------ */
  lf.getDailyFolder = () => '';
  const multi = lf.convertText('today and Tomorrow and next Monday');
  assert.strictEqual(multi,
    '[[2024-05-08|today]] and [[2024-05-09|Tomorrow]] and [[2024-05-13|next [[2024-05-13|Monday]]]]');
  const noReplace = lf.convertText('see you tomorrowland');
  assert.strictEqual(noReplace, 'see you tomorrowland');
  const partial = lf.convertText('nottoday tomorrow');
  assert.strictEqual(partial, 'nottoday [[2024-05-09|tomorrow]]');

  const fenced = lf.convertText('before\n```js\ncode tomorrow\n```\nafter tomorrow');
  assert.strictEqual(fenced,
    'before\n```js\ncode tomorrow\n```\nafter [[2024-05-09|tomorrow]]');

  const inline = lf.convertText('This `code tomorrow` stays and tomorrow changes');
  assert.strictEqual(inline,
    'This `code tomorrow` stays and [[2024-05-09|tomorrow]] changes');

  const linked = lf.convertText('already [[tomorrow]] here, but tomorrow also');
  assert.strictEqual(linked,
    'already [[tomorrow]] here, but [[2024-05-09|tomorrow]] also');

  /* ------------------------------------------------------------------ */
  /* onTrigger context guards                                           */
  /* ------------------------------------------------------------------ */
  const tPlugin = { settings: Object.assign({}, plugin.settings), dailyFolder:'Daily', allPhrases: () => PHRASES, getDailyFolder(){ return this.dailyFolder; }, getDailySettings(){ return { folder:this.dailyFolder, template:'tpl.md', format:'YYYY-MM-DD' }; }, getDateFormat(){ return this.getDailySettings().format; }, customCanonical(){ return null; } };
  const tApp = { vault:{}, workspace:{} };
  const tSugg = new DDSuggest(tApp, tPlugin);

  // within fenced code block
  const fenceLines = ['```', 'tom'];
  assert.strictEqual(tSugg.onTrigger(
    { line:1, ch:3 },
    { getLine:(i)=>fenceLines[i] },
    null
  ), null);

  // within inline code
  assert.strictEqual(tSugg.onTrigger(
    { line:0, ch:11 },
    { getLine:()=> 'prefix `tom' },
    null
  ), null);

  // within wikilink
  assert.strictEqual(tSugg.onTrigger(
    { line:0, ch:12 },
    { getLine:()=> 'prefix [[tom' },
    null
  ), null);

  /* ------------------------------------------------------------------ */
  /* onTrigger additional guard rails                                   */
  /* ------------------------------------------------------------------ */
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
  await tSugg.selectSuggestion('2024-05-09', new KeyboardEvent({ key:'Tab', shiftKey:false }));
  assert.strictEqual(inserted2.length, 0);
  const ev1 = new KeyboardEvent({ key:'Enter', shiftKey:false });
  let called1 = false;
  ev1.preventDefault = () => { called1 = true; };
  await tSugg.selectSuggestion('2024-05-09', ev1);
  assert.ok(called1);
  assert.strictEqual(inserted2.pop(), '[[2024-05-09|tomorrow]]');

  const ev2 = new KeyboardEvent({ key:'Enter', shiftKey:true });
  let called2 = false;
  ev2.preventDefault = () => { called2 = true; };
  tSugg.context = { editor: { replaceRange:(t)=>inserted2.push(t), getLine:()=>'' }, start:{line:0,ch:0}, end:{line:0,ch:3}, query:'tom' };
  await tSugg.selectSuggestion('2024-05-09', ev2);
  assert.ok(called2);
  assert.strictEqual(inserted2.pop(), '[[2024-05-09]]');

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
  /* customCanonical cache behaviour                                    */
  /* ------------------------------------------------------------------ */
  const cachePlugin = new DynamicDates();
  cachePlugin.loadData = async () => ({ customDates: { 'Leap Day': '02-29' } });
  cachePlugin.saveData = async () => {};
  await cachePlugin.loadSettings();
  assert.strictEqual(cachePlugin.customMap['leap day'], 'Leap Day');
  assert.strictEqual(cachePlugin.customCanonical('leap day'), 'Leap Day');
  cachePlugin.settings.customDates['Quarter End'] = '09-30';
  // customMap not refreshed yet so lookup should fail
  assert.strictEqual(cachePlugin.customCanonical('quarter end'), null);
  await cachePlugin.saveSettings();
  assert.strictEqual(cachePlugin.customCanonical('quarter end'), 'Quarter End');

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
  assert.strictEqual(converted2, 'see you [[2024-08-22|fall start]]');

  cPlugin.settings.customDates['Big Event'] = '02-03';
  phraseToMoment.customDates = Object.fromEntries(Object.entries(cPlugin.settings.customDates).map(([k,v])=>[k.toLowerCase(),v]));
  const converted3 = cPlugin.convertText('the Big Event is soon');
  assert.strictEqual(converted3, 'the [[2025-02-03|Big Event]] is soon');

  // multi-word custom phrase detection via onTrigger
  phraseToMoment.customDates = { 'start of the new semester': '08-22' };
  const p2 = new DynamicDates();
  p2.settings = Object.assign({}, plugin.settings, {
    customDates: { 'start of the new semester': '08-22' }
  });
  const s2 = new DDSuggest({ vault:{}, workspace:{} }, p2);
  const trig = s2.onTrigger(
    { line:0, ch:25 },
    { getLine:()=> 'start of the new semester' },
    null
  );
  assert.ok(trig && trig.start.ch === 0);

  const hPlugin = new DynamicDates();
  hPlugin.settings = Object.assign({}, plugin.settings, {
    holidayGroups: { 'US Federal Holidays': true },
    holidayOverrides: { 'martin luther king jr day': false }
  });
  hPlugin.refreshHolidayMap();
  assert.ok(!hPlugin.allPhrases().includes('mlk day'));
  hPlugin.settings.holidayOverrides['martin luther king jr day'] = true;
  hPlugin.refreshHolidayMap();
  assert.ok(hPlugin.allPhrases().includes('mlk day'));


  /* ------------------------------------------------------------------ */
  /* helper functions                                                   */
  /* ------------------------------------------------------------------ */

  assert.strictEqual(fmt(nthWeekdayOfMonth(2024, 0, 1, 3)), '2024-01-15');
  assert.strictEqual(fmt(lastWeekdayOfMonth(2024, 4, 1)), '2024-05-27');
  assert.strictEqual(fmt(weekdayOnOrBefore(2024, 4, 24, 1)), '2024-05-20');
  assert.strictEqual(fmt(easter(2024)), '2024-03-31');
  assert.strictEqual(fmt(easter(2025)), '2025-04-20');

  assert.strictEqual(isProperNoun('monday'), true);
  assert.strictEqual(isProperNoun('the'), false);
  assert.strictEqual(isProperNoun('thanksgiving'), true);
  assert.strictEqual(isProperNoun('holiday'), false);
  assert.strictEqual(properCase('chinese-new-year'), 'Chinese-New-Year');

  assert.strictEqual(formatWordPart('monday', 'Mo'), 'Monday');
  assert.strictEqual(formatWordPart('the', 'Th'), 'th');
  assert.strictEqual(formatWord('boxing-day', 'box'), 'Boxing-Day');

  assert.strictEqual(needsYearAlias('last may 1'), true);
  assert.strictEqual(needsYearAlias('may 1, 2024'), true);
  assert.strictEqual(needsYearAlias('today'), false);

  assert.strictEqual(isHolidayQualifier('last thanksgiving'), true);
  assert.strictEqual(isHolidayQualifier('next random'), false);

  console.log('All tests passed');
})();
