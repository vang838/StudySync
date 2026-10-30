import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const loadModule = createRequire(import.meta.url);
const source = readFileSync(resolve(import.meta.dirname, "../app/dashboard/page.tsx"), "utf8");
const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
});

function elements(element) {
    if (!element || typeof element !== "object") return [];
    return [element, ...[element.props?.children].flat(Infinity).flatMap(elements)];
}

function text(element) {
    if (typeof element === "string" || typeof element === "number") return String(element);
    if (!element || typeof element !== "object") return "";
    return [element?.props?.children].flat(Infinity).map(text).join("");
}

function dashboard({ data = [], ok = true, userId = "7" } = {}) {
    const states = [];
    const effects = [];
    const requests = [];
    const storageKeys = [];
    let cursor = 0;
    let mounted = false;
    const exports = {};
    runInNewContext(outputText, {
        exports, AbortController,
        window: { localStorage: { getItem(key) {
            storageKeys.push(key);
            return key === "user_id" ? userId : JSON.stringify([{ code: "COMPSCI 537", name: "Stale course", progress: 100 }]);
        } } },
        async fetch(url, options) {
            requests.push({ url, options });
            return { ok, json: async () => data };
        },
        require(name) {
            if (name === "react") return {
                useState(initial) {
                    const index = cursor++;
                    if (!(index in states)) states[index] = initial;
                    return [states[index], (value) => { states[index] = value; }];
                },
                useEffect(effect) { if (!mounted) effects.push(effect); },
            };
            if (name === "next/link") return { default: "a" };
            if (name === "@/components/ui/card") return {
                Card: "Card", CardContent: "CardContent", CardHeader: "CardHeader", CardTitle: "CardTitle",
            };
            if (name === "@/components/dashboard/StudyTasksProvider") return {
                useStudyTasks: () => ({ tasks: [], toggleTask() {} }),
            };
            if (name === "@/components/dashboard/StudyCalendar") return { default: "Calendar" };
            if (name.startsWith("@hugeicons/")) return new Proxy({}, { get: () => "Icon" });
            return loadModule(name);
        },
    });

    function render() {
        cursor = 0;
        const element = exports.default();
        mounted = true;
        return element;
    }

    return {
        requests, storageKeys,
        initial: render(),
        async load() {
            effects.forEach((effect) => effect());
            await new Promise(setImmediate);
            return render();
        },
    };
}

test("dashboard shows all API-saved courses despite a stale local course cache", async () => {
    const data = [
        { course_id: "COMPSCI 595", title: "Capstone Project", subject: "COMPSCI", year: 2026 },
        { course_id: "COMPSCI 537", title: "Introduction to Operating Systems", subject: "COMPSCI", year: 2026 },
        { course_id: "COMPSCI 564", title: "Introduction to Database Systems", subject: "COMPSCI", year: 2026 },
    ];
    const page = dashboard({ data });
    assert.match(text(page.initial), /Loading saved courses/);

    const loaded = await page.load();
    assert.equal(page.requests[0].url, "/api/courses/saved?user_id=7");
    assert.equal(page.requests[0].options.cache, "no-store");
    assert.deepEqual(page.storageKeys, ["user_id"]);
    for (const course of data) {
        assert.ok(text(loaded).includes(course.title));
        assert.ok(elements(loaded).some((element) => element.props?.href === `/courses/${encodeURIComponent(course.course_id)}`));
    }
    const stat = elements(loaded).find((element) => element.type === "Card" && text(element).startsWith("Saved courses"));
    assert.equal(text(stat), "Saved courses3");
    assert.ok(!text(loaded).includes("Stale course"));
});

test("no saved courses shows an empty state and zero count without sample courses", async () => {
    const loaded = await dashboard().load();
    assert.match(text(loaded), /No saved courses yet/);
    const courseSection = elements(loaded).find((element) => element.props?.id === "courses");
    assert.ok(!text(courseSection).includes("Human Biology"));
    const stat = elements(loaded).find((element) => element.type === "Card" && text(element).startsWith("Saved courses"));
    assert.equal(text(stat), "Saved courses0");
});

test("API errors show an error rather than stale courses or an empty-state claim", async () => {
    const loaded = await dashboard({ ok: false }).load();
    assert.match(text(loaded), /Unable to load your saved courses/);
    assert.ok(elements(loaded).some((element) => element.props?.role === "alert"));
    assert.ok(!text(loaded).includes("No saved courses yet"));
});

test("missing user identity does not fetch another user's courses", async () => {
    const page = dashboard({ userId: null });
    const loaded = await page.load();
    assert.equal(page.requests.length, 0);
    assert.match(text(loaded), /Sign in to view your saved courses/);
});

test("malformed API responses show an error", async () => {
    for (const course of [
        { name: "Invalid course" },
        { course_id: "CS", title: "Missing course details" },
        { course_id: "CS", title: "Invalid year", subject: "COMPSCI", year: "2026" },
    ]) {
        const loaded = await dashboard({ data: [course] }).load();
        assert.match(text(loaded), /Unable to load your saved courses/);
    }
});
