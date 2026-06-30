import type { LocaleOverrides } from "../locale-helpers";
import type { TranslationDictionary } from "./en";

export const ptBrOverrides = {
  meta: {
    locale: "pt-BR",
  },
  common: {
    appName: "NetHack 3D",
    confirm: "Confirmar",
    cancel: "Cancelar",
    close: "Fechar",
    back: "Voltar",
    yes: "Sim",
    no: "Não",
    delete: "Excluir",
    edit: "Editar",
    done: "Concluir",
    resetToDefaults: "Restaurar padrões",
    later: "Mais tarde",
    checking: "Verificando...",
    downloading: "Baixando...",
    canceling: "Cancelando...",
    none: "Nenhum",
    off: "Desligado",
    normal: "Normal",
    fps: "FPS",
  },
  controller: {
    groups: {
      movement: "Movimento",
      lookAndCamera: "Visão e câmera",
      actions: "Ações",
      dialogs: "Diálogos",
      system: "Sistema",
    },
    actions: {
      dpad_up: {
        label: "Direcional para cima",
        description: "Navega para cima em diálogos e na prévia de movimento.",
      },
      dpad_down: {
        label: "Direcional para baixo",
        description: "Navega para baixo em diálogos e na prévia de movimento.",
      },
      dpad_left: {
        label: "Direcional para a esquerda",
        description:
          "Navega para a esquerda em diálogos e na prévia de movimento.",
      },
      dpad_right: {
        label: "Direcional para a direita",
        description:
          "Navega para a direita em diálogos e na prévia de movimento.",
      },
      left_stick_up: {
        label: "Analógico esquerdo para cima",
        description: "Prévia de movimento e cursor virtual para cima.",
      },
      left_stick_down: {
        label: "Analógico esquerdo para baixo",
        description: "Prévia de movimento e cursor virtual para baixo.",
      },
      left_stick_left: {
        label: "Analógico esquerdo para a esquerda",
        description: "Prévia de movimento e cursor virtual para a esquerda.",
      },
      left_stick_right: {
        label: "Analógico esquerdo para a direita",
        description: "Prévia de movimento e cursor virtual para a direita.",
      },
      right_stick_up: {
        label: "Analógico direito para cima",
        description: "Olhar, mover a câmera e rolar diálogos para cima.",
      },
      right_stick_down: {
        label: "Analógico direito para baixo",
        description: "Olhar, mover a câmera e rolar diálogos para baixo.",
      },
      right_stick_left: {
        label: "Analógico direito para a esquerda",
        description: "Olhar e mover a câmera para a esquerda.",
      },
      right_stick_right: {
        label: "Analógico direito para a direita",
        description: "Olhar e mover a câmera para a direita.",
      },
      confirm: {
        label: "Confirmar / Clique",
        description: "Confirma movimentos e clica em diálogos.",
      },
      search: {
        label: "Procurar",
        description:
          "Procura no quadrado atual quando não houver prévia de movimento ativa.",
      },
      cancel_or_context: {
        label: "Cancelar / Contexto",
        description: "Abre ações de contexto ou cancela o diálogo atual.",
      },
      action_menu: {
        label: "Menu de ações",
        description: "Abre o menu radial de ações do controle.",
      },
      run_modifier: {
        label: "Modificador de corrida",
        description:
          "Segure para enviar o prefixo de corrida antes do movimento.",
      },
      zoom_in: {
        label: "Zoom (segurar)",
        description:
          "Segure, use o analógico esquerdo para cima/baixo para zoom e o analógico direito para girar a câmera.",
      },
      recenter_camera: {
        label: "Recentralizar câmera",
        description: "Retorna a câmera ao centro do jogador.",
      },
      toggle_large_minimap: {
        label: "Alternar minimapa grande",
        description: "Alterna o tamanho do minimapa muito grande.",
      },
      pause_menu: {
        label: "Menu de pausa",
        description: "Abre ou fecha o menu de pausa.",
      },
      open_inventory: {
        label: "Inventário",
        description: "Abre a janela de inventário.",
      },
      open_character: {
        label: "Ficha do personagem",
        description: "Abre a janela da ficha do personagem.",
      },
    },
    buttonLabels: {
      0: "A",
      1: "B",
      2: "X",
      3: "Y",
      4: "Botão superior esquerdo",
      5: "Botão superior direito",
      6: "Gatilho esquerdo",
      7: "Gatilho direito",
      8: "Voltar / Exibir",
      9: "Iniciar / Menu",
      10: "Clique no analógico esquerdo",
      11: "Clique no analógico direito",
      12: "Direcional para cima",
      13: "Direcional para baixo",
      14: "Direcional para a esquerda",
      15: "Direcional para a direita",
      16: "Início",
    },
    axisLabels: {
      0: "Analógico esquerdo X",
      1: "Analógico esquerdo Y",
      2: "Analógico direito X",
      3: "Analógico direito Y",
    },
    directions: {
      leftStickLeft: "Analógico esquerdo para a esquerda",
      leftStickRight: "Analógico esquerdo para a direita",
      leftStickUp: "Analógico esquerdo para cima",
      leftStickDown: "Analógico esquerdo para baixo",
      rightStickLeft: "Analógico direito para a esquerda",
      rightStickRight: "Analógico direito para a direita",
      rightStickUp: "Analógico direito para cima",
      rightStickDown: "Analógico direito para baixo",
    },
    unbound: "Sem atribuição",
    axisFallback: (axisIndex: number) => `Eixo ${axisIndex}`,
    buttonFallback: (buttonIndex: number) => `Botão ${buttonIndex}`,
    slotLabel: (slotIndex: number) => `Slot ${slotIndex + 1}`,
    listening: "Aguardando entrada...",
    clear: "Limpar",
    controllerDetected: (count: number) =>
      `${count} controle${count === 1 ? "" : "s"} detectado${count === 1 ? "" : "s"}.`,
    noControllerDetected: "Nenhum controle detectado.",
  },
  startupInitOptions: {
    accordion: {
      summary: "Opções de inicialização (opcional)",
      description:
        "Entradas extras de `OPTIONS` do NetHack aplicadas na inicialização. Opções específicas de plataforma e de window-port foram omitidas de propósito.",
      resetToDefaults: "Restaurar padrões",
    },
    options: {
      playmode: {
        label: "Modo de jogo",
        description:
          "Escolha o modo inicial. O modo assistente é o modo de depuração do NetHack (`playmode:debug`).",
        options: {
          normal: "Normal",
          explore: "Exploração",
          debug: "Assistente/Depuração",
        },
      },
      number_pad: {
        label: "Teclas de movimento",
        description:
          "Escolha se o movimento do NetHack usa o teclado numérico (`number_pad:1`) ou as teclas vi tradicionais (`number_pad:0`).",
        options: {
          numeric: "Teclado numérico",
          vi: "Teclas vi",
        },
      },
      autopickup: {
        label: "Coleta automática",
        description:
          "Coleta automaticamente as classes de itens selecionadas em tipos de coleta.",
      },
      pickup_types: {
        label: "Tipos de coleta",
        description:
          'Símbolos de classes de objeto para coleta automática (exemplo: $"=/!?+). Deixe em branco para usar o padrão do jogo.',
        placeholder: '$"=/!?+',
      },
      pickup_thrown: {
        label: "Coletar itens arremessados",
        description:
          "Coleta automaticamente itens arremessados quando eles caem no chão.",
      },
      pickup_burden: {
        label: "Limite de carga para coleta",
        description:
          "Pergunta antes de coletar quando esse nível de carga seria ultrapassado.",
        options: {
          u: "Sem carga (u)",
          b: "Carregado (b)",
          s: "Sobrecarregado (s)",
          n: "Tenso (n)",
          t: "Muito sobrecarregado (t)",
          l: "Excesso de carga (l)",
        },
      },
      pile_limit: {
        label: "Limite de pilha",
        description:
          "Quantidade de itens que aciona uma lista em popup para pilhas no chão.",
      },
      autoquiver: {
        label: "Aljava automática",
        description:
          "Preenche a aljava automaticamente ou prepara uma arma adequada ao atirar.",
      },
      autoopen: {
        label: "Abrir automaticamente",
        description:
          "Tenta abrir portas automaticamente ao se mover em direção a elas.",
      },
      autodig: {
        label: "Escavar automaticamente",
        description:
          "Escava automaticamente paredes quando possível ao se mover contra elas.",
      },
      cmdassist: {
        label: "Assistência de comandos",
        description:
          "Mostra texto de ajuda extra quando comandos são digitados incorretamente.",
      },
      confirm: {
        label: "Confirmar ataques",
        description: "Pergunta antes de atacar criaturas pacíficas.",
      },
      safe_pet: {
        label: "Proteger mascote",
        description: "Pergunta antes de atingir seu mascote.",
      },
      help: {
        label: "Ajuda no jogo",
        description:
          "Pergunta se deve mostrar detalhes extras de observação/ajuda quando houver mais informações.",
      },
      legacy: {
        label: "Introdução clássica",
        description: "Mostra a introdução da história ao iniciar um novo jogo.",
      },
      rest_on_space: {
        label: "Descansar com espaço",
        description: "Trata a tecla de espaço como esperar/descansar.",
      },
      pushweapon: {
        label: "Empurrar arma",
        description: "Move a arma empunhada para a mão secundária ao trocar.",
      },
      extmenu: {
        label: "Menu de comandos estendidos",
        description: "Usa um menu popup para comandos estendidos.",
      },
      fixinv: {
        label: "Fixar letras do inventário",
        description:
          "Tenta preservar as letras do inventário conforme os itens mudam.",
      },
      implicit_uncursed: {
        label: "Mostrar 'não amaldiçoado'",
        description:
          "Sempre inclui a expressão 'não amaldiçoado' nas descrições do inventário.",
      },
      mention_walls: {
        label: "Mencionar paredes",
        description: "Mostra uma mensagem ao se mover contra uma parede.",
      },
      sortloot: {
        label: "Ordenar listas de saque",
        description:
          "Comportamento de ordenação para listas de coleta e seleção do inventário.",
        options: {
          f: "Completo",
          l: "Apenas saque",
          n: "Nenhum",
        },
      },
      sortpack: {
        label: "Ordenar inventário",
        description:
          "Ordena o conteúdo da mochila por tipo ao exibir o inventário.",
      },
      msghistory: {
        label: "Tamanho do histórico de mensagens",
        description:
          "Número de mensagens da linha superior mantidas para consulta.",
      },
      dogname: {
        label: "Nome do cachorro",
        description: "Nome padrão para seu primeiro cachorro.",
        placeholder: "Fido",
      },
      catname: {
        label: "Nome do gato",
        description: "Nome padrão para seu primeiro gato.",
        placeholder: "Morris",
      },
      horsename: {
        label: "Nome do cavalo",
        description: "Nome padrão para seu primeiro cavalo.",
        placeholder: "Silver",
      },
      pettype: {
        label: "Mascote preferido",
        description:
          "Tipo de mascote inicial preferido para papéis que podem variar.",
        options: {
          default: "Padrão do jogo",
          cat: "Gato",
          dog: "Cachorro",
          horse: "Cavalo",
          none: "Nenhum",
        },
      },
      fruit: {
        label: "Fruta preferida",
        description: "Nome do tipo de fruta preferido do seu personagem.",
        placeholder: "bolor gosmento",
      },
      packorder: {
        label: "Ordem da mochila",
        description: "Ordem das classes de itens exibidas no inventário.",
        placeholder: '")[%?+/=!(*0_`',
      },
      paranoid_confirmation: {
        label: "Confirmação paranoica",
        description:
          "Confirmações extras separadas por espaço (exemplo: confirm quit attack pray).",
        placeholder: "confirm quit attack pray",
      },
      sparkle: {
        label: "Brilho da resistência mágica",
        description:
          "Mostra efeitos especiais de brilho para resistência mágica.",
      },
      standout: {
        label: "Monstros/--More-- destacados",
        description: "Destaca monstros e prompts de --More-- em negrito.",
      },
      tombstone: {
        label: "Lápide",
        description: "Mostra a lápide ao morrer.",
      },
      verbose: {
        label: "Mensagens detalhadas",
        description:
          "Usa textos mais completos para mensagens de status e ações.",
      },
    },
  },
  soundEffects: {
    byKey: {
      "player-walk": "Passos do jogador",
      hit: "Golpe",
      "thrown-weapon": "Arma arremessada",
      "monster-killed": "Monstro morto (jogador)",
      "monster-killed-other": "Monstro morto (outro)",
      "missed-attack": "Ataque errou",
      "door-opens": "Porta abre",
      "door-closes": "Porta fecha",
      "door-kick": "Chute na porta",
      "door-smash": "Arrebentar porta",
      "door-resists": "A porta resiste",
      "door-distant": "Porta ao longe",
      "walk-down-stairs": "Descer escadas",
      "walk-up-stairs": "Subir escadas",
      eating: "Comendo",
      drink: "Beber",
      "quaff-potion": "Beber uma poção",
      "pickup-gold": "Pegar ouro",
      "pickup-item": "Pegar item",
      "find-hidden": "Encontrar porta/passagem secreta",
      "level-up": "Subir de nível",
      unlock: "Destrancar",
      "boulder-push": "Empurrar pedra",
      "boulder-blocked": "Pedra bloqueada",
      splash: "Respingo",
      searching: "Procurando",
      "magic-cast": "Lançar magia",
      "magic-heal": "Cura mágica",
      "magic-buff": "Bônus mágico",
    },
  },
  characterSheet: {
    titleFallback: "Ficha do personagem",
    sectionTitles: {
      overview: "Visão geral",
      background: "Histórico",
      basics: "Básico",
      characteristics: "Características atuais",
      status: "Estado atual",
      attributes: "Atributos atuais",
    },
    statLabels: {
      strength: "Força",
      dexterity: "Destreza",
      constitution: "Constituição",
      intelligence: "Inteligência",
      wisdom: "Sabedoria",
      charisma: "Carisma",
    },
    commands: {
      enhance: {
        label: "Aprimorar",
        detail: "Evoluir perícias",
      },
      conduct: {
        label: "Conduta",
        detail: "Mostrar progresso do desafio",
      },
      overview: {
        label: "Visão geral",
        detail: "Mostrar progresso na masmorra",
      },
      spells: {
        label: "Magias",
        detail: "Revisar magias conhecidas",
      },
      seespells: {
        label: "Livro de magias",
        detail: "Listar inventário de magias",
      },
      technique: {
        label: "Tecnica",
        detail: "Usar habilidades de funcao/raca",
      },
      known: {
        label: "Descobertas",
        detail: "Lista de objetos conhecidos",
      },
      pray: {
        label: "Rezar",
        detail: "Tentar rezar",
      },
    },
  },
  castMenu: {
    schoolLabel: "Escola:",
    headings: {
      name: "Nome",
      level: "Nível",
      category: "Categoria",
      fail: "Falha",
      retention: "Retenção",
    },
    summary: {
      known: (count: number) => `${count} conhecidas`,
      castable: (count: number) => `${count} lançáveis`,
      bestSuccess: (percent: number) => `Melhor sucesso ${percent}%`,
      averageFail: (percent: number) => `Falha média ${percent}%`,
      schoolCount: (count: number) =>
        `${count} escola${count === 1 ? "" : "s"}`,
    },
    retention: {
      unknown: "Desconhecida",
      gone: "Perdida",
      full: "100%",
    },
  },
  enhanceMenu: {
    defaultGroupTitle: "Perícias",
    availability: {
      available_now: "Disponível",
      needs_experience: "Exp./Slots",
      needs_practice: "Prática",
      maxed_out: "No máximo",
    },
    summary: {
      available: (count: number) => `${count} disponíveis`,
      gated: (count: number) => `${count} bloqueadas por experiência/slots`,
      practice: (count: number) => `${count} precisam de prática`,
      maxed: (count: number) => `${count} no máximo`,
    },
    maxLabel: "Máx",
    slotCount: (count: number) => `${count} slot${count === 1 ? "" : "s"}`,
  },
  app: {
    unknownTime: "Horário desconhecido",
    debugSession: {
      possibleCrash: "possível falha",
      active: "ativa",
    },
    debugLogs: {
      buildLabelAria: (
        buildLabel: string,
        currentCount: number,
        requiredCount: number,
      ) =>
        `Build ${buildLabel}. Progresso do alternador oculto de logs de depuração: ${currentCount} de ${requiredCount}.`,
      enabledToast: "Log de depuração ativado",
      enabledLogEntry:
        "Log de depuração ativado pelo easter egg do rótulo da build inicial.",
      openLink: "Ver logs de depuração",
      clearedLogEntry: "Logs de depuração salvos foram limpos pelo usuário.",
    },
    statusEffects: {
      turningToStone: "Virando pedra",
      slimed: "Coberto de limo",
      strangled: "Estrangulado",
      foodPoisoning: "Envenenamento alimentar",
      terminallyIll: "Gravemente doente",
      blind: "Cego",
      deaf: "Surdo",
      stunned: "Atordoado",
      confused: "Confuso",
      hallucinating: "Alucinando",
      levitating: "Levitando",
      flying: "Voando",
      riding: "Montado",
      barehanded: "Desarmado",
      busy: "Ocupado",
      iron: "Ferro",
      glowingHands: "Mãos brilhantes",
      grabbed: "Agarrado",
      held: "Preso",
      icy: "Congelado",
      inLava: "Na lava",
      paralyzed: "Paralisado",
      sleeping: "Dormindo",
      slippery: "Escorregadio",
      submerged: "Submerso",
      tethered: "Amarrado",
      trapped: "Preso em armadilha",
      unconscious: "Inconsciente",
      woundedLegs: "Pernas feridas",
      holding: "Segurando",
    },
    characterStats: {
      descriptions: {
        strength:
          "Afeta dano corpo a corpo, capacidade de carga e ações de força.",
        dexterity:
          "Afeta chance de acerto, interação com armadilhas e agilidade defensiva.",
        constitution:
          "Afeta crescimento de PV e resistência a veneno e drenagem.",
        intelligence:
          "Afeta leitura e sucesso em muitas ações relacionadas a magia.",
        wisdom:
          "Afeta crescimento de energia mágica e confiabilidade ao lançar magias.",
        charisma:
          "Afeta interações em lojas, manejo de mascotes e resultados sociais.",
      },
      armorClassDescription:
        "Quanto menor, melhor. A classe de armadura reduz a chance de o inimigo acertar você.",
    },
    directionHelp: {
      controller:
        "Clique em uma direção ou use o analógico esquerdo/DPAD para pré-visualizar e solte para confirmar. O círculo central mira em você. Use < ou > para escadas. Pressione ESC para cancelar.",
      numpad:
        "Clique em uma direção. O círculo central mira em você. Você também pode usar o teclado numérico (1-4,6-9), setas, <, > ou s. Pressione ESC para cancelar.",
      viKeys:
        "Clique em uma direção. O círculo central mira em você. Você também pode usar hjkl/yubn, setas, <, > ou s. Pressione ESC para cancelar.",
      fps: "Olhe para mirar. Clique esquerdo ou W confirma. S mira em você. A/D ou clique direito cancela.",
    },
    inventoryContextActions: {
      apply: "Aplicar",
      invoke: "Invocar",
      tip: "Dica",
      loot: "Saquear",
      drop: "Largar",
      eat: "Comer",
      quaff: "Beber",
      read: "Ler",
      rub: "Esfregar",
      throw: "Arremessar",
      wield: "Empunhar",
      quiver: "Colocar na aljava",
      wear: "Vestir",
      takeOff: "Tirar",
      putOn: "Colocar",
      remove: "Remover",
      zap: "Disparar",
      untrap: "Desarmar",
      offer: "Oferecer",
      name: "Nomear",
      call: "Chamar",
      adjust: "Ajustar",
      engrave: "Gravar",
      dip: "Mergulhar",
      info: "Informações",
      unwield: "Desequipar",
    },
    mobileActions: {
      wait: "Esperar",
      zap: "Disparar",
      cast: "Lançar",
      kick: "Chutar",
      read: "Ler",
      quaff: "Beber",
      eat: "Comer",
      glance: "Olhar",
      loot: "Saquear",
      open: "Abrir",
      wield: "Empunhar",
      wear: "Vestir",
      putOn: "Colocar",
      takeOff: "Tirar",
      extended: "Expandido",
    },
    clientOptions: {
      config: {
        groupControls: "Controle e modo em primeira pessoa",
        sectionControlsController: "Controle",
        controllerEnabled: {
          label: "Ativar suporte a controle",
          description:
            "Ativa entrada de gamepad para a jogabilidade e diálogos da interface.",
        },
        sectionControlsLook: "Visão e câmera",
        invertLookYAxis: {
          label: "Inverter visão no eixo Y",
          description:
            "Inverte a direção vertical do mouselook e do olhar por toque.",
        },
        fpsLookSensitivityX: {
          label: "Sensibilidade de visão FPS X",
          description: "Sensibilidade horizontal do mouselook/olhar por toque.",
        },
        fpsLookSensitivityY: {
          label: "Sensibilidade de visão FPS Y",
          description: "Sensibilidade vertical do mouselook/olhar por toque.",
        },
        snapCameraYawToNearest45: {
          label: "Ajustar rotação da câmera para 45 graus",
          description:
            "Quando a entrada de rotação da câmera é solta, ajusta suavemente o ângulo para o múltiplo de 45 graus mais próximo.",
        },
        sectionControlsMovement: "Comportamento de movimento",
        cameraRelativeMovement: {
          label: "Movimento e gestos relativos à câmera",
          description:
            "Gira teclas de movimento e direções de gesto com base no ângulo do eixo Y da câmera.",
        },
        fpsWasdKeyboardMovementEnabled: {
          label: "Ativar movimento WASD pelo teclado no modo FPS",
          description:
            "Use W/A/S/D para movimento em primeira pessoa. Desative para que essas teclas se comportem como comandos normais do NetHack.",
        },
        controllerFpsMoveRepeatMs: {
          label: "Repetição de movimento FPS no analógico esquerdo",
          description:
            "Atraso de repetição de movimento do analógico esquerdo no modo FPS (menor é mais rápido).",
        },
        groupInterface: "Interface do jogo",
        locale: {
          label: "Idioma",
          description:
            "Escolha o idioma da interface. O padrão usa a região do navegador quando houver suporte, com inglês como fallback.",
          options: {
            en: "Inglês",
          },
        },
        sectionDisplayCamera: "Câmera e perspectiva",
        fpsMode: {
          label: "Modo em primeira pessoa",
          description: "Usa controles em primeira pessoa e mouselook.",
        },
        fpsFlattenEntityBillboards: {
          label: "Achatar sprites de tiles sobrepostos",
          description:
            "Achata sprites de tiles de saque ou elementos da masmorra quando monstros, mascotes ou o jogador ficam sobre eles. Desative para manter sprites sobrepostos como billboards em pé. Tiles de Vulture sempre permanecem em pé.",
        },
        fpsHeldWeaponVisible: {
          label: "Mostrar arma em FPS",
          description: "Exibe o sprite da arma empunhada no modo em primeira pessoa.",
        },
        showItemsUnderPlayerInOverheadTilesMode: {
          label: "Mostrar itens sob o jogador em tiles superiores",
          description:
            "Mostra itens e elementos do chão sob o jogador no modo de tiles superiores usando dados de glifos de camada inferior em tempo de execução.",
        },
        fpsFov: {
          label: "Campo de visão do FPS",
          description: "Ajusta o campo de visão da câmera em primeira pessoa.",
        },
        sectionDisplayGraphics: "Gráficos e renderização",
        tilesetMode: {
          label: "Exibição",
          description: "Usa tiles gráficos em vez de ASCII.",
          options: {
            ascii: "ASCII",
            tiles: "Tiles",
          },
        },
        tilesetPath: {
          label: "Conjunto de tiles",
          description: "Tilesets internos e enviados.",
        },
        antialiasing: {
          label: "Suavização de bordas",
          description: "Modo de suavização de bordas para renderização 3D.",
          options: {
            taa: "TAA",
            fxaa: "FXAA",
          },
        },
        lightingEnabled: {
          label: "Iluminação",
          description:
            "Ativa iluminação dinâmica da cena e escurecimento da masmorra. Desative para uma renderização plana e sempre iluminada.",
        },
        blockAmbientOcclusion: {
          label: "Oclusão de ambiente",
          description:
            "Adiciona um sombreado sutil de contato entre blocos de piso e parede.",
        },
        brightness: {
          label: "Brilho",
          description: "Ajusta o brilho geral da cena.",
        },
        contrast: {
          label: "Contraste",
          description: "Ajusta o contraste global do conteúdo renderizado.",
        },
        gamma: {
          label: "Gama",
          description: "Ajusta a gama de exibição do conteúdo renderizado.",
        },
        sectionDisplayInterface: "Interface do jogo",
        uiFontScale: {
          label: "Escala da fonte da interface",
          description:
            "Escala todos os tamanhos de fonte da interface do jogo a partir dos valores padrão.",
        },
        disableAnimatedTransitions: {
          label: "Desativar transições animadas",
          description:
            "Desativa animações de fade, movimento e transição da interface para mudanças mais rápidas.",
        },
        uiTileBackgroundRemoval: {
          label: "Remover fundos de tiles na interface",
          description:
            "Aplica remoção de fundo por tile/chroma aos ícones exibidos nos painéis da interface.",
        },
        desktopTouchInterfaceMode: {
          label: "Interface de toque no desktop",
          description:
            "Mostra controles de toque no desktop e permite escolher layout retrato ou paisagem.",
          options: {
            off: "Desligado",
            portrait: "Usar interface de toque em retrato",
            landscape: "Usar interface de toque em paisagem",
          },
        },
        sectionDisplayMessages: "Mensagens e registro",
        desktopMessageLogWindowScale: {
          label: "Escala da janela de registro de mensagens no desktop",
          description:
            "Escala o tamanho da janela emoldurada do registro de mensagens sem alterar o tamanho da fonte.",
        },
        liveMessageLog: {
          label: "Registro de mensagens ao vivo",
          description: "Exibe o registro de mensagens rolável dentro do jogo.",
        },
        showPersistentMobileMessageLog: {
          label: "Mostrar registro de mensagens persistente",
          description:
            "Mantem o registro compacto de mensagens no mobile visivel durante o jogo. O botao Registro ainda pode abrir o registro maior.",
        },
        rumbleEnabled: {
          label: "Ativar vibracao",
          description:
            "Usa vibracao haptica curta para dano causado e dano recebido em dispositivos moveis compativeis.",
        },
        sectionMobileSafeZone: "Areas seguras mobile",
        manualMobileBottomSafeZoneEnabled: {
          label: "Substituir areas seguras mobile detectadas",
          description:
            "Use margens de area segura manuais quando portateis Android informarem areas seguras incorretamente.",
        },
        manualMobileBottomSafeZoneVerticalPx: {
          label: "Area segura inferior vertical",
          description:
            "Area segura inferior manual para o layout mobile vertical.",
        },
        manualMobileBottomSafeZoneHorizontalPx: {
          label: "Area segura inferior horizontal",
          description:
            "Area segura inferior manual para o layout mobile horizontal.",
        },
        manualMobileRightSafeZoneHorizontalPx: {
          label: "Area segura direita horizontal",
          description:
            "Area segura direita manual para o layout mobile horizontal.",
        },
        manualMobileBottomSafeZonePreview: "Area segura inferior",
        manualMobileRightSafeZonePreview: "Area segura direita",
        liveMessageDisplayTimeMs: {
          label: "Tempo de exibição das mensagens ao vivo",
          description:
            "Tempo em que uma mensagem flutuante permanece totalmente visível antes de desaparecer.",
        },
        liveMessageFadeOutTimeMs: {
          label: "Tempo de fade das mensagens ao vivo",
          description: "Duração da animação de desaparecimento das mensagens.",
        },
        liveMessageLogFontScale: {
          label: "Escala da fonte das mensagens ao vivo",
          description:
            "Escala as mensagens flutuantes de ação a partir do tamanho padrão.",
        },
        sectionDisplayMinimap: "Minimapa",
        minimap: {
          label: "Minimapa",
          description: "Mostra ou oculta o minimapa da masmorra.",
        },
        minimapScale: {
          label: "Escala do minimapa",
          description: "Escala o tamanho do minimapa a partir do padrão.",
        },
        sectionDisplayInventory: "Apresentação do inventário",
        reduceInventoryMotion: {
          label: "Reduzir movimento do inventário",
          description:
            "Desativa a expansão animada das linhas do inventário e usa interações mais simples.",
        },
        inventoryTileOnlyMotion: {
          label: "Animar apenas os tiles do inventário",
          description:
            "Anima os ícones dos tiles enquanto mantém altura e espaçamento das linhas fixos.",
        },
        inventoryFixedTileSize: {
          label: "Tamanho fixo dos tiles do inventário",
          description:
            "Aplica-se apenas quando Reduzir movimento do inventário estiver ativado. Escolha um tamanho fixo para os ícones.",
          options: {
            none: "Nenhum",
            small: "Pequeno",
            medium: "Médio",
            large: "Grande",
          },
        },
        groupSound: "Som",
        soundEnabled: {
          label: "Ativar som",
          description:
            "Liga ou desliga o áudio FMOD. Desativar reduz o processamento de áudio em dispositivos mais fracos.",
        },
        groupMobileControls: "Controles móveis",
        invertTouchPanningDirection: {
          label: "Inverter direção do deslocamento",
          description: "Inverte a direção do arrasto para mover a câmera após iniciar o gesto de segurar para mover.",
        },
        groupCombat: "Feedback de combate",
        damageNumbers: {
          label: "Números de dano",
          description: "Mostra números flutuantes de dano e cura.",
        },
        displayStatChangesAbovePlayer: {
          label: "Mostrar mudanças de atributos acima do jogador",
          description:
            "Mostra rótulos flutuantes para mudanças de atributos como Força e CA.",
        },
        displayXpGainsAbovePlayer: {
          label: "Mostrar ganhos de XP acima do jogador",
          description:
            "Mostra rótulos flutuantes de XP quando a experiência aumenta.",
        },
        tileShakeOnHit: {
          label: "Tremor do tile ao acertar",
          description: "Sacode os tiles de impacto quando golpes acertam.",
        },
        sectionCombatBlood: "Efeitos de sangue",
        blood: {
          label: "Sangue",
          description: "Renderiza efeitos de névoa de sangue nos impactos.",
        },
        bloodMist: {
          label: "Névoa de sangue",
          description:
            "Renderiza partículas de névoa de sangue suspensas nos impactos.",
        },
        bloodGround: {
          label: "Respingos de sangue",
          description:
            "Renderiza respingos de sangue no chão da masmorra após impactos.",
        },
        bloodStrength: {
          label: "Intensidade do sangue",
          description:
            "Controla a intensidade visual das texturas e da coloração do sangue.",
        },
        bloodDetail: {
          label: "Detalhe do sangue",
          description:
            "Escolhe a resolução da textura de manchas de sangue por tile da masmorra.",
          options: {
            veryLow: "Muito baixo",
            low: "Baixo",
            medium: "Médio",
            high: "Alto",
          },
        },
        bloodColorLightHex: {
          label: "Tonalidade clara do sangue no chão",
          description:
            "Escolhe a tonalidade mais clara usada em manchas frescas de sangue no chão.",
        },
        bloodColorDarkHex: {
          label: "Tonalidade escura do sangue no chão",
          description:
            "Escolhe a tonalidade mais escura usada em áreas densas de sangue no chão.",
        },
        bloodMistColorHex: {
          label: "Tonalidade da névoa de sangue",
          description:
            "Escolhe a tonalidade base usada na névoa de sangue no ar.",
        },
        monsterShatter: {
          label: "Estilhaçar monstros",
          description:
            "Divide billboards de monstros derrotados em fragmentos físicos.",
        },
        monsterShatterBloodBorders: {
          label: "Bordas sangrentas nos estilhaços",
          description:
            "Tinge pixels próximos às linhas de divisão com bordas vermelho-sangue aleatórias.",
        },
        groupCompatibility: "Compatibilidade de runtime",
        darkCorridorWalls367: {
          label: "Paredes escuras de corredor legadas",
          description:
            "Infere e armazena em cache tiles de paredes de corredor escuro para runtimes legados do NetHack 3.4.3/3.6.x, incluindo Slash'EM.",
        },
        overrideNh5DarkCorridorWallTiles: {
          label: "Substituir tiles de paredes escuras do NetHack 5.0",
          description:
            "Aplica configurações de substituição de paredes escuras aos tiles de corredor escuro do NetHack 5.0.",
        },
        darkCorridorWallTileOverrideEnabled: {
          label: "Substituir tile de parede escura",
          description:
            "Usa um tile personalizado do atlas para paredes escuras, salvo por tileset.",
        },
        darkCorridorWallSolidColorOverrideEnabled: {
          label: "Usar cor sólida para paredes escuras",
          description:
            "Usa uma cor RGB escolhida em vez de um tile do tileset.",
        },
      },
      tabs: {
        display: {
          label: "Exibição",
          description: "Configurações de interface e exibição.",
        },
        mobile: {
          label: "Celular",
          description:
            "Configuracoes de interface e jogabilidade especificas para celular.",
        },
        controls: {
          label: "Controles",
          description: "Mapeamentos do controle, modo FPS e comportamento de visão.",
        },
        sound: {
          label: "Som",
          description: "Saída de áudio e controles de som relacionados ao desempenho.",
        },
        combat: {
          label: "Combate",
          description: "Feedback de impacto e resposta visual em combate.",
        },
        compatibility: {
          label: "Compatibilidade",
          description: "Compatibilidade de runtime e alternâncias de comportamento do NetHack.",
        },
        updates: {
          label: "Atualizações",
          description:
            "Verifique atualizações online do jogo e revise mudanças pendentes.",
        },
      },
    },
    update: {
      loading: {
        startupData: "Carregando dados iniciais...",
        tileset: "Carregando conjunto de tiles...",
        runtime: "Iniciando runtime local...",
      },
      runtimeStoppedBeforeStartup:
        "O runtime local do NetHack parou antes de a inicialização terminar.",
      preparingDownload: "Preparando download da atualização do jogo...",
      idleStatus: "O status da atualização está ocioso.",
      fileProgress: (index: number, count: number) =>
        `Arquivo ${index} de ${count}`,
      unexpectedCheckFailure: "Falha inesperada ao verificar atualização.",
      cancelRequested: "Cancelamento solicitado.",
      stoppingActiveDownloadTask: "Interrompendo tarefa de download ativa.",
      unableToCancelDownload:
        "Não foi possível cancelar o download da atualização.",
      noActiveDownloadToCancel:
        "Não há download de atualização ativo para cancelar.",
      startingDownload: "Iniciando download da atualização do jogo.",
      canceled: "O download da atualização foi cancelado.",
      unableToDownloadAndApply:
        "Não foi possível baixar e aplicar as atualizações.",
      failed: "A atualização falhou.",
      latestAlreadyInstalled: "A atualização mais recente já está instalada.",
      downloadComplete: "Download da atualização concluído.",
      nothingAppliedTryAgain:
        "Nenhuma atualização foi aplicada. Tente verificar novamente.",
      noFilesApplied: "Nenhum arquivo de atualização foi aplicado.",
      unexpectedFailure: "Falha inesperada na atualização.",
      checkingForUpdates: "Verificando lançamentos do GitHub...",
      unsupportedPlatform:
        "Não é possível verificar lançamentos do GitHub nesta plataforma.",
      latestAlreadyInstalledOptions:
        "Você já tem a versão mais recente do jogo.",
      oneUpdateAvailable:
        "Uma nova versão do jogo está disponível. Deseja atualizar?",
      manyUpdatesAvailable: (count: number) =>
        `${count} versões mais recentes do jogo estão disponíveis. Deseja atualizar?`,
      updateCheckFailed: (message: string) =>
        `Falha ao verificar lançamentos do GitHub: ${message}`,
    },
    saves: {
      sections: {
        manual: "Salvamentos manuais",
        autosave: "Salvamentos automáticos",
      },
      deleteTitle: "Excluir jogo salvo?",
      deleteMessage: (name: string) =>
        `Tem certeza de que deseja excluir ${name}?`,
      overwriteTitle: "Sobrescrever jogo salvo?",
      overwriteMessage: (name: string) =>
        `Já existe um jogo salvo chamado "${name}". Deseja sobrescrevê-lo com um novo personagem?`,
      errorLoading: "Erro ao carregar salvamentos",
      loading: "Carregando salvamentos...",
      noneFound: "Nenhum jogo salvo encontrado.",
      savedAt: (date: string) => `Salvo em: ${date}`,
    },
    tilesets: {
      userTileset: "Tileset do usuário",
      currentSelectionFallback: "este tileset",
      deleteUploadedTitle: "Excluir tileset enviado?",
      deleteUploadedMessage: (label: string) =>
        `Excluir "${label}" dos tilesets enviados?`,
      failedToDelete: "Falha ao excluir tileset.",
      chooseFile: "Escolha um arquivo de tileset PNG/BMP/GIF/JPEG.",
      provideName: "Informe um nome para este tileset.",
      failedToSave: "Falha ao salvar tileset.",
      failedToLoadUploaded: "Falha ao carregar tilesets enviados:",
      userTilesetSuffix: "Tileset do usuário (usuário)",
      noTilesetsFound: "Nenhum tileset encontrado",
      failedToReadImage: "Falha ao ler a imagem do tileset.",
    },
    tilePicker: {
      noAtlasAvailable: "Nenhum atlas de tiles disponível.",
      unableToLoadAtlas: "Não foi possível carregar o atlas de tiles.",
      atlasLoaded: "Atlas de tiles carregado.",
      loadingAtlas: "Carregando atlas de tiles...",
      selectedTile: (tileId: number) => `Selecionado: tile #${tileId}`,
      glyph: (label: string) => `Glifo ${label}`,
      tile: (tileId: number) => `Tile ${tileId}`,
      defaultBadge: "Padrão",
      resetToDefault: "Restaurar padrão",
      darkWallTitle: "Seletor de tile de parede escura",
      closeDarkWall: "Fechar seletor de tile de parede escura",
      closeBackground: "Fechar seletor de tile de fundo do tileset",
      backgroundHelper:
        "Usado para remover o fundo compartilhado do tileset dos billboards de monstros/saques.",
      backgroundTitle: "Seletor de tile de fundo do tileset",
      backgroundTitleWithLabel: (label: string) =>
        `Seletor de tile de fundo do tileset: ${label}`,
      closeSolidColor: "Fechar seletor de cor sólida para chroma key",
      solidColorTitle: "Seletor de chroma key de cor sólida",
      solidColorTitleWithLabel: (label: string) =>
        `Seletor de chroma key de cor sólida: ${label}`,
    },
    soundPack: {
      discardChangesTitle: "Descartar alterações do pacote de som?",
      discardChangesMessage:
        "Descartar alterações não salvas do pacote de som e continuar?",
      discard: "Descartar",
      keepEditing: "Continuar editando",
      failedToLoadIndexedDb: "Falha ao carregar pacotes de som do IndexedDB.",
      failedToSelectRequested:
        "Falha ao selecionar o pacote de som solicitado.",
      provideName: "Informe um nome para o pacote de som.",
      created: (name: string) => `Pacote de som "${name}" criado.`,
      failedToCreate: "Falha ao criar pacote de som.",
      saved: (name: string) => `Pacote de som "${name}" salvo.`,
      failedToSave: "Falha ao salvar pacote de som.",
      failedToExportZip: "Falha ao exportar ZIP do pacote de som.",
      exported: (name: string) => `"${name}" exportado.`,
      failedToImportZip: "Falha ao importar ZIP do pacote de som.",
      imported: (name: string) => `Pacote de som "${name}" importado.`,
      deleteTitle: "Excluir pacote de som?",
      deleteMessage: (name: string) =>
        `Excluir pacote de som "${name}"? Isso não pode ser desfeito.`,
      deleted: (name: string) => `Pacote de som "${name}" excluído.`,
      failedToDelete: "Falha ao excluir pacote de som.",
      noPreviewSource: "Nenhuma fonte de prévia disponível para este som.",
      unableToPreview: "Não foi possível reproduzir a prévia deste som.",
      title: "Pacotes de som",
      activePack: "Pacote de som ativo",
      activePackDescription:
        "Selecione o pacote de som ativo usado para resolver caminhos de som.",
      createNew: "Criar novo pacote de som",
      createDescription:
        "Crie um pacote de som personalizado que sobrescreva os padrões.",
      createNameLabel: "Nome do novo pacote de som",
      createPlaceholder: "Meu pacote de som",
      createAndSave: "Criar e salvar",
      packName: "Nome do pacote",
      packNameDescription:
        "Renomeie este pacote e salve para atualizar o namespace dos arquivos de som.",
      savePack: "Salvar pacote de som",
      export: "Exportar pacote de som",
      import: "Importar pacote de som",
      deletePack: "Excluir pacote de som",
      stopPreview: "Parar prévia",
      loading: "Carregando pacotes de som...",
      pendingSaveSuffix: " (salvamento pendente)",
      defaultSuffix: " (padrão)",
      customSuffix: " (personalizado)",
      noBundledSound: "Sem som embutido",
      enableSoundAria: (label: string) => `Ativar ${label}`,
      volumeAria: (label: string) => `Volume para ${label}`,
      play: "Reproduzir",
      playing: "Reproduzindo...",
      volume: "Nível do volume",
      remove: "Remover",
      replace: "Substituir",
      soundFile: "Arquivo de som",
      reset: "Redefinir",
      attribution: "Atribuição",
      attributionAria: (label: string) => `Atribuição de ${label}`,
      attributionPlaceholder: "Fonte, criador ou detalhes de licença",
      addVariation: "+ Adicionar variação",
    },
    dialogs: {
      pauseMenu: {
        saveBeforeQuit: "Deseja salvar antes de sair?",
        title: "Jogo pausado",
        resume: "Retomar",
        options: "Opções",
        saveGame: "Salvar jogo",
        exitToMainMenu: "Voltar ao menu principal",
        quitGame: "Sair do jogo",
      },
      debugLogs: {
        closeLabel: "Fechar logs de depuração",
        title: "Logs de depuração salvos",
        hint: "Os logs só são capturados depois que o alternador oculto de logs de depuração é ativado.",
        showingEntries: (count: number, startedAt: string) =>
          `Mostrando ${count} registros desde ${startedAt}.`,
        noneSaved: "Ainda não há logs de depuração salvos.",
        refresh: "Atualizar",
        clearLogs: "Limpar logs",
      },
      startupUpdate: {
        maintenanceNotice:
          "Nenhum lançamento mais recente do GitHub foi encontrado.",
        summaryAvailable:
          "Uma nova versão do jogo está disponível. Deseja atualizar?",
        summaryNone:
          "Você já tem a versão mais recente do jogo.",
        currentVersion: (version: string) => `Versão atual: ${version}`,
        latestVersion: (version: string) =>
          `Último lançamento do GitHub: ${version}`,
        disableAtStartup:
          "Não mostrar mais essas notificações ao iniciar.",
        disabledNotice:
          "As notificações de lançamento ao iniciar agora estão desativadas. Você pode ativá-las novamente em Opções.",
        clientUpgradeRequired:
          "Também é necessária uma atualização completa do cliente para os aprimoramentos mais recentes da plataforma.",
        progressTitle: "Status do download da atualização",
        canceling: "Cancelando download da atualização...",
        noActiveTransfer: "Nenhuma transferência de arquivo ativa.",
        waitingForUpdater: "Aguardando atividade do atualizador.",
        pendingUpdates: "Atualizações pendentes",
        payloadAvailable: "O pacote da atualização está disponível.",
        downloadUpdates: "Baixar atualizações",
        hideDetails: "Ocultar detalhes",
        moreDetails: "Mais detalhes",
        cancelDownload: "Cancelar download",
      },
      startup: {
        chooseVariant: "Escolha sua variante de NetHack:",
        options: "Opções do NetHack 3D",
        quitGame: "Sair do jogo",
        chooseSetup: "Escolha a configuração do seu personagem:",
        randomCharacter: "Personagem aleatório",
        createCharacter: "Criar personagem",
        loadGame: "Carregar jogo",
        selectSavedGame: "Selecione um jogo salvo:",
        enterRandomName: "Digite um nome para seu personagem aleatório:",
        createCharacterPrompt: "Crie seu personagem:",
        name: "Nome",
        role: "Classe",
        race: "Raça",
        gender: "Gênero",
        alignment: "Alinhamento",
        startGame: "Iniciar jogo",
      },
      clientOptions: {
        closeLabel: "Fechar opções do NetHack 3D",
        title: "Opções do cliente NetHack 3D",
        categoriesLabel: "Categorias de configuração",
        updates: {
          checkOnLaunchLabel:
            "Mostrar notificações de lançamentos do GitHub ao iniciar",
          checkOnLaunchDescription:
            "Verifica lançamentos do GitHub ao iniciar e avisa quando houver uma versão mais recente.",
          title: "Lançamentos do GitHub",
          description:
            "Compare esta build com os lançamentos publicados no GitHub.",
          idle:
            "Pressione Verificar atualizações para comparar esta build com os lançamentos do GitHub.",
          button: "Verificar atualizações",
          openGitHubReleases: "Abrir lançamentos do GitHub",
        },
        buttons: {
          manageTileSets: "Gerenciar tilesets",
          remapController: "Remapear controle",
          resetControllerDefaults: "Restaurar mapeamentos padrão do controle",
        },
        hints: {
          darkWallsAlwaysEnabled:
            " Sempre ativado enquanto os tiles de Vulture estiverem ativos.",
          darkWallsDisabledByVulture:
            " Desativado enquanto os tiles de Vulture estiverem ativos.",
          enableDarkWallsFirst:
            " Ative primeiro as paredes escuras de corredor legadas ou as substituições de paredes escuras do NetHack 5.0.",
          enableFpsFirst:
            " Ative primeiro o modo em primeira pessoa em Exibição.",
        },
        darkWallControls: {
          normal: "Padrão",
          fps: "Modo FPS",
          normalAria: "Cor sólida da parede escura (modo normal)",
          fpsAria: "Cor sólida da parede escura (modo FPS)",
          gridLines: "Linhas de grade",
          intensity: "Intensidade",
        },
        controllerRemap: {
          title: "Remapeamento do controle",
          closeLabel: "Fechar remapeamento do controle",
          hint: "Selecione um slot e depois pressione um botão ou mova um analógico. Cada ação tem dois slots.",
          listeningFor: (label: string, slot: number) =>
            `Aguardando ${label} (slot ${slot}). Pressione ESC para cancelar.`,
        },
        resetPrompt:
          "Restaurar as opções do NetHack 3D para os padrões? Seus tilesets personalizados serão mantidos.",
      },
      tilesetManager: {
        closeLabel: "Fechar gerenciador de tilesets",
        title: "Gerenciar tilesets",
        description:
          "Adicione tilesets e edite configurações de fundo/chroma por tileset.",
        createTitle: "Criar novo tileset",
        editTitle: "Editar tileset",
        editTitleWithName: (label: string) => `Editar tileset: ${label}`,
        tileSetName: "Nome do tileset",
        tileSetPlaceholder: "Meu tileset",
        builtInNamesLocked:
          "Os nomes dos tilesets internos não podem ser alterados.",
        tileLayoutVersion: "Versão do layout dos tiles",
        layout367: "Layout do NetHack 3.6.7",
        layout5: "Layout do NetHack 5.0",
        tileLayoutDescription:
          "Escolha o layout de índices de tile usado por este atlas enviado.",
        tileImage: "Imagem do tileset",
        tileImageOptional: "Imagem do tileset (substituição opcional)",
        selectedFile: (fileName: string) => `Selecionado: ${fileName}`,
        currentFile: (fileName: string) => `Atual: ${fileName}`,
        uploadedImage: "imagem enviada",
        weaponSpriteFlip: "Inverter sprite da arma em FPS",
        weaponSpriteFlipDescription:
          "Inverte horizontalmente o sprite da arma empunhada para este tileset. Ativado por padr\u00e3o.",
        backgroundRemovalDescription:
          "Configure a remoção de fundo dos billboards para este tileset, ou deixe os dois modos desativados para manter os fundos do atlas intactos.",
        backgroundTileRemoval: "Remoção por tile de fundo",
        backgroundTileRemovalDescription:
          "Usa um tile selecionado do atlas para remover o fundo dos billboards.",
        solidChromaKey: "Chroma key de cor sólida",
        solidChromaKeyDescription:
          "Usa uma única cor RGB sólida para remover o fundo dos billboards.",
        clickToPickFromAtlas: "clique para escolher no atlas",
        saveFirstThenEdit:
          "Salve primeiro o novo tileset e depois edite as configurações de fundo/chroma.",
        createTileSet: "Criar tileset",
        saveTileSet: "Salvar tileset",
        saveTileSettings: "Salvar configurações de tile",
        importNewTileSet: "+ Importar novo tileset",
        noUploadedTilesets: "Nenhum tileset enviado disponível.",
        selectedSuffix: " (selecionado)",
        editingSuffix: " (editando)",
        uploadedDetails: (fileName: string, layout: string) =>
          `${fileName} | enviado | layout ${layout}`,
        builtInDetails: (path: string) => `${path} | interno`,
      },
      textInput: {
        cancelLabel: "Cancelar entrada de texto",
        placeholder: "Digite um texto",
        ok: "Confirmar",
      },
      question: {
        cancelPrompt: "Cancelar prompt",
        selectAll: "Selecionar tudo",
        deselectAll: "Desmarcar tudo",
        page: (current: number, total: number) =>
          `Página ${current} / ${total}`,
        amount: "Amount",
        amountDefault: "Default",
        clearAmount: "Clear amount",
        decreaseAmount: "Decrease amount by one",
        increaseAmount: "Increase amount by one",
        pageHintMultiple:
          "Use < e > para trocar de página. Pressione ESC para cancelar",
        pageHintSingle: "Pressione ESC para cancelar",
        choices: {
          leftRingFinger: "Dedo anelar esquerdo",
          rightRingFinger: "Dedo anelar direito",
          here: "Aqui",
          onGround: "No chão",
          eligibleItems: "Itens válidos",
          allInventory: "Inventário completo",
        },
      },
      runtimeStartError: {
        closeLabel: "Voltar ao menu principal",
        title: "Falha ao inicializar o NetHack.",
        returnToMainMenu: "Voltar ao menu principal",
      },
      newGamePrompt: {
        closeLabel: "Fechar prompt de novo jogo",
        title: "Voltar ao menu principal?",
        reasonFallback: "Fim de jogo",
      },
      direction: {
        cancelLabel: "Cancelar prompt de direção",
      },
      info: {
        closeCharacter: "Fechar janela do personagem",
        closeInformation: "Fechar janela de informações",
        characterTitle: "Personagem",
        experienceProgress: "Progresso de experiência",
        levelLabel: (level: number) => `Nível ${level}`,
        xpAtMaxLevel: (xp: string) => `XP ${xp} (nível máximo alcançado)`,
        xpToNextLevel: (xp: string, next: string, remaining: string) =>
          `XP ${xp} / ${next} • faltam ${remaining} para o próximo nível`,
        vitals: "Vitais",
        characteristics: "Características",
        currentLimit: "Atual / Limite",
        armorClass: "Classe de armadura",
        currentStatus: "Estado atual",
        noActiveStatus: "Nenhum estado ativo.",
        currentAttributes: "Atributos atuais",
        noTemporaryAttributes: "Nenhum efeito temporário de atributo.",
        characterActions: "Ações do personagem",
        inventory: "Inventário",
        inventoryDetail: "Abrir itens carregados",
        closeHint:
          "Pressione ESPAÇO, ENTER ou ESC para fechar. Pressione Ctrl+M para reabrir.",
        infoTitleFallback: "Informações do NetHack",
        noDetails: "(Sem detalhes)",
      },
      inventory: {
        closeLabel: "Fechar inventário",
        title: "INVENTÁRIO",
        empty: "Seu inventário está vazio.",
        unknownItem: "Item desconhecido",
        closeHint: "Pressione ENTER, ESC ou 'i' para fechar.",
        closeHintWithContext:
          "Selecione um item para abrir comandos contextuais. Pressione ENTER, ESC ou 'i' para fechar",
      },
      inventoryDropMenu: {
        title: "Largar",
        dropType: "Tipo de descarte",
        dropAmount: "Quantidade a largar",
        dropSpecificAmount: "Largar uma quantidade específica",
        onlyStackedItems: "Disponível apenas para itens empilhados",
      },
      inventoryDropCount: {
        title: "Quantos desta pilha deseja largar?",
        chooseAmount: (max: number) =>
          `Escolha uma quantidade entre 1 e ${max}.`,
        ariaLabel: "Quantidade a largar",
        setMinimum: "Definir a quantidade mínima para largar",
        decrease: "Diminuir a quantidade em um",
        increase: "Aumentar a quantidade em um",
        setMaximum: "Definir a quantidade máxima para largar",
      },
      mobileActions: {
        extendedCommands: "Comandos estendidos",
        commonCommands: "Comandos comuns",
        allCommands: "Todos os comandos",
        actions: "Ações",
        menu: "Menu geral",
        close: "Fechar",
        wizardCommands: "Comandos de assistente",
        wizard: "Assistente",
        wizardCommandFallbackDescription:
          "Executa este comando de depuracao exclusivo do modo wizard.",
        wizardCommandDetails: {
          levelchange: { name: "Alterar nivel", description: "Define o nivel de experiencia do heroi." },
          lightsources: { name: "Fontes de luz", description: "Mostra fontes de luz moveis." },
          migratemons: { name: "Monstros migrantes", description: "Mostra monstros movendo entre niveis." },
          panic: { name: "Teste de panico", description: "Testa o panico e encerra esta partida." },
          polyself: { name: "Polimorfar-se", description: "Muda a forma atual do heroi." },
          seenv: { name: "Vetores vistos", description: "Mostra o mapa de depuracao de visao." },
          stats: { name: "Estatisticas de memoria", description: "Mostra estatisticas de memoria em execucao." },
          timeout: { name: "Fila de tempos", description: "Mostra efeitos temporizados e intrinsecos." },
          vanquished: { name: "Monstros derrotados", description: "Mostra contagens de monstros mortos." },
          vision: { name: "Matriz de visao", description: "Mostra a matriz de visao atual." },
          wizbury: { name: "Enterrar objetos proximos", description: "Enterra objetos do chao em uma area 3x3." },
          wizdetect: { name: "Detectar ocultos", description: "Revela coisas ocultas perto do heroi." },
          wizgenesis: { name: "Criar monstro", description: "Cria um monstro por nome ou classe." },
          wizidentify: { name: "Identificar inventario", description: "Identifica todos os itens no inventario." },
          wizintrinsic: { name: "Definir intrinsecos", description: "Ajusta intrinsecos temporizados escolhidos." },
          wizlevelport: { name: "Teleporte de nivel", description: "Teleporta para outro nivel ou ramo." },
          wizmakemap: { name: "Recriar nivel", description: "Gera novamente o nivel atual." },
          wizmap: { name: "Mapear nivel", description: "Revela o mapa do nivel e armadilhas." },
          wizrumorcheck: { name: "Verificar rumores", description: "Valida arquivos de rumores verdadeiros e falsos." },
          wizsmell: { name: "Cheirar monstro", description: "Cheira um monstro selecionado." },
          wizwhere: { name: "Niveis especiais", description: "Mostra onde os niveis especiais ficam." },
          wizwish: { name: "Desejo", description: "Cria item, armadilha ou terreno." },
          wmode: { name: "Modos de parede", description: "Mostra dados de depuracao das paredes." },
        },
        repeat: "Repetir",
        character: "Personagem",
        inventory: "Inventário",
        log: "Registro",
        pickUp: "Pegar",
        search: "Procurar",
        closeMessageLog: "Fechar registro de mensagens",
      },
      positionPrompt: {
        closeLabel: "Fechar prompt de posição",
        desktopHint:
          "Use o comando de movimento ou clique em um quadrado para mover a seleção. Clique novamente no quadrado selecionado ou pressione Enter para confirmar.",
        mobileHint:
          "Use o comando de movimento ou toque em um quadrado para mover a seleção. Toque novamente no quadrado selecionado ou pressione Enter para confirmar.",
        controllerHint:
          "Use o comando de movimento para mover a seleção. Pressione Enter ou Confirmar para confirmar.",
      },
      controllerSupport: {
        prompt: "Controle detectado. Ativar suporte a controle?",
      },
    },
  },
} satisfies LocaleOverrides<TranslationDictionary>;
