// ==UserScript==
// @name        Perplexity Hide Upgrade to Max Banner
// @author      Matthew Daniel Murphy
// @description Hides the annoying Upgrade to Max reminder banner
// @version     2025.10.16.1
// @match       https://www.perplexity.ai/*
// ==/UserScript==

(() => {
  console.log('removing banners')
  const removeBanners = () => {
    removeUpgradeToMaxBanner();
    removeUpgradeNowBanner();
  }
  const removeUpgradeToMaxBanner = () => {
    // Find the element containing "Upgrade to Max"
    const upgradeBtn = Array.from(document.querySelectorAll('div'))
      .find(el => el.textContent.trim() === 'Upgrade to Max');

    if (!upgradeBtn) return;

    // Closest ancestor with shadow-xl likely marks full banner
    const banner = upgradeBtn.closest('.shadow-xl');
    if (banner) {
      banner.remove();
    } else {
      // Fallback: Remove parent stack if .shadow-xl not found
      let parent = upgradeBtn;
      for (let i = 0; i < 3; i++) {
        if (parent.parentElement & parent.id !== 'root') parent = parent.parentElement;
      }
      parent.remove();
    }
  };
  const removeUpgradeNowBanner = () => {
    // Find the element containing "Upgrade to Max"
    const upgradeBtn = Array.from(document.querySelectorAll('div'))
      .find(el => el.textContent.trim() === 'Upgrade now');

    if (!upgradeBtn) return;

    // Closest ancestor with shadow-xl likely marks full banner
    const banner = upgradeBtn.closest('.shadow-md');
    if (banner) {
      banner.remove();
    } else {
      // Fallback: Remove parent stack if .shadow-xl not found
      let parent = upgradeBtn;
      for (let i = 0; i < 3; i++) {
        if (parent.parentElement & parent.id !== 'root') parent = parent.parentElement;
      }
      parent.remove();
    }
  };

  // Run the remover every 500ms in case the banner reappears via SPA navigation
  setInterval(removeBanners, 500);
})();
