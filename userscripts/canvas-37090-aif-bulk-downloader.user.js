// ==UserScript==
// @name         Canvas 37090 AIF Bulk Downloader
// @namespace    https://canvas.ualberta.ca/
// @version      1.2.0
// @description  Downloads the 24 .aif module attachments for MUSIC 193A/493A/693A.
// @match        https://canvas.ualberta.ca/courses/37090/modules
// @grant        GM_download
// @grant        GM_registerMenuCommand
// @connect      canvas.ualberta.ca
// @run-at       document-idle
// ==/UserScript==

(() => {
  "use strict";

  const MIN_PAUSE_BETWEEN_DOWNLOADS_MS = 3500;
  const MAX_PAUSE_BETWEEN_DOWNLOADS_MS = 6500;
  const EXPECTED_FILE_COUNT = 24;
  let isRunning = false;

  const clean = value => (value || "").replace(/\s+/g, " ").trim();
  const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  const randomPause = () => Math.floor(
    MIN_PAUSE_BETWEEN_DOWNLOADS_MS
      + Math.random() * (MAX_PAUSE_BETWEEN_DOWNLOADS_MS - MIN_PAUSE_BETWEEN_DOWNLOADS_MS + 1),
  );

  function downloadFile(url, name) {
    if (typeof GM_download !== "function") {
      if (typeof GM_xmlhttpRequest !== "function") {
        throw new Error("Neither GM_download nor GM_xmlhttpRequest is available to this userscript.");
      }

      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "GET",
          url,
          responseType: "blob",
          onload: response => {
            if (response.status < 200 || response.status >= 300 || !response.response) {
              reject(new Error(`Canvas returned HTTP ${response.status}.`));
              return;
            }

            const blobUrl = URL.createObjectURL(response.response);
            const downloadLink = document.createElement("a");
            downloadLink.href = blobUrl;
            downloadLink.download = name;
            downloadLink.hidden = true;
            document.body.append(downloadLink);
            downloadLink.click();
            downloadLink.remove();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);

            resolve({ backend: "GM_xmlhttpRequest" });
          },
          onerror: details => reject(new Error(JSON.stringify(details))),
          ontimeout: () => reject(new Error("Canvas download request timed out.")),
        });
      });
    }

    return new Promise((resolve, reject) => {
      GM_download({
        url,
        name,
        saveAs: false,
        onload: () => resolve({ backend: "GM_download" }),
        onerror: details => reject(new Error(JSON.stringify(details))),
      });
    });
  }

  function getSection(moduleItem) {
    for (
      let sibling = moduleItem.previousElementSibling;
      sibling;
      sibling = sibling.previousElementSibling
    ) {
      if (!sibling.classList.contains("context_module_sub_header")) continue;

      const heading = clean(
        sibling.querySelector(".item_name > .ig-title, .item_name > .title, .ig-title, .title")
          ?.textContent,
      );

      // Canvas includes the hidden module-item position in some sub-header text.
      return heading.replace(/\s+\d+$/, "") || "Unlabeled subsection";
    }

    return clean(moduleItem.closest(".context_module")?.getAttribute("aria-label")) || "Unlabeled module";
  }

  function getFileId(moduleItem) {
    return [...moduleItem.classList]
      .map(className => className.match(/^Attachment_(\d+)$/)?.[1])
      .find(Boolean) || null;
  }

  async function downloadAllAifFiles() {
    if (isRunning) return;
    isRunning = true;

    const report = {
      startedAt: new Date().toISOString(),
      expectedCount: EXPECTED_FILE_COUNT,
      state: "running",
      foundCount: 0,
      countsBySection: {},
      files: [],
      events: [],
      fatalError: null,
      finishedAt: null,
      delayPolicy: `${MIN_PAUSE_BETWEEN_DOWNLOADS_MS}-${MAX_PAUSE_BETWEEN_DOWNLOADS_MS} ms, randomized after each completed download`,
      note: "Exactly one Canvas transfer is awaited before the next request begins. GM_xmlhttpRequest is used only if the installed loader lacks GM_download.",
    };

    // The object is live: expand or copy it after the run finishes to see final state.
    console.log("[aif-bulk-downloader]\n", report);

    try {
      const moduleLinks = [...document.querySelectorAll("a.ig-title.item_link")]
        .filter(link => /\.aif$/i.test(clean(link.textContent)));

      const courseId = moduleLinks
        .map(link => link.getAttribute("href")?.match(/\/courses\/(\d+)\/modules\/items\/\d+/)?.[1])
        .find(Boolean);

      if (!courseId) {
        throw new Error("Could not determine the Canvas course ID from the module links.");
      }

      report.foundCount = moduleLinks.length;

      for (const link of moduleLinks) {
        const moduleItem = link.closest("li.context_module_item");
        const section = getSection(moduleItem);
        const fileId = getFileId(moduleItem);
        const file = {
          name: clean(link.textContent),
          section,
          moduleItemUrl: new URL(link.href, location.origin).href,
          fileId,
          downloadUrl: fileId
            ? new URL(`/courses/${courseId}/files/${fileId}/download`, location.origin).href
            : null,
          status: "queued",
          error: null,
        };

        report.countsBySection[section] = (report.countsBySection[section] || 0) + 1;
        report.files.push(file);
      }

      if (report.foundCount !== EXPECTED_FILE_COUNT) {
        report.events.push({
          status: "warning",
          message: `Expected ${EXPECTED_FILE_COUNT} .aif files but found ${report.foundCount}.`,
        });
      }

      for (const [index, file] of report.files.entries()) {
        if (!file.downloadUrl) {
          file.status = "skipped";
          file.error = "No Canvas Attachment_<fileId> class was found for this module item.";
          continue;
        }

        try {
          file.status = "downloading";
          file.startedAt = new Date().toISOString();
          const result = await downloadFile(file.downloadUrl, file.name);
          file.downloadBackend = result.backend;
          file.status = "downloaded";
          file.finishedAt = new Date().toISOString();
          report.events.push({ name: file.name, status: file.status });
        } catch (error) {
          file.status = "failed";
          file.error = String(error?.message || error);

          if (file.error.includes('"error":"not_whitelisted"')) {
            report.state = "blocked";
            report.fatalError = "Tampermonkey blocked Canvas. Add `// @connect canvas.ualberta.ca` to the installed master userscript, save it, then reload this page.";
            report.events.push({ name: file.name, status: "blocked", error: file.error });
            break;
          }
        }

        if (index < report.files.length - 1) {
          const delayMs = randomPause();
          file.delayBeforeNextMs = delayMs;
          await pause(delayMs);
        }
      }
    } catch (error) {
      report.fatalError = String(error?.message || error);
    } finally {
      report.finishedAt = new Date().toISOString();
      report.state = report.state === "blocked" ? "blocked" : report.fatalError ? "failed" : "complete";
      isRunning = false;
    }
  }

  GM_registerMenuCommand("Download Canvas .aif files slowly (one at a time)", downloadAllAifFiles);
})();
