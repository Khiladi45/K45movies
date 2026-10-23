import { Buffer as NodeBuffer } from "buffer";

// React Native polyfills fetch, URL, URLSearchParams, AbortController and
// process, but not Buffer / atob / btoa / TextEncoder / TextDecoder. Provider
// bundles use all four (10 bundles touch Buffer, 33 use atob), so install them
// before any bundle is required.

class Utf8TextEncoder {
  encode(input?: string): Uint8Array {
    return new Uint8Array(NodeBuffer.from(String(input ?? ""), "utf8"));
  }
}

class Utf8TextDecoder {
  decode(input?: ArrayBufferView | ArrayBuffer | null): string {
    if (!input) return "";
    if (input instanceof ArrayBuffer) {
      return NodeBuffer.from(new Uint8Array(input)).toString("utf8");
    }
    return NodeBuffer.from(
      input.buffer as ArrayBuffer,
      input.byteOffset,
      input.byteLength,
    ).toString("utf8");
  }
}

const atobImpl = (input: string) =>
  NodeBuffer.from(String(input), "base64").toString("binary");

const btoaImpl = (input: string) =>
  NodeBuffer.from(String(input), "binary").toString("base64");

let installed = false;

export function installRuntimeGlobals() {
  if (installed) return;
  installed = true;

  const scope = globalThis as any;
  if (!scope.Buffer) scope.Buffer = NodeBuffer;
  if (typeof scope.atob !== "function") scope.atob = atobImpl;
  if (typeof scope.btoa !== "function") scope.btoa = btoaImpl;
  if (typeof scope.TextEncoder !== "function") {
    scope.TextEncoder = Utf8TextEncoder;
  }
  if (typeof scope.TextDecoder !== "function") {
    scope.TextDecoder = Utf8TextDecoder;
  }
}
