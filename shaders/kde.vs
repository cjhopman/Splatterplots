attribute vec2 pos;

varying vec2 vPos;

void main(void) 
{
	vPos = 0.5 * (pos + vec2(1.0, 1.0));
	gl_Position = vec4(pos.xy, 0.0, 1.0);
}
