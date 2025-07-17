// DOM要素の取得
const titleContainer = document.getElementById('title-container');
const instructionText = document.getElementById('instruction-text');
const loadingDots = document.getElementById('loading-dots');
const modeSwitchButton = document.getElementById('mode-switch-button');
const editModeLabel = document.getElementById('edit-mode-label');
const viewModeLabel = document.getElementById('view-mode-label');
const addButton = document.getElementById('add-button');
const editButton = document.getElementById('edit-button');
const transformControls = document.getElementById('transform-controls');
const decisionControls = document.getElementById('decision-controls');
const confirmButton = document.getElementById('confirm-button');
const deleteButton = document.getElementById('delete-button');
const rotateLeftButton = document.getElementById('rotate-left-button');
const rotateRightButton = document.getElementById('rotate-right-button');
const scaleSliderContainer = document.getElementById('scale-slider-container');
const sliderTrack = document.getElementById('slider-track');
const sliderHandle = document.getElementById('slider-handle');
const helpButton = document.getElementById('help-button');
const exitArButton = document.getElementById('exit-ar-button');
const helpModal = document.getElementById('help-modal');
const closeHelpButton = document.getElementById('close-help-button');
const tabButtons = document.querySelectorAll('.help-tab-button');
const helpPages = document.querySelectorAll('.help-page');
const confirmDialog = document.getElementById('confirm-dialog');
const confirmDeleteYes = document.getElementById('confirm-delete-yes');
const confirmDeleteNo = document.getElementById('confirm-delete-no');
const furnitureModal = document.getElementById('furniture-modal');
const closeModalButton = document.getElementById('close-modal-button');
const categoryTabsContainer = document.getElementById('category-tabs');
const furnitureGrid = document.getElementById('furniture-grid');
const searchInput = document.getElementById('search-input');
const clearSearchButton = document.getElementById('clear-search-button');
const modalContent = document.getElementById('furniture-modal-inner');

// UI関連の変数
let appState = 'INITIALIZING'; // INITIALIZING, IDLE, PLACING, EDITING
let isEditMode = true; // true: 編集モード, false: 鑑賞モード
let isFloorDetected = false;
let dotAnimationTimer = null;
let objectPendingDeletion = null;

// 家具データ（カテゴリとサムネイルパスを追加）
const furnitureData = [
    { name: 'イス', file: 'chair.glb', height: 0.79, category: 'チェア', thumbnail: 'thumbnails/chair_thumb.png' },
    { name: '本棚', file: 'bookshelf.glb', height: 1.8, category: '収納', thumbnail: 'thumbnails/bookshelf_thumb.png' },
    { name: '脚立', file: 'stand.glb', height: 1.2, category: 'その他', thumbnail: 'thumbnails/stand_thumb.png' },
    { name: 'ダイニングテーブル', file: 'dining_table.glb', height: 0.75, category: 'テーブル', thumbnail: 'thumbnails/dining_table_thumb.png' },
    { name: 'ソファ', file: 'sofa.glb', height: 0.7, category: 'ソファ', thumbnail: 'thumbnails/sofa_thumb.png' },
    { name: 'フロアランプ', file: 'floor_lamp.glb', height: 1.5, category: '照明', thumbnail: 'thumbnails/floor_lamp_thumb.png' },
    { name: 'デスク', file: 'desk.glb', height: 0.72, category: 'テーブル', thumbnail: 'thumbnails/desk_thumb.png' },
    { name: 'サイドテーブル', file: 'side_table.glb', height: 0.5, category: 'テーブル', thumbnail: 'thumbnails/side_table_thumb.png' },
    { name: 'シングルベッド', file: 'single_bed.glb', height: 0.6, category: 'ベッド', thumbnail: 'thumbnails/single_bed_thumb.png' },
    { name: 'テレビボード', file: 'tv_board.glb', height: 0.4, category: '収納', thumbnail: 'thumbnails/tv_board_thumb.png' },
    { name: 'ローテーブル', file: 'low_table.glb', height: 0.35, category: 'テーブル', thumbnail: 'thumbnails/low_table_thumb.png' },
    { name: 'コートハンガー', file: 'coat_hanger.glb', height: 1.7, category: 'その他', thumbnail: 'thumbnails/coat_hanger_thumb.png' },
];
let allCategories = [];
let currentCategoryIndex = 0;
let selectedFurnitureData = null; // 現在選択中の家具データ（プレビュー用）

// --- A-Frame コンポーネント定義 ---

// ARヒットテストを管理するコンポーネント
AFRAME.registerComponent('ar-hit-test-manager', {
    init: function () {
        this.reticle = document.getElementById('reticle');
        this.crossMark = document.getElementById('cross-mark');
        this.camera = document.getElementById('camera');
        this.el.sceneEl.addEventListener('enter-vr', this.onEnterVR.bind(this));
        this.el.sceneEl.addEventListener('exit-vr', this.onExitVR.bind(this));
        this.hitTestSource = null;
        this.hitTestSourceRequested = false;
        this.isFloorDetected = false;
        this.floorY = null;

        // レティクルとクロスマークの初期状態設定
        this.reticle.setAttribute('visible', 'false');
        this.crossMark.setAttribute('visible', 'false');

        // アプリの状態に応じてレティクルとクロスマークの表示を更新するイベントリスナー
        this.el.sceneEl.addEventListener('app-state-changed', (event) => {
            appState = event.detail.state;
            this.updateReticleAndCrossMarkVisibility();
        });
        this.el.sceneEl.addEventListener('floor-detected', (event) => {
            this.isFloorDetected = event.detail.isDetected;
            this.floorY = event.detail.floorY;
            this.updateReticleAndCrossMarkVisibility();
        });
        this.el.sceneEl.addEventListener('is-edit-mode-changed', (event) => {
            isEditMode = event.detail.isEditMode;
            this.updateReticleAndCrossMarkVisibility();
        });
    },

    onEnterVR: function () {
        const session = this.el.sceneEl.renderer.xr.getSession();
        if (session && !this.hitTestSourceRequested) {
            session.requestReferenceSpace('viewer').then((referenceSpace) => {
                session.requestHitTestSource({ space: referenceSpace }).then((source) => {
                    this.hitTestSource = source;
                });
            });
            this.hitTestSourceRequested = true;
            session.addEventListener('end', () => {
                this.hitTestSourceRequested = false;
                this.hitTestSource = null;
                this.isFloorDetected = false;
                this.floorY = null;
                this.reticle.setAttribute('visible', 'false');
                this.crossMark.setAttribute('visible', 'false');
                this.el.sceneEl.emit('floor-detected', { isDetected: false, floorY: null });
            });
            this.el.sceneEl.emit('app-state-changed', { state: 'IDLE' });
        }
    },

    onExitVR: function () {
        this.reticle.setAttribute('visible', 'false');
        this.crossMark.setAttribute('visible', 'false');
        instructionText.style.display = 'none';
        stopDotAnimation();
    },

    tick: function () {
        if (!this.el.sceneEl.is('ar-mode') || !this.hitTestSource) {
            this.reticle.setAttribute('visible', 'false');
            this.crossMark.setAttribute('visible', 'false');
            if (!this.isFloorDetected && appState === 'INITIALIZING') { // AR開始時のみ
                instructionText.style.display = 'block';
                startDotAnimation();
            }
            return;
        }

        const frame = this.el.sceneEl.renderer.xr.getFrame();
        const referenceSpace = this.el.sceneEl.renderer.xr.getReferenceSpace();
        const hitTestResults = frame.getHitTestResults(this.hitTestSource);

        let isCurrentlyPlaceable = false;
        if (hitTestResults.length > 0) {
            const hit = hitTestResults[0];
            const hitPose = hit.getPose(referenceSpace);
            const hitPosition = hitPose.transform.position;

            // 床面が初めて検出された場合、Y座標を固定
            if (this.floorY === null) {
                this.floorY = hitPosition.y;
                this.el.sceneEl.emit('floor-detected', { isDetected: true, floorY: this.floorY });
            }

            const Y_TOLERANCE = 0.2; // 20cmの許容範囲
            const isOnFloor = Math.abs(hitPosition.y - this.floorY) < Y_TOLERANCE;

            // 衝突判定 (Three.jsのRaycasterをA-Frameで使う場合の例)
            const tempVec2 = new AFRAME.THREE.Vector2(0, 0); // 画面中央
            const raycaster = this.el.sceneEl.systems.raycaster.unprojectedRaycaster; // A-Frameの内部Raycaster
            this.camera.object3D.updateMatrixWorld();
            raycaster.setFromCamera(tempVec2, this.camera.object3D);

            let isColliding = false;
            // placedObjectsはfurniture-managerで管理されているので、そちらから取得
            const furnitureManager = this.el.sceneEl.components['furniture-manager'];
            if (furnitureManager && furnitureManager.placedObjects) {
                const activeObject = furnitureManager.previewObject || furnitureManager.selectedObject;
                for (const placedObj of furnitureManager.placedObjects) {
                    if (placedObj !== activeObject && placedObj.object3D) { // activeObject自身とは衝突しない
                        const placedObjBox = new AFRAME.THREE.Box3().setFromObject(placedObj.object3D);
                        if (activeObject && activeObject.object3D) { // activeObjectも存在することを確認
                            const activeObjectBox = new AFRAME.THREE.Box3().setFromObject(activeObject.object3D);
                            if (activeObjectBox.intersectsBox(placedObjBox)) {
                                isColliding = true;
                                break;
                            }
                        }
                    }
                }
            }

            isCurrentlyPlaceable = isOnFloor && !isColliding;

            // レティクルとクロスマークの位置を更新
            const position = hitPose.transform.position;
            const orientation = hitPose.transform.orientation;

            if (appState === 'PLACING' || appState === 'EDITING') {
                this.reticle.setAttribute('visible', isCurrentlyPlaceable && isEditMode);
                this.crossMark.setAttribute('visible', !isCurrentlyPlaceable && isEditMode);

                // レティクルとプレビュー/選択オブジェクトの同期
                const targetObject = furnitureManager.previewObject || furnitureManager.selectedObject;
                if (targetObject && targetObject.object3D) {
                    targetObject.object3D.position.set(position.x, position.y, position.z);
                    targetObject.object3D.quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w);
                    // 配置対象がプレビューオブジェクトの場合、高さオフセットを適用
                    if (furnitureManager.previewObject && furnitureManager.previewObject.object3D.userData.centerOffset) {
                        targetObject.object3D.position.y -= furnitureManager.previewObject.object3D.userData.centerOffset.y;
                    }
                }

                if (this.crossMark.getAttribute('visible')) {
                    // クロスマークの位置とスケールを家具に合わせて調整
                    if (targetObject && targetObject.object3D) {
                        const box = new AFRAME.THREE.Box3().setFromObject(targetObject.object3D);
                        const size = box.getSize(new AFRAME.THREE.Vector3());
                        this.crossMark.setAttribute('position', {
                            x: targetObject.object3D.position.x,
                            y: targetObject.object3D.position.y + size.y / 2 + 0.01, // 家具の底面より少し上
                            z: targetObject.object3D.position.z
                        });
                        const scaleValue = Math.max(size.x, size.z) * targetObject.object3D.scale.x * 0.2; // ❌マークの大きさを調整
                        this.crossMark.setAttribute('scale', `${scaleValue} ${scaleValue} 1`);
                        // クロスマークをカメラの方向に向ける
                        this.crossMark.object3D.quaternion.copy(this.camera.object3D.quaternion);
                    }
                }
                this.el.sceneEl.emit('placeability-changed', { isPlaceable: isCurrentlyPlaceable });
            } else { // IDLEモードの場合
                this.reticle.setAttribute('visible', 'false');
                this.crossMark.setAttribute('visible', 'false');
            }

            if (instructionText.style.display !== 'none' && this.isFloorDetected) {
                instructionText.style.display = 'none';
                stopDotAnimation();
            }
        } else {
            this.reticle.setAttribute('visible', 'false');
            this.crossMark.setAttribute('visible', 'false');
            if (!this.isFloorDetected && appState === 'INITIALIZING') {
                instructionText.style.display = 'block';
                startDotAnimation();
            }
            this.el.sceneEl.emit('placeability-changed', { isPlaceable: false });
        }
    },

    updateReticleAndCrossMarkVisibility: function () {
        const currentScene = this.el.sceneEl;
        if (!currentScene.is('ar-mode')) return;

        if (appState === 'PLACING' || appState === 'EDITING') {
            if (this.isFloorDetected && isEditMode) {
                // isCurrentlyPlaceableはtickで計算されるので、ここではUI要素の表示/非表示のみを制御
                // tickで位置と可否を判断して、最終的なvisibleが設定される
            } else {
                this.reticle.setAttribute('visible', 'false');
                this.crossMark.setAttribute('visible', 'false');
            }
        } else { // IDLE, INITIALIZING
            this.reticle.setAttribute('visible', 'false');
            this.crossMark.setAttribute('visible', 'false');
        }
    }
});


// 家具の追加、選択、削除、モード管理を行うコンポーネント
AFRAME.registerComponent('furniture-manager', {
    init: function () {
        this.scene = this.el.sceneEl;
        this.placedObjects = [];
        this.previewObject = null;
        this.selectedObject = null;
        this.hoveredObject = null; // Three.jsのhoveredObjectに相当
        this.isDraggingSlider = false;
        this.isRotatingContinuously = false;
        this.continuousRotationDirection = 0;
        this.objectPendingDeletion = null;
        this.floorY = null; // ar-hit-test-managerから受け取る床のY座標
        this.isPlaceable = false; // 現在の場所が配置可能かどうか

        this.setupHtmlListeners();

        // Three.js版の名残だが使われていない
        // this.scene.addEventListener('ar-hit-test-found', this.onHitTestFound.bind(this));
        this.scene.addEventListener('enter-vr', this.onEnterVR.bind(this));
        this.scene.addEventListener('exit-vr', this.onExitVR.bind(this));
        this.scene.addEventListener('placeability-changed', (event) => {
            this.isPlaceable = event.detail.isPlaceable;
            updateUI(); // UI更新をトリガー
        });
        this.scene.addEventListener('floor-detected', (event) => {
            this.floorY = event.detail.floorY;
        });

        // gltf-modelがロードされたときに、初期スケールを userData に保存するリスナー
        this.el.sceneEl.addEventListener('model-loaded', (e) => {
            const model = e.detail.model;
            const entity = e.target;
            // gltf-modelコンポーネントがアタッチされているエンティティが対象
            if (entity.components['gltf-model']) {
                const initialBox = new AFRAME.THREE.Box3().setFromObject(model);
                const size = initialBox.getSize(new AFRAME.THREE.Vector3());

                // ロードされたモデルが previewObject または selectedObject の場合のみ処理
                if (entity === this.previewObject || entity === this.selectedObject) {
                    // 元のコードのheightに基づいてスケールを計算し適用
                    const data = entity.userData.furnitureData;
                    if (data && data.height) {
                        const scaleFactor = data.height / size.y;
                        entity.object3D.scale.set(scaleFactor, scaleFactor, scaleFactor);
                        entity.object3D.userData.initialScale = entity.object3D.scale.clone(); // THREE.Vector3のクローンを保存
                        entity.object3D.userData.scaleMultiplier = 1.0;
                        updateSliderForObject(entity.object3D); // スライダーを初期状態に設定
                    }
                    // Three.jsのオブジェクトに直接設定する場合
                    entity.object3D.userData.initialScale = entity.object3D.scale.clone();
                    entity.object3D.userData.scaleMultiplier = 1.0;
                }

                // すべてのモデルのサブメッシュに透明度プロパティを設定
                model.traverse((child) => {
                    if (child.isMesh && child.material) {
                        child.material.transparent = true; // 透明度を有効にする
                        child.material.opacity = 1.0; // デフォルトは不透明
                        child.material.needsUpdate = true;
                    }
                });
            }
        });
    },

    onEnterVR: function () {
        appState = 'IDLE';
        updateUI();
    },

    onExitVR: function () {
        this.resetScene();
        appState = 'INITIALIZING';
        updateUI();
    },

    resetScene: function () {
        this.placedObjects.forEach(obj => obj.parentNode.removeChild(obj));
        this.placedObjects = [];
        if (this.previewObject) {
            this.previewObject.parentNode.removeChild(this.previewObject);
            this.previewObject = null;
        }
        this.selectedObject = null;
        this.hoveredObject = null;
        this.objectPendingDeletion = null;
    },

    onAddFurnitureClick: function (e) {
        e.stopPropagation();
        if (appState === 'IDLE') {
            furnitureModal.style.display = 'flex';
            populateCategories();
            displayFurniture(allCategories[currentCategoryIndex]);
            searchInput.focus();
        }
    },

    onEditFurnitureClick: function (e) {
        e.stopPropagation();
        this.selectAndEditObject(this.hoveredObject);
    },

    onDeleteClick: function (e) {
        e.stopPropagation();
        const targetObject = this.selectedObject || this.previewObject;
        if (targetObject) {
            this.showConfirmDialog(targetObject);
        }
    },

    onConfirmClick: function (e) {
        e.stopPropagation();
        if (appState === 'PLACING') {
            this.placeObject();
        } else if (appState === 'EDITING') {
            this.finishEditing();
        }
    },

    onRotateClick: function (e, direction) {
        e.stopPropagation();
        const target = this.previewObject || this.selectedObject;
        if (target && target.object3D) {
            target.object3D.rotation.y += (Math.PI / 4) * direction;
        }
    },

    startContinuousRotation: function (direction) {
        this.isRotatingContinuously = true;
        this.continuousRotationDirection = direction;
    },

    stopContinuousRotation: function () {
        this.isRotatingContinuously = false;
        this.continuousRotationDirection = 0;
    },

    setupHtmlListeners: function () {
        addButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="width: 32px; height: 32px;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>`;
        editButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 28px; height: 28px;"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>`;
        deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 28px; height: 28px;"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.09-2.134H8.09a2.09 2.09 0 0 0-2.09 2.134v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>`;
        confirmButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3" stroke="currentColor" style="width: 28px; height: 28px;"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>`;
        rotateLeftButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 28px; height: 28px;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" /></svg>`;
        rotateRightButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 28px; height: 28px;"><path stroke-linecap="round" stroke-linejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" /></svg>`;

        addButton.addEventListener('click', this.onAddFurnitureClick.bind(this));
        editButton.addEventListener('click', this.onEditFurnitureClick.bind(this));
        deleteButton.addEventListener('click', this.onDeleteClick.bind(this));
        confirmButton.addEventListener('click', this.onConfirmClick.bind(this));

        // 回転ボタンの長押しイベント
        const setupRotationButtonEvents = (button, direction) => {
            let pressTimer = null;
            const pressStart = (e) => {
                e.preventDefault();
                pressTimer = setTimeout(() => {
                    this.startContinuousRotation(direction);
                }, 300);
            };
            const pressEnd = () => {
                clearTimeout(pressTimer);
                if (!this.isRotatingContinuously) {
                    // 短押しの場合のみ onRotateClick を呼び出す
                    // ここで event オブジェクトを渡すのは少し不自然だが、
                    // 元のコードの onRotateClick の引数に合わせる
                    this.onRotateClick(event, direction);
                }
                this.stopContinuousRotation();
            };
            button.addEventListener('mousedown', pressStart);
            button.addEventListener('touchstart', pressStart, { passive: false });
            button.addEventListener('mouseup', pressEnd);
            button.addEventListener('touchend', pressEnd);
            button.addEventListener('mouseleave', pressEnd);
        };
        setupRotationButtonEvents(rotateLeftButton, 1);
        setupRotationButtonEvents(rotateRightButton, -1);

        // スライダーイベント
        let isDraggingSlider = false;
        const onSliderDragStart = (e) => { e.stopPropagation(); isDraggingSlider = true; };
        const onSliderDragEnd = () => isDraggingSlider = false;
        const onSliderDragMove = (event) => {
            if (!isDraggingSlider) return;
            event.preventDefault();
            const clientX = event.clientX || event.touches[0].clientX;
            const rect = sliderTrack.getBoundingClientRect();
            let percent = (clientX - rect.left) / rect.width;
            percent = Math.max(0, Math.min(1, percent));
            this.updateScaleFromSlider(percent);
        };

        sliderHandle.addEventListener('mousedown', onSliderDragStart);
        document.addEventListener('mousemove', onSliderDragMove);
        document.addEventListener('mouseup', onSliderDragEnd);
        sliderHandle.addEventListener('touchstart', onSliderDragStart, { passive: false });
        document.addEventListener('touchmove', onSliderDragMove, { passive: false });
        document.addEventListener('touchend', onSliderDragEnd);

        // モード切り替えボタン
        modeSwitchButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (appState === 'PLACING' || appState === 'EDITING') {
                return;
            }
            isEditMode = !isEditMode;
            this.scene.emit('is-edit-mode-changed', { isEditMode: isEditMode });
            if (!isEditMode) {
                this.finishEditing(); // 鑑賞モードに切り替える際、編集中のオブジェクトがあれば確定
            }
            updateUI();
        });

        // ヘルプモーダル
        helpButton.addEventListener('click', (e) => {
            e.stopPropagation();
            helpModal.style.display = 'flex';
        });
        closeHelpButton.addEventListener('click', (e) => {
            e.stopPropagation();
            helpModal.style.display = 'none';
        });
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) {
                helpModal.style.display = 'none';
            }
        });
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetTab = button.dataset.tab;
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                helpPages.forEach(page => {
                    page.classList.toggle('active', page.id === targetTab);
                });
            });
        });

        // 削除確認ダイアログ
        confirmDeleteYes.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.objectPendingDeletion) {
                this.deleteObject(this.objectPendingDeletion);
            }
            confirmDialog.style.display = 'none';
            this.objectPendingDeletion = null;
        });
        confirmDeleteNo.addEventListener('click', (e) => {
            e.stopPropagation();
            confirmDialog.style.display = 'none';
            this.objectPendingDeletion = null;
        });

        // 家具選択モーダル
        closeModalButton.addEventListener('click', (e) => {
            e.stopPropagation();
            furnitureModal.style.display = 'none';
            searchInput.blur();
            adjustModalForKeyboard(); // モーダル位置をリセット
        });
        furnitureModal.addEventListener('click', (e) => {
            if (e.target === furnitureModal) {
                e.stopPropagation();
                furnitureModal.style.display = 'none';
                searchInput.blur();
                adjustModalForKeyboard(); // モーダル位置をリセット
            }
        });

        // 検索機能
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value;
            const activeCategory = document.querySelector('.category-tab-button.active')?.dataset.category || 'すべて';
            displayFurniture(activeCategory, searchTerm);
            clearSearchButton.style.display = searchTerm.length > 0 ? 'block' : 'none';
        });
        clearSearchButton.addEventListener('click', () => {
            searchInput.value = '';
            clearSearchButton.style.display = 'none';
            const activeCategory = document.querySelector('.category-tab-button.active')?.dataset.category || 'すべて';
            displayFurniture(activeCategory);
            searchInput.focus();
        });

        // 家具モーダルのスワイプジェスチャー
        let touchStartX = 0;
        let touchEndX = 0;
        const swipeThreshold = 50;

        modalContent.addEventListener('touchstart', (e) => {
            if (e.target.closest('.category-tab-button') || e.target.closest('#close-modal-button') || e.target.closest('#search-input') || e.target.closest('.grid-item')) {
                return;
            }
            touchStartX = e.changedTouches[0].clientX;
        }, { passive: true });

        modalContent.addEventListener('touchend', (e) => {
            if (e.target.closest('.category-tab-button') || e.target.closest('#close-modal-button') || e.target.closest('#search-input') || e.target.closest('.grid-item')) {
                return;
            }
            touchEndX = e.changedTouches[0].clientX;
            this.handleSwipeGesture();
        }, { passive: true });

        exitArButton.addEventListener('click', () => this.scene.exitVR());
    },

    handleSwipeGesture: function () {
        const swipeDistance = touchEndX - touchStartX;
        if (Math.abs(swipeDistance) > swipeThreshold) {
            if (swipeDistance < 0) { // 左スワイプ（次のカテゴリへ）
                currentCategoryIndex++;
                if (currentCategoryIndex >= allCategories.length) {
                    currentCategoryIndex = 0;
                }
            } else { // 右スワイプ（前のカテゴリへ）
                currentCategoryIndex--;
                if (currentCategoryIndex < 0) {
                    currentCategoryIndex = allCategories.length - 1;
                }
            }
            const newCategory = allCategories[currentCategoryIndex];
            activateCategoryTab(newCategory);
            displayFurniture(newCategory, searchInput.value);
        }
    },

    // Three.jsオブジェクトの透明度設定
    setObjectTransparency: function (object3D, isTransparent, opacity = 0.7) {
        if (!object3D) return;
        object3D.traverse(child => {
            if (child.isMesh) {
                child.material.transparent = true;
                child.material.opacity = isTransparent ? opacity : 1.0;
                child.material.needsUpdate = true;
            }
        });
    },

    // Three.jsでいうRaycasterの代わりに、A-FrameのCursor/Raycasterシステムを利用
    // tickごとにホーバー状態をチェック
    tick: function () {
        if (!isEditMode || appState !== 'IDLE') {
            if (this.hoveredObject) {
                this.setObjectTransparency(this.hoveredObject.object3D, false);
                this.hoveredObject = null;
                updateUI();
            }
            return;
        }

        // カメラの正面方向でIntersectionをチェック
        // this.camera が DOM 要素なので .components.raycaster.intersections にアクセス
        // 念のため camera 要素が存在するか確認
        if (!this.camera) {
            this.camera = document.getElementById('camera');
            if (!this.camera) return; // まだ見つからない場合は処理をスキップ
        }

        const intersection = this.camera.components.raycaster.intersections[0];
        let newHoveredObject = null;

        if (intersection && intersection.object && intersection.object.el) {
            // 交差したオブジェクトのA-Frameエンティティを取得
            let intersectedEntity = intersection.object.el;

            // 階層を遡って placedObjects に含まれる親エンティティを探す
            while (intersectedEntity && !this.placedObjects.includes(intersectedEntity)) {
                if (intersectedEntity.parentNode.tagName.toLowerCase() === 'a-scene') {
                    intersectedEntity = null; // シーンの直下まで遡ったら終了
                    break;
                }
                intersectedEntity = intersectedEntity.parentNode;
            }

            if (intersectedEntity && this.placedObjects.includes(intersectedEntity)) {
                newHoveredObject = intersectedEntity;
            }
        }

        if (newHoveredObject !== this.hoveredObject) {
            if (this.hoveredObject && this.hoveredObject !== this.selectedObject) {
                this.setObjectTransparency(this.hoveredObject.object3D, false);
            }
            if (newHoveredObject && newHoveredObject !== this.selectedObject) {
                this.setObjectTransparency(newHoveredObject.object3D, true);
            }
            this.hoveredObject = newHoveredObject;
            updateUI(); // UIの表示/非表示を更新
        }

        // 連続回転の処理
        if (this.isRotatingContinuously && (appState === 'PLACING' || appState === 'EDITING')) {
            const target = this.previewObject || this.selectedObject;
            if (target && target.object3D) {
                const rotationSpeed = 0.04;
                target.object3D.rotation.y += rotationSpeed * this.continuousRotationDirection;
            }
        }

        // 削除アニメーションの更新
        const currentTime = this.el.sceneEl.time / 1000; // A-Frameのtimeはミリ秒
        for (let i = objectsToDelete.length - 1; i >= 0; i--) {
            const item = objectsToDelete[i];
            const progress = (currentTime - item.startTime) / item.duration;

            if (progress < 1) {
                // オブジェクトのY位置と透明度を更新
                item.object.object3D.position.y = item.initialY + progress * 0.5;
                const opacity = 1.0 - progress;
                this.setObjectTransparency(item.object.object3D, true, opacity);
            } else {
                // アニメーション終了後、シーンから削除
                if (item.object.parentNode) {
                    item.object.parentNode.removeChild(item.object);
                }
                objectsToDelete.splice(i, 1);
            }
        }

        // UIの確定ボタンの活性状態を更新
        confirmButton.disabled = !this.isPlaceable;
    },

    // 新しい家具を配置
    spawnPreviewObject: function () {
        if (this.previewObject) {
            this.previewObject.parentNode.removeChild(this.previewObject);
            this.previewObject = null;
        }
        if (!selectedFurnitureData) return;

        this.previewObject = document.createElement('a-entity');
        this.previewObject.setAttribute('gltf-model', `#${selectedFurnitureData.file.replace('.glb', '-model')}`);
        this.previewObject.setAttribute('visible', 'false'); // ヒットテストで見つかるまで非表示
        this.previewObject.classList.add('collidable'); // レイキャスト対象に追加
        this.previewObject.userData.furnitureData = selectedFurnitureData; // 家具データをuserDataに保存

        this.previewObject.addEventListener('model-loaded', () => {
            // ここでuserData.centerOffsetを設定する必要がある
            const model = this.previewObject.object3D;
            const box = new AFRAME.THREE.Box3().setFromObject(model);
            const center = new AFRAME.THREE.Vector3();
            box.getCenter(center);
            const size = box.getSize(new AFRAME.THREE.Vector3());

            // 初期スケールを反映したcenterOffsetを計算し保存
            const scaleFactor = selectedFurnitureData.height / size.y;
            this.previewObject.object3D.userData.centerOffset = center.multiplyScalar(scaleFactor);

            this.setObjectTransparency(this.previewObject.object3D, true); // ロード後に透明にする
            updateSliderForObject(this.previewObject.object3D); // スライダーを初期状態に設定
        });

        this.scene.appendChild(this.previewObject);
        appState = 'PLACING';
        updateUI();
    },

    placeObject: function () {
        if (!this.previewObject) return;

        // プレビューオブジェクトのデータを引き継ぎ、透明度を解除
        this.setObjectTransparency(this.previewObject.object3D, false);

        // previewObjectをそのままplacedObjectsに移動させる
        this.placedObjects.push(this.previewObject);

        // previewObjectをクリア
        this.previewObject = null;
        appState = 'IDLE';
        updateUI();
    },

    selectAndEditObject: function (objectToEdit) {
        if (!isEditMode || appState !== 'IDLE' || !objectToEdit) return;

        if (this.selectedObject) {
            this.setObjectTransparency(this.selectedObject.object3D, false);
        }
        this.selectedObject = objectToEdit;
        this.setObjectTransparency(this.selectedObject.object3D, true); // 選択されたオブジェクトを透明にする

        if (this.hoveredObject === this.selectedObject) {
            this.hoveredObject = null; // ホバー状態を解除
        }

        appState = 'EDITING';
        updateUI();
        updateSliderForObject(this.selectedObject.object3D); // スライダーを更新
    },

    finishEditing: function () {
        if (!this.selectedObject) return;
        this.setObjectTransparency(this.selectedObject.object3D, false);
        this.selectedObject = null;
        appState = 'IDLE';
        updateUI();
    },

    showConfirmDialog: function (object) {
        this.objectPendingDeletion = object;
        confirmDialog.style.display = 'flex';
    },

    deleteObject: function (objectToDelete) {
        if (!objectToDelete) return;

        const indexInPlaced = this.placedObjects.indexOf(objectToDelete);
        if (indexInPlaced > -1) {
            this.placedObjects.splice(indexInPlaced, 1);
        }

        // 削除アニメーションの追加
        objectsToDelete.push({
            object: objectToDelete,
            startTime: this.el.sceneEl.time / 1000,
            duration: 0.3,
            initialY: objectToDelete.object3D.position.y
        });

        if (objectToDelete === this.selectedObject) {
            this.selectedObject = null;
            appState = 'IDLE';
            updateUI();
        } else if (objectToDelete === this.previewObject) {
            this.previewObject = null;
            appState = 'IDLE';
            updateUI();
        }
    },

    updateScaleFromSlider: function (percent) {
        const activeObject = (appState === 'PLACING') ? this.previewObject : this.selectedObject;
        if (!activeObject || !activeObject.object3D) return;

        const multiplier = 0.5 + percent * 1.5; // 0.5倍から2.0倍の範囲
        activeObject.object3D.userData.scaleMultiplier = multiplier;

        const initialScale = activeObject.object3D.userData.initialScale || new AFRAME.THREE.Vector3(1, 1, 1);
        activeObject.object3D.scale.copy(initialScale).multiplyScalar(multiplier);

        updateSliderHandlePosition(percent);
    }
});

// 削除対象オブジェクトのリスト（アニメーション用）
const objectsToDelete = [];


// A-Frameシーン要素の取得（DOMがロードされてから利用可能になる）
let aScene = null;
document.addEventListener('DOMContentLoaded', () => {
    aScene = document.querySelector('a-scene');

    // A-Frameシーンが完全にロードされてからUIの初期化とイベントリスナーを設定
    if (aScene) {
        aScene.addEventListener('loaded', () => {
            console.log('A-Frame scene loaded.'); // シーンがロードされたことを確認するためのログ

            // VRセッション終了時にタイトル画面を再表示
            aScene.addEventListener('exit-vr', () => {
                console.log('AR session exited.'); // セッション終了の確認ログ
                titleContainer.style.display = 'block'; // タイトル画面を再表示
                updateUI(); // UIの状態を更新
            });

            // 最初のUI更新
            updateUI();
        });
    } else {
        console.error('A-Frame scene element not found on DOMContentLoaded.');
    }
});


// UI更新関数 (JavaScriptのみでUIを制御)
function updateUI() {
    // A-Frameシーンがロードされていることを確認
    if (!aScene) {
        console.warn('a-scene element not found in updateUI. Retrying on loaded.');
        return;
    }

    // タイトルコンテナはARセッション開始時に非表示、終了時に表示
    if (aScene.is('ar-mode')) {
        titleContainer.style.display = 'none';
        exitArButton.style.display = 'flex';
        helpButton.style.display = 'flex';
        modeSwitchButton.style.display = 'flex';
    } else {
        titleContainer.style.display = 'block'; // ARモードでない場合はタイトルを表示
        exitArButton.style.display = 'none';
        helpButton.style.display = 'none';
        modeSwitchButton.style.display = 'none';
    }

    // モード切り替えボタンの見た目
    if (isEditMode) {
        editModeLabel.classList.add('active');
        viewModeLabel.classList.remove('active');
    } else {
        editModeLabel.classList.remove('active');
        viewModeLabel.classList.add('active');
    }

    // モード切り替えボタンの活性状態
    if (appState === 'PLACING' || appState === 'EDITING') {
        modeSwitchButton.style.opacity = '0.5';
        modeSwitchButton.style.cursor = 'not-allowed';
    } else {
        modeSwitchButton.style.opacity = '1';
        modeSwitchButton.style.cursor = 'pointer';
    }

    // その他のUI要素の表示/非表示
    addButton.style.display = 'none';
    editButton.style.display = 'none';
    transformControls.style.display = 'none';
    decisionControls.style.display = 'none';

    // furnitureManager が存在するかどうかを確実にチェック
    const furnitureManager = aScene.components['furniture-manager'];

    if (isEditMode && furnitureManager) {
        switch (appState) {
            case 'IDLE':
                addButton.style.display = furnitureManager.isFloorDetected ? 'flex' : 'none';
                if (furnitureManager.hoveredObject) {
                    editButton.style.display = 'flex';
                }
                break;
            case 'PLACING':
            case 'EDITING':
                transformControls.style.display = 'flex';
                decisionControls.style.display = 'flex';
                confirmButton.disabled = !furnitureManager.isPlaceable; // 配置可否に基づいて確定ボタンを制御
                break;
        }
    }
}

// --- 家具選択モーダル関連の関数 ---

function updateAllCategories() {
    allCategories = [...new Set(furnitureData.map(item => item.category))].sort();
    allCategories.unshift('すべて');
}

function populateCategories() {
    categoryTabsContainer.innerHTML = '';
    updateAllCategories();

    allCategories.forEach(category => {
        const tabButton = document.createElement('button');
        tabButton.className = 'category-tab-button';
        tabButton.textContent = category;
        tabButton.dataset.category = category;

        tabButton.addEventListener('click', () => {
            searchInput.value = '';
            clearSearchButton.style.display = 'none';
            document.querySelectorAll('.category-tab-button').forEach(btn => {
                btn.classList.remove('active');
            });
            tabButton.classList.add('active');
            currentCategoryIndex = allCategories.indexOf(category);
            displayFurniture(category);
        });
        categoryTabsContainer.appendChild(tabButton);
    });
    activateCategoryTab(allCategories[currentCategoryIndex]);
}

function displayFurniture(category, searchTerm = '') {
    furnitureGrid.innerHTML = '';

    const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();

    const filteredFurniture = furnitureData.filter(item => {
        const matchesCategory = (category === 'すべて' || item.category === category);
        const matchesSearch = item.name.toLowerCase().includes(lowerCaseSearchTerm);
        return matchesCategory && matchesSearch;
    });

    if (filteredFurniture.length === 0) {
        furnitureGrid.innerHTML = '<p style="text-align: center; color: rgba(255,255,255,0.7); padding: 20px;">家具が見つかりませんでした。</p>';
    } else {
        filteredFurniture.forEach(item => {
            const gridItem = document.createElement('div');
            gridItem.className = 'grid-item';
            gridItem.dataset.category = item.category;

            const img = document.createElement('img');
            img.src = item.thumbnail;
            img.alt = item.name;
            img.onerror = () => { img.style.display = 'none'; console.warn(`Thumbnail not found or failed to load: ${item.thumbnail}`); };
            gridItem.appendChild(img);

            const p = document.createElement('p');
            p.textContent = item.name;
            gridItem.appendChild(p);

            gridItem.addEventListener('click', (e) => {
                e.stopPropagation();
                selectedFurnitureData = item; // 選択された家具データを設定
                document.querySelector('a-scene').components['furniture-manager'].spawnPreviewObject(); // プレビューオブジェクトを生成
                furnitureModal.style.display = 'none';
                updateUI();
            });
            furnitureGrid.appendChild(gridItem);
        });
    }
}

function activateCategoryTab(categoryToActivate) {
    document.querySelectorAll('.category-tab-button').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.category === categoryToActivate) {
            btn.classList.add('active');
            btn.scrollIntoView({ behavior: 'smooth', inline: 'center' });
        }
    });
}

// キーボードの表示/非表示を検知してモーダル位置を調整する
let initialViewportHeight = window.innerHeight;
let currentKeyboardHeight = 0;

function adjustModalForKeyboard() {
    const newViewportHeight = window.innerHeight;
    currentKeyboardHeight = initialViewportHeight - newViewportHeight;

    if (currentKeyboardHeight > 50) {
        furnitureModal.classList.add('modal-above-keyboard');
        furnitureModal.style.setProperty('--keyboard-height', `${currentKeyboardHeight}px`);
    } else {
        furnitureModal.classList.remove('modal-above-keyboard');
        furnitureModal.style.removeProperty('--keyboard-height');
    }
}
window.addEventListener('resize', adjustModalForKeyboard);


// スライダーの制御
function updateSliderHandlePosition(percent) {
    const handleWidth = sliderHandle.offsetWidth;
    const trackWidth = sliderTrack.offsetWidth;
    sliderHandle.style.left = `calc(${percent * 100}% - ${handleWidth * percent}px)`;

    const scale = 0.8 + 0.4 * percent;
    sliderHandle.style.transform = `translateY(-50%) scale(${scale})`;
}

function updateSliderForObject(object3D) {
    if (!object3D) return;
    const multiplier = object3D.userData.scaleMultiplier || 1.0;
    const percent = (multiplier - 0.5) / 1.5;
    updateSliderHandlePosition(percent);
}

// ドットアニメーション
function startDotAnimation() {
    if (dotAnimationTimer) return;
    let dotCount = 0;
    const dots = ['・', '・・', '・・・'];
    dotAnimationTimer = setInterval(() => {
        loadingDots.textContent = dots[dotCount % dots.length];
        dotCount++;
    }, 400);
}

function stopDotAnimation() {
    if (dotAnimationTimer) {
        clearInterval(dotAnimationTimer);
        dotAnimationTimer = null;
        loadingDots.textContent = ''; // アニメーション停止時にドットをクリア
    }
}