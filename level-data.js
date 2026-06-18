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
    "faceOffKnockdownScene": {
      "src": "./assets/ui/faceoff-knockdown-scene-v1.png?v=20260514-1"
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
    "playerZipline": {
      "src": "./assets/characters/type-07a-player-zipline-sd.png?v=20260510-4"
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
    "shelterHubConcept": {
      "src": "./assets/concepts/shelter-hub-background-v1.png?v=20260514-1"
    },
    "shelterPhotoDay01": {
      "src": "./assets/cg/shelter-photo-day-01.png?v=20260520-1"
    },
    "shelterPhotoDay02": {
      "src": "./assets/cg/shelter-photo-day-02.png?v=20260520-1"
    },
    "shelterPhotoDay03": {
      "src": "./assets/cg/shelter-photo-day-03.png?v=20260520-1"
    },
    "shelterPhotoDay04": {
      "src": "./assets/cg/shelter-photo-day-04.png?v=20260520-1"
    },
    "titlePanel": {
      "src": "./assets/ui/type07a-title-panel.png"
    },
    "resultsPanel": {
      "src": "./assets/ui/type07a-results-panel.png"
    },
    "operatorEmotionSheet": {
      "src": "./assets/ui/type07a-emotion-sheet.png?v=20260425-1"
    },
    "shelterEmotionNeutral": {
      "src": "./assets/ui/shelter-emotions/type07a-neutral.png?v=20260617-5"
    },
    "shelterEmotionAnxious": {
      "src": "./assets/ui/shelter-emotions/type07a-anxious.png?v=20260617-5"
    },
    "shelterEmotionWarm": {
      "src": "./assets/ui/shelter-emotions/type07a-warm.png?v=20260617-5"
    },
    "shelterEmotionTired": {
      "src": "./assets/ui/shelter-emotions/type07a-tired.png?v=20260617-5"
    },
    "shelterEmotionHurt": {
      "src": "./assets/ui/shelter-emotions/type07a-hurt.png?v=20260617-5"
    },
    "shelterEmotionAngry": {
      "src": "./assets/ui/shelter-emotions/type07a-angry.png?v=20260617-5"
    },
    "shelterMemorialNeutral": {
      "src": "./assets/ui/shelter-memorial/type07a-memorial-lobby-v1.png?v=20260618-memorial-lobby-v1"
    },
    "shelterMemorialAnxious": {
      "src": "./assets/ui/shelter-memorial/type07a-memorial-anxious-v1.png?v=20260618-memorial-variants-v1"
    },
    "shelterMemorialWarm": {
      "src": "./assets/ui/shelter-memorial/type07a-memorial-warm-v1.png?v=20260618-memorial-variants-v1"
    },
    "shelterMemorialTired": {
      "src": "./assets/ui/shelter-memorial/type07a-memorial-tired-v1.png?v=20260618-memorial-variants-v1"
    },
    "shelterMemorialHurt": {
      "src": "./assets/ui/shelter-memorial/type07a-memorial-hurt-v1.png?v=20260618-memorial-variants-v1"
    },
    "shelterMemorialAngry": {
      "src": "./assets/ui/shelter-memorial/type07a-memorial-angry-v1.png?v=20260618-memorial-variants-v1"
    },
    "shelterFirstArrivalCg": {
      "src": "./assets/cg/shelter-home-charm-01.png?v=20260618-home-charm-2"
    },
    "shelterHomeCharmCg": {
      "src": "./assets/cg/shelter-home-charm-01.png?v=20260618-home-charm-2"
    },
    "shelterHomeNeutralCg": {
      "src": "./assets/cg/shelter-home-emotion-neutral-01.png?v=20260619-emotion-cg-v1"
    },
    "shelterHomeAnxiousCg": {
      "src": "./assets/cg/shelter-home-emotion-anxious-01.png?v=20260619-emotion-cg-v1"
    },
    "shelterHomeWarmCg": {
      "src": "./assets/cg/shelter-home-emotion-warm-01.png?v=20260619-emotion-cg-v1"
    },
    "shelterHomeTiredCg": {
      "src": "./assets/cg/shelter-home-emotion-tired-01.png?v=20260619-emotion-cg-v1"
    },
    "shelterHomeHurtCg": {
      "src": "./assets/cg/shelter-home-emotion-hurt-01.png?v=20260619-emotion-cg-v1"
    },
    "shelterHomeAngryCg": {
      "src": "./assets/cg/shelter-home-emotion-angry-01.png?v=20260619-emotion-cg-v1"
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
      "minZoom": 0.72,
      "lookAheadEnabled": true,
      "dashAffectsCamera": false,
      "braceAffectsCamera": false,
      "neutralFocusX": 0.5,
      "neutralFocusY": 0.55,
      "boundarySlackY": 0.55,
      "playerSafeTopY": 0.28,
      "playerSafeBottomY": 0.68,
      "walkLookAhead": 0.15,
      "sprintLookAhead": 0.28,
      "sprintJumpLookAhead": 0.28,
      "dashLookAhead": 0,
      "wallRunLookAhead": 0.24,
      "wallRunUpLookAhead": 0.16,
      "braceLookAhead": 0.18,
      "fallLookAhead": 0.22,
      "fallDownSpeedStart": 240,
      "fallDownSpeedFull": 1120,
      "fallDownFocusStartY": 0.46,
      "fallDownFocusFullY": 0.38,
      "fallZoom": 0.94,
      "fallSpeedZoomMultiplier": 0.4,
      "fallReturnHoldMs": 240,
      "fallFocusLerp": 3.2,
      "fallReturnLerp": 2.2,
      "fallLandingProbeDistance": 620,
      "fallLandingProbeMaxTime": 0.72,
      "fallLandingCameraPull": 0.14,
      "fallLandingCameraMaxOffset": 96,
      "directionSpeedThreshold": 220,
      "sprintCameraMinSpeed": 360,
      "speedZoomStart": 360,
      "speedZoomFull": 620,
      "speedZoomMin": 0.82,
      "upwardFocusOffset": -0.22,
      "fallingFocusOffset": 0.22,
      "sprintZoom": 0.82,
      "sprintJumpZoom": 0.82,
      "dashZoom": 0.95,
      "wallRunZoom": 0.78,
      "braceZoom": 0.82,
      "directionLerp": 1.6,
      "focusLerp": 2.3,
      "zoomLerp": 0.85,
      "mousePanAlways": true,
      "aimPanMaxX": 0.24,
      "aimPanMaxY": 0.18,
      "aimPanLerp": 4.2,
      "aimPanReturnLerp": 3.4
    },
    "duskAt": 90,
    "nightAt": 150,
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
    "targetAimScale": 1.62,
    "targetAimTop": 128,
    "targetAimPivotY": 362,
    "targetAimPanMax": 330,
    "targetAimAssistX": 704,
    "targetAimAssistY": 386,
    "sceneArtAssetKey": "faceOffKnockdownScene",
    "sceneArmFocus": {
      "x": 704,
      "y": 462,
      "width": 166,
      "height": 118
    },
    "recoverablePartId": "watchman-right-arm",
    "targetArtAimHeight": 1160,
    "targetArtAimY": 18,
    "targetArtPanMultiplier": 0.82,
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
      "askName": "이름은 흐릿하다. 하지만 비 오는 검문소의 순찰자였다는 감각만 남아 있다.",
      "recoverPartBlocked": "파츠 신호는 잡히지만, 아직 결속부가 움직이고 있다.",
      "recoverPart": "손끝에 남아 있던 방향 감각이 조용히 옮겨 왔다.",
      "dispose": "기억 잔류 신호가 빗물 속으로 낮게 가라앉았다.",
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
        "label": "이름을 묻는다",
        "type": "askName",
        "baseChance": 1,
        "successEffect": "revealOrigin",
        "failEffect": null
      },
      {
        "key": "KeyA",
        "label": "오른팔을 회수한다",
        "type": "recoverPart",
        "baseChance": 1,
        "successEffect": "recoverPart",
        "failEffect": null
      },
      {
        "key": "KeyD",
        "label": "처분한다",
        "type": "dispose",
        "baseChance": 1,
        "successEffect": "dispose",
        "failEffect": null
      },
      {
        "key": "KeyS",
        "label": "물러난다",
        "type": "backOff",
        "baseChance": 1,
        "successEffect": "backOff",
        "failEffect": null
      }
    ]
  },
  "parts": {
    "watchman-right-arm": {
      "id": "watchman-right-arm",
      "name": "순찰자의 오른팔",
      "slot": "rightArm",
      "originOwnerId": "rifle-sentry-01",
      "originLabel": "비 오는 검문소의 순찰자",
      "dreamId": "dream-watchman-arm",
      "memoryResidue": 12,
      "corruption": 12,
      "purified": false,
      "statModifiers": {
        "recoilMultiplier": 0.88,
        "spreadMultiplier": 0.94,
        "humanoidDamageBonus": 4
      },
      "description": "손끝에 아직 젖은 난간의 감각이 남아 있는 오른팔."
    }
  },
  "dreams": {
    "dream-watchman-arm": {
      "id": "dream-watchman-arm",
      "title": "잔몽: 비 오는 검문소",
      "lines": [
        "빗물이 손등을 따라 흘렀다.",
        "무전기는 같은 문장을 반복하고 있었다.",
        "누군가를 막아야 한다는 감각만 손끝에 남아 있다.",
        "하지만 그 사람의 이름은 떠오르지 않는다."
      ],
      "clue": "검문소 근처에서 찢어진 명찰을 찾아야 한다."
    }
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
      "humanoidDamage": 60,
      "droneDamage": 3,
      "spread": 0.38,
      "recoil": 1550,
      "fireCooldown": 0.28,
      "range": 540,
      "closeRange": 320,
      "closeRangeAngle": 1.35,
      "closeRangeDamageMultiplier": 2,
      "hitRadius": 44,
      "headshotMultiplier": 1,
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
      "humanoidDamage": 60,
      "droneDamage": 1.4,
      "spread": 0.08,
      "recoil": 360,
      "fireCooldown": 0.16,
      "range": 620,
      "hitRadius": 22,
      "headshotMultiplier": 1,
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
    "speed": 300,
    "jumpVelocity": -820,
    "maxHp": 100,
    "maxSanity": 100,
    "maxBattery": 100,
    "startingSanity": 100,
    "attackDamage": 34,
    "attackCooldown": 0.42,
    "lightDrainPerSecond": 10,
    "movement": {
      "runSpeed": 300,
      "sprintSpeed": 520,
      "sprintBuildMs": 640,
      "sprintDecayMs": 360,
      "sprintJumpCarryMs": 540,
      "sprintJumpMinSpeed": 470,
      "verticalMomentumDecayMs": 1150,
      "verticalMomentumComboMs": 980,
      "verticalMomentumSpeedBoost": 0.22,
      "verticalMomentumSpeedBuild": 0.24,
      "verticalMomentumJumpBoost": 0.12,
      "verticalMomentumWallBoost": 0.18,
      "verticalMomentumRecoilBoost": 0.14,
      "verticalMomentumHoverLift": 110,
      "slideMinSpeed": 360,
      "slideDurationMs": 560,
      "slideFriction": 520,
      "slideSpeedMultiplier": 1.08,
      "slideInvulnerable": true,
      "slideJumpCarryMs": 480,
      "slideJumpBoostMinSpeed": 520,
      "slideJumpMinSpeed": 580,
      "slideJumpSpeedMultiplier": 1.08,
      "slideJumpVerticalMultiplier": 1.08,
      "slideSlopeAccel": 520,
      "slideSlopeMaxSpeed": 860,
      "slideDownhillFriction": 120,
      "slideDownhillTimerDrainMultiplier": 0.72,
      "slideUphillFriction": 1320,
      "slideUphillTimerDrainMultiplier": 2.2,
      "slideUphillStartMinSpeed": 520,
      "slideUphillStartSpeedMultiplier": 0.56,
      "slideUphillStartTimerMultiplier": 0.46,
      "slideUphillStopSpeed": 260,
      "slopeSnapDistance": 34,
      "hoverFallSpeed": 150,
      "hoverGravityMultiplier": 0.16,
      "hoverStartMaxFallSpeed": 220,
      "hoverStartMinVy": -60,
      "hoverAirControlMultiplier": 0.9,
      "groundAccel": 2400,
      "groundDecel": 3200,
      "stopInertiaInitialDecelMultiplier": 0.26,
      "stopInertiaMaxDecelMultiplier": 1.28,
      "stopInertiaRampSeconds": 0.52,
      "airControlMultiplier": 0.68,
      "airInertiaDecelMultiplier": 0.18,
      "airTurnDecelMultiplier": 0.52,
      "jumpVelocity": -840,
      "coyoteTimeMs": 100,
      "jumpBufferMs": 120,
      "jumpCutMultiplier": 0.45,
      "apexGravityMultiplier": 0.58,
      "apexGravityThreshold": 180,
      "jumpCornerCorrectionPx": 12,
      "dashDurationMs": 110,
      "dashWindupMs": 65,
      "dashDistance": 150,
      "maxDashCount": 2,
      "dashCooldownMs": 450,
      "dashCornerCorrectionPx": 12,
      "dashCarryWindowMs": 120,
      "dashCarrySpeedMultiplier": 0.45,
      "dashJumpMinSpeed": 360,
      "dashInvulnerable": true,
      "crouchHeight": 48,
      "crouchSpeedMultiplier": 0.45,
      "wallSlideFallMultiplier": 0.4,
      "wallCoyoteTimeMs": 110,
      "wallSlideGraceMs": 80,
      "wallSpeedRetentionMs": 90,
      "wallSpeedRetentionMinSpeed": 150,
      "wallRunStartSpeed": 220,
      "wallRunAccel": 920,
      "wallRunMaxSpeed": 520,
      "wallRunExitMinBoost": 420,
      "wallRunExitHorizontal": 150,
      "wallJumpHorizontal": 360,
      "wallJumpVertical": 760,
      "wallJumpLockMs": 100,
      "braceDetectPaddingX": 24,
      "braceDetectPaddingY": 24,
      "braceHoldStartSpeed": 24,
      "braceHoldAccel": 520,
      "braceHoldFallSpeed": 96,
      "braceHoldMoveMultiplier": 0.68,
      "braceBoostHorizontal": 380,
      "braceBoostVertical": 760,
      "braceReuseMs": 180,
      "recoilShotCharges": 1,
      "recoilShotHumanoidDamage": 50,
      "recoilShotForce": 820,
      "recoilShotMaxHorizontalSpeed": 1200,
      "recoilShotMaxUpSpeed": 1100,
      "recoilShotMaxFallSpeed": 560,
      "recoilShotStackSpeedMultiplier": 3,
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
      "zipLineAssetKey": "playerZipline",
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
      "zipLineWidthRatio": 0.95,
      "zipLineHeightRatio": 1.02,
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
      "zipLineAnchorX": 0.42,
      "zipLineFootAnchorY": 0.55,
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
    "prompt": "D: 추출"
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
  "temporaryBlocks": [],
  "zipLineNodes": [],
  "zipLines": [],
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
      "maxHp": 120,
      "disableThreshold": 100,
      "damage": 14,
      "fireRange": 620,
      "triggerRate": 1,
      "timelineShotDamage": 12,
      "knockdownEnabled": true,
      "parts": {
        "arm": {
          "hp": 40,
          "broken": false,
          "dropPartId": null
        },
        "leg": {
          "hp": 45,
          "broken": false,
          "dropPartId": null
        },
        "core": {
          "hp": 80,
          "broken": false
        }
      },
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
      "maxHp": 120,
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
      "parts": {
        "arm": {
          "hp": 36,
          "broken": false,
          "dropPartId": "watchman-right-arm"
        },
        "leg": {
          "hp": 45,
          "broken": false,
          "dropPartId": null
        },
        "core": {
          "hp": 80,
          "broken": false,
          "dropPartId": null
        }
      },
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

GAME_DATA.shelter = {
  levelId: "shelter-hub-01",
  backgroundId: "shelter-hub",
  arrivalCutsceneSeconds: 2.4,
  photoScenes: [
    { id: "shelter-photo-day-01", day: 1, label: "아침 정비", assetKey: "shelterPhotoDay01" },
    { id: "shelter-photo-day-02", day: 2, label: "작업대", assetKey: "shelterPhotoDay02" },
    { id: "shelter-photo-day-03", day: 3, label: "황혼 귀환", assetKey: "shelterPhotoDay03" },
    { id: "shelter-photo-day-04", day: 4, label: "우천 대기", assetKey: "shelterPhotoDay04" }
  ],
  events: [
    {
      id: "shelter-first-arrival-01",
      title: "첫 쉘터 진입",
      once: true,
      completionFlag: "shelter-event:shelter-first-arrival-01",
      trigger: {
        autoStart: true,
        missingStoryFlag: "shelter-event:shelter-first-arrival-01"
      },
      backgroundAssetKey: "shelterFirstArrivalCg",
      startNodeId: "arrival",
      nodes: [
        {
          id: "arrival",
          emotion: "anxious",
          line: "쉘터 문이 닫히고, 안쪽 조명이 천천히 켜진다.\nType-07A가 주변을 둘러본다.\n“와... 여기 생각보다 멀쩡하네.”",
          choices: [
            {
              label: "계속 들어준다",
              intent: "listen as she settles into the shelter",
              emotion: "warm",
              nextNodeId: "cable-check"
            }
          ]
        },
        {
          id: "cable-check",
          emotion: "warm",
          line: "“아빠, 여기 우리 임시 집 같은 거야? 나 그런 거 좀 좋은데.”\n“근데 케이블 정리 진짜 엉망이다. 이거 아빠가 한 거지?”\n“아니, 뭐... 싫다는 건 아니고. 아빠 냄새 나서 좀 안심돼.”",
          choices: [
            {
              label: "여기선 쉬어도 돼",
              intent: "let her rest in the shelter",
              emotion: "warm",
              reply: "“진짜? 그럼 나 5분만 뻗을래. 아빠, 깨우지 마.”\n“아, 위험하면 깨워. 그건 깨워야 돼.”",
              effects: {
                trust: 0.03,
                storyFlags: ["shelter-first-rest"]
              }
            },
            {
              label: "먼저 상태부터 보자",
              intent: "check her condition first",
              emotion: "tired",
              reply: "“아, 바로 점검이야? 완전 아빠다.”\n“알겠어. 대신 끝나면 쉬는 거야. 약속.”",
              effects: {
                storyFlags: ["shelter-first-checkup"]
              }
            },
            {
              label: "무서웠지",
              intent: "comfort her after the escape",
              emotion: "warm",
              reply: "“조금? ...아니, 좀 많이.”\n“근데 아빠 목소리 들리니까 괜찮아졌어. 진짜로.”",
              effects: {
                trust: 0.02,
                storyFlags: ["shelter-first-comfort"]
              }
            }
          ]
        }
      ]
    },
    {
      id: "shelter-power-warmup-01",
      title: "첫 전원 점검",
      once: true,
      completionFlag: "shelter-event:shelter-power-warmup-01",
      trigger: {
        autoStart: true,
        requiredStoryFlag: "shelter-event:shelter-first-arrival-01",
        missingStoryFlag: "shelter-event:shelter-power-warmup-01"
      },
      backgroundAssetKey: "shelterHomeCharmCg",
      transitionLine: "잠깐 조용해진 뒤, 벽 안쪽에서 낮은 진동이 들린다.",
      transitionSeconds: 1.15,
      transitionEmotion: "anxious",
      startNodeId: "power-panel",
      nodes: [
        {
          id: "power-panel",
          emotion: "anxious",
          line: "쉘터 조명이 한 번 깜빡이고, 환풍기가 낮게 돌기 시작한다.\nType-07A가 배전함 앞에 쪼그려 앉아 있다.\n“아빠, 이거 불빛 색깔 좀 불안한데?”\n“초록이면 정상인 거지? 근데 지금 약간... 라임맛 노란색이야.”",
          choices: [
            {
              label: "천천히 봐도 돼",
              intent: "calm her down while she checks the shelter power",
              emotion: "warm",
              reply: "“오케이. 그 말 좋다.”\n“나 지금 엄청 침착한 척하는 중이었거든. 티 안 났지?”\n“아빠가 옆에서 봐주면 나 할 수 있어.”",
              effects: {
                trust: 0.03,
                storyFlags: ["shelter-power-calm"]
              }
            },
            {
              label: "위쪽 스위치부터 확인해",
              intent: "guide her through the power panel check",
              emotion: "tired",
              reply: "“아, 바로 지시 들어오는 거 봐. 완전 아빠 모드.”\n“근데 맞는 말이라서 짜증나. 위쪽부터 볼게.”\n“끝나면 칭찬해줘. 그건 계약임.”",
              effects: {
                storyFlags: ["shelter-power-check"]
              }
            },
            {
              label: "무서우면 내가 할게",
              intent: "offer to take over if she is scared",
              emotion: "warm",
              reply: "“아니야, 나도 할 수 있어.”\n“근데 그렇게 말해주는 건 좋아. 엄청 좋아.”\n“아빠, 나 손 떨리면 그냥 모른 척해줘.”",
              effects: {
                trust: 0.02,
                storyFlags: ["shelter-power-support"]
              }
            }
          ]
        }
      ]
    },
    {
      id: "shelter-home-charm-01",
      title: "첫 장식",
      once: true,
      completionFlag: "shelter-event:shelter-home-charm-01",
      trigger: {
        autoStart: true,
        requiredStoryFlag: "shelter-event:shelter-power-warmup-01",
        missingStoryFlag: "shelter-event:shelter-home-charm-01"
      },
      backgroundAssetKey: "shelterHomeCharmCg",
      transitionLine: "점검이 끝나자, 좁은 방 안에 잠깐 조용한 틈이 생긴다.",
      transitionSeconds: 1.15,
      transitionEmotion: "warm",
      startNodeId: "charm-found",
      nodes: [
        {
          id: "charm-found",
          emotion: "warm",
          line: "Type-07A가 공구함 옆에서 작은 장식 스티커를 꺼낸다.\n수리한 장치 위에 대 보다가, 슬쩍 관리자를 본다.\n“아빠, 이거 붙여도 돼?”",
          choices: [
            {
              label: "계속 봐준다",
              intent: "let her show the small charm she wants to add to the shelter",
              emotion: "warm",
              nextNodeId: "make-it-home"
            }
          ]
        },
        {
          id: "make-it-home",
          emotion: "warm",
          line: "“아니, 막 꾸미자는 건 아니고. 여기 너무 군부대 냄새 나잖아.”\n“우리 집이면... 조금 귀여운 것도 있어야지.”\n“아빠가 싫다 하면 안 붙일게. 아마도.”",
          choices: [
            {
              label: "붙여. 우리 집 맞아",
              intent: "tell her the shelter can feel like home",
              emotion: "warm",
              backgroundAssetKey: "shelterHomeCharmCg",
              reply: "“진짜? 오케이, 허가 받았다.”\n“그럼 여기 1호 장식임. 아빠도 나중에 불평 금지.”\n“...우리 집 맞다는 말, 좀 좋았다.”",
              effects: {
                trust: 0.03,
                storyFlags: ["shelter-home-charm-placed"]
              }
            },
            {
              label: "삐뚤어지면 내가 다시 붙일게",
              intent: "help her place the charm neatly",
              emotion: "warm",
              backgroundAssetKey: "shelterHomeCharmCg",
              reply: "“아, 그런 디테일 챙기는 거 진짜 아빠다.”\n“좋아. 그럼 나는 귀여움 담당, 아빠는 수평 담당.”\n“둘이 같이 붙이면 덜 망할 듯?”",
              effects: {
                trust: 0.02,
                storyFlags: ["shelter-home-charm-team"]
              }
            },
            {
              label: "통풍구만 막지 마",
              intent: "warn her to avoid blocking the shelter vents",
              emotion: "tired",
              backgroundAssetKey: "shelterHomeCharmCg",
              reply: "“알겠거든요. 나도 그 정도는 알아.”\n“근데 걱정하는 얼굴 좀 웃겼다. 완전 정비반장 아빠.”\n“통풍구 피해서 붙일게. 됐지?”",
              effects: {
                storyFlags: ["shelter-home-charm-careful"]
              }
            }
          ]
        }
      ]
    },
    {
      id: "shelter-first-night-brave-face-01",
      title: "첫날 밤의 괜찮은 척",
      once: true,
      completionFlag: "shelter-event:shelter-first-night-brave-face-01",
      trigger: {
        autoStart: true,
        requiredStoryFlag: "shelter-event:shelter-home-charm-01",
        missingStoryFlag: "shelter-event:shelter-first-night-brave-face-01"
      },
      backgroundAssetKey: "shelterHomeCharmCg",
      transitionLine: "조명이 어두워지고, 쉘터의 첫 밤이 시작된다.",
      transitionSeconds: 1.2,
      transitionEmotion: "anxious",
      startNodeId: "brave-face",
      nodes: [
        {
          id: "brave-face",
          emotion: "anxious",
          line: "“아빠, 나 지금 완전 괜찮은 얼굴 하고 있지?”\n“응. 아니, 사실 좀 아닌데. 그래도 괜찮은 척은 잘하지?”\n“밖에서 소리 날 때마다 심장 쿵 하는 거... 좀 짜증나.”",
          choices: [
            {
              label: "계속 들어준다",
              intent: "listen as she tries to keep herself together on the first night",
              emotion: "warm",
              nextNodeId: "stay-close"
            }
          ]
        },
        {
          id: "stay-close",
          emotion: "warm",
          line: "“근데 아빠 목소리 들리면 바로 좀 괜찮아져.”\n“그러니까 오늘은 멀리 가지 마.”\n“관리자라면서. 딸 관리도 해야지, 그치?”",
          choices: [
            {
              label: "안 가. 여기 있을게",
              intent: "promise to stay nearby through the night",
              emotion: "warm",
              backgroundAssetKey: "shelterHomeCharmCg",
              reply: "“좋아. 그 말 방금 저장했다?”\n“아빠가 여기 있다고 했으니까, 나도 오늘은 좀 잘 수 있을 듯.”",
              effects: {
                trust: 0.03,
                storyFlags: ["shelter-first-night-stayed"]
              }
            },
            {
              label: "무서우면 내 옆에 앉아",
              intent: "offer her a safe place beside you",
              emotion: "warm",
              backgroundAssetKey: "shelterHomeCharmCg",
              reply: "“헐, 바로 그렇게 말하기 있음?”\n“근데... 싫진 않음. 아니, 꽤 좋음.”\n“조금만 옆에 있을게. 진짜 조금만.”",
              effects: {
                trust: 0.04,
                storyFlags: ["shelter-first-night-close"]
              }
            },
            {
              label: "오늘은 아무것도 안 해도 돼",
              intent: "let her be just your daughter for the night",
              emotion: "tired",
              backgroundAssetKey: "shelterHomeCharmCg",
              reply: "“진짜? 나 오늘 쓸모 없어도 돼?”\n“그 말 좀 좋다. 완전 좋다.”\n“그럼 나 오늘은 아빠 딸 모드만 할래.”",
              effects: {
                trust: 0.03,
                storyFlags: ["shelter-first-night-rest"]
              }
            }
          ]
        }
      ]
    },
    {
      id: "shelter-first-night-still-there-01",
      title: "아빠 아직 있지?",
      once: true,
      completionFlag: "shelter-event:shelter-first-night-still-there-01",
      trigger: {
        autoStart: true,
        requiredStoryFlag: "shelter-event:shelter-first-night-brave-face-01",
        missingStoryFlag: "shelter-event:shelter-first-night-still-there-01"
      },
      backgroundAssetKey: "shelterHomeCharmCg",
      transitionLine: "쉘터 안이 조용해지고, 잠들기 전의 시간이 천천히 온다.",
      transitionSeconds: 1.2,
      transitionEmotion: "anxious",
      choiceReactionSeconds: 0.58,
      startNodeId: "still-there",
      nodes: [
        {
          id: "still-there",
          emotion: "anxious",
          line: "“아빠, 나 지금 자는 척 연습 중인데.”\n“근데 있잖아. 내가 눈 감으면...”\n“아빠 목소리 안 없어지지?”",
          choices: [
            {
              label: "안 없어져. 여기 있어",
              intent: "promise that your voice will stay with her",
              emotion: "warm",
              backgroundAssetKey: "shelterHomeCharmCg",
              reply: "“좋아. 그거면 됐어.”\n“나 지금 좀 안심함. 아니, 많이.”\n“그럼 나 눈 감는다? 진짜 감는다?”",
              effects: {
                trust: 0.03,
                storyFlags: ["shelter-first-night-voice-stayed"]
              }
            },
            {
              label: "눈 감고 있으면 내가 확인할게",
              intent: "watch over her while she tries to sleep",
              emotion: "warm",
              backgroundAssetKey: "shelterHomeCharmCg",
              reply: "“와, 그거 완전 아빠 서비스네.”\n“좋아. 그럼 나 자는 척 말고 진짜 자볼게.”\n“중간에 깨면... 그때도 있어야 됨.”",
              effects: {
                trust: 0.04,
                storyFlags: ["shelter-first-night-watched-over"]
              }
            },
            {
              label: "무서우면 불 조금 켜둘게",
              intent: "leave a small light on so she feels safer",
              emotion: "warm",
              backgroundAssetKey: "shelterHomeCharmCg",
              reply: "“나 애는 아닌데.”\n“근데 오늘은 예외. 조금만 켜두자.”\n“아빠가 그렇게 말하면... 이상하게 덜 창피함.”",
              effects: {
                trust: 0.02,
                storyFlags: ["shelter-first-night-light-left-on"]
              }
            }
          ]
        }
      ]
    }
  ]
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
      },
      {
        "id": "from-shelter",
        "label": "피난처 복귀",
        "x": 744,
        "y": BASE_PLAYER_SPAWN.y,
        "facing": 1
      }
    ],
    "routeExits": [
      {
        "id": "to-shelter",
        "kind": "shelter",
        "type": "shelter",
        "label": "피난처",
        "x": 652,
        "y": 1792,
        "width": 120,
        "height": 192,
        "prompt": "D/Z: 피난처",
        "toLevelId": "shelter-hub-01",
        "toEntranceId": "start",
        "returnEntranceId": "from-shelter"
      },
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
    "vaultDoors": [
      {
        "id": "vault-door-test-01",
        "label": "Supply Vault",
        "x": 1936,
        "y": 1664,
        "width": 112,
        "height": 144,
        "prompt": "Up: Hack vault",
        "duration": 45
      }
    ],
    "vaultLoot": [
      {
        "id": "vault-loot-test-01",
        "label": "Cells",
        "x": 2072,
        "y": 1748,
        "width": 46,
        "height": 46,
        "value": 35,
        "prompt": "Up: Take supplies"
      },
      {
        "id": "vault-loot-test-02",
        "label": "Parts",
        "x": 2140,
        "y": 1748,
        "width": 46,
        "height": 46,
        "value": 45,
        "prompt": "Up: Take supplies"
      },
      {
        "id": "vault-loot-test-03",
        "label": "Core",
        "x": 2208,
        "y": 1748,
        "width": 46,
        "height": 46,
        "value": 80,
        "prompt": "Up: Take supplies"
      }
    ],
    "escapeExits": [
      {
        "id": "escape-exit-test-01",
        "label": "Emergency Exit",
        "x": 928,
        "y": 1648,
        "width": 112,
        "height": 192,
        "prompt": "Up: Escape"
      }
    ],
    "escapeBarriers": [
      {
        "id": "escape-barrier-test-01",
        "label": "Emergency Shutter",
        "x": 1784,
        "y": 1680,
        "width": 40,
        "height": 160,
        "trigger": "vaultEscape",
        "color": "#ff7a66"
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
  "shelter-hub-01": {
    "id": "shelter-hub-01",
    "label": "피난처 허브 01",
    "world": {
      "mode": "shelter",
      "width": 1280,
      "height": 720,
      "gravity": 2350,
      "groundY": 640,
      "duskAt": 90,
      "nightAt": 150,
      "sanityDrain": {
        "day": 0,
        "dusk": 0,
        "night": 0
      },
      "startMessage": "피난처 폐쇄.",
      "startClueLog": [
        "비상 피난처 안에서는 시간이 하루 흐른다.",
        "촬영한 CG 일러스트는 기록에 보관된다."
      ],
      "labObjectives": [
        "휴게",
        "CG 기록",
        "배경 감상"
      ],
      "camera": {
        "zoom": 1,
        "minZoom": 0.88,
        "lookAheadEnabled": false,
        "neutralFocusX": 0.5,
        "neutralFocusY": 0.5,
        "boundarySlackY": 0,
        "boundarySlackX": 0
      }
    },
    "player": {
      "spawn": {
        "x": 590,
        "y": 552
      }
    },
    "entrances": [
      {
        "id": "start",
        "label": "피난처 문",
        "x": 590,
        "y": 552,
        "facing": 1
      }
    ],
    "routeExits": [],
    "map": {
      "rooms": [
        {
          "id": "hub",
          "label": "피난처",
          "x": 110,
          "y": 132,
          "width": 170,
          "height": 92
        }
      ]
    },
    "extractionGate": null,
    "platforms": [
      {
        "x": 0,
        "y": 632,
        "width": 1280,
        "height": 88,
        "color": "#40515a"
      }
    ],
    "temporaryBlocks": [],
    "zipLineNodes": [],
    "zipLines": [],
    "props": [],
    "braceWalls": [],
    "humanoidEnemies": [],
    "hostileDrones": [],
    "lootCrates": []
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
      "prompt": "D: 추출"
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
      id: "shelter-hub-01",
      levelId: "shelter-hub-01",
      x: 110,
      y: 132,
      width: 170,
      height: 92,
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
      id: "movement-to-shelter",
      fromLevelId: "movement-lab-01",
      toLevelId: "shelter-hub-01",
      routeId: "to-shelter",
    },
    {
      id: "movement-to-faceoff",
      fromLevelId: "movement-lab-01",
      toLevelId: "faceoff-checkpoint-01",
      routeId: "to-faceoff-checkpoint",
    },
  ],
};
