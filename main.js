import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class LiberatorSimulator {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xffffff);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(2, 1, 3);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        document.body.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;

        this.initEnvironment();
        this.createPistol();
        this.initInteractions();

        window.addEventListener('resize', () => this.onWindowResize());
        this.animate();
    }

    initEnvironment() {
        // Use a simple procedural environment map to avoid external dependencies while ensuring realistic reflections
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();

        // Create a basic "studio" background for reflections
        const scene = new THREE.Scene();
        const geometry = new THREE.SphereGeometry(1, 32, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.BackSide });
        const sphere = new THREE.Mesh(geometry, material);
        scene.add(sphere);

        // Add some high-intensity lights to the "studio" to create sharp reflections
        const light1 = new THREE.DirectionalLight(0xffffff, 5);
        light1.position.set(5, 10, 2);
        scene.add(light1);
        
        const light2 = new THREE.DirectionalLight(0xffffff, 3);
        light2.position.set(-5, 5, -5);
        scene.add(light2);

        this.scene.environment = pmremGenerator.fromScene(scene).texture;

        // Traditional lights for visibility
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        this.scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffffff, 1);
        sunLight.position.set(5, 5, 5);
        this.scene.add(sunLight);
    }

    createPistol() {
        this.pistolGroup = new THREE.Group();
        this.scene.add(this.pistolGroup);

        // --- Materials ---
        const stampedSteelMat = new THREE.MeshStandardMaterial({ 
            color: 0x888899, // Cool grey
            metalness: 1.0, 
            roughness: 0.4,
            name: 'Frame'
        });

        const bluedSteelMat = new THREE.MeshStandardMaterial({ 
            color: 0x1a1a1a, // Near black
            metalness: 1.0, 
            roughness: 0.2,
            name: 'Barrel'
        });

        const zincMat = new THREE.MeshStandardMaterial({
            color: 0xbbbbbb,
            metalness: 0.6,
            roughness: 0.6,
            name: 'Zinc'
        });

        // --- Frame (Single Unit with Central Seam Line) ---
        const frameShape = new THREE.Shape();
        frameShape.moveTo(-0.75, 0.5);
        frameShape.lineTo(0.5, 0.5);
        frameShape.bezierCurveTo(0.75, 0.5, 0.75, 0.4, 0.75, 0.2);
        frameShape.lineTo(0.75, -0.15);
        frameShape.bezierCurveTo(0.75, -0.35, 0.55, -0.35, 0.35, -0.35);
        frameShape.lineTo(0.35, -0.45);
        frameShape.lineTo(0.15, -1.5);
        frameShape.bezierCurveTo(0.15, -1.6, -0.55, -1.6, -0.65, -1.5);
        frameShape.lineTo(-0.45, -0.45);
        frameShape.bezierCurveTo(-0.75, -0.25, -0.75, 0.25, -0.75, 0.5);

        const extrudeSettings = { depth: 0.4, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 5 };
        const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(frameShape, extrudeSettings), stampedSteelMat);
        frame.position.z = -0.2; // Center it
        this.pistolGroup.add(frame);

        // Seam Line Detail
        const seamGeo = new THREE.BoxGeometry(1.6, 2.2, 0.01);
        const seamMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.5, roughness: 1.0 });
        const seam = new THREE.Mesh(seamGeo, seamMat);
        seam.position.set(-0.1, -0.5, 0);
        frame.add(seam);

        // --- Barrel (Hollow) ---
        const barrelGroup = new THREE.Group();
        const outerBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.5, 32).rotateZ(Math.PI/2), bluedSteelMat);
        const innerBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 32).rotateZ(Math.PI/2), new THREE.MeshBasicMaterial({color: 0x000000}));
        innerBarrel.position.x = 0.71; // Slightly inside the tip
        barrelGroup.add(outerBarrel, innerBarrel);
        barrelGroup.position.set(0.65, 0.3, 0);
        this.pistolGroup.add(barrelGroup);

        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.4, 32).rotateZ(Math.PI/2), stampedSteelMat);
        collar.position.set(0.1, 0.3, 0);
        this.pistolGroup.add(collar);

        // --- Front Sight & Muzzle Plate (With Hole) ---
        const muzzlePlateShape = new THREE.Shape();
        muzzlePlateShape.moveTo(-0.15, 0.4);
        muzzlePlateShape.lineTo(0.15, 0.4);
        muzzlePlateShape.lineTo(0.15, -0.5);
        muzzlePlateShape.bezierCurveTo(0.15, -0.85, -0.8, -0.85, -1.0, -0.2);
        muzzlePlateShape.lineTo(-1.0, 0);
        muzzlePlateShape.lineTo(-0.85, 0);
        muzzlePlateShape.lineTo(-0.85, -0.2);
        muzzlePlateShape.bezierCurveTo(-0.85, -0.7, -0.05, -0.7, -0.05, -0.5);
        muzzlePlateShape.lineTo(-0.05, 0.4);

        // Create the hole for the barrel
        const holePath = new THREE.Path();
        holePath.absarc(0, 0, 0.21, 0, Math.PI * 2, true);
        muzzlePlateShape.holes.push(holePath);

        const muzzlePlate = new THREE.Mesh(new THREE.ExtrudeGeometry(muzzlePlateShape, {depth: 0.05, bevelEnabled: false}), stampedSteelMat);
        muzzlePlate.position.set(1.4, 0.3, 0.025);
        muzzlePlate.rotation.y = Math.PI / 2;
        this.pistolGroup.add(muzzlePlate);

        // --- Trigger Guard (Curved Tube) ---
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.35, -0.35, 0),
            new THREE.Vector3(0.8, -0.35, 0),
            new THREE.Vector3(1.3, -0.2, 0),
            new THREE.Vector3(1.4, 0.1, 0)
        ]);
        const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.03, 8, false);
        const triggerGuard = new THREE.Mesh(tubeGeo, stampedSteelMat);
        this.pistolGroup.add(triggerGuard);

        // --- Trigger ---
        const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.12), bluedSteelMat);
        trigger.position.set(0.28, -0.1, 0);
        trigger.rotation.z = 0.25;
        this.trigger = trigger;
        this.pistolGroup.add(trigger);

        // --- Breech Block ---
        const breechGeo = new THREE.BoxGeometry(0.06, 0.75, 0.55);
        this.breechBlock = new THREE.Mesh(breechGeo, stampedSteelMat);
        this.breechBlock.position.set(-0.75, 0.3, 0);
        this.pistolGroup.add(this.breechBlock);
        this.breechBlock.name = "breech";

        // --- Cocking Knob ---
        this.cockingGroup = new THREE.Group();
        const knobPoints = [];
        for (let i = 0; i < 12; i++) {
            knobPoints.push(new THREE.Vector2(Math.sin(i * 0.25) * 0.08 + 0.16, (i - 6) * 0.07));
        }
        const knobMain = new THREE.Mesh(new THREE.LatheGeometry(knobPoints, 24).rotateZ(Math.PI/2), zincMat);
        const knobShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.3, 16).rotateZ(Math.PI/2), zincMat);
        knobShaft.position.x = 0.45;
        this.cockingGroup.add(knobMain, knobShaft);
        this.cockingGroup.position.set(-1.15, 0.3, 0);
        this.pistolGroup.add(this.cockingGroup);

        // --- Muzzle Flash ---
        this.muzzleFlash = new THREE.Mesh(
            new THREE.SphereGeometry(0.45, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0 })
        );
        this.muzzleFlash.position.set(1.5, 0.3, 0);
        this.pistolGroup.add(this.muzzleFlash);

        this.isBreechOpen = false;
        this.isFiring = false;
    }

    initInteractions() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        window.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleRightClick(e);
        });

        document.getElementById('fire-btn').addEventListener('click', () => this.fire());
    }

    handleRightClick(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.pistolGroup.children, true);

        if (intersects.length > 0) {
            this.toggleBreech();
        }
    }

    toggleBreech() {
        if (this.isFiring) return;
        this.isBreechOpen = !this.isBreechOpen;
        this.targetBreechY = this.isBreechOpen ? 0.85 : 0.3;
    }

    fire() {
        if (this.isBreechOpen || this.isFiring) return;
        this.isFiring = true;

        let start = performance.now();
        const run = (now) => {
            const elapsed = (now - start) / 1000;
            
            if (elapsed < 0.22) {
                // Pulling back
                this.cockingGroup.position.x = -1.15 - (elapsed / 0.22) * 0.4;
                this.trigger.rotation.z = 0.25 + (elapsed / 0.22) * 0.45;
            } else if (elapsed < 0.26) {
                // Snap forward & Fire
                this.cockingGroup.position.x = -1.55 + ((elapsed - 0.22) / 0.04) * 0.4;
                this.muzzleFlash.material.opacity = 1;
                this.pistolGroup.position.x = -0.25; // Sharp Recoil
                this.trigger.rotation.z = 0.7 - ((elapsed - 0.22) / 0.04) * 0.45;
            } else if (elapsed < 0.45) {
                // Recovery
                this.muzzleFlash.material.opacity = 1 - ((elapsed - 0.26) / 0.19);
                this.pistolGroup.position.x = -0.25 + ((elapsed - 0.26) / 0.19) * 0.25;
            } else {
                this.muzzleFlash.material.opacity = 0;
                this.cockingGroup.position.x = -1.15;
                this.pistolGroup.position.x = 0;
                this.trigger.rotation.z = 0.25;
                this.isFiring = false;
                return;
            }
            requestAnimationFrame(run);
        };
        requestAnimationFrame(run);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();

        if (this.targetBreechY !== undefined) {
            this.breechBlock.position.y += (this.targetBreechY - this.breechBlock.position.y) * 0.25;
        }

        this.renderer.render(this.scene, this.camera);
    }
}

new LiberatorSimulator();
