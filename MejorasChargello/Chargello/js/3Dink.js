/**
 * 3Dink（すりでぃんく）
 * "3Dink" is a library that is aimed at adding every hyperlink to every 3D models.
 * 
 * @author 髭散化汰 / https://twitter.com/higechira
 * Copyright © 2014-2018 髭散化汰
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


//---------------------------------------------------------------------------------
// 名前空間
// 
// 先頭の処理は多様な使用条件下においても名前空間を適用させるための雛形である。
// 外側の即時関数で、（5行目）thisと内側の即時関数を引数内で定義して渡しており、
// さらに（4行目）引数にした内側の即時関数(factory)を実行させることでexportsにglobal.DDDINKを渡し、
// 内側の即時関数のexportsのプロパティをグローバルに引き出してる（ブラウザで使用時）。
// また、即時関数の引数にglobalを渡すことによって、グローバルオブジェクトがwindow以外でも対応
//---------------------------------------------------------------------------------
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
		typeof define === 'function' && define.amd ? define(['exports'], factory) :
			(factory((global.DDDINK = {})));
}(this, (function (exports) {
	"use strict";

	const VERSION = '2.1.0';
	console.log('3Dink.js Version', VERSION);


	// Three.js自動読み込み
	if (THREE)
		var webGlLib = THREE;


	// Three.js互換のライブラリを利用する場合に設定
	function setWrapperLib(name) {
		webGlLib = name;
	}


	let WIDTH;
	let HEIGHT;

	// domElementからの取得では無く直接canvasのサイズを指定する。
	function setCanvasSize(arg_width, arg_height) {
		WIDTH = arg_width;
		HEIGHT = arg_height;
	}

	// 名前が異なる場合は設定
	let renderer;
	let scene;
	let camera;

	// Three.js の3つのオブジェクトを、3Dink.js 内で読み込むための関数
	// （ユーザーの利用している変数名が異なる可能性が有るため）
	function readRendererObj(arg_renderer, arg_scene, arg_camera) {
		renderer = arg_renderer;
		scene = arg_scene;
		camera = arg_camera;
	}

	// モデルにURLを付与し、ハイパーリンクとする
	function addURL(model, arg_url, writable = false) {

		if (!model.userData.linkConfig) {
			model.userData.linkConfig = new Link();
		}
		else
			console.error("already made \"linkConfig\" object in " + Object.keys({ model })[0]);

		Object.defineProperty(model.userData, 'URL', { value: arg_url, enumerable: true, writable: writable });
	}


	// コンストラクタにすることでプロトタイプで共通のメソッドを定義できる
	function Link() { }

	Link.prototype = {

		// 各モデルの設定
		// リンク先を新しいタブで開くか（'_blank' or '_self'）のデフォルト値
		isNewTab: '_blank',


		// オンマウス時の3Dink発光機能（'ON' or 'OFF'）
		isShineOnMouse: 'OFF',


		// タッチ時の3Dink発光機能（'ON' or 'OFF'）
		isShineOnTouch: 'ON',


		shineColor: 0x888888, // THREE.Color( shineColor ) or THREE.Color( shineColer.r, shineColer.g, shineColer.b )



		// プロトタイプの関数内で使うプロパティ
		// 発光時モデルを入れるオブジェクト
		emissiveObject: undefined,


		// 各モデルの新規タブ設定を行う関数
		// 第二引数が'ALL'のときはプロトタイプのプロパティを変更する。
		setNewTab: function (value) {
			this.isNewTab = value;
		},


		setShineColor: function (value) {
			this.emissiveObject = new webGlLib.Color(value);
		},


		// 各モデルの発光設定の変更関数
		setShineOnMouse: function (value) {

			// 発光機能自体が切れてたらONにする
			if (value !== 'OFF' && domEvent.isShineOnMouseCanvas === 'OFF')
				domEvent.isShineOnMouseCanvas = 'ON';

			this.isShineOnMouse = value;
		},


		setShineOnTouch: function (value) {

			if (value !== 'OFF' && domEvent.isShineOnTouchCanvas !== 'ON')
				domEvent.isShineOnTouchCanvas = 'ON';

			this.isShineOnTouch = value;
		},
	}


	// オブジェクト同士の衝突によるリンク発動を設定するオブジェクト
	const hitEvent = {

		// 三軸方向の当たり判定関数を生成するコンストラクタ
		// 引数は hitMargin はオブジェクトで渡す。それ以外は、"+-" か "+" か "-"。
		JudgeXYZ: function (obj, positionOfset = undefined, X = '+-', Y = '+-', Z = '+-') {
			if (positionOfset) {
				this.obj = new THREE.Vector3(obj.position.x + positionOfset.x, obj.position.y + positionOfset.y, obj.position.z + positionOfset.z);
			}
			else {
				this.obj = obj;
			}

			// obj に Raycaster を作成
			const rays = {};
			if (X === '+-' || X === '+')
				rays.Xr = new THREE.Raycaster(this.obj.position, new THREE.Vector3(1, 0, 0));
			if (X === '+-' || X === '-')
				rays.Xl = new THREE.Raycaster(this.obj.position, new THREE.Vector3(-1, 0, 0));
			if (Y === '+-' || Y === '+')
				rays.Ytop = new THREE.Raycaster(this.obj.position, new THREE.Vector3(0, 1, 0));
			if (Y === '+-' || Y === '-')
				rays.Ybtm = new THREE.Raycaster(this.obj.position, new THREE.Vector3(0, -1, 0));
			if (Z === '+-' || Z === '+')
				rays.Zfw = new THREE.Raycaster(this.obj.position, new THREE.Vector3(0, 0, 1));
			if (Z === '+-' || Z === '-')
				rays.Zbk = new THREE.Raycaster(this.obj.position, new THREE.Vector3(0, 0, -1));

			// 3Dink だったら、3Dink用のメソッドを実行するように指定
			if (obj.userData.URL) {
				this.judgeHit = function (animationID) {
					for (let key in rays) {
						hitEvent.locateMy3Dink(animationID, obj.userData.URL, rays[key], this.hitMargin[key]);
					}
				};
			}
			else {
				this.judgeHit = function (animationID) {
					for (let key in rays) {
						hitEvent.locateOther3Dink(animationID, rays[key], this.hitMargin[key]);
					}
				};
			}
		},

		locateMy3Dink: function (animationID, url, ray, margin) {
			// intersectObjects に衝突判定対象のメッシュのリストを渡す
			const objs = ray.intersectObjects(scene.children, true);

			// PlaneGeometry は何故か距離が正確に測れないため弾く
			if (objs.length > 0 && objs[0].object.geometry.type !== "PlaneGeometry") {
				let dist = objs[0].distance;
				let itsModel = objs[0].object;
				// console.log(itsModel, dist);

				// 例）衝突対象オブジェクトとの距離が 0 になった場合
				if (dist <= margin) {
					location.href = url;
					cancelAnimationFrame(animationID);
				}
			}
		},

		locateOther3Dink: function (animationID, ray, margin) {
			// intersectObjects に衝突判定対象のメッシュのリストを渡す
			const objs = ray.intersectObjects(scene.children, true);

			if (objs.length > 0) {
				let dist = objs[0].distance;
				let itsModel = objs[0].object;

				// 例）衝突対象オブジェクトとの距離が 0 になった場合
				if (dist <= margin) {
					// やりたい処理を行う
					if (!itsModel.userData.linkConfig) {

						// .objから読み込んだモデルの時
						if (itsModel.parent.userData.linkConfig)
							itsModel = itsModel.parent;

						else return;
					}

					// 特定のモデルをクリックでリンク発動
					if (itsModel.userData.URL) {
						console.log(itsModel.userData.URL);
						location.href = itsModel.userData.URL;
						cancelAnimationFrame(animationID);
					}
				}
			}
		},
	}

	hitEvent.JudgeXYZ.prototype.hitMargin = { Xr: 10, Xl: 10, Ytop: 10, Ybtm: 10, Zfw: 10, Zbk: 10 };
	hitEvent.JudgeXYZ.prototype.createHitMargin = function (Xr = 10, Xl = 10, Ytop = 10, Ybtm = 10, Zfw = 10, Zbk = 10) {
		this.hitMargin = { Xr: Xr, Xl: Xl, Ytop: Ytop, Ybtm: Ybtm, Zfw: Zfw, Zbk: Zbk };
	}

	// マウスやタッチ操作に関するオブジェクトを格納
	const domEvent = {

		// 
		// ユーザーが設定できるプロパティ（全廃）
		// 

		// 
		// 内部でのみ使用するプロパティ 
		// 

		// 全体の発光処理のフラグ（任意に変更可）
		// オンマウス時の3Dink発光機能（'ON' or 'OFF'）
		isShineOnMouseCanvas: 'OFF',

		// タッチ時の3Dink発光機能（'ON' or 'OFF'、デフォルトでは'ON'）
		isShineOnTouchCanvas: undefined,

		// デフォルトは'auto'
		cursorDefault: undefined,

		// デフォルトは'pointer'
		cursorOn3Dink: undefined,

		// カーソルの座標が動いた回数を計測
		moveCount: 0,


		// カーソルの座標にあるモデルを格納するオブジェクト
		itsModel: undefined,


		// 今カーソルと交差するモデルの前に交差したモデルを格納するオブジェクト
		selectedModel: {
			material: {
				emissive: undefined
			}
		},


		// 画面座標代入用
		rect: undefined,


		// 画面に乗っかっている指の数の格納用
		touchLen: 0,


		// 発光を止める際に代入
		nonEmissiveObject: new webGlLib.Color(0),


		//
		// 以下、メソッド内で呼び出すメソッド
		//

		// 発光時の色をセットして、発光オブジェクトを生成
		createEmissiveObject:
			function () {
				Link.prototype.emissiveObject = new webGlLib.Color(Link.prototype.shineColor);
			},


		// マウスの座標を得る
		getMousePoint:
			function (e) {

				// マウス位置(2D)
				// マウスの座標を取得し、-1～+1の範囲に正規化する
				const mouse = new webGlLib.Vector2();

				mouse.x = e.clientX - this.rect.left;
				mouse.y = e.clientY - this.rect.top;

				mouse.x = (mouse.x / WIDTH) * 2 - 1;
				mouse.y = -(mouse.y / HEIGHT) * 2 + 1;

				return mouse;
			},


		// 指の座標を得る
		getTouchPoint:
			function (e) {

				// 指の位置(2D)
				// 指の座標を取得し、-1～+1の範囲に正規化する
				const touch = new webGlLib.Vector2();

				touch.x = e.touches[0].clientX - this.rect.left;
				touch.y = e.touches[0].clientY - this.rect.top;

				touch.x = (touch.x / WIDTH) * 2 - 1;
				touch.y = -(touch.y / HEIGHT) * 2 + 1;

				return touch;
			},


		// カーソルが指した座標に存在する全てのオブジェクトを得る
		getIntersectObj:
			function (mouse, camera, scene) {

				const ray = new webGlLib.Raycaster();
				ray.setFromCamera(mouse, camera);

				// 外部から読み込んだオブジェクトも確認する場合はrecursive（第二引数）をtrueにする
				return ray.intersectObjects(scene.children, true);
			},


		// .objから読み込んだモデルのだったときの処理
		setParentObj:
			function () {

				if (!this.itsModel.userData.linkConfig) {
					this.itsModel = this.itsModel.parent;
					this.itsModel.isParent = true;
				}
			},


		// モデルを発光させる
		setShineModel:
			function (itsModel) {
				if (itsModel.isParent) {
					for (let i in itsModel.children) {
						itsModel.children[i].material.emissive = itsModel.userData.linkConfig.emissiveObject;
					}
				}
				else
					itsModel.material.emissive = itsModel.userData.linkConfig.emissiveObject;
			},


		// 発光を止める
		resetShineModel:
			function (selectedMatl) {
				// 以前カーソルを置いて光らせたモデルを元に戻す
				if (this.selectedModel.isParent) {
					for (let i in this.selectedModel.children) {
						this.selectedModel.children[i].material.emissive = this.nonEmissiveObject;
					}
				}
				else
					selectedMatl.emissive = this.nonEmissiveObject;
			},


		// Aタグモードでのタグの追加
		// マウス
		addAnchorMouse:
			function (e, el, parent) {

				if (el !== null)
					parent.removeChild(el);

				const area = 1;

				el = document.createElement('a');

				parent.appendChild(el, null);

				el.id = 'Anchor3Dink';

				el.setAttribute('href', this.itsModel.userData.URL);

				el.style.display = 'inline-block';

				el.style.top = e.clientY - this.rect.top - area / 2 + 'px';
				el.style.left = e.clientX - this.rect.left - area / 2 + 'px';

				el.style.width = area + 'px';
				el.style.height = area + 'px';

				el.style.position = 'absolute';

				parent.style.position = 'relative';
			},


		// タッチ
		addAnchorTouch:
			function (e, el, parent) {

				if (el !== null)
					parent.removeChild(el);

				const area = 1;

				el = document.createElement('a');

				parent.appendChild(el, null);

				el.id = 'Anchor3Dink';

				el.setAttribute('href', this.itsModel.userData.URL);

				el.style.display = 'inline-block';

				el.style.top = e.touches[0].clientY - this.rect.top - area / 2 + 'px';
				el.style.left = e.touches[0].clientX - this.rect.left - area / 2 + 'px';

				el.style.width = area + 'px';
				el.style.height = area + 'px';

				el.style.position = 'absolute';

				parent.style.position = 'relative';
			},


		//
		// モード設定やデバイスにより変化する処理
		//

		// 関数モード
		// マウス
		// 発光有り
		// マウスの乗ったモデルを光らせる。イベント内関数なので常時繰り返される。
		shineModelFn:
			function () {

				let selectedMatl = this.selectedModel.material;
				const style = renderer.domElement.style;

				// マウスと交差しているオブジェクトが有る場合
				if (this.itsModel) {

					if (this.itsModel.userData.linkConfig || this.itsModel.parent.userData.linkConfig) {

						// .objから読み込んだモデルの時
						this.setParentObj();

						if (this.itsModel.userData.URL) {

							// オブジェクトが発光していない（各プロパティが 0 ）場合
							if (this.itsModel.userData.linkConfig.isShineOnMouse !== 'OFF' && this.itsModel.material.emissive && !this.itsModel.material.emissive.r && !this.itsModel.material.emissive.g && !this.itsModel.material.emissive.b)
								this.setShineModel(this.itsModel);

							style.cursor = this.cursorOn3Dink;
						}
					}

					// モデルにリンクがない場合はカーソルを元に戻す
					else style.cursor = this.cursorDefault;

					// マウスの乗ってるモデルが変わったら
					if (this.selectedModel !== this.itsModel) {

						if (selectedMatl.emissive)
							// オブジェクトの発光を止める
							this.resetShineModel(selectedMatl);

						// 現在カーソルを置いているモデルを代入
						this.selectedModel = this.itsModel;
					}
				}

				// マウスと交差するオブジェクトがない場合は、以前発光させたモデルを元に戻す
				else if (style.cursor !== this.cursorDefault) {

					style.cursor = this.cursorDefault;

					if (selectedMatl.emissive)
						this.resetShineModel(selectedMatl);
				}
			},


		// マウス
		// 発光なし
		// マウスポインタの変更のみ。イベント内関数なので常時繰り返される。
		changeCursorFn:
			function () {

				const style = renderer.domElement.style;

				// マウスと交差しているオブジェクトが有る場合
				if (this.itsModel) {

					if (this.itsModel.userData.linkConfig || this.itsModel.parent.userData.linkConfig) {

						// .objから読み込んだモデルの時
						this.setParentObj();

						if (this.itsModel.userData.URL) {

							style.cursor = this.cursorOn3Dink;
						}

					}

					// モデルにリンクがない場合はカーソルを元に戻す
					else style.cursor = this.cursorDefault;
				}

				// マウスと交差するオブジェクトがない場合は、カーソルを元に戻す
				else if (style.cursor !== this.cursorDefault) {

					style.cursor = this.cursorDefault;
				}
			},


		// タッチ
		// 発光有り
		shineModelFnTouch:
			function () {

				let selectedMatl = this.selectedModel.material;

				// 指と交差しているオブジェクトが有るか場合
				if (this.itsModel) {

					if (this.itsModel.userData.linkConfig || this.itsModel.parent.userData.linkConfig) {

						// .objから読み込んだモデルの時
						this.setParentObj();

						if (this.itsModel.userData.URL) {

							// オブジェクトが発光していない（各プロパティが 0 ）場合
							if (this.itsModel.userData.linkConfig.isShineOnTouch !== 'OFF' && this.itsModel.material.emissive && !this.itsModel.material.emissive.r && !this.itsModel.material.emissive.g && !this.itsModel.material.emissive.b)
								this.setShineModel(this.itsModel);
						}
					}

					// 指の乗ってるモデルが変わったら
					if (this.selectedModel !== this.itsModel) {

						if (selectedMatl.emissive)
							// 以前指を置いて光らせたモデルを元に戻す
							this.resetShineModel(selectedMatl);

						// 現在指を置いているモデルを代入
						this.selectedModel = this.itsModel;
					}
				}

				// 指と交差するオブジェクトがない場合は、以前発光させたモデルを元に戻す
				// 以前指を置いたオブジェクトが発光していたら（各プロパティが 0 以外）
				else if (selectedMatl.emissive.r && selectedMatl.emissive.g && selectedMatl.emissive.b) {

					if (selectedMatl.emissive)
						// 以前指を置いて光らせたモデルを元に戻す
						this.resetShineModel(selectedMatl);
				}
			},


		// Aタグモード
		// マウス
		// 発光有り
		// マウスの乗ったモデルを光らせる。イベント内関数なので常時繰り返される。
		shineModelA:
			function (e) {

				let selectedMatl = this.selectedModel.material;

				const style = renderer.domElement.style;

				// renderer(canvas)の親タグにあるアンカータグを取得
				const el = document.getElementById('Anchor3Dink');

				const parent = renderer.domElement.parentNode;

				// マウスと交差しているオブジェクトが有る場合
				if (this.itsModel) {

					if (this.itsModel.userData.linkConfig || this.itsModel.parent.userData.linkConfig) {

						// .objから読み込んだモデルの時
						this.setParentObj();

						if (this.itsModel.userData.URL) {

							// オブジェクトが発光していない（各プロパティが 0 ）場合
							if (this.itsModel.userData.linkConfig.isShineOnMouse !== 'OFF' && this.itsModel.material.emissive && !this.itsModel.material.emissive.r && !this.itsModel.material.emissive.g && !this.itsModel.material.emissive.b)
								this.setShineModel(this.itsModel);

							style.cursor = this.cursorOn3Dink;

							// アンカータグを挿入
							this.addAnchorMouse(e, el, parent);
						}

						else {
							style.cursor = this.cursorDefault;

							// アンカータグがあれば削除
							if (el !== null)
								parent.removeChild(el);
						}

						// マウスの乗ってるモデルが変わったら
						if (this.selectedModel !== this.itsModel) {

							if (selectedMatl.emissive)
								// 以前カーソルを置いて光らせたモデルを元に戻す
								this.resetShineModel(selectedMatl);

							// 現在カーソルを置いているモデルを代入
							this.selectedModel = this.itsModel;
						}
					}

					// アンカータグがあれば削除
					else if (el !== null)
						parent.removeChild(el);
				}

				// マウスと交差するオブジェクトがない場合は、以前発光させたモデルを元に戻す
				else if (style.cursor !== this.cursorDefault && selectedMatl.material.emissive) {

					style.cursor = this.cursorDefault;

					if (selectedMatl.emissive)
						this.resetShineModel(selectedMatl);

				}

				// アンカータグがあれば削除
				else if (el !== null)
					parent.removeChild(el);
			},


		// マウス
		// 発光なし
		// マウスポインタの変更のみ。イベント内関数なので常時繰り返される。
		changeCursorA:
			function (e) {

				const style = renderer.domElement.style;

				const el = document.getElementById('Anchor3Dink');

				const parent = renderer.domElement.parentNode;

				// マウスと交差しているオブジェクトが有る場合
				if (this.itsModel) {

					if (this.itsModel.userData.linkConfig || this.itsModel.parent.userData.linkConfig) {

						// .objから読み込んだモデルの時
						this.setParentObj();

						if (this.itsModel.userData.URL) {

							style.cursor = this.cursorOn3Dink;

							this.addAnchorMouse(e, el, parent);
						}

						else {
							style.cursor = this.cursorDefault;

							if (el !== null)
								parent.removeChild(el);
						}
					}
				}

				// マウスと交差するオブジェクトがない場合は、カーソルを元に戻す
				else if (style.cursor !== this.cursorDefault) {

					style.cursor = this.cursorDefault;

					if (el !== null)
						parent.removeChild(el);
				}
			},


		// タッチ
		// 発光有り
		// 指の乗ったモデルを光らせる。イベント内関数なので常時繰り返される。
		shineModelATouch:
			function (e) {

				let selectedMatl = this.selectedModel.material;

				const el = document.getElementById('Anchor3Dink');

				const parent = renderer.domElement.parentNode;

				// 指と交差しているオブジェクトが有る場合
				if (this.itsModel) {

					if (this.itsModel.userData.linkConfig || this.itsModel.parent.userData.linkConfig) {

						// .objから読み込んだモデルの時
						this.setParentObj();

						if (this.itsModel.userData.URL) {

							// オブジェクトが発光していない（各プロパティが 0 ）場合
							if (this.itsModel.userData.linkConfig.isShineOnTouch !== 'OFF' && this.itsModel.material.emissive && !this.itsModel.material.emissive.r && !this.itsModel.material.emissive.g && !this.itsModel.material.emissive.b)
								this.setShineModel(this.itsModel);

							this.addAnchorTouch(e, el, parent);
						}

						else {

							if (el !== null)
								parent.removeChild(el);
						}

						// 指の乗ってるモデルが変わったら
						if (this.selectedModel !== this.itsModel) {

							if (selectedMatl.emissive)
								// 以前指を置いて光らせたモデルを元に戻す
								this.resetShineModel(selectedMatl);

							// 現在指を置いているモデルを代入
							this.selectedModel = this.itsModel;
						}
					}
				}

				// 指と交差するオブジェクトがない場合は、以前発光させたモデルを元に戻す
				// オブジェクトが発光している（各プロパティが 0 ）場合
				else if (selectedMatl.emissive.r && selectedMatl.emissive.g && selectedMatl.emissive.b) {

					if (selectedMatl.emissive)
						this.resetShineModel(selectedMatl);

					if (el !== null)
						parent.removeChild(el);
				}
			},


		// タッチ
		// 発光なし
		// 指の位置と交差するオブジェクトの取得、移動カウントのみ行う
		addAnchorItsObjA:
			function (e) {

				const el = document.getElementById('Anchor3Dink');

				const parent = renderer.domElement.parentNode;

				// 指と交差しているオブジェクトが有る場合
				if (this.itsModel) {

					if (this.itsModel.userData.linkConfig || this.itsModel.parent.userData.linkConfig) {

						// .objから読み込んだモデルの時
						this.setParentObj();

						if (this.itsModel.userData.URL) {

							this.addAnchorTouch(e, el, parent);
						}

						else {

							if (el !== null)
								parent.removeChild(el);
						}
					}
				}

				else if (el !== null)
					parent.removeChild(el);
			},


		// Eventを処理する共通のダイナミックな雛形関数
		makeEventFnc:
			function (getPoint, process) {

				return function (e) {

					this.rect = renderer.domElement.getBoundingClientRect();

					const pointer = getPoint(e);

					const intersects = this.getIntersectObj(pointer, camera, scene);

					if (intersects[0])
						this.itsModel = intersects[0].object;

					else this.itsModel = undefined;
					this.moveCount++;

					// モードによって動的に変化する関数
					process(e);
				}
			},

		// 関数モード
		// モデルをクリックでリンク発動。イベント内関数なので常時繰り返される。
		loadPageLink:
			function (e) {

				if (this.moveCount < 2) {

					if (this.itsModel) {

						if (!this.itsModel.userData.linkConfig) {

							// .objから読み込んだモデルの時
							if (this.itsModel.parent.userData.linkConfig)
								this.itsModel = this.itsModel.parent;

							else return;
						}

						// 特定のモデルをクリックでリンク発動
						if (this.itsModel.userData.URL) {

							// 左クリックか一本指でタッチ
							if (e.button === 0 || this.touchLen === 1) {

								if (this.itsModel.userData.linkConfig.isNewTab === '_blank')
									open(this.itsModel.userData.URL);

								else location.href = this.itsModel.userData.URL;
							}

							// ホイールクリックの時は別タブで開く
							else if (e.button === 1) open(this.itsModel.userData.URL);

							// *暫定* 右クリックでコンソールにリンク先を表示
							else if (e.button === 2) console.log(this.itsModel.userData.URL);
						}
					}
				}
			},

		// 
		// インターフェイスとなるメソッド
		// 

		// ハイパーリンクEvent追加関数
		// 第一引数：リンク実装方法(関数モードとAタグモード) "Fn"(default) or "A"
		addFnc:
			function (is_Hyperlink_mode = 'Fn', is_Hyperlink_mode_touch = 'Fn', cursorOn3Dink = 'pointer', cursorDefault = 'auto') {

				if (!WIDTH) {
					WIDTH = renderer.domElement.style.width;
					WIDTH = WIDTH.substr(0, WIDTH.length - 2);
				}
				if (!HEIGHT) {
					HEIGHT = renderer.domElement.style.height;
					HEIGHT = HEIGHT.substr(0, HEIGHT.length - 2);
				}

				// 未定義のときはデフォルトの'ON'に設定
				if (domEvent.isShineOnTouchCanvas === undefined)
					domEvent.isShineOnTouchCanvas = 'ON'

				this.cursorDefault = cursorDefault;
				this.cursorOn3Dink = cursorOn3Dink;

				// モード別関数代入用変数
				let evfnc;

				// 発光オブジェクト作成
				this.createEmissiveObject();

				// ピッキング処理（マウスor指を乗っけた時）
				// ポインタ操作でのリンク読み込みをJavaScriptの関数で実現する場合
				//
				// マウス操作での処理
				if (is_Hyperlink_mode === 'Fn') {

					if (this.isShineOnMouseCanvas === 'OFF') {

						evfnc = this.makeEventFnc(this.getMousePoint.bind(this), this.changeCursorFn.bind(this));

						renderer.domElement.addEventListener('mousemove', evfnc.bind(this), false);
					}

					// this.isShineOnMouseCanvas === 'ON'
					else {

						evfnc = this.makeEventFnc(this.getMousePoint.bind(this), this.shineModelFn.bind(this));

						renderer.domElement.addEventListener('mousemove', evfnc.bind(this), false);
					}

					renderer.domElement.addEventListener('mousedown', function () { this.moveCount = 0; }.bind(this), false);

					//　ピッキング処理（クリックしてリンクを作動）
					renderer.domElement.addEventListener('mouseup', this.loadPageLink.bind(this), false);

					console.log('Mouse: <Fuction> Mode by 3Dink.js');
				}


				// タッチ操作での処理
				if (is_Hyperlink_mode_touch === 'Fn') {

					if (this.isShineOnTouchCanvas === 'OFF') {

						evfnc = this.makeEventFnc(this.getTouchPoint.bind(this), function () { });

						renderer.domElement.addEventListener('touchstart', evfnc.bind(this), false);
						renderer.domElement.addEventListener('touchmove', evfnc.bind(this), false);
					}

					// this.isShineOnTouchCanvas === 'ON'
					// カーソルの位置と交差するオブジェクトの取得、移動カウントのみ行う
					else {

						evfnc = this.makeEventFnc(this.getTouchPoint.bind(this), this.shineModelFnTouch.bind(this));

						renderer.domElement.addEventListener('touchstart', evfnc.bind(this), false);
						renderer.domElement.addEventListener('touchmove', evfnc.bind(this), false);
					}

					renderer.domElement.addEventListener('touchstart', function (e) { this.moveCount = 0; this.touchLen = e.touches.length; }.bind(this), false);

					//　ピッキング処理（クリックしてリンクを作動）
					renderer.domElement.addEventListener('touchend', this.loadPageLink.bind(this), false);

					console.log('Touch: <Fuction> Mode by 3Dink.js');
				}


				//　ピッキング処理（マウスor指を乗っけた時 ）
				// ポインタ操作でのリンク読み込みをHTMLのアンカータグで実現する場合
				//
				// マウス操作での処理
				if (is_Hyperlink_mode === 'A') {

					if (this.isShineOnMouseCanvas === 'OFF') {

						evfnc = this.makeEventFnc(this.getMousePoint.bind(this), this.changeCursorFn.bind(this));

						renderer.domElement.addEventListener('mousemove', evfnc.bind(this), false);

						evfnc = this.makeEventFnc(this.getMousePoint.bind(this), this.changeCursorA.bind(this));

						renderer.domElement.addEventListener('mousedown', evfnc.bind(this), false);
					}

					// this.isShineOnMouseCanvas === 'ON'
					else {

						evfnc = this.makeEventFnc(this.getMousePoint.bind(this), this.shineModelFn.bind(this));

						renderer.domElement.addEventListener('mousemove', evfnc.bind(this), false);

						evfnc = this.makeEventFnc(this.getMousePoint.bind(this), this.shineModelA.bind(this));

						renderer.domElement.addEventListener('mousedown', evfnc.bind(this), false);
					}

					console.log('Mouse: <Anchor Tag> Mode by 3Dink.js');
				}

				// タッチ操作での処理
				if (is_Hyperlink_mode_touch === 'A') {

					if (this.isShineOnTouchCanvas === 'OFF') {

						evfnc = this.makeEventFnc(this.getTouchPoint.bind(this), this.addAnchorItsObjA.bind(this));

						renderer.domElement.addEventListener('touchstart', evfnc.bind(this), false);
						renderer.domElement.addEventListener('touchmove', evfnc.bind(this), false);
						renderer.domElement.addEventListener('touchend', function () { }, false);
					}

					// this.isShineOnTouchCanvas === 'ON'
					else {

						evfnc = this.makeEventFnc(this.getTouchPoint.bind(this), this.shineModelATouch.bind(this));

						renderer.domElement.addEventListener('touchstart', evfnc.bind(this), false);
						renderer.domElement.addEventListener('touchmove', evfnc.bind(this), false);
						renderer.domElement.addEventListener('mouseup', function () { }, false);
					}

					console.log('Touch: <Anchor Tag> Mode by 3Dink.js');
				}
			},


		// 全てのグローバルな設定を変更する。
		setGlobalLinkConfig:
			function (newTab, shineOnMouse = 'OFF', shineOnTouch = 'ON', shineColor = 0x888888) {
				Link.prototype.isNewTab = newTab;
				Link.prototype.isShineOnMouse = shineOnMouse;
				Link.prototype.isShineOnTouch = shineOnTouch;
				Link.prototype.shineColor = shineColor;
				// 発光機能利用設定を変更にする
				if (shineOnMouse !== 'OFF')
					domEvent.isShineOnMouseCanvas = 'ON';
				if (shineOnTouch === 'OFF' && domEvent.isShineOnTouchCanvas !== undefined)
					domEvent.isShineOnTouchCanvas = 'OFF';
			},
	}; // domEvent閉じ


	// ここにはオブジェクト同士の衝突によるリンク発動関数を置く予定


	// 簡単に四角形を作成するための関数（テストのために作成）
	function createBox(g_x, g_y, g_z, p_x, p_y, p_z, txr = undefined, arg_color = undefined) {

		// モデル（直方体）を配置
		// 直方体のサイズをBoxGeometry(x, y, z)で指定。
		const geometry = new webGlLib.BoxGeometry(g_x, g_y, g_z);

		if (txr) {
			const texture = new webGlLib.TextureLoader().load(txr);
			texture.minFilter = webGlLib.LinearFilter;

			var material = new webGlLib.MeshPhongMaterial({ map: texture });
		}

		// MeshPhongMaterial({color: hoge})で直方体のカラーを設定
		else if (arg_color)
			var material = new webGlLib.MeshPhongMaterial({ color: arg_color });

		//　モデルの座標を指定して追加
		const model = new webGlLib.Mesh(geometry, material);
		model.position.set(p_x, p_y, p_z);

		// オブジェクトを返して代入させれば、参照（プロトタイプチェーン）は切れない。
		return model;
	}


	//------------------------------------------------------------
	// グローバルに出すプロパティ
	//
	// exportsに渡さなければDDDINKのプロパティに加えられず、プライベートのままになる。
	//------------------------------------------------------------

	// value

	// object
	exports.domEvent = domEvent;
	exports.hitEvent = hitEvent;

	// function
	exports.setWrapperLib = setWrapperLib;
	exports.setCanvasSize = setCanvasSize;
	exports.readRendererObj = readRendererObj;
	exports.addURL = addURL;
	exports.createBox = createBox;
})));

