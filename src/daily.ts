import { App, TFile, normalizePath, moment } from "obsidian";

export interface DailyNoteSettings {
    format: string;
    folder?: string;
    template?: string;
}

export function getDailyNoteSettings(app: App): DailyNoteSettings {
    const mc: any = (app as any).metadataCache;
    if (mc && typeof mc.getDailyNoteSettings === "function") {
        try {
            return mc.getDailyNoteSettings();
        } catch {}
    }
    return (app as any).internalPlugins?.plugins?.["daily-notes"]?.instance?.options || {};
}

export async function createDailyNote(app: App, date: moment.Moment): Promise<TFile> {
    const settings = getDailyNoteSettings(app);
    const fmt = settings.format || "YYYY-MM-DD";
    const folder = settings.folder ? normalizePath(settings.folder) : "";
    const path = normalizePath((folder ? folder + "/" : "") + `${date.format(fmt)}.md`);
    const existing = app.vault.getAbstractFileByPath(path);
    if (existing) return existing as TFile;

    if (folder && !app.vault.getAbstractFileByPath(folder)) {
        await app.vault.createFolder(folder);
    }

    let data = "";
    if (settings.template) {
        const tplPath = normalizePath(settings.template);
        const tpl = app.vault.getAbstractFileByPath(tplPath);
        if (tpl) {
            data = await app.vault.read(tpl as TFile);
            data = data
                .replace(/{{\s*date\s*}}/gi, date.format(fmt))
                .replace(/{{\s*time\s*}}/gi, moment().format("HH:mm"))
                .replace(/{{\s*title\s*}}/gi, date.format(fmt))
                .replace(/{{\s*date:(.+?)}}/gi, (_, f) => date.format(f.trim()));
            const templates = (app as any).internalPlugins?.plugins?.["templates"];
            if (templates?.enabled) {
                try {
                    const parse = templates.instance?.parseTemplate;
                    if (typeof parse === "function") {
                        data = await parse.call(templates.instance, data);
                    }
                } catch {}
            }
        }
    }

    return await app.vault.create(path, data);
}
