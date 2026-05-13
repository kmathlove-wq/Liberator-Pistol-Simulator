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

        // Realistic Metal Material (Stamped Steel)
        const metalMat = new THREE.MeshStandardMaterial({ 
            color: 0x555555, 
            metalness: 0.9, 
            roughness: 0.5,
            flatShading: false
        });

        // Zinc Material for Cocking Knob
        const zincMat = new THREE.MeshStandardMaterial({
            color: 0xaaaaaa,
            metalness: 0.6,
            roughness: 0.6
        });

        // --- Frame (Main Body) ---
        // Stamped steel frame with slightly rounded corners
        const frameGeo = new THREE.BoxGeometry(1.4, 0.7, 0.45);
        const frame = new THREE.Mesh(frameGeo, metalMat);
        frame.position.set(-0.1, 0.05, 0);
        this.pistolGroup.add(frame);

        // --- Barrel ---
        // Simple tube with a collar at the back
        const barrelGeo = new THREE.CylinderGeometry(0.18, 0.18, 1.6, 32);
        barrelGeo.rotateZ(Math.PI / 2);
        const barrel = new THREE.Mesh(barrelGeo, metalMat);
        barrel.position.set(0.6, 0.18, 0);
        this.pistolGroup.add(barrel);

        // --- Grip ---
        // Hollow-looking stamped grip
        const gripGroup = new THREE.Group();
        const gripSideGeo = new THREE.BoxGeometry(0.55, 1.3, 0.05);
        
        const leftSide = new THREE.Mesh(gripSideGeo, metalMat);
        leftSide.position.set(0, 0, 0.2);
        
        const rightSide = new THREE.Mesh(gripSideGeo, metalMat);
        rightSide.position.set(0, 0, -0.2);
        
        const frontPlate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.3, 0.4), metalMat);
        frontPlate.position.set(0.25, 0, 0);

        gripGroup.add(leftSide, rightSide, frontPlate);
        gripGroup.position.set(-0.35, -0.85, 0);
        gripGroup.rotation.z = -0.15;
        this.pistolGroup.add(gripGroup);

        // Grip Floorplate (The sliding part)
        const floorGeo = new THREE.BoxGeometry(0.65, 0.05, 0.5);
        const floor = new THREE.Mesh(floorGeo, metalMat);
        floor.position.set(-0.55, -1.5, 0);
        this.pistolGroup.add(floor);

        // --- Trigger & Guard ---
        // Trigger Guard (Simplified wire-like strap)
        const guardPath = new THREE.CurvePath();
        // Just a simple box for the guard for now to keep it lightweight but looking right
        const guardGeo = new THREE.BoxGeometry(0.6, 0.05, 0.1);
        const guardBottom = new THREE.Mesh(guardGeo, metalMat);
        guardBottom.position.set(0.2, -0.4, 0);
        this.pistolGroup.add(guardBottom);

        const guardFrontGeo = new THREE.BoxGeometry(0.05, 0.35, 0.1);
        const guardFront = new THREE.Mesh(guardFrontGeo, metalMat);
        guardFront.position.set(0.5, -0.2, 0);
        this.pistolGroup.add(guardFront);

        // Trigger
        const triggerGeo = new THREE.BoxGeometry(0.1, 0.3, 0.1);
        this.trigger = new THREE.Mesh(triggerGeo, metalMat);
        this.trigger.position.set(0.1, -0.2, 0);
        this.trigger.rotation.z = 0.2;
        this.pistolGroup.add(this.trigger);

        // --- Breech Block ---
        // The vertical sliding plate
        const breechGeo = new THREE.BoxGeometry(0.06, 0.7, 0.55);
        this.breechBlock = new THREE.Mesh(breechGeo, metalMat);
        this.breechBlock.position.set(-0.7, 0.18, 0);
        this.pistolGroup.add(this.breechBlock);
        this.breechBlock.name = "breech";

        // Rear Sights (Notched into breech block)
        const sightGeo = new THREE.BoxGeometry(0.06, 0.1, 0.1);
        const sightL = new THREE.Mesh(sightGeo, metalMat);
        sightL.position.set(0, 0.35, 0.15);
        const sightR = new THREE.Mesh(sightGeo, metalMat);
        sightR.position.set(0, 0.35, -0.15);
        this.breechBlock.add(sightL, sightR);

        // --- Cocking Knob ---
        // Zinc die-cast knob with texture (simulated with geometry)
        this.cockingGroup = new THREE.Group();
        
        const knobMainGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.3, 16);
        knobMainGeo.rotateZ(Math.PI / 2);
        const knobMain = new THREE.Mesh(knobMainGeo, zincMat);
        
        const knobBackGeo = new THREE.SphereGeometry(0.22, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        knobBackGeo.rotateZ(-Math.PI / 2);
        const knobBack = new THREE.Mesh(knobBackGeo, zincMat);
        knobBack.position.set(-0.15, 0, 0);

        // Firing Pin Shaft
        const shaftGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.2, 16);
        shaftGeo.rotateZ(Math.PI / 2);
        const shaft = new THREE.Mesh(shaftGeo, metalMat);
        shaft.position.set(0.4, 0, 0);

        this.cockingGroup.add(knobMain, knobBack, shaft);
        this.cockingGroup.position.set(-1.0, 0.18, 0);
        this.pistolGroup.add(this.cockingGroup);

        // --- Details (Rivets/Welds) ---
        const rivetGeo = new THREE.SphereGeometry(0.03, 8, 8);
        const addRivet = (x, y, z) => {
            const r = new THREE.Mesh(rivetGeo, metalMat);
            r.position.set(x, y, z);
            this.pistolGroup.add(r);
        };
        addRivet(-0.1, 0.3, 0.23);
        addRivet(-0.1, -0.2, 0.23);
        addRivet(0.4, 0.3, 0.23);
        addRivet(-0.1, 0.3, -0.23);
        addRivet(-0.1, -0.2, -0.23);
        addRivet(0.4, 0.3, -0.23);

        // Muzzle Flash
        const flashGeo = new THREE.SphereGeometry(0.4, 12, 12);
        const flashMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0 });
        this.muzzleFlash = new THREE.Mesh(flashGeo, flashMat);
        this.muzzleFlash.position.set(1.4, 0.18, 0);
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
        const targetY = this.isBreechOpen ? 0.7 : 0.18;
        
        this.targetBreechY = targetY;
    }

    fire() {
        if (this.isBreechOpen || this.isFiring) return;
        this.isFiring = true;

        let start = performance.now();
        const run = (now) => {
            const elapsed = (now - start) / 1000;
            
            if (elapsed < 0.2) {
                // Pull back
                this.cockingGroup.position.x = -1.0 - (elapsed / 0.2) * 0.3;
                this.trigger.rotation.z = 0.2 + (elapsed / 0.2) * 0.3;
            } else if (elapsed < 0.25) {
                // Snap forward & Flash
                this.cockingGroup.position.x = -1.3 + ((elapsed - 0.2) / 0.05) * 0.3;
                this.muzzleFlash.material.opacity = 1;
                this.pistolGroup.position.x = -0.15; // Recoil
                this.trigger.rotation.z = 0.5 - ((elapsed - 0.2) / 0.05) * 0.3;
            } else if (elapsed < 0.4) {
                // Recovery
                this.muzzleFlash.material.opacity = 1 - ((elapsed - 0.25) / 0.15);
                this.pistolGroup.position.x = -0.15 + ((elapsed - 0.25) / 0.15) * 0.15;
            } else {
                this.muzzleFlash.material.opacity = 0;
                this.cockingGroup.position.x = -1.0;
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
