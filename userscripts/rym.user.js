// ==UserScript==
// @name         Rate Your Music
// @namespace    http://tampermonkey.net/
// @version      2023-12-21
// @description  Save RateYourMusic ratings for personal use
// @author       You
// @match        https://rateyourmusic.com/*
// @icon         https://www.google.com/s2/favicons?sz=256&domain=rateyourmusic.com
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM.setValue
// @grant        GM.getValue
// ==/UserScript==

//TODO ==FIXES==
//TODO [ ] handle multi-artist releases
//TODO [ ] sync over web through vercel kv

// * Third-Party Utilities

//? https://www.npmjs.com/package/string-similarity
// prettier-ignore
!function (t, e) { "object" == typeof exports && "object" == typeof module ? module.exports = e() : "function" == typeof define && define.amd ? define([], e) : "object" == typeof exports ? exports.stringSimilarity = e() : t.stringSimilarity = e() }(self, (function () { return t = { 138: t => { function e(t, e) { if ((t = t.replace(/\s+/g, "")) === (e = e.replace(/\s+/g, ""))) return 1; if (t.length < 2 || e.length < 2) return 0; let r = new Map; for (let e = 0; e < t.length - 1; e++) { const n = t.substring(e, e + 2), o = r.has(n) ? r.get(n) + 1 : 1; r.set(n, o) } let n = 0; for (let t = 0; t < e.length - 1; t++) { const o = e.substring(t, t + 2), s = r.has(o) ? r.get(o) : 0; s > 0 && (r.set(o, s - 1), n++) } return 2 * n / (t.length + e.length - 2) } t.exports = { compareTwoStrings: e, findBestMatch: function (t, r) { if (!function (t, e) { return "string" == typeof t && !!Array.isArray(e) && !!e.length && !e.find((function (t) { return "string" != typeof t })) }(t, r)) throw new Error("Bad args: 1st = string, 2nd = array of strings"); const n = []; let o = 0; for (let s = 0; s < r.length; s++) { const i = r[s], f = e(t, i); n.push({ target: i, rating: f }), f > n[o].rating && (o = s) } return { ratings: n, bestMatch: n[o], bestMatchIndex: o } } } } }, e = {}, function r(n) { if (e[n]) return e[n].exports; var o = e[n] = { exports: {} }; return t[n](o, o.exports, r), o.exports }(138) }))
const { compareTwoStrings } = stringSimilarity;

// * Utilities

class Utilities {
  normalizeString(string) {
    return string
      ?.toLowerCase()
      .replace(/\s(\(|\[)[^\(\[]*(\]|\))$/gm, "")
      .replace(": expanded edition", "")
      .trim();
  }
  getNode = (selector, baseElement = document) =>
    baseElement.querySelector(selector);
  getNodes = (selector, baseElement = document) =>
    Array.from(baseElement.querySelectorAll(selector));
  getHTML = (selector, baseElement = document) =>
    baseElement.querySelector(selector).innerHTML.trim();
  getValue = (selector, baseElement) =>
    this.getNode(selector, baseElement).innerText.trim();
  getValues = (selector, baseElement) =>
    Array.from(this.getNodes(selector, baseElement))?.map((v) =>
      v.innerText.trim()
    );
  getListOfGenres(arrayOfNodes) {
    return arrayOfNodes.map((node) => ({
      text: node.innerText,
      href: node.href,
    }));
  }
}

const util = new Utilities();

// * rateyourmusic.com
//TODO: Fix format
async function getInfoForChart() {
  console.log("Getting ratings from charts page...");
  const chartEntries = util.getNodes(".page_section_charts_item_wrapper");

  const releases = (await GM.getValue("releases")) || {};
  const existingReleases = Object.keys(releases).length;
  if (existingReleases === 0) console.log("No existing releases!");

  chartEntries?.forEach((chartEntry) => {
    const getHref = (selector) => util.getNode(selector, chartEntry)?.href;
    const getChartItemValue = (selector) => util.getValue(selector, chartEntry);

    const artistName =
      getChartItemValue(".artist span") ||
      getChartItemValue(".artist span span");
    const rawReleaseName =
      getChartItemValue(".release span") ||
      getChartItemValue(".release span span");

    const releaseName = util.normalizeString(rawReleaseName);
    const chartEntryNode = util.getNode(
      ".page_charts_section_charts_item.object_release",
      chartEntry
    );
    const releaseIDString = /\d*$/.exec(chartEntryNode.id);
    const releaseID = Number(releaseIDString);
    const releaseDate = getChartItemValue(
      ".page_charts_section_charts_item_date span:first-of-type"
    );
    //? tracks aren't available in this view, so if they exist don't overwrite them
    const tracks = {};
    if (releases[releaseID]) Object.assign(tracks, releases[releaseID].tracks);

    const href = getHref(".release");
    const artistHref = getHref(".artist");
    const rating = getChartItemValue(
      ".page_charts_section_charts_item_details_average_num"
    );
    const primary = util.getNodes(
      ".page_charts_section_charts_item_genres_primary .genre",
      chartEntry
    );
    const genres = util.getListOfGenres(primary);
    const secondary = util.getNodes(
      ".page_charts_section_charts_item_genres_secondary .genre",
      chartEntry
    );
    const secondaryGenres = util.getListOfGenres(secondary);
    const descriptors = util.getValues(
      ".page_charts_section_charts_item_genre_descriptors span",
      chartEntry
    );
    const mediaLinks = JSON.parse(
      util
        .getNode(".page_charts_section_charts_item_media_links div", chartEntry)
        .getAttribute("data-links")
    );
    const release = {
      artistName,
      releaseName,
      releaseDate,
      releaseID,
      href,
      artistHref,
      rating,
      genres,
      secondaryGenres,
      descriptors,
      mediaLinks,
    };
    console.log(release);
    releases[releaseID] = release;
  });

  await GM.setValue("releases", releases);
  const totalReleases = Object.keys(releases).length;
  const releasesAdded = totalReleases - existingReleases;

  console.log(
    `${releasesAdded} releases added to database (${totalReleases} total).`
  );
}

async function getInfoForAlbum() {
  console.log("Getting info for album page...");
  const releases = (await GM.getValue("releases")) || {};
  const getHref = (selector) => util.getNode(selector)?.href;

  const releaseViewButton = util.getNode(".release_view");
  releaseViewButton?.click(); // Get combined release view (instead of view for some random CD deluxe version with 3 ratings)

  const artistName = util.getValue(".artist") || util.getValue(".artist span");

  const rawReleaseName = util.getValue(".album_title");
  const releaseName = util.normalizeString(rawReleaseName);
  const releaseID = util.getNode(".album_shortcut").value.match(/\d+/)[0];

  console.log(releaseID, releaseName);
  if (!releases[releaseID])
    console.log(`🟢 new release added: "${releaseName}" by ${artistName}`);
  const primary = util.getNodes(".release_pri_genres .genre");
  const secondary = util.getNodes(".release_sec_genres .genre");

  const releaseDate = util.getNode(".album_info tr:nth-of-type(3)").lastChild
    .innerText;

  // get track ratings, durations & save them in tracks[]
  const trackTitles = util.getValues("#tracks .tracklist_title .rendered_text");
  const trackDurations = util.getValues("#tracks .tracklist_duration");
  const tracks = [];
  util.getValues("#tracks .track_rating_avg").forEach(
    (rating, i) =>
      (tracks[i] = {
        title: trackTitles[i],
        duration: trackDurations[i],
        rating: Number(rating),
        artistName,
        trackNumber: i,
      })
  );

  // get first page of reviews (highest voted ~9) for later in case I want them
  const reviewsHTML = util.getHTML(".section_reviews");
  const release = {
    artistName,
    releaseName,
    releaseDate,
    releaseID,
    href: window.location.href,
    artistHref: getHref(".artist"),
    rating: util.getValue(".avg_rating").trim(),
    genres: util.getListOfGenres(primary),
    secondaryGenres: util.getListOfGenres(secondary),
    descriptors: util.getValue(".release_pri_descriptors").split(", "),
    mediaLinks: JSON.parse(
      util
        .getNode("#media_link_button_container_top")
        .getAttribute("data-links")
    ),
    tracks,
    reviewsHTML,
  };
  console.log(release);
  releases[releaseID] = release;
  await GM.setValue("releases", releases);

  const allTracks = (await GM.getValue("tracks")) || [];
  tracks.forEach((track) => {
    const uniqueTrackID =
      track.artistName + "." + releaseName + "." + track.title;
    allTracks[uniqueTrackID] = { ...track, releaseName };
  });
  await GM.setValue("tracks", allTracks);
  console.log(allTracks);
}

async function getInfoFromChartsPage() {
  function getInfoForChartWhenPageChanges() {
    console.log("get info");
    const paginationNodes = document.querySelectorAll(".ui_pagination");
    paginationNodes.forEach((node) => {
      //? top & bottom navigation
      node.addEventListener(
        "click",
        () => {
          setTimeout(() => {
            console.log("\n\npage changed!\n");
            getInfoForChartWhenPageChanges(); //? pagination nodes are replaced on dom reload
            getInfoForChart();
          }, 1000);
        },
        { once: true }
      );
    });
  }
  getInfoForChart();
  getInfoForChartWhenPageChanges();
}

// * START HERE

const date = new Date();
console.clear();
if (window.location.href.includes("/charts")) {
  // console.log('Not getting info from charts page until data format updated!')
  // [15165166] JPEG
  console.log("getting info from charts page");
  getInfoFromChartsPage();
} else if (window.location.href.includes("/release/")) {
  const int = setInterval(() => {
    console.log("checking for apple music link...");
    const element = document.querySelector(
      'a[aria-label="Open in Apple Music"]'
    );
    if (element) {
      clearInterval(int);
      const href = element.href;
      console.log("href", href, element);

      const embeddedAppleMusic = document.createElement("iframe");
      embeddedAppleMusic.src = href.replace("https://geo", "https://embed");
      embeddedAppleMusic.width = 300;
      embeddedAppleMusic.height = 1000;

      const tracklisting = document.querySelector(
        ".hide-for-small .section_tracklisting"
      );
      const tracklistingContainer = tracklisting.parentNode;
      // if display isn't none then set to flex and append iframe
      // tracklistingContainer.style.display !== 'none' ? (tracklistingContainer.style.display = 'flex') : ''

      tracklistingContainer.style.display = "flex";
      tracklistingContainer.parentNode.style.overflowX = "scroll";
      tracklistingContainer.style.width = "max-content";
      tracklistingContainer.style.minWidth = "fit-content";
      tracklistingContainer.append(embeddedAppleMusic);

      tracklistingContainer.querySelector("li.tracklist_line").style.display =
        "flex";
      tracklistingContainer.querySelector("li.tracklist_title").style.textWrap =
        "no-wrap";
      document.querySelector("#column_container_left").style.overflowX =
        "scroll";
    }
  }, 500);

  // getInfoForAlbum()
}
