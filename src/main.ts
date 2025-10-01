import DynamicDates from "./plugin/DynamicDates";

declare const module: any;

export * from "./plugin/DynamicDates";
export * from "./core/phraseParser";
export * from "./core/holidays";

export default DynamicDates;

if (typeof module !== "undefined" && typeof (module as any).exports !== "undefined") {
        (module as any).exports = DynamicDates;
        (module as any).exports.default = DynamicDates;
}
