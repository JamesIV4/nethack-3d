import { mergeTranslations, type LocaleOverrides } from "../locale-helpers";
import { en, type TranslationDictionary } from "./en";

export const deOverrides: LocaleOverrides<TranslationDictionary> = {
  meta: {
    locale: "de-DE",
  },
  common: {
    appName: "NetHack 3D",
    confirm: "Best\u00e4tigen",
    cancel: "Abbrechen",
    close: "Schlie\u00dfen",
    back: "Zur\u00fcck",
    yes: "Ja",
    no: "Nein",
    delete: "L\u00f6schen",
    edit: "Bearbeiten",
    done: "Fertig",
    resetToDefaults: "Auf Standard zur\u00fccksetzen",
    later: "Sp\u00e4ter",
    checking: "Wird gepr\u00fcft...",
    downloading: "Wird heruntergeladen...",
    canceling: "Wird abgebrochen...",
    none: "Keine",
    off: "Aus",
    normal: "Normal",
    fps: "FPS",
  },
  controller: {
    groups: {
      movement: "Bewegung",
      lookAndCamera: "Blick und Kamera",
      actions: "Aktionen",
      dialogs: "Dialoge",
      system: "System",
    },
    actions: {
      dpad_up: {
        label: "Steuerkreuz hoch",
        description:
          "Navigiert in Dialogen und in der Bewegungsmarkierung nach oben.",
      },
      dpad_down: {
        label: "Steuerkreuz runter",
        description:
          "Navigiert in Dialogen und in der Bewegungsmarkierung nach unten.",
      },
      dpad_left: {
        label: "Steuerkreuz links",
        description:
          "Navigiert in Dialogen und in der Bewegungsmarkierung nach links.",
      },
      dpad_right: {
        label: "Steuerkreuz rechts",
        description:
          "Navigiert in Dialogen und in der Bewegungsmarkierung nach rechts.",
      },
      left_stick_up: {
        label: "Linker Stick hoch",
        description: "Bewegungsmarkierung und virtueller Cursor nach oben.",
      },
      left_stick_down: {
        label: "Linker Stick runter",
        description: "Bewegungsmarkierung und virtueller Cursor nach unten.",
      },
      left_stick_left: {
        label: "Linker Stick links",
        description: "Bewegungsmarkierung und virtueller Cursor nach links.",
      },
      left_stick_right: {
        label: "Linker Stick rechts",
        description: "Bewegungsmarkierung und virtueller Cursor nach rechts.",
      },
      right_stick_up: {
        label: "Rechter Stick hoch",
        description: "Blick, Kameraschwenk und Dialogscrollen nach oben.",
      },
      right_stick_down: {
        label: "Rechter Stick runter",
        description: "Blick, Kameraschwenk und Dialogscrollen nach unten.",
      },
      right_stick_left: {
        label: "Rechter Stick links",
        description: "Blick und Kameraschwenk nach links.",
      },
      right_stick_right: {
        label: "Rechter Stick rechts",
        description: "Blick und Kameraschwenk nach rechts.",
      },
      confirm: {
        label: "Best\u00e4tigen / Klicken",
        description: "Best\u00e4tigt Bewegung und Klicks in Dialogen.",
      },
      search: {
        label: "Suchen",
        description:
          "Durchsucht das aktuelle Feld, wenn keine Bewegungsvorschau aktiv ist.",
      },
      cancel_or_context: {
        label: "Abbrechen / Kontext",
        description: "Kontextaktionen \u00f6ffnen oder aktuellen Dialog abbrechen.",
      },
      action_menu: {
        label: "Aktionsmen\u00fc",
        description: "Das radiale Aktionsmen\u00fc des Controllers \u00f6ffnen.",
      },
      run_modifier: {
        label: "Lauf-Modifikator",
        description:
          "Gedr\u00fcckt halten, um vor der Bewegung den Laufpr\u00e4fix zu senden.",
      },
      zoom_in: {
        label: "Zoom (halten)",
        description:
          "Gedr\u00fcckt halten, dann mit dem linken Stick hoch/runter zoomen und mit dem rechten Stick die Kamera drehen.",
      },
      recenter_camera: {
        label: "Kamera zentrieren",
        description: "Setzt die Kamera auf die Spielerposition zur\u00fcck.",
      },
      toggle_large_minimap: {
        label: "Gro\u00dfe Minikarte umschalten",
        description: "Schaltet auf eine sehr gro\u00dfe Minikartenansicht um.",
      },
      pause_menu: {
        label: "Pausenmen\u00fc",
        description: "\u00d6ffnet oder schlie\u00dft das Pausenmen\u00fc.",
      },
      open_inventory: {
        label: "Inventar",
        description: "\u00d6ffnet das Inventarfenster.",
      },
      open_character: {
        label: "Charakterbogen",
        description: "\u00d6ffnet das Charakterfenster.",
      },
    },
    buttonLabels: {
      0: "A",
      1: "B",
      2: "X",
      3: "Y",
      4: "Linke Schultertaste",
      5: "Rechte Schultertaste",
      6: "Linker Trigger",
      7: "Rechter Trigger",
      8: "Zur\u00fcck / Ansicht",
      9: "Start / Men\u00fc",
      10: "Linken Stick dr\u00fccken",
      11: "Rechten Stick dr\u00fccken",
      12: "Steuerkreuz hoch",
      13: "Steuerkreuz runter",
      14: "Steuerkreuz links",
      15: "Steuerkreuz rechts",
      16: "Home",
    },
    axisLabels: {
      0: "Linker Stick X",
      1: "Linker Stick Y",
      2: "Rechter Stick X",
      3: "Rechter Stick Y",
    },
    directions: {
      leftStickLeft: "Linker Stick links",
      leftStickRight: "Linker Stick rechts",
      leftStickUp: "Linker Stick hoch",
      leftStickDown: "Linker Stick runter",
      rightStickLeft: "Rechter Stick links",
      rightStickRight: "Rechter Stick rechts",
      rightStickUp: "Rechter Stick hoch",
      rightStickDown: "Rechter Stick runter",
    },
    unbound: "Nicht belegt",
    axisFallback: (axisIndex: number) => `Achse ${axisIndex}`,
    buttonFallback: (buttonIndex: number) => `Taste ${buttonIndex}`,
    slotLabel: (slotIndex: number) => `Slot ${slotIndex + 1}`,
    listening: "Eingabe dr\u00fccken...",
    clear: "L\u00f6schen",
    controllerDetected: (count: number) => `${count} Controller erkannt.`,
    noControllerDetected: "Kein Controller erkannt.",
  },
  startupInitOptions: {
    accordion: {
      summary: "Initialisierungsoptionen (optional)",
      description:
        "Zus\u00e4tzliche NetHack-`OPTIONS`-Eintr\u00e4ge, die beim Start angewendet werden. Fensterport- und plattformspezifische Optionen werden absichtlich ausgelassen.",
      resetToDefaults: "Auf Standard zur\u00fccksetzen",
    },
    options: {
      playmode: {
        label: "Spielmodus",
        description:
          "W\u00e4hle den Startmodus. Der Zauberer-Modus ist der NetHack-Debugmodus (`playmode:debug`).",
        options: {
          normal: "Normal",
          explore: "Erkunden",
          debug: "Zauberer/Debug",
        },
      },
      number_pad: {
        label: "Bewegungstasten",
        description:
          "W\u00e4hle, ob NetHack die numerische Tastatur (`number_pad:1`) oder klassische vi-Tasten (`number_pad:0`) f\u00fcr Bewegung verwendet.",
        options: {
          numeric: "Numerischer Block",
          vi: "vi-Tasten",
        },
      },
      autopickup: {
        label: "Automatisches Aufheben",
        description:
          "Hebt automatisch die in den Aufhebetypen ausgew\u00e4hlten Objektklassen auf.",
      },
      pickup_types: {
        label: "Aufhebetypen",
        description:
          'Objektklassensymbole f\u00fcr automatisches Aufheben (Beispiel: $"=/!?+). Leer lassen f\u00fcr den Spielstandard.',
        placeholder: '$"=/!?+',
      },
      pickup_thrown: {
        label: "Geworfene Gegenst\u00e4nde aufheben",
        description:
          "Hebt geworfene Gegenst\u00e4nde automatisch auf, wenn sie landen.",
      },
      pickup_burden: {
        label: "Grenze f\u00fcr Aufhebe-Belastung",
        description:
          "Fragt vor dem Aufheben nach, wenn diese Belastungsstufe \u00fcberschritten w\u00fcrde.",
        options: {
          u: "Unbelastet (u)",
          b: "Belastet (b)",
          s: "Angestrengt (s)",
          n: "\u00dcberanstrengt (n)",
          t: "\u00dcberlastet (t)",
          l: "Voll \u00fcberladen (l)",
        },
      },
      pile_limit: {
        label: "Stapelgrenze",
        description:
          "Anzahl an Gegenst\u00e4nden, ab der f\u00fcr Bodenstapel eine Popup-Liste erscheint.",
      },
      autoquiver: {
        label: "Automatischer K\u00f6cher",
        description:
          "F\u00fcllt den K\u00f6cher automatisch oder macht beim Schie\u00dfen eine passende Waffe bereit.",
      },
      autoopen: {
        label: "Automatisch \u00f6ffnen",
        description:
          "Versucht automatisch, T\u00fcren zu \u00f6ffnen, wenn du in sie hineinl\u00e4ufst.",
      },
      autodig: {
        label: "Automatisch graben",
        description:
          "Gr\u00e4bt automatisch in W\u00e4nde, wenn dies m\u00f6glich ist und du dich in sie hineinbewegst.",
      },
      cmdassist: {
        label: "Befehlshilfe",
        description:
          "Zeigt zus\u00e4tzlichen Hilfetext an, wenn Befehle falsch eingegeben werden.",
      },
      confirm: {
        label: "Angriffe best\u00e4tigen",
        description: "Fragt nach, bevor friedliche Kreaturen angegriffen werden.",
      },
      safe_pet: {
        label: "Haustier sch\u00fctzen",
        description: "Fragt nach, bevor du dein Haustier triffst.",
      },
      help: {
        label: "Hilfe im Spiel",
        description:
          "Bietet zus\u00e4tzliche Blick-/Hilfedetails an, wenn mehr Informationen verf\u00fcgbar sind.",
      },
      legacy: {
        label: "Legacy-Intro",
        description: "Zeigt die Story-Einf\u00fchrung zu Beginn eines neuen Spiels.",
      },
      rest_on_space: {
        label: "Mit Leertaste rasten",
        description: "Behandelt die Leertaste als Warten/Rasten.",
      },
      pushweapon: {
        label: "Waffe wegschieben",
        description:
          "Verschiebt die aktuell gef\u00fchrte Waffe in die Nebenhand, wenn gewechselt wird.",
      },
      extmenu: {
        label: "Erweitertes Befehlsmen\u00fc",
        description: "Verwendet ein Men\u00fc-Popup f\u00fcr erweiterte Befehle.",
      },
      fixinv: {
        label: "Inventarbuchstaben fixieren",
        description:
          "Versucht, Inventarbuchstaben beizubehalten, wenn Gegenst\u00e4nde verschoben werden.",
      },
      implicit_uncursed: {
        label: "Unverflucht anzeigen",
        description:
          "Zeigt in Inventarbeschreibungen immer das Wort 'unverflucht' an.",
      },
      mention_walls: {
        label: "W\u00e4nde erw\u00e4hnen",
        description: "Zeigt eine Meldung an, wenn du gegen eine Wand l\u00e4ufst.",
      },
      sortloot: {
        label: "Beutelisten sortieren",
        description:
          "Sortierverhalten f\u00fcr Aufhebe- und Inventarauswahllisten.",
        options: {
          f: "Vollst\u00e4ndig",
          l: "Nur Beute",
          n: "Keine",
        },
      },
      sortpack: {
        label: "Inventar sortieren",
        description:
          "Sortiert den Rucksackinhalt nach Typ, wenn das Inventar angezeigt wird.",
      },
      msghistory: {
        label: "Gr\u00f6\u00dfe des Nachrichtenverlaufs",
        description:
          "Anzahl der Kopfzeilen-Nachrichten, die zum Wiederaufruf gespeichert werden.",
      },
      dogname: {
        label: "Hundename",
        description: "Standardname f\u00fcr deinen ersten Hund.",
        placeholder: "Fido",
      },
      catname: {
        label: "Katzenname",
        description: "Standardname f\u00fcr deine erste Katze.",
        placeholder: "Morris",
      },
      horsename: {
        label: "Pferdename",
        description: "Standardname f\u00fcr dein erstes Pferd.",
        placeholder: "Silver",
      },
      pettype: {
        label: "Bevorzugtes Haustier",
        description:
          "Bevorzugter anf\u00e4nglicher Haustiertyp f\u00fcr Rollen mit Auswahl.",
        options: {
          default: "Spielstandard",
          cat: "Katze",
          dog: "Hund",
          horse: "Pferd",
          none: "Keine",
        },
      },
      fruit: {
        label: "Bevorzugte Frucht",
        description: "Name der Fruchtsorte, die dein Charakter bevorzugt.",
        placeholder: "Schleimpilz",
      },
      packorder: {
        label: "Rucksackreihenfolge",
        description:
          "Reihenfolge der im Inventar angezeigten Gegenstandsklassen.",
        placeholder: '")[%?+/=!(*0_`',
      },
      paranoid_confirmation: {
        label: "Paranoide Best\u00e4tigung",
        description:
          "Leerzeichengetrennte zus\u00e4tzliche Best\u00e4tigungen (Beispiel: confirm quit attack pray).",
        placeholder: "confirm quit attack pray",
      },
      sparkle: {
        label: "Magieresistenz-Funkeln",
        description:
          "Zeigt besondere Funkeleffekte f\u00fcr Magieresistenz an.",
      },
      standout: {
        label: "Hervorgehobene Monster/More",
        description: "Stellt Monster und --More-- fett dar.",
      },
      tombstone: {
        label: "Grabstein",
        description: "Zeigt beim Tod eine Grabstein-Grafik an.",
      },
      verbose: {
        label: "Ausf\u00fchrliche Meldungen",
        description:
          "Verwendet ausf\u00fchrlichere Formulierungen f\u00fcr Status- und Aktionsmeldungen.",
      },
    },
  },
  soundEffects: {
    byKey: {
      "player-walk": "Spieler geht",
      hit: "Treffer",
      "monster-killed": "Monster get\u00f6tet (Spieler)",
      "monster-killed-other": "Monster get\u00f6tet (andere)",
      "missed-attack": "Angriff verfehlt",
      "door-opens": "T\u00fcr \u00f6ffnet sich",
      "door-closes": "T\u00fcr schlie\u00dft sich",
      "door-kick": "T\u00fcrtritt",
      "door-smash": "T\u00fcr zerschlagen",
      "door-resists": "T\u00fcr widersteht",
      "door-distant": "T\u00fcr in der Ferne",
      "walk-down-stairs": "Treppe hinuntergehen",
      "walk-up-stairs": "Treppe hinaufgehen",
      eating: "Essen",
      drink: "Trinken",
      "quaff-potion": "Einen Trank trinken",
      "pickup-gold": "Gold aufheben",
      "pickup-item": "Gegenstand aufheben",
      "find-hidden": "Versteckte T\u00fcr/Gang finden",
      "level-up": "Stufenaufstieg",
      unlock: "Aufschlie\u00dfen",
      "boulder-push": "Felsblock schieben",
      "boulder-blocked": "Felsblock blockiert",
      splash: "Platschen",
      searching: "Suchen",
      "magic-cast": "Magie wirken",
      "magic-heal": "Magische Heilung",
      "magic-buff": "Magische Verst\u00e4rkung",
    },
  },
  characterSheet: {
    titleFallback: "Charakterbogen",
    sectionTitles: {
      overview: "\u00dcberblick",
      background: "Hintergrund",
      basics: "Grundlagen",
      characteristics: "Aktuelle Eigenschaften",
      status: "Aktueller Status",
      attributes: "Aktuelle Attribute",
    },
    statLabels: {
      strength: "St\u00e4rke",
      dexterity: "Geschicklichkeit",
      constitution: "Konstitution",
      intelligence: "Intelligenz",
      wisdom: "Weisheit",
      charisma: "Charisma",
    },
    commands: {
      enhance: {
        label: "Verbessern",
        detail: "Fertigkeiten steigern",
      },
      conduct: {
        label: "Spielweise",
        detail: "Fortschritt der Herausforderung anzeigen",
      },
      overview: {
        label: "\u00dcberblick",
        detail: "Dungeon-Fortschritt anzeigen",
      },
      spells: {
        label: "Zauber",
        detail: "Bekannte Zauber pr\u00fcfen",
      },
      seespells: {
        label: "Zauberbuch",
        detail: "Zauberinventar auflisten",
      },
      technique: {
        label: "Technik",
        detail: "Rollen-/Rassenfahigkeiten einsetzen",
      },
      known: {
        label: "Entdeckungen",
        detail: "Liste bekannter Objekte",
      },
      pray: {
        label: "Beten",
        detail: "Ein Gebet versuchen",
      },
    },
  },
  castMenu: {
    schoolLabel: "Schule:",
    headings: {
      name: "Name",
      level: "Stufe",
      category: "Kategorie",
      fail: "Fehl",
      retention: "Erhalt",
    },
    summary: {
      known: (count: number) => `${count} bekannt`,
      castable: (count: number) => `${count} wirkbar`,
      bestSuccess: (percent: number) => `Beste Erfolgsquote ${percent}%`,
      averageFail: (percent: number) => `Durchschn. Fehlschlag ${percent}%`,
      schoolCount: (count: number) =>
        `${count} Schule${count === 1 ? "" : "n"}`,
    },
    retention: {
      unknown: "Unbekannt",
      gone: "Verloren",
      full: "100%",
    },
  },
  enhanceMenu: {
    defaultGroupTitle: "Fertigkeiten",
    availability: {
      available_now: "Verf\u00fcgbar",
      needs_experience: "EP/Slots",
      needs_practice: "\u00dcbung",
      maxed_out: "Maximal",
    },
    summary: {
      available: (count: number) => `${count} verf\u00fcgbar`,
      gated: (count: number) => `${count} durch Erfahrung/Slots gesperrt`,
      practice: (count: number) => `${count} ben\u00f6tigen \u00dcbung`,
      maxed: (count: number) => `${count} maximal`,
    },
    maxLabel: "Max",
    slotCount: (count: number) => `${count} Slot${count === 1 ? "" : "s"}`,
  },
  app: {
    unknownTime: "Unbekannte Zeit",
    debugSession: {
      possibleCrash: "m\u00f6glicher Absturz",
      active: "aktiv",
    },
    debugLogs: {
      buildLabelAria: (
        buildLabel: string,
        currentCount: number,
        requiredCount: number,
      ) =>
        `Build ${buildLabel}. Fortschritt des versteckten Debug-Log-Schalters: ${currentCount} von ${requiredCount}.`,
      enabledToast: "Debug-Protokoll aktiviert",
      enabledLogEntry:
        "Debug-Protokoll \u00fcber das Easter Egg des Build-Labels beim Start aktiviert.",
      openLink: "Debug-Protokolle ansehen",
      clearedLogEntry:
        "Gespeicherte Debug-Protokolle wurden vom Benutzer gel\u00f6scht.",
    },
    statusEffects: {
      turningToStone: "Versteinert",
      slimed: "Verschleimt",
      strangled: "Gew\u00fcrgt",
      foodPoisoning: "Lebensmittelvergiftung",
      terminallyIll: "Todkrank",
      blind: "Blind",
      deaf: "Taub",
      stunned: "Benommen",
      confused: "Verwirrt",
      hallucinating: "Halluzinierend",
      levitating: "Schwebend",
      flying: "Fliegend",
      riding: "Reitend",
      barehanded: "Unbewaffnet",
      busy: "Besch\u00e4ftigt",
      iron: "Eisern",
      glowingHands: "Gl\u00fchende H\u00e4nde",
      grabbed: "Gepackt",
      held: "Festgehalten",
      icy: "Eisig",
      inLava: "In Lava",
      paralyzed: "Gel\u00e4hmt",
      sleeping: "Schlafend",
      slippery: "Rutschig",
      submerged: "Untergetaucht",
      tethered: "Festgebunden",
      trapped: "Gefangen",
      unconscious: "Bewusstlos",
      woundedLegs: "Verletzte Beine",
      holding: "Haltend",
    },
    characterStats: {
      descriptions: {
        strength:
          "Beeinflusst Nahkampfschaden, Traglast und kr\u00e4ftezehrende Aktionen.",
        dexterity:
          "Beeinflusst Trefferchance, Falleninteraktion und defensive Beweglichkeit.",
        constitution:
          "Beeinflusst HP-Wachstum und Widerstand gegen Gift- und Entzugseffekte.",
        intelligence:
          "Beeinflusst Lesen und den Erfolg vieler zauberbezogener Aktionen.",
        wisdom:
          "Beeinflusst das Wachstum magischer Energie und die Zuverl\u00e4ssigkeit beim Zaubern.",
        charisma:
          "Beeinflusst Ladeninteraktionen, den Umgang mit Haustieren und soziale Ergebnisse.",
      },
      armorClassDescription:
        "Niedriger ist besser. Die R\u00fcstungsklasse verringert die Trefferchance von Gegnern gegen dich.",
    },
    directionHelp: {
      controller:
        "Klicke auf eine Richtung oder nutze linken Stick/Steuerkreuz f\u00fcr die Vorschau und lass los zum Best\u00e4tigen. Der mittlere Kreis w\u00e4hlt dich selbst. Nutze < oder > f\u00fcr Treppen. ESC zum Abbrechen.",
      numpad:
        "Klicke auf eine Richtung. Der mittlere Kreis w\u00e4hlt dich selbst. Du kannst auch den Ziffernblock (1-4,6-9), Pfeiltasten, <, > oder s verwenden. ESC zum Abbrechen.",
      viKeys:
        "Klicke auf eine Richtung. Der mittlere Kreis w\u00e4hlt dich selbst. Du kannst auch hjkl/yubn, Pfeiltasten, <, > oder s verwenden. ESC zum Abbrechen.",
      fps: "Zum Zielen schauen. Linksklick oder W best\u00e4tigt. S w\u00e4hlt dich selbst. A/D oder Rechtsklick bricht ab.",
    },
    inventoryContextActions: {
      apply: "Benutzen",
      invoke: "Anrufen",
      tip: "Tipp",
      loot: "Pl\u00fcndern",
      drop: "Ablegen",
      eat: "Essen",
      quaff: "Trinken",
      read: "Lesen",
      rub: "Reiben",
      throw: "Werfen",
      wield: "F\u00fchren",
      quiver: "In den K\u00f6cher",
      wear: "Anlegen",
      takeOff: "Ablegen",
      putOn: "Anziehen",
      remove: "Entfernen",
      zap: "Zappen",
      untrap: "Entsch\u00e4rfen",
      offer: "Opfern",
      name: "Benennen",
      call: "Bezeichnen",
      adjust: "Neu ordnen",
      engrave: "Einritzen",
      dip: "Eintauchen",
      info: "Info",
      unwield: "Nicht mehr f\u00fchren",
    },
    mobileActions: {
      wait: "Warten",
      zap: "Zappen",
      cast: "Wirken",
      kick: "Treten",
      read: "Lesen",
      quaff: "Trinken",
      eat: "Essen",
      glance: "Blicken",
      loot: "Pl\u00fcndern",
      open: "\u00d6ffnen",
      wield: "F\u00fchren",
      wear: "Anlegen",
      putOn: "Anziehen",
      takeOff: "Ablegen",
      extended: "Erweitert",
    },
    clientOptions: {
      config: {
        groupControls: "Controller und Ego-Perspektive",
        sectionControlsController: "Controller",
        controllerEnabled: {
          label: "Controller-Unterst\u00fctzung aktivieren",
          description:
            "Aktiviert Gamepad-Eingaben f\u00fcr Gameplay und UI-Dialoge.",
        },
        sectionControlsLook: "Blick und Kamera",
        invertLookYAxis: {
          label: "Y-Achse f\u00fcr Blick umkehren",
          description:
            "Kehrt die vertikale Maus- und Touch-Blickrichtung um.",
        },
        fpsLookSensitivityX: {
          label: "FPS-Blickempfindlichkeit X",
          description: "Horizontale Maus-/Touch-Blickempfindlichkeit.",
        },
        fpsLookSensitivityY: {
          label: "FPS-Blickempfindlichkeit Y",
          description: "Vertikale Maus-/Touch-Blickempfindlichkeit.",
        },
        snapCameraYawToNearest45: {
          label: "Kamera-Yaw auf 45 Grad einrasten",
          description:
            "Wenn die Kameradrehung losgelassen wird, rastet der Yaw weich auf den n\u00e4chsten 45-Grad-Winkel ein.",
        },
        sectionControlsMovement: "Bewegungsverhalten",
        cameraRelativeMovement: {
          label: "Kamerarelative Bewegung und Wischgesten",
          description:
            "Dreht Bewegungstasten und Wischrichtungen entsprechend dem Y-Achsen-Winkel der Kamera.",
        },
        fpsWasdKeyboardMovementEnabled: {
          label: "WASD-Tastaturbewegung im FPS-Modus aktivieren",
          description:
            "Verwendet W/A/S/D f\u00fcr Bewegung in der Ego-Perspektive. Deaktivieren, damit diese Tasten wie normale NetHack-Befehle funktionieren.",
        },
        controllerFpsMoveRepeatMs: {
          label: "FPS-Bewegungswiederholung linker Stick",
          description:
            "Wiederholungsverz\u00f6gerung f\u00fcr Bewegung mit dem linken Stick im FPS-Modus (niedriger ist schneller).",
        },
        groupInterface: "Oberfl\u00e4che",
        locale: {
          label: "Sprache",
          description:
            "W\u00e4hlt die Sprache der Benutzeroberfl\u00e4che. Standardm\u00e4\u00dfig wird deine Browser-Region verwendet, falls unterst\u00fctzt, sonst Englisch.",
          options: {
            en: "Englisch",
          },
        },
        sectionDisplayCamera: "Kamera und Perspektive",
        fpsMode: {
          label: "Ego-Perspektive",
          description: "Verwendet Ego-Steuerung und freie Mausansicht.",
        },
        fpsFlattenEntityBillboards: {
          label: "\u00dcberlappende Tile-Sprites abflachen",
          description:
            "Flacht Tile-Sprites f\u00fcr Beute oder Dungeon-Elemente ab, wenn Monster, Haustiere oder der Spieler darauf stehen. Deaktivieren, um \u00fcberlappende Sprites als stehende Billboards zu behalten. Vulture-Tiles bleiben immer aufrecht.",
        },
        fpsHeldWeaponVisible: {
          label: "FPS-Waffe anzeigen",
          description: "Zeigt die gehaltene Waffensprite im Ego-Modus an.",
        },
        showItemsUnderPlayerInOverheadTilesMode: {
          label: "Gegenst\u00e4nde unter dem Spieler in Draufsicht zeigen",
          description:
            "Zeigt Gegenst\u00e4nde und Bodenelemente unter dem Spieler im Kachelmodus mit Runtime-Unterlay-Glyphdaten an.",
        },
        fpsFov: {
          label: "FPS-Sichtfeld",
          description: "Passt das Sichtfeld der Ego-Kamera an.",
        },
        sectionDisplayGraphics: "Grafik und Rendering",
        tilesetMode: {
          label: "Anzeige",
          description: "Verwendet grafische Kacheln statt ASCII.",
          options: {
            ascii: "ASCII",
            tiles: "Kacheln",
          },
        },
        tilesetPath: {
          label: "Tileset",
          description: "Integrierte und hochgeladene Tilesets.",
        },
        antialiasing: {
          label: "Kantengl\u00e4ttung",
          description: "Kantengl\u00e4ttungsmodus f\u00fcr 3D-Rendering.",
          options: {
            taa: "TAA",
            fxaa: "FXAA",
          },
        },
        lightingEnabled: {
          label: "Beleuchtung",
          description:
            "Aktiviert dynamische Szenenbeleuchtung und Abdunkelung des Dungeons. Deaktivieren f\u00fcr flacheres, stets beleuchtetes Rendering.",
        },
        blockAmbientOcclusion: {
          label: "Ambient Occlusion",
          description:
            "F\u00fcgt subtile Kontaktschatten zwischen Boden- und Wandbl\u00f6cken hinzu.",
        },
        brightness: {
          label: "Helligkeit",
          description: "Passt die Gesamthelligkeit der Szene an.",
        },
        contrast: {
          label: "Kontrast",
          description:
            "Passt den globalen Kontrast der gerenderten Szene an.",
        },
        gamma: {
          label: "Gammawert",
          description: "Passt das Anzeige-Gamma der gerenderten Szene an.",
        },
        sectionDisplayInterface: "Benutzeroberfl\u00e4che",
        uiFontScale: {
          label: "UI-Schriftgr\u00f6\u00dfe",
          description:
            "Skaliert alle UI-Schriftgr\u00f6\u00dfen ausgehend von ihren Standardwerten.",
        },
        disableAnimatedTransitions: {
          label: "Animierte \u00dcberg\u00e4nge deaktivieren",
          description:
            "Deaktiviert Ausblenden, Bewegung und \u00dcbergangsanimationen der Oberfl\u00e4che f\u00fcr direktere UI-\u00c4nderungen.",
        },
        uiTileBackgroundRemoval: {
          label: "Tile-Hintergr\u00fcnde in der UI entfernen",
          description:
            "Wendet Tile-/Chroma-Hintergrundentfernung auf Tile-Symbole in UI-Panels an.",
        },
        desktopTouchInterfaceMode: {
          label: "Desktop-Touchoberfl\u00e4che",
          description:
            "Zeigt Touch-Steuerung auf dem Desktop an und w\u00e4hlt Hoch- oder Querformat.",
          options: {
            off: "Aus",
            portrait: "Touch-UI im Hochformat verwenden",
            landscape: "Touch-UI im Querformat verwenden",
          },
        },
        sectionDisplayMessages: "Meldungen und Protokoll",
        desktopMessageLogWindowScale: {
          label: "Skalierung des Desktop-Nachrichtenfensters",
          description:
            "Skaliert die Gr\u00f6\u00dfe des eingerahmten Desktop-Nachrichtenfensters, ohne die Schriftgr\u00f6\u00dfe zu \u00e4ndern.",
        },
        liveMessageLog: {
          label: "Live-Nachrichtenprotokoll",
          description: "Zeigt das scrollende Nachrichtenprotokoll im Spiel an.",
        },
        showPersistentMobileMessageLog: {
          label: "Persistentes Nachrichtenprotokoll anzeigen",
          description:
            "H\u00e4lt das kompakte mobile Nachrichtenprotokoll w\u00e4hrend des Spiels sichtbar. Die Log-Schaltfl\u00e4che kann weiterhin das gr\u00f6\u00dfere Protokoll \u00f6ffnen.",
        },
        rumbleEnabled: {
          label: "Rumble aktivieren",
          description:
            "Verwendet kurzes haptisches Vibrationsfeedback fuer verursachten und erlittenen Schaden auf unterstuetzten Mobilgeraeten.",
        },
        sectionMobileSafeZone: "Mobile Sicherheitszonen",
        manualMobileBottomSafeZoneEnabled: {
          label: "Erkannte mobile Sicherheitszonen \u00fcberschreiben",
          description:
            "Verwendet manuelle Sicherheitszonen-Abst\u00e4nde, wenn Android-Handhelds sichere Bereiche falsch melden.",
        },
        manualMobileBottomSafeZoneVerticalPx: {
          label: "Untere Sicherheitszone im Hochformat",
          description:
            "Manuelle untere Sicherheitszone f\u00fcr das mobile Hochformat.",
        },
        manualMobileBottomSafeZoneHorizontalPx: {
          label: "Untere Sicherheitszone im Querformat",
          description:
            "Manuelle untere Sicherheitszone f\u00fcr das mobile Querformat.",
        },
        manualMobileRightSafeZoneHorizontalPx: {
          label: "Rechte Sicherheitszone im Querformat",
          description:
            "Manuelle rechte Sicherheitszone f\u00fcr das mobile Querformat.",
        },
        manualMobileBottomSafeZonePreview: "Untere Sicherheitszone",
        manualMobileRightSafeZonePreview: "Rechte Sicherheitszone",
        liveMessageDisplayTimeMs: {
          label: "Anzeigedauer f\u00fcr Live-Nachrichten",
          description:
            "Zeit, die eine schwebende Nachricht voll sichtbar bleibt, bevor sie ausblendet.",
        },
        liveMessageFadeOutTimeMs: {
          label: "Ausblenddauer f\u00fcr Live-Nachrichten",
          description:
            "Dauer der Ausblendanimation f\u00fcr schwebende Nachrichten.",
        },
        liveMessageLogFontScale: {
          label: "Schriftgr\u00f6\u00dfe des Live-Protokolls",
          description:
            "Skaliert die nach oben blendenden schwebenden Aktionsmeldungen ausgehend von ihrer Standardgr\u00f6\u00dfe.",
        },
        sectionDisplayMinimap: "Minikarte",
        minimap: {
          label: "Minikarte",
          description: "Zeigt die Dungeon-Minikarte an oder blendet sie aus.",
        },
        minimapScale: {
          label: "Skalierung der Minikarte",
          description:
            "Skaliert die Gr\u00f6\u00dfe der Minikarte ausgehend vom Standard.",
        },
        sectionDisplayInventory: "Inventardarstellung",
        reduceInventoryMotion: {
          label: "Inventarbewegung reduzieren",
          description:
            "Deaktiviert animierte Erweiterungen von Inventarzeilen und verwendet einfachere Interaktionen.",
        },
        inventoryTileOnlyMotion: {
          label: "Nur Inventarkacheln animieren",
          description:
            "Animiert Symbolkacheln, w\u00e4hrend H\u00f6he und Abstand der Inventarzeilen fest bleiben.",
        },
        inventoryFixedTileSize: {
          label: "Feste Inventarkachelgr\u00f6\u00dfe",
          description:
            "Gilt nur, wenn 'Inventarbewegung reduzieren' aktiviert ist. W\u00e4hle eine feste Symbolgr\u00f6\u00dfe.",
          options: {
            none: "Keine",
            small: "Klein",
            medium: "Mittel",
            large: "Gro\u00df",
          },
        },
        groupSound: "Audio",
        soundEnabled: {
          label: "Sound aktivieren",
          description:
            "Schaltet FMOD-Audio ein oder aus. Das Deaktivieren reduziert die Audioverarbeitung auf schw\u00e4cheren Ger\u00e4ten.",
        },
        groupMobileControls: "Mobile Steuerung",
        invertTouchPanningDirection: {
          label: "Schwenkrichtung umkehren",
          description: "Kehrt die Ziehrichtung fuer das Schwenken um, sobald Gedrueckthalten zum Schwenken aktiv ist.",
        },
        groupCombat: "Kampf-Feedback",
        damageNumbers: {
          label: "Schadenszahlen",
          description:
            "Zeigt schwebende Schadens- und Heilungszahlen an.",
        },
        displayStatChangesAbovePlayer: {
          label: "Status\u00e4nderungen \u00fcber dem Spieler anzeigen",
          description:
            "Zeigt schwebende Beschriftungen f\u00fcr Status\u00e4nderungen wie St\u00e4rke und RK an.",
        },
        displayXpGainsAbovePlayer: {
          label: "EP-Gewinne \u00fcber dem Spieler anzeigen",
          description:
            "Zeigt schwebende EP-Beschriftungen an, wenn Erfahrung steigt.",
        },
        tileShakeOnHit: {
          label: "Kachelersch\u00fctterung bei Treffern",
          description:
            "L\u00e4sst betroffene Kacheln bei Kampftreffern erzittern.",
        },
        blood: {
          label: "Blut",
          description: "Rendert blutigen Partikelnebel bei Treffern.",
        },
        bloodMist: {
          label: "Blutnebel",
          description:
            "Rendert schwebende Blutnebel-Partikel bei Treffern.",
        },
        bloodGround: {
          label: "Blutspritzer",
          description:
            "Rendert Blutspritzer auf den Bodenfliesen des Dungeons nach Treffern.",
        },
        bloodDetail: {
          options: {
            veryLow: "Sehr niedrig",
          },
        },
        monsterShatter: {
          label: "Monster zersplittern",
          description:
            "Teilt besiegte Monster-Billboards in physische Splitter auf.",
        },
        monsterShatterBloodBorders: {
          label: "Blutige Splitterr\u00e4nder",
          description:
            "F\u00e4rbt Splitterpixel nahe den Bruchlinien mit zuf\u00e4lligen blutroten Kanten ein.",
        },
        groupCompatibility: "Runtime-Kompatibilit\u00e4t",
        darkCorridorWalls367: {
          label: "Dunkle Korridorw\u00e4nde f\u00fcr Legacy-Runtimes",
          description:
            "Leitet Kacheln f\u00fcr dunkle Korridorw\u00e4nde ab und speichert sie f\u00fcr \u00e4ltere NetHack-3.4.3-/3.6.x-Laufzeiten, einschlie\u00dflich Slash'EM.",
        },
        overrideNh5DarkCorridorWallTiles: {
          label: "Dunkle Wandkacheln in NetHack 5.0 \u00fcberschreiben",
          description:
            "Wendet Einstellungen f\u00fcr dunkle W\u00e4nde auf dunkle Korridorwand-Kacheln in NetHack 5.0 an.",
        },
        darkCorridorWallTileOverrideEnabled: {
          label: "Dunkle Wandkachel \u00fcberschreiben",
          description:
            "Verwendet eine benutzerdefinierte Atlas-Kachel f\u00fcr dunkle W\u00e4nde, gespeichert pro Tileset.",
        },
        darkCorridorWallSolidColorOverrideEnabled: {
          label: "Einfarbige dunkle W\u00e4nde verwenden",
          description:
            "Verwendet eine gew\u00e4hlte RGB-Farbe statt einer Tileset-Kachel.",
        },
      },
      tabs: {
        display: {
          label: "Anzeige",
          description: "Oberfl\u00e4chen- und Anzeigeeinstellungen.",
        },
        mobile: {
          label: "Mobil",
          description:
            "Mobile-spezifische Einstellungen f\u00fcr Oberfl\u00e4che und Spielablauf.",
        },
        controls: {
          label: "Steuerung",
          description:
            "Controller-Belegung, FPS-Modus und Blickverhalten.",
        },
        sound: {
          label: "Sound",
          description:
            "Audioausgabe und leistungsrelevante Soundeinstellungen.",
        },
        combat: {
          label: "Kampf",
          description:
            "Kampf-Feedback und visuelle Reaktion auf Treffer.",
        },
        compatibility: {
          label: "Kompatibilit\u00e4t",
          description:
            "Runtime-Kompatibilit\u00e4t und NetHack-Verhaltensschalter.",
        },
        updates: {
          label: "Updates",
          description:
            "Pr\u00fcft Online-Spielupdates und zeigt ausstehende \u00c4nderungen an.",
        },
      },
    },
    update: {
      loading: {
        startupData: "Startdaten werden geladen...",
        tileset: "Tileset wird geladen...",
        runtime: "Lokale Runtime wird gestartet...",
      },
      runtimeStoppedBeforeStartup:
        "Die lokale NetHack-Runtime wurde beendet, bevor der Start abgeschlossen war.",
      preparingDownload: "Download des Spielupdates wird vorbereitet...",
      idleStatus: "Der Update-Status ist unt\u00e4tig.",
      fileProgress: (index: number, count: number) =>
        `Datei ${index} von ${count}`,
      unexpectedCheckFailure: "Unerwarteter Fehler bei der Update-Pr\u00fcfung.",
      cancelRequested: "Abbruch angefordert.",
      stoppingActiveDownloadTask:
        "Aktive Download-Aufgabe wird gestoppt.",
      unableToCancelDownload:
        "Der Update-Download konnte nicht abgebrochen werden.",
      noActiveDownloadToCancel:
        "Es gibt keinen aktiven Update-Download zum Abbrechen.",
      startingDownload: "Download des Spielupdates wird gestartet.",
      canceled: "Der Update-Download wurde abgebrochen.",
      unableToDownloadAndApply:
        "Updates konnten nicht heruntergeladen und angewendet werden.",
      failed: "Update fehlgeschlagen.",
      latestAlreadyInstalled:
        "Das neueste Update ist bereits installiert.",
      downloadComplete: "Update-Download abgeschlossen.",
      nothingAppliedTryAgain:
        "Es wurden keine Updates angewendet. Bitte erneut pr\u00fcfen.",
      noFilesApplied: "Es wurden keine Updatedateien angewendet.",
      unexpectedFailure: "Unerwarteter Update-Fehler.",
      checkingForUpdates:
        "GitHub-Ver\u00f6ffentlichungen werden gepr\u00fcft...",
      unsupportedPlatform:
        "GitHub-Ver\u00f6ffentlichungen k\u00f6nnen auf dieser Plattform nicht gepr\u00fcft werden.",
      latestAlreadyInstalledOptions:
        "Du hast bereits die neueste Spielversion.",
      oneUpdateAvailable:
        "Eine neuere Spielversion ist verf\u00fcgbar. M\u00f6chtest du aktualisieren?",
      manyUpdatesAvailable: (count: number) =>
        `${count} neuere Spielversionen sind verf\u00fcgbar. M\u00f6chtest du aktualisieren?`,
      updateCheckFailed: (message: string) =>
        `Pr\u00fcfung der GitHub-Ver\u00f6ffentlichungen fehlgeschlagen: ${message}`,
    },
    saves: {
      sections: {
        manual: "Manuelle Spielst\u00e4nde",
        autosave: "Automatische Spielst\u00e4nde",
      },
      deleteTitle: "Spielstand l\u00f6schen?",
      deleteMessage: (name: string) =>
        `M\u00f6chtest du ${name} wirklich l\u00f6schen?`,
      overwriteTitle: "Spielstand \u00fcberschreiben?",
      overwriteMessage: (name: string) =>
        `Ein Spielstand mit dem Namen "${name}" existiert bereits. M\u00f6chtest du ihn mit einem neuen Charakter \u00fcberschreiben?`,
      errorLoading: "Fehler beim Laden der Spielst\u00e4nde",
      loading: "Spielst\u00e4nde werden geladen...",
      noneFound: "Keine Spielst\u00e4nde gefunden.",
      savedAt: (date: string) => `Gespeichert: ${date}`,
    },
    tilesets: {
      userTileset: "Benutzer-Tileset",
      currentSelectionFallback: "dieses Tileset",
      deleteUploadedTitle: "Hochgeladenes Tileset l\u00f6schen?",
      deleteUploadedMessage: (label: string) =>
        `Soll '${label}' aus den hochgeladenen Tilesets gel\u00f6scht werden?`,
      failedToDelete: "Tileset konnte nicht gel\u00f6scht werden.",
      chooseFile: "W\u00e4hle eine PNG/BMP/GIF/JPEG-Tileset-Datei.",
      provideName: "Gib einen Namen f\u00fcr dieses Tileset an.",
      failedToSave: "Tileset konnte nicht gespeichert werden.",
      failedToLoadUploaded:
        "Hochgeladene Tilesets konnten nicht geladen werden:",
      userTilesetSuffix: "Benutzer-Tileset (Benutzer)",
      noTilesetsFound: "Keine Tilesets gefunden",
      failedToReadImage: "Tileset-Bild konnte nicht gelesen werden.",
    },
    tilePicker: {
      noAtlasAvailable: "Kein Tileset-Atlas verf\u00fcgbar.",
      unableToLoadAtlas: "Tile-Atlas konnte nicht geladen werden.",
      atlasLoaded: "Tile-Atlas geladen.",
      loadingAtlas: "Tile-Atlas wird geladen...",
      selectedTile: (tileId: number) => `Ausgew\u00e4hlt: Tile #${tileId}`,
      glyph: (label: string) => `Glyph ${label}`,
      tile: (tileId: number) => `Tile ${tileId}`,
      defaultBadge: "Standard",
      resetToDefault: "Auf Standard zur\u00fccksetzen",
      darkWallTitle: "Auswahl f\u00fcr dunkle Wandkacheln",
      closeDarkWall: "Auswahl f\u00fcr dunkle Wandkacheln schlie\u00dfen",
      closeBackground:
        "Auswahl f\u00fcr Tileset-Hintergrundkacheln schlie\u00dfen",
      backgroundHelper:
        "Wird verwendet, um den gemeinsamen Tileset-Hintergrund aus Monster-/Beute-Billboards zu entfernen.",
      backgroundTitle: "Auswahl f\u00fcr Tileset-Hintergrundkacheln",
      backgroundTitleWithLabel: (label: string) =>
        `Auswahl f\u00fcr Tileset-Hintergrundkacheln: ${label}`,
      closeSolidColor:
        "Auswahl f\u00fcr einfarbigen Chroma-Key schlie\u00dfen",
      solidColorTitle: "Einfarbiger Chroma-Key-Ausw\u00e4hler",
      solidColorTitleWithLabel: (label: string) =>
        `Einfarbiger Chroma-Key-Ausw\u00e4hler: ${label}`,
    },
    soundPack: {
      discardChangesTitle: "\u00c4nderungen am Soundpaket verwerfen?",
      discardChangesMessage:
        "Ungespeicherte \u00c4nderungen am Soundpaket verwerfen und fortfahren?",
      discard: "Verwerfen",
      keepEditing: "Weiter bearbeiten",
      failedToLoadIndexedDb:
        "Soundpakete konnten nicht aus IndexedDB geladen werden.",
      failedToSelectRequested:
        "Das angeforderte Soundpaket konnte nicht ausgew\u00e4hlt werden.",
      provideName: "Gib einen Namen f\u00fcr das Soundpaket an.",
      created: (name: string) => `Soundpaket '${name}' erstellt.`,
      failedToCreate: "Soundpaket konnte nicht erstellt werden.",
      saved: (name: string) => `Soundpaket '${name}' gespeichert.`,
      failedToSave: "Soundpaket konnte nicht gespeichert werden.",
      failedToExportZip: "Soundpaket-ZIP konnte nicht exportiert werden.",
      exported: (name: string) => `'${name}' exportiert.`,
      failedToImportZip: "Soundpaket-ZIP konnte nicht importiert werden.",
      imported: (name: string) => `Soundpaket '${name}' importiert.`,
      deleteTitle: "Soundpaket l\u00f6schen?",
      deleteMessage: (name: string) =>
        `Soll das Soundpaket '${name}' gel\u00f6scht werden? Dies kann nicht r\u00fcckg\u00e4ngig gemacht werden.`,
      deleted: (name: string) => `Soundpaket '${name}' gel\u00f6scht.`,
      failedToDelete: "Soundpaket konnte nicht gel\u00f6scht werden.",
      noPreviewSource:
        "F\u00fcr diesen Sound ist keine Vorschauquelle verf\u00fcgbar.",
      unableToPreview: "Dieser Sound kann nicht vorgespielt werden.",
      title: "Soundpakete",
      activePack: "Aktives Soundpaket",
      activePackDescription:
        "W\u00e4hlt das aktive Soundpaket f\u00fcr die Aufl\u00f6sung von Soundpfaden.",
      createNew: "Neues Soundpaket erstellen",
      createDescription:
        "Erstellt ein benutzerdefiniertes Soundpaket, das Standards \u00fcberschreibt.",
      createNameLabel: "Name des neuen Soundpakets",
      createPlaceholder: "Mein Soundpaket",
      createAndSave: "Erstellen und speichern",
      packName: "Paketname",
      packNameDescription:
        "Benenne dieses Paket um und speichere es, um seinen Sounddatei-Namensraum zu aktualisieren.",
      savePack: "Soundpaket speichern",
      export: "Soundpaket exportieren",
      import: "Soundpaket importieren",
      deletePack: "Soundpaket l\u00f6schen",
      stopPreview: "Vorschau stoppen",
      loading: "Soundpakete werden geladen...",
      pendingSaveSuffix: " (Speicherung ausstehend)",
      defaultSuffix: " (Standard)",
      customSuffix: " (Benutzerdefiniert)",
      noBundledSound: "Kein mitgelieferter Sound",
      enableSoundAria: (label: string) => `${label} aktivieren`,
      volumeAria: (label: string) => `Lautst\u00e4rke f\u00fcr ${label}`,
      play: "Abspielen",
      playing: "Wird abgespielt...",
      volume: "Lautst\u00e4rke",
      remove: "Entfernen",
      replace: "Ersetzen",
      soundFile: "Sounddatei",
      reset: "Zur\u00fccksetzen",
      attribution: "Namensnennung",
      attributionAria: (label: string) => `Namensnennung f\u00fcr ${label}`,
      attributionPlaceholder:
        "Quelle, Urheber oder Lizenzdetails",
      addVariation: "+ Variation hinzuf\u00fcgen",
    },
    dialogs: {
      pauseMenu: {
        saveBeforeQuit:
          "M\u00f6chtest du vor dem Beenden speichern?",
        title: "Spiel pausiert",
        resume: "Fortsetzen",
        options: "Optionen",
        saveGame: "Spiel speichern",
        exitToMainMenu: "Zum Hauptmen\u00fc",
        quitGame: "Spiel beenden",
      },
      debugLogs: {
        closeLabel: "Debug-Protokolle schlie\u00dfen",
        title: "Gespeicherte Debug-Protokolle",
        hint: "Protokolle werden erst erfasst, nachdem der versteckte Debug-Log-Schalter aktiviert wurde.",
        showingEntries: (count: number, startedAt: string) =>
          `${count} Eintr\u00e4ge von ${startedAt} werden angezeigt.`,
        noneSaved: "Noch keine Debug-Protokolle gespeichert.",
        refresh: "Aktualisieren",
        clearLogs: "Protokolle l\u00f6schen",
      },
      startupUpdate: {
        maintenanceNotice:
          "Es wurden keine neueren GitHub-Ver\u00f6ffentlichungen gefunden.",
        summaryAvailable:
          "Eine neuere Spielversion ist verf\u00fcgbar. M\u00f6chtest du aktualisieren?",
        summaryNone: "Du hast bereits die neueste Spielversion.",
        currentVersion: (version: string) => `Aktuelle Version: ${version}`,
        latestVersion: (version: string) =>
          `Neueste GitHub-Ver\u00f6ffentlichung: ${version}`,
        disableAtStartup:
          "Diese Hinweise beim Start nicht mehr anzeigen.",
        disabledNotice:
          "Benachrichtigungen zu Ver\u00f6ffentlichungen beim Start sind jetzt deaktiviert. Du kannst sie in den Optionen wieder aktivieren.",
        clientUpgradeRequired:
          "F\u00fcr die neuesten Plattformverbesserungen ist au\u00dferdem ein vollst\u00e4ndiges Client-Upgrade erforderlich.",
        progressTitle: "Status des Update-Downloads",
        canceling: "Update-Download wird abgebrochen...",
        noActiveTransfer: "Kein aktiver Dateitransfer.",
        waitingForUpdater: "Warte auf Aktivit\u00e4t des Updaters.",
        pendingUpdates: "Ausstehende Updates",
        payloadAvailable: "Update-Paket ist verf\u00fcgbar.",
        downloadUpdates: "Updates herunterladen",
        hideDetails: "Details ausblenden",
        moreDetails: "Mehr Details",
        cancelDownload: "Download abbrechen",
      },
      startup: {
        chooseVariant: "W\u00e4hle deine NetHack-Variante:",
        options: "NetHack 3D-Optionen",
        quitGame: "Spiel beenden",
        chooseSetup: "W\u00e4hle deine Charakterkonfiguration:",
        randomCharacter: "Zufallscharakter",
        createCharacter: "Charakter erstellen",
        loadGame: "Spiel laden",
        selectSavedGame: "W\u00e4hle einen Spielstand:",
        enterRandomName:
          "Gib einen Namen f\u00fcr deinen Zufallscharakter ein:",
        createCharacterPrompt: "Erstelle deinen Charakter:",
        name: "Name",
        role: "Rolle",
        race: "Rasse",
        gender: "Geschlecht",
        alignment: "Gesinnung",
        startGame: "Spiel starten",
      },
      clientOptions: {
        closeLabel: "NetHack-3D-Optionen schlie\u00dfen",
        title: "NetHack 3D Client-Optionen",
        categoriesLabel: "Einstellungskategorien",
        updates: {
          checkOnLaunchLabel:
            "GitHub-Ver\u00f6ffentlichungen beim Start anzeigen",
          checkOnLaunchDescription:
            "Pr\u00fcft GitHub-Ver\u00f6ffentlichungen beim Start und informiert dich, wenn eine neuere Version verf\u00fcgbar ist.",
          title: "GitHub-Ver\u00f6ffentlichungen",
          description:
            "Vergleiche diesen Build mit den ver\u00f6ffentlichten GitHub-Ver\u00f6ffentlichungen.",
          idle:
            "Dr\u00fccke 'Nach Updates suchen', um diesen Build mit GitHub-Ver\u00f6ffentlichungen zu vergleichen.",
          button: "Nach Updates suchen",
          openGitHubReleases: "GitHub-Ver\u00f6ffentlichungen \u00f6ffnen",
        },
        buttons: {
          manageTileSets: "Tilesets verwalten",
          remapController: "Controller neu belegen",
          resetControllerDefaults:
            "Controller-Standardbelegung wiederherstellen",
        },
        hints: {
          darkWallsAlwaysEnabled:
            " Immer aktiviert, solange Vulture-Tiles aktiv sind.",
          darkWallsDisabledByVulture:
            " Deaktiviert, solange Vulture-Tiles aktiv sind.",
          enableDarkWallsFirst:
            " Aktiviere zuerst dunkle Korridorw\u00e4nde f\u00fcr Legacy-Runtimes oder dunkle Wand-\u00dcberschreibungen in NetHack 5.0.",
          enableFpsFirst:
            " Aktiviere zuerst den Ego-Modus unter Anzeige.",
        },
        darkWallControls: {
          normal: "Normal",
          fps: "FPS",
          normalAria: "Einfarbige dunkle Wand (Normalmodus)",
          fpsAria: "Einfarbige dunkle Wand (FPS-Modus)",
          gridLines: "Gitterlinien",
          intensity: "Intensit\u00e4t",
        },
        controllerRemap: {
          title: "Controller-Neubelegung",
          closeLabel: "Controller-Neubelegung schlie\u00dfen",
          hint: "W\u00e4hle einen Slot und dr\u00fccke dann eine Taste oder bewege einen Stick. Jede Aktion hat zwei Slots.",
          listeningFor: (label: string, slot: number) =>
            `Warte auf Eingabe f\u00fcr ${label} (Slot ${slot}). ESC zum Abbrechen.`,
        },
        resetPrompt:
          "NetHack-3D-Optionen auf Standardwerte zur\u00fccksetzen? Benutzerdefinierte Tilesets bleiben erhalten.",
      },
      tilesetManager: {
        closeLabel: "Tileset-Verwaltung schlie\u00dfen",
        title: "Tilesets verwalten",
        description:
          "F\u00fcge Tilesets hinzu und bearbeite Hintergrund-/Chroma-Einstellungen pro Tileset.",
        createTitle: "Neues Tileset erstellen",
        editTitle: "Tileset bearbeiten",
        editTitleWithName: (label: string) =>
          `Tileset bearbeiten: ${label}`,
        tileSetName: "Tileset-Name",
        tileSetPlaceholder: "Mein Tileset",
        builtInNamesLocked:
          "Namen integrierter Tilesets k\u00f6nnen nicht ge\u00e4ndert werden.",
        tileLayoutVersion: "Tile-Layout-Version",
        layout367: "NetHack-3.6.7-Layout",
        layout5: "NetHack-5.0-Layout",
        tileLayoutDescription:
          "W\u00e4hle das Tile-Index-Layout, das dieser hochgeladene Atlas verwendet.",
        tileImage: "Tileset-Bild",
        tileImageOptional: "Tileset-Bild (optionaler Ersatz)",
        selectedFile: (fileName: string) => `Ausgew\u00e4hlt: ${fileName}`,
        currentFile: (fileName: string) => `Aktuell: ${fileName}`,
        uploadedImage: "hochgeladenes Bild",
        backgroundRemovalDescription:
          "Konfiguriere die Hintergrundentfernung f\u00fcr Billboards dieses Tilesets oder lasse beide Modi aus, um Atlas-Hintergr\u00fcnde beizubehalten.",
        backgroundTileRemoval: "Hintergrundkachel-Entfernung",
        backgroundTileRemovalDescription:
          "Verwendet eine ausgew\u00e4hlte Atlas-Kachel zur Hintergrundentfernung von Billboards.",
        solidChromaKey: "Einfarbiger Chroma-Key",
        solidChromaKeyDescription:
          "Verwendet eine einzelne RGB-Vollfarbe zur Hintergrundentfernung von Billboards.",
        clickToPickFromAtlas: "klicken, um aus dem Atlas auszuw\u00e4hlen",
        saveFirstThenEdit:
          "Speichere das neue Tileset zuerst und bearbeite dann Hintergrund-/Chroma-Einstellungen.",
        createTileSet: "Tileset erstellen",
        saveTileSet: "Tileset speichern",
        saveTileSettings: "Tile-Einstellungen speichern",
        importNewTileSet: "+ Neues Tileset importieren",
        noUploadedTilesets: "Keine hochgeladenen Tilesets verf\u00fcgbar.",
        selectedSuffix: " (ausgew\u00e4hlt)",
        editingSuffix: " (in Bearbeitung)",
        uploadedDetails: (fileName: string, layout: string) =>
          `${fileName} | hochgeladen | Layout ${layout}`,
        builtInDetails: (path: string) => `${path} | integriert`,
      },
      textInput: {
        cancelLabel: "Texteingabe abbrechen",
        placeholder: "Text eingeben",
        ok: "OK",
      },
      question: {
        cancelPrompt: "Abfrage abbrechen",
        selectAll: "Alle ausw\u00e4hlen",
        deselectAll: "Auswahl aufheben",
        page: (current: number, total: number) => `Seite ${current} / ${total}`,
        pageHintMultiple:
          "Mit < und > Seiten wechseln. ESC zum Abbrechen",
        pageHintSingle: "ESC zum Abbrechen",
        choices: {
          leftRingFinger: "Linker Ringfinger",
          rightRingFinger: "Rechter Ringfinger",
          here: "Hier",
          onGround: "Am Boden",
          eligibleItems: "Passende Gegenstände",
          allInventory: "Ganzes Inventar",
        },
      },
      runtimeStartError: {
        closeLabel: "Zum Hauptmen\u00fc zur\u00fcck",
        title: "NetHack konnte nicht initialisiert werden.",
        returnToMainMenu: "Zum Hauptmen\u00fc zur\u00fcck",
      },
      newGamePrompt: {
        closeLabel: "Neues-Spiel-Abfrage schlie\u00dfen",
        title: "Zum Hauptmen\u00fc zur\u00fcckkehren?",
        reasonFallback: "Spiel vorbei",
      },
      direction: {
        cancelLabel: "Richtungsabfrage abbrechen",
      },
      info: {
        closeCharacter: "Charakterfenster schlie\u00dfen",
        closeInformation: "Informationsfenster schlie\u00dfen",
        characterTitle: "Charakter",
        experienceProgress: "Erfahrungsfortschritt",
        levelLabel: (level: number) => `Stufe ${level}`,
        xpAtMaxLevel: (xp: string) => `EP ${xp} (maximale Stufe erreicht)`,
        xpToNextLevel: (xp: string, next: string, remaining: string) =>
          `EP ${xp} / ${next} • ${remaining} bis zur n\u00e4chsten Stufe`,
        vitals: "Vitalwerte",
        characteristics: "Eigenschaften",
        currentLimit: "Aktuell / Limit",
        armorClass: "R\u00fcstungsklasse",
        currentStatus: "Aktueller Status",
        noActiveStatus: "Kein aktiver Status.",
        currentAttributes: "Aktuelle Attribute",
        noTemporaryAttributes: "Keine tempor\u00e4ren Attributseffekte.",
        characterActions: "Charakteraktionen",
        inventory: "Inventar",
        inventoryDetail: "Getragene Gegenst\u00e4nde \u00f6ffnen",
        closeHint:
          "Zum Schlie\u00dfen SPACE, ENTER oder ESC dr\u00fccken. Mit Strg+M erneut \u00f6ffnen.",
        infoTitleFallback: "NetHack-Informationen",
        noDetails: "(Keine Details)",
      },
      inventory: {
        closeLabel: "Inventar schlie\u00dfen",
        title: "INVENTAR",
        empty: "Dein Inventar ist leer.",
        unknownItem: "Unbekannter Gegenstand",
        closeHint: "Mit ENTER, ESC oder 'i' schlie\u00dfen.",
        closeHintWithContext:
          "W\u00e4hle einen Gegenstand, um Kontextbefehle zu \u00f6ffnen. Mit ENTER, ESC oder 'i' schlie\u00dfen",
      },
      inventoryDropMenu: {
        title: "Ablegen",
        dropType: "Ablegetyp",
        dropAmount: "Ablegemenge",
        dropSpecificAmount: "Bestimmte Menge ablegen",
        onlyStackedItems: "Nur f\u00fcr gestapelte Gegenst\u00e4nde verf\u00fcgbar",
      },
      inventoryDropCount: {
        title: "Wie viele aus diesem Stapel ablegen?",
        chooseAmount: (max: number) =>
          `W\u00e4hle eine Menge von 1 bis ${max}.`,
        ariaLabel: "Ablegemenge",
        setMinimum: "Ablegemenge auf Minimum setzen",
        decrease: "Ablegemenge um eins verringern",
        increase: "Ablegemenge um eins erh\u00f6hen",
        setMaximum: "Ablegemenge auf Maximum setzen",
      },
      mobileActions: {
        extendedCommands: "Erweiterte Befehle",
        commonCommands: "H\u00e4ufige Befehle",
        allCommands: "Alle Befehle",
        actions: "Aktionen",
        menu: "Men\u00fc",
        close: "Schlie\u00dfen",
        wizardCommands: "Zauberer-Befehle",
        wizard: "Zauberer",
        wizardCommandFallbackDescription:
          "F\u00fchrt diesen reinen Wizard-Debugbefehl aus.",
        wizardCommandDetails: {
          levelchange: { name: "Stufe \u00e4ndern", description: "Setzt die Erfahrungsstufe des Helden." },
          lightsources: { name: "Lichtquellen", description: "Zeigt bewegliche Lichtquellen." },
          migratemons: { name: "Wandernde Monster", description: "Zeigt Monster, die zwischen Ebenen wechseln." },
          panic: { name: "Panic-Test", description: "Testet Panic-Behandlung und beendet dieses Spiel." },
          polyself: { name: "Selbst polymorphen", description: "Ver\u00e4ndert die aktuelle Gestalt des Helden." },
          seenv: { name: "Sichtvektoren", description: "Zeigt die Debug-Karte der Sichtvektoren." },
          stats: { name: "Speicherstatistik", description: "Zeigt Laufzeit-Speicherstatistiken." },
          timeout: { name: "Timeout-Warteschlange", description: "Zeigt zeitgesteuerte Effekte und Intrinsics." },
          vanquished: { name: "Besiegte Monster", description: "Zeigt Z\u00e4hlungen get\u00f6teter Monster." },
          vision: { name: "Sicht-Array", description: "Zeigt das aktuelle Sicht-Array." },
          wizbury: { name: "Objekte vergraben", description: "Vergr\u00e4bt Bodenobjekte in einem 3x3-Bereich." },
          wizdetect: { name: "Verborgenes finden", description: "Enth\u00fcllt verborgene Dinge nahe dem Helden." },
          wizgenesis: { name: "Monster erzeugen", description: "Erzeugt ein Monster nach Name oder Klasse." },
          wizidentify: { name: "Inventar identifizieren", description: "Identifiziert alle Gegenst\u00e4nde im Inventar." },
          wizintrinsic: { name: "Intrinsics setzen", description: "Passt ausgew\u00e4hlte zeitgesteuerte Intrinsics an." },
          wizlevelport: { name: "Ebenen-Teleport", description: "Teleportiert auf eine andere Ebene oder in einen Zweig." },
          wizmakemap: { name: "Ebene neu erstellen", description: "Generiert die aktuelle Ebene erneut." },
          wizmap: { name: "Ebene kartieren", description: "Enth\u00fcllt Ebenenkarte und Fallen." },
          wizrumorcheck: { name: "Ger\u00fcchte pr\u00fcfen", description: "Validiert wahre und falsche Ger\u00fcchtedateien." },
          wizsmell: { name: "Monster riechen", description: "Riecht ein ausgew\u00e4hltes Monster." },
          wizwhere: { name: "Spezialebenen", description: "Zeigt die Platzierung aller Spezialebenen." },
          wizwish: { name: "Wunsch", description: "Erzeugt Gegenstand, Falle oder Terrain." },
          wmode: { name: "Wandmodi", description: "Zeigt Debug-Daten zu Wandmodi." },
        },
        repeat: "Wiederholen",
        character: "Charakter",
        inventory: "Inventar",
        log: "Protokoll",
        pickUp: "Aufheben",
        search: "Suchen",
        closeMessageLog: "Nachrichtenprotokoll schlie\u00dfen",
      },
      positionPrompt: {
        closeLabel: "Positionsabfrage schlie\u00dfen",
        desktopHint:
          "Verwende Bewegungseingaben oder klicke auf ein Feld, um die Auswahl zu verschieben. Klicke erneut auf das ausgewählte Feld oder drücke Enter zum Bestätigen.",
        mobileHint:
          "Verwende Bewegungseingaben oder tippe auf ein Feld, um die Auswahl zu verschieben. Tippe erneut auf das ausgewählte Feld oder drücke Enter zum Bestätigen.",
        controllerHint:
          "Verwende Bewegungseingaben, um die Auswahl zu verschieben. Drücke Enter oder Bestätigen zum Bestätigen.",
      },
      controllerSupport: {
        prompt:
          "Controller erkannt. Controller-Unterst\u00fctzung aktivieren?",
      },
    },
  },
};

export const de = mergeTranslations(en, deOverrides);
