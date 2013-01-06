var gl;
var math;
var fast;
var shaders = {};

var g_debug = false;

var shadersPath = "shaders/";
var datasets = {
    small: {
        files: [
            "abalone.F.csv",
            "abalone.I.csv",
            "abalone.M.csv",
        ]
    },
    large: {
        throttled: true,
        files: [
            "covtype.data/Spruce_Fir_cover1.csv",
            "covtype.data/LogdepolePine_cover2.csv",
            "covtype.data/PonderosaPine_cover3.csv",
            "covtype.data/Cottonwood_Willow_cover4.csv",
            "covtype.data/Aspen_cover5.csv",
            "covtype.data/DouglarFir_cover6.csv",
            "covtype.data/Krummholz_cover7.csv",
        ]
    },
    user: {
        files: [
        ]
    },
}

var ds;
var groups;
var files;
var bounds;
var zoomRect = [0, 0, 1, 1];

var activeGroups = [0, 0, 0, 0, 0, 0, 0, 0];
var renderBuffer;

var xVar = 0;
var yVar = 1;

var maxCols = 12;
var renderSize = 1024;

var quadBuffer;

var texturesPerPipeline = 9;
var channelsPerTexture = 4;

var threshold = 0.45;

var kdeSigma = 16;

var gridPixels = 25;
var sampleClip = 12;

var pointRadius = 2.5;

var combineLightness = 73;
var combineChroma = 100;
var combineAttenuateLightness = 0.7;
var combineAttenuateChroma = 0.7;
var combineStrokeSize = 3;
var stripeWidth = 2;
var stripeSpacer = 60;

var splamGridSize = 6;
var splamPointRadius = 1;

var textures;
var splamTextures;
var splatterTexture;
var splamTexture;

function vecSelector(i) {
	return [i == 0 ? 1 : 0, i == 1 ? 1 : 0, i == 2 ? 1 : 0, i == 3 ? 1 : 0];
}

function initializeGl() {
	quadBuffer = new tdl.buffers.Buffer({
		buffer: new Float32Array([
					-1,-1, -1,1, 1,1,
					1,1, 1,-1, -1,-1]),
		numComponents: 2,
		numElements: 6
	});
}

function parseCsv(text, opt_delim) {
	opt_delim = opt_delim || ",";
	var lines = text.trim("\r").split("\n");	
    var header;
	for (var i=0, l=lines.length; i<l; i++) {
		lines[i] = lines[i].split(opt_delim);
	}
	if (lines.length > 0 && lines[0].length > 0) {
		if (!$.isNumeric(lines[0][0])) {
			header = lines[0];
			lines[0] = lines[lines.length - 1];
			lines.pop();
		}
	}
    if (!header) {
        header = [];
        for (var i = 0; i < lines[0].length; i++)
            header[i] = "Column" + i;
    }
    lines.header = header;
	return lines;
}

function createTextures() {
	if (!textures) textures = [];
	if (!splamTextures) splamTextures = [];
	for (var i = 0; i * channelsPerTexture < 12; i++) {
		if (!textures[i]) textures[i] = [];
		if (!splamTextures[i]) splamTextures[i] = [];
		for (var j = 0; j < texturesPerPipeline; j++) {
			if (!textures[i][j]) {
				textures[i][j] = new tdl.textures.ExternalTexture2D();
				renderBuffer.initializeTexture(textures[i][j]);
			}
			if (!splamTextures[i][j]) {
				splamTextures[i][j] = new tdl.textures.ExternalTexture2D();
				renderBuffer.initializeTexture(splamTextures[i][j]);
			}
		}
	}
	splatterTexture = new tdl.textures.ExternalTexture2D();
	renderBuffer.initializeTexture(splatterTexture);
	splatterTexture.setParameter(gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
	splatterTexture.setParameter(gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	splamTexture = new tdl.textures.ExternalTexture2D();
	renderBuffer.initializeTexture(splamTexture);
	splamTexture.setParameter(gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
	splamTexture.setParameter(gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

function isCurrentDataset(ds) {
    return groups == ds.groups;
}

function useDataset(ds) {
    xVar = 0;
    yVar = 1;
    groups = ds.groups;
    bounds = ds.bounds;
    files = ds.files;
    groups.initialized = false;
    for (var i = 0; i < ds.files.length; i++) {
        initializeGroup(ds, i);
    }
    for (var i = 0; i < activeGroups.length; i++)
        activeGroups[i] = i < ds.files.length ? 1 : 0;
    setupGroupToggle();
}

function initializeGroup(ds, groupId) {
    if (ds.groups[groupId]) return;
    if (!ds.data[groupId]) return;

    var g = ds.groups[groupId] = {};
    var files = ds.files;
    var bounds = ds.bounds;

    var data = ds.data[groupId];

    console.log("Parsing " + files[groupId] + ".");
    data = parseCsv(data);
    console.log(files[groupId] + " parsed.");

    g.data = data;
    g.numRows = data.length;
    g.numCols = Math.min(maxCols, data[0].length);
    g.valArray = [];

    for (var i = 0; i * 4 < g.numCols; i++) {
        g.valArray[i] = { 
            buffer: new Float32Array(4 * data.length),
            numComponents: 4,
            numElements: g.numRows,
        };
    }

    console.log("Moving data to typed arrays.");
    for (var i = 0; i < g.numCols; i++) {
        if (!bounds[i]) ds.bounds[i] = [Infinity, -Infinity];
    }
    for (var i = 0; i < g.numRows; i++) {
        for (var j = 0; j < g.numCols; j++) {
            if (j == g.numCols) {
                Debug.error("Ignoring unexpected value in " + files[groupId] + " at line " + i);
                break;
            }
            g.valArray[Math.floor(j / 4)].buffer[i * 4 + (j % 4)] = data[i][j];
            bounds[j][0] = Math.min(data[i][j], bounds[j][0]);
            bounds[j][1] = Math.max(data[i][j], bounds[j][1]);
        }
    }

    console.log("Moving " + files[groupId] + " to GPU.");
    g.valBuffer = [];
    for (var i = 0; i < g.valArray.length; i++) {
        g.valBuffer[i] = new tdl.buffers.Buffer(g.valArray[i]);
    }
    console.log(files[groupId] + " loaded.");

    ds.groups.ready = true;
    for (var i = 0; i < files.length; i++) {
        ds.groups.ready = ds.groups.ready && ds.groups[i]
    }
    ds.groups.header = data.header;
}

function loadGroups(ds) {
    var files = ds.files;
    ds.groups = [];
    ds.data = [];
    ds.bounds = [];

    function csvLoader(groupId) {
        return function(data) {
			var file = files[groupId];
            ds.data[groupId] = data;
            if (isCurrentDataset(ds)) {
                initializeGroup(ds, groupId);
            }
        }
    }

    if (files instanceof Array) {
        for (var f = 0; f < files.length; f++) {
            $.get(files[f], csvLoader(f));
        }
    } else {
        ds.files = [];
        for (var f = 0; f < files.length; f++) {
            var reader = new FileReader();
            function localLoader(groupId) {
                return function(data) {
                    csvLoader(groupId)(data.target.result);
                }
            }
            reader.onload = localLoader(f);
            reader.readAsText(files[f]);
            ds.files.push(files[f].fileName);
        }
    }
}

function resetZoomPan() {
    zoomRect = [0, 0, 1, 1];
}

function getBoundsX(v) {
    var b = bounds[v] || [0, 1];
    return [b[0] + zoomRect[0] * (b[1] - b[0]), b[0] + (zoomRect[0] + zoomRect[2]) * (b[1] - b[0])];
}
function getBoundsY(v) {
    var b = bounds[v] || [0, 1];
    return [b[0] + zoomRect[1] * (b[1] - b[0]), b[0] + (zoomRect[1] + zoomRect[3]) * (b[1] - b[0])];
}

var canvasRect = [0, 0, 1400, 670];
var mainRect = [75, 20, 600, 600];
var splamRect = [750, 20, 600, 600];
var splamSpacer = 4;
var splamWidth = 7;
var splamPixPerEl;

function toRelativeRect(rect, p) {
    return [
        rect[0] / (p[2] - p[0]),
        rect[1] / (p[3] - p[1]),
        rect[2] / (p[2] - p[0]),
        rect[3] / (p[3] - p[1]),
    ];
}
function rectToDrawRect(rect) {
    return toRelativeRect(rect, canvasRect);
}

function mainDrawRect() {
    return rectToDrawRect(mainRect);
}

function getSplamRect(i, j) {
    var pixPerEl = ((splamRect[3] - splamSpacer) / splamWidth - splamSpacer);
    splamPixPerEl = pixPerEl;
    return [
            splamSpacer + splamRect[0] + i * (pixPerEl + splamSpacer),
            splamRect[1] + splamRect[3] - j * (pixPerEl + splamSpacer),
            pixPerEl,
            pixPerEl,
        ];
}

function splamDrawRect(i, j) {
    return rectToDrawRect(getSplamRect(i, groups[0].numCols - j));
}


function renderPlot(xVar, yVar, drawRect, shouldClear, textures) {
	var shader = shaders["plot"];
	if (!shader) return;

	gl.clearColor(0.0, 0.0, 0.0, 0.0);

	gl.enable(gl.BLEND);
	gl.blendEquation(gl.FUNC_ADD);
	gl.blendFunc(gl.ONE, gl.ONE);
	gl.disable(gl.DEPTH_TEST);

	gl.useProgram(shader.program);

	shader.uniform.xVar0(vecSelector(xVar));
	shader.uniform.xVar1(vecSelector(xVar - 4));
	shader.uniform.xVar2(vecSelector(xVar - 8));
	shader.uniform.yVar0(vecSelector(yVar));
	shader.uniform.yVar1(vecSelector(yVar - 4));
	shader.uniform.yVar2(vecSelector(yVar - 8));

	shader.uniform.xBounds(getBoundsX(xVar));
	shader.uniform.yBounds(getBoundsY(yVar));
	shader.uniform.drawRect(drawRect);

	for (var t = 0, i = 0; t < textures.length; t++) {
		renderBuffer.bind(textures[t][0]);
		if (shouldClear) {
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
		}

		for (var j = 0; j < channelsPerTexture; j++, i++) {
			if (i >= groups.length) continue;
			var gr = groups[i];

			shader.uniform.channel(vecSelector(j));

			shader.attrib.vals0(gr.valBuffer[0]);
			if (gr.valBuffer[1]) shader.attrib.vals1(gr.valBuffer[1]);
			if (gr.valBuffer[2]) shader.attrib.vals2(gr.valBuffer[2]);

			gl.drawArrays(gl.POINTS, 0, gr.numRows);
		}
	}
}

function renderKde(sigma, textures, blockWidth) {
	var shader = shaders[sigma * 3 < 16 ? "kde16" : sigma * 3 < 32 ? "kde32" : sigma * 3 < 64 ? "kde64" : "kde"];
	if (!shader) return;

	gl.disable(gl.DEPTH_TEST);

	gl.useProgram(shader.program);
	shader.uniform.sigma(sigma);
    shader.uniform.blockWidth(blockWidth);
    shader.uniform.pixWidth(1 / renderBuffer.width);

	shader.attrib.pos(quadBuffer);

	for (var t = 0; t < textures.length; t++) {
		renderBuffer.bind(textures[t][2]);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
		shader.uniform.texture(textures[t][0]);
		shader.uniform.off([0, 1 / renderBuffer.width]);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
	}
	for (var t = 0; t < textures.length; t++) {
		renderBuffer.bind(textures[t][1]);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
		shader.uniform.texture(textures[t][2]);
		shader.uniform.off([1 / renderBuffer.width, 0]);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
	}
}

function renderMax(textures, stepsNeeded) {
	var shader = shaders["max"];
	if (!shader) return;

	gl.disable(gl.DEPTH_TEST);
	gl.useProgram(shader.program);
	shader.attrib.pos(quadBuffer);

	var scalePerStep = 8;

    var drawWidth = renderBuffer.width;
	for (var t = 0; t < textures.length; t++) {
		for (var i = 0; i < stepsNeeded; i++) {
			var toLeft = (i % 2) != (stepsNeeded % 2);

			renderBuffer.bind(textures[t][toLeft ? 2 : 3]);
			shader.uniform.texture(textures[t][i == 0 ? 1 : toLeft ? 3 : 2]);

            drawWidth /= scalePerStep;
			shader.uniform.drawRect([0, 0, drawWidth, drawWidth]);
			shader.uniform.textureWidth(renderBuffer.width);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
			gl.drawArrays(gl.TRIANGLES, 0, 6);
		}
	}
}

function renderThreshold(threshold, blockSize, outidx, target) {
	var shader = shaders["threshold"];
	if (!shader) return;

	gl.disable(gl.DEPTH_TEST);
	gl.useProgram(shader.program);

	shader.uniform.threshold(threshold);
	shader.attrib.pos(quadBuffer);
	shader.uniform.textureWidth(renderBuffer.width);
    shader.uniform.blockSize(blockSize);
    //shader.uniform.maximum1(target[1][2]);

	for (var t = 0; t < textures.length; t++) {
		renderBuffer.bind(target[t][outidx]);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
		shader.uniform.texture(target[t][1]);
        shader.uniform.maximum0(target[t][2]);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
	}
}

function renderJfa() {
	var shader = shaders["jfa"];
	if (!shader) return;

	gl.disable(gl.DEPTH_TEST);

	gl.useProgram(shader.program);
	gl.clearColor(0.0, 0.0, 0.0, 0.0);

	shader.attrib.pos(quadBuffer);

	var jumpsNeeded = 5;

	for (var jump = 0; jump < jumpsNeeded; jump++) {
		shader.uniform.off((1 << (jumpsNeeded - 1 - jump)) / renderBuffer.width);
		for (var t = 0; t < textures.length; t++) {
			var toLeft = (jump % 2) != (jumpsNeeded % 2);
			renderBuffer.bind(textures[t][toLeft ? 2 : 3]);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
			shader.uniform.texture(textures[t][jump == 0 ? 4 : toLeft ? 3 : 2]);
			gl.drawArrays(gl.TRIANGLES, 0, 6);
		}
	}
}

function renderSample(xVar, yVar, drawRect, gridPixels, shouldClear, textures) {
	var shader = shaders["sample"];
	if (!shader) return;

	gl.clearColor(0.0, 0.0, 0.0, 0.0);

	gl.disable(gl.BLEND);
	gl.blendEquation(gl.FUNC_ADD);
	gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.DST_ALPHA);

	gl.enable(gl.DEPTH_TEST);

	gl.useProgram(shader.program);

	shader.uniform.xVar0(vecSelector(xVar));
	shader.uniform.xVar1(vecSelector(xVar - 4));
	shader.uniform.xVar2(vecSelector(xVar - 8));
	shader.uniform.yVar0(vecSelector(yVar));
	shader.uniform.yVar1(vecSelector(yVar - 4));
	shader.uniform.yVar2(vecSelector(yVar - 8));

	shader.uniform.xBounds(getBoundsX(xVar));
	shader.uniform.yBounds(getBoundsY(yVar));
	shader.uniform.drawRect(drawRect);

	shader.uniform.textureWidth(renderBuffer.width);
	shader.uniform.clipDistance(gridPixels);

	shader.uniform.gridSize(gridPixels / renderBuffer.width);

	for (var t = 0, i = 0; t < textures.length; t++) {
		shader.uniform.texture(textures[t][2]);

		for (var j = 0; j < channelsPerTexture; j++, i++) {
			if (i >= groups.length) continue;
			var gr = groups[i];
			renderBuffer.bind(textures[t][4 + (i % channelsPerTexture)]);
			if (shouldClear) {
				gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
			}

			shader.uniform.channel(vecSelector(j));

			shader.attrib.vals0(gr.valBuffer[0]);
			if (gr.valBuffer[1]) shader.attrib.vals1(gr.valBuffer[1]);
			if (gr.valBuffer[2]) shader.attrib.vals2(gr.valBuffer[2]);

			gl.drawArrays(gl.POINTS, 0, gr.numRows);
		}
	}
}

function renderSampleCombine(gridPixels, pointRadius, textures) {
	var shader = shaders["sampleCombine"];
	if (!shader) return;

	gl.clearColor(0.0, 0.0, 0.0, 0.0);

	gl.disable(gl.BLEND);
	gl.disable(gl.DEPTH_TEST);

	gl.useProgram(shader.program);

	shader.uniform.textureWidth(renderBuffer.width);
	shader.attrib.pos(quadBuffer);
	shader.uniform.gridSize(gridPixels / renderBuffer.width);
	shader.uniform.pointRadius(pointRadius);

	for (var t = 0, i = 0; t < textures.length; t++) {
		for (var j = 0; j < channelsPerTexture; j++) {
			shader.uniform["texture" + j](textures[t][4 + j]);
		}
		renderBuffer.bind(textures[t][8]);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
	}
}

function renderCombine(pidx, sidx, stripeMult, textures, destination) {
	var shader = shaders["combine"];
	if (!shader) return;

	gl.clearColor(0.0, 0.0, 0.0, 0.0);

	gl.disable(gl.BLEND);
	gl.disable(gl.DEPTH_TEST);

	gl.useProgram(shader.program);

	shader.uniform.points0(textures[0][pidx]);
    shader.uniform.points1(textures[1][pidx]);

	shader.uniform.shapes0(textures[0][sidx]);
    shader.uniform.shapes1(textures[1][sidx]);

	shader.uniform.textureWidth(renderBuffer.width);

	shader.uniform.numGroups(groups.length);

	shader.uniform.lightness(combineLightness);
	shader.uniform.chroma(combineChroma);
	shader.uniform.attenuateLightness(combineAttenuateLightness);
	shader.uniform.attenuateChroma(combineAttenuateChroma);

    shader.uniform.stripeWidth(stripeWidth * stripeMult / renderBuffer.width);
    shader.uniform.stripePeriod((stripeWidth + stripeSpacer) / renderBuffer.width);

	shader.uniform.strokeSize(combineStrokeSize);

    shader.uniform.groups0(activeGroups.slice(0, 4));
    shader.uniform.groups1(activeGroups.slice(4, 8));

	renderBuffer.bind(destination);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
	gl.drawArrays(gl.TRIANGLES, 0, 6);

	destination.bindToUnit(0);
	gl.generateMipmap(gl.TEXTURE_2D);
}

function renderDraw() {
	var shader = shaders["draw"];
	if (!shader) return;

	gl.clearColor(0.0, 0.0, 0.0, 0.0);

	gl.disable(gl.BLEND);
	gl.disable(gl.DEPTH_TEST);

	gl.useProgram(shader.program);

	renderBuffer.unbind();
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

	shader.uniform.texture(splatterTexture);
	
    var rect = mainDrawRect().slice();
    rect[1] = 1.0 - rect[1] - rect[3];
	shader.uniform.drawRect(rect);
	shader.uniform.textureRect([0.0, 0.0, 1.0, 1.0]);

	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
	gl.drawArrays(gl.TRIANGLES, 0, 6);

	shader.uniform.texture(splamTexture);

	var nCols = groups[0].numCols;
	var x = 0, y = 0;
	for (var i = 0; i < nCols; i++) {
		for (var j = i + 1; j < nCols; j++, x++) {
			if (x == 8) {
				x = 0;
				y++;
			}
            var rect = splamDrawRect(i, j).slice();
            rect[1] = 1.0 - rect[1] - rect[3];
			shader.uniform.drawRect(rect);
			shader.uniform.textureRect([x * 0.125, y * 0.125, 0.125, 0.125]);
			gl.drawArrays(gl.TRIANGLES, 0, 6);
		}
	}
}

function initializeGroups() {
	if (!shaders["plot"]) return;
	if (!shaders["sample"]) return;

	var nCols = groups[0].numCols;
    splamWidth = nCols - 1;

	var x = 0, y = 0;
	for (var i = 0; i < nCols; i++) {
		for (var j = i + 1; j < nCols; j++, x++) {
			if (x == 8) {
				x = 0;
				y++;
			}
			renderPlot(i, j, [0.125 * x, 0.125 * y, 0.125, 0.125], (x == 0) && (y == 0), splamTextures);
			renderSample(i, j, [0.125 * x, 0.125 * y, 0.125, 0.125], splamGridSize, (x == 0) && (y == 0), splamTextures);
		}
	}
	renderSampleCombine(splamGridSize, splamPointRadius, splamTextures);
    groups.initialized = true;
}

var canvas2d;
var context2d;
var numLines = 9;
function drawAxesLabels() {
    var xBounds = getBoundsX(xVar);
    var yBounds = getBoundsY(yVar);

    context2d.fillStyle = "#ccc";
    context2d.fillRect(mainRect[0], mainRect[1] + mainRect[3], mainRect[2], 10);
    context2d.fillRect(mainRect[0] - 13, mainRect[1], 13, mainRect[3]);

    context2d.font = "9px sans-serif";
    context2d.fillStyle = "#000";
    context2d.save();
    context2d.translate(mainRect[0], mainRect[1] + mainRect[3] + 10);
    for (var i = 0; i < numLines + 1; i++) {
        var t = ("" + (xBounds[0] + i / (numLines + 1) * (xBounds[1] - xBounds[0]))).substr(0, 6);
        context2d.fillText(t, 0, 0);
        context2d.translate(mainRect[2] / (numLines + 1), 0);
    }
    context2d.restore();

    context2d.save();
    context2d.translate(mainRect[0] - 3, mainRect[1] + mainRect[3]);
    context2d.rotate(-Math.PI / 2);
    for (var i = 0; i < numLines + 1; i++) {
        var t = ("" + (yBounds[0] + i / (numLines + 1) * (yBounds[1] - yBounds[0]))).substr(0, 6);
        context2d.fillText(t, 0, 0);
        context2d.translate(mainRect[2] / (numLines + 1), 0);
    }
    context2d.restore();

}
function drawAxes() {
    context2d.strokeStyle = "#999";
    context2d.lineWidth = 1;
    for (var i = 1; i < numLines + 1; i++) {
        var off = mainRect[2] / (numLines + 1) * i;
        context2d.moveTo(mainRect[0] + off, mainRect[1]);
        context2d.lineTo(mainRect[0] + off, mainRect[1] + mainRect[3]);
        context2d.moveTo(mainRect[0], mainRect[1] + off);
        context2d.lineTo(mainRect[0] + mainRect[2], mainRect[1] + off);
    }
    context2d.stroke();
    context2d.closePath();
    drawAxesLabels();
}
function drawLabels() {
    context2d.font = "20px sans-serif";
    context2d.fillStyle = "#000";

    context2d.save();
    context2d.translate(mainRect[0] + (mainRect[2] - 100) / 2, mainRect[1] + mainRect[3] + 30);
    context2d.fillText(groups.header[xVar], 0, 0, 100);
    context2d.restore();

    context2d.save();
    context2d.translate(mainRect[0] - 15, mainRect[1] + (mainRect[3] + 100) / 2);
    context2d.rotate(-Math.PI / 2);
    context2d.fillText(groups.header[yVar], 0, 0, 100);
    context2d.restore();

    context2d.font = "10px sans-serif";
	var nCols = groups[0].numCols;
	for (var i = 0; i < nCols - 1; i++) {
        context2d.save();
        var text = groups.header[i];
        var twidth = context2d.measureText(text).width;
        var l = text.length;
        while (twidth > splamPixPerEl) {
            l *= 0.8;
            text = groups.header[i].substr(0, l) + "...";
            twidth = context2d.measureText(text).width;
        }
        context2d.translate(splamRect[0] + (splamPixPerEl + splamSpacer) * (i + 0.5) - twidth / 2, splamRect[1] + splamRect[3] + 15);
        context2d.fillText(text, 0, 0, splamPixPerEl);
        context2d.restore();

        context2d.save();
        var j = i + 1;
        var text = groups.header[j];
        var twidth = context2d.measureText(text).width;
        var l = text.length;
        while (twidth > splamPixPerEl) {
            l *= 0.8;
            text = groups.header[j].substr(0, l) + "...";
            twidth = context2d.measureText(text).width;
        }
        context2d.translate(splamRect[0] - 5, splamRect[1] + (splamPixPerEl + splamSpacer) * (i + 0.5) + twidth / 2);
        context2d.rotate(-Math.PI / 2);
        context2d.fillText(text, 0, 0, splamPixPerEl);
        context2d.restore();
    }

}
function draw2d() {
    context2d.fillStyle = "#ccc";
    context2d.fillRect(0, 0, canvas2d.width, canvas2d.height);

    context2d.fillStyle = "#fff";
    context2d.fillRect(mainRect[0], mainRect[1], mainRect[2], mainRect[3]);

	var nCols = groups[0].numCols;
	for (var i = 0; i < nCols; i++) {
		for (var j = 1; j < nCols - i; j++) {
            var rect = getSplamRect(i, j);
            context2d.fillRect(rect[0], rect[1], rect[2], rect[3]);
		}
	}

    var rect = getSplamRect(xVar, nCols - yVar);
    context2d.strokeStyle = "#000";
    context2d.lineWidth = 3;
    context2d.strokeRect(rect[0] - 1, rect[1] - 1, rect[2] + 2, rect[3] + 2);

    drawAxes();
    drawLabels();
}

var showLoopTime = false;
var k = 4;
function render() {
	if (!groups.ready) {
		setTimeout("render()", 300);
		return;
	}
	if (!groups.initialized) {
        resetZoomPan();
        initializeGroups();
        draw2d();
    }

	renderPlot(xVar, yVar, [0.0, 0.0, 1.0, 1.0], true, textures);
	renderKde(kdeSigma, textures, 1.0);
	renderKde(kdeSigma / 4, splamTextures, 0.125);
	renderMax(textures, 3);
	renderMax(splamTextures, 2);
	renderThreshold(Math.exp(threshold * k - k), 1.0, 4, textures);
	renderThreshold(Math.exp(threshold * k - k), 0.125, 6, splamTextures);
	renderJfa();
	renderSample(xVar, yVar, [0, 0, 1, 1], gridPixels, true, textures);
	renderSampleCombine(gridPixels, pointRadius, textures);
	renderCombine(8, 2, 1, textures, splatterTexture);
	renderCombine(8, 6, 0, splamTextures, splamTexture);
	renderDraw();

	tdl.webgl.requestAnimationFrame(render, gl.canvas);
}

function setToggleColors() {
    var colors = getColors(combineLightness, combineChroma, files.length);
    for (var i = 0; i < files.length; i++) {
        var color = "rgb(" + colors[i][0] + "," + colors[i][1] + "," + colors[i][2] + ")";
        $("#grouptoggle label").eq(i).css("background-color", color);
    }
}

function setupGroupToggle() {
    $("#grouptoggle *").remove();
    for (var i = 0; i < files.length; i++) {
        var label = files[i];
        label = label.substr(label.lastIndexOf("/") + 1);
        $("#grouptoggle").append("<input type='checkbox' id='group" + i + "' value='" + i + "' checked='yes'/><label for='group" + i + "'>" + label + "</label>");
    }
    $("#grouptoggle input").change(function(ev) { 
        activeGroups[ev.target.value] = ev.target.checked ? 1 : 0;
    })
    $("#grouptoggle").buttonsetv();
    setToggleColors();
}

function setupDatasetToggle() {
    $("#datasettoggle *").remove();
    $("#datasettoggle").append("<input type='radio' name='dataset' id='dataset0' value='0' checked='yes'/><label for='dataset0'>Abalone data</label>");
    $("#datasettoggle").append("<input type='radio' name='dataset' id='dataset1' value='1'/><label for='dataset1'>Cover type data</label>");
    $("#datasettoggle").append("<input type='radio' name='dataset' id='dataset2' value='2' disabled/><label for='dataset2'>Local data</label>");
    $("#datasettoggle input").change(function(ev) { 
        if (ev.target.checked) {
            switch (ev.target.value) {
                case "0": useDataset(datasets.small); break;
                case "1": useDataset(datasets.large); break;
                case "2": useDataset(datasets.user); break;
            }
        }
    })
    $("#datasettoggle").buttonsetv();
}

function setupControls() {
	function makeSlider(tgt, min, max, step, cb) {
		$("#" + tgt + "Slider").slider({
			min: min,
			max: max,
			step: step,
			value: this[tgt],
			slide: function(ev, ui) {
				window[tgt] = ui.value;
                if (cb) cb(ev, ui);
			}
		})
	}
	makeSlider("gridPixels", 1.2, 64, 1);
	makeSlider("threshold", 0.00001, 1, 0.00001);
	makeSlider("kdeSigma", 1, 32, 0.5);
	//makeSlider("sampleClip", 1, 64, 1);
    
	makeSlider("pointRadius", 0.5, 10, 0.5);
	makeSlider("combineLightness", 0, 100, 0.1, setToggleColors);
	makeSlider("combineChroma", 0, 100, 0.1, setToggleColors);
	makeSlider("combineAttenuateLightness", 0, 1, 0.01);
	makeSlider("combineAttenuateChroma", 0, 1, 0.01);
	makeSlider("combineStrokeSize", 0, 10, 0.25);

	makeSlider("stripeWidth", 0, 20, 0.25);
	makeSlider("stripeSpacer", 1, 160, 0.25);

	//makeSlider("xVar", 0, 12, 1);
	//makeSlider("yVar", 0, 12, 1);

    setupDatasetToggle();
}

function inRect(vec, rect) {
    return vec[0] >= rect[0] &&
        vec[1] >= rect[1] &&
        vec[0] < rect[0] + rect[2] &&
        vec[1] < rect[1] + rect[3];
}

var dragging = false;
var dragOldX = 0;
var dragOldY = 0;

$(document).ready(function () {
	math = tdl.math;
	fast = tdl.fast;

    canvas2d = document.getElementById("splatterCanvas2d");
    context2d = canvas2d.getContext("2d");

	gl = tdl.webgl.setupWebGL(splatterCanvas, {preserveDrawingBuffer: true});
	if (g_debug) {
		gl = tdl.webgl.makeDebugContext(gl);
	}

    $("#splatterCanvas").click(function(ev) {
        if (inRect([ev.offsetX, ev.offsetY], splamRect)) {
            resetZoomPan();
            var x = ev.offsetX - splamRect[0];
            var y = ev.offsetY - splamRect[1];
            var i = Math.floor(x / (splamPixPerEl + splamSpacer));
            var j = Math.floor(y / (splamPixPerEl + splamSpacer)) + 1;
            if (i < j && j < splamWidth + 1) {
                xVar = i;
                yVar = j;
            }
            draw2d();
        }
    });

    $("#splatterCanvas").mousedown(function(ev) {
        if (inRect([ev.offsetX, ev.offsetY], mainRect)) {
            dragOldX = ev.offsetX - mainRect[0];
            dragOldY = ev.offsetY - mainRect[1];
            dragging = true;
        }
    });

    $("#splatterCanvas").mouseup(function() { dragging = false });
    $("#splatterCanvas").mouseout(function() { dragging = false });

    function constrainZoom() {
        var zoomLevel = zoomRect[2];
        if (zoomRect[0] < -0.5 * zoomLevel) zoomRect[0] = -0.5 * zoomLevel;
        if (zoomRect[1] < -0.5 * zoomLevel) zoomRect[1] = -0.5 * zoomLevel;

        if (zoomRect[0] > 1.5 - zoomLevel) zoomRect[0] = 1.5 - zoomLevel;
        if (zoomRect[1] > 1.5 - zoomLevel) zoomRect[1] = 1.5 - zoomLevel;
    }

    $("#splatterCanvas").mousemove(function(ev) {
        if (!dragging) return;
        if (!inRect([ev.offsetX, ev.offsetY], mainRect)) return;
        var x = ev.offsetX - mainRect[0];
        var y = ev.offsetY - mainRect[1];
        var dx = x - dragOldX;
        var dy = y - dragOldY;
        dx = dx / mainRect[2];
        dy = dy / mainRect[3];
        zoomRect[0] -= dx * zoomRect[2];
        zoomRect[1] += dy * zoomRect[2];
        constrainZoom();

        dragOldX = x;
        dragOldY = y;
        drawAxesLabels();
    });


    $("#splatterCanvas").mousewheel(function(ev, delta, deltaX, deltaY) {
        if (!inRect([ev.offsetX, ev.offsetY], mainRect)) return;
        ev.preventDefault();
        var zoomLevel = zoomRect[2];
        if (zoomLevel > 0.95 && deltaY < 0) return;

        zoomLevel = deltaY > 0 ? zoomLevel * 0.96 : zoomLevel / 0.96;
        if (zoomLevel < 0.01) zoomLevel = 0.01;
        if (zoomLevel > 1.0) zoomLevel = 1.0;

        var centerX = (ev.offsetX - mainRect[0]) / mainRect[2];
        var centerY = 1 - (ev.offsetY - mainRect[1]) / mainRect[3];

        centerX = centerX * 0.04 + 0.48;
        centerY = centerY * 0.04 + 0.48;

        centerX = zoomRect[0] + centerX * zoomRect[2];
        centerY = zoomRect[1] + centerY * zoomRect[3];

        zoomRect = [centerX - zoomLevel / 2, centerY - zoomLevel / 2, zoomLevel, zoomLevel];
        constrainZoom();
        drawAxesLabels();
    });

    $("#filein").change(function(ev) {
        $("#datasettoggle input").get(2).disabled = false;
        $("#datasettoggle").buttonset("refresh");
        files = ev.target.files;
        datasets.user.files = files;
        loadGroups(datasets.user);
    });

    canvasRect = [0, 0, gl.canvas.width, gl.canvas.height];

	renderBuffer = new tdl.framebuffers.Float32Framebuffer(renderSize, renderSize);
	initializeGl();

	function loadShader(str, opt_vs, opt_fs) {
		opt_vs = opt_vs || str + ".vs";
		opt_fs = opt_fs || str + ".fs";
		var fs, vs;
		$.get(shadersPath + opt_vs, function(data) {
				vs = data;
				if (fs) {
					shaders[str] = tdl.programs.loadProgram(vs, fs);
				}
			}
		);
		$.get(shadersPath + opt_fs, function(data) {
				fs = data;
				if (vs) {
					shaders[str] = tdl.programs.loadProgram(vs, fs);
				}
			}
		);
	};
	loadShader("plot");
	loadShader("kde");
	loadShader("kde16", "kde.vs", "kde16.fs");
	loadShader("kde32", "kde.vs", "kde32.fs");
	loadShader("kde64", "kde.vs", "kde64.fs");
	loadShader("max");
	loadShader("jfa");
	loadShader("threshold");
	loadShader("extract");
	loadShader("sample");
	loadShader("sampleCombine");
	loadShader("combine");
	loadShader("draw");

    createTextures();
	loadGroups(datasets.small);
	loadGroups(datasets.large);

    useDataset(datasets.small)

	setupControls();

	render();
});
