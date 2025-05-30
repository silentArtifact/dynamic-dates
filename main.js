"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => DynamicDates
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  dateFormat: "YYYY-MM-DD",
  dailyFolder: "",
  autoCreate: false,
  keepAliasWithShift: true
};
var BASE_WORDS = [
  "today",
  "yesterday",
  "tomorrow",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
];
var PHRASES = BASE_WORDS.flatMap((w) => [w, `last ${w}`, `next ${w}`]);
function phraseToMoment(phrase) {
  const now = (0, import_obsidian.moment)();
  const lower = phrase.toLowerCase();
  if (lower === "today") return now;
  if (lower === "yesterday") return now.clone().subtract(1, "day");
  if (lower === "tomorrow") return now.clone().add(1, "day");
  const weekdays = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday"
  ];
  for (let i = 0; i < 7; i++) {
    const name = weekdays[i];
    if (lower === name) {
      const diff = (i - now.weekday() + 7) % 7;
      return now.clone().add(diff, "day");
    }
    if (lower === `next ${name}`) {
      const diff = (i - now.weekday() + 7) % 7 || 7;
      return now.clone().add(diff, "day");
    }
    if (lower === `last ${name}`) {
      const diff = (now.weekday() - i + 7) % 7 || 7;
      return now.clone().subtract(diff, "day");
    }
  }
  return null;
}
var DDSuggest = class extends import_obsidian.EditorSuggest {
  constructor(app, plugin) {
    super(app);
    __publicField(this, "plugin");
    this.plugin = plugin;
  }
  onTrigger(cursor, editor, _file) {
    const lineBefore = editor.getLine(cursor.line).slice(0, cursor.ch);
    const tokens = lineBefore.split(/\s+/).filter((t) => t.length);
    if (tokens.length === 0) return null;
    let prefix = tokens[tokens.length - 1];
    const maybePrev = tokens[tokens.length - 2]?.toLowerCase();
    const hasQualifier = ["last", "next"].includes(maybePrev);
    if (hasQualifier) prefix = `${maybePrev} ${prefix}`;
    const query = prefix.toLowerCase().trim();
    if (["l", "la", "las", "last", "n", "ne", "nex", "next"].includes(query))
      return null;
    if (!hasQualifier && query.length < 3) return null;
    if (!PHRASES.some((p) => p.startsWith(query))) return null;
    return {
      start: { line: cursor.line, ch: cursor.ch - prefix.length },
      end: { line: cursor.line, ch: cursor.ch },
      query
    };
  }
  getSuggestions(ctx) {
    const q = ctx.query;
    if (PHRASES.includes(q)) {
      const dt = phraseToMoment(q);
      return dt ? [dt.format(this.plugin.settings.dateFormat)] : [];
    }
    const uniq = /* @__PURE__ */ new Set();
    for (const p of PHRASES) {
      if (!p.startsWith(q)) continue;
      const dt = phraseToMoment(p);
      if (dt) uniq.add(dt.format(this.plugin.settings.dateFormat));
    }
    return [...uniq];
  }
  renderSuggestion(value, el) {
    el.createDiv({ text: value });
  }
  selectSuggestion(value, ev) {
    const { editor, start, end, query } = this.context;
    const { settings } = this.plugin;
    const targetDate = (0, import_obsidian.moment)(value, settings.dateFormat).format("YYYY-MM-DD");
    const candidates = PHRASES.filter(
      (p) => p.startsWith(query.toLowerCase()) && phraseToMoment(p)?.format("YYYY-MM-DD") === targetDate
    );
    const phrase = (candidates.sort((a, b) => a.length - b.length)[0] ?? query).toLowerCase();
    const alias = phrase.replace(/\b\w/g, (ch) => ch.toUpperCase());
    const linkPath = (settings.dailyFolder ? settings.dailyFolder + "/" : "") + value;
    const link = `[[${linkPath}|${alias}]]`;
    const keepTypedWords = settings.keepAliasWithShift && ev instanceof KeyboardEvent && ev.shiftKey;
    editor.replaceRange(
      keepTypedWords ? `${query} ${link}` : link,
      start,
      end
    );
    if (settings.autoCreate && !this.app.vault.getAbstractFileByPath(linkPath + ".md")) {
      this.app.vault.create(linkPath + ".md", "");
    }
    this.close();
  }
};
var DynamicDates = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "settings");
  }
  async onload() {
    await this.loadSettings();
    this.registerEditorSuggest(new DDSuggest(this.app, this));
    this.addSettingTab(new DDSettingTab(this.app, this));
    console.log("Dynamic Dates loaded");
  }
  onunload() {
    console.log("Dynamic Dates unloaded");
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
var DDSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    __publicField(this, "plugin");
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("Date format").addText(
      (t) => t.setPlaceholder("YYYY-MM-DD").setValue(this.plugin.settings.dateFormat).onChange(async (v) => {
        this.plugin.settings.dateFormat = v.trim() || "YYYY-MM-DD";
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Daily-note folder").addText(
      (t) => t.setPlaceholder("Daily").setValue(this.plugin.settings.dailyFolder).onChange(async (v) => {
        this.plugin.settings.dailyFolder = v.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Create note if missing").addToggle(
      (t) => t.setValue(this.plugin.settings.autoCreate).onChange(async (v) => {
        this.plugin.settings.autoCreate = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Shift+Tab keeps alias").addToggle(
      (t) => t.setValue(this.plugin.settings.keepAliasWithShift).onChange(async (v) => {
        this.plugin.settings.keepAliasWithShift = v;
        await this.plugin.saveSettings();
      })
    );
  }
};
