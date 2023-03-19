let treeContainer = document.getElementById("treeContainer");
let treeContainerBox = null;
let connectionInletVerticalOffset = null;
let inputDataChangedDelay = null;
const localStoreKey = "genTreeInputData";

// editable with sliders:
let verticalSpacing = 0;
let horizontalSpacing = 0;
let compactedHorizontalSpacing = 0;
let numberOfCompactedGenerations = 0;

let textVertMargins = 0;
let connectionInletWidth = 0;
let connectionsMargin = 0;
let lineThickness = 0;

let AfontSize = 0;
let BfontSize = 0;
let CfontSize = 0;
let DfontSize = 0;

/**
 * Uses canvas.measureText to compute and return the width of the given text of given font in pixels.
 * @param text The text to be rendered.
 * @param {String} font The css font descriptor that text is to be rendered with (e.g. "14px verdana").
 * @see http://stackoverflow.com/questions/118241/calculate-text-width-with-javascript/21015393#21015393
 */
function getTextWidth(text, font) {
    // if given, use cached canvas for better performance
    // else, create new canvas
    let canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
    let context = canvas.getContext("2d");
    context.font = font;
    let metrics = context.measureText(text);
    return metrics.width;
};

function parseNodes(treeAsJson) {
    let result = JSON.parse(treeAsJson);
    if (!result?.length)
        throw new Error("failed to parse input: " + treeAsJson);
    if (result.length < 1)
        throw new Error("at least 1 node is required: " + treeAsJson);
    if (result.length > 127)
        throw new Error("more than 127 nodes are not supported (yet?): " + treeAsJson);
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

function updateTextVerticalMargins(margin) {
    let myRule = getCSSRule('#treeContainer p');
    myRule.style.marginTop = margin + "px";
    myRule.style.marginBottom = margin + "px";
}

function updateFontSize(cssRuleName, newFontSize) {
    let myRule = getCSSRule(cssRuleName);
    myRule.style.fontSize = newFontSize + "px";
}

function updateFontSizes() {
    updateFontSize('.text-type-a', AfontSize);
    updateFontSize('.text-type-b', BfontSize);
    updateFontSize('.text-type-c', CfontSize);
    updateFontSize('.text-type-d', DfontSize);
}

function addNodeAt(x, y, node) {
    let nodeDiv = document.createElement('div');
    addTextLines(nodeDiv, node.linesA, 'text-type-a');
    addTextLines(nodeDiv, node.linesB, 'text-type-b');
    addTextLines(nodeDiv, node.linesC, 'text-type-c');
    addTextLines(nodeDiv, node.linesD, 'text-type-d');
    nodeDiv.style.position = 'absolute';
    nodeDiv.style.zIndex = '40';
    nodeDiv.style.left = x +'px';
    nodeDiv.style.top = y + 'px';
    treeContainer.appendChild(nodeDiv);
    let firstLabelBox = (nodeDiv.firstChild ?? nodeDiv).getBoundingClientRect();

    node.inputAnchorX = firstLabelBox.left - treeContainerBox.left - connectionsMargin;
    node.outputAnchorX = firstLabelBox.right - treeContainerBox.left + connectionsMargin;
    node.isEmptyNode = firstLabelBox.width == 0;

    if (!node.isEmptyNode) {
        // connecting line inlet pointing to the middle of the first line
        // the same offset will be used for subsequent empty nodes
        connectionInletVerticalOffset = firstLabelBox.height / 2;
    }

    let nodeBoundingBox = nodeDiv.getBoundingClientRect();
    node.inputAnchorY = nodeBoundingBox.top + connectionInletVerticalOffset + textVertMargins - treeContainerBox.top;
    node.outputAnchorY = node.inputAnchorY;

    // top/bottom anchors, used when compacting is enabled
    node.topAnchorX = compactedHorizontalSpacing + nodeBoundingBox.left - treeContainerBox.left;
    node.topAnchorY = node.isEmptyNode ? node.inputAnchorY : (nodeBoundingBox.top - treeContainerBox.top - connectionsMargin + textVertMargins);
    node.bottomAnchorX = node.topAnchorX;
    node.bottomAnchorY = node.isEmptyNode ? node.inputAnchorY : (nodeBoundingBox.bottom - treeContainerBox.top + connectionsMargin - textVertMargins);
}

function addTextLines(nodeDiv, lines, cssClass) {
    if (lines?.length)
        for (let line of lines)
            addTextLine(nodeDiv, line, cssClass);
}

function addTextLine(nodeDiv, line, cssClass) {
    let paragraph = document.createElement('p');
    paragraph.classList.add(cssClass);
    paragraph.innerText = line;
    nodeDiv.appendChild(paragraph);
}

function drawStandardConnection(node1, node2) {
    drawPoly([
        // special case for empty nodes, to make all connecting lines gapless
        [node1.isEmptyNode ? (node1.outputAnchorX - 2*connectionsMargin) : node1.outputAnchorX, node1.outputAnchorY],
        [node2.inputAnchorX - connectionInletWidth, node1.outputAnchorY],
        [node2.inputAnchorX - connectionInletWidth, node2.inputAnchorY],
        [node2.inputAnchorX, node2.inputAnchorY]
    ]);
}

function drawCompactedConnection(node1, node2) {
    let startX = null;
    let startY = null;
    if (node1.outputAnchorY > node2.inputAnchorY) {
        // first node lower than second one
        startX = node1.topAnchorX;
        startY = node1.topAnchorY;
    } else {
        startX = node1.bottomAnchorX;
        startY = node1.bottomAnchorY;
    }
    drawPoly([
        [startX, startY],
        [startX, node2.inputAnchorY],
        [node2.inputAnchorX, node2.inputAnchorY]
    ]);

    // special case for empty nodes, to make all connecting lines gapless
    if (node1.isEmptyNode) {
        drawPoly([
            [node1.outputAnchorX - 2*connectionsMargin, node1.outputAnchorY],
            [node1.topAnchorX, node1.outputAnchorY]
        ]);
    }
}

function drawPoly(pointsArray) {
    let draw = SVG().addTo('#treeContainer').size(treeContainer.clientWidth, treeContainer.clientHeight);
    draw.css('position', 'absolute')
    draw.css('z-index', '20')
    let polyline = draw.polyline(pointsArray);
    polyline.fill('none');
    polyline.stroke({ color: '#000', width: lineThickness, linecap: 'butt', linejoin: 'round' })
}

function redraw() {
    try {
        const start = performance.now();
        redrawImpl();
        const redrawTime = parseInt(performance.now() - start);
        console.log(`Redraw time: ${redrawTime} ms`);
    } catch (error) {
        treeContainer.innerHTML = "ERROR: " + error;
        console.error(error);
    }
}

function getPositionY(generation, positionInGen, maxGeneration) {
    let partHeight = verticalSpacing * Math.pow(2, maxGeneration - generation);
    return (positionInGen * 2 + 1) * partHeight;
}

function moveByOffset(elements, x, y) {
    for(let element of elements) {
        element.style.left = (parseInt(element.style.left) || 0) + x + 'px';
        element.style.top = (parseInt(element.style.top) || 0) + y + 'px';
    }
}

function nearestExponentOf2(N)
{
    let a = Math.floor(Math.log2(N));
    return Math.pow(2, a) === N ?  a : a + 1;
}

// return zero-based generation (level in the tree, root is 0)
function genForArrayIndex(N) {
    return nearestExponentOf2(N+2) - 1;
}

function redrawImpl() {
    treeContainer.innerHTML = "";
    connectionInletVerticalOffset = null;

    // expand horizontally, to avoid text wrapping
    treeContainer.style.width = '9999px';
    
    treeContainerBox = treeContainer.getBoundingClientRect();

    let nodesArray = parseNodes(document.getElementById("treeInputData").value);

    let maxGeneration = genForArrayIndex(nodesArray.length-1);

    // create empty nodes, so the last generation has exactly 2^n elements
    while(maxGeneration == genForArrayIndex(nodesArray.length )) {
        nodesArray.push({});
    }

    let minVerticalPos = 99999;

    for (let i = 0; i < nodesArray.length; i++) {
        let generation = genForArrayIndex(i);
        let genSize = Math.pow(2, generation);
        let positionInGen = i - genSize + 1;
        let node = nodesArray[i];
        let x = horizontalSpacing * (Math.max(0, generation - numberOfCompactedGenerations))
            + (compactedHorizontalSpacing + connectionInletWidth + connectionsMargin) * Math.min(generation, numberOfCompactedGenerations); 
        let y = getPositionY(generation, positionInGen, maxGeneration);
        minVerticalPos = Math.min(minVerticalPos, y);
        addNodeAt(x, y, node);
    }

    for (let i = 0; i < (nodesArray.length-1) / 2; i++) {
        let node = nodesArray[i];
        let otherA = nodesArray[i*2+1]
        let otherB = nodesArray[i*2+2]

        let generation = genForArrayIndex(i);
        if (generation < numberOfCompactedGenerations) {
            drawCompactedConnection(node, otherA);
            drawCompactedConnection(node, otherB);
        } else {
            drawStandardConnection(node, otherA);
            drawStandardConnection(node, otherB);
        }
    }

    if (textVertMargins < 0) {
        minVerticalPos += textVertMargins;
    }

    moveByOffset(treeContainer.children, 2, -minVerticalPos);

    // now crop treeContainer to the actual width/height
    let maxRight = 0;
    let maxBottom = 0;

    for (let element of treeContainer.children) {
        if (element.tagName.toLowerCase() == 'div') {
            let boundingBox = element.getBoundingClientRect();
            maxRight = Math.max(maxRight, boundingBox.right - treeContainerBox.left);
            maxBottom = Math.max(maxBottom, boundingBox.bottom - treeContainerBox.top);
        }
    }

    treeContainer.style.width = maxRight + 2 + 'px';
    treeContainer.style.height = maxBottom + Math.abs(textVertMargins) + 'px';

    for (let element of treeContainer.children) {
        if (element.tagName.toLowerCase() == 'svg') {
            element.style.width = treeContainer.style.width;
            element.style.height = parseInt(treeContainer.style.height) + minVerticalPos + "px";
        }
    }
}

function onInputDataChangedWithDelay() {
    clearTimeout(inputDataChangedDelay);
    inputDataChangedDelay = setTimeout(onInputDataChanged, 200);
}

function onInputDataChanged() {
    localStorage.setItem(localStoreKey, document.getElementById("treeInputData").value);
    redraw();
}

function defaultInputData() {
    return `[
        {"linesA":["1 line A"], "linesC":["line C"], "linesD":["line D", "line D 2", "line D 3"]},
        {},
        {"linesB":["3 line B"], "linesC":["line C"], "linesD":["line D", "line D 2", "line D 3"]},
        {"linesA":["4 line A"], "linesC":["line C"], "linesD":["line D", "line D 2", "line D 3"]},
        {},
        {"linesA":["6 line A"], "linesC":["line C"], "linesD":["line D", "line D 2", "line D 3"]},
        {"linesB":["7 line B"], "linesC":["line C"], "linesD":["line D", "line D 2", "line D 3"]},
        {"linesA":["8 line A"], "linesC":["line C"], "linesD":["line D", "line D 2", "line D 3"]},
        {"linesB":["9 line B"], "linesC":["line C"], "linesD":["line D", "line D 2", "line D 3"]},
        {"linesA":["10 line A"], "linesC":["line C"], "linesD":["line D", "line D 2", "line D 3"]}
]`;
}

function clearInputData() {
    localStorage.removeItem(localStoreKey);
    populateInputTextArea();
    redraw();
}

function populateInputTextArea() {
    document.getElementById("treeInputData").value = localStorage.getItem(localStoreKey)?? defaultInputData();
}

function updateLabelFromSlider(labelName, sliderName) {
    let slider = document.getElementById(sliderName);
    document.getElementById(labelName).innerHTML = slider.value;
    return parseInt(slider.value);
}

function parseAllParams() {
    verticalSpacing = updateLabelFromSlider('verticalSpacing', 'verticalSpacingSlider');
    horizontalSpacing = updateLabelFromSlider('horizontalSpacing', 'horizontalSpacingSlider');
    compactedHorizontalSpacing = updateLabelFromSlider('compactedHorizontalSpacing', 'compactedHorizontalSpacingSlider');
    numberOfCompactedGenerations = updateLabelFromSlider('numberOfCompactedGenerations', 'numberOfCompactedGenerationsSlider');

    textVertMargins = updateLabelFromSlider('textVertMargins', 'textVertMarginsSlider');
    connectionInletWidth = updateLabelFromSlider('connectionInletWidth', 'connectionInletWidthSlider');
    connectionsMargin = updateLabelFromSlider('connectionsMargin', 'connectionsMarginSlider');
    lineThickness = updateLabelFromSlider('lineThickness', 'lineThicknessSlider');

    AfontSize = updateLabelFromSlider('AfontSize', 'AfontSizeSlider');
    BfontSize = updateLabelFromSlider('BfontSize', 'BfontSizeSlider');
    CfontSize = updateLabelFromSlider('CfontSize', 'CfontSizeSlider');
    DfontSize = updateLabelFromSlider('DfontSize', 'DfontSizeSlider');

    updateTextVerticalMargins(textVertMargins);
    updateFontSizes();

    redraw();
}

function init() {
    populateInputTextArea();

    document.getElementById("treeInputData").oninput = onInputDataChangedWithDelay;

    document.getElementById("verticalSpacingSlider").oninput = parseAllParams;
    document.getElementById("horizontalSpacingSlider").oninput = parseAllParams;
    document.getElementById("compactedHorizontalSpacingSlider").oninput = parseAllParams;
    document.getElementById("numberOfCompactedGenerationsSlider").oninput = parseAllParams;

    document.getElementById("textVertMarginsSlider").oninput = parseAllParams;
    document.getElementById("connectionInletWidthSlider").oninput = parseAllParams;
    document.getElementById("connectionsMarginSlider").oninput = parseAllParams;
    document.getElementById("lineThicknessSlider").oninput = parseAllParams;

    document.getElementById("AfontSizeSlider").oninput = parseAllParams;
    document.getElementById("BfontSizeSlider").oninput = parseAllParams;
    document.getElementById("CfontSizeSlider").oninput = parseAllParams;
    document.getElementById("DfontSizeSlider").oninput = parseAllParams;

    parseAllParams();
}

init();
