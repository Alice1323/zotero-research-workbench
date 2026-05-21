const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { createWorkbenchFileIo } = require("../src/core/workbenchFileIo");

const root = path.resolve(__dirname, "..");

test("workbench file IO writes and reads UTF-8 text through IOUtils", async () => {
  const calls = [];
  const io = createWorkbenchFileIo({
    IOUtils: {
      writeUTF8: async (targetPath, text) => {
        calls.push(["writeUTF8", targetPath, text]);
      },
      readUTF8: async (sourcePath) => {
        calls.push(["readUTF8", sourcePath]);
        return "{\"ok\":true}";
      }
    }
  });

  await io.writeTextFile({ path: "C:\\tmp\\workbench.json" }, "{\"ok\":true}");
  const text = await io.readTextFile("C:\\tmp\\workbench.json");

  assert.equal(text, "{\"ok\":true}");
  assert.deepEqual(calls, [
    ["writeUTF8", "C:\\tmp\\workbench.json", "{\"ok\":true}"],
    ["readUTF8", "C:\\tmp\\workbench.json"]
  ]);
});

test("workbench file IO falls back to OS.File byte APIs for text files", async () => {
  const calls = [];
  const io = createWorkbenchFileIo({
    OS: {
      File: {
        writeAtomic: async (targetPath, bytes, options) => {
          calls.push(["writeAtomic", targetPath, Array.from(bytes), options]);
        },
        read: async (sourcePath) => {
          calls.push(["read", sourcePath]);
          return new TextEncoder().encode("导入文本");
        }
      }
    },
    TextEncoder,
    TextDecoder
  });

  await io.writeTextFile("C:\\tmp\\state.json", "导入文本");
  const text = await io.readTextFile({ path: "C:\\tmp\\state.json" });

  assert.equal(text, "导入文本");
  assert.deepEqual(calls, [
    ["writeAtomic", "C:\\tmp\\state.json", Array.from(new TextEncoder().encode("导入文本")), { tmpPath: "C:\\tmp\\state.json.tmp" }],
    ["read", "C:\\tmp\\state.json"]
  ]);
});

test("workbench file IO writes ZIP payloads and verifies manifest entries", async () => {
  const calls = [];
  const archive = new Map();
  const components = createZipComponents({ calls, archive });
  const io = createWorkbenchFileIo({
    getComponents: () => components
  });
  const payload = {
    files: {
      "manifest.json": { snapshotPath: "snapshot.json" },
      "snapshot.json": { schemaVersion: 1, graphSeeds: [] }
    }
  };

  await io.writeZipExportFile("C:\\tmp\\workbench.zip", payload);

  assert.deepEqual([...archive.keys()], ["manifest.json", "snapshot.json"]);
  assert.equal(JSON.parse(archive.get("manifest.json")).snapshotPath, "snapshot.json");
  assert.equal(JSON.parse(archive.get("snapshot.json")).schemaVersion, 1);
  assert.deepEqual(calls.filter((call) => call[0] === "writer.open")[0], ["writer.open", "C:\\tmp\\workbench.zip", 46]);
  assert.deepEqual(calls.filter((call) => call[0] === "writer.close").length, 1);
  assert.deepEqual(calls.filter((call) => call[0] === "reader.close").length, 1);
});

test("workbench file IO reads ZIP payloads through the injected Components adapter", async () => {
  const calls = [];
  const archive = new Map([
    ["manifest.json", JSON.stringify({ snapshotPath: "snapshot.json", packageKind: "zotero-research-workbench", packageVersion: "1.0", exportedAt: "2026-05-21T00:00:00.000Z" })],
    ["snapshot.json", JSON.stringify({ schemaVersion: 1, taskLedger: [] })]
  ]);
  const io = createWorkbenchFileIo({
    getComponents: () => createZipComponents({ calls, archive })
  });

  const payload = await io.readZipExportFile({ path: "C:\\tmp\\workbench.zip" });

  assert.deepEqual(payload, {
    packageKind: "zotero-research-workbench",
    packageVersion: "1.0",
    exportedAt: "2026-05-21T00:00:00.000Z",
    files: {
      "manifest.json": { snapshotPath: "snapshot.json", packageKind: "zotero-research-workbench", packageVersion: "1.0", exportedAt: "2026-05-21T00:00:00.000Z" },
      "snapshot.json": { schemaVersion: 1, taskLedger: [] }
    }
  });
  assert.deepEqual(calls.filter((call) => call[0] === "reader.open"), [["reader.open", "C:\\tmp\\workbench.zip"]]);
  assert.deepEqual(calls.filter((call) => call[0] === "reader.close").length, 1);
});

test("workbench file IO reports missing ZIP snapshot entries", async () => {
  const io = createWorkbenchFileIo({
    getComponents: () =>
      createZipComponents({
        calls: [],
        archive: new Map([
          ["manifest.json", JSON.stringify({ snapshotPath: "missing.json" })]
        ])
      })
  });

  assert.throws(
    () => io.verifyZipExportFile({ path: "C:\\tmp\\broken.zip" }, { files: { "manifest.json": { snapshotPath: "missing.json" } } }),
    /ZIP 导出包为空或缺少 missing\.json/
  );
});

test("workbench file IO exposes the same interface to browser runtime scripts", () => {
  const source = fs.readFileSync(path.join(root, "src/core/workbenchFileIo.js"), "utf8");
  const context = {
    window: {}
  };

  vm.runInNewContext(source, context, { filename: "workbenchFileIo.js" });

  assert.equal(typeof context.window.WorkbenchFileIo.createWorkbenchFileIo, "function");
  assert.equal(typeof context.window.WorkbenchFileIo.createBrowserWorkbenchFileIo, "function");
});

function createZipComponents({ calls, archive }) {
  const interfaces = {
    nsIZipWriter: { COMPRESSION_DEFAULT: 7 },
    nsIZipReader: "nsIZipReader",
    nsIStringInputStream: "nsIStringInputStream",
    nsIScriptableUnicodeConverter: "nsIScriptableUnicodeConverter",
    nsIBinaryInputStream: "nsIBinaryInputStream",
    nsIFile: "nsIFile"
  };

  return {
    interfaces,
    classes: {
      "@mozilla.org/file/local;1": {
        createInstance(interfaceType) {
          assert.equal(interfaceType, "nsIFile");
          return {
            initWithPath(localPath) {
              this.path = localPath;
              calls.push(["localFile.initWithPath", localPath]);
            }
          };
        }
      },
      "@mozilla.org/zipwriter;1": {
        createInstance(interfaceType) {
          assert.equal(interfaceType, interfaces.nsIZipWriter);
          return {
            open(file, flags) {
              calls.push(["writer.open", file.path, flags]);
            },
            addEntryStream(entryPath, timestamp, compression, stream, queue) {
              calls.push(["writer.addEntryStream", entryPath, compression, queue]);
              archive.set(entryPath, stream.data);
            },
            close() {
              calls.push(["writer.close"]);
            }
          };
        }
      },
      "@mozilla.org/libjar/zip-reader;1": {
        createInstance(interfaceType) {
          assert.equal(interfaceType, interfaces.nsIZipReader);
          return {
            open(file) {
              calls.push(["reader.open", file.path]);
            },
            hasEntry(entryPath) {
              return archive.has(entryPath);
            },
            getInputStream(entryPath) {
              calls.push(["reader.getInputStream", entryPath]);
              return {
                data: archive.get(entryPath),
                close() {
                  calls.push(["stream.close", entryPath]);
                }
              };
            },
            close() {
              calls.push(["reader.close"]);
            }
          };
        }
      },
      "@mozilla.org/io/string-input-stream;1": {
        createInstance(interfaceType) {
          assert.equal(interfaceType, interfaces.nsIStringInputStream);
          return {
            setUTF8Data(data) {
              this.data = data;
            }
          };
        }
      },
      "@mozilla.org/intl/scriptableunicodeconverter": {
        createInstance(interfaceType) {
          assert.equal(interfaceType, interfaces.nsIScriptableUnicodeConverter);
          return {
            charset: "",
            ConvertToUnicode(bytes) {
              return bytes;
            }
          };
        }
      },
      "@mozilla.org/binaryinputstream;1": {
        createInstance(interfaceType) {
          assert.equal(interfaceType, interfaces.nsIBinaryInputStream);
          return {
            setInputStream(stream) {
              this.remaining = stream.data || "";
            },
            available() {
              return this.remaining.length;
            },
            readBytes(count) {
              const chunk = this.remaining.slice(0, count);
              this.remaining = this.remaining.slice(count);
              return chunk;
            }
          };
        }
      }
    }
  };
}
