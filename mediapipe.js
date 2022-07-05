"use strict";
const controls = window;
const mpFaceMesh = window;
const THREE = window.THREE;
const config = { locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@` +
            `${mpFaceMesh.VERSION}/${file}`;
    } };
// Our input frames will come from here.
const videoElement = document.getElementsByClassName('input_video')[0];
const canvasElement = document.getElementsByClassName('output_canvas')[0];
const controlsElement = document.getElementsByClassName('control-panel')[0];
/**
 * Solution options.
 */
const solutionOptions = {
    selfieMode: true,
    enableFaceGeometry: true,
    maxNumFaces: 1,
    refineLandmarks: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
};
// We'll add this to our control panel later, but we'll save it here so we can
// call tick() each time the graph runs.
const fpsControl = new controls.FPS();
// Optimization: Turn off animated spinner after its hiding animation is done.
const spinner = document.querySelector('.loading');
spinner.ontransitionend = () => {
    spinner.style.display = 'none';
};
class EffectRenderer {
    constructor() {
        this.VIDEO_DEPTH = 50;
        this.FOV_DEGREES = 63;
        this.NEAR = 1;
        this.FAR = 1000;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xa9a9a9);
        this.renderer = new THREE.WebGLRenderer({ canvas: canvasElement });
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
        hemiLight.position.set(0, 100, 0);
        this.scene.add(hemiLight);
        const dirLight = new THREE.DirectionalLight(0xffffff);
        dirLight.position.set(-30, 100, -5);
        dirLight.castShadow = true;
        this.scene.add(dirLight);
        this.faceGroup = new THREE.Group();
        this.faceGroup.matrixAutoUpdate = false;
        this.scene.add(this.faceGroup);
        const loader = new THREE.GLTFLoader();
        loader.setPath('./');
        loader.load('model.gltf', (gltf) => {
            const scene = gltf.scene;
             scene.scale.set(1, 1, 1);
            this.faceGroup.add(gltf.scene);
        });
    }
    render(results) {
        this.onCanvasDimsUpdate();
        const imagePlane = this.createGpuBufferPlane(results.image);
        this.scene.add(imagePlane);
        if (results.multiFaceGeometry.length > 0) {
            const faceGeometry = results.multiFaceGeometry[0];
            const poseTransformMatrixData = faceGeometry.getPoseTransformMatrix();
            this.faceGroup.matrix.fromArray(poseTransformMatrixData.getPackedDataList());
            this.faceGroup.visible = true;
        }
        else {
            this.faceGroup.visible = false;
        }
        this.renderer.render(this.scene, this.camera);
        this.scene.remove(imagePlane);
    }
    createGpuBufferPlane(gpuBuffer) {
        const depth = this.VIDEO_DEPTH;
        const fov = this.camera.fov;
        const width = canvasElement.width;
        const height = canvasElement.height;
        const aspect = width / height;
        const viewportHeightAtDepth = 2 * depth * Math.tan(THREE.MathUtils.degToRad(0.5 * fov));
        const viewportWidthAtDepth = viewportHeightAtDepth * aspect;
        const texture = new THREE.CanvasTexture(gpuBuffer);
        texture.minFilter = THREE.LinearFilter;
        texture.encoding = THREE.sRGBEncoding;
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: texture }));
        plane.scale.set(viewportWidthAtDepth, viewportHeightAtDepth, 1);
        plane.position.set(0, 0, -depth);
        return plane;
    }
    onCanvasDimsUpdate() {
        this.camera = new THREE.PerspectiveCamera(this.FOV_DEGREES, canvasElement.width / canvasElement.height, this.NEAR, this.FAR);
        this.renderer.setSize(canvasElement.width, canvasElement.height);
    }
}
;
const effectRenderer = new EffectRenderer();
function onResults(results) {
  console.log(results)
    // Hide the spinner.
    document.body.classList.add('loaded');
    // Render the effect.
    effectRenderer.render(results);
    // Update the frame rate.
    fpsControl.tick();
}
const faceMesh = new mpFaceMesh.FaceMesh(config);
faceMesh.setOptions(solutionOptions);
faceMesh.onResults(onResults);
// Present a control panel through which the user can manipulate the solution
// options.
new controls
    .ControlPanel(controlsElement, solutionOptions)
    .add([
    new controls.StaticText({ title: 'MediaPipe + Three.JS' }),
    fpsControl,
    new controls.Toggle({ title: 'Selfie Mode', field: 'selfieMode' }),
    new controls.Toggle({ title: 'Face Transform', field: 'enableFaceGeometry' }),
    new controls.SourcePicker({
        onFrame: async (input, size) => {
            const aspect = size.height / size.width;
            let width, height;
            if (window.innerWidth > window.innerHeight) {
                height = window.innerHeight;
                width = height / aspect;
            }
            else {
                width = window.innerWidth;
                height = width * aspect;
            }
            canvasElement.width = width;
            canvasElement.height = height;
            await faceMesh.send({ image: input });
        },
    }),
    new controls.Slider({
        title: 'Max Number of Faces',
        field: 'maxNumFaces',
        range: [1, 4],
        step: 1
    }),
    new controls.Toggle({ title: 'Refine Landmarks', field: 'refineLandmarks' }),
    new controls.Slider({
        title: 'Min Detection Confidence',
        field: 'minDetectionConfidence',
        range: [0, 1],
        step: 0.01
    }),
    new controls.Slider({
        title: 'Min Tracking Confidence',
        field: 'minTrackingConfidence',
        range: [0, 1],
        step: 0.01
    }),
])
    .on(x => {
    const options = x;
    videoElement.classList.toggle('selfie', options.selfieMode);
    faceMesh.setOptions(options);
});