/* Gota — l'acqua: tre fragment shader WebGL (superficie, goccia, fondo), uno per canvas.
   La lente della goccia (cupola, rifrazione, bordo, riflesso) è adattata da Animorio,
   «La goccia d'acqua che deforma il titolo sotto il puntatore»: vedi CREDITS.md.
   Se WebGL manca o una texture viene rifiutata (file://), create() lancia e la pagina resta sulle immagini. */
(function () {
  'use strict';

  const VERT = 'attribute vec2 a;varying vec2 vUv;void main(){vUv=vec2(a.x*.5+.5,.5-a.y*.5);gl_Position=vec4(a,0.,1.);}';

  /* cupola della goccia: normale da d (distanza dal bordo, negativa dentro) e dal suo gradiente */
  const DOME = `
  vec3 dome(float d, float R, vec2 g, out float t, out float h) {
    t = clamp(-d / R, 0.0, 1.0);
    h = sqrt(max(0.0, 1.0 - (1.0 - t) * (1.0 - t)));
    g /= max(length(g), 0.0001);
    float slope = (1.0 - t) / max(h, 0.12);
    return normalize(vec3(g * slope, 1.0));
  }
  vec3 glaze(vec3 refr, vec3 n, float t, vec2 g) {
    float rim = smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.1, 0.32, t));
    vec3 L = normalize(vec3(-0.5, -0.65, 0.6));
    refr *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.08, t));
    refr += vec3(0.86, 0.93, 1.0) * rim * 0.3 * smoothstep(0.2, 0.8, clamp(dot(n, L), 0.0, 1.0));
    refr += vec3(0.7, 0.84, 1.0) * rim * 0.16 * smoothstep(0.2, 0.8, dot(-normalize(g), L.xy));
    vec3 hv = normalize(L + vec3(0.0, 0.0, 1.0));
    refr += vec3(1.0) * pow(clamp(dot(n, hv), 0.0, 1.0), 90.0) * 0.95;
    return refr;
  }`;

  /* 2 · superficie: foto + frase in una texture, onde lente, anello d'impatto, goccia-lente */
  const SURFACE = `precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTex; uniform vec2 uRes; uniform vec4 uRing; uniform float uAmb, uTime; uniform vec4 uDrop; uniform vec2 uDir; uniform float uShow;
  ${DOME}
  vec3 scene(vec2 px) { return texture2D(uTex, px / uRes).rgb; }
  float sd(vec2 p) {
    vec2 q = p - uDrop.xy; float s = uDrop.w;
    vec2 l = vec2(dot(q, uDir), dot(q, vec2(-uDir.y, uDir.x)));
    l.x /= 1.0 + s; l.y /= 1.0 - 0.32 * s;
    return (length(l) - uDrop.z) * (1.0 - 0.16 * s);
  }
  void main() {
    vec2 p = vUv * uRes;
    float u = min(uRes.x, uRes.y);
    vec2 off = vec2(sin(p.y / u * 9.0 + uTime * .9) + .5 * sin(p.y / u * 23.0 - uTime * 1.3 + p.x / u * 4.0),
                    .6 * sin(p.x / u * 7.0 + uTime * .7)) * u * .014 * uAmb;
    vec2 dv = (p - uRing.xy) * vec2(1.0, 2.2);
    float rr = length(dv);
    float dr = (rr - uRing.z) / u;
    float crest = sin(dr * 46.0) * exp(-dr * dr * 26.0) * uRing.w;
    off += normalize(dv + .001) * crest * u * .05;
    vec3 col = scene(p + off);
    col += vec3(.62, .78, 1.0) * max(crest, 0.0) * .2;
    if (uShow > 0.0) {
      float d = sd(p), R = uDrop.z;
      if (d < 1.5) {
        vec2 g = vec2(sd(p + vec2(1., 0.)) - sd(p - vec2(1., 0.)), sd(p + vec2(0., 1.)) - sd(p - vec2(0., 1.))) * .5;
        float t, h; vec3 n = dome(d, R, g, t, h);
        vec2 b = uDrop.xy + (p - uDrop.xy) * mix(1.0, .72, .5 + .5 * h) - n.xy * R * .18;
        float ab = (1.0 - t) * 2.2;
        vec3 refr = vec3(scene(b + n.xy * ab).r, scene(b).g, scene(b - n.xy * ab).b) * vec3(.97, 1.0, 1.05) + .012;
        col = mix(col, glaze(refr, n, t, g), (1.0 - smoothstep(-1.5, 1.5, d)) * uShow);
      }
    }
    gl_FragColor = vec4(col, 1.0);
  }`;

  /* 3 · la discesa: fondo che si scurisce, una goccia con dentro le tre note */
  const DROP = `precision highp float;
  varying vec2 vUv;
  uniform sampler2D uA, uB, uC; uniform vec3 uW; uniform vec2 uRes; uniform vec3 uDrop; uniform float uDepth, uTime, uWob;
  ${DOME}
  float sd(vec2 p) {                    /* goccia: tonda sotto, che si stringe verso la punta in alto */
    vec2 q = (p - uDrop.xy) / uDrop.z;
    q.x *= 1.0 + uWob * .05 * sin(q.y * 3.0 + uTime * 6.0);
    float top = max(-q.y, 0.0);
    q.x *= 1.0 + .42 * top * top;
    q.y *= q.y < 0.0 ? .68 : 1.0;
    return (length(q) - 1.0) * uDrop.z * .86;
  }
  vec3 notes(vec2 uv) {
    vec3 c = vec3(0.);
    if (uW.x > .001) c += texture2D(uA, uv).rgb * uW.x;
    if (uW.y > .001) c += texture2D(uB, uv).rgb * uW.y;
    if (uW.z > .001) c += texture2D(uC, uv).rgb * uW.z;
    return c;
  }
  void main() {
    vec2 p = vUv * uRes;
    float u = min(uRes.x, uRes.y);
    float y = vUv.y;
    vec3 top = mix(vec3(.022, .1, .185), vec3(.006, .034, .07), uDepth);
    vec3 bot = mix(vec3(.006, .034, .07), vec3(.003, .012, .026), uDepth);
    vec3 col = mix(top, bot, smoothstep(0., 1., y));
    /* onde di luce che si spengono scendendo */
    float w = sin(p.x / u * 5.0 + sin(p.y / u * 3.0 + uTime * .3) * 2.0 + uTime * .2);
    col += vec3(.05, .12, .22) * pow(.5 + .5 * w, 6.0) * (1.0 - y) * (1.0 - uDepth);
    /* alone attorno alla goccia */
    float d = sd(p), R = uDrop.z;
    col += vec3(.1, .2, .36) * exp(-max(d, 0.) / R * 2.6) * .32;
    if (d < 1.5) {
      vec2 g = vec2(sd(p + vec2(1., 0.)) - sd(p - vec2(1., 0.)), sd(p + vec2(0., 1.)) - sd(p - vec2(0., 1.))) * .5;
      float t, h; vec3 n = dome(d, R, g, t, h);
      vec2 q = (p - uDrop.xy) / R;
      vec2 uv = .5 + q * .46 * mix(1.0, .66, h) - n.xy * .09;
      uv += vec2(sin(q.y * 6.0 + uTime * 1.4), sin(q.x * 5.0 + uTime)) * .004 * (.4 + uWob);
      vec3 refr = vec3(notes(uv + n.xy * .006).r, notes(uv).g, notes(uv - n.xy * .006).b);
      refr *= mix(.62, 1.1, h);
      col = mix(col, glaze(refr, n, t, g), 1.0 - smoothstep(-1.5, 1.5, d));
    }
    gl_FragColor = vec4(col, 1.0);
  }`;

  /* 4 · il fondo: la luna vera tremolante, raggi e increspature calcolati al momento */
  const DEEP = `precision highp float;
  varying vec2 vUv;
  uniform sampler2D uMoon; uniform vec2 uRes, uC; uniform float uR, uTime, uRing, uRingA;
  float wav(vec2 p, float t) { return sin(p.x * 3.1 + t * .8 + sin(p.y * 2.3 - t * .6) * 1.4) + .6 * sin(p.y * 5.3 + t * 1.1 + sin(p.x * 3.7 + t * .5)) + .3 * sin((p.x + p.y) * 11.0 - t * 1.7); }
  void main() {
    vec2 p = vUv * uRes;
    float u = min(uRes.x, uRes.y);
    vec2 n = p / u, c = uC * uRes;
    float near = 1.0 - smoothstep(.0, .8, vUv.y);
    /* la superficie ondula: più forte vicino alla luna */
    vec2 off = vec2(wav(n * 1.6, uTime), wav(n.yx * 1.6 + 1.7, uTime * .9)) * u * .0095 * (.45 + near);
    float rd = (length(p - c) - uRing) / u;
    off += normalize(p - c + .001) * sin(rd * 40.0) * exp(-rd * rd * 30.0) * uRingA * u * .03;
    vec2 q = (p + off - c) / uR;
    float dist = length(p - c) / u;
    /* acqua: chiara in alto, nera in basso */
    vec3 col = mix(vec3(.05, .19, .33), vec3(.002, .012, .026), smoothstep(.0, .92, vUv.y));
    /* cono di luce sotto la superficie */
    float a = atan(p.x - c.x, p.y - c.y);
    float rays = .5 + .5 * sin(a * 7.0 + 1.3 + sin(a * 3.0 + uTime * .13) * 2.4);
    rays *= .62 + .38 * sin(a * 17.0 - uTime * .09 + 2.0 + sin(dist * 6.0 - uTime * .3));
    col += vec3(.16, .34, .58) * pow(rays, 1.3) * exp(-dist * 1.7) * .62 * (1.0 - smoothstep(.15, 1.15, abs(a)));
    /* increspature luminose in alto */
    float rip = pow(.5 + .5 * sin(wav(n * 2.2, uTime * 1.2) * 3.2), 5.0);
    col += vec3(.3, .52, .78) * rip * pow(near, 2.4) * .5;
    /* alone e disco */
    float lq = length(q);
    col += vec3(.5, .68, .92) * exp(-max(lq - 1.0, 0.) * 1.5) * .5;
    if (lq < 1.0) {
      vec3 m = texture2D(uMoon, q * .49 + .5).rgb;
      float lum = dot(m, vec3(.33));
      vec3 lit = mix(vec3(.46, .58, .74), vec3(1.0, 1.0, .97), smoothstep(.0, .86, lum));
      col = mix(col, lit, 1.0 - smoothstep(.965, 1.0, lq));
    }
    gl_FragColor = vec4(col, 1.0);
  }`;

  /* 1 · hero fermo: il primo fotogramma con i cerchi nell'acqua, solo sotto l'orizzonte.
     uRp: x, y, raggio del fronte, ampiezza (px del canvas). I cerchi sono ellissi: l'acqua è vista di taglio */
  const HERO = `precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTex; uniform vec2 uRes, uS; uniform float uH; uniform vec3 uBot; uniform vec4 uRp[10];
  /* il flacone non è acqua: 1 dentro la sua sagoma (x0, x1, base), in coordinate del fotogramma */
  float bottle(vec2 v) {
    float x = smoothstep(uBot.x - .006, uBot.x + .002, v.x) * (1. - smoothstep(uBot.y - .002, uBot.y + .006, v.x));
    return x * (1. - smoothstep(uBot.z - .002, uBot.z + .004, v.y));
  }
  void main() {
    vec2 uv = .5 + (vUv - .5) * uS;
    vec2 p = vUv * uRes;
    float u = min(uRes.x, uRes.y);
    float m = smoothstep(uH, uH + .05, uv.y) * (1. - bottle(uv));
    vec2 off = vec2(0.);
    float glint = 0.;
    if (m > 0.) {
      for (int i = 0; i < 10; i++) {
        vec4 r = uRp[i];
        if (r.w < .002) continue;
        vec2 dv = (p - r.xy) * vec2(1., 3.4);
        float d = (length(dv) - r.z) / u;
        float w = sin(d * 120.) * exp(-d * d * 260.) * r.w;
        off += normalize(dv + .001) * w;
        glint += max(w, 0.);
      }
    }
    vec2 s = uv + off * vec2(.006, .02) * m;
    vec3 col = mix(texture2D(uTex, s).rgb, texture2D(uTex, uv).rgb, bottle(s));   /* l'acqua non pesca pixel dal vetro */
    col += vec3(.5, .7, 1.) * glint * .07 * m;
    gl_FragColor = vec4(col, 1.);
  }`;

  function create(canvas, frag, names, opts) {
    opts = opts || {};
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) throw new Error('no webgl');
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {};
    names.forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });

    const api = {
      gl, U, w: 1, h: 1, dpr: 1,
      resize() {
        const r = canvas.getBoundingClientRect();
        api.w = Math.max(1, r.width); api.h = Math.max(1, r.height);
        let dpr = Math.min(window.devicePixelRatio || 1, 2);
        const max = opts.pixels || 8e5;                 /* oltre questi pixel lo shader costa solo di più */
        if (api.w * api.h * dpr * dpr > max) dpr = Math.sqrt(max / (api.w * api.h));
        api.dpr = dpr;
        canvas.width = Math.round(api.w * dpr); canvas.height = Math.round(api.h * dpr);
        gl.viewport(0, 0, canvas.width, canvas.height);
        if (U.uRes) gl.uniform2f(U.uRes, canvas.width, canvas.height);
      },
      tex(unit, source, name) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);   /* su file:// qui lancia SecurityError */
        gl.uniform1i(U[name], unit);
      },
      draw() { gl.drawArrays(gl.TRIANGLES, 0, 3); }
    };
    return api;
  }

  window.GotaWater = { create, HERO, SURFACE, DROP, DEEP };
})();
