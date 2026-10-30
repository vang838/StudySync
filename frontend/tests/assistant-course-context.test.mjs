import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const loadModule = createRequire(import.meta.url);
const source = readFileSync(resolve(import.meta.dirname, "../components/assistant/AssistantWidget.tsx"), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
});

function findElement(element, type) {
  if (!element || typeof element !== "object") return undefined;
  if (element.type === type) return element;
  return [element.props?.children].flat(Infinity)
    .map((child) => findElement(child, type)).find(Boolean);
}

function renderWidget(courseId) {
  let stateIndex = 0;
  let request;
  const exports = {};
  const react = {
    useState(initial) {
      const index = stateIndex++;
      // Open the overlay and provide the prompt; retain other initial state.
      const value = index === 0 ? true : index === 4 ? "The hello_595.pdf talks about what?" : initial;
      return [value, () => {}];
    },
    useEffect() {},
    useRef(value) { return { current: value }; },
  };

  runInNewContext(outputText, {
    exports,
    require(name) {
      if (name === "react") return react;
      if (name === "next/navigation") {
        return { useParams: () => ({ courseId }), usePathname: () => "/courses/example" };
      }
      if (name === "@/components/ui/button") return { Button: "button" };
      return loadModule(name);
    },
    crypto: { randomUUID: () => "test-message" },
    console,
    async fetch(url, options) {
      request = { url, payload: JSON.parse(options.body) };
      return { ok: true, json: async () => ({ answer: "Answer", mode: "course", citations: [], claims: [] }) };
    },
  });

  return { element: exports.default(), getRequest: () => request };
}

for (const [input, expected] of [
  ["COMPSCI%20595", "COMPSCI 595"],
  ["COMPSCI 595", "COMPSCI 595"],
  ["100% complete", "100% complete"],
  [undefined, undefined],
]) {
  test(`overlay submits the canonical course context for ${input}`, async () => {
    const widget = renderWidget(input);
    const select = findElement(widget.element, "select");
    assert.equal(select.props.value, expected ?? "");

    const form = findElement(widget.element, "form");
    await form.props.onSubmit({ preventDefault() {} });

    const request = widget.getRequest();
    assert.equal(request.url, "/api/chat");
    assert.equal(request.payload.course_id, expected);
    assert.equal(request.payload.question, "The hello_595.pdf talks about what?");
  });
}
