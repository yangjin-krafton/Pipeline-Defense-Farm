import { InstancedRenderer } from './InstancedRenderer.js';

/**
 * BulletRenderer - 총알을 Instanced Rendering으로 렌더링
 *
 * 수백 개의 총알을 단일 드로우콜로 효율적으로 렌더링합니다.
 */
export class BulletRenderer extends InstancedRenderer {
  /**
   * @param {WebGL2RenderingContext} gl
   * @param {number} maxBullets - 최대 총알 수 (기본: 500)
   * @param {number} resolution - 가상 해상도 [width, height]
   */
  constructor(gl, maxBullets = 500, resolution = [360, 640]) {
    super(gl, maxBullets);

    this.resolution = resolution;

    // 셰이더 생성
    this._createShaders();

    // 원형 메시 생성 (총알 모양)
    this._createBulletMesh(12); // 12개 삼각형으로 원 만들기

    // 인스턴스 버퍼 생성
    this._createInstanceBuffers();

    // 임시 데이터 배열 (매 프레임 재사용)
    this.tempPositions = new Float32Array(maxBullets * 2);
    this.tempColors = new Float32Array(maxBullets * 4);
    this.tempSizes = new Float32Array(maxBullets);
  }

  /**
   * 셰이더를 생성합니다.
   */
  _createShaders() {
    const vertexShader = `#version 300 es
      in vec2 aPosition;          // 원 메시 정점
      in vec2 aInstancePos;       // 총알 위치 (인스턴스)
      in vec4 aInstanceColor;     // 총알 색상 (인스턴스)
      in float aInstanceSize;     // 총알 크기 (인스턴스)

      uniform vec2 uResolution;

      out vec4 vColor;
      out vec2 vCircleCoord;      // 원형 판정용 좌표

      void main() {
        // 메시 정점을 크기에 맞게 스케일하고 위치에 배치
        vec2 worldPos = aPosition * aInstanceSize + aInstancePos;

        // 가상 해상도를 클립 공간으로 변환
        vec2 clip = (worldPos / uResolution) * 2.0 - 1.0;
        gl_Position = vec4(clip * vec2(1.0, -1.0), 0.0, 1.0);

        vColor = aInstanceColor;
        vCircleCoord = aPosition; // -1 ~ 1 범위
      }
    `;

    const fragmentShader = `#version 300 es
      precision highp float;

      in vec4 vColor;
      in vec2 vCircleCoord;

      out vec4 outColor;

      void main() {
        // 원형 모양 만들기 (부드러운 엣지)
        float dist = length(vCircleCoord);

        // Anti-aliasing을 위한 부드러운 엣지
        float alpha = 1.0 - smoothstep(0.9, 1.0, dist);

        outColor = vec4(vColor.rgb, vColor.a * alpha);

        // 중심부 하이라이트 (빛나는 효과)
        float highlight = 1.0 - smoothstep(0.0, 0.5, dist);
        outColor.rgb += vec3(0.3) * highlight;
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
   * 원형 메시를 생성합니다.
   * @param {number} segments - 삼각형 개수
   */
  _createBulletMesh(segments) {
    const vertices = [];

    for (let i = 0; i < segments; i++) {
      const angle1 = (i / segments) * Math.PI * 2;
      const angle2 = ((i + 1) / segments) * Math.PI * 2;

      // 중심점
      vertices.push(0, 0);

      // 첫 번째 호 포인트
      vertices.push(Math.cos(angle1), Math.sin(angle1));

      // 두 번째 호 포인트
      vertices.push(Math.cos(angle2), Math.sin(angle2));
    }

    this.setupMesh(new Float32Array(vertices));

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
   * 총알 데이터를 업데이트하고 렌더링합니다.
   * @param {Bullet[]} bullets - 총알 배열
   */
  update(bullets) {
    if (!bullets || bullets.length === 0) {
      return;
    }

    const count = Math.min(bullets.length, this.maxInstances);

    // 임시 배열에 데이터 채우기
    for (let i = 0; i < count; i++) {
      const bullet = bullets[i];

      // 위치
      this.tempPositions[i * 2] = bullet.x;
      this.tempPositions[i * 2 + 1] = bullet.y;

      // 색상
      this.tempColors[i * 4] = bullet.color[0];
      this.tempColors[i * 4 + 1] = bullet.color[1];
      this.tempColors[i * 4 + 2] = bullet.color[2];
      this.tempColors[i * 4 + 3] = bullet.color[3];

      // 크기
      this.tempSizes[i] = bullet.size;
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
