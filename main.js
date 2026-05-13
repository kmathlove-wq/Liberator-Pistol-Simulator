import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class LiberatorSimulator {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xffffff);

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(2.5, 1.2, 3.5);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        document.body.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 10;

        this.initEnvironment();
        this.createPistol();
        this.initInteractions();

        window.addEventListener('resize', () => this.onWindowResize());
        this.animate();
    }

    initEnvironment() {
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();

        const envScene = new THREE.Scene();
        // Extremely bright, uniform studio environment
        const addLightBox = (x, y, z, w, h, color = 0xffffff) => {
            const box = new THREE.Mesh(
                new THREE.PlaneGeometry(w, h),
                new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide })
            );
            box.position.set(x, y, z);
            box.lookAt(0, 0, 0);
            envScene.add(box);
        };

        addLightBox(10, 15, 10, 20, 20);
        addLightBox(-10, 10, -10, 20, 20);
        addLightBox(0, 20, 0, 20, 20);
        addLightBox(0, -10, 0, 20, 20);

        this.scene.environment = pmremGenerator.fromScene(envScene).texture;

        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); // Full ambient
        this.scene.add(ambientLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
        keyLight.position.set(5, 10, 7);
        this.scene.add(keyLight);
    }

    createPistol() {
        this.pistolGroup = new THREE.Group();
        this.scene.add(this.pistolGroup);

        // --- Materials (Bright Polished Steel) ---
        const metalMat = new THREE.MeshPhysicalMaterial({ 
            color: 0xeeeeee, // Very light grey/silver
            metalness: 1.0, 
            roughness: 0.15,
            clearcoat: 0.8,
            envMapIntensity: 2.5
        });

        // --- Frame ---
        const frameShape = new THREE.Shape();
        frameShape.moveTo(-0.8, 0.55);
        frameShape.lineTo(0.55, 0.55);
        frameShape.bezierCurveTo(0.8, 0.55, 0.8, 0.45, 0.8, 0.2);
        frameShape.lineTo(0.8, -0.15);
        frameShape.bezierCurveTo(0.8, -0.4, 0.6, -0.4, 0.4, -0.4);
        frameShape.lineTo(0.4, -0.5);
        frameShape.lineTo(0.2, -1.55);
        frameShape.bezierCurveTo(0.2, -1.7, -0.6, -1.7, -0.7, -1.55);
        frameShape.lineTo(-0.5, -0.5);
        frameShape.bezierCurveTo(-0.8, -0.3, -0.8, 0.25, -0.8, 0.55);

        const frame = new THREE.Mesh(
            new THREE.ExtrudeGeometry(frameShape, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 12 }),
            metalMat
        );
        frame.position.z = -0.225;
        this.pistolGroup.add(frame);

        // --- Barrel ---
        const barrelGroup = new THREE.Group();
        barrelGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.6, 64).rotateZ(Math.PI/2), metalMat));
        const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 32).rotateZ(Math.PI/2), new THREE.MeshBasicMaterial({ color: 0x000000 }));
        bore.position.x = 0.76;
        barrelGroup.add(bore);
        barrelGroup.position.set(0.7, 0.35, 0);
        this.pistolGroup.add(barrelGroup);

        this.pistolGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.4, 64).rotateZ(Math.PI/2), metalMat).position.set(0.1, 0.35, 0));

        // --- Front Sight Shroud (Foolproof primitive version) ---
        const shroudGroup = new THREE.Group();
        // Muzzle Ring
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 32).rotateX(Math.PI/2), metalMat);
        // Sight Post
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.1), metalMat);
        post.position.y = 0.35;
        // Connecting Plate (The "shroud")
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.3), metalMat);
        plate.position.y = -0.2;
        
        shroudGroup.add(ring, post, plate);
        shroudGroup.position.set(1.45, 0.35, 0);
        this.pistolGroup.add(shroudGroup);

        // --- Trigger Guard ---
        const guardCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.4, -0.4, 0),
            new THREE.Vector3(0.9, -0.4, 0),
            new THREE.Vector3(1.35, -0.2, 0),
            new THREE.Vector3(1.45, 0.1, 0)
        ]);
        this.pistolGroup.add(new THREE.Mesh(new THREE.TubeGeometry(guardCurve, 32, 0.035, 12, false), metalMat));

        // --- Trigger ---
        this.trigger = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.14), metalMat);
        this.trigger.position.set(0.32, -0.15, 0);
        this.trigger.rotation.z = 0.25;
        this.pistolGroup.add(this.trigger);

        // --- Breech & Cocking ---
        this.breechBlock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.75, 0.55), metalMat);
        this.breechBlock.position.set(-0.8, 0.35, 0);
        this.pistolGroup.add(this.breechBlock);
        this.breechBlock.name = "breech";

        this.cockingGroup = new THREE.Group();
        const knobPoints = [];
        for (let i = 0; i < 15; i++) { knobPoints.push(new THREE.Vector2(Math.sin(i * 0.22) * 0.07 + 0.17, (i - 7.5) * 0.06)); }
        this.cockingGroup.add(new THREE.Mesh(new THREE.LatheGeometry(knobPoints, 32).rotateZ(Math.PI/2), metalMat));
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.35, 24).rotateZ(Math.PI/2), metalMat);
        shaft.position.x = 0.45;
        this.cockingGroup.add(shaft);
        this.cockingGroup.position.set(-1.25, 0.35, 0);
        this.pistolGroup.add(this.cockingGroup);

        // --- Muzzle Flash ---
        this.muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 24), new THREE.MeshBasicMaterial({ color: 0xffdd00, transparent: true, opacity: 0 }));
        this.muzzleFlash.position.set(1.5, 0.35, 0);
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
        if (intersects.length > 0) this.toggleBreech();
    }

    toggleBreech() {
        if (this.isFiring) return;
        this.isBreechOpen = !this.isBreechOpen;
        this.targetBreechY = this.isBreechOpen ? 0.9 : 0.35;
    }

    fire() {
        if (this.isBreechOpen || this.isFiring) return;
        this.isFiring = true;
        let start = performance.now();
        const run = (now) => {
            const elapsed = (now - start) / 1000;
            if (elapsed < 0.22) {
                this.cockingGroup.position.x = -1.25 - (elapsed / 0.22) * 0.4;
                this.trigger.rotation.z = 0.25 + (elapsed / 0.22) * 0.45;
            } else if (elapsed < 0.26) {
                this.cockingGroup.position.x = -1.65 + ((elapsed - 0.22) / 0.04) * 0.4;
                this.muzzleFlash.material.opacity = 1;
                this.pistolGroup.position.x = -0.3;
                this.trigger.rotation.z = 0.7 - ((elapsed - 0.22) / 0.04) * 0.45;
            } else if (elapsed < 0.45) {
                this.muzzleFlash.material.opacity = 1 - ((elapsed - 0.26) / 0.19);
                this.pistolGroup.position.x = -0.3 + ((elapsed - 0.26) / 0.19) * 0.3;
            } else {
                this.muzzleFlash.material.opacity = 0;
                this.cockingGroup.position.x = -1.25;
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
            this.breechBlock.position.y += (this.targetBreechY - this.breechBlock.position.y) * 0.22;
        }
        this.renderer.render(this.scene, this.camera);
    }
}

new LiberatorSimulator();
