/**
 * InstancedRenderer - WebGL2 Instanced Rendering을 위한 베이스 클래스
 *
 * Instancing을 사용하여 동일한 메시를 여러 번 렌더링할 때 성능을 크게 향상시킵니다.
 * 단일 드로우콜로 수백 개의 객체를 렌더링할 수 있습니다.
 */
export class InstancedRenderer {
  /**
   * @param {WebGL2RenderingContext} gl
   * @param {number} maxInstances - 최대 인스턴스 수
   */
  constructor(gl, maxInstances) {
    this.gl = gl;
    this.maxInstances = maxInstances;
    this.currentInstanceCount = 0;

    // VAO와 버퍼들
    this.vao = null;
    this.meshVBO = null;
    this.instanceBuffers = {};

    // 셰이더 프로그램
    this.program = null;
    this.uniformLocations = {};
    this.attribLocations = {};

    // 메시 데이터
    this.meshVertexCount = 0;
  }

  /**
   * 셰이더 프로그램을 생성하고 컴파일합니다.
   * @param {string} vertexShaderSource
   * @param {string} fragmentShaderSource
   * @param {string[]} uniforms - uniform 변수 이름 배열
   * @param {string[]} attributes - attribute 변수 이름 배열
   */
  createProgram(vertexShaderSource, fragmentShaderSource, uniforms, attributes) {
    const gl = this.gl;

    // Vertex shader 컴파일
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error('Vertex shader compile error:', gl.getShaderInfoLog(vertexShader));
      return null;
    }

    // Fragment shader 컴파일
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error('Fragment shader compile error:', gl.getShaderInfoLog(fragmentShader));
      return null;
    }

    // 프로그램 링크
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(this.program));
      return null;
    }

    // Uniform 위치 저장
    for (const uniform of uniforms) {
      this.uniformLocations[uniform] = gl.getUniformLocation(this.program, uniform);
    }

    // Attribute 위치 저장
    for (const attribute of attributes) {
      this.attribLocations[attribute] = gl.getAttribLocation(this.program, attribute);
    }

    // 셰이더 삭제 (프로그램에 링크되었으므로)
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    return this.program;
  }

  /**
   * VAO를 생성하고 메시 데이터를 설정합니다.
   * @param {Float32Array} meshVertices - 메시 정점 데이터
   */
  setupMesh(meshVertices) {
    const gl = this.gl;

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);

    // 메시 VBO (정적 데이터)
    this.meshVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshVBO);
    gl.bufferData(gl.ARRAY_BUFFER, meshVertices, gl.STATIC_DRAW);

    this.meshVertexCount = meshVertices.length / 2;

    gl.bindVertexArray(null);
  }

  /**
   * 인스턴스 버퍼를 생성합니다.
   * @param {string} name - 버퍼 이름
   * @param {number} size - 각 인스턴스당 데이터 크기 (예: 2 for vec2, 4 for vec4)
   * @param {number} attributeLocation - 셰이더 attribute 위치
   * @param {number} divisor - instancing divisor (보통 1)
   */
  createInstanceBuffer(name, size, attributeLocation, divisor = 1) {
    const gl = this.gl;

    const buffer = gl.createBuffer();
    const data = new Float32Array(this.maxInstances * size);

    this.instanceBuffers[name] = {
      buffer,
      data,
      size,
      attributeLocation,
      divisor
    };

    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);

    // Attribute 설정
    gl.enableVertexAttribArray(attributeLocation);
    gl.vertexAttribPointer(attributeLocation, size, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(attributeLocation, divisor);

    gl.bindVertexArray(null);
  }

  /**
   * 인스턴스 버퍼 데이터를 업데이트합니다.
   * @param {string} name - 버퍼 이름
   * @param {Float32Array} data - 새 데이터
   * @param {number} count - 인스턴스 수
   */
  updateInstanceBuffer(name, data, count) {
    const gl = this.gl;
    const bufferInfo = this.instanceBuffers[name];

    if (!bufferInfo) {
      console.error(`Instance buffer '${name}' not found`);
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfo.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.slice(0, count * bufferInfo.size));
  }

  /**
   * 메시 attribute를 설정합니다.
   * @param {number} attributeLocation
   * @param {number} size
   */
  setupMeshAttribute(attributeLocation, size) {
    const gl = this.gl;

    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.meshVBO);
    gl.enableVertexAttribArray(attributeLocation);
    gl.vertexAttribPointer(attributeLocation, size, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(attributeLocation, 0); // 정점마다 (인스턴스마다가 아님)
    gl.bindVertexArray(null);
  }

  /**
   * 인스턴스들을 렌더링합니다.
   * @param {number} instanceCount - 렌더링할 인스턴스 수
   */
  render(instanceCount) {
    const gl = this.gl;

    if (instanceCount <= 0) return;

    this.currentInstanceCount = instanceCount;

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.drawArraysInstanced(gl.TRIANGLES, 0, this.meshVertexCount, instanceCount);

    gl.bindVertexArray(null);
  }

  /**
   * Uniform 값을 설정합니다.
   * @param {string} name - uniform 이름
   * @param {number|number[]} value - 값
   */
  setUniform(name, value) {
    const gl = this.gl;
    const location = this.uniformLocations[name];

    if (!location) {
      console.warn(`Uniform '${name}' not found`);
      return;
    }

    gl.useProgram(this.program);

    if (Array.isArray(value)) {
      if (value.length === 2) {
        gl.uniform2f(location, value[0], value[1]);
      } else if (value.length === 4) {
        gl.uniform4f(location, value[0], value[1], value[2], value[3]);
      }
    } else {
      gl.uniform1f(location, value);
    }
  }

  /**
   * 리소스를 정리합니다.
   */
  dispose() {
    const gl = this.gl;

    if (this.vao) {
      gl.deleteVertexArray(this.vao);
    }

    if (this.meshVBO) {
      gl.deleteBuffer(this.meshVBO);
    }

    for (const bufferInfo of Object.values(this.instanceBuffers)) {
      gl.deleteBuffer(bufferInfo.buffer);
    }

    if (this.program) {
      gl.deleteProgram(this.program);
    }
  }
}
