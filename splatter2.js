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
var bounds;

var activeGroups = [0, 0, 0, 0, 0, 0, 0, 0];
var renderBuffer;

var xVar = 6;
var yVar = 3;

var maxCols = 12;
var renderSize = 1024;

var quadBuffer;

var texturesPerPipeline = 8;
var channelsPerTexture = 4;

var plotScale = 0.01;

var threshold = 0.15;

var kdeSigma = 16;
var kdeWindow = 32;

var gridPixels = 12;
var sampleClip = 12;

var pointRadius = 2.5;

var combineLightness = 73;
var combineChroma = 100;
var combineAttenuateLightness = 0.7;
var combineAttenuateChroma = 0.7;
var combineStrokeSize = 3;

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
	for (var i=0, l=lines.length; i<l; i++) {
		lines[i] = lines[i].split(opt_delim);
	}
	if (lines.length > 0 && lines[0].length > 0) {
		if (!$.isNumeric(lines[0][0])) {
			var header = lines[0];
			lines[0] = lines[lines.length - 1];
			lines.pop();
		}
	}
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

var currDs;
function useDataset(ds) {
    currDs = ds;
    ds.groups.initialized = false;
    for (var i = 0; i < ds.files.length; i++) {
        initializeGroup(ds, i);
    }
    for (var i = 0; i < activeGroups.length; i++)
        activeGroups[i] = i < ds.files.length ? 1 : 0;
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
            if (ds == currDs) {
                initializeGroup(ds, groupId);
            }
        }
    }

	for (var f = 0; f < files.length; f++) {
		$.get(files[f], csvLoader(f))
	}
}

function getBounds(v) {
	return bounds[v] || [0, 1];
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

	shader.uniform.xBounds(getBounds(xVar));
	shader.uniform.yBounds(getBounds(yVar));
	shader.uniform.drawRect(drawRect);

	shader.uniform.scale(plotScale);

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

function renderKde(sigma, window, textures, blockWidth) {
	var shader = shaders["kde"];
	if (!shader) return;

	gl.disable(gl.DEPTH_TEST);

	gl.useProgram(shader.program);
	shader.uniform.sigma(sigma);
	shader.uniform.kWindow(window);
    shader.uniform.blockWidth(blockWidth);

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

function renderMax() {
	var shader = shaders["max"];
	if (!shader) return;

	gl.disable(gl.DEPTH_TEST);
	gl.useProgram(shader.program);
	shader.attrib.pos(quadBuffer);

	var scalePerStep = 8;
	var stepsNeeded = 3;

	for (var t = 0; t < textures.length; t++) {
		for (var i = 0; i < stepsNeeded; i++) {
			var toLeft = (i % 2) != (stepsNeeded % 2);

			renderBuffer.bind(textures[t][toLeft ? 2 : 3]);
			shader.uniform.texture(textures[t][i == 0 ? 1 : toLeft ? 3 : 2]);

			var stage = 2 << (3 * (stepsNeeded - i -1));
			shader.uniform.drawRect([0, 0, stage / renderBuffer.width, stage / renderBuffer.width]);
			shader.uniform.textureWidth(renderBuffer.width);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
			gl.drawArrays(gl.TRIANGLES, 0, 6);
		}
	}
}

function renderThreshold(threshold, target) {
	var shader = shaders["threshold"];
	if (!shader) return;

	gl.disable(gl.DEPTH_TEST);
	gl.useProgram(shader.program);

	shader.uniform.threshold(threshold);
	shader.attrib.pos(quadBuffer);
	shader.uniform.textureWidth(renderBuffer.width);

	for (var t = 0; t < textures.length; t++) {
		renderBuffer.bind(target[t][4]);
		shader.uniform.maximum(textures[t][2]);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
		shader.uniform.texture(target[t][1]);
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

	var jumpsNeeded = 7;

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

	gl.enable(gl.BLEND);
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

	shader.uniform.xBounds(getBounds(xVar));
	shader.uniform.yBounds(getBounds(yVar));
	shader.uniform.drawRect(drawRect);

	shader.uniform.textureWidth(renderBuffer.width);
	shader.uniform.clipDistance(sampleClip);

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
		renderBuffer.bind(textures[t][3]);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
	}
}

function renderCombine(pidx, sidx, textures, destination) {
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
	
	shader.uniform.drawRect([0.0, 0.0, 0.5, 1]);
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
			shader.uniform.drawRect([0.5 + 0.0625 * i, 0.875 - 0.125 * j, 0.0625, 0.125]);
			shader.uniform.textureRect([x * 0.125, y * 0.125, 0.125, 0.125]);
			gl.drawArrays(gl.TRIANGLES, 0, 6);
		}
	}
}

function initializeGroups() {
	if (!shaders["plot"]) return;
	if (!shaders["sample"]) return;

	var nCols = groups[0].numCols;

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
}

var showLoopTime = false;
function render() {
    groups = currDs.groups.slice(0);
    bounds = currDs.bounds.slice(0);
	if (!currDs.groups.ready) {
		setTimeout("render()", 100);
		return;
	}
	if (!currDs.groups.initialized) {
        initializeGroups();
        currDs.groups.initialized = true;
    }
	
	renderPlot(xVar, yVar, [0.0, 0.0, 1.0, 1.0], true, textures);
	renderKde(kdeSigma, kdeWindow, textures, 1.0);
	renderKde(kdeSigma / 8, kdeWindow / 8, splamTextures, 0.125);
	renderMax();
	renderThreshold(threshold, textures);
	renderThreshold(threshold * 16, splamTextures);
	renderJfa();
	renderSample(xVar, yVar, [0, 0, 1, 1], gridPixels, true, textures);
	renderSampleCombine(gridPixels, pointRadius, textures);
	renderCombine(3, 2, textures, splatterTexture);
	renderCombine(3, 4, splamTextures, splamTexture);
	renderDraw();

	tdl.webgl.requestAnimationFrame(render, gl.canvas);
	//setTimeout("render()", 100);
}

function setupControls() {
	function makeSlider(tgt, min, max, step) {
		$("#" + tgt + "Slider").slider({
			min: min,
			max: max,
			step: step,
			value: this[tgt],
			slide: function(ev, ui) {
				window[tgt] = ui.value;
			}
		})
	}
	makeSlider("gridPixels", 1, 64, 1);
	makeSlider("threshold", 0.00001, 1, 0.00001);
	makeSlider("kdeSigma", 1, 64, 0.5);
	makeSlider("kdeWindow", 2, 128, 1);
	makeSlider("sampleClip", 1, 64, 1);
	makeSlider("pointRadius", 0.5, 10, 0.5);
	makeSlider("combineLightness", 0, 100, 0.1);
	makeSlider("combineChroma", 0, 100, 0.1);
	makeSlider("combineAttenuateLightness", 0, 1, 0.01);
	makeSlider("combineAttenuateChroma", 0, 1, 0.01);
	makeSlider("combineStrokeSize", 0, 10, 0.25);
	makeSlider("xVar", 0, 12, 1);
	makeSlider("yVar", 0, 12, 1);
}

$(document).ready(function () {
	math = tdl.math;
	fast = tdl.fast;
	var glCanvas = $("#splatterCanvas").get();
	gl = tdl.webgl.setupWebGL(splatterCanvas, {preserveDrawingBuffer: true});
	if (g_debug) {
		gl = tdl.webgl.makeDebugContext(gl);
	}

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
	//loadGroups(datasets.large);

    useDataset(datasets.small)

	setupControls();

	render();
});
