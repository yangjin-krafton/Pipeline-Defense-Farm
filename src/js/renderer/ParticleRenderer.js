import { InstancedRenderer } from './InstancedRenderer.js';

/**
 * ParticleRenderer - 파티클을 Instanced Rendering으로 렌더링
 *
 * 수천 개의 파티클을 단일 드로우콜로 효율적으로 렌더링합니다.
 */
export class ParticleRenderer extends InstancedRenderer {
  /**
   * @param {WebGL2RenderingContext} gl
   * @param {number} maxParticles - 최대 파티클 수 (기본: 2000)
   * @param {number[]} resolution - 가상 해상도 [width, height]
   */
  constructor(gl, maxParticles = 2000, resolution = [360, 640]) {
    super(gl, maxParticles);

    this.resolution = resolution;

    // 셰이더 생성
    this._createShaders();

    // 사각형 메시 생성 (파티클은 작은 사각형)
    this._createParticleMesh();

    // 인스턴스 버퍼 생성
    this._createInstanceBuffers();

    // 임시 데이터 배열
    this.tempPositions = new Float32Array(maxParticles * 2);
    this.tempColors = new Float32Array(maxParticles * 4);
    this.tempSizes = new Float32Array(maxParticles);
  }

  /**
   * 셰이더를 생성합니다.
   */
  _createShaders() {
    const vertexShader = `#version 300 es
      in vec2 aPosition;          // 사각형 메시 정점
      in vec2 aInstancePos;       // 파티클 위치 (인스턴스)
      in vec4 aInstanceColor;     // 파티클 색상 (인스턴스)
      in float aInstanceSize;     // 파티클 크기 (인스턴스)

      uniform vec2 uResolution;

      out vec4 vColor;
      out vec2 vTexCoord;

      void main() {
        // 메시 정점을 크기에 맞게 스케일하고 위치에 배치
        vec2 worldPos = aPosition * aInstanceSize + aInstancePos;

        // 가상 해상도를 클립 공간으로 변환
        vec2 clip = (worldPos / uResolution) * 2.0 - 1.0;
        gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);

        vColor = aInstanceColor;
        vTexCoord = aPosition; // 0 ~ 1 범위
      }
    `;

    const fragmentShader = `#version 300 es
      precision highp float;

      in vec4 vColor;
      in vec2 vTexCoord;

      out vec4 outColor;

      void main() {
        // 원형 모양 만들기
        vec2 coord = vTexCoord * 2.0 - 1.0; // -1 ~ 1 범위
        float dist = length(coord);

        // 부드러운 엣지
        float alpha = 1.0 - smoothstep(0.5, 1.0, dist);

        outColor = vec4(vColor.rgb, vColor.a * alpha);

        // 중심부 밝게 (빛나는 효과)
        float glow = 1.0 - smoothstep(0.0, 0.7, dist);
        outColor.rgb += vec3(0.2) * glow;
      }
    `;

    this.createProgram(
      vertexShader,
      fragmentShader,
      ['uResolution'],
      ['aPosition', 'aInstancePos', 'aInstanceColor', 'aInstanceSize']
    );

    // 해상도 uniform 설정
    this.setUniform('uResolution', this.resolution);
  }

  /**
   * 사각형 메시를 생성합니다.
   */
  _createParticleMesh() {
    const vertices = new Float32Array([
      // 첫 번째 삼각형
      -0.5, -0.5,
      0.5, -0.5,
      -0.5, 0.5,

      // 두 번째 삼각형
      0.5, -0.5,
      0.5, 0.5,
      -0.5, 0.5
    ]);

    this.setupMesh(vertices);

    // 메시 attribute 설정
    this.setupMeshAttribute(this.attribLocations.aPosition, 2);
  }

  /**
   * 인스턴스 버퍼들을 생성합니다.
   */
  _createInstanceBuffers() {
    // 위치 버퍼 (vec2)
    this.createInstanceBuffer(
      'position',
      2,
      this.attribLocations.aInstancePos,
      1
    );

    // 색상 버퍼 (vec4)
    this.createInstanceBuffer(
      'color',
      4,
      this.attribLocations.aInstanceColor,
      1
    );

    // 크기 버퍼 (float)
    this.createInstanceBuffer(
      'size',
      1,
      this.attribLocations.aInstanceSize,
      1
    );
  }

  /**
   * 파티클 데이터를 업데이트하고 렌더링합니다.
   * @param {Object[]} particles - 파티클 배열
   */
  update(particles) {
    if (!particles || particles.length === 0) {
      return;
    }

    const count = Math.min(particles.length, this.maxInstances);

    // 임시 배열에 데이터 채우기
    for (let i = 0; i < count; i++) {
      const particle = particles[i];

      // 위치
      this.tempPositions[i * 2] = particle.x;
      this.tempPositions[i * 2 + 1] = particle.y;

      // 색상
      this.tempColors[i * 4] = particle.color[0];
      this.tempColors[i * 4 + 1] = particle.color[1];
      this.tempColors[i * 4 + 2] = particle.color[2];
      this.tempColors[i * 4 + 3] = particle.color[3];

      // 크기
      this.tempSizes[i] = particle.size;
    }

    // GPU로 데이터 전송
    this.updateInstanceBuffer('position', this.tempPositions, count);
    this.updateInstanceBuffer('color', this.tempColors, count);
    this.updateInstanceBuffer('size', this.tempSizes, count);

    // 렌더링
    this.render(count);
  }

  /**
   * 해상도를 업데이트합니다.
   * @param {number[]} resolution - [width, height]
   */
  updateResolution(resolution) {
    this.resolution = resolution;
    this.setUniform('uResolution', resolution);
  }
}
