uniform vec2 yBounds;
uniform vec2 xBounds;
uniform vec4 channel;

uniform vec4 xVar0;
uniform vec4 xVar1;
uniform vec4 xVar2;
uniform vec4 yVar0;
uniform vec4 yVar1;
uniform vec4 yVar2;

uniform vec4 drawRect;

attribute vec4 vals0;
attribute vec4 vals1;
attribute vec4 vals2;

varying vec4 vColor;

void main(void) 
{
	float x = dot(vals0, xVar0) + dot(vals1, xVar1) + dot(vals2, xVar2);
	float y = dot(vals0, yVar0) + dot(vals1, yVar1) + dot(vals2, yVar2);

	x = (x - xBounds.s) / (xBounds.t - xBounds.s);
	y = (y - yBounds.s) / (yBounds.t - yBounds.s);

	vec2 vPos = drawRect.xy + vec2(x, y) * drawRect.zw;
	gl_Position = vec4(vPos * 2.0 - 1.0, 0.0, 1.0);

	vColor = channel * 0.0001;
}
