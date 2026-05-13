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

        // --- Materials (Bright Silver Steel) ---
        const metalMat = new THREE.MeshPhysicalMaterial({ 
            color: 0xcccccc, // Lighter silver base
            metalness: 0.6,  // More diffuse for better visibility
            roughness: 0.2,
            clearcoat: 0.3,
            envMapIntensity: 1.2
        });

        // --- Frame (Updated with rear shoulder for image copy 4.png look) ---
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
        frameShape.bezierCurveTo(-0.8, -0.3, -1.0, 0.0, -1.0, 0.35); // Added shoulder curve
        frameShape.lineTo(-1.0, 0.55);
        frameShape.lineTo(-0.8, 0.55);

        const frame = new THREE.Mesh(
            new THREE.ExtrudeGeometry(frameShape, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 12 }),
            metalMat
        );
        frame.position.z = -0.225;
        this.pistolGroup.add(frame);

        // --- Barrel ---
        const barrelGroup = new THREE.Group();
        barrelGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.6, 64).rotateZ(Math.PI/2), metalMat));
        const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 32).rotateZ(Math.PI/2), new THREE.MeshBasicMaterial({ color: 0x111111 }));
        bore.position.x = 0.76;
        barrelGroup.add(bore);
        barrelGroup.position.set(0.7, 0.35, 0);
        this.pistolGroup.add(barrelGroup);

        this.pistolGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.4, 64).rotateZ(Math.PI/2), metalMat).position.set(0.1, 0.35, 0));

        // --- Front Sight Shroud (Cleaned up version) ---
        const shroudGroup = new THREE.Group();
        // Sight Post (Small and subtle)
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.15, 0.08), metalMat);
        post.position.y = 0.25;
        // Muzzle Shroud (More integrated)
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.2), metalMat);
        plate.position.y = -0.1;
        
        shroudGroup.add(post, plate);
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

        // --- Breech & Cocking (Refined for image copy 4.png) ---
        const breechGroup = new THREE.Group();
        // Main blocky part of the breech (integrated look)
        const breechMain = new THREE.Mesh(
            new THREE.BoxGeometry(0.4, 0.4, 0.4), 
            metalMat
        );
        // Rounded rear cap (Smooth transition)
        const breechCap = new THREE.Mesh(
            new THREE.SphereGeometry(0.2, 32, 32),
            metalMat
        );
        breechCap.scale.set(0.8, 1, 1);
        breechCap.position.x = -0.2;
        
        // Top Detail (Rear Sight Integration)
        const breechTop = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.3), metalMat);
        breechTop.position.y = 0.25;

        breechGroup.add(breechMain, breechCap, breechTop);
        breechGroup.position.set(-0.8, 0.4, 0);
        this.pistolGroup.add(breechGroup);
        this.breechBlock = breechGroup;
        this.breechBlock.name = "breech";

        this.cockingGroup = new THREE.Group();
        // Thicker pull handle (Based on image copy 4.png)
        const handleStem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 16).rotateZ(Math.PI/2), metalMat);
        const handleTop = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.4, 16).rotateX(Math.PI/2), metalMat);
        handleTop.position.x = -0.3;
        
        this.cockingGroup.add(handleStem, handleTop);
        this.cockingGroup.position.set(-1.3, 0.4, 0);
        this.pistolGroup.add(this.cockingGroup);

        // Rear Sight (Small notch on the frame/breech area)
        const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.25), metalMat);
        rearSight.position.set(-0.6, 0.6, 0);
        this.pistolGroup.add(rearSight);

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
