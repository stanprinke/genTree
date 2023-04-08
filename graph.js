let graphContainer = document.getElementById("graphContainer");
let redrawTime = document.getElementById("redrawTime");
let redrawDelay = null;
let inputDataChangedDelay = null;
let graphviz = null;
let graphSize = 100;
const localStoreKey = "graphInputData";

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
        let dataUrl = await htmlToImage.toPng(document.getElementById('graphContainer'));
        const tmpAnchor = document.createElement('a');
        tmpAnchor.href = dataUrl;
        tmpAnchor.download = "graph_" + getTimestamp();
        tmpAnchor.click();
        tmpAnchor.remove();
    }
    catch (error) {
        console.error("ERROR: " + error);
        showError("ERROR:", error);
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

function resetZoom() {
    graphviz.resetZoom();
}

function getBoolFromCheckbox(elementName) {
    return document.getElementById(elementName).checked;
}

function showError(message, error) {
    document.getElementById("errors").innerHTML = message + " " + error;
}

function redraw() {
    try {
        document.getElementById("errors").innerHTML = "";
        
        const start = performance.now();
        redrawImpl();
        const elapsed = parseInt(performance.now() - start);
        redrawTime.innerHTML = elapsed;
    } catch (error) {
        console.error(error);
        showError("ERROR, possibly graphviz parsing issue ", error);
    }
}

function redrawImpl() {
    graphviz = d3
        .select("#graphContainer")
        .graphviz({
            useWorker: false,
            fit: true,
            width: parseInt(graphContainer.style.width),
            height: parseInt(graphContainer.style.height)
        });

    graphviz.dot(document.getElementById("inputData").value)
        .render()
        .on('end', () => {
            graphviz.resetZoom();

            let box = document.getElementById('graph0').getBoundingClientRect();
            let newWidth = Math.ceil(box.width);
            let newHeight = Math.ceil(box.height);
            if (newWidth < graphSize-1 && newHeight < graphSize-1) {
                newWidth = graphSize;
                newHeight = graphSize;
            }
            let currWidth = parseInt(graphContainer.style.width);
            let currHeight = parseInt(graphContainer.style.height);
            
            if (newWidth != currWidth || newHeight != currHeight) {
                console.log(`graph size is ${newWidth}x${newHeight}, container size is ${currWidth}x${currHeight}, resizing container...`);
                graphContainer.style.width = newWidth + 'px';
                graphContainer.style.height = newHeight + 'px';
                redrawWithDelay();
            }
        });
}

function redrawWithDelay() {
    clearTimeout(redrawDelay);
    redrawDelay = setTimeout(redraw, 150);
}

function onInputDataChangedWithDelay() {
    clearTimeout(inputDataChangedDelay);
    inputDataChangedDelay = setTimeout(onInputDataChanged, 200);
}

function onInputDataChanged() {
    localStorage.setItem(localStoreKey, document.getElementById("inputData").value);
    redraw();
}

function updateLabelFromSlider(labelName, sliderName) {
    let slider = document.getElementById(sliderName); 
    document.getElementById(labelName).innerHTML = slider.value + ' px';
    return parseInt(slider.value);
}

function parseParamsFromInputElements() {
    graphSize = updateLabelFromSlider('graphSize', 'graphSizeSlider');
    graphContainer.style.width = graphSize + 'px';
    graphContainer.style.height = graphSize + 'px';

    let urlParams = new URLSearchParams();
    updateUrlParamFromElement(urlParams, 'gs', 'graphSizeSlider');
    window.history.replaceState(null, "", window.location.href.split('?')[0] + '?' + urlParams.toString());

    redraw();
}

function init() {
    populateInputTextArea();
    parseUrlParams();
    document.getElementById("inputData").oninput = onInputDataChangedWithDelay;
    document.getElementById("graphSizeSlider").oninput = parseParamsFromInputElements;
    parseParamsFromInputElements();
}

function parseUrlParams() {
    let urlParams = new URLSearchParams(window.location.search);

    updateSliderFromUrlParam(urlParams, 'gs', 'graphSizeSlider');
}

function updateSliderFromUrlParam(urlParams, paramName, sliderName) {
    if (urlParams.has(paramName)) {
        document.getElementById(sliderName).value = parseInt(urlParams.get(paramName)) || 0;
    }
}

function updateUrlParamFromElement(urlParams, paramName, elementName) {
    let elem = document.getElementById(elementName);
    urlParams.append(paramName, elem.value);
}

function defaultInputData() {
    return `strict digraph mygraph {
    node [shape=box];

    100 -> 200 -> 300
    400 -> 200 -> 300
    100 [label="Anna CZERSKA"]
    200 [label="Anna RACIBORSKA"]
    300 [label="Jan I ks. RACIBORSKI"]
    400 [label="aaa aaa \\n bbb bbb"]
}
`;
}

function clearInputData() {
    localStorage.removeItem(localStoreKey);
    populateInputTextArea();
    redraw();
}

function populateInputTextArea() {
    document.getElementById("inputData").value = localStorage.getItem(localStoreKey)?? defaultInputData();
}


init();
