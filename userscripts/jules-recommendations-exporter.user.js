// ==UserScript==
// @name         Jules Recommendations Exporter
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Export recommendations from jules.google.com to YAML
// @author       You
// @match        https://jules.google.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    async function exportRecommendations() {
        const items = document.querySelectorAll('.suggestion-item');
        const data = [];
        const itemsToCollapse = [];

        // First pass: Open all closed items
        for (const item of items) {
            const isExpanded = !!item.querySelector('.suggestion-details');
            const expandButton = item.querySelector('.expand-button');

            if (!isExpanded && expandButton) {
                expandButton.click();
                itemsToCollapse.push(expandButton);
            }
        }

        // Wait once for rendering
        await new Promise(r => setTimeout(r, 300));

        // Second pass: Extract details
        for (const item of items) {
            const getDetail = (headerText) => {
                const h4s = item.querySelectorAll('.detail-section h4');
                for (const h4 of h4s) {
                    if (h4.textContent.trim().toUpperCase() === headerText.toUpperCase()) {
                        const content = h4.nextElementSibling;
                        return content ? content.textContent.trim() : '';
                    }
                }
                return '';
            };

            const getCodeContext = () => {
                const sections = item.querySelectorAll('.detail-section');
                for (const section of sections) {
                    const h4 = section.querySelector('h4');
                    if (h4 && h4.textContent.trim().toUpperCase() === 'CODE CONTEXT') {
                        const editor = section.querySelector('swebot-code-editor');
                        return editor ? editor.innerText : '';
                    }
                }
                return '';
            };

            data.push({
                title: item.querySelector('.suggestion-title')?.textContent?.trim() || '',
                category: item.querySelector('.suggestion-info swebot-chip')?.textContent?.trim() || '',
                description: getDetail('DESCRIPTION'),
                location: getDetail('LOCATION'),
                rationale: getDetail('RATIONALE'),
                codeContext: getCodeContext()
            });
        }

        // Third pass: Close items that were originally closed
        for (const button of itemsToCollapse) {
            button.click();
        }

        let yaml = "recommendations:\n";
        for (const item of data) {
            yaml += `  - title: ${JSON.stringify(item.title)}\n`;
            yaml += `    category: ${JSON.stringify(item.category)}\n`;
            yaml += `    description: ${JSON.stringify(item.description)}\n`;
            yaml += `    location: ${JSON.stringify(item.location)}\n`;
            yaml += `    rationale: ${JSON.stringify(item.rationale)}\n`;
            if (item.codeContext && item.codeContext.trim()) {
                const indentedCode = item.codeContext.split('\n').map(line => '      ' + line).join('\n');
                yaml += `    codeContext: |\n${indentedCode}\n`;
            } else {
                yaml += `    codeContext: ""\n`;
            }
        }

        navigator.clipboard.writeText(yaml)
            .then(() => alert('Recommendations copied to clipboard as YAML!'))
            .catch(err => alert('Failed to copy: ' + err));
    }

    function addButton() {
        if (document.getElementById('jules-export-yaml-btn')) return;

        const header = document.querySelector('.settings-header');
        if (header) {
            const btn = document.createElement('button');
            btn.id = 'jules-export-yaml-btn';
            btn.innerText = 'Copy all recommendations to YAML';
            btn.style.marginLeft = '10px';
            btn.onclick = exportRecommendations;
            header.appendChild(btn);
        }
    }

    const observer = new MutationObserver(addButton);
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Initial check
    addButton();
})();
