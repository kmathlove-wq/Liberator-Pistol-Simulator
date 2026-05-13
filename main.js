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
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(5, 5, 5);
        this.scene.add(dirLight);

        const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
        backLight.position.set(-5, 2, -5);
        this.scene.add(backLight);
    }

    createPistol() {
        this.pistolGroup = new THREE.Group();
        this.scene.add(this.pistolGroup);

        const metalMat = new THREE.MeshStandardMaterial({ 
            color: 0x888888, 
            metalness: 0.8, 
            roughness: 0.3 
        });

        // Frame
        const frameGeo = new THREE.BoxGeometry(1.2, 0.6, 0.4);
        const frame = new THREE.Mesh(frameGeo, metalMat);
        this.pistolGroup.add(frame);

        // Barrel
        const barrelGeo = new THREE.CylinderGeometry(0.18, 0.18, 1.5, 32);
        barrelGeo.rotateZ(Math.PI / 2);
        const barrel = new THREE.Mesh(barrelGeo, metalMat);
        barrel.position.set(0.6, 0.15, 0);
        this.pistolGroup.add(barrel);

        // Grip
        const gripGeo = new THREE.BoxGeometry(0.5, 1.2, 0.38);
        const grip = new THREE.Mesh(gripGeo, metalMat);
        grip.position.set(-0.3, -0.8, 0);
        grip.rotation.z = -0.2;
        this.pistolGroup.add(grip);

        // Breech Block
        const breechGeo = new THREE.BoxGeometry(0.05, 0.6, 0.5);
        this.breechBlock = new THREE.Mesh(breechGeo, metalMat);
        this.breechBlock.position.set(-0.62, 0.15, 0);
        this.pistolGroup.add(this.breechBlock);
        this.breechBlock.name = "breech";

        // Cocking Knob
        const knobGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.4, 16);
        knobGeo.rotateZ(Math.PI / 2);
        this.cockingKnob = new THREE.Mesh(knobGeo, metalMat);
        this.cockingKnob.position.set(-0.9, 0.15, 0);
        this.pistolGroup.add(this.cockingKnob);

        // Muzzle Flash (Hidden initially)
        const flashGeo = new THREE.SphereGeometry(0.3, 8, 8);
        const flashMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0 });
        this.muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
        this.muzzleFlash.position.set(1.4, 0.15, 0);
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
        const intersects = this.raycaster.intersectObjects(this.pistolGroup.children);

        if (intersects.length > 0) {
            // In the real Liberator, the whole back part moves.
            // For simplicity, we'll toggle the breech block up/down.
            this.toggleBreech();
        }
    }

    toggleBreech() {
        if (this.isFiring) return;
        this.isBreechOpen = !this.isBreechOpen;
        const targetY = this.isBreechOpen ? 0.6 : 0.15;
        
        // Simple animation using lerp in animate loop
        this.targetBreechY = targetY;
    }

    fire() {
        if (this.isBreechOpen || this.isFiring) return;
        this.isFiring = true;

        // Firing sequence: Knob pull back -> snap forward -> flash
        const timeline = [
            { t: 0, knobX: -0.9 },
            { t: 0.2, knobX: -1.2 }, // Pull back
            { t: 0.25, knobX: -0.9, flash: 1 }, // Snap forward & Flash
            { t: 0.4, flash: 0, done: true } // End
        ];

        let start = performance.now();
        const run = (now) => {
            const elapsed = (now - start) / 1000;
            
            if (elapsed < 0.2) {
                this.cockingKnob.position.x = -0.9 - (elapsed / 0.2) * 0.3;
            } else if (elapsed < 0.25) {
                this.cockingKnob.position.x = -1.2 + ((elapsed - 0.2) / 0.05) * 0.3;
                this.muzzleFlash.material.opacity = 1;
                this.pistolGroup.position.x = -0.1; // Recoil
            } else if (elapsed < 0.4) {
                this.muzzleFlash.material.opacity = 1 - ((elapsed - 0.25) / 0.15);
                this.pistolGroup.position.x = -0.1 + ((elapsed - 0.25) / 0.15) * 0.1;
            } else {
                this.muzzleFlash.material.opacity = 0;
                this.cockingKnob.position.x = -0.9;
                this.pistolGroup.position.x = 0;
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
