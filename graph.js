let graphContainer = document.getElementById("graphContainer");
let redrawTime = document.getElementById("redrawTime");
let inputDataChangedDelay = null;
let graphviz = null;
let firstRedraw = true;


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
    graphviz = d3.select("#graphContainer")
        .graphviz({
            useWorker: false,
            fit: true,
            width: graphContainer.style.width,
            height: graphContainer.style.height
        })
        .dot(document.getElementById("inputData").value)
        .render();

    if (firstRedraw)
        firstRedraw = false;
    else 
        resetZoom();
}

function onInputDataChangedWithDelay() {
    clearTimeout(inputDataChangedDelay);
    inputDataChangedDelay = setTimeout(onInputDataChanged, 200);
}

function onInputDataChanged() {
    redraw();
}

function updateLabelFromSlider(labelName, sliderName) {
    let slider = document.getElementById(sliderName);
    document.getElementById(labelName).innerHTML = slider.value;
    return parseInt(slider.value);
}

function parseParamsFromInputElements() {
    graphContainer.style.width = updateLabelFromSlider('graphWidth', 'graphWidthSlider') + 'px';
    graphContainer.style.height = updateLabelFromSlider('graphHeight', 'graphHeightSlider') + 'px';

    redraw();
}

function init() {
    document.getElementById("inputData").oninput = onInputDataChangedWithDelay;

    document.getElementById("graphWidthSlider").oninput = parseParamsFromInputElements;
    document.getElementById("graphHeightSlider").oninput = parseParamsFromInputElements;

    parseParamsFromInputElements();
}


init();
