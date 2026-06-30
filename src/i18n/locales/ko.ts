export const ko = {
  meta: {
    locale: "ko-KR",
  },
  common: {
    appName: "넷핵 3D",
    confirm: "확인",
    cancel: "취소",
    close: "닫기",
    back: "뒤로",
    yes: "예",
    no: "아니요",
    delete: "삭제",
    edit: "편집",
    done: "완료",
    resetToDefaults: "기본값으로 재설정",
    later: "나중에",
    checking: "확인 중...",
    downloading: "다운로드 중...",
    canceling: "취소 중...",
    none: "없음",
    off: "끔",
    normal: "일반",
    fps: "1인칭",
  },
  controller: {
    groups: {
      movement: "이동",
      lookAndCamera: "시점 및 카메라",
      actions: "동작",
      dialogs: "대화상자",
      system: "시스템",
    },
    actions: {
      dpad_up: {
        label: "방향 패드 위",
        description: "대화상자와 이동 하이라이트에서 위로 이동합니다.",
      },
      dpad_down: {
        label: "방향 패드 아래",
        description: "대화상자와 이동 하이라이트에서 아래로 이동합니다.",
      },
      dpad_left: {
        label: "방향 패드 왼쪽",
        description: "대화상자와 이동 하이라이트에서 왼쪽으로 이동합니다.",
      },
      dpad_right: {
        label: "방향 패드 오른쪽",
        description: "대화상자와 이동 하이라이트에서 오른쪽으로 이동합니다.",
      },
      left_stick_up: {
        label: "왼쪽 스틱 위",
        description: "이동 하이라이트와 가상 커서를 위로 이동합니다.",
      },
      left_stick_down: {
        label: "왼쪽 스틱 아래",
        description: "이동 하이라이트와 가상 커서를 아래로 이동합니다.",
      },
      left_stick_left: {
        label: "왼쪽 스틱 왼쪽",
        description: "이동 하이라이트와 가상 커서를 왼쪽으로 이동합니다.",
      },
      left_stick_right: {
        label: "왼쪽 스틱 오른쪽",
        description: "이동 하이라이트와 가상 커서를 오른쪽으로 이동합니다.",
      },
      right_stick_up: {
        label: "오른쪽 스틱 위",
        description: "시점 이동, 카메라 이동, 대화상자 스크롤을 위로 수행합니다.",
      },
      right_stick_down: {
        label: "오른쪽 스틱 아래",
        description: "시점 이동, 카메라 이동, 대화상자 스크롤을 아래로 수행합니다.",
      },
      right_stick_left: {
        label: "오른쪽 스틱 왼쪽",
        description: "시점과 카메라를 왼쪽으로 이동합니다.",
      },
      right_stick_right: {
        label: "오른쪽 스틱 오른쪽",
        description: "시점과 카메라를 오른쪽으로 이동합니다.",
      },
      confirm: {
        label: "확인 / 클릭",
        description: "이동을 확정하고 대화상자에서 클릭합니다.",
      },
      search: {
        label: "탐색",
        description: "이동 미리보기가 없을 때 현재 타일을 탐색합니다.",
      },
      cancel_or_context: {
        label: "취소 / 상황별 메뉴",
        description: "상황별 동작을 열거나 현재 대화상자를 취소합니다.",
      },
      action_menu: {
        label: "동작 메뉴",
        description: "컨트롤러 원형 동작 메뉴를 엽니다.",
      },
      run_modifier: {
        label: "달리기 보조키",
        description: "누르고 있으면 이동 전에 달리기 접두어를 보냅니다.",
      },
      zoom_in: {
        label: "확대/축소(홀드)",
        description:
          "누른 상태에서 왼쪽 스틱 위/아래로 줌하고, 오른쪽 스틱으로 카메라를 회전합니다.",
      },
      recenter_camera: {
        label: "카메라 중심 복귀",
        description: "카메라를 플레이어 중심으로 되돌립니다.",
      },
      toggle_large_minimap: {
        label: "대형 미니맵 전환",
        description: "아주 큰 미니맵 크기를 전환합니다.",
      },
      pause_menu: {
        label: "일시정지 메뉴",
        description: "일시정지 메뉴를 열거나 닫습니다.",
      },
      open_inventory: {
        label: "인벤토리",
        description: "인벤토리 창을 엽니다.",
      },
      open_character: {
        label: "캐릭터 시트",
        description: "캐릭터 시트 창을 엽니다.",
      },
    },
    buttonLabels: {
      0: "A 버튼",
      1: "B 버튼",
      2: "X 버튼",
      3: "Y 버튼",
      4: "왼쪽 범퍼",
      5: "오른쪽 범퍼",
      6: "왼쪽 트리거",
      7: "오른쪽 트리거",
      8: "뒤로 / 보기",
      9: "시작 / 메뉴",
      10: "왼쪽 스틱 클릭",
      11: "오른쪽 스틱 클릭",
      12: "방향 패드 위",
      13: "방향 패드 아래",
      14: "방향 패드 왼쪽",
      15: "방향 패드 오른쪽",
      16: "홈 버튼",
    },
    axisLabels: {
      0: "왼쪽 스틱 X",
      1: "왼쪽 스틱 Y",
      2: "오른쪽 스틱 X",
      3: "오른쪽 스틱 Y",
    },
    directions: {
      leftStickLeft: "왼쪽 스틱 왼쪽",
      leftStickRight: "왼쪽 스틱 오른쪽",
      leftStickUp: "왼쪽 스틱 위",
      leftStickDown: "왼쪽 스틱 아래",
      rightStickLeft: "오른쪽 스틱 왼쪽",
      rightStickRight: "오른쪽 스틱 오른쪽",
      rightStickUp: "오른쪽 스틱 위",
      rightStickDown: "오른쪽 스틱 아래",
    },
    unbound: "할당 안 됨",
    axisFallback: (axisIndex: number) => `축 ${axisIndex}`,
    buttonFallback: (buttonIndex: number) => `버튼 ${buttonIndex}`,
    slotLabel: (slotIndex: number) => `슬롯 ${slotIndex + 1}`,
    listening: "입력을 누르세요...",
    clear: "지우기",
    controllerDetected: (count: number) =>
      `컨트롤러 ${count}개가 감지되었습니다.`,
    noControllerDetected: "감지된 컨트롤러가 없습니다.",
  },
  startupInitOptions: {
    accordion: {
      summary: "초기화 옵션(선택 사항)",
      description:
        "시작 시 적용할 추가 NetHack `OPTIONS` 항목입니다. 윈도 포트 및 플랫폼 전용 옵션은 의도적으로 제외되어 있습니다.",
      resetToDefaults: "기본값으로 재설정",
    },
    options: {
      playmode: {
        label: "플레이 모드",
        description:
          "시작 모드를 선택합니다. Wizard 모드는 NetHack 디버그 모드입니다(`playmode:debug`).",
        options: {
          normal: "일반",
          explore: "탐험",
          debug: "위저드/디버그",
        },
      },
      number_pad: {
        label: "이동 키",
        description:
          "NetHack 이동에 숫자 키패드(`number_pad:1`)를 사용할지, 전통적인 vi 키(`number_pad:0`)를 사용할지 선택합니다.",
        options: {
          numeric: "숫자 키패드",
          vi: "vi 키",
        },
      },
      autopickup: {
        label: "자동 줍기",
        description:
          "줍기 유형에서 선택한 아이템 종류를 자동으로 줍습니다.",
      },
      pickup_types: {
        label: "줍기 유형",
        description:
          '자동으로 주울 물체 종류 기호입니다(예: $"=/!?+). 비워 두면 게임 기본값을 사용합니다.',
        placeholder: '예: $"=/!?+',
      },
      pickup_thrown: {
        label: "던진 아이템 줍기",
        description: "던진 아이템이 떨어지면 자동으로 줍습니다.",
      },
      pickup_burden: {
        label: "줍기 부담 한계",
        description:
          "이 부담 수준을 넘기게 되면 줍기 전에 확인을 표시합니다.",
        options: {
          u: "무부담 (u)",
          b: "부담됨 (b)",
          s: "압박됨 (s)",
          n: "과중함 (n)",
          t: "심한 과중 (t)",
          l: "과적 (l)",
        },
      },
      pile_limit: {
        label: "더미 한도",
        description:
          "바닥 더미를 팝업 목록으로 표시할 아이템 수 기준입니다.",
      },
      autoquiver: {
        label: "자동 화살통",
        description: "발사 시 화살통을 자동으로 채우거나 적절한 무기를 준비합니다.",
      },
      autoopen: {
        label: "자동 문열기",
        description: "문 쪽으로 이동할 때 자동으로 열기를 시도합니다.",
      },
      autodig: {
        label: "자동 파기",
        description:
          "가능할 때 벽 쪽으로 이동하면 자동으로 파고듭니다.",
      },
      cmdassist: {
        label: "명령 보조",
        description: "명령을 잘못 입력했을 때 추가 도움말을 표시합니다.",
      },
      confirm: {
        label: "공격 확인",
        description: "평화적인 생물을 공격하기 전에 묻습니다.",
      },
      safe_pet: {
        label: "반려동물 보호",
        description: "반려동물을 때리기 전에 묻습니다.",
      },
      help: {
        label: "게임 내 도움말",
        description:
          "추가 정보가 있을 때 더 자세한 살펴보기/도움말 정보를 표시하도록 안내합니다.",
      },
      legacy: {
        label: "레거시 인트로",
        description: "새 게임을 시작할 때 이야기 인트로를 표시합니다.",
      },
      rest_on_space: {
        label: "스페이스로 휴식",
        description: "스페이스 키를 대기/휴식으로 처리합니다.",
      },
      pushweapon: {
        label: "무기 밀어내기",
        description: "교체할 때 현재 휘두르는 무기를 보조 손으로 옮깁니다.",
      },
      extmenu: {
        label: "확장 명령 메뉴",
        description: "확장 명령에 팝업 메뉴를 사용합니다.",
      },
      fixinv: {
        label: "인벤토리 문자 고정",
        description: "아이템이 이동해도 인벤토리 문자를 유지하려고 시도합니다.",
      },
      implicit_uncursed: {
        label: "무저주 표시",
        description:
          "인벤토리 설명에 항상 'uncursed' 상태를 포함합니다.",
      },
      mention_walls: {
        label: "벽 알림",
        description: "벽을 향해 이동할 때 메시지를 표시합니다.",
      },
      sortloot: {
        label: "전리품 목록 정렬",
        description:
          "줍기 및 인벤토리 선택 목록의 정렬 방식입니다.",
        options: {
          f: "전체",
          l: "전리품만",
          n: "없음",
        },
      },
      sortpack: {
        label: "인벤토리 정렬",
        description: "인벤토리를 표시할 때 소지품을 종류별로 정렬합니다.",
      },
      msghistory: {
        label: "메시지 기록 크기",
        description: "다시 확인할 수 있도록 유지할 상단 메시지 수입니다.",
      },
      dogname: {
        label: "개 이름",
        description: "첫 번째 개의 기본 이름입니다.",
        placeholder: "바둑이",
      },
      catname: {
        label: "고양이 이름",
        description: "첫 번째 고양이의 기본 이름입니다.",
        placeholder: "나비",
      },
      horsename: {
        label: "말 이름",
        description: "첫 번째 말의 기본 이름입니다.",
        placeholder: "은별",
      },
      pettype: {
        label: "선호 반려동물",
        description: "선택 가능한 역할에서 선호하는 초기 반려동물 종류입니다.",
        options: {
          default: "게임 기본값",
          cat: "고양이",
          dog: "개",
          horse: "말",
          none: "없음",
        },
      },
      fruit: {
        label: "선호 과일",
        description: "캐릭터가 좋아하는 과일 종류의 이름입니다.",
        placeholder: "슬라임 몰드",
      },
      packorder: {
        label: "소지품 순서",
        description: "인벤토리에 표시할 아이템 종류의 순서입니다.",
        placeholder: '예: ")[%?+/=!(*0_`',
      },
      paranoid_confirmation: {
        label: "신중 확인",
        description:
          "공백으로 구분한 추가 확인 목록입니다(예: confirm quit attack pray).",
        placeholder: "예: confirm quit attack pray",
      },
      sparkle: {
        label: "마법 저항 반짝임",
        description: "마법 저항에 특수 반짝임 효과를 표시합니다.",
      },
      standout: {
        label: "강조 몬스터/More",
        description: "몬스터와 --More-- 프롬프트를 굵게 표시합니다.",
      },
      tombstone: {
        label: "묘비",
        description: "죽었을 때 묘비 그래픽을 표시합니다.",
      },
      verbose: {
        label: "자세한 메시지",
        description: "상태 및 동작 메시지를 더 자세한 문구로 표시합니다.",
      },
    },
  },
  soundEffects: {
    byKey: {
      "player-walk": "플레이어 걷기",
      hit: "타격",
      "monster-killed": "몬스터 처치(플레이어)",
      "monster-killed-other": "몬스터 처치(기타)",
      "missed-attack": "공격 빗나감",
      "thrown-weapon": "던진 무기",
      "door-opens": "문 열림",
      "door-closes": "문 닫힘",
      "door-kick": "문 발차기",
      "door-smash": "문 부수기",
      "door-resists": "문이 버팀",
      "door-distant": "멀리 있는 문",
      "walk-down-stairs": "계단 내려가기",
      "walk-up-stairs": "계단 올라가기",
      eating: "먹기",
      drink: "마시기",
      "quaff-potion": "물약 마시기",
      "pickup-gold": "금 줍기",
      "pickup-item": "아이템 줍기",
      "find-hidden": "숨겨진 문/통로 발견",
      "level-up": "레벨 상승",
      unlock: "잠금 해제",
      "boulder-push": "바위 밀기",
      "boulder-blocked": "바위가 막힘",
      splash: "첨벙",
      searching: "탐색 중",
      "magic-cast": "마법 시전",
      "magic-heal": "마법 치유",
      "magic-buff": "마법 강화",
    },
  },
  characterSheet: {
    titleFallback: "캐릭터 시트",
    sectionTitles: {
      overview: "개요",
      background: "배경",
      basics: "기본 정보",
      characteristics: "현재 특성",
      status: "현재 상태",
      attributes: "현재 능력치",
    },
    statLabels: {
      strength: "힘",
      dexterity: "민첩",
      constitution: "체력",
      intelligence: "지능",
      wisdom: "지혜",
      charisma: "매력",
    },
    commands: {
      enhance: {
        label: "강화",
        detail: "기술 레벨 올리기",
      },
      conduct: {
        label: "행동 규율",
        detail: "도전 진행 상황 보기",
      },
      overview: {
        label: "개요",
        detail: "던전 진행 상황 보기",
      },
      spells: {
        label: "주문",
        detail: "배운 주문 확인",
      },
      seespells: {
        label: "주문서",
        detail: "주문 인벤토리 보기",
      },
      technique: {
        label: "Technique",
        detail: "역할/종족 능력 사용",
      },
      known: {
        label: "발견 목록",
        detail: "알려진 물체 목록",
      },
      pray: {
        label: "기도",
        detail: "기도 시도",
      },
    },
  },
  castMenu: {
    schoolLabel: "학파:",
    headings: {
      name: "이름",
      level: "레벨",
      category: "분류",
      fail: "실패",
      retention: "유지",
    },
    summary: {
      known: (count: number) => `알고 있는 주문 ${count}개`,
      castable: (count: number) => `시전 가능 ${count}개`,
      bestSuccess: (percent: number) => `최고 성공률 ${percent}%`,
      averageFail: (percent: number) => `평균 실패율 ${percent}%`,
      schoolCount: (count: number) =>
        `학파 ${count}개`,
    },
    retention: {
      unknown: "알 수 없음",
      gone: "소실",
      full: "완전",
    },
  },
  enhanceMenu: {
    defaultGroupTitle: "기술",
    availability: {
      available_now: "사용 가능",
      needs_experience: "경험치/슬롯 필요",
      needs_practice: "연습 필요",
      maxed_out: "최대",
    },
    summary: {
      available: (count: number) => `사용 가능 ${count}개`,
      gated: (count: number) => `경험치/슬롯 부족 ${count}개`,
      practice: (count: number) => `연습 필요 ${count}개`,
      maxed: (count: number) => `최대치 ${count}개`,
    },
    maxLabel: "최대",
    slotCount: (count: number) => `슬롯 ${count}개`,
  },
  app: {
    unknownTime: "알 수 없는 시간",
    debugSession: {
      possibleCrash: "충돌 가능성",
      active: "활성",
    },
    debugLogs: {
      buildLabelAria: (
        buildLabel: string,
        currentCount: number,
        requiredCount: number,
      ) =>
        `빌드 ${buildLabel}. 숨겨진 디버그 로그 전환 진행도 ${currentCount}/${requiredCount}.`,
      enabledToast: "디버그 로그 활성화됨",
      enabledLogEntry: "시작 화면 빌드 라벨 이스터에그로 디버그 로그가 활성화되었습니다.",
      openLink: "디버그 로그 보기",
      clearedLogEntry: "저장된 디버그 로그를 사용자가 지웠습니다.",
    },
    statusEffects: {
      turningToStone: "석화 진행 중",
      slimed: "점액 오염",
      strangled: "질식",
      foodPoisoning: "식중독",
      terminallyIll: "치명적 질병",
      blind: "실명",
      deaf: "청각 상실",
      stunned: "기절",
      confused: "혼란",
      hallucinating: "환각",
      levitating: "부유",
      flying: "비행",
      riding: "탑승 중",
      barehanded: "맨손",
      busy: "행동 중",
      iron: "철구속",
      glowingHands: "빛나는 손",
      grabbed: "붙잡힘",
      held: "구속됨",
      icy: "얼어붙음",
      inLava: "용암 속",
      paralyzed: "마비",
      sleeping: "수면",
      slippery: "미끄러움",
      submerged: "잠수",
      tethered: "묶임",
      trapped: "함정에 걸림",
      unconscious: "의식 불명",
      woundedLegs: "다리 부상",
      holding: "붙잡는 중",
    },
    characterStats: {
      descriptions: {
        strength:
          "근접 공격 피해, 소지 한도, 강행 행동에 영향을 줍니다.",
        dexterity:
          "명중률, 함정 상호작용, 방어 민첩성에 영향을 줍니다.",
        constitution:
          "HP 증가량과 독 및 흡수 효과 저항에 영향을 줍니다.",
        intelligence:
          "읽기와 여러 주문 관련 행동의 성공률에 영향을 줍니다.",
        wisdom: "주문 에너지 증가와 주문 시전 안정성에 영향을 줍니다.",
        charisma:
          "상점 상호작용, 반려동물 다루기, 사회적 결과에 영향을 줍니다.",
      },
      armorClassDescription:
        "낮을수록 좋습니다. 방어도는 적이 당신을 맞힐 확률을 낮춥니다.",
    },
    directionHelp: {
      controller:
        "방향을 클릭하거나 왼쪽 스틱/방향 패드로 미리 본 뒤 놓아서 확정하세요. 가운데 원은 자신을 대상으로 합니다. 계단은 < 또는 > 를 사용하세요. 취소하려면 ESC를 누르세요.",
      numpad:
        "방향을 클릭하세요. 가운데 원은 자신을 대상으로 합니다. 숫자패드(1-4,6-9), 방향키, <, > 또는 s도 사용할 수 있습니다. 취소하려면 ESC를 누르세요.",
      viKeys:
        "방향을 클릭하세요. 가운데 원은 자신을 대상으로 합니다. hjkl/yubn, 방향키, <, > 또는 s도 사용할 수 있습니다. 취소하려면 ESC를 누르세요.",
      fps: "시선을 돌려 조준하세요. 왼쪽 클릭 또는 W로 확정합니다. S는 자신을 대상으로 합니다. A/D 또는 오른쪽 클릭은 취소입니다.",
    },
    inventoryContextActions: {
      apply: "사용",
      invoke: "발동",
      tip: "기울이기",
      loot: "획득",
      drop: "떨구기",
      eat: "먹기",
      quaff: "마시기",
      read: "읽기",
      rub: "문지르기",
      throw: "던지기",
      wield: "장비",
      quiver: "화살통에 넣기",
      wear: "착용",
      takeOff: "벗기",
      putOn: "장착",
      remove: "해제",
      zap: "마법봉 사용",
      untrap: "함정 해제",
      offer: "바치기",
      name: "이름 짓기",
      call: "별칭 붙이기",
      adjust: "정리",
      engrave: "새기기",
      dip: "담그기",
      info: "정보",
      unwield: "장비 해제",
    },
    mobileActions: {
      wait: "대기",
      zap: "마법봉 사용",
      cast: "시전",
      kick: "발차기",
      read: "읽기",
      quaff: "마시기",
      eat: "먹기",
      glance: "흘깃 보기",
      loot: "획득",
      open: "열기",
      wield: "장비",
      wear: "착용",
      putOn: "장착",
      takeOff: "벗기",
      extended: "확장",
    },
    clientOptions: {
      config: {
        groupControls: "컨트롤러 및 1인칭 모드",
        sectionControlsController: "컨트롤러",
        controllerEnabled: {
          label: "컨트롤러 지원 사용",
          description: "게임플레이와 UI 대화상자에서 게임패드 입력을 사용합니다.",
        },
        sectionControlsLook: "시점 및 카메라",
        invertLookYAxis: {
          label: "Y축 시점 반전",
          description: "수직 마우스 시점과 터치 시점 방향을 반전합니다.",
        },
        fpsLookSensitivityX: {
          label: "1인칭 시점 감도 X",
          description: "가로 마우스 시점/터치 시점 감도입니다.",
        },
        fpsLookSensitivityY: {
          label: "1인칭 시점 감도 Y",
          description: "세로 마우스 시점/터치 시점 감도입니다.",
        },
        snapCameraYawToNearest45: {
          label: "카메라 요를 45도로 스냅",
          description:
            "카메라 회전 입력을 놓으면 요를 가장 가까운 45도 각도로 부드럽게 맞춥니다.",
        },
        sectionControlsMovement: "이동 동작",
        cameraRelativeMovement: {
          label: "카메라 기준 이동 및 스와이프",
          description:
            "카메라 Y축 각도에 따라 이동 키와 스와이프 방향을 회전합니다.",
        },
        fpsWasdKeyboardMovementEnabled: {
          label: "1\uc778\uce6d \ubaa8\ub4dc\uc5d0\uc11c WASD \ud0a4\ubcf4\ub4dc \uc774\ub3d9 \uc0ac\uc6a9",
          description:
            "1\uc778\uce6d \uc774\ub3d9\uc5d0 W/A/S/D\ub97c \uc0ac\uc6a9\ud569\ub2c8\ub2e4. \ub044\uba74 \uc774 \ud0a4\ub4e4\uc774 \uc77c\ubc18 NetHack \uba85\ub839\ucc98\ub7fc \ub3d9\uc791\ud569\ub2c8\ub2e4.",
        },
        controllerFpsMoveRepeatMs: {
          label: "1인칭 왼쪽 스틱 이동 반복",
          description:
            "1인칭 모드에서 왼쪽 스틱 이동 반복 지연입니다(낮을수록 빠름).",
        },
        groupInterface: "인터페이스",
        locale: {
          label: "언어",
          description:
            "인터페이스 언어를 선택합니다. 지원되는 경우 브라우저 지역을 기본으로 사용하며, 지원되지 않으면 영어로 돌아갑니다.",
          options: {
            en: "영어",
          },
        },
        sectionDisplayCamera: "카메라 및 시점",
        fpsMode: {
          label: "1인칭 모드",
          description: "1인칭 조작과 마우스 시점을 사용합니다.",
        },
        fpsFlattenEntityBillboards: {
          label: "겹치는 타일 스프라이트 평면화",
          description:
            "몬스터, 반려동물, 플레이어가 올라서면 전리품이나 던전 요소 타일 스프라이트를 평면화합니다. 끄면 겹치는 스프라이트를 세워진 빌보드로 유지합니다. Vulture 타일은 항상 세워진 상태를 유지합니다.",
        },
        fpsHeldWeaponVisible: {
          label: "FPS 무기 표시",
          description: "1인칭 모드에서 손에 든 무기 스프라이트를 표시합니다.",
        },
        showItemsUnderPlayerInOverheadTilesMode: {
          label: "상단 타일 모드에서 플레이어 아래 아이템 표시",
          description:
            "상단 타일 모드에서 런타임 언더레이 글리프 데이터를 사용해 플레이어 아래의 아이템과 바닥 요소를 표시합니다.",
        },
        fpsFov: {
          label: "1인칭 시야각",
          description: "1인칭 카메라 시야각을 조정합니다.",
        },
        sectionDisplayGraphics: "그래픽 및 렌더링",
        tilesetMode: {
          label: "표시 방식",
          description: "ASCII 대신 그래픽 타일을 사용합니다.",
          options: {
            ascii: "문자",
            tiles: "타일",
          },
        },
        tilesetPath: {
          label: "타일셋",
          description: "내장 및 업로드한 타일셋입니다.",
        },
        antialiasing: {
          label: "안티앨리어싱",
          description: "3D 렌더링용 가장자리 부드럽게 처리 모드입니다.",
          options: {
            taa: "시간 축 안티앨리어싱",
            fxaa: "빠른 근사 안티앨리어싱",
          },
        },
        lightingEnabled: {
          label: "조명",
          description:
            "동적 장면 조명과 던전 어둡게 하기를 활성화합니다. 끄면 항상 밝은 평면 렌더링이 됩니다.",
        },
        blockAmbientOcclusion: {
          label: "앰비언트 오클루전",
          description:
            "바닥과 벽 블록 사이에 은은한 접촉 그림자를 추가합니다.",
        },
        brightness: {
          label: "밝기",
          description: "장면 전체 밝기를 조정합니다.",
        },
        contrast: {
          label: "대비",
          description: "렌더링된 장면의 전체 대비를 조정합니다.",
        },
        gamma: {
          label: "감마",
          description: "렌더링된 장면의 표시 감마를 조정합니다.",
        },
        sectionDisplayInterface: "인터페이스",
        uiFontScale: {
          label: "UI 글꼴 크기",
          description: "모든 게임 UI 글꼴 크기를 기본값에서 조정합니다.",
        },
        disableAnimatedTransitions: {
          label: "애니메이션 전환 끄기",
          description:
            "더 즉각적인 UI 변경을 위해 인터페이스 페이드, 모션, 전환 애니메이션을 끕니다.",
        },
        uiTileBackgroundRemoval: {
          label: "UI에서 타일 배경 제거",
          description:
            "UI 패널에 표시되는 타일 아이콘에 타일/크로마 배경 제거를 적용합니다.",
        },
        desktopTouchInterfaceMode: {
          label: "데스크톱 터치 인터페이스",
          description:
            "데스크톱에 터치 조작을 표시하고 세로 또는 가로 레이아웃을 선택합니다.",
          options: {
            off: "끔",
            portrait: "세로형 터치 UI 사용",
            landscape: "가로형 터치 UI 사용",
          },
        },
        sectionDisplayMessages: "메시지 및 로그",
        desktopMessageLogWindowScale: {
          label: "데스크톱 메시지 로그 창 크기",
          description:
            "글꼴 크기를 바꾸지 않고 데스크톱 메시지 로그 창 크기를 조정합니다.",
        },
        liveMessageLog: {
          label: "실시간 메시지 로그",
          description: "스크롤되는 게임 내 메시지 로그를 표시합니다.",
        },
        showPersistentMobileMessageLog: {
          label: "\uc9c0\uc18d \uba54\uc2dc\uc9c0 \ub85c\uadf8 \ud45c\uc2dc",
          description:
            "\uac8c\uc784 \uc911 \ucef4\ud329\ud2b8 \ubaa8\ubc14\uc77c \uba54\uc2dc\uc9c0 \ub85c\uadf8\ub97c \uacc4\uc18d \ud45c\uc2dc\ud569\ub2c8\ub2e4. \ub85c\uadf8 \ubc84\ud2bc\uc73c\ub85c \ub354 \ud070 \ub85c\uadf8\ub97c \uc5f4 \uc218 \uc788\uc2b5\ub2c8\ub2e4.",
        },
        rumbleEnabled: {
          label: "\uc9c4\ub3d9 \uc0ac\uc6a9",
          description:
            "\uc9c0\uc6d0\ub418\ub294 \ubaa8\ubc14\uc77c \uae30\uae30\uc5d0\uc11c \uac00\ud55c \ud53c\ud574\uc640 \ubc1b\uc740 \ud53c\ud574\uc5d0 \uc9e7\uc740 \ud584\ud2f1 \uc9c4\ub3d9 \ud53c\ub4dc\ubc31\uc744 \uc0ac\uc6a9\ud569\ub2c8\ub2e4.",
        },
        sectionMobileSafeZone: "\ubaa8\ubc14\uc77c \uc548\uc804 \uc601\uc5ed",
        manualMobileBottomSafeZoneEnabled: {
          label: "\uac10\uc9c0\ub41c \ubaa8\ubc14\uc77c \uc548\uc804 \uc601\uc5ed \uc7ac\uc815\uc758",
          description:
            "Android \ud734\ub300\uc6a9 \uae30\uae30\uac00 \uc548\uc804 \uc601\uc5ed\uc744 \uc798\ubabb \ubcf4\uace0\ud560 \ub54c \uc218\ub3d9 \uc548\uc804 \uc601\uc5ed \uc5ec\ubc31\uc744 \uc0ac\uc6a9\ud569\ub2c8\ub2e4.",
        },
        manualMobileBottomSafeZoneVerticalPx: {
          label: "\uc138\ub85c \ubc29\ud5a5 \ud558\ub2e8 \uc548\uc804 \uc601\uc5ed",
          description:
            "\uc138\ub85c \ubaa8\ubc14\uc77c \ub808\uc774\uc544\uc6c3\uc5d0 \uc0ac\uc6a9\ud560 \uc218\ub3d9 \ud558\ub2e8 \uc548\uc804 \uc601\uc5ed\uc785\ub2c8\ub2e4.",
        },
        manualMobileBottomSafeZoneHorizontalPx: {
          label: "\uac00\ub85c \ubc29\ud5a5 \ud558\ub2e8 \uc548\uc804 \uc601\uc5ed",
          description:
            "\uac00\ub85c \ubaa8\ubc14\uc77c \ub808\uc774\uc544\uc6c3\uc5d0 \uc0ac\uc6a9\ud560 \uc218\ub3d9 \ud558\ub2e8 \uc548\uc804 \uc601\uc5ed\uc785\ub2c8\ub2e4.",
        },
        manualMobileRightSafeZoneHorizontalPx: {
          label: "\uac00\ub85c \ubc29\ud5a5 \uc624\ub978\ucabd \uc548\uc804 \uc601\uc5ed",
          description:
            "\uac00\ub85c \ubaa8\ubc14\uc77c \ub808\uc774\uc544\uc6c3\uc5d0 \uc0ac\uc6a9\ud560 \uc218\ub3d9 \uc624\ub978\ucabd \uc548\uc804 \uc601\uc5ed\uc785\ub2c8\ub2e4.",
        },
        manualMobileBottomSafeZonePreview: "\ud558\ub2e8 \uc548\uc804 \uc601\uc5ed",
        manualMobileRightSafeZonePreview: "\uc624\ub978\ucabd \uc548\uc804 \uc601\uc5ed",
        liveMessageDisplayTimeMs: {
          label: "실시간 메시지 표시 시간",
          description:
            "떠 있는 메시지가 사라지기 전에 완전히 보이는 시간입니다.",
        },
        liveMessageFadeOutTimeMs: {
          label: "실시간 메시지 페이드아웃 시간",
          description: "떠 있는 메시지 페이드아웃 애니메이션 길이입니다.",
        },
        liveMessageLogFontScale: {
          label: "실시간 메시지 글꼴 크기",
          description:
            "떠오르는 액션 메시지의 글꼴 크기를 기본값에서 조정합니다.",
        },
        sectionDisplayMinimap: "미니맵",
        minimap: {
          label: "미니맵",
          description: "던전 미니맵을 표시하거나 숨깁니다.",
        },
        minimapScale: {
          label: "미니맵 크기",
          description: "미니맵 크기를 기본값에서 조정합니다.",
        },
        sectionDisplayInventory: "인벤토리 표시",
        reduceInventoryMotion: {
          label: "인벤토리 움직임 줄이기",
          description:
            "애니메이션 인벤토리 행 확장을 끄고 더 단순한 상호작용을 사용합니다.",
        },
        inventoryTileOnlyMotion: {
          label: "인벤토리 타일만 애니메이션",
          description:
            "인벤토리 행 높이와 간격은 유지한 채 아이콘 타일만 애니메이션 처리합니다.",
        },
        inventoryFixedTileSize: {
          label: "고정 인벤토리 타일 크기",
          description:
            "인벤토리 움직임 줄이기를 켰을 때만 적용됩니다. 고정 아이콘 크기를 선택하세요.",
          options: {
            none: "없음",
            small: "작게",
            medium: "중간",
            large: "크게",
          },
        },
        groupSound: "사운드",
        soundEnabled: {
          label: "사운드 사용",
          description:
            "FMOD 오디오를 켜거나 끕니다. 끄면 저사양 기기의 오디오 처리 부담이 줄어듭니다.",
        },
        groupMobileControls: "모바일 조작",
        invertTouchPanningDirection: {
          label: "패닝 방향 반전",
          description: "홀드 후 패닝이 시작되면 드래그 방향을 반대로 바꿉니다.",
        },
        groupCombat: "전투 피드백",
        damageNumbers: {
          label: "피해 수치",
          description: "떠다니는 피해 및 회복 수치를 표시합니다.",
        },
        displayStatChangesAbovePlayer: {
          label: "플레이어 위에 능력치 변화 표시",
          description:
            "힘이나 AC 같은 능력치 변화 라벨을 플레이어 위에 띄웁니다.",
        },
        displayXpGainsAbovePlayer: {
          label: "플레이어 위에 XP 획득 표시",
          description:
            "경험치가 증가할 때 XP 획득 라벨을 띄웁니다.",
        },
        tileShakeOnHit: {
          label: "피격 시 타일 흔들림",
          description: "공격이 적중하면 충돌 타일을 흔듭니다.",
        },
        sectionCombatBlood: "Blood effects",
        blood: {
          label: "피 효과",
          description: "적중 시 피 안개 파티클 효과를 렌더링합니다.",
        },
        bloodMist: {
          label: "피 안개",
          description: "적중 시 공중의 피 안개 파티클 효과를 렌더링합니다.",
        },
        bloodGround: {
          label: "핏자국 튐",
          description: "적중 후 던전 바닥에 피 튄 자국 효과를 렌더링합니다.",
        },
        bloodStrength: {
          label: "Blood strength",
          description:
            "Control how strongly blood textures and tinting read.",
        },
        bloodDetail: {
          label: "Blood detail",
          description:
            "Choose the blood splat texture resolution per dungeon tile.",
          options: {
            veryLow: "매우 낮음",
            low: "Low",
            medium: "Medium",
            high: "High",
          },
        },
        bloodColorLightHex: {
          label: "Ground blood fresh tint",
          description:
            "Pick the brighter blood tint used in fresh ground splats.",
        },
        bloodColorDarkHex: {
          label: "Ground blood dark tint",
          description:
            "Pick the darker blood tint used in dense ground blood areas.",
        },
        bloodMistColorHex: {
          label: "Blood mist tint",
          description: "Pick the base tint used for airborne blood mist.",
        },
        monsterShatter: {
          label: "몬스터 파쇄",
          description:
            "쓰러진 몬스터 빌보드를 물리적인 파편 조각으로 분해합니다.",
        },
        monsterShatterBloodBorders: {
          label: "파쇄 혈흔 테두리",
          description:
            "분할선 근처의 파편 픽셀에 무작위 혈흔 테두리 색을 입힙니다.",
        },
        groupCompatibility: "런타임 호환성",
        darkCorridorWalls367: {
          label: "레거시 어두운 복도 벽",
          description:
            "Slash'EM을 포함한 레거시 NetHack 3.4.3/3.6.x 계열 런타임용 어두운 복도 벽 타일을 추론하고 캐시합니다.",
        },
        overrideNh5DarkCorridorWallTiles: {
          label: "NetHack 5.0 어두운 벽 타일 덮어쓰기",
          description:
            "NetHack 5.0 어두운 복도 벽 타일에 어두운 벽 덮어쓰기 설정을 적용합니다.",
        },
        darkCorridorWallTileOverrideEnabled: {
          label: "어두운 벽 타일 덮어쓰기",
          description:
            "어두운 벽 덮어쓰기에 사용자 지정 아틀라스 타일을 사용하며 타일셋별로 저장됩니다.",
        },
        darkCorridorWallSolidColorOverrideEnabled: {
          label: "어두운 벽에 단색 사용",
          description: "타일셋 타일 대신 선택한 RGB 색을 사용합니다.",
        },
      },
      tabs: {
        display: {
          label: "표시",
          description: "인터페이스 및 표시 설정입니다.",
        },
        mobile: {
          label: "모바일",
          description: "\ubaa8\ubc14\uc77c\uc6a9 \uc778\ud130\ud398\uc774\uc2a4 \ubc0f \uac8c\uc784\ud50c\ub808\uc774 \uc124\uc815\uc785\ub2c8\ub2e4.",
        },
        controls: {
          label: "조작",
          description: "컨트롤러 매핑, 1인칭 모드, 시점 동작 설정입니다.",
        },
        sound: {
          label: "사운드",
          description: "오디오 출력과 성능 관련 사운드 설정입니다.",
        },
        combat: {
          label: "전투",
          description: "전투 타격 피드백과 시각 반응 설정입니다.",
        },
        compatibility: {
          label: "호환성",
          description: "런타임 호환성과 NetHack 동작 전환 설정입니다.",
        },
        updates: {
          label: "업데이트",
          description:
            "온라인 게임 업데이트를 확인하고 대기 중인 변경 사항을 검토합니다.",
        },
      },
    },
    update: {
      loading: {
        startupData: "시작 데이터 불러오는 중...",
        tileset: "타일셋 불러오는 중...",
        runtime: "로컬 런타임 시작 중...",
      },
      runtimeStoppedBeforeStartup:
        "시작이 끝나기 전에 로컬 NetHack 런타임이 중지되었습니다.",
      preparingDownload: "게임 업데이트 다운로드 준비 중...",
      idleStatus: "업데이트 상태가 대기 중입니다.",
      fileProgress: (index: number, count: number) =>
        `파일 ${index}/${count}`,
      unexpectedCheckFailure: "예상치 못한 업데이트 확인 실패입니다.",
      cancelRequested: "취소가 요청되었습니다.",
      stoppingActiveDownloadTask: "활성 다운로드 작업을 중지하는 중입니다.",
      unableToCancelDownload: "업데이트 다운로드를 취소할 수 없습니다.",
      noActiveDownloadToCancel: "취소할 활성 업데이트 다운로드가 없습니다.",
      startingDownload: "게임 업데이트 다운로드를 시작합니다.",
      canceled: "업데이트 다운로드가 취소되었습니다.",
      unableToDownloadAndApply: "업데이트를 다운로드하고 적용할 수 없습니다.",
      failed: "업데이트에 실패했습니다.",
      latestAlreadyInstalled: "최신 업데이트가 이미 설치되어 있습니다.",
      downloadComplete: "업데이트 다운로드가 완료되었습니다.",
      nothingAppliedTryAgain:
        "적용된 업데이트가 없습니다. 다시 확인해 주세요.",
      noFilesApplied: "적용된 업데이트 파일이 없습니다.",
      unexpectedFailure: "예상치 못한 업데이트 실패입니다.",
      checkingForUpdates: "GitHub 릴리스를 확인하는 중...",
      unsupportedPlatform:
        "이 플랫폼에서는 GitHub 릴리스를 확인할 수 없습니다.",
      latestAlreadyInstalledOptions: "이미 최신 게임 버전을 사용 중입니다.",
      oneUpdateAvailable:
        "새로운 게임 버전이 있습니다. 업데이트하시겠습니까?",
      manyUpdatesAvailable: (count: number) =>
        `새로운 게임 버전 ${count}개가 있습니다. 업데이트하시겠습니까?`,
      updateCheckFailed: (message: string) =>
        `GitHub 릴리스 확인 실패: ${message}`,
    },
    saves: {
      sections: {
        manual: "수동 저장",
        autosave: "자동 저장",
      },
      deleteTitle: "저장된 게임을 삭제할까요?",
      deleteMessage: (name: string) =>
        `${name}을(를) 정말 삭제할까요?`,
      overwriteTitle: "저장된 게임을 덮어쓸까요?",
      overwriteMessage: (name: string) =>
        `"${name}"이라는 저장된 게임이 이미 있습니다. 새 캐릭터로 덮어쓸까요?`,
      errorLoading: "저장 데이터를 불러오는 중 오류가 발생했습니다.",
      loading: "저장 데이터를 불러오는 중...",
      noneFound: "저장된 게임을 찾을 수 없습니다.",
      savedAt: (date: string) => `저장됨: ${date}`,
    },
    tilesets: {
      userTileset: "사용자 타일셋",
      currentSelectionFallback: "이 타일셋",
      deleteUploadedTitle: "업로드한 타일셋을 삭제할까요?",
      deleteUploadedMessage: (label: string) =>
        `업로드한 타일셋에서 '${label}'을(를) 삭제할까요?`,
      failedToDelete: "타일셋을 삭제하지 못했습니다.",
      chooseFile: "PNG/BMP/GIF/JPEG 타일셋 파일을 선택하세요.",
      provideName: "이 타일셋의 이름을 입력하세요.",
      failedToSave: "타일셋을 저장하지 못했습니다.",
      failedToLoadUploaded: "업로드한 타일셋을 불러오지 못했습니다:",
      userTilesetSuffix: "사용자 타일셋(사용자)",
      noTilesetsFound: "타일셋을 찾을 수 없습니다",
      failedToReadImage: "타일셋 이미지를 읽지 못했습니다.",
    },
    tilePicker: {
      noAtlasAvailable: "사용 가능한 타일셋 아틀라스가 없습니다.",
      unableToLoadAtlas: "타일 아틀라스를 불러올 수 없습니다.",
      atlasLoaded: "타일 아틀라스를 불러왔습니다.",
      loadingAtlas: "타일 아틀라스를 불러오는 중...",
      selectedTile: (tileId: number) => `선택됨: 타일 #${tileId}`,
      glyph: (label: string) => `글리프 ${label}`,
      tile: (tileId: number) => `타일 ${tileId}`,
      defaultBadge: "기본값",
      resetToDefault: "기본값으로 재설정",
      darkWallTitle: "어두운 벽 타일 선택기",
      closeDarkWall: "어두운 벽 타일 선택기 닫기",
      closeBackground: "타일셋 배경 타일 선택기 닫기",
      backgroundHelper:
        "몬스터/전리품 빌보드에서 공유 타일셋 배경을 제거하는 데 사용됩니다.",
      backgroundTitle: "타일셋 배경 타일 선택기",
      backgroundTitleWithLabel: (label: string) =>
        `타일셋 배경 타일 선택기: ${label}`,
      closeSolidColor: "단색 크로마 키 색상 선택기 닫기",
      solidColorTitle: "단색 크로마 키 선택기",
      solidColorTitleWithLabel: (label: string) =>
        `단색 크로마 키 선택기: ${label}`,
    },
    soundPack: {
      discardChangesTitle: "사운드 팩 변경 사항을 버릴까요?",
      discardChangesMessage: "저장하지 않은 사운드 팩 변경 사항을 버리고 계속할까요?",
      discard: "버리기",
      keepEditing: "계속 편집",
      failedToLoadIndexedDb: "IndexedDB에서 사운드 팩을 불러오지 못했습니다.",
      failedToSelectRequested: "요청한 사운드 팩을 선택하지 못했습니다.",
      provideName: "사운드 팩 이름을 입력하세요.",
      created: (name: string) => `사운드 팩 '${name}'을(를) 만들었습니다.`,
      failedToCreate: "사운드 팩을 만들지 못했습니다.",
      saved: (name: string) => `사운드 팩 '${name}'을(를) 저장했습니다.`,
      failedToSave: "사운드 팩을 저장하지 못했습니다.",
      failedToExportZip: "사운드 팩 ZIP을 내보내지 못했습니다.",
      exported: (name: string) => `'${name}'을(를) 내보냈습니다.`,
      failedToImportZip: "사운드 팩 ZIP을 가져오지 못했습니다.",
      imported: (name: string) => `사운드 팩 '${name}'을(를) 가져왔습니다.`,
      deleteTitle: "사운드 팩을 삭제할까요?",
      deleteMessage: (name: string) =>
        `사운드 팩 '${name}'을(를) 삭제할까요? 이 작업은 되돌릴 수 없습니다.`,
      deleted: (name: string) => `사운드 팩 '${name}'을(를) 삭제했습니다.`,
      failedToDelete: "사운드 팩을 삭제하지 못했습니다.",
      noPreviewSource: "이 사운드의 미리듣기 소스가 없습니다.",
      unableToPreview: "이 사운드를 미리들을 수 없습니다.",
      title: "사운드 팩",
      activePack: "활성 사운드 팩",
      activePackDescription:
        "사운드 경로 해석에 사용할 활성 사운드 팩을 선택합니다.",
      createNew: "새 사운드 팩 만들기",
      createDescription: "기본값을 덮어쓰는 사용자 지정 사운드 팩을 만듭니다.",
      createNameLabel: "새 사운드 팩 이름",
      createPlaceholder: "내 사운드 팩",
      createAndSave: "생성 후 저장",
      packName: "팩 이름",
      packNameDescription:
        "이 팩의 이름을 바꾸고 저장하여 사운드 파일 네임스페이스를 갱신합니다.",
      savePack: "사운드 팩 저장",
      export: "사운드 팩 내보내기",
      import: "사운드 팩 가져오기",
      deletePack: "사운드 팩 삭제",
      stopPreview: "미리듣기 중지",
      loading: "사운드 팩을 불러오는 중...",
      pendingSaveSuffix: " (저장 대기)",
      defaultSuffix: " (기본값)",
      customSuffix: " (사용자 지정)",
      noBundledSound: "번들 사운드 없음",
      enableSoundAria: (label: string) => `${label} 사용`,
      volumeAria: (label: string) => `${label} 볼륨`,
      play: "재생",
      playing: "재생 중...",
      volume: "볼륨",
      remove: "제거",
      replace: "교체",
      soundFile: "사운드 파일",
      reset: "재설정",
      attribution: "출처 표기",
      attributionAria: (label: string) => `${label} 출처 표기`,
      attributionPlaceholder: "출처, 제작자 또는 라이선스 정보",
      addVariation: "+ 변형 추가",
    },
    dialogs: {
      pauseMenu: {
        saveBeforeQuit: "종료하기 전에 저장할까요?",
        title: "게임 일시정지",
        resume: "계속",
        options: "옵션",
        saveGame: "게임 저장",
        exitToMainMenu: "메인 메뉴로 나가기",
        quitGame: "게임 종료",
      },
      debugLogs: {
        closeLabel: "디버그 로그 닫기",
        title: "저장된 디버그 로그",
        hint: "숨겨진 디버그 로그 전환을 활성화한 뒤에만 로그가 기록됩니다.",
        showingEntries: (count: number, startedAt: string) =>
          `${startedAt}부터 ${count}개 항목을 표시 중입니다.`,
        noneSaved: "아직 저장된 디버그 로그가 없습니다.",
        refresh: "새로고침",
        clearLogs: "로그 지우기",
      },
      startupUpdate: {
        maintenanceNotice: "새로운 GitHub 릴리스를 찾지 못했습니다.",
        summaryAvailable:
          "새로운 게임 버전이 있습니다. 업데이트하시겠습니까?",
        summaryNone: "이미 최신 게임 버전입니다.",
        currentVersion: (version: string) => `현재 버전: ${version}`,
        latestVersion: (version: string) =>
          `최신 GitHub 릴리스: ${version}`,
        disableAtStartup:
          "앞으로 시작할 때 이 알림을 표시하지 않기",
        disabledNotice:
          "시작 시 릴리스 알림이 꺼졌습니다. 옵션에서 다시 켤 수 있습니다.",
        clientUpgradeRequired:
          "최신 플랫폼 개선 사항을 사용하려면 전체 클라이언트 업그레이드도 필요합니다.",
        progressTitle: "업데이트 다운로드 상태",
        canceling: "업데이트 다운로드를 취소하는 중...",
        noActiveTransfer: "활성 파일 전송이 없습니다.",
        waitingForUpdater: "업데이터 동작을 기다리는 중입니다.",
        pendingUpdates: "대기 중인 업데이트",
        payloadAvailable: "업데이트 페이로드를 사용할 수 있습니다.",
        downloadUpdates: "업데이트 다운로드",
        hideDetails: "세부정보 숨기기",
        moreDetails: "세부정보 더 보기",
        cancelDownload: "다운로드 취소",
      },
      startup: {
        chooseVariant: "NetHack 변형을 선택하세요:",
        options: "NetHack 3D 옵션",
        quitGame: "게임 종료",
        chooseSetup: "캐릭터 설정을 선택하세요:",
        randomCharacter: "무작위 캐릭터",
        createCharacter: "캐릭터 만들기",
        loadGame: "게임 불러오기",
        selectSavedGame: "저장된 게임을 선택하세요:",
        enterRandomName: "무작위 캐릭터의 이름을 입력하세요:",
        createCharacterPrompt: "캐릭터를 만드세요:",
        name: "이름",
        role: "직업",
        race: "종족",
        gender: "성별",
        alignment: "성향",
        startGame: "게임 시작",
      },
      clientOptions: {
        closeLabel: "NetHack 3D 옵션 닫기",
        title: "NetHack 3D 클라이언트 옵션",
        categoriesLabel: "설정 범주",
        updates: {
          checkOnLaunchLabel: "실행 시 GitHub 릴리스 알림 표시",
          checkOnLaunchDescription:
            "시작할 때 GitHub 릴리스를 확인하고 새 버전이 있으면 알려줍니다.",
          title: "GitHub 릴리스",
          description:
            "이 빌드를 공개된 GitHub 릴리스와 비교합니다.",
          idle:
            "업데이트 확인을 눌러 이 빌드를 GitHub 릴리스와 비교하세요.",
          button: "업데이트 확인",
          openGitHubReleases: "GitHub 릴리스 열기",
        },
        buttons: {
          manageTileSets: "타일셋 관리",
          remapController: "컨트롤러 재매핑",
          resetControllerDefaults: "컨트롤러 기본값 복원",
        },
        hints: {
          darkWallsAlwaysEnabled:
            " Vulture 타일이 활성화되어 있는 동안에는 항상 활성화됩니다.",
          darkWallsDisabledByVulture:
            " Vulture 타일이 활성화되어 있는 동안에는 비활성화됩니다.",
          enableDarkWallsFirst:
            " 먼저 레거시 어두운 복도 벽 또는 NetHack 5.0 어두운 벽 덮어쓰기를 활성화하세요.",
          enableFpsFirst: " 먼저 표시 설정에서 1인칭 모드를 활성화하세요.",
        },
        darkWallControls: {
          normal: "일반",
          fps: "1인칭",
          normalAria: "어두운 벽 단색(일반 모드)",
          fpsAria: "어두운 벽 단색(1인칭 모드)",
          gridLines: "격자선",
          intensity: "강도",
        },
        controllerRemap: {
          title: "컨트롤러 재매핑",
          closeLabel: "컨트롤러 재매핑 닫기",
          hint: "슬롯을 선택한 뒤 버튼을 누르거나 스틱을 움직이세요. 각 동작에는 슬롯이 두 개 있습니다.",
          listeningFor: (label: string, slot: number) =>
            `${label} 입력 대기 중(슬롯 ${slot}). 취소하려면 ESC를 누르세요.`,
        },
        resetPrompt:
          "NetHack 3D 옵션을 기본값으로 되돌릴까요? 사용자 지정 타일셋은 유지됩니다.",
      },
      tilesetManager: {
        closeLabel: "타일셋 관리자 닫기",
        title: "타일셋 관리",
        description:
          "타일셋을 추가하고 타일셋별 배경/크로마 설정을 편집합니다.",
        createTitle: "새 타일셋 만들기",
        editTitle: "타일셋 편집",
        editTitleWithName: (label: string) => `타일셋 편집: ${label}`,
        tileSetName: "타일셋 이름",
        tileSetPlaceholder: "내 타일셋",
        builtInNamesLocked: "내장 타일셋 이름은 변경할 수 없습니다.",
        tileLayoutVersion: "타일 레이아웃 버전",
        layout367: "NetHack 3.6.7 레이아웃",
        layout5: "NetHack 5.0 레이아웃",
        tileLayoutDescription:
          "이 업로드된 아틀라스가 사용하는 타일 인덱스 레이아웃을 선택합니다.",
        tileImage: "타일셋 이미지",
        tileImageOptional: "타일셋 이미지(선택적 교체)",
        selectedFile: (fileName: string) => `선택됨: ${fileName}`,
        currentFile: (fileName: string) => `현재 파일: ${fileName}`,
        uploadedImage: "업로드된 이미지",
        weaponSpriteFlip: "FPS \ubb34\uae30 \uc2a4\ud504\ub77c\uc774\ud2b8 \ub4a4\uc9d1\uae30",
        weaponSpriteFlipDescription:
          "\uc774 \ud0c0\uc77c\uc14b\uc758 \uc7a5\ube44 \ubb34\uae30 \uc2a4\ud504\ub77c\uc774\ud2b8\ub97c \uc218\ud3c9\uc73c\ub85c \ub4a4\uc9d1\uc2b5\ub2c8\ub2e4. \uae30\ubcf8\uc801\uc73c\ub85c \ucf1c\uc838 \uc788\uc2b5\ub2c8\ub2e4.",
        backgroundRemovalDescription:
          "이 타일셋의 빌보드 배경 제거를 설정하거나, 두 모드를 모두 꺼서 아틀라스 배경을 유지할 수 있습니다.",
        backgroundTileRemoval: "배경 타일 제거",
        backgroundTileRemovalDescription:
          "선택한 아틀라스 타일을 사용해 빌보드 배경을 제거합니다.",
        solidChromaKey: "단색 크로마 키",
        solidChromaKeyDescription:
          "단일 RGB 단색을 사용해 빌보드 배경을 제거합니다.",
        clickToPickFromAtlas: "클릭하여 아틀라스에서 선택",
        saveFirstThenEdit:
          "먼저 새 타일셋을 저장한 다음 배경/크로마 설정을 편집하세요.",
        createTileSet: "타일셋 만들기",
        saveTileSet: "타일셋 저장",
        saveTileSettings: "타일 설정 저장",
        importNewTileSet: "+ 새 타일셋 가져오기",
        noUploadedTilesets: "업로드된 타일셋이 없습니다.",
        selectedSuffix: " (선택됨)",
        editingSuffix: " (편집 중)",
        uploadedDetails: (fileName: string, layout: string) =>
          `${fileName} | 업로드됨 | 레이아웃 ${layout}`,
        builtInDetails: (path: string) => `${path} | 내장`,
      },
      textInput: {
        cancelLabel: "텍스트 입력 취소",
        placeholder: "텍스트 입력",
        ok: "확인",
      },
      question: {
        cancelPrompt: "프롬프트 취소",
        selectAll: "모두 선택",
        deselectAll: "모두 해제",
        page: (current: number, total: number) => `페이지 ${current} / ${total}`,
        amount: "Amount",
        amountDefault: "Default",
        clearAmount: "Clear amount",
        decreaseAmount: "Decrease amount by one",
        increaseAmount: "Increase amount by one",
        pageHintMultiple: "< 와 > 로 페이지를 바꾸세요. 취소하려면 ESC를 누르세요",
        pageHintSingle: "취소하려면 ESC를 누르세요",
        choices: {
          leftRingFinger: "왼손 약지",
          rightRingFinger: "오른손 약지",
          here: "여기서",
          onGround: "바닥에서",
          eligibleItems: "가능한 아이템",
          allInventory: "전체 인벤토리",
        },
      },
      runtimeStartError: {
        closeLabel: "메인 메뉴로 돌아가기",
        title: "NetHack 초기화에 실패했습니다.",
        returnToMainMenu: "메인 메뉴로 돌아가기",
      },
      newGamePrompt: {
        closeLabel: "새 게임 프롬프트 닫기",
        title: "메인 메뉴로 돌아갈까요?",
        reasonFallback: "게임 오버",
      },
      direction: {
        cancelLabel: "방향 프롬프트 취소",
      },
      info: {
        closeCharacter: "캐릭터 창 닫기",
        closeInformation: "정보 창 닫기",
        characterTitle: "캐릭터",
        experienceProgress: "경험치 진행도",
        levelLabel: (level: number) => `레벨 ${level}`,
        xpAtMaxLevel: (xp: string) => `경험치 ${xp} (최대 레벨 도달)`,
        xpToNextLevel: (xp: string, next: string, remaining: string) =>
          `경험치 ${xp} / ${next} • 다음 레벨까지 ${remaining}`,
        vitals: "생명 수치",
        characteristics: "특성",
        currentLimit: "현재 / 한계",
        armorClass: "방어도",
        currentStatus: "현재 상태",
        noActiveStatus: "활성 상태가 없습니다.",
        currentAttributes: "현재 능력치",
        noTemporaryAttributes: "임시 능력치 효과가 없습니다.",
        characterActions: "캐릭터 동작",
        inventory: "인벤토리",
        inventoryDetail: "소지 아이템 열기",
        closeHint:
          "닫으려면 SPACE, ENTER 또는 ESC를 누르세요. 다시 열려면 Ctrl+M을 누르세요.",
        infoTitleFallback: "NetHack 정보",
        noDetails: "(세부정보 없음)",
      },
      inventory: {
        closeLabel: "인벤토리 닫기",
        title: "인벤토리",
        empty: "인벤토리가 비어 있습니다.",
        unknownItem: "알 수 없는 아이템",
        closeHint: "닫으려면 ENTER, ESC 또는 'i'를 누르세요.",
        closeHintWithContext:
          "아이템을 선택하면 상황별 명령을 엽니다. 닫으려면 ENTER, ESC 또는 'i'를 누르세요",
      },
      inventoryDropMenu: {
        title: "떨구기",
        dropType: "떨굴 방식",
        dropAmount: "떨굴 수량",
        dropSpecificAmount: "특정 수량 떨구기",
        onlyStackedItems: "겹쳐진 아이템에서만 사용할 수 있습니다",
      },
      inventoryDropCount: {
        title: "이 묶음에서 몇 개를 떨굴까요?",
        chooseAmount: (max: number) => `1에서 ${max} 사이의 수량을 선택하세요.`,
        ariaLabel: "떨굴 수량",
        setMinimum: "떨굴 수량을 최소로 설정",
        decrease: "떨굴 수량을 하나 줄이기",
        increase: "떨굴 수량을 하나 늘리기",
        setMaximum: "떨굴 수량을 최대로 설정",
      },
      mobileActions: {
        extendedCommands: "확장 명령",
        commonCommands: "자주 쓰는 명령",
        allCommands: "모든 명령",
        actions: "동작",
        menu: "메뉴",
        close: "닫기",
        wizardCommands: "위저드 명령",
        wizard: "위저드",
        wizardCommandFallbackDescription:
          "\uc774 \uc704\uc800\ub4dc \uc804\uc6a9 \ub514\ubc84\uadf8 \uba85\ub839\uc744 \uc2e4\ud589\ud569\ub2c8\ub2e4.",
        wizardCommandDetails: {
          levelchange: { name: "\ub808\ubca8 \ubcc0\uacbd", description: "\uc601\uc6c5\uc758 \uacbd\ud5d8 \ub808\ubca8\uc744 \uc124\uc815\ud569\ub2c8\ub2e4." },
          lightsources: { name: "\ube5b \uc6d0\ucc9c", description: "\uc774\ub3d9\ud558\ub294 \ube5b \uc6d0\ucc9c\uc744 \ud45c\uc2dc\ud569\ub2c8\ub2e4." },
          migratemons: { name: "\uc774\ub3d9 \uc911\uc778 \ubaac\uc2a4\ud130", description: "\ub808\ubca8 \uc0ac\uc774\ub97c \uc774\ub3d9\ud558\ub294 \ubaac\uc2a4\ud130\ub97c \ud45c\uc2dc\ud569\ub2c8\ub2e4." },
          panic: { name: "\ud328\ub2c9 \ud14c\uc2a4\ud2b8", description: "\ud328\ub2c9 \ucc98\ub9ac\ub97c \ud14c\uc2a4\ud2b8\ud558\uace0 \uc774 \uac8c\uc784\uc744 \ub05d\ub0c5\ub2c8\ub2e4." },
          polyself: { name: "\uc790\uc2e0 \ud3f4\ub9ac\ubaa8\ud504", description: "\uc601\uc6c5\uc758 \ud604\uc7ac \ud615\ud0dc\ub97c \ubc14\uafb9\ub2c8\ub2e4." },
          seenv: { name: "\ubcf8 \ubca1\ud130", description: "\ubcf8 \ubca1\ud130 \ub514\ubc84\uadf8 \uc9c0\ub3c4\ub97c \ud45c\uc2dc\ud569\ub2c8\ub2e4." },
          stats: { name: "\uba54\ubaa8\ub9ac \ud1b5\uacc4", description: "\ub7f0\ud0c0\uc784 \uba54\ubaa8\ub9ac \ud1b5\uacc4\ub97c \ud45c\uc2dc\ud569\ub2c8\ub2e4." },
          timeout: { name: "\ud0c0\uc784\uc544\uc6c3 \ud050", description: "\uc2dc\uac04\uc81c \ud6a8\uacfc\uc640 \ub0b4\uc7ac \ub2a5\ub825\uc744 \ud45c\uc2dc\ud569\ub2c8\ub2e4." },
          vanquished: { name: "\ucc98\uce58\ud55c \ubaac\uc2a4\ud130", description: "\uc8fd\uc740 \ubaac\uc2a4\ud130 \uc218\ub97c \ud45c\uc2dc\ud569\ub2c8\ub2e4." },
          vision: { name: "\uc2dc\uc57c \ubc30\uc5f4", description: "\ud604\uc7ac \uc2dc\uc57c \ubc30\uc5f4\uc744 \ud45c\uc2dc\ud569\ub2c8\ub2e4." },
          wizbury: { name: "\uadfc\ucc98 \ubb3c\uac74 \ubb3b\uae30", description: "3x3 \uc601\uc5ed\uc758 \ubc14\ub2e5 \ubb3c\uac74\uc744 \ubb3b\uc2b5\ub2c8\ub2e4." },
          wizdetect: { name: "\uc228\uaca8\uc9c4 \uac83 \uac10\uc9c0", description: "\uc601\uc6c5 \uadfc\ucc98\uc758 \uc228\uaca8\uc9c4 \uac83\uc744 \ub4dc\ub7ec\ub0c5\ub2c8\ub2e4." },
          wizgenesis: { name: "\ubaac\uc2a4\ud130 \uc0dd\uc131", description: "\uc774\ub984\uc774\ub098 \ubd84\ub958\ub85c \ubaac\uc2a4\ud130\ub97c \ub9cc\ub4ed\ub2c8\ub2e4." },
          wizidentify: { name: "\uc778\ubca4\ud1a0\ub9ac \uc2dd\ubcc4", description: "\uc778\ubca4\ud1a0\ub9ac\uc758 \ubaa8\ub4e0 \uc544\uc774\ud15c\uc744 \uc2dd\ubcc4\ud569\ub2c8\ub2e4." },
          wizintrinsic: { name: "\ub0b4\uc7ac \ub2a5\ub825 \uc124\uc815", description: "\uc120\ud0dd\ud55c \uc2dc\uac04\uc81c \ub0b4\uc7ac \ub2a5\ub825\uc744 \uc870\uc815\ud569\ub2c8\ub2e4." },
          wizlevelport: { name: "\ub808\ubca8 \ud154\ub808\ud3ec\ud2b8", description: "\ub2e4\ub978 \ub808\ubca8\uc774\ub098 \ubd84\uae30\ub85c \ud154\ub808\ud3ec\ud2b8\ud569\ub2c8\ub2e4." },
          wizmakemap: { name: "\ub808\ubca8 \uc7ac\uc0dd\uc131", description: "\ud604\uc7ac \ub808\ubca8\uc744 \ub2e4\uc2dc \uc0dd\uc131\ud569\ub2c8\ub2e4." },
          wizmap: { name: "\ub808\ubca8 \uc9c0\ub3c4", description: "\ub808\ubca8 \uc9c0\ub3c4\uc640 \ud568\uc815\uc744 \ub4dc\ub7ec\ub0c5\ub2c8\ub2e4." },
          wizrumorcheck: { name: "\uc18c\ubb38 \uac80\uc0ac", description: "\ucc38/\uac70\uc9d3 \uc18c\ubb38 \ud30c\uc77c\uc744 \uac80\uc99d\ud569\ub2c8\ub2e4." },
          wizsmell: { name: "\ubaac\uc2a4\ud130 \ub0c4\uc0c8 \ub9e1\uae30", description: "\uc120\ud0dd\ud55c \ubaac\uc2a4\ud130\uc758 \ub0c4\uc0c8\ub97c \ub9e1\uc2b5\ub2c8\ub2e4." },
          wizwhere: { name: "\ud2b9\uc218 \ub808\ubca8", description: "\ud2b9\uc218 \ub808\ubca8\uc758 \ubc30\uce58\ub97c \ud45c\uc2dc\ud569\ub2c8\ub2e4." },
          wizwish: { name: "\uc18c\uc6d0", description: "\uc544\uc774\ud15c, \ud568\uc815 \ub610\ub294 \uc9c0\ud615\uc744 \uc0dd\uc131\ud569\ub2c8\ub2e4." },
          wmode: { name: "\ubcbd \ubaa8\ub4dc", description: "\ubcbd \ubaa8\ub4dc \ub514\ubc84\uadf8 \ub370\uc774\ud130\ub97c \ud45c\uc2dc\ud569\ub2c8\ub2e4." },
        },
        repeat: "반복",
        character: "캐릭터",
        inventory: "인벤토리",
        log: "로그",
        pickUp: "줍기",
        search: "탐색",
        closeMessageLog: "메시지 로그 닫기",
      },
      positionPrompt: {
        closeLabel: "위치 프롬프트 닫기",
        desktopHint:
          "이동 입력을 사용하거나 타일을 클릭해 선택을 이동하세요. 선택된 타일을 다시 클릭하거나 Enter를 눌러 확인하세요.",
        mobileHint:
          "이동 입력을 사용하거나 타일을 탭해 선택을 이동하세요. 선택된 타일을 다시 탭하거나 Enter를 눌러 확인하세요.",
        controllerHint:
          "이동 입력으로 선택을 이동하세요. Enter 또는 확인 버튼을 눌러 확인하세요.",
      },
      controllerSupport: {
        prompt: "컨트롤러가 감지되었습니다. 컨트롤러 지원을 사용할까요?",
      },
    },
  },
} as const;

export type TranslationDictionary = typeof ko;
