import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class LiberatorSimulator {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xd6dae0);

        this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(3.2, 1.0, 4.8);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        document.body.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.06;
        this.controls.target.set(0.4, -0.5, 0);
        this.controls.minDistance = 1.8;
        this.controls.maxDistance = 14;

        this.initEnvironment();
        this.createPistol();
        this.initInteractions();

        window.addEventListener('resize', () => this.onWindowResize());
        this.animate();
    }

    initEnvironment() {
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        pmrem.compileEquirectangularShader();
        const envScene = new THREE.Scene();
        const addPanel = (px, py, pz, w, h, col) => {
            const m = new THREE.Mesh(
                new THREE.PlaneGeometry(w, h),
                new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })
            );
            m.position.set(px, py, pz);
            m.lookAt(0, 0, 0);
            envScene.add(m);
        };
        addPanel( 15,  25,  15, 35, 35, 0xffffff);
        addPanel(-18,  12,   8, 28, 28, 0xd8e0ff);
        addPanel(  0, -18,   0, 28, 28, 0x707070);
        addPanel( -3,   5, -18, 28, 28, 0xfff0dc);
        addPanel(  0,  18, -10, 22, 22, 0xeeeeee);
        this.scene.environment = pmrem.fromScene(envScene).texture;

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.42));

        const key = new THREE.DirectionalLight(0xfff6e8, 1.75);
        key.position.set(5, 10, 6);
        key.castShadow = true;
        key.shadow.mapSize.set(2048, 2048);
        key.shadow.camera.near = 0.5;
        key.shadow.camera.far = 24;
        key.shadow.camera.left   = -4;
        key.shadow.camera.right  =  4;
        key.shadow.camera.top    =  4;
        key.shadow.camera.bottom = -4;
        this.scene.add(key);

        const fill = new THREE.DirectionalLight(0xdde5ff, 0.52);
        fill.position.set(-7, 4, 3);
        this.scene.add(fill);

        const rim = new THREE.DirectionalLight(0xffffff, 0.32);
        rim.position.set(-2, 2, -7);
        this.scene.add(rim);
    }

    _mat(col = 0xa8b0b8, rough = 0.44, metal = 0.62) {
        return new THREE.MeshPhysicalMaterial({
            color: col,
            metalness: metal,
            roughness: rough,
            envMapIntensity: 0.90,
        });
    }

    _s(mesh) { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }

    createPistol() {
        this.pistolGroup = new THREE.Group();
        this.scene.add(this.pistolGroup);

        const M    = this._mat(0xa8b0b8, 0.44, 0.60);
        const Mbar = this._mat(0xb0b8c0, 0.28, 0.72);
        const dark = new THREE.MeshBasicMaterial({ color: 0x0c0c0c });
        const S    = (m) => this._s(m);

        const FW = 2.10, FH = 0.84, FD = 0.52;
        const GW = 0.90, GH = 1.72, GD = 0.50;
        const BL = 1.78, BR = 0.128;
        const barrelY = 0.16;

        const frameFront = FW / 2;    //  1.05
        const frameRear  = -FW / 2;  // -1.05
        const muzzleX    = frameFront + BL;

        const gripCX = frameRear + GW / 2 + 0.10;
        const gripCY = -(FH / 2 + GH / 2);

        // ═══ MAIN FRAME HOUSING ══════════════════════════════════════
        const frameMesh = S(new THREE.Mesh(new THREE.BoxGeometry(FW, FH, FD), M));
        this.pistolGroup.add(frameMesh);

        const topFrontBevel = S(new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 0.10, FD + 0.02), M
        ));
        topFrontBevel.position.set(frameFront - 0.09, FH / 2 - 0.05, 0);
        this.pistolGroup.add(topFrontBevel);

        const barrelChannel = S(new THREE.Mesh(
            new THREE.BoxGeometry(FW * 0.62, 0.11, FD * 0.58), M
        ));
        barrelChannel.position.set(FW * 0.06, FH / 2 + 0.055, 0);
        this.pistolGroup.add(barrelChannel);

        // ═══ GRIP ════════════════════════════════════════════════════
        const gripMesh = S(new THREE.Mesh(new THREE.BoxGeometry(GW, GH, GD), M));
        gripMesh.position.set(gripCX, gripCY, 0);
        this.pistolGroup.add(gripMesh);

        const basePlate = S(new THREE.Mesh(new THREE.BoxGeometry(GW + 0.06, 0.07, GD + 0.05), M));
        basePlate.position.set(gripCX, gripCY - GH / 2 - 0.035, 0);
        this.pistolGroup.add(basePlate);

        for (const z of [GD / 2 + 0.002, -(GD / 2 + 0.002)]) {
            const seam = new THREE.Mesh(
                new THREE.BoxGeometry(GW - 0.12, 0.014, 0.004),
                this._mat(0x909098, 0.55, 0.50)
            );
            seam.position.set(gripCX, gripCY + 0.32, z);
            this.pistolGroup.add(seam);
        }

        // ═══ BARREL (fixed) ══════════════════════════════════════════
        const barrelMesh = S(new THREE.Mesh(new THREE.CylinderGeometry(BR, BR, BL, 32), Mbar));
        barrelMesh.rotation.z = Math.PI / 2;
        barrelMesh.position.set(frameFront + BL / 2, barrelY, 0);
        this.pistolGroup.add(barrelMesh);

        const exitRing = S(new THREE.Mesh(new THREE.CylinderGeometry(BR + 0.045, BR + 0.045, 0.10, 24), M));
        exitRing.rotation.z = Math.PI / 2;
        exitRing.position.set(frameFront + 0.05, barrelY, 0);
        this.pistolGroup.add(exitRing);

        const bore = new THREE.Mesh(new THREE.CircleGeometry(BR * 0.70, 28), dark);
        bore.rotation.y = Math.PI / 2;
        bore.position.set(muzzleX + 0.001, barrelY, 0);
        this.pistolGroup.add(bore);

        const fSight = S(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.055), M));
        fSight.position.set(muzzleX - 0.28, barrelY + BR + 0.067, 0);
        this.pistolGroup.add(fSight);

        // ═══ BREECH BLOCK (pivots at frameRear, rotates -90° on Y-axis) ══
        // Real FP-45: cocking knob twisted sideways → breech plate lifts to expose chamber.
        // Simulation: rear block rotates toward viewer, revealing the loading hole
        // on its inner face (which faces the viewer when open).
        this.breechBlock = new THREE.Group();
        this.breechBlock.name = "breech";

        const breechW = 0.76;

        const breechBox = S(new THREE.Mesh(
            new THREE.BoxGeometry(breechW, FH, FD + 0.012), M
        ));
        breechBox.position.x = breechW / 2;
        this.breechBlock.add(breechBox);

        const breechCap = S(new THREE.Mesh(
            new THREE.BoxGeometry(breechW - 0.06, 0.055, FD + 0.014), M
        ));
        breechCap.position.set(breechW / 2, FH / 2 + 0.0275, 0);
        this.breechBlock.add(breechCap);

        // Rear sight U-notch posts
        const postH = 0.15, postW = 0.11, sightGap = 0.22;
        for (const zOff of [-sightGap / 2, sightGap / 2]) {
            const post = S(new THREE.Mesh(new THREE.BoxGeometry(0.10, postH, postW), M));
            post.position.set(0.11, FH / 2 + postH / 2, zOff);
            this.breechBlock.add(post);
        }
        const rSightNotch = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.09, sightGap - postW - 0.02),
            this._mat(0x585c60, 0.85, 0.22)
        );
        rSightNotch.position.set(0.11, FH / 2 + 0.045, 0);
        this.breechBlock.add(rSightNotch);

        for (const zOff of [-(FD / 2 + 0.007), FD / 2 + 0.007]) {
            const boltGeo = new THREE.CylinderGeometry(0.030, 0.030, 0.038, 8);
            boltGeo.rotateX(Math.PI / 2);
            const bolt = new THREE.Mesh(boltGeo, this._mat(0x909498, 0.35, 0.68));
            bolt.position.set(0.14, FH / 2 - 0.15, zOff);
            this.breechBlock.add(bolt);
        }

        // ── LOADING HOLE on the inner face (front face = local +X direction) ──
        // When breechBlock.rotation.y = 0 (closed): this face points world +X,
        //   hidden inside the gun body.
        // When breechBlock.rotation.y = -π/2 (open): local +X → world +Z,
        //   the face now points toward the viewer — loading hole is clearly visible.
        const chamberR = 0.175;

        // Dark chamber hole
        const chamberFace = new THREE.Mesh(
            new THREE.CircleGeometry(chamberR, 32),
            new THREE.MeshBasicMaterial({ color: 0x010101 })
        );
        chamberFace.rotation.y = Math.PI / 2;    // face local +X
        chamberFace.position.set(breechW + 0.001, barrelY, 0);
        this.breechBlock.add(chamberFace);

        // Brass cartridge rim seat ring
        const chamberBrass = new THREE.Mesh(
            new THREE.RingGeometry(chamberR, chamberR + 0.055, 32),
            new THREE.MeshPhysicalMaterial({ color: 0x9a7030, metalness: 0.92, roughness: 0.18 })
        );
        chamberBrass.rotation.y = Math.PI / 2;
        chamberBrass.position.set(breechW + 0.002, barrelY, 0);
        this.breechBlock.add(chamberBrass);

        // Steel chamfer ring around loading hole
        const chamberRimTorus = S(new THREE.Mesh(
            new THREE.TorusGeometry(chamberR + 0.045, 0.016, 8, 32), M
        ));
        chamberRimTorus.rotation.y = Math.PI / 2;
        chamberRimTorus.position.set(breechW + 0.003, barrelY, 0);
        this.breechBlock.add(chamberRimTorus);

        // Depth tube — hollow cylinder extending into the breech block
        // Gives the impression of a real bore/chamber depth
        const depthGeo = new THREE.CylinderGeometry(chamberR, chamberR, 0.38, 24, 1, true);
        depthGeo.rotateZ(Math.PI / 2);
        const depthTube = new THREE.Mesh(
            depthGeo,
            new THREE.MeshBasicMaterial({ color: 0x080808, side: THREE.BackSide })
        );
        // Center of depth tube: starts at front face, goes 0.38/2=0.19 into block
        depthTube.position.set(breechW - 0.19, barrelY, 0);
        this.breechBlock.add(depthTube);

        this.breechBlock.position.set(frameRear, 0, 0);
        this.pistolGroup.add(this.breechBlock);

        this.isBreechOpen = false;
        this._breechClosedRot = 0;
        this._breechOpenRot   = -Math.PI / 2;   // swings toward viewer (+Z world)
        this._targetBreechRot = 0;

        // ── Dark interior visible in frame when breech is open ────────
        const chamberHoleGeo = new THREE.CylinderGeometry(BR + 0.008, BR + 0.008, 0.14, 16);
        chamberHoleGeo.rotateZ(Math.PI / 2);
        const chamberHole = new THREE.Mesh(
            chamberHoleGeo,
            new THREE.MeshBasicMaterial({ color: 0x050505 })
        );
        chamberHole.position.set(frameRear + breechW - 0.07, barrelY, 0);
        this.pistolGroup.add(chamberHole);

        // ═══ COCKING PIECE — child of breechBlock, rotates with it ════
        this.cockingGroup = new THREE.Group();

        const armLen = 0.58, armH = 0.21, armD = 0.13;

        const cockArm = S(new THREE.Mesh(new THREE.BoxGeometry(armLen, armH, armD), M));
        cockArm.position.x = -armLen / 2 + 0.05;
        this.cockingGroup.add(cockArm);

        const knobW = 0.22, knobH = 0.30, knobD = 0.20;
        const cockKnob = S(new THREE.Mesh(new THREE.BoxGeometry(knobW, knobH, knobD), M));
        cockKnob.position.x = -armLen + 0.05;
        this.cockingGroup.add(cockKnob);

        const serMat = this._mat(0x6c7074, 0.72, 0.40);
        for (let i = -2; i <= 2; i++) {
            const groove = new THREE.Mesh(
                new THREE.BoxGeometry(0.008, knobH - 0.04, 0.003), serMat
            );
            groove.position.set(-armLen + 0.05 + i * 0.038, 0, knobD / 2 + 0.002);
            this.cockingGroup.add(groove);
        }

        const railShadow = new THREE.Mesh(
            new THREE.BoxGeometry(armLen + 0.04, armH - 0.05, 0.006),
            this._mat(0x7c8084, 0.60, 0.42)
        );
        railShadow.position.set(0.05 - armLen / 2, 0, -armD / 2 - 0.001);
        this.cockingGroup.add(railShadow);

        const localCockX = breechW / 2;
        const localCockZ = (FD + 0.012) / 2 + armD / 2 + 0.004;
        this.cockingGroup.position.set(localCockX, barrelY + 0.04, localCockZ);
        this.breechBlock.add(this.cockingGroup);   // rotates with breech block

        this._cockingRestX = localCockX;
        this._cockingPullX = localCockX - 0.44;

        // ═══ TRIGGER GUARD ════════════════════════════════════════════
        const tgStartX  = gripCX + GW / 2 + 0.02;
        const tgStartY  = -(FH / 2);
        const tgEndX    = frameFront - 0.02;
        const tgEndY    = barrelY - 0.08;
        const tgBottomY = tgStartY - 0.44;

        const tgCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(tgStartX,          tgStartY,          0),
            new THREE.Vector3(tgStartX + 0.12,   tgBottomY + 0.04,  0),
            new THREE.Vector3(tgStartX + 0.48,   tgBottomY,         0),
            new THREE.Vector3(tgStartX + 0.82,   tgBottomY + 0.04,  0),
            new THREE.Vector3(tgEndX   - 0.14,   tgEndY - 0.06,     0),
            new THREE.Vector3(tgEndX,            tgEndY,             0),
        ]);

        const tgTube = new THREE.Mesh(
            new THREE.TubeGeometry(tgCurve, 52, 0.040, 10, false), M
        );
        this.pistolGroup.add(tgTube);

        // ═══ TRIGGER ═════════════════════════════════════════════════
        this.trigger = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.35, 0.11), M);
        this.trigger.position.set(tgStartX + 0.06, tgStartY - 0.06, 0);
        this.trigger.rotation.z = 0.22;
        this.pistolGroup.add(this.trigger);

        // ═══ FRAME SURFACE DETAILS ════════════════════════════════════
        for (const zSide of [-1, 1]) {
            const zPos = (FD / 2 + 0.003) * zSide;
            const faceDir = zSide > 0 ? Math.PI / 2 : -Math.PI / 2;
            for (let i = 0; i < 2; i++) {
                const hx = frameRear + 0.38 + i * 0.46;
                const hy = barrelY - 0.12;

                const ring = new THREE.Mesh(
                    new THREE.TorusGeometry(0.087, 0.013, 8, 22), M
                );
                ring.rotation.y = Math.PI / 2;
                ring.position.set(hx, hy, zPos);
                this.pistolGroup.add(ring);

                const face = new THREE.Mesh(new THREE.CircleGeometry(0.074, 24), dark);
                face.rotation.y = faceDir;
                face.position.set(hx, hy, zPos * 1.015);
                this.pistolGroup.add(face);
            }

            const screwPositions = [
                [frameRear  + 0.30,  0.24],
                [frameFront - 0.30,  0.24],
                [frameRear  + 0.30, -0.24],
                [frameFront - 0.30, -0.24],
            ];
            for (const [sx, sy] of screwPositions) {
                const screw = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.040, 0.040, 0.045, 8),
                    this._mat(0x90989e, 0.36, 0.68)
                );
                screw.rotation.z = Math.PI / 2;
                screw.position.set(sx, sy, (FD / 2 + 0.018) * zSide);
                this.pistolGroup.add(screw);
            }

            for (const [sx, sy] of screwPositions) {
                const slot = new THREE.Mesh(
                    new THREE.BoxGeometry(0.002, 0.058, 0.008),
                    this._mat(0x606060, 0.8, 0.2)
                );
                slot.position.set(sx, sy, (FD / 2 + 0.030) * zSide);
                this.pistolGroup.add(slot);
            }
        }

        for (const zSide of [-1, 1]) {
            const ridge = S(new THREE.Mesh(
                new THREE.BoxGeometry(FW * 0.65, 0.06, 0.018), M
            ));
            ridge.position.set(FW * 0.05, FH / 2 - 0.03, (FD / 2 + 0.009) * zSide);
            this.pistolGroup.add(ridge);
        }

        // ═══ MUZZLE FLASH ════════════════════════════════════════════
        this.muzzleFlash = new THREE.Mesh(
            new THREE.SphereGeometry(0.35, 14, 14),
            new THREE.MeshBasicMaterial({ color: 0xffcc22, transparent: true, opacity: 0 })
        );
        this.muzzleFlash.position.set(muzzleX + 0.08, barrelY, 0);
        this.pistolGroup.add(this.muzzleFlash);

        this.muzzleCore = new THREE.Mesh(
            new THREE.SphereGeometry(0.16, 10, 10),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
        );
        this.muzzleCore.position.set(muzzleX + 0.02, barrelY, 0);
        this.pistolGroup.add(this.muzzleCore);

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
        this.mouse.x =  (event.clientX / window.innerWidth)  * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.raycaster.intersectObjects(this.pistolGroup.children, true);
        if (hits.length > 0) this.toggleBreech();
    }

    toggleBreech() {
        if (this.isFiring) return;
        this.isBreechOpen = !this.isBreechOpen;
        this._targetBreechRot = this.isBreechOpen ? this._breechOpenRot : this._breechClosedRot;
    }

    fire() {
        if (this.isBreechOpen || this.isFiring) return;
        this.isFiring = true;
        const t0 = performance.now();
        const restX = this._cockingRestX;
        const pullX = this._cockingPullX;

        const run = (now) => {
            const t = (now - t0) / 1000;

            if (t < 0.20) {
                const p = t / 0.20;
                this.cockingGroup.position.x = restX + (pullX - restX) * p;
                this.trigger.rotation.z = 0.22 + p * 0.48;

            } else if (t < 0.26) {
                const p = (t - 0.20) / 0.06;
                this.cockingGroup.position.x = pullX + (restX - pullX) * p;
                this.muzzleFlash.material.opacity = 1 - p * 0.3;
                this.muzzleCore.material.opacity = 1;
                this.pistolGroup.position.x = -0.30 * (1 - p);
                this.trigger.rotation.z = 0.22 + (1 - p) * 0.48;

            } else if (t < 0.48) {
                const p = (t - 0.26) / 0.22;
                this.muzzleFlash.material.opacity = Math.max(0, 0.7 - p);
                this.muzzleCore.material.opacity = Math.max(0, 1 - p * 3.5);
                this.pistolGroup.position.x = -0.30 * Math.max(0, 1 - p * 3);

            } else {
                this.muzzleFlash.material.opacity = 0;
                this.muzzleCore.material.opacity = 0;
                this.pistolGroup.position.x = 0;
                this.cockingGroup.position.x = restX;
                this.trigger.rotation.z = 0.22;
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

        // Smooth breech rotation on Y-axis
        // Closed: rotation.y = 0 (loading hole faces barrel, hidden inside frame)
        // Open:   rotation.y = -π/2 → local +X becomes world +Z → hole faces viewer ✓
        if (this._targetBreechRot !== undefined) {
            const cur = this.breechBlock.rotation.y;
            const tgt = this._targetBreechRot;
            if (Math.abs(tgt - cur) > 0.0005) {
                this.breechBlock.rotation.y += (tgt - cur) * 0.14;
            } else {
                this.breechBlock.rotation.y = tgt;
            }
        }

        this.renderer.render(this.scene, this.camera);
    }
}

new LiberatorSimulator();
