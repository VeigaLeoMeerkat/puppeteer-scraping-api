// Seletores
const urlAttributes = ['href', 'src', 'action', 'data', 'poster', 'manifest', 'background', 'cite', 'longdesc', 'profile', 'xlink:href'];
const cssUrlPattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;

// Funções auxiliares
const isLocalUrl = url => !url.startsWith('#') && !/^[a-z][a-z0-9+.-]*:/i.test(url);
const convertToAbsoluteUrl = (url, base = document.baseURI) => { try { return new URL(url, base).href; } catch { return url; } };
const normalizeUrl = (url, base = document.baseURI) => isLocalUrl(url) ? convertToAbsoluteUrl(url, base) : url;

// Normaliza atributos HTML, srcset e estilos inline
document.querySelectorAll('*').forEach(element => {
    for (let attributeName of urlAttributes) {
        const attributeValue = element.getAttribute(attributeName);
        if (attributeValue && isLocalUrl(attributeValue)) element.setAttribute(attributeName, convertToAbsoluteUrl(attributeValue));
    }
    if (element.hasAttribute('srcset')) {
        element.srcset = element.srcset.split(',').map(item => {
            let [urlPart, descriptor] = item.trim().split(/\s+/, 2);
            return descriptor ? `${normalizeUrl(urlPart)} ${descriptor}` : normalizeUrl(urlPart);
        }).join(', ');
    }
    if (element.style.cssText) {
        element.style.cssText = element.style.cssText.replace(cssUrlPattern, (_, quote, extractedUrl) => `url(${quote}${normalizeUrl(extractedUrl)}${quote})`);
    }
});

// Normaliza elementos <meta http-equiv="refresh">
document.querySelectorAll('meta[http-equiv="refresh"]').forEach(metaElement => {
    metaElement.content = metaElement.content.split(';').map(part => {
        let trimmedPart = part.trim();
        return /^url=/i.test(trimmedPart) ? `url=${normalizeUrl(trimmedPart.split(/=/, 2)[1])}` : trimmedPart;
    }).join('; ');
});

// Normaliza atributos CSS
for (let styleSheet of document.styleSheets) {
    let rules;
    try { rules = styleSheet.cssRules }
    catch { continue }
    const sheetBase = styleSheet.href || document.baseURI;
    for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        if (rule instanceof CSSStyleRule) {
            // background: url(...)
            for (let j = 0; j < rule.style.length; j++) {
                const prop = rule.style[j];
                const val = rule.style.getPropertyValue(prop);
                const prio = rule.style.getPropertyPriority(prop);
                if (val.includes("url(")) {
                    const fixed = val.replace(cssUrlPattern, (_, quote, extracted) => `url(${quote}${normalizeUrl(extracted, sheetBase)}${quote})`);
                    rule.style.setProperty(prop, fixed, prio);
                }
            }
        } else if (rule instanceof CSSImportRule) {
            // @import "foo.css"
            const href = rule.href;
            if (isLocalUrl(href)) {
                styleSheet.deleteRule(i);
                styleSheet.insertRule(`@import url("${convertToAbsoluteUrl(href, sheetBase)}")`, i);
            }
        } else if (rule instanceof CSSFontFaceRule) {
            // @font-face src: url(...)
            const srcVal = rule.style.getPropertyValue("src");
            if (srcVal && srcVal.includes("url(")) {
                const fixedSrc = srcVal.replace(cssUrlPattern, (_, quote, extracted) => `url(${quote}${normalizeUrl(extracted, sheetBase)}${quote})`);
                const prio = rule.style.getPropertyPriority("src");
                rule.style.setProperty("src", fixedSrc, prio);
            }
        }
    }
}
