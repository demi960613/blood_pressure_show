const totalSlides = 27;
const slideImage = document.getElementById('slide-image');
const slideSelect = document.getElementById('slide-select');
const slideRange = document.getElementById('slide-range');
const pageIndicator = document.getElementById('page-indicator');
const previousButton = document.getElementById('previous-button');
const nextButton = document.getElementById('next-button');
const fullscreenButton = document.getElementById('fullscreen-button');
const statusMessage = document.getElementById('status-message');
const presentation = document.getElementById('presentation');
const slideFrame = document.getElementById('slide-frame');
const coverLiveLink = document.getElementById('cover-live-link');
const tocHotspots = document.getElementById('toc-hotspots');
const guideButton = document.getElementById('guide-button');
const guideCount = document.getElementById('guide-count');
const guideTitle = document.getElementById('guide-title');
const guideText = document.getElementById('guide-text');
const guideNote = document.getElementById('guide-note');
const guidePreviousButton = document.getElementById('guide-previous');
const guideNextButton = document.getElementById('guide-next');
const siteDemoDialog = document.getElementById('site-demo-dialog');
const demoCloseButton = document.getElementById('demo-close');
const liveAppFrame = document.getElementById('live-app-frame');
const frameStatus = document.getElementById('frame-status');
const zoomButton = document.getElementById('zoom-button');
const zoomDialog = document.getElementById('zoom-dialog');
const zoomImage = document.getElementById('zoom-image');
const zoomCaption = document.getElementById('zoom-caption');
const zoomCloseButton = document.getElementById('zoom-close');

let currentSlide = 1;
let currentGuideStep = -1;
let liveAppDocument = null;
let liveAppObserver = null;
let targetResizeObserver = null; // 新增：用來追蹤目標元素的動態變形(如彈窗動畫)
let highlightedTarget = null;
let tourHighlightBox = null;
let liveAppRequested = false;

const guideSteps = [
    { slide: 13, target: '#selectedMemberLabel', closest: 'button', title: '確認或切換成員', text: '預設成員可直接使用；若要替其他人記錄，按成員選單切換。' },
    { slide: 13, target: '#toggleFormButton', title: '展開新增表單', text: '在線上網站按「新增」展開血壓輸入表單。這一步會直接標示網站上的按鈕。' },
    { slide: 13, target: '#recordDate', title: '輸入測量資料', text: '填入測量日期、收縮壓、舒張壓和脈搏。防呆測試請用無效值；無效資料不會被儲存。' },
    { slide: 13, target: '#submitBtn', title: '觸發防呆檢查', text: '可將收縮壓設為 20、舒張壓設為 80，按「儲存」測試防呆。這組無效資料會被拒絕，不會寫入紀錄。', note: '請勿用真實健康數值做測試；完成後按錯誤視窗中的「了解」並清空測試值。' },
    { slide: 13, target: '.app-modal-content', title: '查看防呆提示', text: '錯誤提示會在網站畫面中央出現，列出需要修正的欄位。按「了解」關閉提示，再清空測試資料。', note: '若尚未觸發錯誤，提示框會在你按下「儲存」後才出現。' },
    { slide: 15, target: '#monthFilter', title: '依月份篩選紀錄', text: '使用月份選單查看特定月份的紀錄。若瀏覽器沒有測量資料，選單可能只有「全部月份」。' },
    { slide: 15, target: '#statusFilter', title: '依血壓狀態篩選', text: '選擇狀態，查看符合條件的歷史紀錄。血壓分類僅供紀錄參考，不能取代醫療診斷。' },
    { slide: 15, target: '#btnChart30', title: '切換趨勢圖區間', text: '點選 7 天、30 天、90 天或全部，切換趨勢圖的顯示範圍。' },
    { slide: 16, target: 'button[onclick="toggleBackupMenu()"]', title: '開啟資料備份', text: '按「資料備份」展開個人及全家 CSV 匯入／匯出選項。' },
    { slide: 16, target: '#backupDropdown button[onclick*="exportSingleMemberCSV"]', title: '選擇備份方式', text: '在展開的選單中選擇個人紀錄或全家總表的匯入／匯出。操作前確認使用正確成員與備份檔；匯入會更新瀏覽器資料。', note: '請勿在示範時匯入未知檔案，或覆蓋自己的重要紀錄。' },
    { slide: 17, target: '#open-modal-btn', title: '開啟成就與心靈補給', text: '按網站頁首的「成就與心靈補給」打開遊戲化功能視窗。' },
    { slide: 17, target: '#game-modal-overlay .badges-section', title: '查看成就徽章', text: '在成就區查看目前解鎖的徽章和進度。' },
    { slide: 17, target: '#quote-display', title: '瀏覽心靈圖書館', text: '查看心靈圖書館的分類與收藏；抽卡可能消耗金幣，先確認按鈕顯示的費用再操作。' },
];

for (let page = 1; page <= totalSlides; page++) {
    const option = document.createElement('option');
    option.value = String(page);
    option.textContent = `第 ${page} 頁`;
    slideSelect.append(option);
}

function slidePath(page) {
    return `slides/slide-${String(page).padStart(2, '0')}.jpg`;
}

function updateGuideStep() {
    const step = guideSteps[currentGuideStep];
    if (!step) return;

    guideCount.textContent = `操作導覽 ${currentGuideStep + 1} / ${guideSteps.length}`;
    guideTitle.textContent = step.title;
    guideText.textContent = step.text;
    guidePreviousButton.disabled = currentGuideStep === 0;
    guideNextButton.disabled = currentGuideStep === guideSteps.length - 1;
    updateLiveTarget();
}

function clearLiveTarget() {
    tourHighlightBox?.classList.remove('is-visible');
    if (targetResizeObserver && highlightedTarget) {
        targetResizeObserver.unobserve(highlightedTarget);
    }
    highlightedTarget = null;
}

function updateHighlightBoxPosition() {
    if (!highlightedTarget || !tourHighlightBox) return;

    const targetRect = highlightedTarget.getBoundingClientRect();
    
    // 如果元素被隱藏、寬高為 0，則暫時隱藏高亮框，避免殘留在左上或右上角
    if (targetRect.width === 0 || targetRect.height === 0) {
        tourHighlightBox.style.visibility = 'hidden';
        return;
    } else {
        tourHighlightBox.style.visibility = 'visible';
    }

    const frameRect = liveAppFrame.getBoundingClientRect();
    const frameContainer = liveAppFrame.parentElement;
    const containerRect = frameContainer.getBoundingClientRect();
    const frameOriginX = frameRect.left + liveAppFrame.clientLeft;
    const frameOriginY = frameRect.top + liveAppFrame.clientTop;

    // 修復原先程式碼中的換行錯誤，確保計算正確
    tourHighlightBox.style.top = `${targetRect.top + frameOriginY - containerRect.top - frameContainer.clientTop}px`;
    tourHighlightBox.style.left = `${targetRect.left + frameOriginX - containerRect.left - frameContainer.clientLeft}px`;
    tourHighlightBox.style.width = `${targetRect.width}px`;
    tourHighlightBox.style.height = `${targetRect.height}px`;
}

function updateLiveTarget() {
    const step = guideSteps[currentGuideStep];
    if (!step || !liveAppDocument || !siteDemoDialog.open) return;

    let target = liveAppDocument.querySelector(step.target);
    if (target && step.closest) target = target.closest(step.closest);
    const notePrefix = step.note ? `${step.note} ` : '';
    
    if (!target || target.getClientRects().length === 0) {
        clearLiveTarget();
        guideNote.textContent = `${notePrefix}請先完成前一個操作，這個控制項才會出現。`;
        return;
    }

    if (highlightedTarget !== target) {
        clearLiveTarget();
        highlightedTarget = target;
        target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
        
        // 加入 ResizeObserver 來監聽元素的動態縮放 (例如彈窗打開動畫時緊密跟隨)
        if (targetResizeObserver) {
            targetResizeObserver.observe(target);
        }
        
        window.requestAnimationFrame(updateHighlightBoxPosition);
    }
    updateHighlightBoxPosition();
    tourHighlightBox.classList.add('is-visible');
    guideNote.textContent = `${notePrefix}已在右側網站標示目前步驟，請直接操作。`;
}

function handleLiveAppLoad() {
    liveAppObserver?.disconnect();
    liveAppObserver = null;
    targetResizeObserver?.disconnect();
    targetResizeObserver = null;
    clearLiveTarget();
    tourHighlightBox?.remove();
    tourHighlightBox = null;
    liveAppDocument = null;

    const expectedUrl = new URL(liveAppFrame.dataset.src);
    let frameUrl;
    try {
        frameUrl = new URL(liveAppFrame.contentWindow.location.href);
    } catch {
        liveAppDocument = null;
        frameStatus.textContent = '此預覽與線上網站不同網域，請按「另開網站 ↗」操作。';
        return;
    }
    if (frameUrl.origin !== expectedUrl.origin) {
        liveAppDocument = null;
        frameStatus.textContent = '線上網站重新導向至不同網域，請按「另開網站 ↗」操作。';
        return;
    }
    if (frameUrl.pathname !== expectedUrl.pathname) return;

    try {
        liveAppDocument = liveAppFrame.contentDocument;
        if (!liveAppDocument?.body) throw new Error('The live app document is not ready.');

        tourHighlightBox = document.createElement('div');
        tourHighlightBox.className = 'tour-highlight-box';
        tourHighlightBox.setAttribute('aria-hidden', 'true');
        liveAppFrame.parentElement.append(tourHighlightBox);
        frameStatus.textContent = '已連上實際網站。請勿儲存或匯入真實健康資料。';
        
        // 監聽網站內部結構變化
        liveAppObserver = new liveAppFrame.contentWindow.MutationObserver((mutations) => {
            if (mutations.some((mutation) => mutation.target !== tourHighlightBox)) updateLiveTarget();
        });
        liveAppObserver.observe(liveAppDocument.body, {
            attributes: true,
            attributeFilter: ['class', 'hidden', 'style'],
            childList: true,
            subtree: true,
        });

        // 初始化 ResizeObserver
        if (liveAppFrame.contentWindow.ResizeObserver) {
            targetResizeObserver = new liveAppFrame.contentWindow.ResizeObserver(() => {
                window.requestAnimationFrame(updateHighlightBoxPosition);
            });
        }

        // 新增體驗優化：當使用者點擊了被紅框標示的目標，自動跳轉到「下一步」
        liveAppDocument.addEventListener('click', (event) => {
            if (!highlightedTarget) return;
            const targetClicked = highlightedTarget.contains(event.target) || highlightedTarget === event.target;
            if (targetClicked) {
                const nextStepIdx = currentGuideStep + 1;
                // 若下個步驟在同一張投影片，則自動切換
                if (nextStepIdx < guideSteps.length && guideSteps[nextStepIdx].slide === guideSteps[currentGuideStep].slide) {
                    setTimeout(() => moveGuideStep(1), 150); // 稍微延遲讓動畫開始
                }
            }
        }, true);

        liveAppFrame.contentWindow.addEventListener('scroll', updateHighlightBoxPosition, true);
        liveAppFrame.contentWindow.addEventListener('resize', updateHighlightBoxPosition);
        window.addEventListener('resize', updateHighlightBoxPosition);
        updateGuideStep();
    } catch (error) {
        liveAppObserver?.disconnect();
        liveAppObserver = null;
        targetResizeObserver?.disconnect();
        targetResizeObserver = null;
        tourHighlightBox?.remove();
        tourHighlightBox = null;
        liveAppDocument = null;
        console.error('Unable to prepare the live-site tour.', error);
        frameStatus.textContent = '無法在嵌入頁面啟用導覽標示，請按「另開網站 ↗」操作。';
    }
}

function closeGuide() {
    if (siteDemoDialog.open) siteDemoDialog.close();
}

function handleDemoClose() {
    clearLiveTarget();
    currentGuideStep = -1;
    guideButton.setAttribute('aria-expanded', 'false');
    if (!guideButton.hidden) guideButton.focus();
}

function showSlide(page, { keepGuideStep = false } = {}) {
    const targetPage = Number(page);
    if (!Number.isInteger(targetPage) || targetPage < 1 || targetPage > totalSlides) {
        statusMessage.textContent = '頁碼無效，請選擇 1 到 27 頁。';
        return;
    }

    currentSlide = targetPage;
    slideImage.src = slidePath(currentSlide);
    slideImage.alt = `第 ${currentSlide} 頁，共 ${totalSlides} 頁`;
    slideSelect.value = String(currentSlide);
    slideRange.value = String(currentSlide);
    pageIndicator.textContent = `${currentSlide} / ${totalSlides}`;
    previousButton.disabled = currentSlide === 1;
    nextButton.disabled = currentSlide === totalSlides;
    coverLiveLink.hidden = currentSlide !== 1;
    tocHotspots.hidden = currentSlide !== 2;
    slideFrame.classList.toggle('show-toc', currentSlide === 2);
    guideButton.hidden = !guideSteps.some((step) => step.slide === currentSlide);
    zoomButton.hidden = currentSlide < 13 || currentSlide > 19;
    statusMessage.textContent = '';

    if (zoomDialog.open) {
        zoomImage.src = slidePath(currentSlide);
        zoomImage.alt = `第 ${currentSlide} 頁投影片放大檢視`;
        zoomCaption.textContent = `第 ${currentSlide} 頁 / ${totalSlides}`;
    }

    if (siteDemoDialog.open && !keepGuideStep) {
        const matchingStep = guideSteps.findIndex((step) => step.slide === currentSlide);
        if (matchingStep === -1) {
            closeGuide();
        } else {
            currentGuideStep = matchingStep;
            updateGuideStep();
        }
    }
}

previousButton.addEventListener('click', () => showSlide(currentSlide - 1));
nextButton.addEventListener('click', () => showSlide(currentSlide + 1));
slideSelect.addEventListener('change', () => showSlide(slideSelect.value));
slideRange.addEventListener('input', () => showSlide(slideRange.value));
tocHotspots.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-slide]');
    if (button) showSlide(button.dataset.slide);
});

slideImage.addEventListener('error', () => {
    statusMessage.textContent = `無法載入第 ${currentSlide} 頁，請確認圖片存在。`;
});

function openGuide() {
    const matchingStep = guideSteps.findIndex((step) => step.slide === currentSlide);
    currentGuideStep = matchingStep === -1 ? 0 : matchingStep;
    if (!siteDemoDialog.open) siteDemoDialog.showModal();
    guideButton.setAttribute('aria-expanded', 'true');
    updateGuideStep();
    if (!liveAppRequested) {
        liveAppRequested = true;
        frameStatus.textContent = '正在載入線上系統…';
        liveAppFrame.src = liveAppFrame.dataset.src;
    } else {
        updateLiveTarget();
    }
    demoCloseButton.focus();
}

function moveGuideStep(offset) {
    const nextStep = currentGuideStep + offset;
    if (nextStep < 0 || nextStep >= guideSteps.length) return;

    currentGuideStep = nextStep;
    showSlide(guideSteps[currentGuideStep].slide, { keepGuideStep: true });
    updateGuideStep();
}

guideButton.addEventListener('click', openGuide);
demoCloseButton.addEventListener('click', closeGuide);
siteDemoDialog.addEventListener('close', handleDemoClose);
liveAppFrame.addEventListener('load', handleLiveAppLoad);
guidePreviousButton.addEventListener('click', () => moveGuideStep(-1));
guideNextButton.addEventListener('click', () => moveGuideStep(1));

zoomButton.addEventListener('click', () => {
    zoomImage.src = slidePath(currentSlide);
    zoomImage.alt = `第 ${currentSlide} 頁投影片放大檢視`;
    zoomCaption.textContent = `第 ${currentSlide} 頁 / ${totalSlides}`;
    zoomDialog.showModal();
});
zoomCloseButton.addEventListener('click', () => zoomDialog.close());
zoomDialog.addEventListener('click', (event) => {
    if (event.target === zoomDialog) zoomDialog.close();
});

document.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape' && !zoomDialog.open && siteDemoDialog.open) {
        closeGuide();
        return;
    }
    if (event.target instanceof Element && event.target.closest('input, select, button, textarea')) return;

    if (['ArrowRight', 'PageDown', ' '].includes(event.key)) {
        event.preventDefault();
        showSlide(currentSlide + 1);
    } else if (['ArrowLeft', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        showSlide(currentSlide - 1);
    } else if (event.key === 'Home') {
        showSlide(1);
    } else if (event.key === 'End') {
        showSlide(totalSlides);
    }
});

fullscreenButton.addEventListener('click', async () => {
    try {
        if (document.fullscreenElement) {
            await document.exitFullscreen();
        } else {
            await document.documentElement.requestFullscreen();
        }
    } catch (error) {
        statusMessage.textContent = '無法切換全螢幕，請檢查瀏覽器權限。';
    }
});

document.addEventListener('fullscreenchange', () => {
    fullscreenButton.textContent = document.fullscreenElement ? '退出全螢幕' : '全螢幕';
});

if (!document.documentElement.requestFullscreen) {
    fullscreenButton.disabled = true;
    fullscreenButton.title = '此瀏覽器不支援全螢幕';
}

let touchStartX = null;
presentation.addEventListener('touchstart', (event) => {
    if (event.touches.length === 1) {
        touchStartX = event.touches[0].clientX;
    }
}, { passive: true });

presentation.addEventListener('touchend', (event) => {
    if (touchStartX === null || event.changedTouches.length !== 1) return;

    const swipeDistance = event.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(swipeDistance) >= 50) {
        showSlide(currentSlide + (swipeDistance < 0 ? 1 : -1));
    }
}, { passive: true });

function resizeSlideFrame() {
    const styles = window.getComputedStyle(presentation);
    const horizontalPadding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
    const verticalPadding = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
    const availableWidth = presentation.clientWidth - horizontalPadding;
    const availableHeight = presentation.clientHeight - verticalPadding;
    const width = Math.max(0, Math.min(availableWidth, availableHeight * 16 / 9));
    slideFrame.style.width = `${width}px`;
    slideFrame.style.height = `${width * 9 / 16}px`; // 修正了原本的寫法錯誤
}

const resizeObserver = new ResizeObserver(resizeSlideFrame);
resizeObserver.observe(presentation);
window.addEventListener('resize', resizeSlideFrame);
resizeSlideFrame();
showSlide(currentSlide);