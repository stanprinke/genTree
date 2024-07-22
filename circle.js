let circleContainer = document.getElementById("circleContainer");
let redrawTime = document.getElementById("redrawTime");
let circleContainerBox = null;
let circleRadiusPlusPadding = 0;
let inputDelay = null;
let removeZoomListener = null;
const localStoreKey = "circleInputData";

// editable with sliders:
let segmentThickness = 20;
let lineThickness = 0;
let globalPadding = 0;
let globalRotation = 0;
let enableOutline = false;
let instantRedraw = true;

/**** Saving as PNG ****/ 

    /** current timestamp as string: yyyy-MM-dd_HH-mm-ss */
    function getTimestamp() {
        const pad = (n,s=2) => (`${new Array(s).fill(0)}${n}`).slice(-s);
        const d = new Date();
        return `${pad(d.getFullYear(),4)}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function save2pngImpl() {
        redraw();

        try {
            let dataUrl = await htmlToImage.toPng(document.getElementById('circleContainer'));
            const tmpAnchor = document.createElement('a');
            tmpAnchor.href = dataUrl;
            tmpAnchor.download = "circle_" + getTimestamp();
            tmpAnchor.click();
            tmpAnchor.remove();
        }
        catch (error) {
            console.error("ERROR: " + error);
            showInfo("ERROR:", error);
        }
    }

    async function save2png() {
        try {
            document.getElementById('saveSpinner').classList.remove("d-none");
            document.getElementById('saveButton').classList.add("disabled");
            await sleep(20);
            await save2pngImpl();
        } finally {
            await sleep(200);
            document.getElementById('saveSpinner').classList.add("d-none");
            document.getElementById('saveButton').classList.remove("disabled");
        }
    }

/****  ****/ 

    function showError(message, details) {
        circleContainer.style.width = '999px';
        circleContainer.style.height = '200px';

        circleContainer.innerHTML =
            `<div style="outline: 12px solid red; padding: 50px; width: fit-content;">
                <h3>${message}</h3>
                <p>${details}</p>
            </div>`;

        adjustcircleContainerSize();
    }

/****  ****/ 

function parseNodes(circleInputJson) {
    if (!circleInputJson || (circleInputJson.trim().length == 0))
        throw new Error("provided JSON input is empty!");

    let result = JSON.parse(circleInputJson);
    if (!(result instanceof Array))
        throw new Error("input should be an array of booleans: " + circleInputJson);
    if (result.length < 1)
        return [false];
    return result;
}

function getCSSRule(ruleName) {
    let styleSheet = document.getElementById("myStyle").sheet;
    ruleName = ruleName.toLowerCase();
    let find = Array.prototype.find;

    return find.call(styleSheet.cssRules, cssRule => {
        return cssRule instanceof CSSStyleRule 
            && cssRule.selectorText.toLowerCase() == ruleName;
    });
}

function updateOutline() {
    let myRule = getCSSRule('#circleContainer');
    myRule.style.outlineWidth = (enableOutline ? lineThickness : 0) + "px";
    myRule.style.outlineOffset = (enableOutline ? -lineThickness : 0) + "px";
}

function redrawWithDelay() {
    clearTimeout(inputDelay);
    inputDelay = setTimeout(redraw, 200);
}

function redraw() {
    try {
        const start = performance.now();
        redrawImpl();
        const elapsed = parseInt(performance.now() - start);
        redrawTime.innerHTML = elapsed;
    } catch (error) {
        console.error(error);
        showError("ERROR:", error);
    }
}

function nearestExponentOf2(N)
{
    let a = Math.floor(Math.log2(N));
    return Math.pow(2, a) === N ?  a : a + 1;
}

// return zero-based generation (level in the tree, root is 0)
// 0 returns 0
// 1-2 return 1
// 3-6 return 2
// 7-14 return 3
// 15-30 return 4
// 31-62 return 5
function generationForArrayIndex(N) {
    return nearestExponentOf2(N+2) - 1;
}

function redrawImpl() {
    circleContainer.innerHTML = "";

    let boolArray = parseNodes(document.getElementById("circleInputData").value);
    let maxGeneration = generationForArrayIndex(boolArray.length);
    // create empty nodes, so the last generation has exactly 2^n elements
    while(maxGeneration == generationForArrayIndex(boolArray.length + 1 )) {
        boolArray.push(false);
    }
    
    circleRadiusPlusPadding = Math.round((maxGeneration)*segmentThickness + globalPadding + lineThickness/2 + (enableOutline?lineThickness:0));

    circleContainer.style.width = circleRadiusPlusPadding*2 + 'px';
    circleContainer.style.height = circleRadiusPlusPadding*2 + 'px';

    circleContainerBox = circleContainer.getBoundingClientRect();

    for (let i = 0; i < boolArray.length; i++) {
        drawAncestor(i+1, boolArray[i]);
    }
}

//ancestorIndex: 1-father, 2-mother, 3-father's father, etc.
function drawAncestor(ancestorIndex, isKnown) {
    if (ancestorIndex <= 0)
        throw new Error("got invalid ancestorIndex: " + ancestorIndex);

    let generation = generationForArrayIndex(ancestorIndex);
    // zero-based:
    let genSize = Math.pow(2, generation);
    let positionInGen = ancestorIndex - genSize + 1;
    let anglePerAncestorInThisGen = Math.PI * 2 / genSize;
    let startAngle = positionInGen * anglePerAncestorInThisGen + Math.PI*(globalRotation/180.0);
    let endAngle = (positionInGen + 1) * anglePerAncestorInThisGen + Math.PI*(globalRotation/180.0);
    let outerRadius = (generation) * segmentThickness;
    let innerRadius = (generation -1) * segmentThickness;
    
    let startSinus = Math.sin(startAngle);
    let startCosin = Math.cos(startAngle);
    let endSinus = Math.sin(endAngle);
    let endCosin = Math.cos(endAngle);

    //math coordinates, centered around [0,0]
    let x1 = startSinus * innerRadius;
    let y1 = startCosin * innerRadius;
    let x2 = startSinus * outerRadius;
    let y2 = startCosin * outerRadius;
    let x3 = endSinus * outerRadius;
    let y3 = endCosin * outerRadius;
    let x4 = endSinus * innerRadius;
    let y4 = endCosin * innerRadius;
    
    drawAncestorPath(isKnown, x1, y1, x2, y2, x3, y3, x4, y4, innerRadius, outerRadius);
}

function drawAncestorPath(isKnown, x1, y1, x2, y2, x3, y3, x4, y4, innerRadius, outerRadius) {
    // remap coordinates
    x1 += circleRadiusPlusPadding;
    x2 += circleRadiusPlusPadding;
    x3 += circleRadiusPlusPadding;
    x4 += circleRadiusPlusPadding;
    y1 = -y1 + circleRadiusPlusPadding;
    y2 = -y2 + circleRadiusPlusPadding;
    y3 = -y3 + circleRadiusPlusPadding;
    y4 = -y4 + circleRadiusPlusPadding;
    
    let draw = SVG().addTo(circleContainer).size(circleContainerBox.width, circleContainerBox.height);
    draw.css('position', 'absolute')
    draw.css('left', '0px')
    draw.css('top', '0px')
    draw.css('z-index', '20')

    // M - move to
    // L - line to
    // A - elliptical arc curve
    // Z - close path (to starting point)
    let pathString = `M ${x2} ${y2} A ${outerRadius} ${outerRadius} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${innerRadius} ${innerRadius} 0 0 0 ${x1} ${y1} Z`;
    let path = draw.path(pathString)
    if (isKnown)
        path.fill('limegreen');
    else
        path.fill('none');
    path.stroke({ color: '#000', width: lineThickness, linecap: 'butt', linejoin: 'round' })
}

function onInputDataChanged() {
    localStorage.setItem(localStoreKey, document.getElementById("circleInputData").value);
    redrawWithDelay();
}

function defaultInputData() {
    return `[
    true, true,
    true, false, true, true,
    true, false, false, false, true, true, true
]
`;
}

function clearInputData() {
    localStorage.removeItem(localStoreKey);
    populateInputTextArea();
    redrawWithDelay();
}

function populateInputTextArea() {
    document.getElementById("circleInputData").value = localStorage.getItem(localStoreKey) ?? defaultInputData();
}

function updateLabelFromSlider(labelName, sliderName) {
    let slider = document.getElementById(sliderName);
    document.getElementById(labelName).innerHTML = slider.value;
    return parseFloat(slider.value);
}

function getBoolFromCheckbox(elementName) {
    return document.getElementById(elementName).checked;
}

function parseParamsFromInputElements() {
    segmentThickness = updateLabelFromSlider('segmentThickness', 'segmentThicknessSlider');
    lineThickness = updateLabelFromSlider('lineThickness', 'lineThicknessSlider');
    globalPadding = updateLabelFromSlider('globalPadding', 'globalPaddingSlider');
    globalRotation = updateLabelFromSlider('globalRotation', 'globalRotationSlider');

    enableOutline = getBoolFromCheckbox('enableOutlineCheckbox');
    instantRedraw = getBoolFromCheckbox('instantRedrawCheckbox');

    updateOutline();

    let urlParams = new URLSearchParams();
    updateUrlParamFromElement(urlParams, 'lm', 'segmentThicknessSlider');
    updateUrlParamFromElement(urlParams, 'lt', 'lineThicknessSlider');
    updateUrlParamFromElement(urlParams, 'gp', 'globalPaddingSlider');
    updateUrlParamFromElement(urlParams, 'gr', 'globalRotationSlider');

    updateUrlParamFromCheckbox(urlParams, 'eo', 'enableOutlineCheckbox');
    updateUrlParamFromCheckbox(urlParams, 'ir', 'instantRedrawCheckbox');

    window.history.replaceState(null, "", window.location.href.split('?')[0] + '?' + urlParams.toString());

    if (instantRedraw)
        redraw();
    else
        redrawWithDelay();
}

function clearInputParams() {
    window.location = window.location.href.split('?')[0];
    parseUrlParams();
    parseParamsFromInputElements();
    redrawWithDelay();
}

function parseUrlParams() {
    let urlParams = new URLSearchParams(window.location.search);

    updateSliderFromUrlParam(urlParams, 'lm', 'segmentThicknessSlider');
    updateSliderFromUrlParam(urlParams, 'lt', 'lineThicknessSlider');
    updateSliderFromUrlParam(urlParams, 'gp', 'globalPaddingSlider');
    updateSliderFromUrlParam(urlParams, 'gr', 'globalRotationSlider');

    updateCheckboxFromUrlParam(urlParams, 'eo', 'enableOutlineCheckbox');
    updateCheckboxFromUrlParam(urlParams, 'ir', 'instantRedrawCheckbox');
}

function updateSliderFromUrlParam(urlParams, paramName, sliderName) {
    if (urlParams.has(paramName)) {
        let test = urlParams.get(paramName);
        let test2 = parseInt(test);
        document.getElementById(sliderName).value = parseInt(urlParams.get(paramName)) || 0;
    }
}

function updateCheckboxFromUrlParam(urlParams, paramName, elementName) {
    if (urlParams.has(paramName)) {
        document.getElementById(elementName).checked = urlParams.get(paramName) == 'true';
    }
}

function updateComboFromUrlParam(urlParams, paramName, elementName) {
    if (urlParams.has(paramName)) {
        document.getElementById(elementName).value = urlParams.get(paramName);
    }
}

function updateUrlParamFromElement(urlParams, paramName, elementName) {
    let elem = document.getElementById(elementName);
    urlParams.append(paramName, elem.value);
}

function updateUrlParamFromCheckbox(urlParams, paramName, elementName) {
    urlParams.append(paramName, document.getElementById(elementName).checked);
}

const checkZoomLevel = () => {
    if (removeZoomListener != null) {
        removeZoomListener();
    }
    let mqString = `(resolution: ${window.devicePixelRatio}dppx)`;
    let media = matchMedia(mqString);
    media.addEventListener("change", checkZoomLevel);
    removeZoomListener = function () {
        media.removeEventListener("change", checkZoomLevel);
    };

    let currentZoom = window.devicePixelRatio * 100;
    currentZoom = Math.round(currentZoom * 100) / 100

    console.log("current zoom: " + currentZoom);

    let warning = document.getElementById('zoomLevelWarning');
    if (currentZoom == 100) {
        warning.classList.add("d-none");
    } else {
        warning.classList.remove("d-none");
        warning.innerHTML = `Warning! Browser zoom is set to ${currentZoom}%, output PNG files will also be scaled`;
    }

    redrawWithDelay();
};

function init() {
    populateInputTextArea();
    checkZoomLevel();
    parseUrlParams();

    document.getElementById("circleInputData").oninput = onInputDataChanged;

    document.getElementById("segmentThicknessSlider").oninput = parseParamsFromInputElements;
    document.getElementById("lineThicknessSlider").oninput = parseParamsFromInputElements;
    document.getElementById("globalPaddingSlider").oninput = parseParamsFromInputElements;
    document.getElementById("globalRotationSlider").oninput = parseParamsFromInputElements;

    document.getElementById("enableOutlineCheckbox").oninput = parseParamsFromInputElements;
    document.getElementById("instantRedrawCheckbox").oninput = parseParamsFromInputElements;

    parseParamsFromInputElements();
    onInputDataChanged();
}

init();
