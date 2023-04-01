let treeContainer = document.getElementById("treeContainer");
let redrawTime = document.getElementById("redrawTime");
let treeContainerBox = null;
let connectionInletVerticalOffset = null;
let inputDataChangedDelay = null;
let removeZoomListener = null;
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
let alignWithPixels = true;

let majorFontSize = 0;
let minorFontSize = 0;
let refsVertPadding = 0;
let refsHorizPadding = 0;
let refsVertAlignment = 0;
let fwdRefsVertOffset = 0;
let alignRefsHorizontally = 0;

let fonts = [
    "Fira Sans", "Inter", "Istok Web", "Open Sans", "Roboto", "Roboto Condensed", "Roboto Slab", "Ubuntu", "Verdana",
    "--- browser default font ---",
    "Arial", "Alegreya Sans", "Calibri", "Cambria", "Comfortaa", "DM Sans",
    "Eczar", "Exo", "Georgia", "Helvetica", "IBM Plex Sans", "Karla", "Lato", "Libre Baskerville", "Libre Franklin",
    "Lora", "Manrope", "Merriweather", "Mina", "Montserrat", "Nobile", "Noto Sans", "Oswald",
    "PT Sans", "PT Serif", "Poppins", "Proza Libre", "Segoe UI", "Source Sans Pro", "Space Grotesk", "Work Sans"];

/**** Saving current tree as PNG ****/ 

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
            let dataUrl = await htmlToImage.toPng(document.getElementById('treeContainer'));
            const tmpAnchor = document.createElement('a');
            tmpAnchor.href = dataUrl;
            tmpAnchor.download = "tree_" + getTimestamp();
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


/**** Saving trees from multiple files as zipped PNGs ****/ 

    let jsonFilesQueue = [];
    let processedFiles = [];
    let zipWithPngs = null;

    function changeExtension(filename, fromExt, toExt) {
        let root = filename.substring(0, filename.length - fromExt.length);
        return `${root}${toExt}`;
    }

    async function saveMany2png() {
        try {
            document.getElementById('saveManySpinner').classList.remove("d-none");
            document.getElementById('saveManyButton').classList.add("disabled");
            await sleep(20);
            await saveMany2pngImpl();
        } finally {
            document.getElementById('saveManySpinner').classList.add("d-none");
            document.getElementById('saveManyButton').classList.remove("disabled");
        }
    }

    async function saveMany2pngImpl() {
        if (jsonFilesQueue.length) {
            throw new Error("array 'jsonFiles' is not empty!");
        }

        jsonFilesQueue = [];
        processedFiles = [];
        let otherFilesCount = 0;

        const dirHandle = await window.showDirectoryPicker();
        for await (const entry of dirHandle.values()) {
            if (entry.kind == 'file') {
                if (entry.name.endsWith('.json')) {
                    // Read the contents of the file as text
                    const fileHandle = await entry.getFile();
                    const fileContents = await fileHandle.text();
                    jsonFilesQueue.push({ fileName: entry.name, fileContents });
                } else {
                    otherFilesCount++;
                }
            }
        }

        console.log(`Found ${jsonFilesQueue.length} json file(s) to process`)
        if (jsonFilesQueue.length) {
            zipWithPngs = new JSZip();

            setTimeout(() => {
                processNextJsonFromQueue();
            }, 1);
        } else {
            showInfo("No '.json' files found!", `There were ${otherFilesCount} other file(s) in the selected directory`);
        }
    }

    async function processNextJsonFromQueue() {
        if (!jsonFilesQueue.length) {
            updateBatchProgress("");
            saveZipWithPngs();
        } else {
            updateBatchProgress(`${jsonFilesQueue.length} file(s) left to process...`)
            let currFile = jsonFilesQueue.shift();
            console.log("Processing file: " + currFile.fileName);
            document.getElementById("treeInputData").value = currFile.fileContents;
            redraw();

            setTimeout(() => {
                addPngScreenshotToZip(currFile.fileName);
            }, 1);
        }
    }

    function updateBatchProgress(message) {
        let batchProgressInfo = document.getElementById('batchProgressInfo');
        if (message.length) {
            batchProgressInfo.classList.remove("d-none");
            batchProgressInfo.innerHTML = message;
        } else {
            batchProgressInfo.classList.add("d-none");
            batchProgressInfo.innerHTML = "";
        }
    }

    async function addPngScreenshotToZip(fileName) {
        try {
            console.log("adding file to zip: " + fileName);
            let png = await htmlToImage.toBlob(document.getElementById('treeContainer'));
            zipWithPngs.file(changeExtension(fileName, '.json', '.png'), png);
            processedFiles.push(fileName);
        }
        catch(error) {
            processedFiles.push(fileName + " ERROR: " + error);
            console.error('ERROR on file: ' + fileName, error);
        };

        setTimeout(() => {
            processNextJsonFromQueue();     
        }, 1);
    }

    function saveZipWithPngs() {
        console.log("saving zip");
        zipWithPngs.generateAsync({type:"blob"}).then(function(content) {
            saveAs(content, "trees_" + getTimestamp() + ".zip");
        });
        zipWithPngs = null;
        console.log("done");

        if (processedFiles.length < 22) {
            showInfo(
                `finished processing ${processedFiles.length} files!`,
                processedFiles.join('<br/>'));
        } else {
            let first10 = processedFiles.slice(0,10);
            let last10 = processedFiles.slice(-10);
            showInfo(
                `finished processing ${processedFiles.length} files!`,
                first10.join('<br/>') + `<br/>[...${processedFiles.length - 20} more...]<br/>` + last10.join('<br/>'));
        }
    }

    function showInfo(message, details) {
        treeContainer.style.width = '999px';

        treeContainer.innerHTML =
            `<div style="outline: 4px solid red; padding: 50px; width: fit-content;">
                <h3>${message}</h3>
                <p>${details}</p>
                <br/>
                <button id="btnTmpInfo" type="button" class="btn btn-info" onclick="redraw()">Dismiss this message</button>
            </div>`;

        adjustTreeContainerSize();
    }

    function showError(message, details) {
        treeContainer.style.width = '999px';

        treeContainer.innerHTML =
            `<div style="outline: 12px solid red; padding: 50px; width: fit-content;">
                <h3>${message}</h3>
                <p>${details}</p>
            </div>`;

        adjustTreeContainerSize();
    }


/**** ****/

function parseNodes(treeAsJson) {
    if (!treeAsJson)
        throw new Error("provided json was empty!");

    let result = JSON.parse(treeAsJson);
    if (!result?.items?.length)
        throw new Error("failed to parse input: " + treeAsJson);
    if (result.length < 1)
        throw new Error("at least 1 node is required: " + treeAsJson);
    if (result.length > 255)
        throw new Error("more than 255 nodes are not supported: " + treeAsJson);
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
    updateFontSize('.text-type-a', majorFontSize);
    updateFontSize('.text-type-b', majorFontSize);
    updateFontSize('.text-type-c', minorFontSize);
    updateFontSize('.text-type-d', minorFontSize);

    updateFontSize('.ref-big', majorFontSize);
    updateFontSize('.ref-small', minorFontSize);
}

function addTreeLabel(label, x, y) {
    if (!label)
        return;

    let paragraph = addTextLine(treeContainer, label, 'ref-big');
    paragraph.style.position = 'absolute';
    paragraph.style.zIndex = '40';
    paragraph.style.left = x + 'px';
    paragraph.style.top = y + 'px';

    addSvgBorder(paragraph);
}

function addSvgBorder(element) {
    // move the element to make room for the arrow
    element.style.left = (parseInt(element.style.left) || 0) + lineThickness + refsHorizPadding + 'px';
    element.style.top = (parseInt(element.style.top) || 0) + lineThickness - textVertMargins + refsVertPadding + 'px';

    let box = element.getBoundingClientRect();
    let top = refsVertAlignment  - refsVertPadding - lineThickness/2;
    let bottom = refsVertAlignment + box.height + refsVertPadding + lineThickness/2;
    let left = -refsHorizPadding - lineThickness/2
    let right = box.width + refsHorizPadding + lineThickness/2;

    drawPoly([
        [left + 1, top],
        [right, top],
        [right, bottom],
        [left, bottom],
        [left, top],
        [left + 1, top]
    ],
    element);
}

function addSvgArrowRight(element, adjustHorizPos = true, adjustVertPos = true) {
    let box = element.getBoundingClientRect();
    let arrowSize = (box.height + refsVertPadding*2 + lineThickness) / 2;

    // move the element to make room for the arrow
    if (adjustHorizPos)
        element.style.left = (parseInt(element.style.left) || 0) + lineThickness + refsHorizPadding + arrowSize +'px';
    if (adjustVertPos)
        element.style.top = (parseInt(element.style.top) || 0) + lineThickness + 'px';

    box = element.getBoundingClientRect();
    let top = refsVertAlignment - refsVertPadding - lineThickness/2;
    let bottom = refsVertAlignment + box.height + refsVertPadding + lineThickness/2;
    let vertCenter = (top + bottom) / 2;

    let left = -refsHorizPadding - lineThickness/2
    let right = box.width + refsHorizPadding + lineThickness/2;

    drawPoly(
        [
            [left, top],
            [right, top],
            [right + arrowSize, vertCenter],
            [right, bottom],
            [left - arrowSize, bottom],
            [left, vertCenter],
            [left - arrowSize, top],
            [left, top]
        ],
        element);
}

function addSvgArrowLeft(element, adjustHorizPos = true, adjustVertPos = true) {
    let box = element.getBoundingClientRect();
    let arrowSize = (box.height + refsVertPadding*2 + lineThickness) / 2;

    // move the element to make room for the arrow
    if (adjustHorizPos)
        element.style.left = (parseInt(element.style.left) || 0) + lineThickness + refsHorizPadding + arrowSize +'px';
    if (adjustVertPos)
        element.style.top = (parseInt(element.style.top) || 0) + lineThickness  + 'px';

    box = element.getBoundingClientRect();
    let top = refsVertAlignment - refsVertPadding - lineThickness/2;
    let bottom = refsVertAlignment + box.height + refsVertPadding + lineThickness/2;
    let vertCenter = (top + bottom) / 2;

    let left = -refsHorizPadding - lineThickness/2
    let right = box.width + refsHorizPadding + lineThickness/2;

    drawPoly([
        [right, top],
        [right + arrowSize, top],
        [right, vertCenter],
        [right + arrowSize, bottom],
        [left, bottom],
        [left - arrowSize, vertCenter],
        [left, top],
        [left, top],
        [right, top]
    ],
    element);
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

    if (node.back_ref) {
        let paragraph = addTextLine(nodeDiv, node.back_ref, 'ref-small');
        paragraph.style.position = 'relative';
        paragraph.style.zIndex = '40';
        paragraph.style.top = 1+ refsVertPadding - textVertMargins/2 + 'px';
    
        addSvgArrowLeft(paragraph);
    }

    if (node.side_ref) {
        let paragraph = addTextLine(nodeDiv, node.side_ref, 'ref-small');
        paragraph.style.position = 'relative';
        paragraph.style.zIndex = '40';
        paragraph.style.top = 1+ refsVertPadding - textVertMargins/2 + 'px';
    
        addSvgArrowRight(paragraph);
    }

    if (node.fwd_ref) {
        let paragraph = addTextLine(nodeDiv.firstChild, node.fwd_ref, 'ref-small');
        paragraph.style.position = 'absolute'; 
        paragraph.style.zIndex = '40';
        paragraph.style.whiteSpace = 'nowrap'

        let parBox = paragraph.getBoundingClientRect();
        
        // poor-man's vertical centering:
        paragraph.style.top = Math.round((firstLabelBox.height - parBox.height)/2) + fwdRefsVertOffset + 'px';

        paragraph.style.left = 10 + firstLabelBox.width + connectionsMargin + 'px';
        addSvgArrowRight(paragraph, true, false);

        if (node.isLastGen)
            paragraph.classList.add("alignMeHorizontally");
    }
}

function addTextLines(parentDiv, lines, cssClass) {
    if (lines?.length)
        for (let line of lines)
            addTextLine(parentDiv, line, cssClass);
}

function addTextLine(parentDiv, line, cssClass) {
    if (line) {
        let paragraph = document.createElement('p');
        paragraph.classList.add(cssClass);
        paragraph.innerText = line;
        parentDiv.appendChild(paragraph);
        return paragraph;
    }
}

function drawStandardConnection(node1, node2) {
    if (node1.outputAnchorY > node2.inputAnchorY) {
        // first node lower than the second one - include horizontal line
        drawPoly([
            // special case for empty nodes, to make all connecting lines gapless
            [node1.isEmptyNode ? (node1.outputAnchorX - 2*connectionsMargin) : node1.outputAnchorX, node1.outputAnchorY],
            [node2.inputAnchorX - connectionInletWidth, node1.outputAnchorY]
        ],
        treeContainer,
        'treeBranch');
    }

    drawPoly([
        [node2.inputAnchorX - connectionInletWidth, node1.outputAnchorY],
        [node2.inputAnchorX - connectionInletWidth, node2.inputAnchorY],
        [node2.inputAnchorX, node2.inputAnchorY]
    ],
    treeContainer,
    'treeBranch');
}

function drawCompactedConnection(node1, node2) {
    let startX = null;
    let startY = null;
    if (node1.outputAnchorY > node2.inputAnchorY) {
        // first node lower than the second one
        startX = node1.topAnchorX;
        startY = node1.topAnchorY;

        // include horizontal line, to make all connecting lines gapless
        // - for "compacted" connections this only needs te be drawn for empty nodes
        if (node1.isEmptyNode) {
            drawPoly([
                [node1.outputAnchorX - 2*connectionsMargin, node1.outputAnchorY],
                [node1.topAnchorX, node1.outputAnchorY]
            ],
            treeContainer,
            'treeBranch');
        }
    } else {
        startX = node1.bottomAnchorX;
        startY = node1.bottomAnchorY;
    }
    drawPoly([
        [startX, startY],
        [startX, node2.inputAnchorY],
        [node2.inputAnchorX, node2.inputAnchorY]
    ],
    treeContainer,
    'treeBranch');
}

function drawPoly(pointsArray, parentElem, optionalClassToAdd) {
    let minX = 9999;
    let minY = 9999;
    let maxX = -9999;
    let maxY = -9999;

    pointsArray.forEach(function(element) {
        minX = Math.min(minX, element[0]);
        maxX = Math.max(maxX, element[0]);
        minY = Math.min(minY, element[1]);
        maxY = Math.max(maxY, element[1]);
    });

    let adjustX = Math.floor(minX) - 10;
    let adjustY = Math.floor(minY) - 10;

    pointsArray.forEach(function(element) {
        element[0] -= adjustX;
        element[1] -= adjustY;
    });

    if (alignWithPixels) {
        if (lineThickness % 2 == 1) {
            pointsArray.forEach(function(element) {
                    element[0] = Math.round(element[0] + 0.5) - 0.5;
                    element[1] = Math.round(element[1] + 0.5) - 0.5;
                });
        } else {
            pointsArray.forEach(function(element) {
                element[0] = Math.round(element[0]);
                element[1] = Math.round(element[1]);
            });
        }
    }

    let draw = SVG().addTo(parentElem ? parentElem : treeContainer).size(Math.round(maxX - minX) + 20, Math.round(maxY - minY) + 20);
    draw.css('position', 'absolute')
    draw.css('left', adjustX + 'px')
    draw.css('top', adjustY + 'px')
    draw.css('z-index', '20')
    let polyline = draw.polyline(pointsArray);
    polyline.fill('none');
    polyline.stroke({ color: '#000', width: lineThickness, linecap: 'butt', linejoin: 'round' })
    if (optionalClassToAdd) {
        polyline.node.classList.add(optionalClassToAdd);
    }
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
    connectionInletVerticalOffset = 6; // some default, in case in case first nodes are empty

    // expand horizontally, to avoid text wrapping
    treeContainer.style.width = '4999px';
    
    treeContainerBox = treeContainer.getBoundingClientRect();

    let treeData = parseNodes(document.getElementById("treeInputData").value);

    let nodesArray = treeData.items;
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
        node.isLastGen = generation == maxGeneration;
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

    addTreeLabel(treeData.ref_label, 4, 4);

    if (alignRefsHorizontally)
        alignLastGenRefs();

    adjustTreeContainerSize();
}

function adjustTreeContainerSize() {
    let maxRight = -9999;
    let maxBottom = -9999;

    treeContainerBox = treeContainer.getBoundingClientRect();

    for (let element of treeContainer.getElementsByTagName("*")) {
        let elName = element.tagName.toLowerCase();
        if (elName !='svg') {
            let boundingBox = element.getBoundingClientRect();
            maxRight = Math.max(maxRight, boundingBox.right - treeContainerBox.left);
            maxBottom = Math.max(maxBottom, boundingBox.bottom - treeContainerBox.top);
        }
    }

    treeContainer.style.width = maxRight + 2 + 'px';
    treeContainer.style.height = maxBottom + 4 + 'px';
    treeContainerBox = treeContainer.getBoundingClientRect();

    // in case there's no text on the bottom nodes, make it symmetrical vertically
    // + make the last gen width the same as any other standard gen (not compacted)
    let minTop = 9999;
    maxRight = -9999;
    maxBottom = -9999;

    for (let element of treeContainer.getElementsByClassName("treeBranch")) {
        let boundingBox = element.getBoundingClientRect();
        maxRight = Math.max(maxRight, boundingBox.right - treeContainerBox.left);
        maxBottom = Math.max(maxBottom, boundingBox.bottom - treeContainerBox.top);
        minTop = Math.min(minTop, boundingBox.top - treeContainerBox.top)
    }

    let newWidth = maxRight + horizontalSpacing - connectionInletWidth;
    if (newWidth > parseInt(treeContainer.style.width))
        treeContainer.style.width = newWidth + 'px';

    let newHeight = maxBottom + minTop;
    if (newHeight > parseInt(treeContainer.style.height))
        treeContainer.style.height = newHeight + 'px';
}

function alignLastGenRefs() {
    let maxLeft = 0;
    for (let element of treeContainer.getElementsByClassName("alignMeHorizontally")) {
        let box = element.getBoundingClientRect();
        maxLeft = Math.max(maxLeft, box.left);
    }

    for (let element of treeContainer.getElementsByClassName("alignMeHorizontally")) {
        let box = element.getBoundingClientRect();
        let moveBy = maxLeft - box.left;
        if (moveBy > 0)
            element.style.left = moveBy + parseInt(element.style.left) + 'px';
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
    return `{
        "ref_label":"#1234", 
        "items":[
            {"back_ref":"#456", "linesA":["1 line A line A line A"], "linesC":["line C"], "linesD":["line D", "line D 2", "line D 3"]},
            {},
            {"linesB":["3 line B line B line B"], "linesC":["line C"], "linesD":["line D"]},
            {"side_ref":"4324:12", "linesA":["4 line A"], "linesC":["line C line C line C"], "linesD":["line D", "line D 2", "line D 3"]},
            {},
            {"side_ref":"345:3", "linesA":["6 line A"]},
            {"linesB":["7 line B"], "linesC":["line C"], "linesD":["line D"]},
            {"linesA":["8 line A"], "linesC":["line C"], "linesD":["line D"]},
            {"fwd_ref":"456", "linesB":["9 line B"], "linesC":["line C"], "linesD":["line D"]},
            {"fwd_ref":"457", "linesA":["10 line A"], "linesC":["line C"], "linesD":["line D"]},
            {"fwd_ref":"458", "linesB":["11 line B"], "linesC":["line C line C line C"], "linesD":["line D"]}
        ]
}`;
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

function getBoolFromCheckbox(elementName) {
    return document.getElementById(elementName).checked;
}

function parseParamsFromInputElements() {
    verticalSpacing = updateLabelFromSlider('verticalSpacing', 'verticalSpacingSlider');
    horizontalSpacing = updateLabelFromSlider('horizontalSpacing', 'horizontalSpacingSlider');
    compactedHorizontalSpacing = updateLabelFromSlider('compactedHorizontalSpacing', 'compactedHorizontalSpacingSlider');
    numberOfCompactedGenerations = updateLabelFromSlider('numberOfCompactedGenerations', 'numberOfCompactedGenerationsSlider');

    textVertMargins = updateLabelFromSlider('textVertMargins', 'textVertMarginsSlider');
    connectionInletWidth = updateLabelFromSlider('connectionInletWidth', 'connectionInletWidthSlider');
    connectionsMargin = updateLabelFromSlider('connectionsMargin', 'connectionsMarginSlider');
    lineThickness = updateLabelFromSlider('lineThickness', 'lineThicknessSlider');

    majorFontSize = updateLabelFromSlider('majorFontSize', 'majorFontSizeSlider');
    minorFontSize = updateLabelFromSlider('minorFontSize', 'minorFontSizeSlider');

    refsVertPadding = updateLabelFromSlider('refsVertPadding', 'refsVertPaddingSlider');
    refsHorizPadding = updateLabelFromSlider('refsHorizPadding', 'refsHorizPaddingSlider');
    refsVertAlignment = updateLabelFromSlider('refsVertAlignment', 'refsVertAlignmentSlider');
    fwdRefsVertOffset = updateLabelFromSlider('fwdRefsVertOffset', 'fwdRefsVertOffsetSlider');

    alignWithPixels = getBoolFromCheckbox('alignWithPixelsCheckbox');
    alignRefsHorizontally = getBoolFromCheckbox('alignRefsHorizontallyCheckbox');
    
    updateTextVerticalMargins(textVertMargins);
    updateFontSizes();

    let urlParams = new URLSearchParams();
    updateUrlParamFromElement(urlParams, 'vs', 'verticalSpacingSlider');
    updateUrlParamFromElement(urlParams, 'hs', 'horizontalSpacingSlider');
    updateUrlParamFromElement(urlParams, 'cs', 'compactedHorizontalSpacingSlider');
    updateUrlParamFromElement(urlParams, 'cl', 'numberOfCompactedGenerationsSlider');

    updateUrlParamFromElement(urlParams, 'tm', 'textVertMarginsSlider');
    updateUrlParamFromElement(urlParams, 'iw', 'connectionInletWidthSlider');
    updateUrlParamFromElement(urlParams, 'lm', 'connectionsMarginSlider');
    updateUrlParamFromElement(urlParams, 'lt', 'lineThicknessSlider');
    
    updateUrlParamFromElement(urlParams, 'bfs', 'majorFontSizeSlider');
    updateUrlParamFromElement(urlParams, 'sfs', 'minorFontSizeSlider');
    updateUrlParamFromElement(urlParams, 'rvp', 'refsVertPaddingSlider');
    updateUrlParamFromElement(urlParams, 'rhp', 'refsHorizPaddingSlider');
    updateUrlParamFromElement(urlParams, 'rva', 'refsVertAlignmentSlider');
    updateUrlParamFromElement(urlParams, 'fro', 'fwdRefsVertOffsetSlider');

    updateUrlParamFromCheckbox(urlParams, 'awp', 'alignWithPixelsCheckbox');
    updateUrlParamFromCheckbox(urlParams, 'arh', 'alignRefsHorizontallyCheckbox');

    updateUrlParamFromElement(urlParams, 'font', 'fontSelect');

    window.history.replaceState(null, "", window.location.href.split('?')[0] + '?' + urlParams.toString());

    redraw();
}

function clearInputParams() {
    window.location = window.location.href.split('?')[0];
    parseUrlParams();
    parseParamsFromInputElements();
    redraw();
}

function parseUrlParams() {
    let urlParams = new URLSearchParams(window.location.search);

    updateSliderFromUrlParam(urlParams, 'vs', 'verticalSpacingSlider');
    updateSliderFromUrlParam(urlParams, 'hs', 'horizontalSpacingSlider');
    updateSliderFromUrlParam(urlParams, 'cs', 'compactedHorizontalSpacingSlider');
    updateSliderFromUrlParam(urlParams, 'cl', 'numberOfCompactedGenerationsSlider');

    updateSliderFromUrlParam(urlParams, 'tm', 'textVertMarginsSlider');
    updateSliderFromUrlParam(urlParams, 'iw', 'connectionInletWidthSlider');
    updateSliderFromUrlParam(urlParams, 'lm', 'connectionsMarginSlider');
    updateSliderFromUrlParam(urlParams, 'lt', 'lineThicknessSlider');
    
    updateSliderFromUrlParam(urlParams, 'bfs', 'majorFontSizeSlider');
    updateSliderFromUrlParam(urlParams, 'sfs', 'minorFontSizeSlider');
    updateSliderFromUrlParam(urlParams, 'rvp', 'refsVertPaddingSlider');
    updateSliderFromUrlParam(urlParams, 'rhp', 'refsHorizPaddingSlider');
    updateSliderFromUrlParam(urlParams, 'rva', 'refsVertAlignmentSlider');
    updateSliderFromUrlParam(urlParams, 'fro', 'fwdRefsVertOffsetSlider');

    updateCheckboxFromUrlParam(urlParams, 'awp', 'alignWithPixelsCheckbox');
    updateCheckboxFromUrlParam(urlParams, 'arh', 'alignRefsHorizontallyCheckbox');

    updateComboFromUrlParam(urlParams, 'font', 'fontSelect');
}

function updateSliderFromUrlParam(urlParams, paramName, sliderName) {
    if (urlParams.has(paramName)) {
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

function fontSelected() {
    // based on: https://codepen.io/MetAteM/pen/WrdWYJ
	let selectedIndex = document.getElementById("fontSelect").selectedIndex;
    let options = document.getElementById("fontSelect").options;
    let existingStyle = document.getElementById("dynamicStyle");
    if (existingStyle)
        existingStyle.remove();
	document.body.insertAdjacentHTML("beforeend",
        "<style id='dynamicStyle'> #treeContainer { font-family:'"+options[selectedIndex].text+"';} </style>");
    parseParamsFromInputElements();
    redraw();
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

    redraw();
};

function init() {
    populateInputTextArea();
    checkZoomLevel();
    parseUrlParams();

    document.getElementById("treeInputData").oninput = onInputDataChangedWithDelay;

    document.getElementById("verticalSpacingSlider").oninput = parseParamsFromInputElements;
    document.getElementById("horizontalSpacingSlider").oninput = parseParamsFromInputElements;
    document.getElementById("compactedHorizontalSpacingSlider").oninput = parseParamsFromInputElements;
    document.getElementById("numberOfCompactedGenerationsSlider").oninput = parseParamsFromInputElements;

    document.getElementById("textVertMarginsSlider").oninput = parseParamsFromInputElements;
    document.getElementById("connectionInletWidthSlider").oninput = parseParamsFromInputElements;
    document.getElementById("connectionsMarginSlider").oninput = parseParamsFromInputElements;
    document.getElementById("lineThicknessSlider").oninput = parseParamsFromInputElements;

    document.getElementById("majorFontSizeSlider").oninput = parseParamsFromInputElements;
    document.getElementById("minorFontSizeSlider").oninput = parseParamsFromInputElements;
    document.getElementById("refsVertPaddingSlider").oninput = parseParamsFromInputElements;
    document.getElementById("refsHorizPaddingSlider").oninput = parseParamsFromInputElements;
    document.getElementById("refsVertAlignmentSlider").oninput = parseParamsFromInputElements;
    document.getElementById("fwdRefsVertOffsetSlider").oninput = parseParamsFromInputElements;

    document.getElementById("alignWithPixelsCheckbox").oninput = parseParamsFromInputElements;
    document.getElementById("alignRefsHorizontallyCheckbox").oninput = parseParamsFromInputElements;

    parseParamsFromInputElements();
    onInputDataChangedWithDelay();

    let fontSelect = document.getElementById("fontSelect")
    for(const font of fonts){
        let option = document.createElement('option');
        option.value = option.innerHTML = font;
        option.style.fontFamily = font;
        fontSelect.add(option);
    }

    fontSelect.value = "Roboto";
    fontSelected();
}

init();
