const TILE_SIZE = 32;
const SUB_TILE_SIZE = 16;
const PLAYER_WIDTH_TILES = 1.5;
const PLAYER_HEIGHT_TILES = 2.5;
const PLAYER_CROUCH_HEIGHT_TILES = 1.5;
const PLAYER_WIDTH = TILE_SIZE * PLAYER_WIDTH_TILES;
const PLAYER_HEIGHT = TILE_SIZE * PLAYER_HEIGHT_TILES;
const PLAYER_CROUCH_HEIGHT = TILE_SIZE * PLAYER_CROUCH_HEIGHT_TILES;
const GATE_WIDTH = TILE_SIZE * 3;
const GATE_HEIGHT = TILE_SIZE * 6;

export const GAME_DATA = {
  "title": {
    "name": "윤회무명2",
    "subtitle": "TYPE-07A Movement Lab",
    "description": "움직임, HUD, 배치를 빠르게 검증하는 브라우저 프로토타입."
  },
  "art": {
    "operatorStanding": {
      "src": "./assets/characters/type-07a-standing.png?v=20260424-2"
    },
    "lootRummage": {
      "src": "./assets/ui/type07a-loot-rummage.png?v=20260425-1"
    },
    "faceOffTargetReference": {
      "src": "./assets/ui/faceoff-reference.png?v=20260426-1"
    },
    "faceOffTargetStylized": {
      "src": "./assets/ui/faceoff-target-stylized-v2.png?v=20260426-1"
    },
    "faceOffFingerGun": {
      "src": "./assets/ui/faceoff-finger-gun.png?v=20260426-1"
    },
    "playerSide": {
      "src": "./assets/characters/type-07a-player-side-sd.png?v=20260424-2"
    },
    "playerIdle": {
      "src": "./assets/characters/type-07a-player-idle-sd.png?v=20260424-2"
    },
    "playerRun": {
      "src": "./assets/characters/type-07a-player-run-sd.png?v=20260424-2"
    },
    "playerSprint": {
      "src": "./assets/characters/type-07a-player-sprint-sd.png?v=20260424-1"
    },
    "playerJump": {
      "src": "./assets/characters/type-07a-player-jump-sd.png?v=20260424-2"
    },
    "playerFall": {
      "src": "./assets/characters/type-07a-player-fall-sd.png?v=20260424-2"
    },
    "playerHoverDrone": {
      "src": "./assets/characters/type-07a-player-hover-drone-sd.png?v=20260424-1"
    },
    "playerDash": {
      "src": "./assets/characters/type-07a-player-dash-sd.png?v=20260424-2"
    },
    "playerCrouch": {
      "src": "./assets/characters/type-07a-player-crouch-sd.png?v=20260424-2"
    },
    "playerSlide": {
      "src": "./assets/characters/type-07a-player-slide-sd.png?v=20260424-1"
    },
    "playerSlideShot": {
      "src": "./assets/characters/type-07a-player-slide-shot-sd.png?v=20260507-1"
    },
    "playerRecoilFocus": {
      "src": "./assets/characters/type-07a-player-recoil-focus-sd.png?v=20260424-1"
    },
    "playerRecoilFocusUp": {
      "src": "./assets/characters/type-07a-player-recoil-focus-up-sd.png?v=20260424-1"
    },
    "playerRecoilFocusDown": {
      "src": "./assets/characters/type-07a-player-recoil-focus-down-sd.png?v=20260424-1"
    },
    "playerRecoilShot": {
      "src": "./assets/characters/type-07a-player-recoil-shot-sd.png?v=20260424-1"
    },
    "playerRecoilSpin": {
      "src": "./assets/characters/type-07a-player-recoil-spin-sheet-sd.png?v=20260424-1"
    },
    "playerWallJump": {
      "src": "./assets/characters/type-07a-player-wall-jump-sd.png?v=20260424-2"
    },
    "playerWallSlide": {
      "src": "./assets/characters/type-07a-player-wall-slide-sd.png?v=20260424-2"
    },
    "playerWallRun": {
      "src": "./assets/characters/type-07a-player-wall-run-sd.png?v=20260424-2"
    },
    "playerBraceHold": {
      "src": "./assets/characters/type-07a-player-brace-hold-sd.png?v=20260424-2"
    },
    "playerBraceRelease": {
      "src": "./assets/characters/type-07a-player-brace-release-sd.png?v=20260424-2"
    },
    "expeditionHudOverlay": {
      "src": "./assets/ui/type07a-expedition-overlay.png"
    },
    "shelterPanel": {
      "src": "./assets/ui/type07a-shelter-panel.png"
    },
    "titlePanel": {
      "src": "./assets/ui/type07a-title-panel.png"
    },
    "resultsPanel": {
      "src": "./assets/ui/type07a-results-panel.png"
    },
    "operatorEmotionSheet": {
      "src": "./assets/ui/type07a-emotion-sheet.png?v=20260425-1"
    }
  },
  "scale": {
    "tileSize": 32,
    "subTileSize": 16,
    "playerWidthTiles": 1.5,
    "playerHeightTiles": 2.5,
    "crouchHeightTiles": 1.5
  },
  "ui": {
    "themeId": "ruin-haze",
    "accent": "#e7f47e",
    "accentSecondary": "#93eaff",
    "objectiveTitle": "목표",
    "minimap": {
      "enabled": true
    },
    "portraitAssetKey": "operatorStanding",
    "portraitCrop": {
      "sx": 250,
      "sy": 70,
      "sw": 520,
      "sh": 520
    },
    "emotionPortraitSheetAssetKey": "operatorEmotionSheet",
    "emotionPortraitSheet": {
      "columns": 3,
      "rows": 3
    },
    "layout": {
      "toast": {
        "x": 52,
        "y": 42,
        "width": 176
      },
      "minimap": {
        "x": 1148,
        "y": 122,
        "radius": 48
      },
      "objective": {
        "x": 1062,
        "y": 256,
        "gap": 34
      },
      "status": {
        "x": 932,
        "y": 608,
        "width": 156,
        "gap": 20
      },
      "portrait": {
        "x": 1168,
        "y": 624,
        "radius": 30
      },
      "actions": {
        "moveX": 46,
        "moveY": 648,
        "dashX": 168,
        "dashY": 649,
        "jumpX": 44,
        "jumpY": 699,
        "crouchX": 126,
        "crouchY": 706,
        "useX": 210,
        "useY": 690
      },
      "results": {
        "cardX": 150,
        "cardY": 104,
        "cardW": 980,
        "cardH": 512,
        "artX": 560,
        "artY": 144,
        "artW": 514,
        "artH": 244
      }
    }
  },
  "world": {
    "mode": "movementLab",
    "width": 9000,
    "height": 4270,
    "gravity": 2350,
    "groundY": 3900,
    "camera": {
      "zoom": 1,
      "minZoom": 0.15,
      "lookAheadEnabled": true,
      "dashAffectsCamera": false,
      "braceAffectsCamera": false,
      "neutralFocusX": 0.5,
      "neutralFocusY": 0.6,
      "walkLookAhead": 0.15,
      "sprintLookAhead": 0.34,
      "sprintJumpLookAhead": 0.34,
      "dashLookAhead": 0,
      "wallRunLookAhead": 0.33,
      "wallRunUpLookAhead": 0.22,
      "braceLookAhead": 0.25,
      "fallLookAhead": 0.3,
      "fallDownSpeedStart": 240,
      "fallDownSpeedFull": 1120,
      "fallDownFocusStartY": 0.42,
      "fallDownFocusFullY": 0.31,
      "fallZoom": 0.9,
      "fallSpeedZoomMultiplier": 0.55,
      "fallReturnHoldMs": 240,
      "fallFocusLerp": 8.5,
      "fallReturnLerp": 3.6,
      "fallLandingProbeDistance": 620,
      "fallLandingProbeMaxTime": 0.72,
      "fallLandingCameraPull": 0.22,
      "fallLandingCameraMaxOffset": 150,
      "directionSpeedThreshold": 300,
      "sprintCameraMinSpeed": 430,
      "speedZoomStart": 600,
      "speedZoomFull": 980,
      "speedZoomMin": 0.15,
      "upwardFocusOffset": -0.35,
      "fallingFocusOffset": 0.35,
      "sprintZoom": 0.6,
      "sprintJumpZoom": 0.6,
      "dashZoom": 0.95,
      "wallRunZoom": 0.35,
      "braceZoom": 0.36,
      "directionLerp": 2.5,
      "focusLerp": 4,
      "zoomLerp": 1.5,
      "mousePanAlways": true,
      "aimPanMaxX": 0.36,
      "aimPanMaxY": 0.27,
      "aimPanLerp": 8.25,
      "aimPanReturnLerp": 7.5
    },
    "duskAt": 9999,
    "nightAt": 19999,
    "sanityDrain": {
      "day": 0,
      "dusk": 0,
      "night": 0
    },
    "startMessage": "이동 실험실 진입.",
    "startClueLog": [
      "플랫폼 간격과 벽 높이를 먼저 본다.",
      "스프라이트 비율은 에디터에서 바로 조정할 수 있다.",
      "출구까지 도달하면 결과 화면으로 넘어간다."
    ],
    "labObjectives": [
      "달리기 감각 확인",
      "점프와 버퍼 확인",
      "벽 슬라이드 확인",
      "대시 거리 확인",
      "출구까지 도달"
    ]
  },
  "faceOff": {
    "range": 720,
    "aimRadius": 72,
    "acquireDuration": 1,
    "aimCameraPull": 5.5,
    "entryZoomDuration": 1,
    "entryZoomScale": 1.62,
    "cursorAssistDuration": 0.34,
    "targetBackdropAssetKey": null,
    "targetArtAssetKey": "faceOffTargetStylized",
    "targetArtCrop": {
      "sx": 0.02,
      "sy": 0,
      "sw": 0.96,
      "sh": 0.995
    },
    "fingerGunAssetKey": "faceOffFingerGun",
    "fingerGunCrop": {
      "sx": 0.39,
      "sy": 0.08,
      "sw": 0.61,
      "sh": 0.92
    },
    "fingerGunAnchor": {
      "x": 0.035,
      "y": 0.2
    },
    "fingerGunWidth": 640,
    "shotShakeDuration": 0.22,
    "shotShakeIntensity": 18,
    "shotFlashDuration": 0.16,
    "enemyLineCharDelay": 0.045,
    "enemyLineHoldDuration": 0.85,
    "choiceSlideDuration": 0.32,
    "enemyLines": {
      "ambushed": "뭐야... 어디서 나타난 거야?",
      "combat": "늦었어. 이미 조준하고 있었어.",
      "knockdown": "살려줘... 반격할 힘도 없어.",
      "dialogue": "말로 끝내고 싶다면 빨리 말해.",
      "threatenSuccess": "알았어. 총 내려놓을게.",
      "threatenFail": "그 협박은 안 통해.",
      "deescalateSuccess": "좋아... 잠깐 멈추지.",
      "deescalateFail": "멈추는 건 네 쪽이야.",
      "persuadeLead": "정보? 네가 뭘 줄 수 있는데?",
      "persuadeDeal": "좋아. 루트 하나는 알려주지.",
      "persuadeFail": "친구 같은 소리 하지 마.",
      "hit": "윽...!",
      "failed": "끝났어."
    },
    "timeScale": 0.08,
    "triggerLimit": 4.5,
    "maxDialogueFailures": 2,
    "bodyParts": [
      { "id": "head", "label": "머리", "damage": 120, "disable": 0 },
      { "id": "torso", "label": "몸통", "damage": 58, "disable": 12 },
      { "id": "leftArm", "label": "왼팔", "damage": 18, "disable": 42 },
      { "id": "rightArm", "label": "오른 팔", "damage": 18, "disable": 42 },
      { "id": "leftLeg", "label": "왼 다리", "damage": 16, "disable": 46 },
      { "id": "rightLeg", "label": "오른 다리", "damage": 16, "disable": 46 }
    ],
    "dialogueOptions": [
      {
        "key": "KeyW",
        "label": "무장해제해!",
        "type": "threaten",
        "baseChance": 0.52,
        "successEffect": "surrender",
        "failEffect": "trigger"
      },
      {
        "key": "KeyA",
        "label": "멈춰.",
        "type": "deescalate",
        "baseChance": 0.42,
        "successEffect": "surrender",
        "failEffect": "trigger"
      },
      {
        "key": "KeyD",
        "label": "안녕 친구?",
        "type": "persuade",
        "baseChance": 0.48,
        "successEffect": "dealProgress",
        "failEffect": "trigger"
      }
    ]
  },
  "armWeapons": {
    "shotgun-arm-a": {
      "id": "shotgun-arm-a",
      "label": "Shotgun Arm",
      "type": "shotgun",
      "fireMode": "semi",
      "aimUi": "scatter",
      "ammoType": "shell",
      "magazineSize": 2,
      "reloadDuration": 0.95,
      "damage": 5,
      "humanoidDamage": 58,
      "droneDamage": 3,
      "spread": 0.38,
      "recoil": 1550,
      "fireCooldown": 0.28,
      "range": 540,
      "hitRadius": 44,
      "headshotMultiplier": 2,
      "knockdownPower": 1.15,
      "staggerDamage": 60,
      "airActionCost": 1
    },
    "ar-arm-a": {
      "id": "ar-arm-a",
      "label": "AR Arm",
      "type": "ar",
      "fireMode": "auto",
      "aimUi": "rifle",
      "ammoType": "rifle",
      "magazineSize": 30,
      "reloadDuration": 1.15,
      "damage": 1.1,
      "humanoidDamage": 18,
      "droneDamage": 1.1,
      "spread": 0.055,
      "recoil": 120,
      "fireCooldown": 0.085,
      "range": 780,
      "hitRadius": 18,
      "headshotMultiplier": 2,
      "knockdownPower": 0.32,
      "staggerDamage": 12,
      "airActionCost": 0
    },
    "sniper-arm-a": {
      "id": "sniper-arm-a",
      "label": "Sniper Arm",
      "type": "sniper",
      "fireMode": "semi",
      "aimUi": "scope",
      "ammoType": "rifle",
      "magazineSize": 5,
      "reloadDuration": 1.45,
      "damage": 4,
      "humanoidDamage": 72,
      "droneDamage": 3.5,
      "spread": 0.012,
      "recoil": 920,
      "fireCooldown": 0.68,
      "range": 1240,
      "hitRadius": 12,
      "headshotMultiplier": 3,
      "knockdownPower": 1,
      "staggerDamage": 58,
      "airActionCost": 1
    },
    "machinegun-arm-a": {
      "id": "machinegun-arm-a",
      "label": "Machinegun Arm",
      "type": "machinegun",
      "fireMode": "auto",
      "aimUi": "heavy",
      "ammoType": "heavy",
      "magazineSize": 80,
      "reloadDuration": 2.1,
      "damage": 0.9,
      "humanoidDamage": 12,
      "droneDamage": 0.9,
      "spread": 0.13,
      "recoil": 85,
      "fireCooldown": 0.055,
      "range": 700,
      "hitRadius": 24,
      "headshotMultiplier": 1.8,
      "knockdownPower": 0.22,
      "staggerDamage": 9,
      "airActionCost": 0
    },
    "pistol-arm-a": {
      "id": "pistol-arm-a",
      "label": "Pistol Arm",
      "type": "pistol",
      "fireMode": "semi",
      "aimUi": "pistol",
      "ammoType": "pistol",
      "magazineSize": 8,
      "reloadDuration": 0.75,
      "damage": 2,
      "humanoidDamage": 24,
      "droneDamage": 1.4,
      "spread": 0.08,
      "recoil": 360,
      "fireCooldown": 0.16,
      "range": 620,
      "hitRadius": 22,
      "headshotMultiplier": 2,
      "knockdownPower": 0.45,
      "staggerDamage": 20,
      "airActionCost": 0
    }
  },
  "weaponModules": {
    "spread-reducer": {
      "id": "spread-reducer",
      "label": "Spread Reducer",
      "shortLabel": "SPR",
      "effects": {
        "spreadMultiplier": 0.82
      }
    },
    "homing-micro-missile": {
      "id": "homing-micro-missile",
      "label": "Homing Micro Missile",
      "shortLabel": "MIS",
      "effects": {
        "missileCount": 1
      }
    },
    "impact-barrier": {
      "id": "impact-barrier",
      "label": "Impact Barrier",
      "shortLabel": "BRR",
      "effects": {
        "barrierDuration": 0.22,
        "barrierStrength": 1
      }
    },
    "recoil-amplifier": {
      "id": "recoil-amplifier",
      "label": "Recoil Amplifier",
      "shortLabel": "RCL",
      "effects": {
        "recoilMultiplier": 1.18
      }
    },
    "magazine-extender": {
      "id": "magazine-extender",
      "label": "Magazine Extender",
      "shortLabel": "MAG",
      "effects": {
        "magazineBonus": 1
      }
    },
    "knockdown-booster": {
      "id": "knockdown-booster",
      "label": "Knockdown Booster",
      "shortLabel": "KDN",
      "effects": {
        "knockdownMultiplier": 1.22
      }
    }
  },
  "defaultLoadout": {
    "selectedSide": "left",
    "reserveAmmo": {
      "shell": 16,
      "pistol": 48,
      "rifle": 180,
      "heavy": 240
    },
    "arms": {
      "left": {
        "armId": "shotgun-arm-a",
        "magazine": null,
        "modules": ["recoil-amplifier", "impact-barrier", "spread-reducer"]
      },
      "right": {
        "armId": "pistol-arm-a",
        "magazine": null,
        "modules": ["magazine-extender", "knockdown-booster"]
      }
    }
  },
  "player": {
    "spawn": {
      "x": 688,
      "y": 1888
    },
    "size": {
      "width": 48,
      "height": 80
    },
    "speed": 360,
    "jumpVelocity": -900,
    "maxHp": 100,
    "maxSanity": 100,
    "maxBattery": 100,
    "startingSanity": 100,
    "attackDamage": 34,
    "attackCooldown": 0.42,
    "lightDrainPerSecond": 10,
    "movement": {
      "runSpeed": 440,
      "sprintSpeed": 1180,
      "sprintBuildMs": 520,
      "sprintDecayMs": 220,
      "sprintJumpCarryMs": 990,
      "sprintJumpMinSpeed": 1020,
      "slideMinSpeed": 570,
      "slideDurationMs": 720,
      "slideFriction": 110,
      "slideSpeedMultiplier": 1.21,
      "slideInvulnerable": true,
      "slideJumpCarryMs": 780,
      "slideJumpBoostMinSpeed": 1080,
      "slideJumpMinSpeed": 1320,
      "slideJumpSpeedMultiplier": 1.18,
      "slideJumpVerticalMultiplier": 1.2,
      "slideSlopeAccel": 900,
      "slideSlopeMaxSpeed": 2100,
      "slideDownhillFriction": 8,
      "slideDownhillTimerDrainMultiplier": 0.28,
      "slideUphillFriction": 2450,
      "slideUphillTimerDrainMultiplier": 3.8,
      "slideUphillStartMinSpeed": 1040,
      "slideUphillStartSpeedMultiplier": 0.52,
      "slideUphillStartTimerMultiplier": 0.28,
      "slideUphillStopSpeed": 540,
      "slopeSnapDistance": 34,
      "hoverFallSpeed": 150,
      "hoverGravityMultiplier": 0.16,
      "hoverStartMaxFallSpeed": 220,
      "hoverStartMinVy": -60,
      "hoverAirControlMultiplier": 0.9,
      "groundAccel": 3400,
      "groundDecel": 4200,
      "airControlMultiplier": 0.75,
      "jumpVelocity": -930,
      "coyoteTimeMs": 100,
      "jumpBufferMs": 120,
      "jumpCutMultiplier": 0.45,
      "apexGravityMultiplier": 0.58,
      "apexGravityThreshold": 180,
      "jumpCornerCorrectionPx": 12,
      "dashDurationMs": 120,
      "dashDistance": 162,
      "maxDashCount": 2,
      "dashCooldownMs": 450,
      "dashCornerCorrectionPx": 12,
      "dashCarryWindowMs": 150,
      "dashCarrySpeedMultiplier": 0.68,
      "dashJumpMinSpeed": 520,
      "dashInvulnerable": true,
      "crouchHeight": 48,
      "crouchSpeedMultiplier": 0.45,
      "wallSlideFallMultiplier": 0.4,
      "wallCoyoteTimeMs": 110,
      "wallSlideGraceMs": 80,
      "wallSpeedRetentionMs": 90,
      "wallSpeedRetentionMinSpeed": 180,
      "wallRunStartSpeed": 260,
      "wallRunAccel": 1680,
      "wallRunMaxSpeed": 920,
      "wallRunExitMinBoost": 720,
      "wallRunExitHorizontal": 180,
      "wallJumpHorizontal": 506,
      "wallJumpVertical": 840,
      "wallJumpLockMs": 100,
      "braceDetectPaddingX": 24,
      "braceDetectPaddingY": 24,
      "braceHoldStartSpeed": 24,
      "braceHoldAccel": 840,
      "braceHoldFallSpeed": 114,
      "braceHoldMoveMultiplier": 0.81,
      "braceBoostHorizontal": 560,
      "braceBoostVertical": 940,
      "braceReuseMs": 180,
      "recoilShotCharges": 1,
      "recoilShotHumanoidDamage": 50,
      "recoilShotForce": 1550,
      "recoilShotMaxHorizontalSpeed": 3000,
      "recoilShotMaxUpSpeed": 2000,
      "recoilShotMaxFallSpeed": 760,
      "recoilShotCooldownMs": 180,
      "recoilShotFocusTimeScale": 0.05,
      "recoilShotAimLookAhead": 0.1,
      "recoilShotAimUpLookAhead": 0.14,
      "recoilShotRecoilLookAhead": 0.18,
      "recoilShotRecoilUpLookAhead": 0.2,
      "recoilShotCameraHoldMs": 240,
      "recoilAirShotPoseMs": 160,
      "recoilSpinDurationMs": 220,
      "recoilSpinLoopCount": 2,
      "recoilAimVerticalPoseThreshold": 0.45
    },
    "render": {
      "idleAssetKey": "playerIdle",
      "runAssetKey": "playerRun",
      "sprintAssetKey": "playerSprint",
      "jumpAssetKey": "playerJump",
      "fallAssetKey": "playerFall",
      "hoverAssetKey": "playerHoverDrone",
      "dashAssetKey": "playerDash",
      "crouchAssetKey": "playerCrouch",
      "slideAssetKey": "playerSlide",
      "slideShotAssetKey": "playerSlideShot",
      "recoilFocusAssetKey": "playerRecoilFocus",
      "recoilFocusUpAssetKey": "playerRecoilFocusUp",
      "recoilFocusDownAssetKey": "playerRecoilFocusDown",
      "recoilShotAssetKey": "playerRecoilShot",
      "recoilAirShotAssetKey": "playerRecoilShot",
      "recoilAirShotUpAssetKey": "playerRecoilFocusUp",
      "recoilAirShotDownAssetKey": "playerRecoilFocusDown",
      "recoilSpinAssetKey": "playerRecoilSpin",
      "wallJumpAssetKey": "playerWallJump",
      "wallSlideAssetKey": "playerWallSlide",
      "wallRunAssetKey": "playerWallRun",
      "braceHoldAssetKey": "playerBraceHold",
      "braceReleaseAssetKey": "playerBraceRelease",
      "fallbackAssetKey": "playerSide",
      "widthRatio": 1,
      "heightRatio": 1.52,
      "idleWidthRatio": 1,
      "idleHeightRatio": 1.1,
      "runWidthRatio": 1,
      "runHeightRatio": 1.025,
      "sprintWidthRatio": 1,
      "sprintHeightRatio": 1.013,
      "jumpWidthRatio": 1,
      "jumpHeightRatio": 1.15,
      "fallWidthRatio": 1,
      "fallHeightRatio": 1.52,
      "hoverWidthRatio": 1,
      "hoverHeightRatio": 1.92,
      "hoverSourceFacing": 1,
      "dashWidthRatio": 0.898,
      "dashHeightRatio": 0.89,
      "crouchWidthRatio": 1,
      "crouchHeightRatio": 1.542,
      "slideWidthRatio": 1.12,
      "slideHeightRatio": 1.32,
      "slideShotWidthRatio": 1.12,
      "slideShotHeightRatio": 1.32,
      "recoilFocusWidthRatio": 1.08,
      "recoilFocusHeightRatio": 1.48,
      "recoilFocusUpWidthRatio": 1.08,
      "recoilFocusUpHeightRatio": 1.48,
      "recoilFocusDownWidthRatio": 1.08,
      "recoilFocusDownHeightRatio": 1.48,
      "recoilShotWidthRatio": 1.08,
      "recoilShotHeightRatio": 1.48,
      "recoilAirShotWidthRatio": 1.08,
      "recoilAirShotHeightRatio": 1.48,
      "recoilAirShotUpWidthRatio": 1.08,
      "recoilAirShotUpHeightRatio": 1.48,
      "recoilAirShotDownWidthRatio": 1.08,
      "recoilAirShotDownHeightRatio": 1.48,
      "recoilSpinWidthRatio": 1,
      "recoilSpinHeightRatio": 1.9,
      "recoilSpinFrameCount": 4,
      "recoilSpinLoopCount": 2,
      "recoilSpinSourceFacing": 1,
      "wallJumpWidthRatio": 1,
      "wallJumpHeightRatio": 1.56,
      "wallSlideWidthRatio": 1,
      "wallSlideHeightRatio": 1.5,
      "wallRunWidthRatio": 1,
      "wallRunHeightRatio": 1.56,
      "braceHoldWidthRatio": 1,
      "braceHoldHeightRatio": 1.5,
      "braceReleaseWidthRatio": 1,
      "braceReleaseHeightRatio": 1.56,
      "idleAnchorX": 0.58,
      "runAnchorX": 0.651,
      "sprintAnchorX": 0.53,
      "jumpAnchorX": 0.63,
      "fallAnchorX": 0.46,
      "hoverAnchorX": 0.48,
      "hoverFootAnchorY": 0.88,
      "dashAnchorX": 0.51,
      "crouchAnchorX": 0.52,
      "slideAnchorX": 0.36,
      "slideShotAnchorX": 0.34,
      "recoilFocusAnchorX": 0.34,
      "recoilFocusUpAnchorX": 0.34,
      "recoilFocusDownAnchorX": 0.34,
      "recoilShotAnchorX": 0.34,
      "recoilAirShotAnchorX": 0.34,
      "recoilAirShotUpAnchorX": 0.34,
      "recoilAirShotDownAnchorX": 0.34,
      "recoilSpinAnchorX": 0.5,
      "recoilSpinFootAnchorY": 0.8,
      "wallJumpAnchorX": 0.34,
      "wallSlideAnchorX": 0.38,
      "wallRunAnchorX": 0.34,
      "braceHoldAnchorX": 0.38,
      "braceReleaseAnchorX": 0.34,
      "footAnchorY": 0.978
    }
  },
  "extractionGate": {
    "x": 8640,
    "y": 496,
    "width": 96,
    "height": 192,
    "prompt": "E: 추출"
  },
  "platforms": [
    {
      "x": 928,
      "y": 1840,
      "width": 208,
      "height": 80,
      "color": "#54697b"
    },
    {
      "x": 1824,
      "y": 1808,
      "width": 464,
      "height": 96,
      "color": "#54697b"
    },
    {
      "x": 2752,
      "y": 1664,
      "width": 368,
      "height": 128,
      "color": "#54697b"
    },
    {
      "x": 5280,
      "y": 1568,
      "width": 544,
      "height": 128,
      "color": "#54697b"
    },
    {
      "x": 7696,
      "y": 944,
      "width": 656,
      "height": 80,
      "color": "#54697b"
    },
    {
      "x": 7696,
      "y": 992,
      "width": 304,
      "height": 432,
      "color": "#54697b"
    },
    {
      "x": 5312,
      "y": 1600,
      "width": 464,
      "height": 784,
      "color": "#54697b"
    },
    {
      "x": 3312,
      "y": 1696,
      "width": 352,
      "height": 576,
      "color": "#54697b"
    },
    {
      "x": 8432,
      "y": 704,
      "width": 128,
      "height": 240,
      "color": "#54697b"
    },
    {
      "x": 16,
      "y": 1520,
      "width": 240,
      "height": 448,
      "color": "#54697b"
    },
    {
      "x": 304,
      "y": 2032,
      "width": 544,
      "height": 2160,
      "color": "#54697b"
    }
  ],
  "props": [],
  "braceWalls": [
    {
      "id": "brace-1776961163785",
      "x": 272,
      "y": 1808,
      "width": 528,
      "height": 176
    },
    {
      "id": "brace-1776961167083",
      "x": 416,
      "y": 1952,
      "width": 224,
      "height": 2048
    },
    {
      "id": "brace-1776961177963",
      "x": 0,
      "y": 1488,
      "width": 272,
      "height": 496
    },
    {
      "id": "brace-1776961183074",
      "x": -16,
      "y": 880,
      "width": 896,
      "height": 272
    },
    {
      "id": "brace-1776961211658",
      "x": 3392,
      "y": 1424,
      "width": 176,
      "height": 192
    },
    {
      "id": "brace-1776961215202",
      "x": 4064,
      "y": 1328,
      "width": 176,
      "height": 224
    },
    {
      "id": "brace-1776961217954",
      "x": 4752,
      "y": 1360,
      "width": 192,
      "height": 272
    },
    {
      "id": "brace-1776961226532",
      "x": 6080,
      "y": 1200,
      "width": 336,
      "height": 304
    },
    {
      "id": "brace-1776961228652",
      "x": 6688,
      "y": 992,
      "width": 304,
      "height": 256
    },
    {
      "id": "brace-1776961230748",
      "x": 7280,
      "y": 736,
      "width": 192,
      "height": 272
    }
  ],
  "humanoidEnemies": [
    {
      "id": "faceoff-guard-01",
      "type": "humanoidEnemy",
      "label": "Checkpoint gunman",
      "x": 1390,
      "y": 1800,
      "width": 58,
      "height": 104,
      "maxHp": 160,
      "disableThreshold": 100,
      "damage": 14,
      "fireRange": 620,
      "triggerRate": 1,
      "timelineShotDamage": 12,
      "knockdownEnabled": true,
      "staggerMax": 100,
      "staggerDecayDelay": 1,
      "staggerDecayRate": 35,
      "staggerBreakDuration": 0.42,
      "staggerAttackLockDuration": 0.65,
      "staggerKnockbackSpeed": 280,
      "staggerKnockbackFriction": 860,
      "crawlSpeed": 42,
      "escapeDistance": 360,
      "exhaustionLimit": 2,
      "knockdownStaggerDuration": 0.65,
      "social": {
        "resolve": 0.45,
        "fear": 0.62,
        "trust": 0.34,
        "aggression": 0.48,
        "reason": 0.56
      },
      "patrol": {
        "left": 1320,
        "right": 1540
      }
    },
    {
      "id": "rifle-sentry-01",
      "type": "humanoidEnemy",
      "label": "Rifle sentry",
      "x": 2060,
      "y": 1800,
      "width": 58,
      "height": 104,
      "maxHp": 140,
      "damage": 12,
      "fireRange": 760,
      "initialCooldown": 1.1,
      "fireCooldown": 1.65,
      "triggerRate": 10,
      "rangedProjectile": true,
      "projectileDamage": 12,
      "projectileSpeed": 820,
      "projectileRadius": 8,
      "projectileLife": 2.1,
      "projectileColor": "#ffbe66",
      "knockdownEnabled": true,
      "staggerMax": 90,
      "staggerDecayDelay": 0.9,
      "staggerDecayRate": 36,
      "staggerBreakDuration": 0.38,
      "staggerAttackLockDuration": 0.58,
      "staggerKnockbackSpeed": 230,
      "staggerKnockbackFriction": 820,
      "crawlSpeed": 38,
      "escapeDistance": 300,
      "exhaustionLimit": 2,
      "knockdownStaggerDuration": 0.58,
      "patrol": {
        "left": 1960,
        "right": 2180
      }
    }
  ],
  "hostileDrones": [
    {
      "id": "crow-01",
      "type": "hostileDrone",
      "visualKind": "crow",
      "x": 760,
      "y": 636,
      "width": 231,
      "height": 106,
      "maxHp": 2,
      "damage": 10,
      "diveDamage": 12,
      "speed": 205,
      "acceleration": 6.4,
      "activationRadius": 920,
      "preferredRange": 285,
      "hoverOffsetY": 138,
      "fireRange": 760,
      "initialCooldown": 2.4,
      "fireCooldown": 9,
      "telegraphDuration": 0.58,
      "beamLife": 0.12,
      "beamLength": 860,
      "beamRadius": 18,
      "diveSpeed": 1040,
      "diveMaxDuration": 0.68,
      "diveRecoverTime": 0.36,
      "flapRate": 14,
      "flapAmplitude": 18,
      "solidInsetX": 25,
      "solidInsetY": 16,
      "backCatchPaddingX": 54,
      "backCatchForgivenessY": 28,
      "damageInsetX": 16,
      "damageInsetY": 12,
      "bobSeed": 0.4,
      "diveAttack": true,
      "solid": true,
      "physicsSolid": true,
      "braceTarget": true,
      "patrol": {
        "left": 650,
        "right": 1060
      }
    },
    {
      "id": "crow-02",
      "type": "hostileDrone",
      "visualKind": "crow",
      "x": 2500,
      "y": 566,
      "width": 231,
      "height": 106,
      "maxHp": 2,
      "damage": 10,
      "diveDamage": 12,
      "speed": 215,
      "acceleration": 6.1,
      "activationRadius": 780,
      "preferredRange": 310,
      "hoverOffsetY": 146,
      "fireRange": 650,
      "initialCooldown": 2.8,
      "fireCooldown": 9,
      "telegraphDuration": 0.58,
      "beamLife": 0.12,
      "beamLength": 880,
      "beamRadius": 18,
      "diveSpeed": 1040,
      "diveMaxDuration": 0.7,
      "diveRecoverTime": 0.38,
      "flapRate": 13,
      "flapAmplitude": 20,
      "solidInsetX": 25,
      "solidInsetY": 16,
      "backCatchPaddingX": 54,
      "backCatchForgivenessY": 28,
      "damageInsetX": 16,
      "damageInsetY": 12,
      "bobSeed": 2.2,
      "diveAttack": true,
      "solid": true,
      "physicsSolid": true,
      "braceTarget": true,
      "patrol": {
        "left": 2360,
        "right": 2760
      }
    }
  ],
  "lootTables": {
    "streetCache": [
      {
        "id": "alloy-shards",
        "name": "합금 파편",
        "rarity": "common",
        "type": "material",
        "quantity": 12,
        "value": 24,
        "weight": 1.2,
        "lootTime": 0.35
      },
      {
        "id": "bio-gel",
        "name": "생체 젤",
        "rarity": "uncommon",
        "type": "material",
        "quantity": 8,
        "value": 42,
        "weight": 1.8,
        "lootTime": 0.55
      },
      {
        "id": "servo-core",
        "name": "서보 코어",
        "rarity": "rare",
        "type": "component",
        "quantity": 1,
        "value": 110,
        "weight": 2.6,
        "lootTime": 0.95
      }
    ],
    "deepCache": [
      {
        "id": "stabilizer-coil",
        "name": "안정화 코일",
        "rarity": "uncommon",
        "type": "component",
        "quantity": 2,
        "value": 68,
        "weight": 2.2,
        "lootTime": 0.7
      },
      {
        "id": "neural-prism",
        "name": "신경 프리즘",
        "rarity": "rare",
        "type": "artifact",
        "quantity": 1,
        "value": 145,
        "weight": 3.1,
        "lootTime": 1.05
      },
      {
        "id": "blackbox-seed",
        "name": "블랙박스 시드",
        "rarity": "epic",
        "type": "artifact",
        "quantity": 1,
        "value": 260,
        "weight": 4.4,
        "lootTime": 1.55
      }
    ]
  },
  "lootCrates": [
    {
      "id": "crate-street-01",
      "x": 996,
      "y": 1790,
      "width": 78,
      "height": 50,
      "label": "거리 보급함",
      "prompt": "E: 상자 열기",
      "lootTable": "streetCache",
      "searchTime": 1.05
    },
    {
      "id": "crate-rooftop-01",
      "x": 7904,
      "y": 892,
      "width": 82,
      "height": 52,
      "label": "추락 보관함",
      "prompt": "E: 상자 열기",
      "lootTable": "deepCache",
      "searchTime": 1.25
    }
  ],
  "interactables": [],
  "encounters": [
    {
      "id": "guard",
      "disabled": true,
      "label": "경비형",
      "identity": "규칙 감시자",
      "type": "guard",
      "x": -400,
      "y": -400,
      "width": 46,
      "height": 82,
      "patrol": {
        "left": -400,
        "right": -400
      },
      "checkpointZone": {
        "x": -420,
        "y": -420,
        "width": 10,
        "height": 10
      },
      "detectionRadius": 0,
      "speed": 0,
      "chaseSpeed": 0,
      "attackRange": 0,
      "damage": 0,
      "maxHp": 1,
      "harvestReward": 0,
      "harvestSanityCost": 0,
      "releaseSanity": 0,
      "storyFlag": "guard-ledger",
      "storyText": "",
      "clues": {
        "motion": "",
        "badge": "",
        "still": ""
      }
    },
    {
      "id": "ritualist",
      "disabled": true,
      "label": "의식형",
      "identity": "순서 집착체",
      "type": "ritualist",
      "x": -500,
      "y": -500,
      "width": 48,
      "height": 88,
      "ritualArea": {
        "x": -520,
        "y": -520,
        "width": 10,
        "height": 10
      },
      "patrolPoints": [
        {
          "x": -500,
          "y": -500
        }
      ],
      "pedestals": [],
      "correctOrder": [],
      "speed": 0,
      "chaseSpeed": 0,
      "attackRange": 0,
      "damage": 0,
      "maxHp": 1,
      "harvestReward": 0,
      "harvestSanityCost": 0,
      "releaseSanity": 0,
      "storyFlag": "ritual-map",
      "storyText": "",
      "clues": {
        "area": "",
        "wrong": "",
        "light": ""
      }
    }
  ],
  "nightThreats": [],
  "abilityDefs": {
    "threatSense": {
      "id": "threatSense",
      "name": "위협 감지",
      "description": "Q 입력 시 위협과 핵심 단서를 강조한다."
    }
  },
  "shelterNpc": {
    "name": "Type-07A",
    "role": "오퍼레이터",
    "dialogue": "움직임과 화면 배치를 필요한 만큼만 조정한다."
  }
};

const BASE_EXTRACTION_GATE = {
  ...GAME_DATA.extractionGate,
};

const BASE_PLAYER_SPAWN = {
  ...GAME_DATA.player.spawn,
};

GAME_DATA.defaultLevelId = "movement-lab-01";
GAME_DATA.levels = {
  "movement-lab-01": {
    "id": "movement-lab-01",
    "label": "Movement Lab 01",
    "entrances": [
      {
        "id": "start",
        "label": "Start",
        "x": BASE_PLAYER_SPAWN.x,
        "y": BASE_PLAYER_SPAWN.y,
        "facing": 1
      }
    ],
    "routeExits": [
      {
        "id": "to-faceoff-checkpoint",
        "label": "Face-off Checkpoint",
        "x": BASE_EXTRACTION_GATE.x,
        "y": BASE_EXTRACTION_GATE.y,
        "width": BASE_EXTRACTION_GATE.width,
        "height": BASE_EXTRACTION_GATE.height,
        "prompt": "E: 다음 구역",
        "toLevelId": "faceoff-checkpoint-01",
        "toEntranceId": "start"
      }
    ],
    "map": {
      "rooms": [
        {
          "id": "main",
          "label": "Movement Lab",
          "x": 0,
          "y": 0,
          "width": 180,
          "height": 82
        }
      ]
    },
    "extractionGate": null
  },
  "faceoff-checkpoint-01": {
    "id": "faceoff-checkpoint-01",
    "label": "Face-off Checkpoint 01",
    "entrances": [
      {
        "id": "start",
        "label": "Start",
        "x": BASE_PLAYER_SPAWN.x,
        "y": BASE_PLAYER_SPAWN.y,
        "facing": 1
      }
    ],
    "routeExits": [],
    "map": {
      "rooms": [
        {
          "id": "main",
          "label": "Checkpoint",
          "x": 240,
          "y": 0,
          "width": 180,
          "height": 82
        }
      ]
    },
    "extractionGate": {
      ...BASE_EXTRACTION_GATE,
      "prompt": "E: 추출"
    }
  }
};

GAME_DATA.worldMap = {
  showUnknownNodes: true,
  nodes: [
    {
      id: "movement-lab-01",
      levelId: "movement-lab-01",
      x: 0,
      y: 0,
      width: 180,
      height: 82,
    },
    {
      id: "faceoff-checkpoint-01",
      levelId: "faceoff-checkpoint-01",
      x: 260,
      y: 0,
      width: 180,
      height: 82,
    },
  ],
  edges: [
    {
      id: "movement-to-faceoff",
      fromLevelId: "movement-lab-01",
      toLevelId: "faceoff-checkpoint-01",
      routeId: "to-faceoff-checkpoint",
    },
  ],
};
