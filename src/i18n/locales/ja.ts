import { mergeTranslations, type LocaleOverrides } from "../locale-helpers";
import { en, type TranslationDictionary } from "./en";

export const jaOverrides: LocaleOverrides<TranslationDictionary> = {
  meta: {
    locale: "ja-JP",
  },
  common: {
    appName: "NetHack 3D",
    confirm: "確認",
    cancel: "キャンセル",
    close: "閉じる",
    back: "戻る",
    yes: "はい",
    no: "いいえ",
    delete: "削除",
    edit: "編集",
    done: "完了",
    resetToDefaults: "デフォルトに戻す",
    later: "後で",
    checking: "確認中...",
    downloading: "ダウンロード中...",
    canceling: "キャンセル中...",
    none: "なし",
    off: "オフ",
    normal: "標準",
    fps: "FPS",
  },
  controller: {
    groups: {
      movement: "移動",
      lookAndCamera: "視点とカメラ",
      actions: "アクション",
      dialogs: "ダイアログ",
      system: "システム",
    },
    actions: {
      dpad_up: {
        label: "方向パッド 上",
        description:
          "ダイアログ内の上移動と、移動ハイライトの上移動を行います。",
      },
      dpad_down: {
        label: "方向パッド 下",
        description:
          "ダイアログ内の下移動と、移動ハイライトの下移動を行います。",
      },
      dpad_left: {
        label: "方向パッド 左",
        description:
          "ダイアログ内の左移動と、移動ハイライトの左移動を行います。",
      },
      dpad_right: {
        label: "方向パッド 右",
        description:
          "ダイアログ内の右移動と、移動ハイライトの右移動を行います。",
      },
      left_stick_up: {
        label: "左スティック 上",
        description: "移動ハイライトと仮想カーソルを上に動かします。",
      },
      left_stick_down: {
        label: "左スティック 下",
        description: "移動ハイライトと仮想カーソルを下に動かします。",
      },
      left_stick_left: {
        label: "左スティック 左",
        description: "移動ハイライトと仮想カーソルを左に動かします。",
      },
      left_stick_right: {
        label: "左スティック 右",
        description: "移動ハイライトと仮想カーソルを右に動かします。",
      },
      right_stick_up: {
        label: "右スティック 上",
        description: "視点移動、カメラ移動、ダイアログの上スクロールを行います。",
      },
      right_stick_down: {
        label: "右スティック 下",
        description: "視点移動、カメラ移動、ダイアログの下スクロールを行います。",
      },
      right_stick_left: {
        label: "右スティック 左",
        description: "視点とカメラを左へ動かします。",
      },
      right_stick_right: {
        label: "右スティック 右",
        description: "視点とカメラを右へ動かします。",
      },
      confirm: {
        label: "決定 / クリック",
        description: "移動を確定し、ダイアログ内でクリックします。",
      },
      search: {
        label: "探索",
        description: "移動プレビューが無効のとき、現在のタイルを探索します。",
      },
      cancel_or_context: {
        label: "キャンセル / コンテキスト",
        description: "コンテキスト操作を開くか、現在のダイアログを閉じます。",
      },
      action_menu: {
        label: "アクションメニュー",
        description: "コントローラー用の放射状アクションメニューを開きます。",
      },
      run_modifier: {
        label: "走行修飾",
        description: "押している間、移動前に run 接頭辞を送信します。",
      },
      zoom_in: {
        label: "ズーム（長押し）",
        description:
          "押しながら、左スティック上下でズームし、右スティックでカメラを回転します。",
      },
      recenter_camera: {
        label: "カメラ再中央寄せ",
        description: "カメラをプレイヤー中心へ戻します。",
      },
      toggle_large_minimap: {
        label: "大型ミニマップ切替",
        description: "非常に大きいミニマップ表示に切り替えます。",
      },
      pause_menu: {
        label: "ポーズメニュー",
        description: "ポーズメニューを開閉します。",
      },
      open_inventory: {
        label: "インベントリ",
        description: "インベントリ画面を開きます。",
      },
      open_character: {
        label: "キャラクターシート",
        description: "キャラクターシート画面を開きます。",
      },
    },
    buttonLabels: {
      4: "左バンパー",
      5: "右バンパー",
      6: "左トリガー",
      7: "右トリガー",
      8: "戻る / View",
      9: "Start / Menu",
      10: "左スティック押し込み",
      11: "右スティック押し込み",
      12: "方向パッド 上",
      13: "方向パッド 下",
      14: "方向パッド 左",
      15: "方向パッド 右",
    },
    axisLabels: {
      0: "左スティック X",
      1: "左スティック Y",
      2: "右スティック X",
      3: "右スティック Y",
    },
    directions: {
      leftStickLeft: "左スティック 左",
      leftStickRight: "左スティック 右",
      leftStickUp: "左スティック 上",
      leftStickDown: "左スティック 下",
      rightStickLeft: "右スティック 左",
      rightStickRight: "右スティック 右",
      rightStickUp: "右スティック 上",
      rightStickDown: "右スティック 下",
    },
    unbound: "未割り当て",
    axisFallback: (axisIndex: number) => `軸 ${axisIndex}`,
    buttonFallback: (buttonIndex: number) => `ボタン ${buttonIndex}`,
    slotLabel: (slotIndex: number) => `スロット ${slotIndex + 1}`,
    listening: "入力待機中...",
    clear: "クリア",
    controllerDetected: (count: number) =>
      `${count} 個のコントローラーを検出しました。`,
    noControllerDetected: "コントローラーは検出されませんでした。",
  },
  startupInitOptions: {
    accordion: {
      summary: "初期化オプション（任意）",
      description:
        "起動時に適用する追加の NetHack `OPTIONS` エントリです。ウィンドウポート固有やプラットフォーム固有のオプションは意図的に除外されています。",
      resetToDefaults: "デフォルトに戻す",
    },
    options: {
      playmode: {
        label: "プレイモード",
        description:
          "起動モードを選択します。Wizard モードは NetHack のデバッグモードです (`playmode:debug`)。",
        options: {
          normal: "通常",
          explore: "探索",
          debug: "Wizard / Debug",
        },
      },
      number_pad: {
        label: "移動キー",
        description:
          "NetHack の移動にテンキー (`number_pad:1`) を使うか、従来の vi キー (`number_pad:0`) を使うかを選びます。",
        options: {
          numeric: "テンキー",
          vi: "vi キー",
        },
      },
      autopickup: {
        label: "自動拾得",
        description: "pickup types で選んだアイテム種別を自動で拾います。",
      },
      pickup_types: {
        label: "拾得タイプ",
        description:
          '自動拾得するオブジェクト記号です（例: $"=/!?+）。空欄ならゲーム既定値を使います。',
      },
      pickup_thrown: {
        label: "投擲アイテムを拾う",
        description: "投げたアイテムが落ちたときに自動で拾います。",
      },
      pickup_burden: {
        label: "拾得重量しきい値",
        description:
          "この負担レベルを超える場合、拾う前に確認を出します。",
        options: {
          u: "無負担 (u)",
          b: "荷重 (b)",
          s: "重荷 (s)",
          n: "過重 (n)",
          t: "極度の過重 (t)",
          l: "積載超過 (l)",
        },
      },
      pile_limit: {
        label: "山の上限",
        description: "床のアイテム山をポップアップ表示に切り替える個数です。",
      },
      autoquiver: {
        label: "自動矢筒",
        description: "射撃時に矢筒を自動補充するか、適した武器を構えます。",
      },
      autoopen: {
        label: "自動開閉",
        description: "ドアに向かって移動したとき、自動で開けようとします。",
      },
      autodig: {
        label: "自動掘削",
        description: "可能な場合、壁へ移動すると自動で掘ります。",
      },
      cmdassist: {
        label: "コマンド補助",
        description: "コマンド入力ミス時に追加ヘルプを表示します。",
      },
      confirm: {
        label: "攻撃確認",
        description: "友好的な生物を攻撃する前に確認します。",
      },
      safe_pet: {
        label: "ペット保護",
        description: "ペットを攻撃する前に確認します。",
      },
      help: {
        label: "ゲーム内ヘルプ",
        description: "追加情報があるときに詳細な説明表示を促します。",
      },
      legacy: {
        label: "レガシー導入",
        description: "新しいゲーム開始時に物語の導入を表示します。",
      },
      rest_on_space: {
        label: "Space で休憩",
        description: "Space キーを待機 / 休憩として扱います。",
      },
      pushweapon: {
        label: "武器を押し出す",
        description: "持ち替え時に現在の武器をオフハンドへ移します。",
      },
      extmenu: {
        label: "拡張コマンドメニュー",
        description: "拡張コマンドをポップアップメニューで表示します。",
      },
      fixinv: {
        label: "インベントリ文字固定",
        description: "アイテム移動時にもインベントリ文字を保とうとします。",
      },
      implicit_uncursed: {
        label: "無呪い表示",
        description: "インベントリ説明に常に 'uncursed' 相当を含めます。",
      },
      mention_walls: {
        label: "壁メッセージ",
        description: "壁に向かって移動したときメッセージを表示します。",
      },
      sortloot: {
        label: "戦利品一覧ソート",
        description: "拾得一覧とインベントリ選択一覧の並び順です。",
        options: {
          f: "完全",
          l: "戦利品のみ",
          n: "なし",
        },
      },
      sortpack: {
        label: "インベントリ並び替え",
        description: "インベントリ表示時に内容を種別ごとに並び替えます。",
      },
      msghistory: {
        label: "メッセージ履歴数",
        description: "再確認用に保持する最上段メッセージ数です。",
      },
      dogname: {
        label: "犬の名前",
        description: "最初の犬の既定名です。",
      },
      catname: {
        label: "猫の名前",
        description: "最初の猫の既定名です。",
      },
      horsename: {
        label: "馬の名前",
        description: "最初の馬の既定名です。",
      },
      pettype: {
        label: "希望するペット",
        description: "選択可能な役職で優先する初期ペットです。",
        options: {
          default: "ゲーム既定",
          cat: "猫",
          dog: "犬",
          horse: "馬",
          none: "なし",
        },
      },
      fruit: {
        label: "好物の果物",
        description: "キャラクターが好む果物の名前です。",
      },
      packorder: {
        label: "所持品順序",
        description: "インベントリに表示するアイテム種別の順序です。",
      },
      paranoid_confirmation: {
        label: "慎重確認",
        description:
          "空白区切りの追加確認項目です（例: confirm quit attack pray）。",
      },
      sparkle: {
        label: "魔法耐性きらめき",
        description: "魔法耐性用の特別なきらめき効果を表示します。",
      },
      standout: {
        label: "強調表示",
        description: "モンスターや --More-- を強調表示します。",
      },
      tombstone: {
        label: "墓石",
        description: "死亡時に墓石グラフィックを表示します。",
      },
      verbose: {
        label: "詳細メッセージ",
        description: "状態や行動メッセージをより詳しい表現にします。",
      },
    },
  },
  soundEffects: {
    byKey: {
      "player-walk": "プレイヤー歩行",
      hit: "命中",
      "monster-killed": "モンスター撃破（プレイヤー）",
      "monster-killed-other": "モンスター撃破（その他）",
      "missed-attack": "攻撃失敗",
      "door-opens": "ドアが開く",
      "door-closes": "ドアが閉まる",
      "door-kick": "ドアを蹴る",
      "door-smash": "ドア破壊",
      "door-resists": "ドアはびくともしない",
      "door-distant": "遠くのドア",
      "walk-down-stairs": "階段を下りる",
      "walk-up-stairs": "階段を上る",
      eating: "食事",
      drink: "飲む",
      "quaff-potion": "薬を飲む",
      "pickup-gold": "金貨を拾う",
      "pickup-item": "アイテムを拾う",
      "find-hidden": "隠し扉 / 通路を発見",
      "level-up": "レベルアップ",
      unlock: "解錠",
      "boulder-push": "岩を押す",
      "boulder-blocked": "岩が塞いでいる",
      splash: "水しぶき",
      searching: "探索中",
      "magic-cast": "魔法詠唱",
      "magic-heal": "回復魔法",
      "magic-buff": "強化魔法",
    },
  },
  characterSheet: {
    titleFallback: "キャラクターシート",
    sectionTitles: {
      overview: "概要",
      background: "背景",
      basics: "基本情報",
      characteristics: "現在の特性",
      status: "現在の状態",
      attributes: "現在の能力値",
    },
    statLabels: {
      strength: "腕力",
      dexterity: "器用さ",
      constitution: "耐久力",
      intelligence: "知性",
      wisdom: "賢さ",
      charisma: "魅力",
    },
    commands: {
      enhance: {
        label: "強化",
        detail: "技能を向上",
      },
      conduct: {
        label: "Conduct",
        detail: "挑戦進行状況を表示",
      },
      overview: {
        label: "概要",
        detail: "ダンジョン進行を表示",
      },
      spells: {
        label: "呪文",
        detail: "習得済み呪文を確認",
      },
      seespells: {
        label: "呪文書",
        detail: "呪文インベントリを表示",
      },
      technique: {
        label: "Technique",
        detail: "役割/種族の能力を使う",
      },
      known: {
        label: "発見物",
        detail: "既知のオブジェクト一覧",
      },
      pray: {
        label: "祈る",
        detail: "祈りを試みる",
      },
    },
  },
  castMenu: {
    schoolLabel: "系統:",
    headings: {
      name: "名前",
      level: "レベル",
      category: "分類",
      fail: "失敗率",
      retention: "保持",
    },
    summary: {
      known: (count: number) => `${count} 件習得`,
      castable: (count: number) => `${count} 件詠唱可能`,
      bestSuccess: (percent: number) => `最高成功率 ${percent}%`,
      averageFail: (percent: number) => `平均失敗率 ${percent}%`,
      schoolCount: (count: number) => `${count} 系統`,
    },
    retention: {
      unknown: "不明",
      gone: "消失",
    },
  },
  enhanceMenu: {
    defaultGroupTitle: "技能",
    availability: {
      available_now: "利用可能",
      needs_experience: "経験値 / スロット不足",
      needs_practice: "練習不足",
      maxed_out: "最大",
    },
    summary: {
      available: (count: number) => `${count} 件利用可能`,
      gated: (count: number) => `${count} 件は経験値 / スロット不足`,
      practice: (count: number) => `${count} 件は練習が必要`,
      maxed: (count: number) => `${count} 件は最大`,
    },
    maxLabel: "最大",
    slotCount: (count: number) => `${count} スロット`,
  },
  app: {
    unknownTime: "不明な時刻",
    debugSession: {
      possibleCrash: "クラッシュの可能性",
      active: "有効",
    },
    debugLogs: {
      enabledToast: "デバッグログを有効化しました",
      openLink: "デバッグログを表示",
      clearedLogEntry: "保存済みデバッグログはユーザーによって削除されました。",
    },
    statusEffects: {
      turningToStone: "石化中",
      slimed: "スライム化",
      strangled: "窒息",
      foodPoisoning: "食中毒",
      terminallyIll: "瀕死の病",
      blind: "盲目",
      deaf: "聴覚喪失",
      stunned: "朦朧",
      confused: "混乱",
      hallucinating: "幻覚",
      levitating: "浮遊",
      flying: "飛行",
      riding: "騎乗",
      barehanded: "素手",
      busy: "行動中",
      iron: "鉄化",
      glowingHands: "光る手",
      grabbed: "つかまれた",
      held: "拘束",
      icy: "凍結",
      inLava: "溶岩中",
      paralyzed: "麻痺",
      sleeping: "睡眠",
      slippery: "滑りやすい",
      submerged: "水没",
      tethered: "つながれている",
      trapped: "罠にかかった",
      unconscious: "気絶",
      woundedLegs: "足の負傷",
      holding: "保持中",
    },
    characterStats: {
      descriptions: {
        strength: "近接ダメージ、所持重量、強引な行動に影響します。",
        dexterity: "命中率、罠との相互作用、防御的な身のこなしに影響します。",
        constitution: "HP 成長量や毒・吸収への耐性に影響します。",
        intelligence: "読書や多くの呪文関連行動の成功に影響します。",
        wisdom: "魔力成長と呪文成功率に影響します。",
        charisma: "店でのやり取り、ペット管理、社会的結果に影響します。",
      },
      armorClassDescription:
        "低いほど有利です。Armor Class は敵の命中率を下げます。",
    },
    directionHelp: {
      controller:
        "方向をクリックするか、左スティック / 方向パッドでプレビューして離すと確定します。中央の円は自分対象です。階段は < または > を使います。ESC でキャンセル。",
      numpad:
        "方向をクリックしてください。中央の円は自分対象です。テンキー (1-4,6-9)、矢印キー、<、>、s も使えます。ESC でキャンセル。",
      viKeys:
        "方向をクリックしてください。中央の円は自分対象です。hjkl / yubn、矢印キー、<、>、s も使えます。ESC でキャンセル。",
      fps: "視線で狙います。左クリックまたは W で決定、S で自分対象、A / D または右クリックでキャンセルします。",
    },
    inventoryContextActions: {
      apply: "使う",
      invoke: "発動",
      tip: "注ぐ",
      loot: "物色",
      drop: "落とす",
      eat: "食べる",
      quaff: "飲む",
      read: "読む",
      rub: "こする",
      throw: "投げる",
      wield: "装備",
      quiver: "矢筒",
      wear: "着用",
      takeOff: "外す",
      putOn: "身につける",
      remove: "取り外す",
      zap: "振る",
      untrap: "罠解除",
      offer: "捧げる",
      name: "名前を付ける",
      call: "呼び名を付ける",
      adjust: "整理",
      engrave: "刻む",
      dip: "浸す",
      info: "情報",
      unwield: "装備解除",
    },
    mobileActions: {
      wait: "待機",
      zap: "振る",
      cast: "詠唱",
      kick: "蹴る",
      read: "読む",
      quaff: "飲む",
      eat: "食べる",
      glance: "確認",
      loot: "物色",
      open: "開ける",
      wield: "装備",
      wear: "着用",
      putOn: "身につける",
      takeOff: "外す",
      extended: "拡張",
    },
    clientOptions: {
      config: {
        groupControls: "コントローラーと一人称モード",
        sectionControlsController: "コントローラー",
        controllerEnabled: {
          label: "コントローラー対応を有効化",
          description:
            "ゲームプレイと UI ダイアログでゲームパッド入力を有効にします。",
        },
        sectionControlsLook: "視点とカメラ",
        invertLookYAxis: {
          label: "Y 軸視点を反転",
          description: "垂直マウスルックとタッチ視点の方向を反転します。",
        },
        fpsLookSensitivityX: {
          label: "FPS 視点感度 X",
          description: "横方向のマウスルック / タッチ視点感度です。",
        },
        fpsLookSensitivityY: {
          label: "FPS 視点感度 Y",
          description: "縦方向のマウスルック / タッチ視点感度です。",
        },
        snapCameraYawToNearest45: {
          label: "カメラ yaw を 45 度刻みにスナップ",
          description:
            "カメラ回転入力を離したとき、最も近い 45 度角へ滑らかに補正します。",
        },
        sectionControlsMovement: "移動挙動",
        cameraRelativeMovement: {
          label: "カメラ相対移動とスワイプ",
          description:
            "カメラの Y 軸角度に応じて移動キーとスワイプ方向を回転させます。",
        },
        fpsWasdKeyboardMovementEnabled: {
          label: "FPS \u30e2\u30fc\u30c9\u3067 WASD \u30ad\u30fc\u30dc\u30fc\u30c9\u79fb\u52d5\u3092\u6709\u52b9\u5316",
          description:
            "\u4e00\u4eba\u79f0\u8996\u70b9\u306e\u79fb\u52d5\u306b W/A/S/D \u3092\u4f7f\u3044\u307e\u3059\u3002\u7121\u52b9\u306b\u3059\u308b\u3068\u3001\u3053\u308c\u3089\u306e\u30ad\u30fc\u306f\u901a\u5e38\u306e NetHack \u30b3\u30de\u30f3\u30c9\u3068\u3057\u3066\u52d5\u4f5c\u3057\u307e\u3059\u3002",
        },
        controllerFpsMoveRepeatMs: {
          label: "FPS 左スティック移動リピート",
          description:
            "FPS モードでの左スティック移動の繰り返し遅延です（小さいほど高速）。",
        },
        groupInterface: "インターフェース",
        locale: {
          label: "言語",
          description:
            "インターフェース言語を選択します。対応している場合はブラウザー地域が既定になり、未対応時は英語にフォールバックします。",
          options: {
            en: "English",
          },
        },
        sectionDisplayCamera: "カメラと視界",
        fpsMode: {
          label: "一人称モード",
          description: "一人称操作とマウスルックを使用します。",
        },
        fpsFlattenEntityBillboards: {
          label: "重なったタイルスプライトを平面化",
          description:
            "モンスター、ペット、またはプレイヤーが上にいるとき、戦利品やダンジョン要素のタイルスプライトを平面化します。無効にすると重なったスプライトは立ったビルボードのままです。Vulture タイルは常に立体表示されます。",
        },
        fpsHeldWeaponVisible: {
          label: "FPS武器を表示",
          description: "一人称モードで手に持った武器スプライトを表示します。",
        },
        showItemsUnderPlayerInOverheadTilesMode: {
          label: "見下ろしタイルでプレイヤー下のアイテムを表示",
          description:
            "ランタイムの下敷きグリフ情報を使って、見下ろしタイルモードでプレイヤー下のアイテムや床要素を表示します。",
        },
        fpsFov: {
          label: "FPS 視野角",
          description: "一人称カメラの視野角を調整します。",
        },
        sectionDisplayGraphics: "グラフィックと描画",
        tilesetMode: {
          label: "表示",
          description: "ASCII の代わりにグラフィカルタイルを使用します。",
          options: {
            ascii: "ASCII",
            tiles: "タイル",
          },
        },
        tilesetPath: {
          label: "タイルセット",
          description: "組み込みタイルセットとアップロード済みタイルセットです。",
        },
        antialiasing: {
          label: "アンチエイリアス",
          description: "3D 描画のエッジ平滑化モードです。",
          options: {
            taa: "TAA",
            fxaa: "FXAA",
          },
        },
        lightingEnabled: {
          label: "ライティング",
          description:
            "動的なシーン照明とダンジョンの暗さ表現を有効にします。無効にすると常時明るい平坦な描画になります。",
        },
        blockAmbientOcclusion: {
          label: "アンビエントオクルージョン",
          description:
            "床ブロックと壁ブロックの接触部に微妙な陰影を加えます。",
        },
        brightness: {
          label: "明るさ",
          description: "シーン全体の明るさを調整します。",
        },
        contrast: {
          label: "コントラスト",
          description: "描画シーン全体のコントラストを調整します。",
        },
        gamma: {
          label: "ガンマ",
          description: "描画シーン全体の表示ガンマを調整します。",
        },
        sectionDisplayInterface: "インターフェース",
        uiFontScale: {
          label: "UI フォント倍率",
          description: "ゲーム UI のフォントサイズ全体を既定値から拡大縮小します。",
        },
        disableAnimatedTransitions: {
          label: "アニメーション遷移を無効化",
          description:
            "UI のフェード、移動、遷移アニメーションを無効化し、より素早い表示切替にします。",
        },
        uiTileBackgroundRemoval: {
          label: "UI のタイル背景を除去",
          description:
            "UI パネル内に表示されるタイルアイコンへ、タイル / クロマ背景除去を適用します。",
        },
        desktopTouchInterfaceMode: {
          label: "デスクトップ用タッチ UI",
          description:
            "デスクトップでタッチ操作を表示し、縦向きまたは横向きレイアウトを選択します。",
          options: {
            off: "オフ",
            portrait: "縦向きタッチ UI を使用",
            landscape: "横向きタッチ UI を使用",
          },
        },
        sectionDisplayMessages: "メッセージとログ",
        desktopMessageLogWindowScale: {
          label: "デスクトップメッセージログのウィンドウ倍率",
          description:
            "フォントサイズを変えずに、枠付きデスクトップメッセージログのウィンドウサイズを拡大縮小します。",
        },
        liveMessageLog: {
          label: "ライブメッセージログ",
          description: "スクロールするゲーム内メッセージログを表示します。",
        },
        showPersistentMobileMessageLog: {
          label: "\u56fa\u5b9a\u30e1\u30c3\u30bb\u30fc\u30b8\u30ed\u30b0\u3092\u8868\u793a",
          description:
            "\u30b2\u30fc\u30e0\u4e2d\u306f\u30b3\u30f3\u30d1\u30af\u30c8\u306a\u30e2\u30d0\u30a4\u30eb\u30e1\u30c3\u30bb\u30fc\u30b8\u30ed\u30b0\u3092\u8868\u793a\u3057\u305f\u307e\u307e\u306b\u3057\u307e\u3059\u3002\u30ed\u30b0\u30dc\u30bf\u30f3\u304b\u3089\u5927\u304d\u3044\u30ed\u30b0\u3092\u958b\u3051\u307e\u3059\u3002",
        },
        rumbleEnabled: {
          label: "\u632f\u52d5\u3092\u6709\u52b9\u5316",
          description:
            "\u5bfe\u5fdc\u30e2\u30d0\u30a4\u30eb\u7aef\u672b\u3067\u3001\u4e0e\u3048\u305f\u30c0\u30e1\u30fc\u30b8\u3068\u53d7\u3051\u305f\u30c0\u30e1\u30fc\u30b8\u306b\u77ed\u3044\u30cf\u30d7\u30c6\u30a3\u30c3\u30af\u632f\u52d5\u3092\u4f7f\u7528\u3057\u307e\u3059\u3002",
        },
        sectionMobileSafeZone: "\u30e2\u30d0\u30a4\u30eb\u30bb\u30fc\u30d5\u30be\u30fc\u30f3",
        manualMobileBottomSafeZoneEnabled: {
          label: "\u691c\u51fa\u3055\u308c\u305f\u30e2\u30d0\u30a4\u30eb\u30bb\u30fc\u30d5\u30be\u30fc\u30f3\u3092\u4e0a\u66f8\u304d",
          description:
            "Android\u643a\u5e2f\u30b2\u30fc\u30e0\u6a5f\u304c\u30bb\u30fc\u30d5\u30a8\u30ea\u30a2\u3092\u6b63\u3057\u304f\u5831\u544a\u3057\u306a\u3044\u5834\u5408\u306b\u3001\u624b\u52d5\u306e\u30bb\u30fc\u30d5\u30be\u30fc\u30f3\u4f59\u767d\u3092\u4f7f\u7528\u3057\u307e\u3059\u3002",
        },
        manualMobileBottomSafeZoneVerticalPx: {
          label: "\u7e26\u5411\u304d\u306e\u4e0b\u90e8\u30bb\u30fc\u30d5\u30be\u30fc\u30f3",
          description:
            "\u7e26\u5411\u304d\u30e2\u30d0\u30a4\u30eb\u30ec\u30a4\u30a2\u30a6\u30c8\u7528\u306e\u624b\u52d5\u4e0b\u90e8\u30bb\u30fc\u30d5\u30be\u30fc\u30f3\u3067\u3059\u3002",
        },
        manualMobileBottomSafeZoneHorizontalPx: {
          label: "\u6a2a\u5411\u304d\u306e\u4e0b\u90e8\u30bb\u30fc\u30d5\u30be\u30fc\u30f3",
          description:
            "\u6a2a\u5411\u304d\u30e2\u30d0\u30a4\u30eb\u30ec\u30a4\u30a2\u30a6\u30c8\u7528\u306e\u624b\u52d5\u4e0b\u90e8\u30bb\u30fc\u30d5\u30be\u30fc\u30f3\u3067\u3059\u3002",
        },
        manualMobileRightSafeZoneHorizontalPx: {
          label: "\u6a2a\u5411\u304d\u306e\u53f3\u5074\u30bb\u30fc\u30d5\u30be\u30fc\u30f3",
          description:
            "\u6a2a\u5411\u304d\u30e2\u30d0\u30a4\u30eb\u30ec\u30a4\u30a2\u30a6\u30c8\u7528\u306e\u624b\u52d5\u53f3\u5074\u30bb\u30fc\u30d5\u30be\u30fc\u30f3\u3067\u3059\u3002",
        },
        manualMobileBottomSafeZonePreview: "\u4e0b\u90e8\u30bb\u30fc\u30d5\u30be\u30fc\u30f3",
        manualMobileRightSafeZonePreview: "\u53f3\u5074\u30bb\u30fc\u30d5\u30be\u30fc\u30f3",
        liveMessageDisplayTimeMs: {
          label: "ライブメッセージ表示時間",
          description:
            "フェードアウトが始まる前に、フローティングメッセージを完全表示する時間です。",
        },
        liveMessageFadeOutTimeMs: {
          label: "ライブメッセージのフェード時間",
          description: "フローティングメッセージのフェードアウトアニメーション時間です。",
        },
        liveMessageLogFontScale: {
          label: "ライブメッセージのフォント倍率",
          description:
            "浮かび上がるアクションメッセージのサイズを既定値から拡大縮小します。",
        },
        sectionDisplayMinimap: "ミニマップ",
        minimap: {
          label: "ミニマップ",
          description: "ダンジョンのミニマップを表示または非表示にします。",
        },
        minimapScale: {
          label: "ミニマップ倍率",
          description: "ミニマップのサイズを既定値から拡大縮小します。",
        },
        sectionDisplayInventory: "インベントリ表示",
        reduceInventoryMotion: {
          label: "インベントリの動きを減らす",
          description:
            "アニメーション付きのインベントリ行展開を無効にし、よりシンプルな操作にします。",
        },
        inventoryTileOnlyMotion: {
          label: "インベントリでタイルだけを動かす",
          description:
            "インベントリの動きを減らす有効時に、行全体ではなくタイルアイコンだけをアニメーションさせます。",
        },
        inventoryFixedTileSize: {
          label: "インベントリの固定タイルサイズ",
          description:
            "インベントリの動きを減らす有効時に、固定のタイルアイコンサイズを選択します。",
          options: {
            none: "なし",
            small: "小",
            medium: "中",
            large: "大",
          },
        },
        groupSound: "サウンド",
        soundEnabled: {
          label: "サウンドを有効化",
          description:
            "FMOD オーディオのオン/オフを切り替えます。無効にすると低性能デバイスでの音声処理負荷を軽減できます。",
        },
        groupMobileControls: "モバイル操作",
        invertTouchPanningDirection: {
          label: "パン方向を反転",
          description: "長押し後にパン操作が始まったら、ドラッグ方向を反転します。",
        },
        groupCombat: "戦闘フィードバック",
        damageNumbers: {
          label: "ダメージ数値",
          description: "浮かぶダメージ量と回復量の数値を表示します。",
        },
        displayStatChangesAbovePlayer: {
          label: "能力値変化をプレイヤー上に表示",
          description:
            "筋力や AC などの能力値変化を、浮かぶラベルで表示します。",
        },
        displayXpGainsAbovePlayer: {
          label: "経験値増加をプレイヤー上に表示",
          description:
            "経験値が増えたとき、浮かぶ XP ラベルを表示します。",
        },
        tileShakeOnHit: {
          label: "ヒット時にタイルを揺らす",
          description: "攻撃が命中したときに、衝突タイルを揺らします。",
        },
        blood: {
          label: "血しぶき",
          description: "攻撃命中時に血しぶきのパーティクル効果を描画します。",
        },
        bloodMist: {
          label: "血の霧",
          description: "命中時に空中の血霧パーティクルを描画します。",
        },
        bloodGround: {
          label: "血の飛び散り",
          description: "命中後にダンジョンの床へ血の飛び散りを描画します。",
        },
        bloodDetail: {
          options: {
            veryLow: "非常に低い",
          },
        },
        monsterShatter: {
          label: "モンスター破砕",
          description:
            "倒したモンスタービルボードを物理的な破片に分割します。",
        },
        monsterShatterBloodBorders: {
          label: "破砕時の血縁取り",
          description:
            "破断線付近の破片ピクセルを、ランダムな血赤色の縁で着色します。",
        },
        groupCompatibility: "ランタイム互換性",
        darkCorridorWalls367: {
          label: "旧世代ランタイムの暗い通路壁",
          description:
            "Slash'EM を含む旧世代の NetHack 3.4.3/3.6.x 系ランタイム向けに、暗い通路壁タイルを推測してキャッシュします。",
        },
        overrideNh5DarkCorridorWallTiles: {
          label: "NetHack 5.0 の暗い壁タイルを上書き",
          description:
            "暗い壁の上書き設定を NetHack 5.0 の暗い通路壁タイルにも適用します。",
        },
        darkCorridorWallTileOverrideEnabled: {
          label: "暗い壁タイルを上書き",
          description:
            "タイルセットごとに保存される、カスタムアトラスタイルを暗い壁の上書きに使います。",
        },
        darkCorridorWallSolidColorOverrideEnabled: {
          label: "暗い壁に単色を使用",
          description: "タイルセットのタイルの代わりに、選択した RGB 色を使います。",
        },
      },
      tabs: {
        display: {
          label: "表示",
          description: "UI と表示設定です。",
        },
        mobile: {
          label: "モバイル",
          description:
            "\u30e2\u30d0\u30a4\u30eb\u5411\u3051\u306e\u30a4\u30f3\u30bf\u30fc\u30d5\u30a7\u30fc\u30b9\u3068\u30b2\u30fc\u30e0\u30d7\u30ec\u30a4\u8a2d\u5b9a\u3067\u3059\u3002",
        },
        controls: {
          label: "操作",
          description: "コントローラー、FPS、視点操作設定です。",
        },
        sound: {
          label: "サウンド",
          description: "音声出力と音響パフォーマンス設定です。",
        },
        combat: {
          label: "戦闘",
          description: "戦闘演出と視覚反応の設定です。",
        },
        compatibility: {
          label: "互換性",
          description: "ランタイム互換性と NetHack 挙動の切替です。",
        },
        updates: {
          label: "更新",
          description: "オンライン更新の確認と保留中変更の確認です。",
        },
      },
    },
    update: {
      loading: {
        startupData: "起動データを読み込み中...",
        tileset: "タイルセットを読み込み中...",
        runtime: "ローカルランタイムを起動中...",
      },
      runtimeStoppedBeforeStartup:
        "起動完了前にローカル NetHack ランタイムが停止しました。",
      preparingDownload: "ゲーム更新のダウンロードを準備中...",
      idleStatus: "更新状態は待機中です。",
      fileProgress: (index: number, count: number) => `ファイル ${index} / ${count}`,
      unexpectedCheckFailure: "更新確認中に予期しない失敗が発生しました。",
      cancelRequested: "キャンセルを要求しました。",
      stoppingActiveDownloadTask: "進行中のダウンロード処理を停止しています。",
      unableToCancelDownload: "更新ダウンロードをキャンセルできませんでした。",
      noActiveDownloadToCancel:
        "キャンセルできる進行中の更新ダウンロードはありません。",
      startingDownload: "ゲーム更新のダウンロードを開始しています。",
      canceled: "更新ダウンロードはキャンセルされました。",
      unableToDownloadAndApply: "更新のダウンロードと適用に失敗しました。",
      failed: "更新に失敗しました。",
      latestAlreadyInstalled: "最新の更新はすでに適用済みです。",
      downloadComplete: "更新ダウンロードが完了しました。",
      nothingAppliedTryAgain:
        "更新は適用されませんでした。もう一度確認してください。",
      noFilesApplied: "更新ファイルは適用されませんでした。",
      unexpectedFailure: "予期しない更新失敗が発生しました。",
      checkingForUpdates: "GitHub リリースを確認中...",
      unsupportedPlatform:
        "このプラットフォームでは GitHub リリースを確認できません。",
      latestAlreadyInstalledOptions:
        "すでに最新のゲームバージョンです。",
      oneUpdateAvailable:
        "新しいゲームバージョンが利用可能です。更新しますか？",
      manyUpdatesAvailable: (count: number) =>
        `${count} 件の新しいゲームバージョンがあります。更新しますか？`,
      updateCheckFailed: (message: string) =>
        `GitHub リリースの確認に失敗しました: ${message}`,
    },
    saves: {
      sections: {
        manual: "手動セーブ",
        autosave: "オートセーブ",
      },
      deleteTitle: "セーブデータを削除しますか？",
      deleteMessage: (name: string) => `${name} を削除してもよろしいですか？`,
      overwriteTitle: "セーブデータを上書きしますか？",
      overwriteMessage: (name: string) =>
        `"${name}" という名前のセーブデータはすでに存在します。新しいキャラクターで上書きしますか？`,
      errorLoading: "セーブデータの読み込みエラー",
      loading: "セーブデータを読み込み中...",
      noneFound: "セーブデータが見つかりません。",
      savedAt: (date: string) => `保存日時: ${date}`,
    },
    tilesets: {
      userTileset: "ユーザータイルセット",
      currentSelectionFallback: "このタイルセット",
      deleteUploadedTitle: "アップロード済みタイルセットを削除しますか？",
      deleteUploadedMessage: (label: string) =>
        `アップロード済みタイルセットから '${label}' を削除しますか？`,
      failedToDelete: "タイルセットの削除に失敗しました。",
      chooseFile: "PNG / BMP / GIF / JPEG のタイルセット画像を選択してください。",
      provideName: "このタイルセットの名前を入力してください。",
      failedToSave: "タイルセットの保存に失敗しました。",
      failedToLoadUploaded:
        "アップロード済みタイルセットの読み込みに失敗しました:",
      userTilesetSuffix: "ユーザータイルセット (user)",
      noTilesetsFound: "タイルセットが見つかりません",
      failedToReadImage: "タイルセット画像の読み込みに失敗しました。",
    },
    tilePicker: {
      noAtlasAvailable: "タイルセットアトラスは利用できません。",
      unableToLoadAtlas: "タイルアトラスを読み込めません。",
      atlasLoaded: "タイルアトラスを読み込みました。",
      loadingAtlas: "タイルアトラスを読み込み中...",
      selectedTile: (tileId: number) => `選択中: タイル #${tileId}`,
      glyph: (label: string) => `グリフ ${label}`,
      tile: (tileId: number) => `タイル ${tileId}`,
      defaultBadge: "デフォルト",
      resetToDefault: "デフォルトに戻す",
      darkWallTitle: "暗い壁タイル選択",
      closeDarkWall: "暗い壁タイル選択を閉じる",
      closeBackground: "タイルセット背景タイル選択を閉じる",
      backgroundHelper:
        "モンスター / 戦利品ビルボードから共有背景を除去するために使用します。",
      backgroundTitle: "タイルセット背景タイル選択",
      backgroundTitleWithLabel: (label: string) =>
        `タイルセット背景タイル選択: ${label}`,
      closeSolidColor: "単色クロマキー選択を閉じる",
      solidColorTitle: "単色クロマキー選択",
      solidColorTitleWithLabel: (label: string) =>
        `単色クロマキー選択: ${label}`,
    },
    soundPack: {
      discardChangesTitle: "サウンドパックの変更を破棄しますか？",
      discardChangesMessage:
        "未保存のサウンドパック変更を破棄して続行しますか？",
      discard: "破棄",
      keepEditing: "編集を続ける",
      failedToLoadIndexedDb:
        "IndexedDB からサウンドパックを読み込めませんでした。",
      failedToSelectRequested:
        "要求されたサウンドパックを選択できませんでした。",
      provideName: "サウンドパック名を入力してください。",
      created: (name: string) => `サウンドパック '${name}' を作成しました。`,
      failedToCreate: "サウンドパックの作成に失敗しました。",
      saved: (name: string) => `サウンドパック '${name}' を保存しました。`,
      failedToSave: "サウンドパックの保存に失敗しました。",
      failedToExportZip: "サウンドパック ZIP の書き出しに失敗しました。",
      exported: (name: string) => `'${name}' を書き出しました。`,
      failedToImportZip: "サウンドパック ZIP の読み込みに失敗しました。",
      imported: (name: string) => `サウンドパック '${name}' を読み込みました。`,
      deleteTitle: "サウンドパックを削除しますか？",
      deleteMessage: (name: string) =>
        `サウンドパック '${name}' を削除しますか？ この操作は元に戻せません。`,
      deleted: (name: string) => `サウンドパック '${name}' を削除しました。`,
      failedToDelete: "サウンドパックの削除に失敗しました。",
      noPreviewSource:
        "このサウンドで利用できるプレビューソースはありません。",
      unableToPreview: "このサウンドはプレビューできません。",
      title: "サウンドパック",
      activePack: "有効なサウンドパック",
      activePackDescription:
        "サウンドパス解決に使う有効なサウンドパックを選択します。",
      createNew: "新しいサウンドパックを作成",
      createDescription:
        "既定音声を上書きするカスタムサウンドパックを作成します。",
      createNameLabel: "新しいサウンドパック名",
      createPlaceholder: "マイサウンドパック",
      createAndSave: "作成して保存",
      packName: "パック名",
      packNameDescription:
        "このパック名を変更して保存すると、サウンドファイル名前空間も更新されます。",
      savePack: "サウンドパックを保存",
      export: "サウンドパックを書き出し",
      import: "サウンドパックを読み込み",
      deletePack: "サウンドパックを削除",
      stopPreview: "プレビュー停止",
      loading: "サウンドパックを読み込み中...",
      pendingSaveSuffix: " (未保存)",
      defaultSuffix: " (デフォルト)",
      customSuffix: " (カスタム)",
      noBundledSound: "同梱サウンドなし",
      enableSoundAria: (label: string) => `${label} を有効化`,
      volumeAria: (label: string) => `${label} の音量`,
      play: "再生",
      playing: "再生中...",
      volume: "音量",
      remove: "削除",
      replace: "置換",
      soundFile: "サウンドファイル",
      reset: "リセット",
      attribution: "クレジット",
      attributionAria: (label: string) => `${label} のクレジット`,
      attributionPlaceholder: "出典、作者、ライセンス情報など",
      addVariation: "+ バリエーションを追加",
    },
    dialogs: {
      pauseMenu: {
        saveBeforeQuit: "終了前にセーブしますか？",
        title: "ゲーム一時停止中",
        resume: "再開",
        options: "オプション",
        saveGame: "ゲームを保存",
        exitToMainMenu: "メインメニューへ戻る",
        quitGame: "ゲーム終了",
      },
      debugLogs: {
        closeLabel: "デバッグログを閉じる",
        title: "保存済みデバッグログ",
        hint: "ログは隠しデバッグログ切替を有効にした後でのみ記録されます。",
        showingEntries: (count: number, startedAt: string) =>
          `${startedAt} からの ${count} 件を表示中です。`,
        noneSaved: "保存済みデバッグログはまだありません。",
        refresh: "更新",
        clearLogs: "ログを削除",
      },
      startupUpdate: {
        maintenanceNotice: "新しい GitHub リリースは見つかりませんでした。",
        summaryAvailable:
          "新しいゲームバージョンが利用可能です。更新しますか？",
        summaryNone: "すでに最新のゲームバージョンです。",
        currentVersion: (version: string) => `現在のバージョン: ${version}`,
        latestVersion: (version: string) =>
          `最新の GitHub リリース: ${version}`,
        disableAtStartup:
          "今後は起動時にこれらの通知を表示しない。",
        disabledNotice:
          "起動時のリリース通知はオフになりました。オプションで再度有効にできます。",
        clientUpgradeRequired:
          "最新のプラットフォーム強化を使うには、クライアント全体の更新も必要です。",
        progressTitle: "更新ダウンロード状況",
        canceling: "更新ダウンロードをキャンセル中...",
        noActiveTransfer: "進行中のファイル転送はありません。",
        waitingForUpdater: "アップデーターの動作を待機中です。",
        pendingUpdates: "保留中の更新",
        payloadAvailable: "更新ペイロードが利用可能です。",
        downloadUpdates: "更新をダウンロード",
        hideDetails: "詳細を隠す",
        moreDetails: "詳細を見る",
        cancelDownload: "ダウンロードをキャンセル",
      },
      startup: {
        chooseVariant: "NetHack バリアントを選択:",
        options: "NetHack 3D オプション",
        quitGame: "ゲーム終了",
        chooseSetup: "キャラクター設定を選択:",
        randomCharacter: "ランダムキャラクター",
        createCharacter: "キャラクター作成",
        loadGame: "ゲームをロード",
        selectSavedGame: "セーブデータを選択:",
        enterRandomName: "ランダムキャラクターの名前を入力:",
        createCharacterPrompt: "キャラクターを作成:",
        name: "名前",
        role: "役割",
        race: "種族",
        gender: "性別",
        alignment: "属性",
        startGame: "ゲーム開始",
      },
      clientOptions: {
        closeLabel: "NetHack 3D オプションを閉じる",
        title: "NetHack 3D クライアントオプション",
        categoriesLabel: "設定カテゴリ",
        updates: {
          checkOnLaunchLabel: "起動時に GitHub リリース通知を表示",
          checkOnLaunchDescription:
            "起動時に GitHub リリースを確認し、新しいバージョンがあれば通知します。",
          title: "GitHub リリース",
          description:
            "このビルドを公開済みの GitHub リリースと比較します。",
          idle:
            "更新を確認 を押して、このビルドを GitHub リリースと比較してください。",
          button: "更新を確認",
          openGitHubReleases: "GitHub リリースを開く",
        },
        buttons: {
          manageTileSets: "タイルセット管理",
          remapController: "コントローラー再割り当て",
          resetControllerDefaults:
            "コントローラー設定をデフォルトに戻す",
        },
        hints: {
          darkWallsAlwaysEnabled:
            " Vulture タイルが有効な間は常に有効です。",
          darkWallsDisabledByVulture:
            " Vulture タイルが有効な間は無効です。",
          enableDarkWallsFirst:
            " 先に旧世代ランタイムの暗い通路壁、または NetHack 5.0 の暗い壁上書きを有効にしてください。",
          enableFpsFirst: " 先に表示設定で一人称モードを有効にしてください。",
        },
        darkWallControls: {
          normal: "通常",
          fps: "FPS",
          normalAria: "暗い壁の単色設定（通常モード）",
          fpsAria: "暗い壁の単色設定（FPS モード）",
          gridLines: "グリッド線",
          intensity: "強度",
        },
        controllerRemap: {
          title: "コントローラー再割り当て",
          closeLabel: "コントローラー再割り当てを閉じる",
          hint: "スロットを選んでからボタンを押すかスティックを動かしてください。各アクションには 2 つのスロットがあります。",
          listeningFor: (label: string, slot: number) =>
            `${label} の入力待機中 (スロット ${slot})。ESC でキャンセル。`,
        },
        resetPrompt:
          "NetHack 3D オプションをデフォルトへ戻しますか？ カスタムタイルセットは保持されます。",
      },
      tilesetManager: {
        closeLabel: "タイルセット管理を閉じる",
        title: "タイルセット管理",
        description:
          "タイルセットを追加し、タイルセットごとの背景 / クロマ設定を編集します。",
        createTitle: "新しいタイルセットを作成",
        editTitle: "タイルセットを編集",
        editTitleWithName: (label: string) => `タイルセットを編集: ${label}`,
        tileSetName: "タイルセット名",
        tileSetPlaceholder: "My Tileset",
        builtInNamesLocked:
          "組み込みタイルセット名は変更できません。",
        tileLayoutVersion: "タイルレイアウト版",
        layout367: "NetHack 3.6.7 レイアウト",
        layout5: "NetHack 5.0 レイアウト",
        tileLayoutDescription:
          "このアップロード済みアトラスが使うタイルインデックスレイアウトを選択します。",
        tileImage: "タイルセット画像",
        tileImageOptional: "タイルセット画像（任意の差し替え）",
        selectedFile: (fileName: string) => `選択中: ${fileName}`,
        currentFile: (fileName: string) => `現在: ${fileName}`,
        uploadedImage: "アップロード済み画像",
        backgroundRemovalDescription:
          "このタイルセットの背景除去を設定します。どちらも無効にするとアトラス背景を維持します。",
        backgroundTileRemoval: "背景タイル除去",
        backgroundTileRemovalDescription:
          "選択したアトラスタイルを使ってビルボード背景を除去します。",
        solidChromaKey: "単色クロマキー",
        solidChromaKeyDescription:
          "単一の RGB 色でビルボード背景を除去します。",
        clickToPickFromAtlas: "クリックしてアトラスから選択",
        saveFirstThenEdit:
          "新しいタイルセットを先に保存してから背景 / クロマ設定を編集してください。",
        createTileSet: "タイルセットを作成",
        saveTileSet: "タイルセットを保存",
        saveTileSettings: "タイル設定を保存",
        importNewTileSet: "+ 新しいタイルセットを読み込み",
        noUploadedTilesets: "アップロード済みタイルセットはありません。",
        selectedSuffix: " (選択中)",
        editingSuffix: " (編集中)",
        uploadedDetails: (fileName: string, layout: string) =>
          `${fileName} | uploaded | layout ${layout}`,
        builtInDetails: (path: string) => `${path} | built-in`,
      },
      textInput: {
        cancelLabel: "テキスト入力をキャンセル",
        placeholder: "テキストを入力",
      },
      question: {
        cancelPrompt: "確認をキャンセル",
        selectAll: "すべて選択",
        deselectAll: "すべて解除",
        page: (current: number, total: number) => `ページ ${current} / ${total}`,
        pageHintMultiple: "< と > でページ切替。ESC でキャンセル",
        pageHintSingle: "ESC でキャンセル",
        choices: {
          leftRingFinger: "左手薬指",
          rightRingFinger: "右手薬指",
          here: "ここ",
          onGround: "足元",
          eligibleItems: "候補のアイテム",
          allInventory: "すべての持ち物",
        },
      },
      runtimeStartError: {
        closeLabel: "メインメニューへ戻る",
        title: "NetHack の初期化に失敗しました。",
        returnToMainMenu: "メインメニューへ戻る",
      },
      newGamePrompt: {
        closeLabel: "新規ゲーム確認を閉じる",
        title: "メインメニューへ戻りますか？",
        reasonFallback: "ゲームオーバー",
      },
      direction: {
        cancelLabel: "方向選択をキャンセル",
      },
      info: {
        closeCharacter: "キャラクター画面を閉じる",
        closeInformation: "情報画面を閉じる",
        characterTitle: "キャラクター",
        experienceProgress: "経験値進行",
        levelLabel: (level: number) => `レベル ${level}`,
        xpAtMaxLevel: (xp: string) => `XP ${xp} (最大レベル到達)`,
        xpToNextLevel: (xp: string, next: string, remaining: string) =>
          `XP ${xp} / ${next} • 次まで ${remaining}`,
        vitals: "バイタル",
        characteristics: "特性",
        currentLimit: "現在 / 上限",
        armorClass: "アーマークラス",
        currentStatus: "現在の状態",
        noActiveStatus: "有効な状態異常はありません。",
        currentAttributes: "現在の能力値",
        noTemporaryAttributes: "一時的な能力変化はありません。",
        characterActions: "キャラクター操作",
        inventory: "インベントリ",
        inventoryDetail: "所持アイテムを開く",
        closeHint:
          "SPACE、ENTER、または ESC で閉じます。Ctrl+M で再表示します。",
        infoTitleFallback: "NetHack 情報",
        noDetails: "(詳細なし)",
      },
      inventory: {
        closeLabel: "インベントリを閉じる",
        title: "インベントリ",
        empty: "インベントリは空です。",
        unknownItem: "不明なアイテム",
        closeHint: "ENTER、ESC、または 'i' で閉じます。",
        closeHintWithContext:
          "アイテムを選ぶとコンテキスト操作を開きます。ENTER、ESC、または 'i' で閉じます。",
      },
      inventoryDropMenu: {
        title: "落とす",
        dropType: "落とし方",
        dropAmount: "落とす数",
        dropSpecificAmount: "個数を指定して落とす",
        onlyStackedItems: "スタックされたアイテムでのみ利用できます",
      },
      inventoryDropCount: {
        title: "このスタックからいくつ落としますか？",
        chooseAmount: (max: number) => `1 から ${max} までの数を選んでください。`,
        ariaLabel: "落とす数",
        setMinimum: "最小数に設定",
        decrease: "1 減らす",
        increase: "1 増やす",
        setMaximum: "最大数に設定",
      },
      mobileActions: {
        extendedCommands: "拡張コマンド",
        commonCommands: "よく使うコマンド",
        allCommands: "すべてのコマンド",
        actions: "アクション",
        menu: "メニュー",
        close: "閉じる",
        wizardCommands: "Wizard コマンド",
        wizard: "Wizard",
        wizardCommandFallbackDescription:
          "\u3053\u306e Wizard \u5c02\u7528\u30c7\u30d0\u30c3\u30b0\u30b3\u30de\u30f3\u30c9\u3092\u5b9f\u884c\u3057\u307e\u3059\u3002",
        wizardCommandDetails: {
          levelchange: { name: "\u30ec\u30d9\u30eb\u5909\u66f4", description: "\u4e3b\u4eba\u516c\u306e\u7d4c\u9a13\u30ec\u30d9\u30eb\u3092\u8a2d\u5b9a\u3057\u307e\u3059\u3002" },
          lightsources: { name: "\u5149\u6e90", description: "\u79fb\u52d5\u3059\u308b\u5149\u6e90\u3092\u8868\u793a\u3057\u307e\u3059\u3002" },
          migratemons: { name: "\u79fb\u52d5\u4e2d\u306e\u30e2\u30f3\u30b9\u30bf\u30fc", description: "\u30ec\u30d9\u30eb\u9593\u3092\u79fb\u52d5\u3059\u308b\u30e2\u30f3\u30b9\u30bf\u30fc\u3092\u8868\u793a\u3057\u307e\u3059\u3002" },
          panic: { name: "\u30d1\u30cb\u30c3\u30af\u30c6\u30b9\u30c8", description: "\u30d1\u30cb\u30c3\u30af\u51e6\u7406\u3092\u8a66\u3057\u3001\u3053\u306e\u30b2\u30fc\u30e0\u3092\u7d42\u4e86\u3057\u307e\u3059\u3002" },
          polyself: { name: "\u81ea\u5206\u3092\u5909\u8eab", description: "\u4e3b\u4eba\u516c\u306e\u73fe\u5728\u306e\u59ff\u3092\u5909\u3048\u307e\u3059\u3002" },
          seenv: { name: "\u8996\u8a8d\u30d9\u30af\u30c8\u30eb", description: "\u8996\u8a8d\u30d9\u30af\u30c8\u30eb\u306e\u30c7\u30d0\u30c3\u30b0\u30de\u30c3\u30d7\u3092\u8868\u793a\u3057\u307e\u3059\u3002" },
          stats: { name: "\u30e1\u30e2\u30ea\u7d71\u8a08", description: "\u5b9f\u884c\u6642\u306e\u30e1\u30e2\u30ea\u7d71\u8a08\u3092\u8868\u793a\u3057\u307e\u3059\u3002" },
          timeout: { name: "\u30bf\u30a4\u30e0\u30a2\u30a6\u30c8\u5217", description: "\u6642\u9650\u4ed8\u304d\u52b9\u679c\u3068\u5185\u5728\u80fd\u529b\u3092\u8868\u793a\u3057\u307e\u3059\u3002" },
          vanquished: { name: "\u5012\u3057\u305f\u30e2\u30f3\u30b9\u30bf\u30fc", description: "\u6b7b\u3093\u3060\u30e2\u30f3\u30b9\u30bf\u30fc\u306e\u6570\u3092\u8868\u793a\u3057\u307e\u3059\u3002" },
          vision: { name: "\u8996\u754c\u914d\u5217", description: "\u73fe\u5728\u306e\u8996\u754c\u914d\u5217\u3092\u8868\u793a\u3057\u307e\u3059\u3002" },
          wizbury: { name: "\u8fd1\u304f\u306e\u7269\u3092\u57cb\u3081\u308b", description: "3x3 \u7bc4\u56f2\u306e\u5e8a\u306e\u7269\u3092\u57cb\u3081\u307e\u3059\u3002" },
          wizdetect: { name: "\u96a0\u3055\u308c\u305f\u3082\u306e\u3092\u691c\u51fa", description: "\u4e3b\u4eba\u516c\u306e\u8fd1\u304f\u306e\u96a0\u3055\u308c\u305f\u3082\u306e\u3092\u660e\u3089\u304b\u306b\u3057\u307e\u3059\u3002" },
          wizgenesis: { name: "\u30e2\u30f3\u30b9\u30bf\u30fc\u4f5c\u6210", description: "\u540d\u524d\u307e\u305f\u306f\u7a2e\u985e\u3067\u30e2\u30f3\u30b9\u30bf\u30fc\u3092\u4f5c\u6210\u3057\u307e\u3059\u3002" },
          wizidentify: { name: "\u6301\u3061\u7269\u8b58\u5225", description: "\u6301\u3061\u7269\u306e\u5168\u30a2\u30a4\u30c6\u30e0\u3092\u8b58\u5225\u3057\u307e\u3059\u3002" },
          wizintrinsic: { name: "\u5185\u5728\u80fd\u529b\u8a2d\u5b9a", description: "\u9078\u3093\u3060\u6642\u9650\u4ed8\u304d\u5185\u5728\u80fd\u529b\u3092\u8abf\u6574\u3057\u307e\u3059\u3002" },
          wizlevelport: { name: "\u30ec\u30d9\u30eb\u30c6\u30ec\u30dd\u30fc\u30c8", description: "\u5225\u306e\u30ec\u30d9\u30eb\u3084\u5206\u5c90\u3078\u30c6\u30ec\u30dd\u30fc\u30c8\u3057\u307e\u3059\u3002" },
          wizmakemap: { name: "\u30ec\u30d9\u30eb\u518d\u751f\u6210", description: "\u73fe\u5728\u306e\u30ec\u30d9\u30eb\u3092\u518d\u751f\u6210\u3057\u307e\u3059\u3002" },
          wizmap: { name: "\u30ec\u30d9\u30eb\u30de\u30c3\u30d7", description: "\u30ec\u30d9\u30eb\u306e\u5730\u56f3\u3068\u7f60\u3092\u8868\u793a\u3057\u307e\u3059\u3002" },
          wizrumorcheck: { name: "\u5642\u306e\u78ba\u8a8d", description: "\u771f\u3068\u507d\u306e\u5642\u30d5\u30a1\u30a4\u30eb\u3092\u691c\u8a3c\u3057\u307e\u3059\u3002" },
          wizsmell: { name: "\u30e2\u30f3\u30b9\u30bf\u30fc\u3092\u55c5\u3050", description: "\u9078\u3093\u3060\u30e2\u30f3\u30b9\u30bf\u30fc\u3092\u55c5\u304e\u307e\u3059\u3002" },
          wizwhere: { name: "\u7279\u6b8a\u30ec\u30d9\u30eb", description: "\u7279\u6b8a\u30ec\u30d9\u30eb\u306e\u914d\u7f6e\u3092\u8868\u793a\u3057\u307e\u3059\u3002" },
          wizwish: { name: "\u9858\u3044", description: "\u30a2\u30a4\u30c6\u30e0\u3001\u7f60\u3001\u307e\u305f\u306f\u5730\u5f62\u3092\u4f5c\u6210\u3057\u307e\u3059\u3002" },
          wmode: { name: "\u58c1\u30e2\u30fc\u30c9", description: "\u58c1\u30e2\u30fc\u30c9\u306e\u30c7\u30d0\u30c3\u30b0\u30c7\u30fc\u30bf\u3092\u8868\u793a\u3057\u307e\u3059\u3002" },
        },
        repeat: "繰り返し",
        character: "キャラクター",
        inventory: "インベントリ",
        log: "ログ",
        pickUp: "拾う",
        search: "探索",
        closeMessageLog: "メッセージログを閉じる",
      },
      positionPrompt: {
        closeLabel: "位置指定を閉じる",
        desktopHint:
          "移動入力を使うかタイルをクリックして選択を移動します。選択中のタイルをもう一度クリックするか、Enterキーで確定します。",
        mobileHint:
          "移動入力を使うかタイルをタップして選択を移動します。選択中のタイルをもう一度タップするか、Enterキーで確定します。",
        controllerHint:
          "移動入力で選択を移動します。Enterキーまたは決定ボタンで確定します。",
      },
      controllerSupport: {
        prompt: "コントローラーを検出しました。コントローラー対応を有効にしますか？",
      },
    },
  },
};

export const ja = mergeTranslations(en, jaOverrides);
