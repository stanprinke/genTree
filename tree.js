let connectionsMargin = 4;
let connectionInletWidth = 10;

let treeContainer = document.getElementById("treeContainer");
let treeContainerBox = null;
let connectionInletVerticalOffset = null;
let redrawDelay = null;

// editable with sliders:
let horizontalSpacing = 0;
let verticalSpacing = 0;
let textVertMargins = 0;
let lineThickness = 0;

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
    if (result.length < 2)
        throw new Error("at least 2 nodes are required: " + treeAsJson);
    if (result.length >= 64)
        throw new Error("more than 63 nodes are not supported (yet?): " + treeAsJson);
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

function setTextVerticalMargins(margin) {
    let myRule = getCSSRule('#treeContainer p');
    myRule.style.marginTop = margin + "px";
    myRule.style.marginBottom = margin + "px";
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

    if (connectionInletVerticalOffset == null) {
        // connecting line inlet pointing to the middle of the first line
        // the same offset will be used for other nodes (assuming here the first node is not empty)
        connectionInletVerticalOffset = firstLabelBox.height / 2;
    }

    let nodeBoundingBox = nodeDiv.getBoundingClientRect();
    node.inputAnchorY = nodeBoundingBox.top + connectionInletVerticalOffset + textVertMargins - treeContainerBox.top;
    node.outputAnchorY = node.inputAnchorY;
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

function drawConnection(node1, node2) {
    let draw = SVG().addTo('#treeContainer').size(treeContainer.clientWidth, treeContainer.clientHeight);
    draw.css('position', 'absolute')
    draw.css('z-index', '20')
    let points = [
        // special case for empty nodes, to make all connecting lines gapless
        [node1.isEmptyNode ? (node1.outputAnchorX - 2*connectionsMargin) : node1.outputAnchorX, node1.outputAnchorY],
        [node2.inputAnchorX - connectionInletWidth, node1.outputAnchorY],
        [node2.inputAnchorX - connectionInletWidth, node2.inputAnchorY],
        [node2.inputAnchorX], [node2.inputAnchorY]
    ];
    let polyline = draw.polyline(points);
    polyline.fill('none');
    polyline.stroke({ color: '#000', width: lineThickness, linecap: 'round', linejoin: 'round' })

}

function redraw() {
    try {
        redrawImpl();
    } catch (error) {
        treeContainer.innerHTML = "ERROR: " + error;
        console.error(error);
    }
}

function redrawWithDelay() {
    clearTimeout(redrawDelay);
    redrawDelay = setTimeout(redraw, 200);
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
        let x = generation * horizontalSpacing;
        let y = getPositionY(generation, positionInGen, maxGeneration);
        minVerticalPos = Math.min(minVerticalPos, y);
        addNodeAt(x, y, node);
    }

    for (let i = 0; i < (nodesArray.length-1) / 2; i++) {
        let node = nodesArray[i];
        let otherA = nodesArray[i*2+1]
        let otherB = nodesArray[i*2+2]
        drawConnection(node, otherA);
        drawConnection(node, otherB);
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

function init() {
    let treeInputData = document.getElementById("treeInputData");
    treeInputData.oninput = function() {
        redrawWithDelay();
    }

    let slider1 = document.getElementById("verticalSpacingSlider");
    slider1.oninput = function() {
        verticalSpacing = parseInt(this.value);
        let label = document.getElementById("verticalSpacing");
        label.innerHTML = this.value;
        redraw();
    }
    slider1.dispatchEvent(new Event('input', {value: slider1.value}));

    let slider2 = document.getElementById("horizontalSpacingSlider");
    slider2.oninput = function() {
        horizontalSpacing = parseInt(this.value);
        let label = document.getElementById("horizontalSpacing");
        label.innerHTML = horizontalSpacing;
        redraw();
    }
    slider2.dispatchEvent(new Event('input', {value: slider2.value}));

    let slider3 = document.getElementById("textVertMarginsSlider");
    slider3.oninput = function() {
        let label = document.getElementById("textVertMargins");
        label.innerHTML = this.value;
        textVertMargins = parseInt(this.value);
        setTextVerticalMargins(this.value);
        redraw();
    }
    slider3.dispatchEvent(new Event('input', {value: slider3.value}));


    let slider4 = document.getElementById("lineThicknessSlider");
    slider4.oninput = function() {
        lineThickness = parseInt(this.value);
        let label = document.getElementById("lineThickness");
        label.innerHTML = this.value;
        redraw();
    }
    slider4.dispatchEvent(new Event('input', {value: slider4.value}));
}

init();
