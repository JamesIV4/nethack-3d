export const fr = {
  meta: {
    locale: "fr-FR",
  },
  common: {
    appName: "NetHack 3D",
    confirm: "Confirmer",
    cancel: "Annuler",
    close: "Fermer",
    back: "Retour",
    yes: "Oui",
    no: "Non",
    delete: "Supprimer",
    edit: "Modifier",
    done: "Terminer",
    resetToDefaults: "Reinitialiser par defaut",
    later: "Plus tard",
    checking: "Verification...",
    downloading: "Telechargement...",
    canceling: "Annulation...",
    none: "Aucun",
    off: "Desactive",
    normal: "Mode normal",
    fps: "Mode FPS",
  },
  controller: {
    groups: {
      movement: "Deplacement",
      lookAndCamera: "Vue et camera",
      actions: "Actions de jeu",
      dialogs: "Boites de dialogue",
      system: "Systeme",
    },
    actions: {
      dpad_up: {
        label: "Croix directionnelle haut",
        description:
          "Naviguer vers le haut dans les dialogues et l'apercu de deplacement.",
      },
      dpad_down: {
        label: "Croix directionnelle bas",
        description:
          "Naviguer vers le bas dans les dialogues et l'apercu de deplacement.",
      },
      dpad_left: {
        label: "Croix directionnelle gauche",
        description:
          "Naviguer vers la gauche dans les dialogues et l'apercu de deplacement.",
      },
      dpad_right: {
        label: "Croix directionnelle droite",
        description:
          "Naviguer vers la droite dans les dialogues et l'apercu de deplacement.",
      },
      left_stick_up: {
        label: "Stick gauche haut",
        description: "Apercu de deplacement et curseur virtuel vers le haut.",
      },
      left_stick_down: {
        label: "Stick gauche bas",
        description: "Apercu de deplacement et curseur virtuel vers le bas.",
      },
      left_stick_left: {
        label: "Stick gauche gauche",
        description: "Apercu de deplacement et curseur virtuel vers la gauche.",
      },
      left_stick_right: {
        label: "Stick gauche droite",
        description: "Apercu de deplacement et curseur virtuel vers la droite.",
      },
      right_stick_up: {
        label: "Stick droit haut",
        description:
          "Regard, panoramique de la camera et defilement du dialogue vers le haut.",
      },
      right_stick_down: {
        label: "Stick droit bas",
        description:
          "Regard, panoramique de la camera et defilement du dialogue vers le bas.",
      },
      right_stick_left: {
        label: "Stick droit gauche",
        description: "Regard et panoramique de la camera vers la gauche.",
      },
      right_stick_right: {
        label: "Stick droit droite",
        description: "Regard et panoramique de la camera vers la droite.",
      },
      confirm: {
        label: "Confirmer / Cliquer",
        description: "Confirmer le deplacement et cliquer dans les dialogues.",
      },
      search: {
        label: "Chercher",
        description:
          "Chercher sur la case actuelle lorsqu'aucun apercu de mouvement n'est actif.",
      },
      cancel_or_context: {
        label: "Annuler / Contexte",
        description:
          "Ouvrir les actions contextuelles ou annuler le dialogue actuel.",
      },
      action_menu: {
        label: "Menu d'action",
        description: "Ouvrir le menu radial d'action de la manette.",
      },
      run_modifier: {
        label: "Modificateur de course",
        description:
          "Maintenir pour envoyer le prefixe de course avant le deplacement.",
      },
      zoom_in: {
        label: "Zoom (maintenir)",
        description:
          "Maintenez, puis utilisez le stick gauche haut/bas pour zoomer et le stick droit pour faire pivoter la camera.",
      },
      recenter_camera: {
        label: "Recentrer la camera",
        description: "Ramener la camera au centre du joueur.",
      },
      toggle_large_minimap: {
        label: "Basculer la grande mini-carte",
        description: "Basculer vers une tres grande taille de mini-carte.",
      },
      pause_menu: {
        label: "Menu pause",
        description: "Ouvrir ou fermer le menu pause.",
      },
      open_inventory: {
        label: "Inventaire",
        description: "Ouvrir la fenetre d'inventaire.",
      },
      open_character: {
        label: "Feuille de personnage",
        description: "Ouvrir la fenetre de feuille de personnage.",
      },
    },
    buttonLabels: {
      0: "Bouton A",
      1: "Bouton B",
      2: "Bouton X",
      3: "Bouton Y",
      4: "Gachette superieure gauche",
      5: "Gachette superieure droite",
      6: "Detente gauche",
      7: "Detente droite",
      8: "Retour / Vue",
      9: "Start / Menu principal",
      10: "Clic stick gauche",
      11: "Clic stick droit",
      12: "Croix directionnelle haut",
      13: "Croix directionnelle bas",
      14: "Croix directionnelle gauche",
      15: "Croix directionnelle droite",
      16: "Accueil",
    },
    axisLabels: {
      0: "Stick gauche X",
      1: "Stick gauche Y",
      2: "Stick droit X",
      3: "Stick droit Y",
    },
    directions: {
      leftStickLeft: "Stick gauche gauche",
      leftStickRight: "Stick gauche droite",
      leftStickUp: "Stick gauche haut",
      leftStickDown: "Stick gauche bas",
      rightStickLeft: "Stick droit gauche",
      rightStickRight: "Stick droit droite",
      rightStickUp: "Stick droit haut",
      rightStickDown: "Stick droit bas",
    },
    unbound: "Non attribue",
    axisFallback: (axisIndex: number) => `Axe ${axisIndex}`,
    buttonFallback: (buttonIndex: number) => `Bouton ${buttonIndex}`,
    slotLabel: (slotIndex: number) => `Emplacement ${slotIndex + 1}`,
    listening: "Entree en attente...",
    clear: "Effacer",
    controllerDetected: (count: number) =>
      `${count} manette${count === 1 ? "" : "s"} detectee${count === 1 ? "" : "s"}.`,
    noControllerDetected: "Aucune manette detectee.",
  },
  startupInitOptions: {
    accordion: {
      summary: "Options d'initialisation (facultatif)",
      description:
        "Entrees `OPTIONS` NetHack supplementaires appliquees au demarrage. Les options specifiques au port de fenetre et a la plateforme sont volontairement omises.",
      resetToDefaults: "Reinitialiser les valeurs par defaut",
    },
    options: {
      playmode: {
        label: "Mode de jeu",
        description:
          "Choisissez le mode de demarrage. Le mode assistant est le mode de debogage de NetHack (`playmode:debug`).",
        options: {
          normal: "Mode normal",
          explore: "Explorer",
          debug: "Assistant/Debug",
        },
      },
      number_pad: {
        label: "Touches de deplacement",
        description:
          "Choisissez si NetHack utilise le pave numerique (`number_pad:1`) ou les touches vi traditionnelles (`number_pad:0`) pour le deplacement.",
        options: {
          numeric: "Pave numerique",
          vi: "Touches vi",
        },
      },
      autopickup: {
        label: "Ramassage automatique",
        description:
          "Ramasse automatiquement les classes d'objets selectionnees dans les types de ramassage.",
      },
      pickup_types: {
        label: "Types de ramassage",
        description:
          'Symboles des classes d\'objets a ramasser automatiquement (exemple : $"=/!?+). Laissez vide pour utiliser le choix par defaut du jeu.',
        placeholder: '$"=/!?+',
      },
      pickup_thrown: {
        label: "Ramasser les objets lances",
        description:
          "Ramasse automatiquement les objets lances lorsqu'ils atterrissent.",
      },
      pickup_burden: {
        label: "Seuil d'encombrement du ramassage",
        description:
          "Demande confirmation avant le ramassage si ce niveau d'encombrement serait depasse.",
        options: {
          u: "Sans charge (u)",
          b: "Charge (b)",
          s: "Encombre (s)",
          n: "Gene (n)",
          t: "Surcharge (t)",
          l: "Tres surcharge (l)",
        },
      },
      pile_limit: {
        label: "Limite de pile",
        description:
          "Seuil du nombre d'objets qui declenche une liste contextuelle pour les piles au sol.",
      },
      autoquiver: {
        label: "Carquois auto",
        description:
          "Remplit automatiquement le carquois ou prepare une arme adaptee lors d'un tir.",
      },
      autoopen: {
        label: "Ouverture auto",
        description:
          "Essaie automatiquement d'ouvrir les portes en se deplacant contre elles.",
      },
      autodig: {
        label: "Creusage auto",
        description:
          "Creuse automatiquement dans les murs lorsque c'est possible en s'y deplacant.",
      },
      cmdassist: {
        label: "Aide aux commandes",
        description:
          "Affiche un texte d'aide supplementaire lorsque des commandes sont mal saisies.",
      },
      confirm: {
        label: "Confirmer les attaques",
        description: "Demande avant d'attaquer des creatures paisibles.",
      },
      safe_pet: {
        label: "Animal protege",
        description: "Demande avant de frapper votre animal.",
      },
      help: {
        label: "Aide en jeu",
        description:
          "Propose d'afficher des details supplementaires d'examen/aide lorsque davantage d'informations existent.",
      },
      legacy: {
        label: "Introduction legacy",
        description: "Affiche l'introduction de l'histoire au debut d'une partie.",
      },
      rest_on_space: {
        label: "Repos avec espace",
        description: "Traite la touche espace comme attendre/se reposer.",
      },
      pushweapon: {
        label: "Ranger l'arme",
        description:
          "Deplace l'arme actuellement maniee dans l'autre main lors d'un echange.",
      },
      extmenu: {
        label: "Menu de commandes etendues",
        description: "Utilise un menu contextuel pour les commandes etendues.",
      },
      fixinv: {
        label: "Fixer les lettres d'inventaire",
        description:
          "Essaie de conserver les lettres d'inventaire lorsque les objets changent de place.",
      },
      implicit_uncursed: {
        label: "Afficher non maudit",
        description:
          "Inclut toujours le mot 'non maudit' dans les descriptions d'inventaire.",
      },
      mention_walls: {
        label: "Signaler les murs",
        description: "Affiche un message en se deplacant contre un mur.",
      },
      sortloot: {
        label: "Trier les listes de butin",
        description:
          "Comportement du tri pour les listes de ramassage et de selection d'inventaire.",
        options: {
          f: "Complet",
          l: "Butin seulement",
          n: "Aucun",
        },
      },
      sortpack: {
        label: "Trier l'inventaire",
        description:
          "Trie le contenu du sac par type lors de l'affichage de l'inventaire.",
      },
      msghistory: {
        label: "Taille de l'historique des messages",
        description:
          "Nombre de messages de la ligne superieure conserves pour consultation.",
      },
      dogname: {
        label: "Nom du chien",
        description: "Nom par defaut de votre premier chien.",
        placeholder: "Medor",
      },
      catname: {
        label: "Nom du chat",
        description: "Nom par defaut de votre premier chat.",
        placeholder: "Felix",
      },
      horsename: {
        label: "Nom du cheval",
        description: "Nom par defaut de votre premier cheval.",
        placeholder: "Eclair",
      },
      pettype: {
        label: "Animal prefere",
        description:
          "Type d'animal initial prefere pour les roles qui peuvent varier.",
        options: {
          default: "Defaut du jeu",
          cat: "Chat",
          dog: "Chien",
          horse: "Cheval",
          none: "Aucun",
        },
      },
      fruit: {
        label: "Fruit prefere",
        description: "Nom du type de fruit apprecie par votre personnage.",
        placeholder: "moisissure gluante",
      },
      packorder: {
        label: "Ordre du sac",
        description: "Ordre des classes d'objets affichees dans l'inventaire.",
        placeholder: '")[%?+/=!(*0_`',
      },
      paranoid_confirmation: {
        label: "Confirmation paranoiaque",
        description:
          "Confirmations supplementaires separees par des espaces (exemple : confirm quit attack pray).",
        placeholder: "confirm quit attack pray",
      },
      sparkle: {
        label: "Etincelle de resistance magique",
        description:
          "Affiche des effets d'etincelle speciaux pour la resistance magique.",
      },
      standout: {
        label: "Monstres/More en evidence",
        description: "Met en gras les monstres et les invites --More--.",
      },
      tombstone: {
        label: "Pierre tombale",
        description: "Affiche l'image de pierre tombale a la mort.",
      },
      verbose: {
        label: "Messages detailles",
        description:
          "Utilise des formulations plus developpees pour les messages d'etat et d'action.",
      },
    },
  },
  soundEffects: {
    byKey: {
      "player-walk": "Pas du joueur",
      hit: "Impact",
      "monster-killed": "Monstre tue (joueur)",
      "monster-killed-other": "Monstre tue (autre)",
      "missed-attack": "Attaque ratee",
      "thrown-weapon": "Arme lancee",
      "door-opens": "Porte qui s'ouvre",
      "door-closes": "Porte qui se ferme",
      "door-kick": "Coup de pied dans la porte",
      "door-smash": "Porte brisee",
      "door-resists": "La porte resiste",
      "door-distant": "Porte au loin",
      "walk-down-stairs": "Descendre les escaliers",
      "walk-up-stairs": "Monter les escaliers",
      eating: "Manger",
      drink: "Boire",
      "quaff-potion": "Boire une potion",
      "pickup-gold": "Ramasser de l'or",
      "pickup-item": "Ramasser un objet",
      "find-hidden": "Trouver une porte/un passage cache",
      "level-up": "Monter de niveau",
      unlock: "Deverrouiller",
      "boulder-push": "Pousser un rocher",
      "boulder-blocked": "Rocher bloque",
      splash: "Eclaboussure",
      searching: "Recherche",
      "magic-cast": "Sort lance",
      "magic-heal": "Soin magique",
      "magic-buff": "Amelioration magique",
    },
  },
  characterSheet: {
    titleFallback: "Feuille de personnage",
    sectionTitles: {
      overview: "Vue d'ensemble",
      background: "Historique",
      basics: "Bases",
      characteristics: "Caracteristiques actuelles",
      status: "Etat actuel",
      attributes: "Attributs actuels",
    },
    statLabels: {
      strength: "Force",
      dexterity: "Dexterite",
      constitution: "Constitution physique",
      intelligence: "Intellect",
      wisdom: "Sagesse",
      charisma: "Charisme",
    },
    commands: {
      enhance: {
        label: "Ameliorer",
        detail: "Monter les competences",
      },
      conduct: {
        label: "Conduite",
        detail: "Afficher la progression du defi",
      },
      overview: {
        label: "Vue d'ensemble",
        detail: "Afficher la progression dans le donjon",
      },
      spells: {
        label: "Sorts",
        detail: "Examiner les sorts connus",
      },
      seespells: {
        label: "Livre de sorts",
        detail: "Lister l'inventaire des sorts",
      },
      technique: {
        label: "Technique",
        detail: "Utiliser les capacites de role/race",
      },
      known: {
        label: "Decouvertes",
        detail: "Liste des objets connus",
      },
      pray: {
        label: "Prier",
        detail: "Tenter une priere",
      },
    },
  },
  castMenu: {
    schoolLabel: "Ecole :",
    headings: {
      name: "Nom",
      level: "Niveau",
      category: "Categorie",
      fail: "Echec",
      retention: "Memoire",
    },
    summary: {
      known: (count: number) => `${count} connu${count === 1 ? "" : "s"}`,
      castable: (count: number) =>
        `${count} lancable${count === 1 ? "" : "s"}`,
      bestSuccess: (percent: number) => `Meilleure reussite ${percent}%`,
      averageFail: (percent: number) => `Echec moyen ${percent}%`,
      schoolCount: (count: number) =>
        `${count} ecole${count === 1 ? "" : "s"}`,
    },
    retention: {
      unknown: "Inconnue",
      gone: "Disparue",
      full: "100 %",
    },
  },
  enhanceMenu: {
    defaultGroupTitle: "Competences",
    availability: {
      available_now: "Disponible",
      needs_experience: "Exp/Empl.",
      needs_practice: "Pratique",
      maxed_out: "Max",
    },
    summary: {
      available: (count: number) =>
        `${count} disponible${count === 1 ? "" : "s"}`,
      gated: (count: number) =>
        `${count} bloque${count === 1 ? "" : "s"} par l'experience/les emplacements`,
      practice: (count: number) =>
        `${count} necessite${count === 1 ? "" : "nt"} de la pratique`,
      maxed: (count: number) => `${count} au maximum`,
    },
    maxLabel: "Max",
    slotCount: (count: number) =>
      `${count} emplacement${count === 1 ? "" : "s"}`,
  },
  app: {
    unknownTime: "Heure inconnue",
    debugSession: {
      possibleCrash: "plantage possible",
      active: "actif",
    },
    debugLogs: {
      buildLabelAria: (
        buildLabel: string,
        currentCount: number,
        requiredCount: number,
      ) =>
        `Build ${buildLabel}. Hidden debug logging toggle progress ${currentCount} of ${requiredCount}.`,
      enabledToast: "Journal de debug active",
      enabledLogEntry:
        "Journal de debug active via l'easter egg de l'etiquette de build au demarrage.",
      openLink: "Voir les journaux de debug",
      clearedLogEntry: "Journaux de debug stockes effaces par l'utilisateur.",
    },
    statusEffects: {
      turningToStone: "Petrification",
      slimed: "Englue",
      strangled: "Etrangle",
      foodPoisoning: "Intoxication alimentaire",
      terminallyIll: "Maladie terminale",
      blind: "Aveugle",
      deaf: "Sourd",
      stunned: "Etourdi",
      confused: "Confus",
      hallucinating: "Hallucine",
      levitating: "En levitation",
      flying: "En vol",
      riding: "Monte",
      barehanded: "Mains nues",
      busy: "Occupe",
      iron: "Fer",
      glowingHands: "Mains lumineuses",
      grabbed: "Attrape",
      held: "Immobilise",
      icy: "Glace",
      inLava: "Dans la lave",
      paralyzed: "Paralyse",
      sleeping: "Endormi",
      slippery: "Glissant",
      submerged: "Submerge",
      tethered: "Attache",
      trapped: "Piege",
      unconscious: "Inconscient",
      woundedLegs: "Jambes blessees",
      holding: "Tient",
    },
    characterStats: {
      descriptions: {
        strength:
          "Affecte les degats de melee, la capacite de charge et les actions basees sur la force.",
        dexterity:
          "Affecte les chances de toucher, l'interaction avec les pieges et l'agilite defensive.",
        constitution:
          "Affecte la progression des PV et la resistance au poison et aux effets de drain.",
        intelligence:
          "Affecte la lecture et la reussite de nombreuses actions liees aux sorts.",
        wisdom:
          "Affecte la progression de l'energie magique et la fiabilite des sorts.",
        charisma:
          "Affecte les interactions avec les boutiques, la gestion des animaux et les issues sociales.",
      },
      armorClassDescription:
        "Plus bas est meilleur. La classe d'armure reduit les chances des ennemis de vous toucher.",
    },
    directionHelp: {
      controller:
        "Cliquez sur une direction, ou utilisez le stick gauche/la croix directionnelle pour previsualiser puis relachez pour confirmer. Le cercle central vous cible. Utilisez < ou > pour les escaliers. Appuyez sur ESC pour annuler.",
      numpad:
        "Cliquez sur une direction. Le cercle central vous cible. Vous pouvez aussi utiliser le pave numerique (1-4,6-9), les fleches, <, > ou s. Appuyez sur ESC pour annuler.",
      viKeys:
        "Cliquez sur une direction. Le cercle central vous cible. Vous pouvez aussi utiliser hjkl/yubn, les fleches, <, > ou s. Appuyez sur ESC pour annuler.",
      fps: "Regardez pour viser. Clic gauche ou W confirme. S vous cible. A/D ou clic droit annule.",
    },
    inventoryContextActions: {
      apply: "Utiliser",
      invoke: "Invoquer",
      tip: "Verser",
      loot: "Piller",
      drop: "Lacher",
      eat: "Manger",
      quaff: "Boire",
      read: "Lire",
      rub: "Frotter",
      throw: "Lancer",
      wield: "Manier",
      quiver: "Mettre au carquois",
      wear: "Porter",
      takeOff: "Retirer",
      putOn: "Mettre",
      remove: "Enlever",
      zap: "Zapper",
      untrap: "Desamorcer",
      offer: "Offrir",
      name: "Nommer",
      call: "Appeler",
      adjust: "Ajuster",
      engrave: "Graver",
      dip: "Tremper",
      info: "Infos",
      unwield: "Ranger l'arme",
    },
    mobileActions: {
      wait: "Attendre",
      zap: "Zapper",
      cast: "Lancer",
      kick: "Donner un coup de pied",
      read: "Lire",
      quaff: "Boire",
      eat: "Manger",
      glance: "Jeter un coup d'oeil",
      loot: "Piller",
      open: "Ouvrir",
      wield: "Manier",
      wear: "Porter",
      putOn: "Mettre",
      takeOff: "Retirer",
      extended: "Etendu",
    },
    clientOptions: {
      config: {
        groupControls: "Manette et mode a la premiere personne",
        sectionControlsController: "Manette",
        controllerEnabled: {
          label: "Activer la prise en charge de la manette",
          description:
            "Active l'entree de la manette pour le jeu et les boites de dialogue de l'interface.",
        },
        sectionControlsLook: "Vue et camera",
        invertLookYAxis: {
          label: "Inverser l'axe Y de la vue",
          description: "Inverse la direction verticale de la vue souris et tactile.",
        },
        fpsLookSensitivityX: {
          label: "Sensibilite FPS X",
          description: "Sensibilite horizontale de la vue souris/tactile.",
        },
        fpsLookSensitivityY: {
          label: "Sensibilite FPS Y",
          description: "Sensibilite verticale de la vue souris/tactile.",
        },
        snapCameraYawToNearest45: {
          label: "Aligner l'angle de la camera sur 45 degres",
          description:
            "Lorsque l'entree de rotation de la camera est relachee, l'orientation s'aligne en douceur sur l'angle de 45 degres le plus proche.",
        },
        sectionControlsMovement: "Comportement du deplacement",
        cameraRelativeMovement: {
          label: "Deplacement et glissements relatifs a la camera",
          description:
            "Fait tourner les touches de deplacement et les directions de glissement selon l'angle Y de la camera.",
        },
        fpsWasdKeyboardMovementEnabled: {
          label: "Activer le deplacement WASD au clavier en mode FPS",
          description:
            "Utilise W/A/S/D pour le deplacement a la premiere personne. Desactivez cette option pour que ces touches se comportent comme des commandes NetHack normales.",
        },
        controllerFpsMoveRepeatMs: {
          label: "Repetition du mouvement FPS au stick gauche",
          description:
            "Delai de repetition du mouvement du stick gauche en mode FPS (plus bas = plus rapide).",
        },
        groupInterface: "Interface utilisateur",
        locale: {
          label: "Langue",
          description:
            "Choisissez la langue de l'interface. La valeur par defaut suit la region de votre navigateur lorsqu'elle est prise en charge, avec l'anglais en repli.",
          options: {
            en: "Anglais",
          },
        },
        sectionDisplayCamera: "Camera et perspective",
        fpsMode: {
          label: "Mode a la premiere personne",
          description: "Utilise les commandes a la premiere personne et la vue souris.",
        },
        fpsFlattenEntityBillboards: {
          label: "Aplatir les sprites de tuiles qui se chevauchent",
          description:
            "Aplatit les sprites de tuiles pour le butin ou les elements du donjon lorsque des monstres, des animaux ou le joueur se tiennent dessus. Desactivez pour conserver les sprites superposes sous forme de panneaux verticaux. Les tuiles Vulture restent toujours verticales.",
        },
        fpsHeldWeaponVisible: {
          label: "Afficher l'arme FPS",
          description: "Affiche le sprite de l'arme tenue en vue a la premiere personne.",
        },
        showItemsUnderPlayerInOverheadTilesMode: {
          label: "Afficher les objets sous le joueur en vue dessus",
          description:
            "Affiche les objets et elements de sol sous le joueur en mode tuiles vue dessus a l'aide des donnees de glyphes en sous-couche.",
        },
        fpsFov: {
          label: "Champ de vision FPS",
          description: "Ajuste le champ de vision de la camera a la premiere personne.",
        },
        sectionDisplayGraphics: "Graphismes et rendu",
        tilesetMode: {
          label: "Affichage",
          description: "Utilise des tuiles graphiques au lieu de l'ASCII.",
          options: {
            ascii: "Mode ASCII",
            tiles: "Tuiles",
          },
        },
        tilesetPath: {
          label: "Jeu de tuiles",
          description: "Jeux de tuiles integres et importes.",
        },
        antialiasing: {
          label: "Anticrenelage",
          description: "Mode de lissage des bords pour le rendu 3D.",
          options: {
            taa: "TAA",
            fxaa: "FXAA",
          },
        },
        lightingEnabled: {
          label: "Eclairage",
          description:
            "Active l'eclairage dynamique de la scene et l'assombrissement du donjon. Desactivez pour un rendu plus plat et toujours eclaire.",
        },
        blockAmbientOcclusion: {
          label: "Occlusion ambiante",
          description:
            "Ajoute un ombrage de contact subtil entre les blocs du sol et des murs.",
        },
        brightness: {
          label: "Luminosite",
          description: "Ajuste la luminosite generale de la scene.",
        },
        contrast: {
          label: "Contraste",
          description: "Ajuste le contraste global du contenu rendu.",
        },
        gamma: {
          label: "Correction gamma",
          description: "Ajuste le gamma d'affichage du contenu rendu.",
        },
        sectionDisplayInterface: "Interface utilisateur",
        uiFontScale: {
          label: "Echelle de police de l'interface",
          description:
            "Met a l'echelle toutes les tailles de police de l'interface du jeu a partir de leurs valeurs par defaut.",
        },
        disableAnimatedTransitions: {
          label: "Desactiver les transitions animees",
          description:
            "Desactive les animations de fondu, de mouvement et de transition de l'interface pour des changements plus rapides.",
        },
        uiTileBackgroundRemoval: {
          label: "Retirer les fonds des tuiles dans l'interface",
          description:
            "Applique la suppression de fond de tuile/chroma aux icones de tuiles affichees dans les panneaux de l'interface.",
        },
        desktopTouchInterfaceMode: {
          label: "Interface tactile sur ordinateur",
          description:
            "Affiche les commandes tactiles sur ordinateur et permet de choisir une disposition portrait ou paysage.",
          options: {
            off: "Desactive",
            portrait: "Utiliser l'interface tactile portrait",
            landscape: "Utiliser l'interface tactile paysage",
          },
        },
        sectionDisplayMessages: "Messages et journal",
        desktopMessageLogWindowScale: {
          label: "Taille de la fenetre du journal sur ordinateur",
          description:
            "Redimensionne la fenetre encadree du journal de messages sur ordinateur sans modifier la taille de la police.",
        },
        liveMessageLog: {
          label: "Journal de messages en direct",
          description: "Affiche le journal de messages defilant en jeu.",
        },
        showPersistentMobileMessageLog: {
          label: "Afficher le journal de messages persistant",
          description:
            "Garde le journal de messages mobile compact visible pendant le jeu. Le bouton Journal peut toujours ouvrir le grand journal.",
        },
        rumbleEnabled: {
          label: "Activer les vibrations",
          description:
            "Utilise un bref retour haptique pour les degats infliges et subis sur les appareils mobiles compatibles.",
        },
        sectionMobileSafeZone: "Zones sures mobiles",
        manualMobileBottomSafeZoneEnabled: {
          label: "Remplacer les zones sures mobiles detectees",
          description:
            "Utilise des marges de zone sure manuelles lorsque les consoles Android portables signalent mal les zones sures.",
        },
        manualMobileBottomSafeZoneVerticalPx: {
          label: "Zone sure inferieure verticale",
          description:
            "Zone sure inferieure manuelle pour la disposition mobile verticale.",
        },
        manualMobileBottomSafeZoneHorizontalPx: {
          label: "Zone sure inferieure horizontale",
          description:
            "Zone sure inferieure manuelle pour la disposition mobile horizontale.",
        },
        manualMobileRightSafeZoneHorizontalPx: {
          label: "Zone sure droite horizontale",
          description:
            "Zone sure droite manuelle pour la disposition mobile horizontale.",
        },
        manualMobileBottomSafeZonePreview: "Zone sure inferieure",
        manualMobileRightSafeZonePreview: "Zone sure droite",
        liveMessageDisplayTimeMs: {
          label: "Duree d'affichage des messages en direct",
          description:
            "Temps pendant lequel un message flottant reste entierement visible avant de s'estomper.",
        },
        liveMessageFadeOutTimeMs: {
          label: "Duree du fondu des messages en direct",
          description: "Duree de l'animation de fondu des messages flottants.",
        },
        liveMessageLogFontScale: {
          label: "Echelle de police des messages en direct",
          description:
            "Met a l'echelle les messages d'action flottants qui s'affichent vers le haut a partir de leur taille par defaut.",
        },
        sectionDisplayMinimap: "Mini-carte",
        minimap: {
          label: "Mini-carte",
          description: "Affiche ou masque la mini-carte du donjon.",
        },
        minimapScale: {
          label: "Echelle de la mini-carte",
          description: "Met a l'echelle la taille de la mini-carte a partir de sa valeur par defaut.",
        },
        sectionDisplayInventory: "Presentation de l'inventaire",
        reduceInventoryMotion: {
          label: "Reduire le mouvement de l'inventaire",
          description:
            "Desactive l'expansion animee des lignes d'inventaire et utilise des interactions plus simples.",
        },
        inventoryTileOnlyMotion: {
          label: "Animer uniquement les tuiles d'inventaire",
          description:
            "Anime les tuiles d'icone tout en conservant fixes la hauteur et l'espacement des lignes d'inventaire.",
        },
        inventoryFixedTileSize: {
          label: "Taille fixe des tuiles d'inventaire",
          description:
            "S'applique uniquement quand la reduction du mouvement de l'inventaire est activee. Choisissez une taille d'icone fixe.",
          options: {
            none: "Aucune",
            small: "Petite",
            medium: "Moyenne",
            large: "Grande",
          },
        },
        groupSound: "Son",
        soundEnabled: {
          label: "Activer le son",
          description:
            "Active ou desactive l'audio FMOD. La desactivation reduit la charge de traitement audio sur les appareils moins puissants.",
        },
        groupMobileControls: "Commandes mobiles",
        invertTouchPanningDirection: {
          label: "Inverser la direction du panoramique",
          description: "Inverse la direction du glissement pour le panoramique une fois le maintien pour panoramiquer active.",
        },
        groupCombat: "Retour de combat",
        damageNumbers: {
          label: "Degats numeriques",
          description: "Affiche les nombres flottants de degats et de soins.",
        },
        displayStatChangesAbovePlayer: {
          label: "Afficher les changements de stats au-dessus du joueur",
          description:
            "Affiche des etiquettes flottantes pour les changements de statistiques comme la Force et la CA.",
        },
        displayXpGainsAbovePlayer: {
          label: "Afficher les gains d'XP au-dessus du joueur",
          description:
            "Affiche des etiquettes flottantes de gain d'XP lorsque l'experience augmente.",
        },
        tileShakeOnHit: {
          label: "Secousse des tuiles a l'impact",
          description: "Secoue les tuiles d'impact lors des coups portes.",
        },
        sectionCombatBlood: "Effets de sang",
        blood: {
          label: "Sang",
          description:
            "Affiche des effets de brume sanglante et de flaques au sol lors des impacts.",
        },
        bloodMist: {
          label: "Brume de sang",
          description:
            "Affiche des particules de brume de sang en l'air lors des impacts.",
        },
        bloodGround: {
          label: "Eclaboussures de sang",
          description:
            "Affiche des eclaboussures de sang sur le sol du donjon apres les impacts.",
        },
        bloodStrength: {
          label: "Intensite du sang",
          description:
            "Controle la force visuelle des textures et de la teinte du sang.",
        },
        bloodDetail: {
          label: "Detail du sang",
          description:
            "Choisit la resolution des eclaboussures de sang par tuile du donjon.",
          options: {
            veryLow: "Tres faible",
            low: "Faible",
            medium: "Moyen",
            high: "Eleve",
          },
        },
        bloodColorLightHex: {
          label: "Teinte claire du sang au sol",
          description:
            "Choisit la teinte de sang la plus claire pour les nouvelles eclaboussures au sol.",
        },
        bloodColorDarkHex: {
          label: "Teinte sombre du sang au sol",
          description:
            "Choisit la teinte de sang la plus sombre pour les zones denses au sol.",
        },
        bloodMistColorHex: {
          label: "Teinte de la brume de sang",
          description:
            "Choisit la teinte de base utilisee pour la brume de sang en l'air.",
        },
        monsterShatter: {
          label: "Monstres en eclats",
          description:
            "Fracasse les panneaux des monstres vaincus en eclats physiques.",
        },
        monsterShatterBloodBorders: {
          label: "Bordures sanglantes des eclats",
          description:
            "Teinte les pixels des eclats proches des lignes de fracture avec des bords rouge sang aleatoires.",
        },
        groupCompatibility: "Compatibilite d'execution",
        darkCorridorWalls367: {
          label: "Murs de couloir sombres legacy",
          description:
            "Deduit et met en cache les tuiles de murs de couloir sombres pour les runtimes NetHack 3.4.3/3.6.x anciens, y compris Slash'EM.",
        },
        overrideNh5DarkCorridorWallTiles: {
          label: "Remplacer les tuiles de murs sombres NetHack 5.0",
          description:
            "Applique les reglages de remplacement des murs sombres aux tuiles de murs de couloir sombres de NetHack 5.0.",
        },
        darkCorridorWallTileOverrideEnabled: {
          label: "Remplacer la tuile de mur sombre",
          description:
            "Utilise une tuile d'atlas personnalisee pour les remplacements de murs sombres, enregistree par jeu de tuiles.",
        },
        darkCorridorWallSolidColorOverrideEnabled: {
          label: "Utiliser une couleur unie pour les murs sombres",
          description: "Utilise une couleur RGB choisie au lieu d'une tuile du jeu de tuiles.",
        },
      },
      tabs: {
        display: {
          label: "Affichage",
          description: "Parametres d'interface et d'affichage.",
        },
        mobile: {
          label: "Mobile",
          description:
            "Parametres d'interface et de jeu specifiques au mobile.",
        },
        controls: {
          label: "Commandes",
          description: "Affectations de la manette, mode FPS et comportement de la vue.",
        },
        sound: {
          label: "Son",
          description: "Sortie audio et reglages sonores lies aux performances.",
        },
        combat: {
          label: "Affrontement",
          description: "Retour d'impact en combat et reponse visuelle.",
        },
        compatibility: {
          label: "Compatibilite",
          description: "Compatibilite d'execution et options de comportement NetHack.",
        },
        updates: {
          label: "Mises a jour",
          description:
            "Verifier les mises a jour en ligne du jeu et examiner les changements en attente.",
        },
      },
    },
    update: {
      loading: {
        startupData: "Chargement des donnees de demarrage...",
        tileset: "Chargement du jeu de tuiles...",
        runtime: "Demarrage de l'execution locale...",
      },
      runtimeStoppedBeforeStartup:
        "L'execution locale de NetHack s'est arretee avant la fin du demarrage.",
      preparingDownload: "Preparation du telechargement de la mise a jour du jeu...",
      idleStatus: "Le statut de mise a jour est inactif.",
      fileProgress: (index: number, count: number) =>
        `File ${index} of ${count}`,
      unexpectedCheckFailure: "Echec inattendu lors de la verification des mises a jour.",
      cancelRequested: "Annulation demandee.",
      stoppingActiveDownloadTask: "Arret de la tache de telechargement active.",
      unableToCancelDownload: "Impossible d'annuler le telechargement de la mise a jour.",
      noActiveDownloadToCancel: "Aucun telechargement de mise a jour actif a annuler.",
      startingDownload: "Demarrage du telechargement de la mise a jour du jeu.",
      canceled: "Le telechargement de la mise a jour a ete annule.",
      unableToDownloadAndApply: "Impossible de telecharger et d'appliquer les mises a jour.",
      failed: "La mise a jour a echoue.",
      latestAlreadyInstalled: "La derniere mise a jour est deja installee.",
      downloadComplete: "Telechargement de la mise a jour termine.",
      nothingAppliedTryAgain:
        "Aucune mise a jour n'a ete appliquee. Veuillez relancer la verification.",
      noFilesApplied: "Aucun fichier de mise a jour n'a ete applique.",
      unexpectedFailure: "Echec inattendu de la mise a jour.",
      checkingForUpdates: "Verification des versions GitHub...",
      unsupportedPlatform:
        "La verification des versions GitHub n'est pas disponible sur cette plateforme.",
      latestAlreadyInstalledOptions:
        "Vous avez deja la version la plus recente du jeu.",
      oneUpdateAvailable:
        "Une nouvelle version du jeu est disponible. Voulez-vous la mettre a jour ?",
      manyUpdatesAvailable: (count: number) =>
        `${count} nouvelles versions du jeu sont disponibles. Voulez-vous la mettre a jour ?`,
      updateCheckFailed: (message: string) =>
        `La verification des versions GitHub a echoue : ${message}`,
    },
    saves: {
      sections: {
        manual: "Sauvegardes manuelles",
        autosave: "Sauvegardes automatiques",
      },
      deleteTitle: "Supprimer la partie sauvegardee ?",
      deleteMessage: (name: string) =>
        `Are you sure you want to delete ${name}?`,
      overwriteTitle: "Ecraser la partie sauvegardee ?",
      overwriteMessage: (name: string) =>
        `A saved game named "${name}" already exists. Do you want to overwrite it with a new character?`,
      errorLoading: "Erreur lors du chargement des sauvegardes",
      loading: "Chargement des sauvegardes...",
      noneFound: "Aucune partie sauvegardee trouvee.",
      savedAt: (date: string) => `Saved: ${date}`,
    },
    tilesets: {
      userTileset: "Jeu de tuiles utilisateur",
      currentSelectionFallback: "ce jeu de tuiles",
      deleteUploadedTitle: "Supprimer le jeu de tuiles importe ?",
      deleteUploadedMessage: (label: string) =>
        `Delete '${label}' from uploaded tilesets?`,
      failedToDelete: "Echec de la suppression du jeu de tuiles.",
      chooseFile: "Choisissez un fichier de jeu de tuiles PNG/BMP/GIF/JPEG.",
      provideName: "Donnez un nom a ce jeu de tuiles.",
      failedToSave: "Echec de l'enregistrement du jeu de tuiles.",
      failedToLoadUploaded: "Echec du chargement des jeux de tuiles importes :",
      userTilesetSuffix: "Jeu de tuiles utilisateur (utilisateur)",
      noTilesetsFound: "Aucun jeu de tuiles trouve",
      failedToReadImage: "Echec de la lecture de l'image du jeu de tuiles.",
    },
    tilePicker: {
      noAtlasAvailable: "Aucun atlas de tuiles disponible.",
      unableToLoadAtlas: "Impossible de charger l'atlas de tuiles.",
      atlasLoaded: "Atlas de tuiles charge.",
      loadingAtlas: "Chargement de l'atlas de tuiles...",
      selectedTile: (tileId: number) => `Selected: tile #${tileId}`,
      glyph: (label: string) => `Glyph ${label}`,
      tile: (tileId: number) => `Tile ${tileId}`,
      defaultBadge: "Defaut",
      resetToDefault: "Retablir la valeur par defaut",
      darkWallTitle: "Selecteur de tuile de mur sombre",
      closeDarkWall: "Fermer le selecteur de tuile de mur sombre",
      closeBackground: "Fermer le selecteur de tuile de fond du jeu de tuiles",
      backgroundHelper:
        "Utilise pour supprimer l'arriere-plan partage du jeu de tuiles des panneaux de monstres et de butin.",
      backgroundTitle: "Selecteur de tuile de fond du jeu de tuiles",
      backgroundTitleWithLabel: (label: string) =>
        `Tileset Background Tile Picker: ${label}`,
      closeSolidColor: "Fermer le selecteur de couleur chroma unie",
      solidColorTitle: "Selecteur de couleur chroma unie",
      solidColorTitleWithLabel: (label: string) =>
        `Solid Color Chroma Key Picker: ${label}`,
    },
    soundPack: {
      discardChangesTitle: "Ignorer les modifications du pack sonore ?",
      discardChangesMessage:
        "Ignorer les modifications non enregistrees du pack sonore et continuer ?",
      discard: "Ignorer",
      keepEditing: "Continuer la modification",
      failedToLoadIndexedDb:
        "Echec du chargement des packs sonores depuis IndexedDB.",
      failedToSelectRequested:
        "Impossible de selectionner le pack sonore demande.",
      provideName: "Saisissez un nom pour le pack sonore.",
      created: (name: string) => `Pack sonore '${name}' cree.`,
      failedToCreate: "Echec de la creation du pack sonore.",
      saved: (name: string) => `Pack sonore '${name}' enregistre.`,
      failedToSave: "Echec de l'enregistrement du pack sonore.",
      failedToExportZip: "Echec de l'export du ZIP du pack sonore.",
      exported: (name: string) => `Exportation de '${name}' terminee.`,
      failedToImportZip: "Echec de l'import du ZIP du pack sonore.",
      imported: (name: string) => `Importation de '${name}' terminee.`,
      deleteTitle: "Supprimer le pack sonore ?",
      deleteMessage: (name: string) =>
        `Supprimer le pack sonore '${name}' ? Cette action est irreversible.`,
      deleted: (name: string) => `Le pack sonore '${name}' a ete supprime.`,
      failedToDelete: "Echec de la suppression du pack sonore.",
      noPreviewSource: "Aucune source d'apercu disponible pour ce son.",
      unableToPreview: "Impossible de lire un apercu de ce son.",
      title: "Packs sonores",
      activePack: "Pack sonore actif",
      activePackDescription:
        "Selectionnez le pack sonore actif utilise pour la resolution des chemins audio.",
      createNew: "Creer un nouveau pack sonore",
      createDescription:
        "Cree un pack sonore personnalise qui remplace les valeurs par defaut.",
      createNameLabel: "Nom du nouveau pack sonore",
      createPlaceholder: "Mon pack sonore",
      createAndSave: "Creer et enregistrer",
      packName: "Nom du pack",
      packNameDescription:
        "Renommez ce pack et enregistrez-le pour mettre a jour son espace de noms de fichiers audio.",
      savePack: "Enregistrer le pack sonore",
      export: "Exporter le pack sonore",
      import: "Importer un pack sonore",
      deletePack: "Supprimer le pack sonore",
      stopPreview: "Arreter l'apercu",
      loading: "Chargement des packs sonores...",
      pendingSaveSuffix: " (en attente d'enregistrement)",
      defaultSuffix: " (par defaut)",
      customSuffix: " (personnalise)",
      noBundledSound: "Aucun son integre",
      enableSoundAria: (label: string) => `Activer ${label}`,
      volumeAria: (label: string) => `Volume de ${label}`,
      play: "Lire",
      playing: "Lecture...",
      volume: "Niveau sonore",
      remove: "Supprimer",
      replace: "Remplacer",
      soundFile: "Fichier audio",
      reset: "Reinitialiser",
      attribution: "Credits",
      attributionAria: (label: string) => `Attribution pour ${label}`,
      attributionPlaceholder: "Source, auteur ou details de licence",
      addVariation: "+ Ajouter une variation",
    },
    dialogs: {
      pauseMenu: {
        saveBeforeQuit: "Voulez-vous sauvegarder avant de quitter ?",
        title: "Jeu en pause",
        resume: "Reprendre",
        options: "Parametres",
        saveGame: "Sauvegarder la partie",
        exitToMainMenu: "Retourner au menu principal",
        quitGame: "Quitter le jeu",
      },
      debugLogs: {
        closeLabel: "Fermer les journaux de debug",
        title: "Journaux de debug enregistres",
        hint: "Les journaux ne sont captures qu'apres activation du commutateur cache des journaux de debug.",
        showingEntries: (count: number, startedAt: string) =>
          `Affichage de ${count} entrees depuis ${startedAt}.`,
        noneSaved: "Aucun journal de debug enregistre pour le moment.",
        refresh: "Actualiser",
        clearLogs: "Effacer les journaux",
      },
      startupUpdate: {
        maintenanceNotice:
          "Aucune version GitHub plus recente n'a ete trouvee.",
        summaryAvailable:
          "Une nouvelle version du jeu est disponible. Voulez-vous la mettre a jour ?",
        summaryNone: "Vous avez deja la version la plus recente du jeu.",
        currentVersion: (version: string) => `Version actuelle : ${version}`,
        latestVersion: (version: string) =>
          `Derniere version GitHub : ${version}`,
        disableAtStartup:
          "Ne plus afficher ces notifications au demarrage.",
        disabledNotice:
          "Les notifications de version au demarrage sont maintenant desactivees. Vous pouvez les reactiver dans les options.",
        clientUpgradeRequired:
          "Une mise a niveau complete du client est egalement requise pour beneficier des dernieres ameliorations de la plateforme.",
        progressTitle: "Etat du telechargement de la mise a jour",
        canceling: "Annulation du telechargement de la mise a jour...",
        noActiveTransfer: "Aucun transfert de fichier actif.",
        waitingForUpdater:
          "En attente d'activite du programme de mise a jour.",
        pendingUpdates: "Mises a jour en attente",
        payloadAvailable: "Le contenu de mise a jour est disponible.",
        downloadUpdates: "Telecharger les mises a jour",
        hideDetails: "Masquer les details",
        moreDetails: "Plus de details",
        cancelDownload: "Annuler le telechargement",
      },
      startup: {
        chooseVariant: "Choisissez votre variante de NetHack :",
        options: "Options de NetHack 3D",
        quitGame: "Quitter le jeu",
        chooseSetup: "Choisissez la configuration de votre personnage :",
        randomCharacter: "Personnage aleatoire",
        createCharacter: "Creer un personnage",
        loadGame: "Charger une partie",
        selectSavedGame: "Selectionnez une partie sauvegardee :",
        enterRandomName: "Entrez un nom pour votre personnage aleatoire :",
        createCharacterPrompt: "Creez votre personnage :",
        name: "Nom",
        role: "Profession",
        race: "Espece",
        gender: "Genre",
        alignment: "Alignement",
        startGame: "Commencer la partie",
      },
      clientOptions: {
        closeLabel: "Fermer les options de NetHack 3D",
        title: "Options client de NetHack 3D",
        categoriesLabel: "Categories de parametres",
        updates: {
          checkOnLaunchLabel:
            "Afficher les notifications de version GitHub au lancement",
          checkOnLaunchDescription:
            "Verifie les versions GitHub au demarrage et vous avertit lorsqu'une version plus recente existe.",
          title: "Versions GitHub",
          description:
            "Compare cette build avec les versions publiees sur GitHub.",
          idle:
            "Appuyez sur Verifier les mises a jour pour comparer cette build aux versions GitHub.",
          button: "Verifier les mises a jour",
          openGitHubReleases: "Ouvrir les versions GitHub",
        },
        buttons: {
          manageTileSets: "Gerer les jeux de tuiles",
          remapController: "Reconfigurer la manette",
          resetControllerDefaults: "Reinitialiser la manette par defaut",
        },
        hints: {
          darkWallsAlwaysEnabled:
            " Toujours active lorsque les tuiles Vulture sont utilisees.",
          darkWallsDisabledByVulture:
            " Desactivee lorsque les tuiles Vulture sont utilisees.",
          enableDarkWallsFirst:
            " Activez d'abord les murs de couloir sombres legacy ou les remplacements de murs sombres NetHack 5.0.",
          enableFpsFirst: " Activez d'abord le mode a la premiere personne dans Affichage.",
        },
        darkWallControls: {
          normal: "Mode normal",
          fps: "Mode FPS",
          normalAria: "Couleur unie des murs sombres (mode normal)",
          fpsAria: "Couleur unie des murs sombres (mode FPS)",
          gridLines: "Lignes de grille",
          intensity: "Intensite",
        },
        controllerRemap: {
          title: "Reconfiguration de la manette",
          closeLabel: "Fermer la reconfiguration de la manette",
          hint: "Selectionnez un emplacement, puis appuyez sur un bouton ou bougez un stick. Chaque action possede deux emplacements.",
          listeningFor: (label: string, slot: number) =>
            `En attente d'une entree pour ${label} (emplacement ${slot}). Appuyez sur ESC pour annuler.`,
        },
        resetPrompt:
          "Reinitialiser les options de NetHack 3D aux valeurs par defaut ? Les jeux de tuiles personnalises seront conserves.",
      },
      tilesetManager: {
        closeLabel: "Fermer le gestionnaire de jeux de tuiles",
        title: "Gerer les jeux de tuiles",
        description:
          "Ajoutez des jeux de tuiles et modifiez les reglages de fond/chroma pour chaque jeu.",
        createTitle: "Creer un nouveau jeu de tuiles",
        editTitle: "Modifier le jeu de tuiles",
        editTitleWithName: (label: string) => `Modifier le jeu de tuiles : ${label}`,
        tileSetName: "Nom du jeu de tuiles",
        tileSetPlaceholder: "Mon jeu de tuiles",
        builtInNamesLocked: "Les noms des jeux de tuiles integres ne peuvent pas etre modifies.",
        tileLayoutVersion: "Version de disposition des tuiles",
        layout367: "Disposition NetHack 3.6.7",
        layout5: "Disposition NetHack 5.0",
        tileLayoutDescription:
          "Choisissez la disposition d'indices de tuiles utilisee par cet atlas importe.",
        tileImage: "Image du jeu de tuiles",
        tileImageOptional: "Image du jeu de tuiles (remplacement facultatif)",
        selectedFile: (fileName: string) => `Selected: ${fileName}`,
        currentFile: (fileName: string) => `Current: ${fileName}`,
        uploadedImage: "image importee",
        weaponSpriteFlip: "Retourner le sprite de l'arme FPS",
        weaponSpriteFlipDescription:
          "Inverse horizontalement le sprite de l'arme tenue pour ce jeu de tuiles. Active par defaut.",
        backgroundRemovalDescription:
          "Configurez la suppression d'arriere-plan des panneaux pour ce jeu de tuiles, ou laissez les deux modes desactives pour conserver les fonds de l'atlas.",
        backgroundTileRemoval: "Suppression de la tuile de fond",
        backgroundTileRemovalDescription:
          "Utilise une tuile d'atlas selectionnee pour supprimer l'arriere-plan des panneaux.",
        solidChromaKey: "Chroma key couleur unie",
        solidChromaKeyDescription:
          "Utilise une seule couleur RGB unie pour supprimer l'arriere-plan des panneaux.",
        clickToPickFromAtlas: "cliquer pour choisir dans l'atlas",
        saveFirstThenEdit:
          "Enregistrez d'abord le nouveau jeu de tuiles, puis modifiez les reglages de fond/chroma.",
        createTileSet: "Creer le jeu de tuiles",
        saveTileSet: "Enregistrer le jeu de tuiles",
        saveTileSettings: "Enregistrer les reglages des tuiles",
        importNewTileSet: "+ Importer un nouveau jeu de tuiles",
        noUploadedTilesets: "Aucun jeu de tuiles importe disponible.",
        selectedSuffix: " (selectionne)",
        editingSuffix: " (edition)",
        uploadedDetails: (fileName: string, layout: string) =>
          `${fileName} | uploaded | layout ${layout}`,
        builtInDetails: (path: string) => `${path} | built-in`,
      },
      textInput: {
        cancelLabel: "Annuler la saisie de texte",
        placeholder: "Entrer du texte",
        ok: "Valider",
      },
      question: {
        cancelPrompt: "Annuler l'invite",
        selectAll: "Tout selectionner",
        deselectAll: "Tout deselectionner",
        page: (current: number, total: number) => `Page ${current} / ${total}`,
        amount: "Amount",
        amountDefault: "Default",
        clearAmount: "Clear amount",
        decreaseAmount: "Decrease amount by one",
        increaseAmount: "Increase amount by one",
        pageHintMultiple:
          "Utilisez < et > pour changer de page. Appuyez sur ESC pour annuler",
        pageHintSingle: "Appuyez sur ESC pour annuler",
        choices: {
          leftRingFinger: "Annulaire gauche",
          rightRingFinger: "Annulaire droit",
          here: "Ici",
          onGround: "Au sol",
          eligibleItems: "Objets valides",
          allInventory: "Tout l'inventaire",
        },
      },
      runtimeStartError: {
        closeLabel: "Retour au menu principal",
        title: "Echec de l'initialisation de NetHack.",
        returnToMainMenu: "Retourner au menu principal",
      },
      newGamePrompt: {
        closeLabel: "Fermer l'invite de nouvelle partie",
        title: "Retourner au menu principal ?",
        reasonFallback: "Partie terminee",
      },
      direction: {
        cancelLabel: "Annuler l'invite de direction",
      },
      info: {
        closeCharacter: "Fermer la fenetre du personnage",
        closeInformation: "Fermer la fenetre d'information",
        characterTitle: "Personnage",
        experienceProgress: "Progression de l'experience",
        levelLabel: (level: number) => `Level ${level}`,
        xpAtMaxLevel: (xp: string) => `XP ${xp} (max level reached)`,
        xpToNextLevel: (xp: string, next: string, remaining: string) =>
          `XP ${xp} / ${next} • ${remaining} to next level`,
        vitals: "Signes vitaux",
        characteristics: "Caracteristiques",
        currentLimit: "Actuel / Limite",
        armorClass: "Classe d'armure",
        currentStatus: "Etat actuel",
        noActiveStatus: "Aucun etat actif.",
        currentAttributes: "Attributs actuels",
        noTemporaryAttributes: "Aucun effet temporaire sur les attributs.",
        characterActions: "Actions du personnage",
        inventory: "Inventaire",
        inventoryDetail: "Ouvrir les objets transportes",
        closeHint:
          "Appuyez sur ESPACE, ENTREE ou ESC pour fermer. Appuyez sur Ctrl+M pour rouvrir.",
        infoTitleFallback: "Informations NetHack",
        noDetails: "(Aucun detail)",
      },
      inventory: {
        closeLabel: "Fermer l'inventaire",
        title: "INVENTAIRE",
        empty: "Votre inventaire est vide.",
        unknownItem: "Objet inconnu",
        closeHint: "Appuyez sur ENTREE, ESC ou 'i' pour fermer.",
        closeHintWithContext:
          "Selectionnez un objet pour ouvrir les commandes contextuelles. Appuyez sur ENTREE, ESC ou 'i' pour fermer",
      },
      inventoryDropMenu: {
        title: "Lacher",
        dropType: "Type de depot",
        dropAmount: "Quantite a lacher",
        dropSpecificAmount: "Lacher une quantite precise",
        onlyStackedItems: "Disponible uniquement pour les objets empiles",
      },
      inventoryDropCount: {
        title: "Combien lacher de cette pile ?",
        chooseAmount: (max: number) => `Choose an amount from 1 to ${max}.`,
        ariaLabel: "Quantite a lacher",
        setMinimum: "Definir la quantite de depot au minimum",
        decrease: "Reduire la quantite de depot d'une unite",
        increase: "Augmenter la quantite de depot d'une unite",
        setMaximum: "Definir la quantite de depot au maximum",
      },
      mobileActions: {
        extendedCommands: "Commandes etendues",
        commonCommands: "Commandes courantes",
        allCommands: "Toutes les commandes",
        actions: "Actions rapides",
        menu: "Menu principal",
        close: "Fermer",
        wizardCommands: "Commandes assistant",
        wizard: "Assistant",
        wizardCommandFallbackDescription:
          "Execute cette commande de debogage reservee au mode wizard.",
        wizardCommandDetails: {
          levelchange: { name: "Changer le niveau", description: "Definit le niveau d'experience du heros." },
          lightsources: { name: "Sources de lumiere", description: "Affiche les sources de lumiere mobiles." },
          migratemons: { name: "Monstres migrateurs", description: "Affiche les monstres qui changent de niveau." },
          panic: { name: "Test de panique", description: "Teste la panique et termine cette partie." },
          polyself: { name: "Polymorphie", description: "Change la forme actuelle du heros." },
          seenv: { name: "Vecteurs vus", description: "Affiche la carte de debogage des vecteurs vus." },
          stats: { name: "Statistiques memoire", description: "Affiche les statistiques memoire d'execution." },
          timeout: { name: "File des delais", description: "Affiche effets temporises et intrinseques." },
          vanquished: { name: "Monstres vaincus", description: "Affiche le compte des monstres morts." },
          vision: { name: "Tableau de vision", description: "Affiche le tableau de vision actuel." },
          wizbury: { name: "Enterrer objets proches", description: "Enterre les objets au sol dans une zone 3x3." },
          wizdetect: { name: "Detecter le cache", description: "Revele les choses cachees pres du heros." },
          wizgenesis: { name: "Creer monstre", description: "Cree un monstre par nom ou classe." },
          wizidentify: { name: "Identifier inventaire", description: "Identifie tous les objets de l'inventaire." },
          wizintrinsic: { name: "Regler intrinseques", description: "Ajuste les intrinseques temporises choisis." },
          wizlevelport: { name: "Teleport de niveau", description: "Teleporte vers un autre niveau ou branche." },
          wizmakemap: { name: "Recreer le niveau", description: "Genere a nouveau le niveau actuel." },
          wizmap: { name: "Cartographier", description: "Revele la carte du niveau et les pieges." },
          wizrumorcheck: { name: "Verifier rumeurs", description: "Valide les fichiers de vraies et fausses rumeurs." },
          wizsmell: { name: "Sentir monstre", description: "Sent un monstre selectionne." },
          wizwhere: { name: "Niveaux speciaux", description: "Affiche l'emplacement des niveaux speciaux." },
          wizwish: { name: "Souhait", description: "Cree objet, piege ou terrain." },
          wmode: { name: "Modes des murs", description: "Affiche les donnees debug des murs." },
        },
        repeat: "Repeter",
        character: "Personnage",
        inventory: "Inventaire",
        log: "Journal",
        pickUp: "Ramasser",
        search: "Chercher",
        closeMessageLog: "Fermer le journal des messages",
      },
      positionPrompt: {
        closeLabel: "Fermer l'invite de position",
        desktopHint:
          "Utilisez les commandes de déplacement ou cliquez sur une case pour déplacer la sélection. Cliquez de nouveau sur la case sélectionnée ou appuyez sur Entrée pour confirmer.",
        mobileHint:
          "Utilisez les commandes de déplacement ou touchez une case pour déplacer la sélection. Touchez de nouveau la case sélectionnée ou appuyez sur Entrée pour confirmer.",
        controllerHint:
          "Utilisez les commandes de déplacement pour déplacer la sélection. Appuyez sur Entrée ou Confirmer pour confirmer.",
      },
      controllerSupport: {
        prompt: "Manette detectee. Activer la prise en charge de la manette ?",
      },
    },
  },
} as const;

export type TranslationDictionary = typeof fr;
