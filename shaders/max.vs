attribute vec2 pos;

uniform vec4 drawRect;

varying vec2 vPos;

void main(void) 
{
	vec2 opos = 0.5 * (pos + vec2(1.0, 1.0));
	vPos = drawRect.xy + opos * drawRect.zw;
	gl_Position = vec4(vPos * 2.0 - 1.0, 0.0, 1.0);
}
