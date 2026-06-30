export const ru = {
  meta: {
    locale: "ru-RU",
  },
  common: {
    appName: "NetHack 3D",
    confirm: "Подтвердить",
    cancel: "Отмена",
    close: "Закрыть",
    back: "Назад",
    yes: "Да",
    no: "Нет",
    delete: "Удалить",
    edit: "Изменить",
    done: "Готово",
    resetToDefaults: "Сбросить по умолчанию",
    later: "Позже",
    checking: "Проверка...",
    downloading: "Загрузка...",
    canceling: "Отмена...",
    none: "Нет",
    off: "Выкл.",
    normal: "Обычный",
    fps: "FPS",
  },
  controller: {
    groups: {
      movement: "Движение",
      lookAndCamera: "Обзор и камера",
      actions: "Действия",
      dialogs: "Диалоги",
      system: "Система",
    },
    actions: {
      dpad_up: {
        label: "Крестовина вверх",
        description: "Перемещение вверх в диалогах и подсветке движения.",
      },
      dpad_down: {
        label: "Крестовина вниз",
        description: "Перемещение вниз в диалогах и подсветке движения.",
      },
      dpad_left: {
        label: "Крестовина влево",
        description: "Перемещение влево в диалогах и подсветке движения.",
      },
      dpad_right: {
        label: "Крестовина вправо",
        description: "Перемещение вправо в диалогах и подсветке движения.",
      },
      left_stick_up: {
        label: "Левый стик вверх",
        description: "Подсветка движения и виртуальный курсор вверх.",
      },
      left_stick_down: {
        label: "Левый стик вниз",
        description: "Подсветка движения и виртуальный курсор вниз.",
      },
      left_stick_left: {
        label: "Левый стик влево",
        description: "Подсветка движения и виртуальный курсор влево.",
      },
      left_stick_right: {
        label: "Левый стик вправо",
        description: "Подсветка движения и виртуальный курсор вправо.",
      },
      right_stick_up: {
        label: "Правый стик вверх",
        description: "Обзор, панорамирование камеры и прокрутка диалогов вверх.",
      },
      right_stick_down: {
        label: "Правый стик вниз",
        description: "Обзор, панорамирование камеры и прокрутка диалогов вниз.",
      },
      right_stick_left: {
        label: "Правый стик влево",
        description: "Обзор и панорамирование камеры влево.",
      },
      right_stick_right: {
        label: "Правый стик вправо",
        description: "Обзор и панорамирование камеры вправо.",
      },
      confirm: {
        label: "Подтвердить / щелчок",
        description: "Подтверждение движения и щелчок в диалогах.",
      },
      search: {
        label: "Искать",
        description: "Искать на текущем тайле, если предпросмотр движения не активен.",
      },
      cancel_or_context: {
        label: "Отмена / контекст",
        description: "Открыть контекстные действия или отменить текущий диалог.",
      },
      action_menu: {
        label: "Меню действий",
        description: "Открыть радиальное меню действий контроллера.",
      },
      run_modifier: {
        label: "Модификатор бега",
        description: "Удерживайте, чтобы отправить префикс бега перед движением.",
      },
      zoom_in: {
        label: "Масштаб (удерживать)",
        description:
          "Удерживайте, затем используйте левый стик вверх/вниз для зума, а правый стик для вращения камеры.",
      },
      recenter_camera: {
        label: "Центрировать камеру",
        description: "Вернуть камеру к центру игрока.",
      },
      toggle_large_minimap: {
        label: "Переключить большую миникарту",
        description: "Переключить очень большой размер миникарты.",
      },
      pause_menu: {
        label: "Меню паузы",
        description: "Открыть или закрыть меню паузы.",
      },
      open_inventory: {
        label: "Инвентарь",
        description: "Открыть окно инвентаря.",
      },
      open_character: {
        label: "Лист персонажа",
        description: "Открыть окно листа персонажа.",
      },
    },
    buttonLabels: {
      0: "A",
      1: "B",
      2: "X",
      3: "Y",
      4: "Левый бампер",
      5: "Правый бампер",
      6: "Левый триггер",
      7: "Правый триггер",
      8: "Назад / вид",
      9: "Старт / меню",
      10: "Нажатие левого стика",
      11: "Нажатие правого стика",
      12: "Крестовина вверх",
      13: "Крестовина вниз",
      14: "Крестовина влево",
      15: "Крестовина вправо",
      16: "Домой",
    },
    axisLabels: {
      0: "Левый стик X",
      1: "Левый стик Y",
      2: "Правый стик X",
      3: "Правый стик Y",
    },
    directions: {
      leftStickLeft: "Левый стик влево",
      leftStickRight: "Левый стик вправо",
      leftStickUp: "Левый стик вверх",
      leftStickDown: "Левый стик вниз",
      rightStickLeft: "Правый стик влево",
      rightStickRight: "Правый стик вправо",
      rightStickUp: "Правый стик вверх",
      rightStickDown: "Правый стик вниз",
    },
    unbound: "Не назначено",
    axisFallback: (axisIndex: number) => `Ось ${axisIndex}`,
    buttonFallback: (buttonIndex: number) => `Кнопка ${buttonIndex}`,
    slotLabel: (slotIndex: number) => `Слот ${slotIndex + 1}`,
    listening: "Нажмите элемент управления...",
    clear: "Очистить",
    controllerDetected: (count: number) => `Обнаружено контроллеров: ${count}.`,
    noControllerDetected: "Контроллер не обнаружен.",
  },
  startupInitOptions: {
    accordion: {
      summary: "Параметры инициализации (необязательно)",
      description:
        "Дополнительные записи NetHack `OPTIONS`, применяемые при запуске. Настройки, зависящие от оконного порта и платформы, намеренно опущены.",
      resetToDefaults: "Сбросить по умолчанию",
    },
    options: {
      playmode: {
        label: "Режим игры",
        description:
          "Выберите режим запуска. Режим wizard — это режим отладки NetHack (`playmode:debug`).",
        options: {
          normal: "Обычный",
          explore: "Исследование",
          debug: "Wizard/Отладка",
        },
      },
      number_pad: {
        label: "Клавиши движения",
        description:
          "Выберите, использовать ли для движения NetHack цифровую клавиатуру (`number_pad:1`) или традиционные клавиши vi (`number_pad:0`).",
        options: {
          numeric: "Цифровая клавиатура",
          vi: "Клавиши vi",
        },
      },
      autopickup: {
        label: "Автоподбор",
        description:
          "Автоматически подбирать классы предметов, выбранные в типах подбора.",
      },
      pickup_types: {
        label: "Типы подбора",
        description:
          'Символы классов предметов для автоподбора (пример: $"=/!?+). Оставьте пустым для игрового значения по умолчанию.',
        placeholder: '$"=/!?+',
      },
      pickup_thrown: {
        label: "Подбирать брошенные предметы",
        description: "Автоматически подбирать брошенные предметы после приземления.",
      },
      pickup_burden: {
        label: "Порог нагрузки для подбора",
        description:
          "Запрашивать подтверждение перед подбором, если будет превышен этот уровень нагрузки.",
        options: {
          u: "Без нагрузки (u)",
          b: "Нагружен (b)",
          s: "Напряжён (s)",
          n: "Перенапряжён (n)",
          t: "Перегружен (t)",
          l: "Полностью перегружен (l)",
        },
      },
      pile_limit: {
        label: "Предел кучи",
        description:
          "Порог количества предметов, при котором для куч на полу показывается всплывающий список.",
      },
      autoquiver: {
        label: "Автоколчан",
        description: "Автоматически заполнять колчан или готовить подходящее оружие при выстреле.",
      },
      autoopen: {
        label: "Автооткрытие",
        description: "Автоматически пытаться открыть двери при движении в них.",
      },
      autodig: {
        label: "Автокопание",
        description:
          "Автоматически прокапываться в стены, если это возможно и вы движетесь в них.",
      },
      cmdassist: {
        label: "Помощь по командам",
        description: "Показывать дополнительную справку, если команда введена с ошибкой.",
      },
      confirm: {
        label: "Подтверждать атаки",
        description: "Спрашивать перед атакой мирных существ.",
      },
      safe_pet: {
        label: "Безопасный питомец",
        description: "Спрашивать перед ударом по вашему питомцу.",
      },
      help: {
        label: "Справка в игре",
        description:
          "Предлагать показать дополнительные сведения при осмотре/справке, если доступна более подробная информация.",
      },
      legacy: {
        label: "Классическое вступление",
        description: "Показывать сюжетное вступление при начале новой игры.",
      },
      rest_on_space: {
        label: "Отдых по пробелу",
        description: "Считать клавишу пробела ожиданием/отдыхом.",
      },
      pushweapon: {
        label: "Сдвигать оружие",
        description: "Перемещать текущее оружие во вторую руку при смене.",
      },
      extmenu: {
        label: "Меню расширенных команд",
        description: "Использовать всплывающее меню для расширенных команд.",
      },
      fixinv: {
        label: "Фиксировать буквы инвентаря",
        description: "Стараться сохранять буквы инвентаря при перемещении предметов.",
      },
      implicit_uncursed: {
        label: "Показывать uncursed",
        description:
          "Всегда включать слово 'uncursed' в описания предметов в инвентаре.",
      },
      mention_walls: {
        label: "Сообщать о стенах",
        description: "Показывать сообщение при движении в стену.",
      },
      sortloot: {
        label: "Сортировка списков добычи",
        description:
          "Поведение сортировки для списков подбора и выбора предметов в инвентаре.",
        options: {
          f: "Полная",
          l: "Только добыча",
          n: "Нет",
        },
      },
      sortpack: {
        label: "Сортировать инвентарь",
        description: "Сортировать содержимое рюкзака по типу при показе инвентаря.",
      },
      msghistory: {
        label: "Размер истории сообщений",
        description: "Количество верхних строк сообщений, сохраняемых для просмотра.",
      },
      dogname: {
        label: "Имя собаки",
        description: "Имя по умолчанию для вашей первой собаки.",
        placeholder: "Шарик",
      },
      catname: {
        label: "Имя кошки",
        description: "Имя по умолчанию для вашей первой кошки.",
        placeholder: "Мурка",
      },
      horsename: {
        label: "Имя лошади",
        description: "Имя по умолчанию для вашей первой лошади.",
        placeholder: "Буцефал",
      },
      pettype: {
        label: "Предпочитаемый питомец",
        description: "Предпочитаемый начальный тип питомца для ролей с выбором.",
        options: {
          default: "Игровое значение",
          cat: "Кошка",
          dog: "Собака",
          horse: "Лошадь",
          none: "Нет",
        },
      },
      fruit: {
        label: "Предпочитаемый фрукт",
        description: "Название вида фрукта, который любит ваш персонаж.",
        placeholder: "слизневик",
      },
      packorder: {
        label: "Порядок рюкзака",
        description: "Порядок классов предметов, показываемых в инвентаре.",
        placeholder: '")[%?+/=!(*0_`',
      },
      paranoid_confirmation: {
        label: "Параноидальные подтверждения",
        description:
          "Дополнительные подтверждения через пробел (пример: confirm quit attack pray).",
        placeholder: "confirm quit attack pray",
      },
      sparkle: {
        label: "Искры сопротивления магии",
        description: "Показывать особые искры для сопротивления магии.",
      },
      standout: {
        label: "Выделение монстров/More",
        description: "Жирное выделение монстров и подсказок --More--.",
      },
      tombstone: {
        label: "Надгробие",
        description: "Показывать изображение надгробия при смерти.",
      },
      verbose: {
        label: "Подробные сообщения",
        description: "Использовать более полные формулировки сообщений о статусе и действиях.",
      },
    },
  },
  soundEffects: {
    byKey: {
      "player-walk": "Шаг игрока",
      hit: "Удар",
      "monster-killed": "Монстр убит (игрок)",
      "monster-killed-other": "Монстр убит (другой)",
      "missed-attack": "Промах",
      "thrown-weapon": "Брошенное оружие",
      "door-opens": "Дверь открывается",
      "door-closes": "Дверь закрывается",
      "door-kick": "Пинок по двери",
      "door-smash": "Ломание двери",
      "door-resists": "Дверь не поддаётся",
      "door-distant": "Дверь вдали",
      "walk-down-stairs": "Спуск по лестнице",
      "walk-up-stairs": "Подъём по лестнице",
      eating: "Еда",
      drink: "Питьё",
      "quaff-potion": "Выпить зелье",
      "pickup-gold": "Подобрать золото",
      "pickup-item": "Подобрать предмет",
      "find-hidden": "Найти скрытую дверь/проход",
      "level-up": "Повышение уровня",
      unlock: "Отпереть",
      "boulder-push": "Толкнуть валун",
      "boulder-blocked": "Валун заблокирован",
      splash: "Всплеск",
      searching: "Поиск",
      "magic-cast": "Применение магии",
      "magic-heal": "Лечение магией",
      "magic-buff": "Усиление магией",
    },
  },
  characterSheet: {
    titleFallback: "Лист персонажа",
    sectionTitles: {
      overview: "Обзор",
      background: "Предыстория",
      basics: "Основное",
      characteristics: "Текущие характеристики",
      status: "Текущее состояние",
      attributes: "Текущие эффекты",
    },
    statLabels: {
      strength: "Сила",
      dexterity: "Ловкость",
      constitution: "Телосложение",
      intelligence: "Интеллект",
      wisdom: "Мудрость",
      charisma: "Харизма",
    },
    commands: {
      enhance: {
        label: "Улучшить",
        detail: "Повысить навыки",
      },
      conduct: {
        label: "Аскезы",
        detail: "Показать прогресс испытаний",
      },
      overview: {
        label: "Обзор",
        detail: "Показать прогресс в подземелье",
      },
      spells: {
        label: "Заклинания",
        detail: "Просмотреть известные заклинания",
      },
      seespells: {
        label: "Книга заклинаний",
        detail: "Показать инвентарь заклинаний",
      },
      technique: {
        label: "Техника",
        detail: "Использовать способности роли/расы",
      },
      known: {
        label: "Открытия",
        detail: "Список известных предметов",
      },
      pray: {
        label: "Молиться",
        detail: "Попытаться помолиться",
      },
    },
  },
  castMenu: {
    schoolLabel: "Школа:",
    headings: {
      name: "Название",
      level: "Уровень",
      category: "Категория",
      fail: "Провал",
      retention: "Сохранение",
    },
    summary: {
      known: (count: number) => `Известно: ${count}`,
      castable: (count: number) => `Можно применить: ${count}`,
      bestSuccess: (percent: number) => `Лучший шанс ${percent}%`,
      averageFail: (percent: number) => `Сред. риск ${percent}%`,
      schoolCount: (count: number) => `Школ: ${count}`,
    },
    retention: {
      unknown: "Неизвестно",
      gone: "Утеряно",
      full: "100%",
    },
  },
  enhanceMenu: {
    defaultGroupTitle: "Навыки",
    availability: {
      available_now: "Доступно",
      needs_experience: "Опыт/слоты",
      needs_practice: "Практика",
      maxed_out: "Макс.",
    },
    summary: {
      available: (count: number) => `Доступно: ${count}`,
      gated: (count: number) => `Заблокировано опытом/слотами: ${count}`,
      practice: (count: number) => `Требуется практика: ${count}`,
      maxed: (count: number) => `Максимум: ${count}`,
    },
    maxLabel: "Макс.",
    slotCount: (count: number) => `Слотов: ${count}`,
  },
  app: {
    unknownTime: "Неизвестное время",
    debugSession: {
      possibleCrash: "возможный сбой",
      active: "активно",
    },
    debugLogs: {
      buildLabelAria: (
        buildLabel: string,
        currentCount: number,
        requiredCount: number,
      ) =>
        `Сборка ${buildLabel}. Прогресс скрытого переключателя журналирования отладки: ${currentCount} из ${requiredCount}.`,
      enabledToast: "Журнал отладки включён",
      enabledLogEntry:
        "Журнал отладки включён через пасхалку на метке сборки при запуске.",
      openLink: "Показать журналы отладки",
      clearedLogEntry: "Сохранённые журналы отладки очищены пользователем.",
    },
    statusEffects: {
      turningToStone: "Окаменение",
      slimed: "Покрыт слизью",
      strangled: "Удушье",
      foodPoisoning: "Пищевое отравление",
      terminallyIll: "Смертельно болен",
      blind: "Слепота",
      deaf: "Глухота",
      stunned: "Оглушение",
      confused: "Замешательство",
      hallucinating: "Галлюцинации",
      levitating: "Левитация",
      flying: "Полёт",
      riding: "Верхом",
      barehanded: "Без оружия",
      busy: "Занят",
      iron: "Железо",
      glowingHands: "Светящиеся руки",
      grabbed: "Схвачен",
      held: "Удерживается",
      icy: "Ледяной",
      inLava: "В лаве",
      paralyzed: "Парализован",
      sleeping: "Спит",
      slippery: "Скользкий",
      submerged: "Под водой",
      tethered: "Привязан",
      trapped: "В ловушке",
      unconscious: "Без сознания",
      woundedLegs: "Раненые ноги",
      holding: "Удерживает",
    },
    characterStats: {
      descriptions: {
        strength:
          "Влияет на урон в ближнем бою, грузоподъёмность и силовые действия.",
        dexterity:
          "Влияет на шанс попадания, взаимодействие с ловушками и защитную ловкость.",
        constitution:
          "Влияет на рост HP и сопротивление яду и высасыванию.",
        intelligence:
          "Влияет на чтение и успех многих действий, связанных с магией.",
        wisdom: "Влияет на рост магической энергии и надёжность колдовства.",
        charisma:
          "Влияет на торговлю, обращение с питомцами и социальные исходы.",
      },
      armorClassDescription:
        "Меньше — лучше. Класс брони снижает шанс попадания врагов по вам.",
    },
    directionHelp: {
      controller:
        "Щёлкните направление или используйте левый стик/крестовину для предпросмотра и отпустите для подтверждения. Центральный круг выбирает себя. Используйте < или > для лестниц. Нажмите ESC для отмены.",
      numpad:
        "Щёлкните направление. Центральный круг выбирает себя. Также можно использовать цифровую клавиатуру (1-4,6-9), стрелки, <, > или s. Нажмите ESC для отмены.",
      viKeys:
        "Щёлкните направление. Центральный круг выбирает себя. Также можно использовать hjkl/yubn, стрелки, <, > или s. Нажмите ESC для отмены.",
      fps: "Осмотритесь для прицеливания. Левый щелчок или W подтверждает. S выбирает себя. A/D или правый щелчок отменяет.",
    },
    inventoryContextActions: {
      apply: "Применить",
      invoke: "Вызвать",
      tip: "Опрокинуть",
      loot: "Обыскать",
      drop: "Выбросить",
      eat: "Съесть",
      quaff: "Выпить",
      read: "Читать",
      rub: "Потереть",
      throw: "Бросить",
      wield: "Взять в руку",
      quiver: "В колчан",
      wear: "Надеть",
      takeOff: "Снять",
      putOn: "Надеть",
      remove: "Снять",
      zap: "Разрядить",
      untrap: "Обезвредить",
      offer: "Поднести",
      name: "Назвать",
      call: "Дать имя",
      adjust: "Переложить",
      engrave: "Выгравировать",
      dip: "Окунуть",
      info: "Сведения",
      unwield: "Убрать из руки",
    },
    mobileActions: {
      wait: "Ждать",
      zap: "Разрядить",
      cast: "Колдовать",
      kick: "Пнуть",
      read: "Читать",
      quaff: "Выпить",
      eat: "Съесть",
      glance: "Взглянуть",
      loot: "Обыскать",
      open: "Открыть",
      wield: "Взять в руку",
      wear: "Надеть",
      putOn: "Надеть",
      takeOff: "Снять",
      extended: "Дополнительно",
    },
    clientOptions: {
      config: {
        groupControls: "Контроллер и вид от первого лица",
        sectionControlsController: "Контроллер",
        controllerEnabled: {
          label: "Включить поддержку контроллера",
          description: "Включить ввод с геймпада для игры и диалогов интерфейса.",
        },
        sectionControlsLook: "Обзор и камера",
        invertLookYAxis: {
          label: "Инвертировать обзор по оси Y",
          description: "Инвертировать вертикальный обзор мышью и касанием.",
        },
        fpsLookSensitivityX: {
          label: "Чувствительность FPS-обзора X",
          description: "Горизонтальная чувствительность обзора мышью/касанием.",
        },
        fpsLookSensitivityY: {
          label: "Чувствительность FPS-обзора Y",
          description: "Вертикальная чувствительность обзора мышью/касанием.",
        },
        snapCameraYawToNearest45: {
          label: "Доворачивать камеру до 45°",
          description:
            "Когда ввод поворота камеры отпускается, плавно доворачивать направление до ближайшего угла 45°.",
        },
        sectionControlsMovement: "Поведение движения",
        cameraRelativeMovement: {
          label: "Движение и свайпы относительно камеры",
          description:
            "Поворачивать клавиши движения и направления свайпов в зависимости от угла камеры по оси Y.",
        },
        fpsWasdKeyboardMovementEnabled: {
          label: "\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c WASD-\u0434\u0432\u0438\u0436\u0435\u043d\u0438\u0435 \u0441 \u043a\u043b\u0430\u0432\u0438\u0430\u0442\u0443\u0440\u044b \u0432 FPS",
          description:
            "\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u044c W/A/S/D \u0434\u043b\u044f \u0434\u0432\u0438\u0436\u0435\u043d\u0438\u044f \u043e\u0442 \u043f\u0435\u0440\u0432\u043e\u0433\u043e \u043b\u0438\u0446\u0430. \u041e\u0442\u043a\u043b\u044e\u0447\u0438\u0442\u0435, \u0447\u0442\u043e\u0431\u044b \u044d\u0442\u0438 \u043a\u043b\u0430\u0432\u0438\u0448\u0438 \u0440\u0430\u0431\u043e\u0442\u0430\u043b\u0438 \u043a\u0430\u043a \u043e\u0431\u044b\u0447\u043d\u044b\u0435 \u043a\u043e\u043c\u0430\u043d\u0434\u044b NetHack.",
        },
        controllerFpsMoveRepeatMs: {
          label: "Повтор движения левым стиком в FPS",
          description:
            "Задержка повтора движения для левого стика в режиме FPS (меньше — быстрее).",
        },
        groupInterface: "Интерфейс",
        locale: {
          label: "Язык",
          description:
            "Выберите язык интерфейса. Если поддерживается, по умолчанию используется регион браузера, иначе — английский.",
          options: {
            en: "Английский",
          },
        },
        sectionDisplayCamera: "Камера и перспектива",
        fpsMode: {
          label: "Режим от первого лица",
          description: "Использовать управление от первого лица и обзор мышью.",
        },
        fpsFlattenEntityBillboards: {
          label: "Сплющивать перекрывающиеся тайлы",
          description:
            "Сплющивать тайлы добычи и элементов подземелья, когда на них стоят монстры, питомцы или игрок. Отключите, чтобы перекрывающиеся спрайты оставались стоячими биллбордами. Тайлы Vulture всегда остаются стоячими.",
        },
        fpsHeldWeaponVisible: {
          label: "Показывать оружие в FPS",
          description: "Показывать спрайт оружия в руках в режиме от первого лица.",
        },
        showItemsUnderPlayerInOverheadTilesMode: {
          label: "Показывать предметы под игроком в верхнем режиме тайлов",
          description:
            "Показывать предметы и элементы пола под игроком в верхнем режиме тайлов, используя runtime-данные подложки глифов.",
        },
        fpsFov: {
          label: "Угол обзора FPS",
          description: "Настроить угол обзора камеры от первого лица.",
        },
        sectionDisplayGraphics: "Графика и рендеринг",
        tilesetMode: {
          label: "Отображение",
          description: "Использовать графические тайлы вместо ASCII.",
          options: {
            ascii: "ASCII-графика",
            tiles: "Тайлы",
          },
        },
        tilesetPath: {
          label: "Тайлсет",
          description: "Встроенные и загруженные тайлсеты.",
        },
        antialiasing: {
          label: "Сглаживание",
          description: "Режим сглаживания краёв для 3D-рендеринга.",
          options: {
            taa: "TAA",
            fxaa: "FXAA",
          },
        },
        lightingEnabled: {
          label: "Освещение",
          description:
            "Включить динамическое освещение сцены и затемнение подземелья. Отключите для более плоского, всегда освещённого изображения.",
        },
        blockAmbientOcclusion: {
          label: "Окклюзия окружения",
          description:
            "Добавляет лёгкое контактное затенение между блоками пола и стен.",
        },
        brightness: {
          label: "Яркость",
          description: "Настроить общую яркость сцены.",
        },
        contrast: {
          label: "Контраст",
          description: "Настроить общий контраст содержимого сцены.",
        },
        gamma: {
          label: "Гамма",
          description: "Настроить гамму отображения содержимого сцены.",
        },
        sectionDisplayInterface: "Интерфейс",
        uiFontScale: {
          label: "Масштаб шрифта интерфейса",
          description: "Масштабировать все размеры шрифтов игрового интерфейса относительно значений по умолчанию.",
        },
        disableAnimatedTransitions: {
          label: "Отключить анимированные переходы",
          description:
            "Отключить затухания, движение и анимации переходов интерфейса для более быстрых изменений UI.",
        },
        uiTileBackgroundRemoval: {
          label: "Удалять фон тайлов в интерфейсе",
          description:
            "Применять удаление фона тайла/хромакея к значкам тайлов в панелях интерфейса.",
        },
        desktopTouchInterfaceMode: {
          label: "Сенсорный интерфейс на ПК",
          description:
            "Показывать сенсорное управление на настольном ПК и выбирать портретную или альбомную раскладку.",
          options: {
            off: "Выкл.",
            portrait: "Портретный сенсорный UI",
            landscape: "Альбомный сенсорный UI",
          },
        },
        sectionDisplayMessages: "Сообщения и журнал",
        desktopMessageLogWindowScale: {
          label: "Масштаб окна журнала сообщений на ПК",
          description:
            "Масштабировать размер рамочного окна журнала сообщений на ПК без изменения размера шрифта.",
        },
        liveMessageLog: {
          label: "Живой журнал сообщений",
          description: "Показывать прокручивающийся внутриигровой журнал сообщений.",
        },
        showPersistentMobileMessageLog: {
          label: "\u041f\u043e\u043a\u0430\u0437\u044b\u0432\u0430\u0442\u044c \u043f\u043e\u0441\u0442\u043e\u044f\u043d\u043d\u044b\u0439 \u0436\u0443\u0440\u043d\u0430\u043b \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439",
          description:
            "\u041e\u0441\u0442\u0430\u0432\u043b\u044f\u0442\u044c \u043a\u043e\u043c\u043f\u0430\u043a\u0442\u043d\u044b\u0439 \u043c\u043e\u0431\u0438\u043b\u044c\u043d\u044b\u0439 \u0436\u0443\u0440\u043d\u0430\u043b \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0439 \u0432\u0438\u0434\u0438\u043c\u044b\u043c \u0432\u043e \u0432\u0440\u0435\u043c\u044f \u0438\u0433\u0440\u044b. \u041a\u043d\u043e\u043f\u043a\u0430 \u0416\u0443\u0440\u043d\u0430\u043b \u043f\u043e-\u043f\u0440\u0435\u0436\u043d\u0435\u043c\u0443 \u043e\u0442\u043a\u0440\u044b\u0432\u0430\u0435\u0442 \u0431\u043e\u043b\u044c\u0448\u043e\u0439 \u0436\u0443\u0440\u043d\u0430\u043b.",
        },
        rumbleEnabled: {
          label: "\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0432\u0438\u0431\u0440\u0430\u0446\u0438\u044e",
          description:
            "\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435\u0442 \u043a\u043e\u0440\u043e\u0442\u043a\u0443\u044e \u0442\u0430\u043a\u0442\u0438\u043b\u044c\u043d\u0443\u044e \u0432\u0438\u0431\u0440\u0430\u0446\u0438\u044e \u0434\u043b\u044f \u043d\u0430\u043d\u0435\u0441\u0435\u043d\u043d\u043e\u0433\u043e \u0438 \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u043d\u043e\u0433\u043e \u0443\u0440\u043e\u043d\u0430 \u043d\u0430 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u043c\u044b\u0445 \u043c\u043e\u0431\u0438\u043b\u044c\u043d\u044b\u0445 \u0443\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u0430\u0445.",
        },
        sectionMobileSafeZone: "\u041c\u043e\u0431\u0438\u043b\u044c\u043d\u044b\u0435 \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u044b\u0435 \u0437\u043e\u043d\u044b",
        manualMobileBottomSafeZoneEnabled: {
          label:
            "\u0417\u0430\u043c\u0435\u043d\u0438\u0442\u044c \u043e\u0431\u043d\u0430\u0440\u0443\u0436\u0435\u043d\u043d\u044b\u0435 \u043c\u043e\u0431\u0438\u043b\u044c\u043d\u044b\u0435 \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u044b\u0435 \u0437\u043e\u043d\u044b",
          description:
            "\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0435\u0442 \u0440\u0443\u0447\u043d\u044b\u0435 \u043e\u0442\u0441\u0442\u0443\u043f\u044b \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u044b\u0445 \u0437\u043e\u043d, \u043a\u043e\u0433\u0434\u0430 Android-\u043f\u043e\u0440\u0442\u0430\u0442\u0438\u0432\u044b \u043d\u0435\u0432\u0435\u0440\u043d\u043e \u0441\u043e\u043e\u0431\u0449\u0430\u044e\u0442 \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u044b\u0435 \u043e\u0431\u043b\u0430\u0441\u0442\u0438.",
        },
        manualMobileBottomSafeZoneVerticalPx: {
          label:
            "\u041d\u0438\u0436\u043d\u044f\u044f \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u0430\u044f \u0437\u043e\u043d\u0430 \u0434\u043b\u044f \u0432\u0435\u0440\u0442\u0438\u043a\u0430\u043b\u044c\u043d\u043e\u0439 \u043e\u0440\u0438\u0435\u043d\u0442\u0430\u0446\u0438\u0438",
          description:
            "\u0420\u0443\u0447\u043d\u0430\u044f \u043d\u0438\u0436\u043d\u044f\u044f \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u0430\u044f \u0437\u043e\u043d\u0430 \u0434\u043b\u044f \u0432\u0435\u0440\u0442\u0438\u043a\u0430\u043b\u044c\u043d\u043e\u0439 \u043c\u043e\u0431\u0438\u043b\u044c\u043d\u043e\u0439 \u0440\u0430\u0441\u043a\u043b\u0430\u0434\u043a\u0438.",
        },
        manualMobileBottomSafeZoneHorizontalPx: {
          label:
            "\u041d\u0438\u0436\u043d\u044f\u044f \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u0430\u044f \u0437\u043e\u043d\u0430 \u0434\u043b\u044f \u0433\u043e\u0440\u0438\u0437\u043e\u043d\u0442\u0430\u043b\u044c\u043d\u043e\u0439 \u043e\u0440\u0438\u0435\u043d\u0442\u0430\u0446\u0438\u0438",
          description:
            "\u0420\u0443\u0447\u043d\u0430\u044f \u043d\u0438\u0436\u043d\u044f\u044f \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u0430\u044f \u0437\u043e\u043d\u0430 \u0434\u043b\u044f \u0433\u043e\u0440\u0438\u0437\u043e\u043d\u0442\u0430\u043b\u044c\u043d\u043e\u0439 \u043c\u043e\u0431\u0438\u043b\u044c\u043d\u043e\u0439 \u0440\u0430\u0441\u043a\u043b\u0430\u0434\u043a\u0438.",
        },
        manualMobileRightSafeZoneHorizontalPx: {
          label:
            "\u041f\u0440\u0430\u0432\u0430\u044f \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u0430\u044f \u0437\u043e\u043d\u0430 \u0434\u043b\u044f \u0433\u043e\u0440\u0438\u0437\u043e\u043d\u0442\u0430\u043b\u044c\u043d\u043e\u0439 \u043e\u0440\u0438\u0435\u043d\u0442\u0430\u0446\u0438\u0438",
          description:
            "\u0420\u0443\u0447\u043d\u0430\u044f \u043f\u0440\u0430\u0432\u0430\u044f \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u0430\u044f \u0437\u043e\u043d\u0430 \u0434\u043b\u044f \u0433\u043e\u0440\u0438\u0437\u043e\u043d\u0442\u0430\u043b\u044c\u043d\u043e\u0439 \u043c\u043e\u0431\u0438\u043b\u044c\u043d\u043e\u0439 \u0440\u0430\u0441\u043a\u043b\u0430\u0434\u043a\u0438.",
        },
        manualMobileBottomSafeZonePreview:
          "\u041d\u0438\u0436\u043d\u044f\u044f \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u0430\u044f \u0437\u043e\u043d\u0430",
        manualMobileRightSafeZonePreview:
          "\u041f\u0440\u0430\u0432\u0430\u044f \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u0430\u044f \u0437\u043e\u043d\u0430",
        liveMessageDisplayTimeMs: {
          label: "Время показа живого сообщения",
          description:
            "Время, в течение которого плавающее сообщение остаётся полностью видимым перед затуханием.",
        },
        liveMessageFadeOutTimeMs: {
          label: "Время затухания живого сообщения",
          description: "Длительность анимации затухания плавающего сообщения.",
        },
        liveMessageLogFontScale: {
          label: "Масштаб шрифта живых сообщений",
          description:
            "Масштабировать всплывающие сообщения действий относительно размера по умолчанию.",
        },
        sectionDisplayMinimap: "Миникарта",
        minimap: {
          label: "Миникарта",
          description: "Показывать или скрывать миникарту подземелья.",
        },
        minimapScale: {
          label: "Масштаб миникарты",
          description: "Масштабировать размер миникарты относительно значения по умолчанию.",
        },
        sectionDisplayInventory: "Отображение инвентаря",
        reduceInventoryMotion: {
          label: "Уменьшить анимацию инвентаря",
          description:
            "Отключить анимированное раскрытие строк инвентаря и использовать более простые взаимодействия.",
        },
        inventoryTileOnlyMotion: {
          label: "Анимировать только тайлы инвентаря",
          description:
            "Анимировать значки тайлов, сохраняя фиксированными высоту строк и интервалы инвентаря.",
        },
        inventoryFixedTileSize: {
          label: "Фиксированный размер тайлов инвентаря",
          description:
            "Применяется только при включённом уменьшении анимации инвентаря. Выберите фиксированный размер значка.",
          options: {
            none: "Нет",
            small: "Маленький",
            medium: "Средний",
            large: "Большой",
          },
        },
        groupSound: "Звук",
        soundEnabled: {
          label: "Включить звук",
          description:
            "Включить или выключить звук FMOD. Отключение уменьшает нагрузку обработки звука на слабых устройствах.",
        },
        groupMobileControls: "Мобильное управление",
        invertTouchPanningDirection: {
          label: "Инвертировать направление панорамирования",
          description: "Изменить направление перетаскивания для панорамирования после удержания.",
        },
        groupCombat: "Боевая отдача",
        damageNumbers: {
          label: "Числа урона",
          description: "Показывать плавающие числа урона и лечения.",
        },
        displayStatChangesAbovePlayer: {
          label: "Показывать изменения характеристик над игроком",
          description:
            "Показывать плавающие подписи для изменений характеристик, таких как Сила и AC.",
        },
        displayXpGainsAbovePlayer: {
          label: "Показывать получение XP над игроком",
          description:
            "Показывать плавающие подписи получения опыта при его увеличении.",
        },
        tileShakeOnHit: {
          label: "Тряска тайла при ударе",
          description: "Трясти тайлы удара при успешных атаках.",
        },
        sectionCombatBlood: "Эффекты крови",
        blood: {
          label: "Кровь",
          description: "Отрисовывать туман крови и брызги на полу при попаданиях.",
        },
        bloodMist: {
          label: "Туман крови",
          description: "Отрисовывать частицы тумана крови в воздухе при попаданиях.",
        },
        bloodGround: {
          label: "Брызги крови",
          description:
            "Отрисовывать брызги крови на тайлах пола подземелья после попаданий.",
        },
        bloodStrength: {
          label: "Сила крови",
          description: "Управлять насыщенностью текстур и оттенков крови.",
        },
        bloodDetail: {
          label: "Детализация крови",
          description:
            "Выберите разрешение текстуры кровавых пятен для каждого тайла подземелья.",
          options: {
            veryLow: "Очень низкая",
            low: "Низкая",
            medium: "Средняя",
            high: "Высокая",
          },
        },
        bloodColorLightHex: {
          label: "Светлый оттенок свежей крови на полу",
          description:
            "Выберите более яркий оттенок крови, используемый в свежих пятнах на полу.",
        },
        bloodColorDarkHex: {
          label: "Тёмный оттенок крови на полу",
          description:
            "Выберите более тёмный оттенок крови, используемый в плотных кровавых участках на полу.",
        },
        bloodMistColorHex: {
          label: "Оттенок тумана крови",
          description: "Выберите базовый оттенок тумана крови в воздухе.",
        },
        monsterShatter: {
          label: "Разлет монстров",
          description:
            "Разбивать биллборды побеждённых монстров на физические осколки.",
        },
        monsterShatterBloodBorders: {
          label: "Кровавые края осколков",
          description:
            "Окрашивать пиксели осколков у линий раскола случайными кроваво-красными краями.",
        },
        groupCompatibility: "Совместимость runtime",
        darkCorridorWalls367: {
          label: "Классические тёмные стены коридоров",
          description:
            "Определять и кэшировать тайлы тёмных стен коридоров для устаревших runtime NetHack 3.4.3/3.6.x, включая Slash'EM.",
        },
        overrideNh5DarkCorridorWallTiles: {
          label: "Переопределять тёмные стены NetHack 5.0",
          description:
            "Применять настройки переопределения тёмных стен к тайлам тёмных коридорных стен NetHack 5.0.",
        },
        darkCorridorWallTileOverrideEnabled: {
          label: "Переопределить тайл тёмной стены",
          description:
            "Использовать пользовательский тайл атласа для переопределения тёмных стен, сохраняемый отдельно для каждого тайлсета.",
        },
        darkCorridorWallSolidColorOverrideEnabled: {
          label: "Использовать сплошной цвет для тёмных стен",
          description: "Использовать выбранный RGB-цвет вместо тайла тайлсета.",
        },
      },
      tabs: {
        display: {
          label: "Отображение",
          description: "Настройки интерфейса и отображения.",
        },
        mobile: {
          label: "Мобильное",
          description:
            "\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0438\u043d\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u0430 \u0438 \u0438\u0433\u0440\u044b \u0434\u043b\u044f \u043c\u043e\u0431\u0438\u043b\u044c\u043d\u043e\u0433\u043e \u0440\u0435\u0436\u0438\u043c\u0430.",
        },
        controls: {
          label: "Управление",
          description: "Назначения контроллера, режим FPS и поведение обзора.",
        },
        sound: {
          label: "Звук",
          description: "Настройки вывода звука и производительности аудио.",
        },
        combat: {
          label: "Бой",
          description: "Боевая отдача и визуальная реакция.",
        },
        compatibility: {
          label: "Совместимость",
          description: "Переключатели совместимости runtime и поведения NetHack.",
        },
        updates: {
          label: "Обновления",
          description:
            "Проверка онлайн-обновлений игры и просмотр ожидающих изменений.",
        },
      },
    },
    update: {
      loading: {
        startupData: "Загрузка стартовых данных...",
        tileset: "Загрузка тайлсета...",
        runtime: "Запуск локального runtime...",
      },
      runtimeStoppedBeforeStartup:
        "Локальный runtime NetHack остановился до завершения запуска.",
      preparingDownload: "Подготовка проверки версии...",
      idleStatus: "Проверка версии бездействует.",
      fileProgress: (index: number, count: number) => `Файл ${index} из ${count}`,
      unexpectedCheckFailure: "Непредвиденная ошибка проверки обновлений.",
      cancelRequested: "Запрошена отмена.",
      stoppingActiveDownloadTask: "Остановка активной задачи загрузки.",
      unableToCancelDownload: "Не удалось отменить загрузку обновления.",
      noActiveDownloadToCancel: "Нет активной загрузки обновления для отмены.",
      startingDownload: "Запуск загрузки обновления игры.",
      canceled: "Загрузка обновления отменена.",
      unableToDownloadAndApply: "Не удалось загрузить и применить обновления.",
      failed: "Обновление не удалось.",
      latestAlreadyInstalled: "Последнее обновление уже установлено.",
      downloadComplete: "Загрузка обновления завершена.",
      nothingAppliedTryAgain:
        "Обновления не были применены. Попробуйте выполнить проверку снова.",
      noFilesApplied: "Ни один файл обновления не был применён.",
      unexpectedFailure: "Непредвиденный сбой обновления.",
      checkingForUpdates: "Проверка релизов GitHub...",
      unsupportedPlatform:
        "Проверка релизов GitHub недоступна на этой платформе.",
      latestAlreadyInstalledOptions:
        "У вас уже установлена новейшая версия игры.",
      oneUpdateAvailable:
        "Доступна более новая версия игры. Хотите обновиться?",
      manyUpdatesAvailable: (count: number) =>
        `Доступно новых версий игры: ${count}. Хотите обновиться?`,
      updateCheckFailed: (message: string) =>
        `Проверка релизов GitHub не удалась: ${message}`,
    },
    saves: {
      sections: {
        manual: "Ручные сохранения",
        autosave: "Автосохранения",
      },
      deleteTitle: "Удалить сохранённую игру?",
      deleteMessage: (name: string) =>
        `Вы уверены, что хотите удалить ${name}?`,
      overwriteTitle: "Перезаписать сохранённую игру?",
      overwriteMessage: (name: string) =>
        `Сохранённая игра с именем "${name}" уже существует. Перезаписать её новым персонажем?`,
      errorLoading: "Ошибка загрузки сохранений",
      loading: "Загрузка сохранений...",
      noneFound: "Сохранённые игры не найдены.",
      savedAt: (date: string) => `Сохранено: ${date}`,
    },
    tilesets: {
      userTileset: "Пользовательский тайлсет",
      currentSelectionFallback: "этот тайлсет",
      deleteUploadedTitle: "Удалить загруженный тайлсет?",
      deleteUploadedMessage: (label: string) =>
        `Удалить '${label}' из загруженных тайлсетов?`,
      failedToDelete: "Не удалось удалить тайлсет.",
      chooseFile: "Выберите файл тайлсета PNG/BMP/GIF/JPEG.",
      provideName: "Укажите имя для этого тайлсета.",
      failedToSave: "Не удалось сохранить тайлсет.",
      failedToLoadUploaded: "Не удалось загрузить загруженные тайлсеты:",
      userTilesetSuffix: "Пользовательский тайлсет (польз.)",
      noTilesetsFound: "Тайлсеты не найдены",
      failedToReadImage: "Не удалось прочитать изображение тайлсета.",
    },
    tilePicker: {
      noAtlasAvailable: "Атлас тайлсета недоступен.",
      unableToLoadAtlas: "Не удалось загрузить атлас тайлов.",
      atlasLoaded: "Атлас тайлов загружен.",
      loadingAtlas: "Загрузка атласа тайлов...",
      selectedTile: (tileId: number) => `Выбрано: тайл #${tileId}`,
      glyph: (label: string) => `Глиф ${label}`,
      tile: (tileId: number) => `Тайл ${tileId}`,
      defaultBadge: "По умолчанию",
      resetToDefault: "Сбросить по умолчанию",
      darkWallTitle: "Выбор тайла тёмной стены",
      closeDarkWall: "Закрыть выбор тайла тёмной стены",
      closeBackground: "Закрыть выбор фонового тайла тайлсета",
      backgroundHelper:
        "Используется для удаления общего фона тайлсета у биллбордов монстров и добычи.",
      backgroundTitle: "Выбор фонового тайла тайлсета",
      backgroundTitleWithLabel: (label: string) =>
        `Выбор фонового тайла тайлсета: ${label}`,
      closeSolidColor: "Закрыть выбор сплошного цвета хромакея",
      solidColorTitle: "Выбор сплошного цвета хромакея",
      solidColorTitleWithLabel: (label: string) =>
        `Выбор сплошного цвета хромакея: ${label}`,
    },
    soundPack: {
      discardChangesTitle: "Отменить изменения набора звуков?",
      discardChangesMessage:
        "Отменить несохранённые изменения набора звуков и продолжить?",
      discard: "Отменить",
      keepEditing: "Продолжить редактирование",
      failedToLoadIndexedDb: "Не удалось загрузить наборы звуков из IndexedDB.",
      failedToSelectRequested: "Не удалось выбрать запрошенный набор звуков.",
      provideName: "Укажите имя набора звуков.",
      created: (name: string) => `Набор звуков '${name}' создан.`,
      failedToCreate: "Не удалось создать набор звуков.",
      saved: (name: string) => `Набор звуков '${name}' сохранён.`,
      failedToSave: "Не удалось сохранить набор звуков.",
      failedToExportZip: "Не удалось экспортировать ZIP набора звуков.",
      exported: (name: string) => `Экспортировано: '${name}'.`,
      failedToImportZip: "Не удалось импортировать ZIP набора звуков.",
      imported: (name: string) => `Импортировано: '${name}'.`,
      deleteTitle: "Удалить набор звуков?",
      deleteMessage: (name: string) =>
        `Удалить набор звуков '${name}'? Это действие необратимо.`,
      deleted: (name: string) => `Набор звуков '${name}' удалён.`,
      failedToDelete: "Не удалось удалить набор звуков.",
      noPreviewSource: "Для этого звука нет источника предпросмотра.",
      unableToPreview: "Не удалось воспроизвести этот звук.",
      title: "Наборы звуков",
      activePack: "Активный набор звуков",
      activePackDescription:
        "Выберите активный набор звуков, используемый для разрешения путей к звукам.",
      createNew: "Создать новый набор звуков",
      createDescription:
        "Создать пользовательский набор звуков, переопределяющий значения по умолчанию.",
      createNameLabel: "Имя нового набора звуков",
      createPlaceholder: "Мой набор звуков",
      createAndSave: "Создать и сохранить",
      packName: "Имя набора",
      packNameDescription:
        "Переименуйте этот набор и сохраните, чтобы обновить пространство имён его звуковых файлов.",
      savePack: "Сохранить набор звуков",
      export: "Экспортировать набор звуков",
      import: "Импортировать набор звуков",
      deletePack: "Удалить набор звуков",
      stopPreview: "Остановить предпросмотр",
      loading: "Загрузка наборов звуков...",
      pendingSaveSuffix: " (ожидает сохранения)",
      defaultSuffix: " (по умолчанию)",
      customSuffix: " (пользовательский)",
      noBundledSound: "Нет встроенного звука",
      enableSoundAria: (label: string) => `Включить ${label}`,
      volumeAria: (label: string) => `Громкость для ${label}`,
      play: "Воспроизвести",
      playing: "Воспроизведение...",
      volume: "Громкость",
      remove: "Удалить",
      replace: "Заменить",
      soundFile: "Звуковой файл",
      reset: "Сбросить",
      attribution: "Указание авторства",
      attributionAria: (label: string) => `Указание авторства для ${label}`,
      attributionPlaceholder: "Источник, автор или сведения о лицензии",
      addVariation: "+ Добавить вариант",
    },
    dialogs: {
      pauseMenu: {
        saveBeforeQuit: "Хотите сохранить игру перед выходом?",
        title: "Игра на паузе",
        resume: "Продолжить",
        options: "Параметры",
        saveGame: "Сохранить игру",
        exitToMainMenu: "Выйти в главное меню",
        quitGame: "Выйти из игры",
      },
      debugLogs: {
        closeLabel: "Закрыть журналы отладки",
        title: "Сохранённые журналы отладки",
        hint: "Журналы сохраняются только после включения скрытого переключателя журналирования отладки.",
        showingEntries: (count: number, startedAt: string) =>
          `Показано записей: ${count}, начиная с ${startedAt}.`,
        noneSaved: "Сохранённых журналов отладки пока нет.",
        refresh: "Обновить",
        clearLogs: "Очистить журналы",
      },
      startupUpdate: {
        maintenanceNotice: "Более новых релизов GitHub не найдено.",
        summaryAvailable:
          "Доступна более новая версия игры. Хотите обновиться?",
        summaryNone: "У вас уже установлена новейшая версия игры.",
        currentVersion: (version: string) => `Текущая версия: ${version}`,
        latestVersion: (version: string) => `Последний релиз GitHub: ${version}`,
        disableAtStartup:
          "Больше не показывать эти уведомления при запуске.",
        disabledNotice:
          "Уведомления о релизах при запуске отключены. Их можно снова включить в параметрах.",
        clientUpgradeRequired:
          "Для новейших улучшений платформы также требуется полное обновление клиента.",
        progressTitle: "Состояние загрузки обновления",
        canceling: "Отмена загрузки обновления...",
        noActiveTransfer: "Нет активной передачи файлов.",
        waitingForUpdater: "Ожидание активности обновлятора.",
        pendingUpdates: "Ожидающие обновления",
        payloadAvailable: "Полезная нагрузка обновления доступна.",
        downloadUpdates: "Загрузить обновления",
        hideDetails: "Скрыть подробности",
        moreDetails: "Подробнее",
        cancelDownload: "Отменить загрузку",
      },
      startup: {
        chooseVariant: "Выберите вариант NetHack:",
        options: "Параметры NetHack 3D",
        quitGame: "Выйти из игры",
        chooseSetup: "Выберите настройку персонажа:",
        randomCharacter: "Случайный персонаж",
        createCharacter: "Создать персонажа",
        loadGame: "Загрузить игру",
        selectSavedGame: "Выберите сохранённую игру:",
        enterRandomName: "Введите имя для случайного персонажа:",
        createCharacterPrompt: "Создайте персонажа:",
        name: "Имя",
        role: "Роль",
        race: "Раса",
        gender: "Пол",
        alignment: "Мировоззрение",
        startGame: "Начать игру",
      },
      clientOptions: {
        closeLabel: "Закрыть параметры NetHack 3D",
        title: "Параметры клиента NetHack 3D",
        categoriesLabel: "Категории настроек",
        updates: {
          checkOnLaunchLabel: "Показывать уведомления о релизах GitHub при запуске",
          checkOnLaunchDescription:
            "Проверяет релизы GitHub при запуске и сообщает, когда доступен более новый релиз.",
          title: "Релизы GitHub",
          description:
            "Сравнить эту сборку с опубликованными релизами GitHub.",
          idle: "Нажмите «Проверить обновления», чтобы сравнить эту сборку с релизами GitHub.",
          button: "Проверить обновления",
          openGitHubReleases: "Открыть релизы GitHub",
        },
        buttons: {
          manageTileSets: "Управление тайлсетами",
          remapController: "Переназначить контроллер",
          resetControllerDefaults: "Сбросить назначения контроллера",
        },
        hints: {
          darkWallsAlwaysEnabled:
            " Всегда включено, пока активны тайлы Vulture.",
          darkWallsDisabledByVulture:
            " Отключено, пока активны тайлы Vulture.",
          enableDarkWallsFirst:
            " Сначала включите классические тёмные стены коридоров или переопределение тёмных стен NetHack 5.0.",
          enableFpsFirst: " Сначала включите режим от первого лица в разделе «Отображение».",
        },
        darkWallControls: {
          normal: "Обычный",
          fps: "От первого лица",
          normalAria: "Сплошной цвет тёмной стены (обычный режим)",
          fpsAria: "Сплошной цвет тёмной стены (режим FPS)",
          gridLines: "Линии сетки",
          intensity: "Интенсивность",
        },
        controllerRemap: {
          title: "Переназначение контроллера",
          closeLabel: "Закрыть переназначение контроллера",
          hint: "Выберите слот, затем нажмите кнопку или сдвиньте стик. У каждого действия два слота.",
          listeningFor: (label: string, slot: number) =>
            `Ожидание ввода для ${label} (слот ${slot}). Нажмите ESC для отмены.`,
        },
        resetPrompt:
          "Сбросить параметры NetHack 3D к значениям по умолчанию? Пользовательские тайлсеты будут сохранены.",
      },
      tilesetManager: {
        closeLabel: "Закрыть менеджер тайлсетов",
        title: "Управление тайлсетами",
        description:
          "Добавляйте тайлсеты и редактируйте настройки фона/хромы для каждого тайлсета.",
        createTitle: "Создать новый тайлсет",
        editTitle: "Редактировать тайлсет",
        editTitleWithName: (label: string) => `Редактировать тайлсет: ${label}`,
        tileSetName: "Имя тайлсета",
        tileSetPlaceholder: "Мой тайлсет",
        builtInNamesLocked: "Имена встроенных тайлсетов нельзя изменять.",
        tileLayoutVersion: "Версия раскладки тайлов",
        layout367: "Раскладка NetHack 3.6.7",
        layout5: "Раскладка NetHack 5.0",
        tileLayoutDescription:
          "Выберите раскладку индексов тайлов, используемую этим загруженным атласом.",
        tileImage: "Изображение тайлсета",
        tileImageOptional: "Изображение тайлсета (необязательная замена)",
        selectedFile: (fileName: string) => `Выбрано: ${fileName}`,
        currentFile: (fileName: string) => `Текущий: ${fileName}`,
        uploadedImage: "загруженное изображение",
        weaponSpriteFlip: "Отразить спрайт оружия в FPS",
        weaponSpriteFlipDescription:
          "Горизонтально отразить спрайт оружия в руках для этого тайлсета. По умолчанию включено.",
        backgroundRemovalDescription:
          "Настройте удаление фона биллбордов для этого тайлсета или оставьте оба режима выключенными, чтобы сохранить фон атласа нетронутым.",
        backgroundTileRemoval: "Удаление фонового тайла",
        backgroundTileRemovalDescription:
          "Использовать выбранный тайл атласа для удаления фона биллбордов.",
        solidChromaKey: "Сплошной хромакей",
        solidChromaKeyDescription:
          "Использовать один сплошной RGB-цвет для удаления фона биллбордов.",
        clickToPickFromAtlas: "щёлкните, чтобы выбрать из атласа",
        saveFirstThenEdit:
          "Сначала сохраните новый тайлсет, затем редактируйте настройки фона/хромы.",
        createTileSet: "Создать тайлсет",
        saveTileSet: "Сохранить тайлсет",
        saveTileSettings: "Сохранить настройки тайлов",
        importNewTileSet: "+ Импортировать новый тайлсет",
        noUploadedTilesets: "Загруженные тайлсеты недоступны.",
        selectedSuffix: " (выбран)",
        editingSuffix: " (редактируется)",
        uploadedDetails: (fileName: string, layout: string) =>
          `${fileName} | загружено | раскладка ${layout}`,
        builtInDetails: (path: string) => `${path} | встроенный`,
      },
      textInput: {
        cancelLabel: "Отменить ввод текста",
        placeholder: "Введите текст",
        ok: "ОК",
      },
      question: {
        cancelPrompt: "Отменить запрос",
        selectAll: "Выбрать всё",
        deselectAll: "Снять выделение",
        page: (current: number, total: number) => `Страница ${current} / ${total}`,
        amount: "Amount",
        amountDefault: "Default",
        clearAmount: "Clear amount",
        decreaseAmount: "Decrease amount by one",
        increaseAmount: "Increase amount by one",
        pageHintMultiple:
          "Используйте < и > для смены страниц. Нажмите ESC для отмены",
        pageHintSingle: "Нажмите ESC для отмены",
        choices: {
          leftRingFinger: "Левый безымянный палец",
          rightRingFinger: "Правый безымянный палец",
          here: "Здесь",
          onGround: "На земле",
          eligibleItems: "Подходящие предметы",
          allInventory: "Весь инвентарь",
        },
      },
      runtimeStartError: {
        closeLabel: "Вернуться в главное меню",
        title: "Не удалось инициализировать NetHack.",
        returnToMainMenu: "Вернуться в главное меню",
      },
      newGamePrompt: {
        closeLabel: "Закрыть запрос новой игры",
        title: "Вернуться в главное меню?",
        reasonFallback: "Игра окончена",
      },
      direction: {
        cancelLabel: "Отменить выбор направления",
      },
      info: {
        closeCharacter: "Закрыть окно персонажа",
        closeInformation: "Закрыть окно информации",
        characterTitle: "Персонаж",
        experienceProgress: "Прогресс опыта",
        levelLabel: (level: number) => `Уровень ${level}`,
        xpAtMaxLevel: (xp: string) => `XP ${xp} (достигнут максимальный уровень)`,
        xpToNextLevel: (xp: string, next: string, remaining: string) =>
          `XP ${xp} / ${next} • до следующего уровня: ${remaining}`,
        vitals: "Показатели",
        characteristics: "Характеристики",
        currentLimit: "Текущее / предел",
        armorClass: "Класс брони",
        currentStatus: "Текущее состояние",
        noActiveStatus: "Нет активных состояний.",
        currentAttributes: "Текущие эффекты",
        noTemporaryAttributes: "Нет временных эффектов характеристик.",
        characterActions: "Действия персонажа",
        inventory: "Инвентарь",
        inventoryDetail: "Открыть переносимые предметы",
        closeHint:
          "Нажмите SPACE, ENTER или ESC, чтобы закрыть. Нажмите Ctrl+M, чтобы открыть снова.",
        infoTitleFallback: "Информация NetHack",
        noDetails: "(Нет подробностей)",
      },
      inventory: {
        closeLabel: "Закрыть инвентарь",
        title: "ИНВЕНТАРЬ",
        empty: "Ваш инвентарь пуст.",
        unknownItem: "Неизвестный предмет",
        closeHint: "Нажмите ENTER, ESC или 'i', чтобы закрыть.",
        closeHintWithContext:
          "Выберите предмет, чтобы открыть контекстные команды. Нажмите ENTER, ESC или 'i', чтобы закрыть",
      },
      inventoryDropMenu: {
        title: "Выбросить",
        dropType: "Тип выброса",
        dropAmount: "Количество",
        dropSpecificAmount: "Выбросить определённое количество",
        onlyStackedItems: "Доступно только для предметов в стопке",
      },
      inventoryDropCount: {
        title: "Сколько выбросить из этой стопки?",
        chooseAmount: (max: number) => `Выберите количество от 1 до ${max}.`,
        ariaLabel: "Количество для выброса",
        setMinimum: "Установить минимальное количество",
        decrease: "Уменьшить количество на один",
        increase: "Увеличить количество на один",
        setMaximum: "Установить максимальное количество",
      },
      mobileActions: {
        extendedCommands: "Расширенные команды",
        commonCommands: "Частые команды",
        allCommands: "Все команды",
        actions: "Действия",
        menu: "Меню",
        close: "Закрыть",
        wizardCommands: "Команды wizard",
        wizard: "Волшебник",
        wizardCommandFallbackDescription:
          "\u0412\u044b\u043f\u043e\u043b\u043d\u0438\u0442\u044c \u044d\u0442\u0443 \u043e\u0442\u043b\u0430\u0434\u043e\u0447\u043d\u0443\u044e \u043a\u043e\u043c\u0430\u043d\u0434\u0443 \u0440\u0435\u0436\u0438\u043c\u0430 wizard.",
        wizardCommandDetails: {
          levelchange: { name: "\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u0443\u0440\u043e\u0432\u0435\u043d\u044c", description: "\u0417\u0430\u0434\u0430\u0442\u044c \u0443\u0440\u043e\u0432\u0435\u043d\u044c \u043e\u043f\u044b\u0442\u0430 \u0433\u0435\u0440\u043e\u044f." },
          lightsources: { name: "\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0438 \u0441\u0432\u0435\u0442\u0430", description: "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u043f\u043e\u0434\u0432\u0438\u0436\u043d\u044b\u0435 \u0438\u0441\u0442\u043e\u0447\u043d\u0438\u043a\u0438 \u0441\u0432\u0435\u0442\u0430." },
          migratemons: { name: "\u041c\u0438\u0433\u0440\u0438\u0440\u0443\u044e\u0449\u0438\u0435 \u043c\u043e\u043d\u0441\u0442\u0440\u044b", description: "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u043c\u043e\u043d\u0441\u0442\u0440\u043e\u0432, \u0438\u0434\u0443\u0449\u0438\u0445 \u043c\u0435\u0436\u0434\u0443 \u0443\u0440\u043e\u0432\u043d\u044f\u043c\u0438." },
          panic: { name: "\u0422\u0435\u0441\u0442 panic", description: "\u041f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c panic \u0438 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044c \u044d\u0442\u0443 \u0438\u0433\u0440\u0443." },
          polyself: { name: "\u041f\u043e\u043b\u0438\u043c\u043e\u0440\u0444 \u0441\u0435\u0431\u044f", description: "\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u0442\u0435\u043a\u0443\u0449\u0443\u044e \u0444\u043e\u0440\u043c\u0443 \u0433\u0435\u0440\u043e\u044f." },
          seenv: { name: "\u0412\u0435\u043a\u0442\u043e\u0440\u044b \u0432\u0438\u0434\u0435\u043d\u043d\u043e\u0433\u043e", description: "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c debug-\u043a\u0430\u0440\u0442\u0443 \u0432\u0435\u043a\u0442\u043e\u0440\u043e\u0432 \u0432\u0438\u0434\u0435\u043d\u043d\u043e\u0433\u043e." },
          stats: { name: "\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u043f\u0430\u043c\u044f\u0442\u0438", description: "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0443 \u043f\u0430\u043c\u044f\u0442\u0438 \u0432\u043e \u0432\u0440\u0435\u043c\u044f \u0440\u0430\u0431\u043e\u0442\u044b." },
          timeout: { name: "\u041e\u0447\u0435\u0440\u0435\u0434\u044c timeout", description: "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u044b\u0435 \u044d\u0444\u0444\u0435\u043a\u0442\u044b \u0438 intrinsics." },
          vanquished: { name: "\u041f\u043e\u0431\u0435\u0436\u0434\u0435\u043d\u043d\u044b\u0435 \u043c\u043e\u043d\u0441\u0442\u0440\u044b", description: "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0441\u0447\u0435\u0442\u0447\u0438\u043a\u0438 \u0443\u0431\u0438\u0442\u044b\u0445 \u043c\u043e\u043d\u0441\u0442\u0440\u043e\u0432." },
          vision: { name: "\u041c\u0430\u0441\u0441\u0438\u0432 \u0437\u0440\u0435\u043d\u0438\u044f", description: "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0442\u0435\u043a\u0443\u0449\u0438\u0439 \u043c\u0430\u0441\u0441\u0438\u0432 \u0437\u0440\u0435\u043d\u0438\u044f." },
          wizbury: { name: "\u0417\u0430\u043a\u043e\u043f\u0430\u0442\u044c \u043f\u0440\u0435\u0434\u043c\u0435\u0442\u044b", description: "\u0417\u0430\u043a\u043e\u043f\u0430\u0442\u044c \u043f\u0440\u0435\u0434\u043c\u0435\u0442\u044b \u043d\u0430 \u043f\u043e\u043b\u0443 \u0432 \u043e\u0431\u043b\u0430\u0441\u0442\u0438 3x3." },
          wizdetect: { name: "\u041d\u0430\u0439\u0442\u0438 \u0441\u043a\u0440\u044b\u0442\u043e\u0435", description: "\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0441\u043a\u0440\u044b\u0442\u044b\u0435 \u0432\u0435\u0449\u0438 \u0440\u044f\u0434\u043e\u043c \u0441 \u0433\u0435\u0440\u043e\u0435\u043c." },
          wizgenesis: { name: "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043c\u043e\u043d\u0441\u0442\u0440\u0430", description: "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043c\u043e\u043d\u0441\u0442\u0440\u0430 \u043f\u043e \u0438\u043c\u0435\u043d\u0438 \u0438\u043b\u0438 \u043a\u043b\u0430\u0441\u0441\u0443." },
          wizidentify: { name: "\u041e\u043f\u043e\u0437\u043d\u0430\u0442\u044c \u0438\u043d\u0432\u0435\u043d\u0442\u0430\u0440\u044c", description: "\u041e\u043f\u043e\u0437\u043d\u0430\u0442\u044c \u0432\u0441\u0435 \u043f\u0440\u0435\u0434\u043c\u0435\u0442\u044b \u0432 \u0438\u043d\u0432\u0435\u043d\u0442\u0430\u0440\u0435." },
          wizintrinsic: { name: "\u0417\u0430\u0434\u0430\u0442\u044c intrinsics", description: "\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u044b\u0435 timed intrinsics." },
          wizlevelport: { name: "\u0422\u0435\u043b\u0435\u043f\u043e\u0440\u0442 \u043f\u043e \u0443\u0440\u043e\u0432\u043d\u044f\u043c", description: "\u0422\u0435\u043b\u0435\u043f\u043e\u0440\u0442 \u043d\u0430 \u0434\u0440\u0443\u0433\u043e\u0439 \u0443\u0440\u043e\u0432\u0435\u043d\u044c \u0438\u043b\u0438 \u0432\u0435\u0442\u0432\u044c." },
          wizmakemap: { name: "\u041f\u0435\u0440\u0435\u0441\u043e\u0437\u0434\u0430\u0442\u044c \u0443\u0440\u043e\u0432\u0435\u043d\u044c", description: "\u0421\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0442\u0435\u043a\u0443\u0449\u0438\u0439 \u0443\u0440\u043e\u0432\u0435\u043d\u044c \u0437\u0430\u043d\u043e\u0432\u043e." },
          wizmap: { name: "\u041a\u0430\u0440\u0442\u0430 \u0443\u0440\u043e\u0432\u043d\u044f", description: "\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043a\u0430\u0440\u0442\u0443 \u0443\u0440\u043e\u0432\u043d\u044f \u0438 \u043b\u043e\u0432\u0443\u0448\u043a\u0438." },
          wizrumorcheck: { name: "\u041f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c \u0441\u043b\u0443\u0445\u0438", description: "\u041f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c \u0444\u0430\u0439\u043b\u044b \u0438\u0441\u0442\u0438\u043d\u043d\u044b\u0445 \u0438 \u043b\u043e\u0436\u043d\u044b\u0445 \u0441\u043b\u0443\u0445\u043e\u0432." },
          wizsmell: { name: "\u041f\u043e\u043d\u044e\u0445\u0430\u0442\u044c \u043c\u043e\u043d\u0441\u0442\u0440\u0430", description: "\u041f\u043e\u043d\u044e\u0445\u0430\u0442\u044c \u0432\u044b\u0431\u0440\u0430\u043d\u043d\u043e\u0433\u043e \u043c\u043e\u043d\u0441\u0442\u0440\u0430." },
          wizwhere: { name: "\u041e\u0441\u043e\u0431\u044b\u0435 \u0443\u0440\u043e\u0432\u043d\u0438", description: "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c, \u0433\u0434\u0435 \u0440\u0430\u0437\u043c\u0435\u0449\u0435\u043d\u044b \u043e\u0441\u043e\u0431\u044b\u0435 \u0443\u0440\u043e\u0432\u043d\u0438." },
          wizwish: { name: "\u0416\u0435\u043b\u0430\u043d\u0438\u0435", description: "\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043f\u0440\u0435\u0434\u043c\u0435\u0442, \u043b\u043e\u0432\u0443\u0448\u043a\u0443 \u0438\u043b\u0438 \u043c\u0435\u0441\u0442\u043d\u043e\u0441\u0442\u044c." },
          wmode: { name: "\u0420\u0435\u0436\u0438\u043c\u044b \u0441\u0442\u0435\u043d", description: "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c debug-\u0434\u0430\u043d\u043d\u044b\u0435 \u0440\u0435\u0436\u0438\u043c\u043e\u0432 \u0441\u0442\u0435\u043d." },
        },
        repeat: "Повтор",
        character: "Персонаж",
        inventory: "Инвентарь",
        log: "Журнал",
        pickUp: "Подобрать",
        search: "Искать",
        closeMessageLog: "Закрыть журнал сообщений",
      },
      positionPrompt: {
        closeLabel: "Закрыть запрос позиции",
        desktopHint:
          "Используйте ввод движения или щелкните клетку, чтобы переместить выбор. Щелкните выбранную клетку еще раз или нажмите Enter для подтверждения.",
        mobileHint:
          "Используйте ввод движения или коснитесь клетки, чтобы переместить выбор. Коснитесь выбранной клетки еще раз или нажмите Enter для подтверждения.",
        controllerHint:
          "Используйте ввод движения, чтобы переместить выбор. Нажмите Enter или Подтвердить для подтверждения.",
      },
      controllerSupport: {
        prompt: "Обнаружен контроллер. Включить поддержку контроллера?",
      },
    },
  },
} as const;
