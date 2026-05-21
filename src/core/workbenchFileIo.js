function createWorkbenchFileIo({ IOUtils, OS, TextEncoder, TextDecoder, getComponents } = {}) {
  const componentsProvider = typeof getComponents === "function" ? getComponents : () => null;
  const textEncoderClass = TextEncoder;
  const textDecoderClass = TextDecoder;

  async function writeTextFile(file, text) {
    const path = file?.path || file;
    if (!path) {
      throw new Error("未选择导出文件");
    }
    if (IOUtils?.writeUTF8) {
      await IOUtils.writeUTF8(path, text);
      return;
    }
    if (OS?.File?.writeAtomic) {
      const Encoder = textEncoderClass || globalThis.TextEncoder;
      await OS.File.writeAtomic(path, new Encoder().encode(text), { tmpPath: `${path}.tmp` });
      return;
    }
    throw new Error("当前 Zotero 环境不支持写入导出文件");
  }

  async function readTextFile(file) {
    const path = file?.path || file;
    if (!path) {
      throw new Error("未选择导入文件");
    }
    if (IOUtils?.readUTF8) {
      return IOUtils.readUTF8(path);
    }
    if (OS?.File?.read) {
      const Decoder = textDecoderClass || globalThis.TextDecoder;
      return new Decoder().decode(await OS.File.read(path));
    }
    throw new Error("当前 Zotero 环境不支持读取导入文件");
  }

  async function writeZipExportFile(targetFile, payload) {
    const file = resolveLocalFile(targetFile, "未选择 ZIP 导出文件");
    const zipWriter = createZipWriter();
    try {
      zipWriter.open(file, zipWriterOpenFlags());
      for (const [path, value] of Object.entries(payload.files || {})) {
        zipWriter.addEntryStream(
          path,
          Date.now() * 1000,
          getComponentsRequired().interfaces.nsIZipWriter.COMPRESSION_DEFAULT,
          createUtf8InputStream(JSON.stringify(value, null, 2)),
          false
        );
      }
    } finally {
      zipWriter.close();
    }
    verifyZipExportFile(file, payload);
  }

  function verifyZipExportFile(file, payload) {
    const zipReader = createZipReader();
    try {
      const localFile = resolveLocalFile(file, "未选择 ZIP 导出文件");
      zipReader.open(localFile);
      if (!zipReader.hasEntry("manifest.json")) {
        throw new Error("ZIP 导出包为空或缺少 manifest.json");
      }
      const snapshotPath = cleanText(payload?.files?.["manifest.json"]?.snapshotPath) || "snapshot.json";
      if (!zipReader.hasEntry(snapshotPath)) {
        if (snapshotPath === "snapshot.json") {
          throw new Error("ZIP 导出包为空或缺少 snapshot.json");
        }
        throw new Error(`ZIP 导出包为空或缺少 ${snapshotPath}`);
      }
    } finally {
      zipReader.close();
    }
  }

  async function readZipExportFile(sourceFile) {
    const file = resolveLocalFile(sourceFile, "未选择 ZIP 导入文件");
    const zipReader = createZipReader();
    try {
      zipReader.open(file);
      const manifest = JSON.parse(readZipEntryText(zipReader, "manifest.json"));
      const snapshotPath = cleanText(manifest.snapshotPath) || "snapshot.json";
      const snapshotPackage = JSON.parse(readZipEntryText(zipReader, snapshotPath));
      return {
        packageKind: manifest.packageKind,
        packageVersion: manifest.packageVersion,
        exportedAt: manifest.exportedAt,
        files: {
          "manifest.json": manifest,
          [snapshotPath]: snapshotPackage
        }
      };
    } finally {
      zipReader.close();
    }
  }

  function getComponentsRequired() {
    const Components = componentsProvider();
    if (!Components?.classes || !Components?.interfaces) {
      throw new Error("当前 Zotero 环境不可用 ZIP 文件接口");
    }
    return Components;
  }

  function createZipWriter() {
    const Components = getComponentsRequired();
    const writerClass = Components.classes["@mozilla.org/zipwriter;1"];
    if (!writerClass) {
      throw new Error("当前 Zotero 环境不可用 ZIP 文件接口");
    }
    return writerClass.createInstance(Components.interfaces.nsIZipWriter);
  }

  function createZipReader() {
    const Components = getComponentsRequired();
    const readerClass = Components.classes["@mozilla.org/libjar/zip-reader;1"];
    if (!readerClass) {
      throw new Error("当前 Zotero 环境不可用 ZIP 文件接口");
    }
    return readerClass.createInstance(Components.interfaces.nsIZipReader);
  }

  function createUtf8InputStream(text) {
    const Components = getComponentsRequired();
    const stream = Components.classes["@mozilla.org/io/string-input-stream;1"].createInstance(
      Components.interfaces.nsIStringInputStream
    );
    stream.setUTF8Data(String(text || ""));
    return stream;
  }

  function readZipEntryText(zipReader, path) {
    if (!zipReader.hasEntry(path)) {
      throw new Error(`ZIP 导出包缺少 ${path}`);
    }
    const Components = getComponentsRequired();
    const stream = zipReader.getInputStream(path);
    try {
      const converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(
        Components.interfaces.nsIScriptableUnicodeConverter
      );
      converter.charset = "UTF-8";
      return converter.ConvertToUnicode(readStreamBytes(stream));
    } finally {
      stream.close();
    }
  }

  function readStreamBytes(stream) {
    const Components = getComponentsRequired();
    const binaryInput = Components.classes["@mozilla.org/binaryinputstream;1"].createInstance(
      Components.interfaces.nsIBinaryInputStream
    );
    binaryInput.setInputStream(stream);
    const chunks = [];
    while (binaryInput.available() > 0) {
      chunks.push(binaryInput.readBytes(binaryInput.available()));
    }
    return chunks.join("");
  }

  function resolveLocalFile(file, missingMessage) {
    if (!file) {
      throw new Error(missingMessage);
    }
    if (typeof file === "object" && file.path) {
      return file;
    }
    const Components = getComponentsRequired();
    const localFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
    localFile.initWithPath(String(file));
    return localFile;
  }

  return {
    readTextFile,
    readZipExportFile,
    verifyZipExportFile,
    writeTextFile,
    writeZipExportFile
  };
}

function zipWriterOpenFlags() {
  const PR_RDWR = 0x04;
  const PR_WRONLY = 0x02;
  const PR_CREATE_FILE = 0x08;
  const PR_TRUNCATE = 0x20;
  return PR_RDWR | PR_WRONLY | PR_CREATE_FILE | PR_TRUNCATE;
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function createBrowserWorkbenchFileIo({ window, IOUtils, OS, TextEncoder, TextDecoder, getComponents } = {}) {
  return createWorkbenchFileIo({
    IOUtils: IOUtils || globalAdapter("IOUtils"),
    OS: OS || globalAdapter("OS"),
    TextEncoder: TextEncoder || globalAdapter("TextEncoder"),
    TextDecoder: TextDecoder || globalAdapter("TextDecoder"),
    getComponents:
      getComponents ||
      (() => {
        return globalAdapter("Components");
      }),
    window
  });
}

function globalAdapter(name) {
  if (typeof globalThis === "undefined") {
    return null;
  }
  return globalThis[name] || null;
}

const WorkbenchFileIo = {
  createBrowserWorkbenchFileIo,
  createWorkbenchFileIo
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkbenchFileIo;
}

if (typeof window !== "undefined") {
  window.WorkbenchFileIo = WorkbenchFileIo;
}
