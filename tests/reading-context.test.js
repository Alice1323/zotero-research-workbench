const test = require("node:test");
const assert = require("node:assert/strict");

const {
  extractReaderSelectionPopupContext,
  normalizeReadingContext,
  selectBestReadingContext
} = require("../src/core/readingContext");

test("normalizeReadingContext trims selected text and keeps source metadata", () => {
  const context = normalizeReadingContext({
    text: "  Line one\r\n\r\nLine two  ",
    source: "reader-selection",
    itemKey: "ABCD1234",
    pageLabel: "12",
    createdAt: "2026-05-18T14:00:00.000Z"
  });

  assert.deepEqual(context, {
    source: "reader-selection",
    text: "Line one\n\nLine two",
    itemKey: "ABCD1234",
    pageLabel: "12",
    createdAt: "2026-05-18T14:00:00.000Z"
  });
});

test("normalizeReadingContext returns null for empty selected text", () => {
  assert.equal(
    normalizeReadingContext({
      text: " \n\t ",
      source: "reader-selection",
      itemKey: "ABCD1234"
    }),
    null
  );
});

test("selectBestReadingContext returns the first usable candidate", () => {
  const context = selectBestReadingContext([
    { text: "", source: "reader-selection" },
    {
      text: " Selected passage ",
      source: "window-selection",
      itemKey: "ITEM123",
      createdAt: "2026-05-18T14:30:00.000Z"
    },
    {
      text: "Other passage",
      source: "reader-selection",
      itemKey: "ITEM456"
    }
  ]);

  assert.deepEqual(context, {
    source: "window-selection",
    text: "Selected passage",
    itemKey: "ITEM123",
    pageLabel: "",
    createdAt: "2026-05-18T14:30:00.000Z"
  });
});

test("extractReaderSelectionPopupContext reads Zotero Reader popup annotation text", () => {
  const context = extractReaderSelectionPopupContext(
    {
      _item: { key: "ITEM789" },
      _internalReader: {
        _state: {
          primaryViewSelectionPopup: {
            annotation: {
              text: " Reader popup selected text ",
              pageLabel: "5"
            }
          }
        }
      }
    },
    "2026-05-18T15:00:00.000Z"
  );

  assert.deepEqual(context, {
    source: "reader-selection-popup",
    text: "Reader popup selected text",
    itemKey: "ITEM789",
    pageLabel: "5",
    createdAt: "2026-05-18T15:00:00.000Z"
  });
});
