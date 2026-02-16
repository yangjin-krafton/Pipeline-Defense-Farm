/**
 * WebGL2 Renderer for path and background rendering
 */
import { VIRTUAL_W, VIRTUAL_H } from '../config.js';

export class WebGLRenderer {
  constructor(gl) {
    this.gl = gl;
    this.program = null;
    this.locations = {};
    this.vao = null;
    this.dynamicBuffer = null;
    this.cachedTypedArray = null;

    this._initShaders();
  }

  _initShaders() {
    const gl = this.gl;

    const vs = `#version 300 es
      in vec2 aPosition;
      uniform vec2 uResolution;
      void main() {
        vec2 zeroToOne = aPosition / uResolution;
        vec2 clip = zeroToOne * 2.0 - 1.0;
        gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);
      }
    `;

    const fs = `#version 300 es
      precision highp float;
      uniform vec4 uColor;
      out vec4 outColor;
      void main() {
        outColor = uColor;
      }
    `;

    this.program = this._createProgram(vs, fs);
    this.locations.aPosition = gl.getAttribLocation(this.program, "aPosition");
    this.locations.uResolution = gl.getUniformLocation(this.program, "uResolution");
    this.locations.uColor = gl.getUniformLocation(this.program, "uColor");

    this.vao = gl.createVertexArray();
    this.dynamicBuffer = gl.createBuffer();

    gl.bindVertexArray(this.vao);
    gl.enableVertexAttribArray(this.locations.aPosition);
    gl.useProgram(this.program);
    gl.uniform2f(this.locations.uResolution, VIRTUAL_W, VIRTUAL_H);

    // Enable blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  _createShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(error || "Shader compile failed");
    }
    return shader;
  }

  _createProgram(vs, fs) {
    const gl = this.gl;
    const vert = this._createShader(gl.VERTEX_SHADER, vs);
    const frag = this._createShader(gl.FRAGMENT_SHADER, fs);
    const program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error(error || "Program link failed");
    }
    return program;
  }

  _bindBuffer(buffer) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(this.locations.aPosition, 2, gl.FLOAT, false, 0, 0);
  }

  /**
   * Create a static mesh from vertices
   * @param {Array<number>} vertices - Vertex array
   * @returns {Object} Mesh object with buffer and count
   */
  createMesh(vertices) {
    const gl = this.gl;
    const mesh = {
      buffer: gl.createBuffer(),
      count: Math.floor(vertices.length / 2)
    };
    this._bindBuffer(mesh.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    return mesh;
  }

  /**
   * Draw a static mesh
   * @param {Object} mesh - Mesh object
   * @param {Array<number>} color - RGBA color [r, g, b, a]
   */
  drawMesh(mesh, color) {
    if (!mesh || mesh.count === 0) return;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    this._bindBuffer(mesh.buffer);
    gl.uniform4f(this.locations.uColor, color[0], color[1], color[2], color[3]);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  }

  /**
   * Draw dynamic triangles (recreates buffer each frame)
   * @param {Array<number>} vertices - Vertex array
   * @param {Array<number>} color - RGBA color [r, g, b, a]
   */
  drawTriangles(vertices, color) {
    if (!vertices || vertices.length === 0) return;

    const gl = this.gl;

    // Reuse typed array if same size
    if (!this.cachedTypedArray || this.cachedTypedArray.length !== vertices.length) {
      this.cachedTypedArray = new Float32Array(vertices.length);
    }
    this.cachedTypedArray.set(vertices);

    this._bindBuffer(this.dynamicBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.cachedTypedArray, gl.STREAM_DRAW);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.uniform4f(this.locations.uColor, color[0], color[1], color[2], color[3]);
    gl.drawArrays(gl.TRIANGLES, 0, Math.floor(vertices.length / 2));
  }

  /**
   * Clear the canvas
   * @param {Array<number>} color - RGBA color [r, g, b, a]
   */
  clear(color = [1.0, 0.89, 0.80, 1.0]) {
    const gl = this.gl;
    gl.clearColor(color[0], color[1], color[2], color[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }
}
