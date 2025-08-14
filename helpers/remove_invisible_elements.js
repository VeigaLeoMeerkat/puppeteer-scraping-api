const excludeTags = ['HEAD', 'SCRIPT', 'STYLE', 'LINK', 'META'];
const minOpacity = 0.01;

// Verifica se uma cor CSS é transparente
function isTransparentColor(color) {
    if (!color) return true;
    color = color.trim().toLowerCase();
    if (color === 'transparent') return true;
    const m = color.match(/rgba?\(([^)]+)\)/);
    if (m) {
        const parts = m[1].split(/[,/]/).map(s => s.trim()).filter(Boolean);
        if (parts.length === 4) return parseFloat(parts[3]) === 0;
        return false;
    }
    return false;
}

// Detecta se o estilo computado faz o elemento desenhar algo (bg, border, shadow, etc.)
function paintsSomething(style) {
    if (!style) return false;
    if (style.backgroundImage && style.backgroundImage !== 'none') return true;
    if (style.backgroundColor && !isTransparentColor(style.backgroundColor)) return true;
    const bw = (parseFloat(style.borderTopWidth || '0') +
        parseFloat(style.borderRightWidth || '0') +
        parseFloat(style.borderBottomWidth || '0') +
        parseFloat(style.borderLeftWidth || '0'));
    const borderStyle = (style.borderTopStyle || style.borderStyle || '').toLowerCase();
    if (bw > 0 && borderStyle !== 'none' && borderStyle !== '') {
        if (!isTransparentColor(style.borderTopColor || style.borderColor)) return true;
    }
    if (style.boxShadow && style.boxShadow !== 'none') return true;
    if (style.outlineStyle && style.outlineStyle !== 'none' && parseFloat(style.outlineWidth || '0') > 0) return true;
    if ((style.maskImage && style.maskImage !== 'none') || (style.borderImageSource && style.borderImageSource !== 'none')) return true;
    if (style.listStyleImage && style.listStyleImage !== 'none') return true;
    return false;
}

// Verifica se background-attachment inclui 'fixed'
function backgroundAttachmentIsFixed(style) {
    if (!style) return false;
    const att = (style.backgroundAttachment || '').toLowerCase();
    return att.includes('fixed');
}

// Verifica se pseudo-elementos ::before/::after desenham algo ou têm conteúdo
function pseudoPaints(el) {
    try {
        const before = getComputedStyle(el, '::before');
        const after = getComputedStyle(el, '::after');
        if (before) {
            if ((before.content && before.content !== 'none' && before.content !== '""' && before.content !== "''")
                || paintsSomething(before)
                || backgroundAttachmentIsFixed(before)) return true;
        }
        if (after) {
            if ((after.content && after.content !== 'none' && after.content !== '""' && after.content !== "''")
                || paintsSomething(after)
                || backgroundAttachmentIsFixed(after)) return true;
        }
    } catch (e) { }
    return false;
}

// Verifica se algum ancestral tem background-image com attachment: fixed
function hasFixedBackgroundAncestor(el) {
    for (let a = el; a && a.nodeType === 1; a = a.parentElement) {
        try {
            const s = getComputedStyle(a);
            if (!s) continue;
            if (s.backgroundImage && s.backgroundImage !== 'none' && backgroundAttachmentIsFixed(s)) return true;
        } catch (e) { }
    }
    return false;
}

// Verifica se existe um ancestral que oculte o elemento (display: none, visibility, opacity baixa)
function hasHiddenAncestor(el) {
    for (let a = el; a && a.nodeType === 1; a = a.parentElement) {
        const s = getComputedStyle(a);
        if (!s) continue;
        if (s.display === 'none') return true;
        if (s.visibility === 'hidden' || s.visibility === 'collapse') return true;
        const op = parseFloat(s.opacity);
        if (!isNaN(op) && op <= minOpacity) return true;
    }
    return false;
}

// Verifica se elemento <img> provavelmente está carregada/desenhando
function imgLikelyPaints(imgEl) {
    if (!imgEl || imgEl.tagName !== 'IMG') return false;
    try {
        const style = getComputedStyle(imgEl);
        const pos = style && style.position ? style.position.toLowerCase() : '';
        const objFit = style && style.objectFit ? style.objectFit.toLowerCase() : '';

        const hasSrc = Boolean(imgEl.currentSrc || imgEl.src);
        if (!hasSrc) return false;

        // Se carregamento foi concluído e tamanho natural está presente, considerar visível
        if (imgEl.complete && (imgEl.naturalWidth > 0 || imgEl.naturalHeight > 0)) return true;

        // Se o elemento atualmente ocupa espaço no layout (client rects), considerar visível
        try {
            if (imgEl.getClientRects && imgEl.getClientRects().length > 0) return true;
        } catch (e) { }

        // Caso especial: imagens com position + object-fit podem ser exibidas mesmo que sua caixa seja computada como zero;
        // se a imagem tiver uma source (currentSrc), considerar visível.
        if ((pos === 'absolute' || pos === 'fixed' || pos === 'sticky') && objFit && objFit !== 'none') {
            return true;
        }

        // Se currentSrc existe (source selecionada de um <picture> ou srcset), considerar visível
        if (imgEl.currentSrc) return true;
    } catch (e) {
        // Se algum teste falhar, considerar visível
        return true;
    }
    return false;
}

// Verifica se um <picture> contém ao menos um <img> que provavelmente está visível
function pictureContainsVisibleImg(pictureEl) {
    if (!pictureEl || pictureEl.tagName !== 'PICTURE') return false;
    try {
        const imgs = pictureEl.querySelectorAll('img');
        for (const img of imgs) {
            if (imgLikelyPaints(img)) return true;
        }
    } catch (e) {
        return false;
    }
    return false;
}

// Verifica se algum ancestral <picture> contém uma imagem visível
function hasVisiblePictureAncestor(el) {
    const pic = el.closest ? el.closest('picture') : null;
    if (pic) return pictureContainsVisibleImg(pic);
    return false;
}

// Decide se um elemento é considerado visível pelo conjunto de heurísticas definidas
function isRenderedVisible(el) {
    if (!(el instanceof Element)) return false;
    if (!el.isConnected) return false;
    if (el === document.documentElement || el === document.body) return true;
    if (excludeTags.includes(el.tagName)) return true;

    let style;
    try {
        style = getComputedStyle(el);
    } catch (e) {
        return true; // Se estilo não pôde ser computado, considerar visível
    }
    if (!style) return false;
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    const op = parseFloat(style.opacity);
    if (!isNaN(op) && op <= minOpacity) return false;
    if (hasHiddenAncestor(el.parentElement)) return false;
    if (paintsSomething(style) || pseudoPaints(el)) return true;
    if (backgroundAttachmentIsFixed(style) && style.backgroundImage && style.backgroundImage !== 'none') return true;
    if (hasFixedBackgroundAncestor(el)) return true;
    if (el.tagName === 'IMG' && imgLikelyPaints(el)) return true;
    if (el.tagName === 'PICTURE' && pictureContainsVisibleImg(el)) return true;
    if (hasVisiblePictureAncestor(el)) return true;

    // Por fim, testar os retângulos de layout
    try {
        if (el.getClientRects().length === 0) return false;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return false;
    } catch (e) {
        return false;
    }

    return true;
}

// Percorre o DOM (inclui shadow roots abertos) e coleta elementos
const allElems = [];
(function walk(node) {
    if (!node) return;
    if (node.shadowRoot) {
        for (const ch of node.shadowRoot.children) walk(ch);
    }
    if (node.nodeType === 1) {
        allElems.push(node);
        for (const child of node.children) walk(child);
    }
})(document.documentElement);

// Marca elementos invisíveis para remoção
const toRemove = [];
for (const el of allElems) {
    if (el === document.documentElement || el === document.body) continue;
    if (excludeTags.includes(el.tagName)) continue;
    if (!isRenderedVisible(el)) toRemove.push(el);
}

// Remove os elementos marcados
let removed = 0;
for (const el of toRemove) {
    try { el.remove(); removed++; } catch (e) { /* ignora falhas */ }
}

console.log(`Remoção de elementos invisíveis: ${allElems.length} inspecionados, ${removed} removidos.`);
