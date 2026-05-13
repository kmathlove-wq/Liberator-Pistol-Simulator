import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class LiberatorSimulator {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xffffff);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(2, 1, 3);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;

        this.initLights();
        this.createPistol();
        this.initInteractions();

        window.addEventListener('resize', () => this.onWindowResize());
        this.animate();
    }

    initLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        // Main Studio Lights
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
        keyLight.position.set(5, 10, 5);
        this.scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
        fillLight.position.set(-5, 5, 2);
        this.scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
        rimLight.position.set(0, 5, -10);
        this.scene.add(rimLight);

        // Environment for reflections
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        this.scene.environment = pmremGenerator.fromScene(new THREE.Scene()).texture;
    }

    createPistol() {
        this.pistolGroup = new THREE.Group();
        this.scene.add(this.pistolGroup);

        // --- Materials ---
        const frameMat = new THREE.MeshStandardMaterial({ 
            color: 0x999999, 
            metalness: 0.9, 
            roughness: 0.45,
            name: 'Frame'
        });

        const barrelMat = new THREE.MeshStandardMaterial({ 
            color: 0x222222, 
            metalness: 0.85, 
            roughness: 0.35,
            name: 'Barrel'
        });

        const zincMat = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            metalness: 0.7,
            roughness: 0.55,
            name: 'Zinc'
        });

        // --- Frame (Stamped Metal Shape) ---
        const frameShape = new THREE.Shape();
        // Start from top rear
        frameShape.moveTo(-0.7, 0.5);
        frameShape.lineTo(0.5, 0.5);
        // Barrel throat
        frameShape.bezierCurveTo(0.7, 0.5, 0.7, 0.4, 0.7, 0.2);
        // Trigger guard area
        frameShape.lineTo(0.7, -0.1);
        frameShape.bezierCurveTo(0.7, -0.3, 0.5, -0.3, 0.3, -0.3);
        // Grip front
        frameShape.lineTo(0.3, -0.4);
        frameShape.lineTo(0.1, -1.4);
        // Grip bottom
        frameShape.bezierCurveTo(0.1, -1.5, -0.5, -1.5, -0.6, -1.4);
        // Grip rear
        frameShape.lineTo(-0.4, -0.4);
        // Back hump
        frameShape.bezierCurveTo(-0.7, -0.2, -0.7, 0.2, -0.7, 0.5);

        const extrudeSettings = { depth: 0.15, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3 };
        
        // Two halves to create the seam
        const frameL = new THREE.Mesh(new THREE.ExtrudeGeometry(frameShape, extrudeSettings), frameMat);
        frameL.position.z = 0.02;
        const frameR = new THREE.Mesh(new THREE.ExtrudeGeometry(frameShape, extrudeSettings), frameMat);
        frameR.rotation.y = Math.PI;
        frameR.position.z = -0.02;

        this.pistolGroup.add(frameL, frameR);

        // --- Barrel ---
        const barrelGeo = new THREE.CylinderGeometry(0.19, 0.19, 1.4, 32);
        barrelGeo.rotateZ(Math.PI / 2);
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.position.set(0.6, 0.3, 0);
        this.pistolGroup.add(barrel);

        // Barrel collar (reinforcement)
        const collarGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.4, 32);
        collarGeo.rotateZ(Math.PI / 2);
        const collar = new THREE.Mesh(collarGeo, frameMat);
        collar.position.set(0.1, 0.3, 0);
        this.pistolGroup.add(collar);

        // --- Front Sight & Muzzle Plate ---
        const sightShape = new THREE.Shape();
        sightShape.moveTo(0, 0.2);
        sightShape.lineTo(0.05, 0.2);
        sightShape.lineTo(0.05, -0.5);
        sightShape.bezierCurveTo(0.05, -0.8, -0.8, -0.8, -1.0, -0.1);
        sightShape.lineTo(-1.0, 0.1);
        sightShape.lineTo(-0.95, 0.1);
        sightShape.lineTo(-0.95, -0.1);
        sightShape.bezierCurveTo(-0.95, -0.7, -0.05, -0.7, -0.05, -0.5);
        sightShape.lineTo(-0.05, 0.2);

        const sightExtrude = { depth: 0.3, bevelEnabled: false };
        const sight = new THREE.Mesh(new THREE.ExtrudeGeometry(sightShape, sightExtrude), frameMat);
        sight.position.set(1.4, 0.35, -0.15);
        this.pistolGroup.add(sight);

        // --- Trigger & Trigger Guard Strap ---
        const strapShape = new THREE.Shape();
        strapShape.moveTo(0.3, -0.3);
        strapShape.bezierCurveTo(1.0, -0.3, 1.4, -0.2, 1.4, 0.1);
        strapShape.lineTo(1.4, 0.2);
        
        const strapGeo = new THREE.BoxGeometry(0.04, 0.6, 0.15); // Simplified for now
        const triggerGuard = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.1), frameMat);
        triggerGuard.position.set(0.5, -0.3, 0);
        this.pistolGroup.add(triggerGuard);

        const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.1), barrelMat);
        trigger.position.set(0.25, -0.1, 0);
        trigger.rotation.z = 0.2;
        this.trigger = trigger;
        this.pistolGroup.add(trigger);

        // --- Breech Block ---
        const breechGeo = new THREE.BoxGeometry(0.06, 0.7, 0.5);
        this.breechBlock = new THREE.Mesh(breechGeo, frameMat);
        this.breechBlock.position.set(-0.7, 0.3, 0);
        this.pistolGroup.add(this.breechBlock);
        this.breechBlock.name = "breech";

        // --- Cocking Knob (Zinc Cast) ---
        this.cockingGroup = new THREE.Group();
        
        const knobPoints = [];
        for (let i = 0; i < 10; i++) {
            knobPoints.push(new THREE.Vector2(Math.sin(i * 0.2) * 0.1 + 0.15, (i - 5) * 0.08));
        }
        const knobMainGeo = new THREE.LatheGeometry(knobPoints, 16);
        knobMainGeo.rotateZ(Math.PI / 2);
        const knobMain = new THREE.Mesh(knobMainGeo, zincMat);
        
        const pinShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.2, 16).rotateZ(Math.PI/2), zincMat);
        pinShaft.position.x = 0.4;

        this.cockingGroup.add(knobMain, pinShaft);
        this.cockingGroup.position.set(-1.1, 0.3, 0);
        this.pistolGroup.add(this.cockingGroup);

        // --- Muzzle Flash ---
        this.muzzleFlash = new THREE.Mesh(
            new THREE.SphereGeometry(0.4, 16, 16),
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
        this.targetBreechY = this.isBreechOpen ? 0.8 : 0.3;
    }

    fire() {
        if (this.isBreechOpen || this.isFiring) return;
        this.isFiring = true;

        let start = performance.now();
        const run = (now) => {
            const elapsed = (now - start) / 1000;
            
            if (elapsed < 0.2) {
                this.cockingGroup.position.x = -1.1 - (elapsed / 0.2) * 0.35;
                this.trigger.rotation.z = 0.2 + (elapsed / 0.2) * 0.4;
            } else if (elapsed < 0.24) {
                this.cockingGroup.position.x = -1.45 + ((elapsed - 0.2) / 0.04) * 0.35;
                this.muzzleFlash.material.opacity = 1;
                this.pistolGroup.position.x = -0.2;
                this.trigger.rotation.z = 0.6 - ((elapsed - 0.2) / 0.04) * 0.4;
            } else if (elapsed < 0.4) {
                this.muzzleFlash.material.opacity = 1 - ((elapsed - 0.24) / 0.16);
                this.pistolGroup.position.x = -0.2 + ((elapsed - 0.24) / 0.16) * 0.2;
            } else {
                this.muzzleFlash.material.opacity = 0;
                this.cockingGroup.position.x = -1.1;
                this.pistolGroup.position.x = 0;
                this.trigger.rotation.z = 0.2;
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

        // Breech block animation
        if (this.targetBreechY !== undefined) {
            this.breechBlock.position.y += (this.targetBreechY - this.breechBlock.position.y) * 0.2;
        }

        this.renderer.render(this.scene, this.camera);
    }
}

new LiberatorSimulator();
