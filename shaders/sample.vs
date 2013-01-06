uniform vec2 yBounds;
uniform vec2 xBounds;
uniform vec4 channel;
uniform float textureWidth;
uniform float gridSize;
uniform float clipDistance;

uniform vec4 xVar0;
uniform vec4 xVar1;
uniform vec4 xVar2;
uniform vec4 yVar0;
uniform vec4 yVar1;
uniform vec4 yVar2;

uniform vec4 drawRect;

uniform sampler2D texture;

attribute vec4 vals0;
attribute vec4 vals1;
attribute vec4 vals2;

varying vec4 vColor;
varying vec2 vPos;


void main(void) 
{
	float x = dot(vals0, xVar0) + dot(vals1, xVar1) + dot(vals2, xVar2);
	float y = dot(vals0, yVar0) + dot(vals1, yVar1) + dot(vals2, yVar2);

	x = (x - xBounds.s) / (xBounds.t - xBounds.s);
	y = (y - yBounds.s) / (yBounds.t - yBounds.s);

	x = drawRect.x + x * drawRect.z;
	y = drawRect.y + y * drawRect.w;

	float cx = floor(x / gridSize) / textureWidth;
	float cy = floor(y / gridSize) / textureWidth;

	cx = (cx * 2.0) - 1.0;
	cy = (cy * 2.0) - 1.0;

	float distance = dot(channel, texture2D(texture, vec2(x, y)));
	distance = (1.0 - distance) * textureWidth;
	float clip = distance < clipDistance ? 0.0 : 1.0;

	vColor = vec4(x, y, 1.0, clip);
	gl_Position = vec4(cx, cy, mod(dot(vec4(1.0, 1.0, 1.0, 1.0), vals0 + vals1 + vals2), 1.0), clip);
}
