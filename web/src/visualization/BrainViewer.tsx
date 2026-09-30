import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Box3,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  FrontSide,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';
import { useWorkspace } from '../state';
import { voxelToWorld, sliceDimensions, sliceVoxel } from '../data/geometry';
import { runWorker } from '../data/worker-client';
import { slicePixels } from './SliceViewer';
import {
  LABEL_COLORS,
  type CaseRecord,
  type MeshData,
  type Plane,
  type Vec3,
  type Volume,
} from '../types';

function disposeObject(object: Object3D) {
  object.traverse((child) => {
    if (child instanceof Mesh) {
      child.geometry.dispose();
      for (const material of Array.isArray(child.material) ? child.material : [child.material])
        material.dispose();
    }
  });
}
function Surface({
  url,
  color,
  opacity,
  brain = false,
}: {
  url: string;
  color: string;
  opacity: number;
  brain?: boolean;
}) {
  const [object, setObject] = useState<Object3D | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let loaded: Object3D | null = null;
    setObject(null);
    setError(null);
    fetch(url, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('Surface unavailable');
        return r.arrayBuffer();
      })
      .then((buffer) => new GLTFLoader().parseAsync(buffer, ''))
      .then((gltf) => {
        loaded = gltf.scene;
        if (controller.signal.aborted) {
          disposeObject(loaded);
          loaded = null;
          return;
        }
        loaded.traverse((child) => {
          if (child instanceof Mesh) {
            for (const material of Array.isArray(child.material)
              ? child.material
              : [child.material])
              material.dispose();
            child.geometry.computeVertexNormals();
            child.material = new MeshStandardMaterial({
              color: '#bccbd3',
              roughness: brain ? 0.72 : 0.42,
              metalness: 0.05,
              transparent: true,
              depthWrite: !brain,
              side: brain ? FrontSide : DoubleSide,
            });
            child.renderOrder = brain ? 2 : 1;
          }
        });
        setObject(loaded);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => {
      controller.abort();
      if (loaded) disposeObject(loaded);
    };
  }, [url, brain]);
  useEffect(() => {
    object?.traverse((child) => {
      if (child instanceof Mesh && child.material instanceof MeshStandardMaterial) {
        child.material.color.set(color);
        child.material.opacity = opacity;
        child.visible = opacity > 0;
      }
    });
  }, [object, opacity, color]);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => invalidate(), [object, opacity, color, invalidate]);
  if (error) throw new Error(error);
  return object ? <primitive object={object} dispose={null} /> : null;
}
function GeneratedSurface({
  volume,
  label,
  opacity,
}: {
  volume: Volume;
  label: number;
  opacity: number;
}) {
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let canceled = false,
      generated: BufferGeometry | null = null;
    runWorker<MeshData>({ kind: 'mesh', volume, label })
      .then((data) => {
        if (canceled) return;
        generated = new BufferGeometry();
        generated.setAttribute('position', new Float32BufferAttribute(data.positions, 3));
        generated.computeVertexNormals();
        setGeometry(generated);
      })
      .catch((error) => {
        if (!canceled) setError(error.message);
      });
    return () => {
      canceled = true;
      generated?.dispose();
    };
  }, [volume, label]);
  if (error) throw new Error(error);
  return geometry ? (
    <mesh geometry={geometry} visible={opacity > 0}>
      <meshStandardMaterial
        color={LABEL_COLORS[label]}
        transparent
        opacity={opacity}
        roughness={0.45}
        side={DoubleSide}
      />
    </mesh>
  ) : null;
}
function CameraLink({ id, radius }: { id: string; radius: number }) {
  const controls = useRef<OrbitControlsType>(null);
  const applying = useRef(false);
  const interacting = useRef(false);
  const { camera, invalidate, gl, size } = useThree();
  const aspect = size.width > 0 && size.height > 0 ? size.width / size.height : 1;
  const aspectRef = useRef(aspect);
  const cameraState = useWorkspace((s) => s.camera),
    resetVersion = useWorkspace((s) => s.resetVersion),
    synchronized = useWorkspace((s) => s.synchronized);
  const reset = useCallback(() => {
    applying.current = true;
    const fov = camera instanceof PerspectiveCamera ? (camera.fov * Math.PI) / 180 : 0.61;
    const fit =
      (radius / Math.sin(Math.atan(Math.tan(fov / 2) * Math.min(1, aspectRef.current)))) * 0.86;
    camera.position.copy(new Vector3(1.65, 0.55, 2.4).normalize().multiplyScalar(fit));
    controls.current?.target.set(0, 0, 0);
    controls.current?.update();
    invalidate();
    applying.current = false;
  }, [camera, invalidate, radius]);
  useEffect(() => reset(), [resetVersion, reset]);
  useEffect(() => {
    const previous = aspectRef.current;
    aspectRef.current = aspect;
    if (previous === aspect || !controls.current) return;
    applying.current = true;
    camera.position
      .sub(controls.current.target)
      .multiplyScalar(Math.min(1, previous) / Math.min(1, aspect))
      .add(controls.current.target);
    controls.current.update();
    invalidate();
    applying.current = false;
    if (id === 'gt' && useWorkspace.getState().synchronized)
      useWorkspace
        .getState()
        .publishCamera(
          camera.position.toArray() as Vec3,
          controls.current.target.toArray() as Vec3,
          id,
        );
  }, [aspect, camera, invalidate, id]);
  useEffect(() => {
    if (!synchronized || !cameraState || cameraState.source === id || !controls.current) return;
    if (cameraState !== useWorkspace.getState().camera) return;
    applying.current = true;
    camera.position.fromArray(cameraState.position);
    controls.current.target.fromArray(cameraState.target);
    controls.current.update();
    invalidate();
    applying.current = false;
  }, [cameraState, synchronized, id, camera, invalidate]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      onStart={() => {
        interacting.current = true;
      }}
      onEnd={() => {
        interacting.current = false;
      }}
      enableDamping={false}
      minDistance={radius * 0.4}
      maxDistance={radius * 6}
      zoomSpeed={0.65}
      rotateSpeed={0.65}
      onChange={() => {
        invalidate();
        gl.domElement.dataset.camera = JSON.stringify({
          position: camera.position.toArray(),
          target: controls.current?.target.toArray(),
        });
        if (
          interacting.current &&
          !applying.current &&
          controls.current &&
          useWorkspace.getState().synchronized
        )
          useWorkspace
            .getState()
            .publishCamera(
              camera.position.toArray() as Vec3,
              controls.current.target.toArray() as Vec3,
              id,
            );
      }}
    />
  );
}
function SlicePlane({ plane, mri, mask }: { plane: Plane; mri: Volume; mask: Volume }) {
  const state = useWorkspace();
  const [width, height] = sliceDimensions(plane, mri.shape);
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas
      .getContext('2d')!
      .putImageData(
        slicePixels(
          mri,
          mask,
          plane,
          state.crosshair,
          state.maskOpacity,
          state.tumorVisible,
          state.window,
          state.level,
        ),
        0,
        0,
      );
    return new CanvasTexture(canvas);
  }, [
    width,
    height,
    mri,
    mask,
    plane,
    state.crosshair,
    state.maskOpacity,
    state.tumorVisible,
    state.window,
    state.level,
  ]);
  useEffect(() => () => texture.dispose(), [texture]);
  const geometry = useMemo(() => {
    // Reuse the exact slice-to-voxel mapping: texture top-left = slice top-left.
    const corners = [
      [0, 0],
      [width - 1, 0],
      [width - 1, height - 1],
      [0, height - 1],
    ];
    const vertices = corners.flatMap(([u, v]) =>
      voxelToWorld(sliceVoxel(plane, u, v, state.crosshair, mri.shape), mri.affine),
    );
    const result = new BufferGeometry();
    result.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    result.setAttribute('uv', new Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
    result.setIndex([0, 1, 2, 0, 2, 3]);
    result.computeVertexNormals();
    return result;
  }, [width, height, plane, state.crosshair, mri]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} renderOrder={0}>
      <meshBasicMaterial map={texture} transparent opacity={0.75} side={DoubleSide} />
    </mesh>
  );
}
class ViewerBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? this.props.fallback : this.props.children;
  }
}
export function BrainViewer({
  record,
  mask,
  mri,
  meshUrls,
  kind,
}: {
  record: CaseRecord;
  mask: Volume;
  mri: Volume;
  meshUrls: Record<string, string>;
  kind: 'gt' | 'pred';
}) {
  const brainOpacity = useWorkspace((s) => s.brainOpacity),
    tumorOpacity = useWorkspace((s) => s.tumorOpacity),
    tumorVisible = useWorkspace((s) => s.tumorVisible),
    planesVisible = useWorkspace((s) => s.planesVisible);
  const center = useMemo(
    () => voxelToWorld(record.shape.map((n) => (n - 1) / 2) as Vec3, record.affine),
    [record],
  );
  const radius = useMemo(() => {
    const box = new Box3();
    box.expandByPoint(new Vector3(...voxelToWorld([0, 0, 0], record.affine)));
    box.expandByPoint(
      new Vector3(...voxelToWorld(record.shape.map((n) => n - 1) as Vec3, record.affine)),
    );
    return box.getSize(new Vector3()).length() * 0.28;
  }, [record]);
  const fallback = (
    <div className="viewer-fallback">
      3D rendering is unavailable.
      <span>Continue reviewing the MRI slices below.</span>
    </div>
  );
  return (
    <ViewerBoundary key={`${record.id}:${kind}`} fallback={fallback}>
      <Canvas
        data-testid={`canvas-${kind}`}
        frameloop="demand"
        dpr={[1, 1.75]}
        camera={{ fov: 35, near: 0.1, far: 3000 }}
        gl={{ antialias: true, alpha: true }}
        fallback={fallback}
      >
        <ambientLight intensity={1.05} />
        <directionalLight position={[200, 300, 250]} intensity={2.2} />
        <directionalLight position={[-200, 50, -150]} color="#d9e7f3" intensity={1.2} />
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <group position={center.map((n) => -n) as Vec3}>
            <Surface url={record.brainMeshUrl} color="#c6d7e4" opacity={brainOpacity} brain />
            {[1, 2, 4].map((label) =>
              meshUrls[label] ? (
                <Surface
                  key={label}
                  url={meshUrls[label]}
                  color={LABEL_COLORS[label]}
                  opacity={tumorVisible ? tumorOpacity * (label === 2 ? 0.45 : 1) : 0}
                />
              ) : kind === 'pred' && mask.data.includes(label) ? (
                <GeneratedSurface
                  key={label}
                  volume={mask}
                  label={label}
                  opacity={tumorVisible ? tumorOpacity * (label === 2 ? 0.45 : 1) : 0}
                />
              ) : null,
            )}
            {planesVisible &&
              (['axial', 'coronal', 'sagittal'] as Plane[]).map((plane) => (
                <SlicePlane key={plane} plane={plane} mri={mri} mask={mask} />
              ))}
          </group>
        </group>
        <CameraLink id={kind} radius={radius} />
        <GizmoHelper alignment="bottom-right" margin={[42, 42]}>
          <GizmoViewport
            axisColors={['#8c9bab', '#8c9bab', '#8c9bab']}
            labelColor="#e7eff5"
            labels={['R', 'S', 'P']}
            hideNegativeAxes
            scale={24}
          />
        </GizmoHelper>
      </Canvas>
    </ViewerBoundary>
  );
}
