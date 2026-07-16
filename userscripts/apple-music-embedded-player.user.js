// ==UserScript==
// @name         Apple Music Embedded Player
// @namespace    http://tampermonkey.net/
// @version      2024-08-15
// @description  Make embedded Apple Music player taller
// @author       You
// @match        https://embed.music.apple.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM.setValue
// @grant        GM.getValue
// ==/UserScript==

console.log("iframe loaded");
const pollingInterval = setInterval(checkIfPlayerLoaded, 500);
function checkIfPlayerLoaded() {
  console.log("checking if player loaded...");
  // Start polling every 500 milliseconds
  const containerPlayer = document
    .querySelector("embed-root")
    .shadowRoot?.querySelector(".container-player");

  if (containerPlayer) {
    // Stop polling
    clearInterval(pollingInterval);

    containerPlayer.style.gridTemplate = `"logo logo     logo     auth     auth" 48px
".    content  content  content  ." 1fr
".    .        .        .        ." 12px
".    controls controls controls ." 88px/20px 48px 14px 1fr 20px`;

    console.log("Music Player Loaded");
    // Perform your actions here
    console.log(containerPlayer);
    containerPlayer.style.height = "max-content";

    containerPlayer.querySelector(".audio-tracklist").style.maskImage = "none";
  }
}
