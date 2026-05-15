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
        // Studio PMREM environment for accurate metal reflections
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
        addPanel( 15,  25,  15, 35, 35, 0xffffff);   // key panel
        addPanel(-18,  12,   8, 28, 28, 0xd8e0ff);   // cool fill
        addPanel(  0, -18,   0, 28, 28, 0x707070);   // floor bounce
        addPanel( -3,   5, -18, 28, 28, 0xfff0dc);   // warm rim
        addPanel(  0,  18, -10, 22, 22, 0xeeeeee);   // top back
        this.scene.environment = pmrem.fromScene(envScene).texture;

        // Three-point lighting with shadows
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

    // ── Material helpers ─────────────────────────────────────────────────────
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

        const M    = this._mat(0xa8b0b8, 0.44, 0.60);   // main frame steel
        const Mbar = this._mat(0xb0b8c0, 0.28, 0.72);   // barrel (slightly shinier)
        const dark = new THREE.MeshBasicMaterial({ color: 0x0c0c0c });
        const S    = (m) => this._s(m);

        // ═══ PROPORTIONS (1 unit ≈ 1 inch, matching real FP-45) ═══
        //   Real gun: 5.55" long × 4.5" tall × 1.0" wide
        const FW = 2.10, FH = 0.84, FD = 0.52;   // Frame housing
        const GW = 0.90, GH = 1.72, GD = 0.50;   // Grip
        const BL = 1.78, BR = 0.128;              // Barrel extra length / radius
        const barrelY = 0.16;                      // barrel axis above frame centre

        const frameFront = FW / 2;                 //  1.05
        const frameRear  = -FW / 2;               // -1.05
        const muzzleX    = frameFront + BL;        //  2.83

        // Grip hangs below, offset to rear
        const gripCX = frameRear + GW / 2 + 0.10; // -0.50
        const gripCY = -(FH / 2 + GH / 2);        // -1.28

        // ═══ MAIN FRAME HOUSING ══════════════════════════════════════
        // Flat stamped-zinc rectangular box – the signature Liberator look
        const frameMesh = S(new THREE.Mesh(new THREE.BoxGeometry(FW, FH, FD), M));
        this.pistolGroup.add(frameMesh);

        // Slightly chamfered top-front edge (visual depth)
        const topFrontBevel = S(new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 0.10, FD + 0.02), M
        ));
        topFrontBevel.position.set(frameFront - 0.09, FH / 2 - 0.05, 0);
        this.pistolGroup.add(topFrontBevel);

        // Raised channel on top of frame where barrel sits inside
        const barrelChannel = S(new THREE.Mesh(
            new THREE.BoxGeometry(FW * 0.62, 0.11, FD * 0.58), M
        ));
        barrelChannel.position.set(FW * 0.06, FH / 2 + 0.055, 0);
        this.pistolGroup.add(barrelChannel);

        // ═══ GRIP ════════════════════════════════════════════════════
        const gripMesh = S(new THREE.Mesh(new THREE.BoxGeometry(GW, GH, GD), M));
        gripMesh.position.set(gripCX, gripCY, 0);
        this.pistolGroup.add(gripMesh);

        // Base plate (slightly wider, flat bottom)
        const basePlate = S(new THREE.Mesh(new THREE.BoxGeometry(GW + 0.06, 0.07, GD + 0.05), M));
        basePlate.position.set(gripCX, gripCY - GH / 2 - 0.035, 0);
        this.pistolGroup.add(basePlate);

        // Grip panel horizontal seam line (both faces)
        for (const z of [GD / 2 + 0.002, -(GD / 2 + 0.002)]) {
            const seam = new THREE.Mesh(
                new THREE.BoxGeometry(GW - 0.12, 0.014, 0.004),
                this._mat(0x909098, 0.55, 0.50)
            );
            seam.position.set(gripCX, gripCY + 0.32, z);
            this.pistolGroup.add(seam);
        }

        // ═══ BARREL ══════════════════════════════════════════════════
        const barrelMesh = S(new THREE.Mesh(new THREE.CylinderGeometry(BR, BR, BL, 32), Mbar));
        barrelMesh.rotation.z = Math.PI / 2;
        barrelMesh.position.set(frameFront + BL / 2, barrelY, 0);
        this.pistolGroup.add(barrelMesh);

        // Barrel exit ring (junction between frame and barrel)
        const exitRing = S(new THREE.Mesh(new THREE.CylinderGeometry(BR + 0.045, BR + 0.045, 0.10, 24), M));
        exitRing.rotation.z = Math.PI / 2;
        exitRing.position.set(frameFront + 0.05, barrelY, 0);
        this.pistolGroup.add(exitRing);

        // Muzzle bore (dark circle at muzzle face)
        const bore = new THREE.Mesh(new THREE.CircleGeometry(BR * 0.70, 28), dark);
        bore.rotation.y = Math.PI / 2;
        bore.position.set(muzzleX + 0.001, barrelY, 0);
        this.pistolGroup.add(bore);

        // ═══ FRONT SIGHT ═════════════════════════════════════════════
        // Small blade on top of barrel, near muzzle
        const fSight = S(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.055), M));
        fSight.position.set(muzzleX - 0.28, barrelY + BR + 0.067, 0);
        this.pistolGroup.add(fSight);

        // ═══ BREECH BLOCK (rear section, full frame height, slides up) ════
        this.breechBlock = new THREE.Group();
        this.breechBlock.name = "breech";

        const breechW = 0.76;

        // Main body — same height/depth as frame, covers rear portion
        // Slightly wider in Z (+0.012) so it fully covers the frame rear face, no z-fighting
        const breechBox = S(new THREE.Mesh(
            new THREE.BoxGeometry(breechW, FH, FD + 0.012), M
        ));
        this.breechBlock.add(breechBox);

        // Subtle top-edge cap (visual chamfer)
        const breechCap = S(new THREE.Mesh(
            new THREE.BoxGeometry(breechW - 0.06, 0.055, FD + 0.014), M
        ));
        breechCap.position.y = FH / 2 + 0.0275;
        this.breechBlock.add(breechCap);

        // Rear sight — U-notch: two upright posts at top-rear
        const postH = 0.15, postW = 0.11, sightGap = 0.22;
        for (const zOff of [-sightGap / 2, sightGap / 2]) {
            const post = S(new THREE.Mesh(new THREE.BoxGeometry(0.10, postH, postW), M));
            post.position.set(-breechW / 2 + 0.11, FH / 2 + postH / 2, zOff);
            this.breechBlock.add(post);
        }
        // Dark notch between posts
        const rSightNotch = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.09, sightGap - postW - 0.02),
            this._mat(0x585c60, 0.85, 0.22)
        );
        rSightNotch.position.set(-breechW / 2 + 0.11, FH / 2 + 0.045, 0);
        this.breechBlock.add(rSightNotch);

        // Screw/rivet detail on breech face (matches real FP-45 look)
        for (const zOff of [-(FD / 2 + 0.007), (FD / 2 + 0.007)]) {
            const boltGeo = new THREE.CylinderGeometry(0.030, 0.030, 0.038, 8);
            boltGeo.rotateX(Math.PI / 2);
            const bolt = new THREE.Mesh(boltGeo, this._mat(0x909498, 0.35, 0.68));
            bolt.position.set(-breechW / 2 + 0.14, FH / 2 - 0.15, zOff);
            this.breechBlock.add(bolt);
        }

        // Position group at rear of frame; Y animates for open/close
        this.breechBlock.position.set(frameRear + breechW / 2, 0, 0);
        this.pistolGroup.add(this.breechBlock);

        this._breechClosedY = 0;
        this._breechOpenY   = FH * 0.97;

        // ═══ COCKING PIECE (rectangular slider on near face of breech) ════
        // FP-45 striker-setting slider — rectangular block with grip knob
        this.cockingGroup = new THREE.Group();

        const armLen = 0.58, armH = 0.21, armD = 0.13;

        // Horizontal sliding arm
        const cockArm = S(new THREE.Mesh(new THREE.BoxGeometry(armLen, armH, armD), M));
        cockArm.position.x = -armLen / 2 + 0.05;
        this.cockingGroup.add(cockArm);

        // Larger thumb knob at rear end
        const knobW = 0.22, knobH = 0.30, knobD = 0.20;
        const cockKnob = S(new THREE.Mesh(new THREE.BoxGeometry(knobW, knobH, knobD), M));
        cockKnob.position.x = -armLen + 0.05;
        this.cockingGroup.add(cockKnob);

        // Knob serrations (vertical grip lines)
        const serMat = this._mat(0x6c7074, 0.72, 0.40);
        for (let i = -2; i <= 2; i++) {
            const groove = new THREE.Mesh(
                new THREE.BoxGeometry(0.008, knobH - 0.04, 0.003), serMat
            );
            groove.position.set(-armLen + 0.05 + i * 0.038, 0, knobD / 2 + 0.002);
            this.cockingGroup.add(groove);
        }

        // Guide channel shadow (shows the rail the slider rides on)
        const railShadow = new THREE.Mesh(
            new THREE.BoxGeometry(armLen + 0.04, armH - 0.05, 0.006),
            this._mat(0x7c8084, 0.60, 0.42)
        );
        railShadow.position.set(0.05 - armLen / 2, 0, -armD / 2 - 0.001);
        this.cockingGroup.add(railShadow);

        // Positioned on the near (Z+) face of the breech block, mid-height
        const cockBaseX = frameRear + breechW / 2;
        const cockBaseZ = FD / 2 + armD / 2 + 0.006;
        this.cockingGroup.position.set(cockBaseX, barrelY + 0.04, cockBaseZ);
        this.pistolGroup.add(this.cockingGroup);

        this._cockingRestX = cockBaseX;
        this._cockingPullX = cockBaseX - 0.44;

        // ═══ TRIGGER GUARD ════════════════════════════════════════════
        // Large D-ring – one of the Liberator's most distinctive features
        // Runs from grip-front/frame-bottom, arcs down, and back up to barrel
        const tgStartX = gripCX + GW / 2 + 0.02;   // front edge of grip
        const tgStartY = -(FH / 2);
        const tgEndX   = frameFront - 0.02;
        const tgEndY   = barrelY - 0.08;
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
        // Two ejector/storage holes on each side face
        for (const zSide of [-1, 1]) {
            const zPos = (FD / 2 + 0.003) * zSide;
            const faceDir = zSide > 0 ? Math.PI / 2 : -Math.PI / 2;
            for (let i = 0; i < 2; i++) {
                const hx = frameRear + 0.38 + i * 0.46;
                const hy = barrelY - 0.12;

                // Hole outer ring (raised flange look)
                const ring = new THREE.Mesh(
                    new THREE.TorusGeometry(0.087, 0.013, 8, 22), M
                );
                ring.rotation.y = Math.PI / 2;
                ring.position.set(hx, hy, zPos);
                this.pistolGroup.add(ring);

                // Dark hole
                const face = new THREE.Mesh(new THREE.CircleGeometry(0.074, 24), dark);
                face.rotation.y = faceDir;
                face.position.set(hx, hy, zPos * 1.015);
                this.pistolGroup.add(face);
            }

            // Screw heads on frame corners (decorative detail)
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

            // Screw slot line (visual detail)
            for (const [sx, sy] of screwPositions) {
                const slot = new THREE.Mesh(
                    new THREE.BoxGeometry(0.002, 0.058, 0.008),
                    this._mat(0x606060, 0.8, 0.2)
                );
                slot.position.set(sx, sy, (FD / 2 + 0.030) * zSide);
                this.pistolGroup.add(slot);
            }
        }

        // Barrel channel side ridges (slight raised lips on frame sides)
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

        // Add muzzle flash inner glow (bright core)
        this.muzzleCore = new THREE.Mesh(
            new THREE.SphereGeometry(0.16, 10, 10),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
        );
        this.muzzleCore.position.set(muzzleX + 0.02, barrelY, 0);
        this.pistolGroup.add(this.muzzleCore);

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
        this.mouse.x =  (event.clientX / window.innerWidth)  * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.raycaster.intersectObjects(this.pistolGroup.children, true);
        if (hits.length > 0) this.toggleBreech();
    }

    toggleBreech() {
        if (this.isFiring) return;
        this.isBreechOpen = !this.isBreechOpen;
        this._targetBreechY = this.isBreechOpen ? this._breechOpenY : this._breechClosedY;
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
                // Striker pulled back
                const p = t / 0.20;
                this.cockingGroup.position.x = restX + (pullX - restX) * p;
                this.trigger.rotation.z = 0.22 + p * 0.48;

            } else if (t < 0.26) {
                // Fire: striker snaps forward, muzzle flash
                const p = (t - 0.20) / 0.06;
                this.cockingGroup.position.x = pullX + (restX - pullX) * p;
                this.muzzleFlash.material.opacity = 1 - p * 0.3;
                this.muzzleCore.material.opacity = 1;
                this.pistolGroup.position.x = -0.30 * (1 - p);
                this.trigger.rotation.z = 0.22 + (1 - p) * 0.48;

            } else if (t < 0.48) {
                // Muzzle flash fades, recoil recovery
                const p = (t - 0.26) / 0.22;
                this.muzzleFlash.material.opacity = Math.max(0, 0.7 - p);
                this.muzzleCore.material.opacity = Math.max(0, 1 - p * 3.5);
                this.pistolGroup.position.x = -0.30 * Math.max(0, 1 - p * 3);

            } else {
                // Reset
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

        // Smooth breech open/close animation
        if (this._targetBreechY !== undefined) {
            const cur = this.breechBlock.position.y;
            const tgt = this._targetBreechY;
            if (Math.abs(tgt - cur) > 0.0008) {
                this.breechBlock.position.y += (tgt - cur) * 0.18;
            } else {
                this.breechBlock.position.y = tgt;
            }
        }

        this.renderer.render(this.scene, this.camera);
    }
}

new LiberatorSimulator();
