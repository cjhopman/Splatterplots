attribute vec2 pos;

uniform vec4 drawRect;

varying vec2 vPos;

void main(void) 
{
	vPos = 0.5 * (pos + vec2(1.0, 1.0));
	vec2 opos = drawRect.xy + vPos * drawRect.zw;
	gl_Position = vec4(opos * 2.0 - 1.0, 0.0, 1.0);
}
