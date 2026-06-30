import { mergeTranslations, type LocaleOverrides } from "../locale-helpers";
import { en, type TranslationDictionary } from "./en";

export const fiOverrides: LocaleOverrides<TranslationDictionary> = {
  meta: {
    locale: "fi-FI",
  },
  common: {
    appName: "NetHack 3D -peli",
    confirm: "Vahvista",
    cancel: "Peruuta",
    close: "Sulje",
    back: "Takaisin",
    yes: "Kyllä",
    no: "Ei",
    delete: "Poista",
    edit: "Muokkaa",
    done: "Valmis",
    resetToDefaults: "Palauta oletukset",
    later: "Myöhemmin",
    checking: "Tarkistetaan...",
    downloading: "Ladataan...",
    canceling: "Peruutetaan...",
    none: "Ei mitään",
    off: "Pois",
    normal: "Normaali",
    fps: "FPS-tila",
  },
  controller: {
    groups: {
      movement: "Liikkuminen",
      lookAndCamera: "Katse ja kamera",
      actions: "Toiminnot",
      dialogs: "Valintaikkunat",
      system: "Järjestelmä",
    },
    actions: {
      dpad_up: {
        label: "Ohjausristi ylös",
        description:
          "Siirry ylöspäin valintaikkunoissa ja liikkumisen korostuksessa.",
      },
      dpad_down: {
        label: "Ohjausristi alas",
        description:
          "Siirry alaspäin valintaikkunoissa ja liikkumisen korostuksessa.",
      },
      dpad_left: {
        label: "Ohjausristi vasemmalle",
        description:
          "Siirry vasemmalle valintaikkunoissa ja liikkumisen korostuksessa.",
      },
      dpad_right: {
        label: "Ohjausristi oikealle",
        description:
          "Siirry oikealle valintaikkunoissa ja liikkumisen korostuksessa.",
      },
      left_stick_up: {
        label: "Vasen sauva ylös",
        description: "Liikkumisen korostus ja virtuaalikohdistin ylös.",
      },
      left_stick_down: {
        label: "Vasen sauva alas",
        description: "Liikkumisen korostus ja virtuaalikohdistin alas.",
      },
      left_stick_left: {
        label: "Vasen sauva vasemmalle",
        description:
          "Liikkumisen korostus ja virtuaalikohdistin vasemmalle.",
      },
      left_stick_right: {
        label: "Vasen sauva oikealle",
        description: "Liikkumisen korostus ja virtuaalikohdistin oikealle.",
      },
      right_stick_up: {
        label: "Oikea sauva ylös",
        description: "Katse, kameran panorointi ja valintaikkunan vieritys ylös.",
      },
      right_stick_down: {
        label: "Oikea sauva alas",
        description:
          "Katse, kameran panorointi ja valintaikkunan vieritys alas.",
      },
      right_stick_left: {
        label: "Oikea sauva vasemmalle",
        description: "Katse ja kameran panorointi vasemmalle.",
      },
      right_stick_right: {
        label: "Oikea sauva oikealle",
        description: "Katse ja kameran panorointi oikealle.",
      },
      confirm: {
        label: "Vahvista / Napsauta",
        description: "Vahvista liike ja napsauta valintaikkunoissa.",
      },
      search: {
        label: "Etsi",
        description:
          "Etsi nykyisestä ruudusta, kun liikkeen esikatselu ei ole aktiivinen.",
      },
      cancel_or_context: {
        label: "Peruuta / Konteksti",
        description: "Avaa kontekstitoiminnot tai peruuta nykyinen valintaikkuna.",
      },
      action_menu: {
        label: "Toimintovalikko",
        description: "Avaa ohjaimen säteittäinen toimintovalikko.",
      },
      run_modifier: {
        label: "Juoksumuokkain",
        description: "Pidä painettuna lähettääksesi juoksuetuliitteen ennen liikettä.",
      },
      zoom_in: {
        label: "Zoomaa (pidä)",
        description:
          "Pidä painettuna, zoomaa vasemman sauvan ylös/alas-liikkeellä ja kierrä kameraa oikealla sauvalla.",
      },
      recenter_camera: {
        label: "Keskitä kamera",
        description: "Palauta kamera pelaajan keskelle.",
      },
      toggle_large_minimap: {
        label: "Vaihda suuri minimikartta",
        description: "Vaihda erittäin suuren minimikartan koko.",
      },
      pause_menu: {
        label: "Taukovalikko",
        description: "Avaa tai sulje taukovalikko.",
      },
      open_inventory: {
        label: "Tavarat",
        description: "Avaa tavaraikkuna.",
      },
      open_character: {
        label: "Hahmolomake",
        description: "Avaa hahmolomakeikkuna.",
      },
    },
    buttonLabels: {
      0: "A-painike",
      1: "B-painike",
      2: "X-painike",
      3: "Y-painike",
      4: "Vasen olkanappi",
      5: "Oikea olkanappi",
      6: "Vasen liipaisin",
      7: "Oikea liipaisin",
      8: "Takaisin / Näytä",
      9: "Start / Valikko",
      10: "Vasen sauva painallus",
      11: "Oikea sauva painallus",
      12: "Ohjausristi ylös",
      13: "Ohjausristi alas",
      14: "Ohjausristi vasemmalle",
      15: "Ohjausristi oikealle",
      16: "Kotipainike",
    },
    axisLabels: {
      0: "Vasen sauva X",
      1: "Vasen sauva Y",
      2: "Oikea sauva X",
      3: "Oikea sauva Y",
    },
    directions: {
      leftStickLeft: "Vasen sauva vasemmalle",
      leftStickRight: "Vasen sauva oikealle",
      leftStickUp: "Vasen sauva ylös",
      leftStickDown: "Vasen sauva alas",
      rightStickLeft: "Oikea sauva vasemmalle",
      rightStickRight: "Oikea sauva oikealle",
      rightStickUp: "Oikea sauva ylös",
      rightStickDown: "Oikea sauva alas",
    },
    unbound: "Ei sidottu",
    axisFallback: (axisIndex: number) => `Akseli ${axisIndex}`,
    buttonFallback: (buttonIndex: number) => `Painike ${buttonIndex}`,
    slotLabel: (slotIndex: number) => `Paikka ${slotIndex + 1}`,
    listening: "Paina syötettä...",
    clear: "Tyhjennä",
    controllerDetected: (count: number) =>
      `${count} ohjain${count === 1 ? "" : "ta"} havaittu.`,
    noControllerDetected: "Ohjainta ei havaittu.",
  },
  startupInitOptions: {
    accordion: {
      summary: "Alustusasetukset (valinnainen)",
      description:
        "Käynnistyksessä käytettävät ylimääräiset NetHack `OPTIONS` -määritykset. Ikkunaporttiin ja alustaan liittyvät asetukset on jätetty tarkoituksella pois.",
      resetToDefaults: "Palauta oletukset",
    },
    options: {
      playmode: {
        label: "Pelitila",
        description:
          "Valitse käynnistystila. Wizard-tila on NetHackin debug-tila (`playmode:debug`).",
        options: {
          normal: "Normaali",
          explore: "Tutki",
          debug: "Velho/Debug",
        },
      },
      number_pad: {
        label: "Liikenappaimet",
        description:
          "Valitse, käyttääkö NetHack liikkumiseen numeronäppäimistöä (`number_pad:1`) vai perinteisiä vi-näppäimiä (`number_pad:0`).",
        options: {
          numeric: "Numeronäppäimistö",
          vi: "vi-näppäimet",
        },
      },
      autopickup: {
        label: "Automaattinen poiminta",
        description:
          "Poimi automaattisesti pickup types -kohdassa valitut esineluokat.",
      },
      pickup_types: {
        label: "Poimintatyypit",
        description:
          'Automaattisesti poimittavien esineluokkien symbolit (esimerkki: $"=/!?+). Jätä tyhjäksi käyttääksesi pelin oletusta.',
        placeholder: '$"/=!+?',
      },
      pickup_thrown: {
        label: "Poimi heitetyt esineet",
        description:
          "Poimi heitetyt esineet automaattisesti, kun ne laskeutuvat.",
      },
      pickup_burden: {
        label: "Poiminnan kuormaraja",
        description:
          "Kysy ennen poimintaa, jos tämä kuormitustaso ylittyisi.",
        options: {
          u: "Kuormittamaton (u)",
          b: "Kuormitettu (b)",
          s: "Rasittunut (s)",
          n: "Jännittynyt (n)",
          t: "Ylikuormitettu (t)",
          l: "Täysin ylikuormitettu (l)",
        },
      },
      pile_limit: {
        label: "Kasakoko",
        description:
          "Esinemäärän raja, joka avaa ponnahdusluettelon lattialla oleville kasoille.",
      },
      autoquiver: {
        label: "Automaattinen viini",
        description:
          "Täytä viini automaattisesti tai valmistele sopiva ase ammuttaessa.",
      },
      autoopen: {
        label: "Avaa automaattisesti",
        description:
          "Yritä avata ovet automaattisesti liikkuessa niitä kohti.",
      },
      autodig: {
        label: "Kaiva automaattisesti",
        description:
          "Kaiva automaattisesti seiniin, kun se on mahdollista ja liikut niitä kohti.",
      },
      cmdassist: {
        label: "Komentojen avustus",
        description:
          "Näytä ylimääräistä ohjetekstiä, kun komennot kirjoitetaan väärin.",
      },
      confirm: {
        label: "Vahvista hyökkäykset",
        description: "Kysy ennen rauhanomaisten olentojen hyökkäämistä.",
      },
      safe_pet: {
        label: "Turvallinen lemmikki",
        description: "Kysy ennen kuin osut lemmikkiisi.",
      },
      help: {
        label: "Pelinsisäinen ohje",
        description:
          "Kysy lisätietojen näyttämisestä look/help-toiminnossa, kun tietoa on enemmän saatavilla.",
      },
      legacy: {
        label: "Legacy-intro",
        description: "Näytä tarinan aloitus, kun uusi peli alkaa.",
      },
      rest_on_space: {
        label: "Lepää välilyönnillä",
        description: "Käsittele välilyöntiä odottamisena/lepohetkenä.",
      },
      pushweapon: {
        label: "Siirrä ase",
        description:
          "Siirrä tällä hetkellä käytössä oleva ase sivukäteen vaihdettaessa.",
      },
      extmenu: {
        label: "Laajennettu komentovalikko",
        description: "Käytä ponnahdusvalikkoa laajennetuille komennoille.",
      },
      fixinv: {
        label: "Kiinnitä tavarapaikat",
        description:
          "Yritä säilyttää tavarapaikkojen kirjaimet, kun esineet liikkuvat.",
      },
      implicit_uncursed: {
        label: "Näytä uncursed",
        description:
          "Sisällytä sana 'uncursed' aina tavarakuvauksiin.",
      },
      mention_walls: {
        label: "Mainitse seinät",
        description: "Näytä viesti liikkuessa seinää päin.",
      },
      sortloot: {
        label: "Järjestä saalisluettelot",
        description:
          "Lajittelutapa poiminta- ja tavaravalintaluetteloille.",
        options: {
          f: "Täysi",
          l: "Vain saalis",
          n: "Ei mitään",
        },
      },
      sortpack: {
        label: "Järjestä tavarat",
        description: "Järjestä repun sisältö tyypin mukaan tavaroita näytettäessä.",
      },
      msghistory: {
        label: "Viestihistorian koko",
        description:
          "Muistiin säilytettävien ylärivin viestien lukumäärä.",
      },
      dogname: {
        label: "Koiran nimi",
        description: "Ensimmäisen koirasi oletusnimi.",
        placeholder: "Rekku",
      },
      catname: {
        label: "Kissan nimi",
        description: "Ensimmäisen kissasi oletusnimi.",
        placeholder: "Mirri",
      },
      horsename: {
        label: "Hevosen nimi",
        description: "Ensimmäisen hevosesi oletusnimi.",
        placeholder: "Tähti",
      },
      pettype: {
        label: "Suosittu lemmikki",
        description: "Suosittu aloituslemmikin tyyppi rooleille, joilla se voi vaihdella.",
        options: {
          default: "Pelin oletus",
          cat: "Kissa",
          dog: "Koira",
          horse: "Hevonen",
          none: "Ei mitään",
        },
      },
      fruit: {
        label: "Suosikkihedelmä",
        description: "Hedelmätyypin nimi, josta hahmosi pitää.",
        placeholder: "limasieni",
      },
      packorder: {
        label: "Repun järjestys",
        description: "Tavaroissa näytettävien esineluokkien järjestys.",
        placeholder: '")[%+/!?=(*0_`',
      },
      paranoid_confirmation: {
        label: "Varmistukset",
        description:
          "Välilyönneillä erotetut lisävahvistukset (esim. confirm quit attack pray).",
        placeholder: "attack confirm pray quit",
      },
      sparkle: {
        label: "Taikavastuksen säihke",
        description: "Näytä erityiset säihketehosteet taikavastukselle.",
      },
      standout: {
        label: "Korostetut hirviöt/More",
        description: "Lihavoi hirviöt ja --More-- -kehotteet.",
      },
      tombstone: {
        label: "Hautakivi",
        description: "Näytä hautakivigrafiikka kuoleman yhteydessä.",
      },
      verbose: {
        label: "Yksityiskohtaiset viestit",
        description: "Käytä täydempää sanamuotoa tila- ja toimintaviesteissä.",
      },
    },
  },
  soundEffects: {
    byKey: {
      "player-walk": "Pelaajan askel",
      hit: "Osuma",
      "monster-killed": "Hirviö tapettu (pelaaja)",
      "monster-killed-other": "Hirviö tapettu (muu)",
      "missed-attack": "Huti",
      "door-opens": "Ovi avautuu",
      "door-closes": "Ovi sulkeutuu",
      "door-kick": "Oven potku",
      "door-smash": "Oven murskaus",
      "door-resists": "Ovi vastustaa",
      "door-distant": "Ovi etäisyydessä",
      "walk-down-stairs": "Kulje portaat alas",
      "walk-up-stairs": "Kulje portaat ylös",
      eating: "Syöminen",
      drink: "Juominen",
      "quaff-potion": "Juo juoma",
      "pickup-gold": "Poimi kultaa",
      "pickup-item": "Poimi esine",
      "find-hidden": "Löydä piilo-ovi/käytävä",
      "level-up": "Tasonnousu",
      unlock: "Avaa lukitus",
      "boulder-push": "Lohkareen työntö",
      "boulder-blocked": "Lohkare estetty",
      splash: "Roiske",
      searching: "Etsiminen",
      "magic-cast": "Taian loitsu",
      "magic-heal": "Taikaparannus",
      "magic-buff": "Taikavahvistus",
    },
  },
  characterSheet: {
    titleFallback: "Hahmolomake",
    sectionTitles: {
      overview: "Yleiskuva",
      background: "Tausta",
      basics: "Perusteet",
      characteristics: "Nykyiset ominaisuudet",
      status: "Nykyinen tila",
      attributes: "Nykyiset attribuutit",
    },
    statLabels: {
      strength: "Voima",
      dexterity: "Ketteryys",
      constitution: "Kestävyys",
      intelligence: "Älykkyys",
      wisdom: "Viisaus",
      charisma: "Karisma",
    },
    commands: {
      enhance: {
        label: "Paranna",
        detail: "Korota taitoja",
      },
      conduct: {
        label: "Haaste",
        detail: "Näytä haasteen edistyminen",
      },
      overview: {
        label: "Yleiskuva",
        detail: "Näytä luolaston edistyminen",
      },
      spells: {
        label: "Loitsut",
        detail: "Tarkastele tunnettuja loitsuja",
      },
      seespells: {
        label: "Loitsukirja",
        detail: "Listaa loitsutavarasi",
      },
      technique: {
        label: "Technique",
        detail: "Kayta rooli-/rotukykyja",
      },
      known: {
        label: "Löydökset",
        detail: "Tunnettujen esineiden luettelo",
      },
      pray: {
        label: "Rukoile",
        detail: "Yritä rukousta",
      },
    },
  },
  castMenu: {
    schoolLabel: "Koulu:",
    headings: {
      name: "Nimi",
      level: "Taso",
      category: "Luokka",
      fail: "Epäonn.",
      retention: "Säilyvyys",
    },
    summary: {
      known: (count: number) => `${count} tunnettua`,
      castable: (count: number) => `${count} loitsittavaa`,
      bestSuccess: (percent: number) => `Paras onnistuminen ${percent}%`,
      averageFail: (percent: number) => `Keskim. epäonn. ${percent}%`,
      schoolCount: (count: number) =>
        `${count} koulukunta${count === 1 ? "" : "a"}`,
    },
    retention: {
      unknown: "Tuntematon",
      gone: "Poissa",
      full: "Täysi",
    },
  },
  enhanceMenu: {
    defaultGroupTitle: "Taidot",
    availability: {
      available_now: "Saatavilla",
      needs_experience: "Kok./Paikat",
      needs_practice: "Harjoitus",
      maxed_out: "Maksimi",
    },
    summary: {
      available: (count: number) => `${count} saatavilla`,
      gated: (count: number) => `${count} lukittu kokemuksella/paikoilla`,
      practice: (count: number) => `${count} tarvitsee harjoitusta`,
      maxed: (count: number) => `${count} maksimissa`,
    },
    maxLabel: "Maks.",
    slotCount: (count: number) => `${count} paikka${count === 1 ? "" : "a"}`,
  },
  app: {
    unknownTime: "Tuntematon aika",
    debugSession: {
      possibleCrash: "mahdollinen kaatuminen",
      active: "aktiivinen",
    },
    debugLogs: {
      buildLabelAria: (
        buildLabel: string,
        currentCount: number,
        requiredCount: number,
      ) =>
        `Build ${buildLabel}. Hidden debug logging toggle progress ${currentCount} of ${requiredCount}.`,
      enabledToast: "Debug-loki käytössä",
      enabledLogEntry:
        "Debug-loki otettiin käyttöön käynnistyksen build-etiketin easter eggillä.",
      openLink: "Näytä debug-lokit",
      clearedLogEntry: "Tallennetut debug-lokit poistettiin käyttäjän toimesta.",
    },
    statusEffects: {
      turningToStone: "Kivettymässä",
      slimed: "Limautunut",
      strangled: "Kuristettu",
      foodPoisoning: "Ruokamyrkytys",
      terminallyIll: "Kuolemansairas",
      blind: "Sokea",
      deaf: "Kuuro",
      stunned: "Tainnuksissa",
      confused: "Sekava",
      hallucinating: "Hallusinoi",
      levitating: "Leijuu",
      flying: "Lentää",
      riding: "Ratsastaa",
      barehanded: "Paljain käsin",
      busy: "Varattu",
      iron: "Rautainen",
      glowingHands: "Hehkuvat kädet",
      grabbed: "Napattu",
      held: "Pidetty paikallaan",
      icy: "Jäinen",
      inLava: "Laavassa",
      paralyzed: "Halvaantunut",
      sleeping: "Nukkuu",
      slippery: "Liukas",
      submerged: "Upoksissa",
      tethered: "Sidottu",
      trapped: "Loukussa",
      unconscious: "Tajuton",
      woundedLegs: "Haavoittuneet jalat",
      holding: "Pitelee",
    },
    characterStats: {
      descriptions: {
        strength:
          "Vaikuttaa lähitaisteluvahinkoon, kantokykyyn ja voimaa vaativiin toimiin.",
        dexterity:
          "Vaikuttaa osumatodennäköisyyteen, ansoihin ja puolustavaan ketteryyteen.",
        constitution:
          "Vaikuttaa HP:n kasvuun sekä myrkky- ja imemisvaikutusten kestoon.",
        intelligence:
          "Vaikuttaa lukemiseen ja monien loitsuihin liittyvien toimintojen onnistumiseen.",
        wisdom:
          "Vaikuttaa loitsuenergian kasvuun ja loitsimisen luotettavuuteen.",
        charisma:
          "Vaikuttaa kauppatilanteisiin, lemmikkien käsittelyyn ja sosiaalisiin lopputuloksiin.",
      },
      armorClassDescription:
        "Pienempi on parempi. Panssariluokka vähentää vihollisten osumatodennäköisyyttä sinuun.",
    },
    directionHelp: {
      controller:
        "Napsauta suuntaa tai käytä vasenta sauvaa/ohjausristiä esikatseluun ja vapauta vahvistaaksesi. Keskimmäinen ympyrä kohdistaa itseen. Käytä < tai > portaisiin. Paina ESC peruuttaaksesi.",
      numpad:
        "Napsauta suuntaa. Keskimmäinen ympyrä kohdistaa itseen. Voit myös käyttää numeronäppäimistöä (1-4,6-9), nuolinäppäimiä, <, > tai s. Paina ESC peruuttaaksesi.",
      viKeys:
        "Napsauta suuntaa. Keskimmäinen ympyrä kohdistaa itseen. Voit myös käyttää hjkl/yubn-näppäimiä, nuolinäppäimiä, <, > tai s. Paina ESC peruuttaaksesi.",
      fps:
        "Katso tähdätäksesi. Vasen napsautus tai W vahvistaa. S kohdistaa itseen. A/D tai oikea napsautus peruuttaa.",
    },
    inventoryContextActions: {
      apply: "Käytä",
      invoke: "Manaa",
      tip: "Kippaa",
      loot: "Ryöstä",
      drop: "Pudota",
      eat: "Syö",
      quaff: "Juo",
      read: "Lue",
      rub: "Hankaa",
      throw: "Heitä",
      wield: "Kanna kädessä",
      quiver: "Aseta viineen",
      wear: "Pue",
      takeOff: "Riisu",
      putOn: "Laita päälle",
      remove: "Poista",
      zap: "Säihkytä",
      untrap: "Poista ansa",
      offer: "Uhraa",
      name: "Nimeä",
      call: "Kutsu",
      adjust: "Järjestä",
      engrave: "Kaiverra",
      dip: "Upota",
      info: "Tiedot",
      unwield: "Laske kädestä",
    },
    mobileActions: {
      wait: "Odota",
      zap: "Säihkytä",
      cast: "Loitsi",
      kick: "Potkaise",
      read: "Lue",
      quaff: "Juo",
      eat: "Syö",
      glance: "Vilkaise",
      loot: "Ryöstä",
      open: "Avaa",
      wield: "Kanna kädessä",
      wear: "Pue",
      putOn: "Laita päälle",
      takeOff: "Riisu",
      extended: "Laajennetut",
    },
    clientOptions: {
      config: {
        groupControls: "Ohjain ja ensimmäisen persoonan tila",
        sectionControlsController: "Ohjain",
        controllerEnabled: {
          label: "Ota ohjain käyttöön",
          description:
            "Ota peliohjaimen syöte käyttöön pelaamisessa ja käyttöliittymän valintaikkunoissa.",
        },
        sectionControlsLook: "Katse ja kamera",
        invertLookYAxis: {
          label: "Käännä Y-akselin katsesuunta",
          description: "Käännä pystysuuntainen hiirikatselu ja kosketuskatselun suunta.",
        },
        fpsLookSensitivityX: {
          label: "FPS-katselun herkkyys X",
          description: "Vaakasuuntainen hiiri-/kosketuskatselun herkkyys.",
        },
        fpsLookSensitivityY: {
          label: "FPS-katselun herkkyys Y",
          description: "Pystysuuntainen hiiri-/kosketuskatselun herkkyys.",
        },
        snapCameraYawToNearest45: {
          label: "Napsauta kameran suunta lähimpään 45 asteeseen",
          description:
            "Kun kameran kiertosyöte vapautetaan, suunta napsahtaa pehmeästi lähimpään 45 asteen kulmaan.",
        },
        sectionControlsMovement: "Liikkumisen toiminta",
        cameraRelativeMovement: {
          label: "Kameraan suhteutettu liike ja pyyhkäisyt",
          description:
            "Kierrä liikenäppäimiä ja pyyhkäisysuuntia kameran Y-akselin kulman perusteella.",
        },
        fpsWasdKeyboardMovementEnabled: {
          label: "Ota WASD-n\u00e4pp\u00e4imist\u00f6liike k\u00e4ytt\u00f6\u00f6n FPS-tilassa",
          description:
            "K\u00e4yt\u00e4 W/A/S/D-n\u00e4pp\u00e4imi\u00e4 ensimm\u00e4isen persoonan liikkumiseen. Poista k\u00e4yt\u00f6st\u00e4, jotta n\u00e4m\u00e4 n\u00e4pp\u00e4imet toimivat tavallisina NetHack-komentoina.",
        },
        controllerFpsMoveRepeatMs: {
          label: "FPS-vasemman sauvan liikkeen toisto",
          description:
            "Vasemman sauvan liikkeen toistoviive FPS-tilassa (pienempi on nopeampi).",
        },
        groupInterface: "Käyttöliittymä",
        locale: {
          label: "Kieli",
          description:
            "Valitse käyttöliittymän kieli. Oletuksena käytetään selaimesi aluetta, jos sitä tuetaan, ja muuten englantia.",
          options: {
            en: "Englanti",
          },
        },
        sectionDisplayCamera: "Kamera ja näkökulma",
        fpsMode: {
          label: "Ensimmäisen persoonan tila",
          description: "Käytä ensimmäisen persoonan ohjausta ja hiirikatselua.",
        },
        fpsFlattenEntityBillboards: {
          label: "Litistä päällekkäiset ruutuspritit",
          description:
            "Litistä saaliin tai luolaston kohteiden ruutuspritit, kun niiden päällä seisoo hirviö, lemmikki tai pelaaja. Poista käytöstä pitääksesi päällekkäiset spritet pystyssä olevina billboardeina. Vulture-ruudut pysyvät aina pystyssä.",
        },
        fpsHeldWeaponVisible: {
          label: "Näytä FPS-ase",
          description: "Näyttää kädessä pidetyn aseen spriten ensimmäisen persoonan tilassa.",
        },
        showItemsUnderPlayerInOverheadTilesMode: {
          label: "Näytä pelaajan alla olevat esineet yläkuvaruuduissa",
          description:
            "Näytä pelaajan alla olevat esineet ja lattiaominaisuudet yläkuvaruututilassa ajonaikaisella aluskarttadatalla.",
        },
        fpsFov: {
          label: "FPS-näkökenttä",
          description: "Säädä ensimmäisen persoonan kameran näkökenttää.",
        },
        sectionDisplayGraphics: "Grafiikka ja renderöinti",
        tilesetMode: {
          label: "Näyttö",
          description: "Käytä graafisia ruutuja ASCII:n sijaan.",
          options: {
            ascii: "ASCII-grafiikka",
            tiles: "Ruudut",
          },
        },
        tilesetPath: {
          label: "Ruutusetti",
          description: "Sisäänrakennetut ja ladatut ruutusetit.",
        },
        antialiasing: {
          label: "Reunojen pehmennys",
          description: "3D-renderöinnin reunojen pehmennystila.",
          options: {
            taa: "TAA-pehmennys",
            fxaa: "FXAA-pehmennys",
          },
        },
        lightingEnabled: {
          label: "Valaistus",
          description:
            "Ota käyttöön dynaaminen kohtausvalaistus ja luolaston tummennus. Poista käytöstä saadaksesi tasaisemman aina valaistun renderöinnin.",
        },
        blockAmbientOcclusion: {
          label: "Ympäristön varjostus",
          description:
            "Lisää hienovaraista kontaktivarjostusta lattia- ja seinälohkojen väliin.",
        },
        brightness: {
          label: "Kirkkaus",
          description: "Säädä koko näkymän kirkkautta.",
        },
        contrast: {
          label: "Kontrasti",
          description: "Säädä renderöidyn näkymän yleistä kontrastia.",
        },
        gamma: {
          label: "Gammasäätö",
          description: "Säädä renderöidyn näkymän näytön gammaa.",
        },
        sectionDisplayInterface: "Käyttöliittymä",
        uiFontScale: {
          label: "Käyttöliittymän fonttikoko",
          description:
            "Skaalaa kaikkien pelin käyttöliittymäfonttien kokoa oletusarvoista.",
        },
        disableAnimatedTransitions: {
          label: "Poista animoidut siirtymät käytöstä",
          description:
            "Poista käyttöliittymän häivytys-, liike- ja siirtymäanimaatiot käytöstä nopeampia muutoksia varten.",
        },
        uiTileBackgroundRemoval: {
          label: "Poista ruutujen taustat käyttöliittymässä",
          description:
            "Käytä ruutu-/kromaattitaustan poistoa käyttöliittymäpaneeleissa näytettäviin ruutukuvakkeisiin.",
        },
        desktopTouchInterfaceMode: {
          label: "Työpöydän kosketuskäyttöliittymä",
          description:
            "Näytä kosketusohjaimet työpöydällä ja valitse pysty- tai vaakasuuntainen asettelu.",
          options: {
            off: "Pois",
            portrait: "Käytä pystysuuntaista kosketuskäyttöliittymää",
            landscape: "Käytä vaakasuuntaista kosketuskäyttöliittymää",
          },
        },
        sectionDisplayMessages: "Viestit ja loki",
        desktopMessageLogWindowScale: {
          label: "Työpöydän viestiloki-ikkunan koko",
          description:
            "Skaalaa kehystetyn työpöydän viestiloki-ikkunan kokoa muuttamatta fonttikokoa.",
        },
        liveMessageLog: {
          label: "Live-viestiloki",
          description: "Näytä vierivä pelinsisäinen viestiloki.",
        },
        showPersistentMobileMessageLog: {
          label: "N\u00e4yt\u00e4 pysyv\u00e4 viestiloki",
          description:
            "Pid\u00e4 kompakti mobiiliviestiloki n\u00e4kyviss\u00e4 pelaamisen aikana. Loki-painike voi silti avata suuremman lokin.",
        },
        rumbleEnabled: {
          label: "Ota varina kayttoon",
          description:
            "Kayta lyhytta haptista varinapalautetta annetusta ja saadusta vahingosta tuetuilla mobiililaitteilla.",
        },
        sectionMobileSafeZone: "Mobiilin turva-alueet",
        manualMobileBottomSafeZoneEnabled: {
          label: "Ohita tunnistetut mobiilin turva-alueet",
          description:
            "K\u00e4yt\u00e4 manuaalisia turva-alueen marginaaleja, kun Android-k\u00e4sikonsolit ilmoittavat turva-alueet v\u00e4\u00e4rin.",
        },
        manualMobileBottomSafeZoneVerticalPx: {
          label: "Pystysuunnan alareunan turva-alue",
          description:
            "Manuaalinen alareunan turva-alue pystysuuntaiselle mobiiliasettelulle.",
        },
        manualMobileBottomSafeZoneHorizontalPx: {
          label: "Vaakasuunnan alareunan turva-alue",
          description:
            "Manuaalinen alareunan turva-alue vaakasuuntaiselle mobiiliasettelulle.",
        },
        manualMobileRightSafeZoneHorizontalPx: {
          label: "Vaakasuunnan oikean reunan turva-alue",
          description:
            "Manuaalinen oikean reunan turva-alue vaakasuuntaiselle mobiiliasettelulle.",
        },
        manualMobileBottomSafeZonePreview: "Alareunan turva-alue",
        manualMobileRightSafeZonePreview: "Oikean reunan turva-alue",
        liveMessageDisplayTimeMs: {
          label: "Live-viestin näyttöaika",
          description:
            "Kuinka kauan kelluva viesti pysyy täysin näkyvänä ennen häivytystä.",
        },
        liveMessageFadeOutTimeMs: {
          label: "Live-viestin häivytysaika",
          description: "Kelluvan viestin häivytysanimaation kesto.",
        },
        liveMessageLogFontScale: {
          label: "Live-viestien fonttikoko",
          description:
            "Skaalaa ylös nousevien kelluvien toimintaviestien kokoa oletusarvosta.",
        },
        sectionDisplayMinimap: "Minikartta",
        minimap: {
          label: "Minikartta",
          description: "Näytä tai piilota luolaston minikartta.",
        },
        minimapScale: {
          label: "Minikartan koko",
          description: "Skaalaa minikartan kokoa oletusarvosta.",
        },
        sectionDisplayInventory: "Tavaroiden esitystapa",
        reduceInventoryMotion: {
          label: "Vähennä tavaroiden liikettä",
          description:
            "Poista animoitu tavararivien laajeneminen ja käytä yksinkertaisempia vuorovaikutuksia.",
        },
        inventoryTileOnlyMotion: {
          label: "Animoi vain tavararuudut",
          description:
            "Animoi kuvakeruudut pitäen tavararivien korkeus ja välistys kiinteinä.",
        },
        inventoryFixedTileSize: {
          label: "Kiinteä tavararuudun koko",
          description:
            "Koskee vain, kun tavaroiden liikkeen vähennys on käytössä. Valitse kiinteä kuvakkeen koko.",
          options: {
            none: "Ei mitään",
            small: "Pieni",
            medium: "Keskikokoinen",
            large: "Suuri",
          },
        },
        groupSound: "Ääni",
        soundEnabled: {
          label: "Ota ääni käyttöön",
          description:
            "Ota FMOD-ääni käyttöön tai pois käytöstä. Poistaminen vähentää äänenkäsittelyn kuormaa heikommilla laitteilla.",
        },
        groupMobileControls: "Mobiiliohjaimet",
        invertTouchPanningDirection: {
          label: "Käännä panoroinnin suunta",
          description: "Käännä panoroinnin vetosuunta sen jälkeen, kun pidä ja panoroi alkaa.",
        },
        groupCombat: "Taistelupalaute",
        damageNumbers: {
          label: "Vahinkoluvut",
          description: "Näytä kelluvat vahinko- ja parannusluvut.",
        },
        displayStatChangesAbovePlayer: {
          label: "Näytä ominaisuusmuutokset pelaajan yläpuolella",
          description:
            "Näytä kelluvat merkinnät ominaisuusmuutoksille, kuten Voima ja AC.",
        },
        displayXpGainsAbovePlayer: {
          label: "Näytä XP-nousut pelaajan yläpuolella",
          description:
            "Näytä kelluvat XP-lisäysmerkinnät kokemuksen kasvaessa.",
        },
        tileShakeOnHit: {
          label: "Ruudun tärähdys osumasta",
          description: "Täräytä osumaruutuja, kun isku osuu.",
        },
        blood: {
          label: "Veri",
          description: "Renderöi verisumutyyppiset hiukkastehosteet osumissa.",
        },
        bloodMist: {
          label: "Verisumu",
          description:
            "Renderöi ilmassa leijuvat verisumuhitukkaset osumissa.",
        },
        bloodGround: {
          label: "Veriroiskeet",
          description:
            "Renderöi veriroiskeet luolaston lattialle osumien jälkeen.",
        },
        bloodDetail: {
          options: {
            veryLow: "Erittäin matala",
          },
        },
        monsterShatter: {
          label: "Hirviön pirstoutuminen",
          description:
            "Jaa kukistetut hirviöbillboardit fyysisiksi sirpaleiksi.",
        },
        monsterShatterBloodBorders: {
          label: "Pirstaleiden verireunat",
          description:
            "Sävytä sirpaleiden pikseleitä jakoviivojen läheltä satunnaisilla verenpunaisilla reunoilla.",
        },
        groupCompatibility: "Ajonaikainen yhteensopivuus",
        darkCorridorWalls367: {
          label: "Perinteiset tummat käytäväseinät",
          description:
            "Päättele ja välimuistita tummien käytäväseinien ruudut vanhoille NetHack 3.4.3/3.6.x -ajoalustoille, mukaan lukien Slash'EM.",
        },
        overrideNh5DarkCorridorWallTiles: {
          label: "Ohita NetHack 5.0:n tummat seinäruudut",
          description:
            "Käytä tumman seinän ohitusasetuksia NetHack 5.0:n tummiin käytäväseinän ruutuihin.",
        },
        darkCorridorWallTileOverrideEnabled: {
          label: "Ohita tumma seinäruutu",
          description:
            "Käytä mukautettua atlasruutua tummien seinien ohituksiin, tallennettuna ruutusetin mukaan.",
        },
        darkCorridorWallSolidColorOverrideEnabled: {
          label: "Käytä tummin seinin yksiväriä",
          description: "Käytä valittua RGB-väriä ruutusetin ruudun sijaan.",
        },
      },
      tabs: {
        display: {
          label: "Näyttö",
          description: "Käyttöliittymä- ja näyttöasetukset.",
        },
        mobile: {
          label: "Mobiili",
          description:
            "Mobiilikohtaiset käyttöliittymän ja pelaamisen asetukset.",
        },
        controls: {
          label: "Ohjaimet",
          description: "Ohjainsidonnat, FPS-tila ja katselun toiminta.",
        },
        sound: {
          label: "Ääni",
          description: "Äänentoisto ja suorituskykyyn liittyvät ääniasetukset.",
        },
        combat: {
          label: "Taistelu",
          description: "Taistelun osumapalaute ja visuaaliset reaktiot.",
        },
        compatibility: {
          label: "Yhteensopivuus",
          description: "Ajonaikainen yhteensopivuus ja NetHack-käytöksen valinnat.",
        },
        updates: {
          label: "Päivitykset",
          description:
            "Tarkista pelin verkkopäivitykset ja tarkastele odottavia muutoksia.",
        },
      },
    },
    update: {
      loading: {
        startupData: "Ladataan käynnistystietoja...",
        tileset: "Ladataan ruutusettiä...",
        runtime: "Käynnistetään paikallista runtimea...",
      },
      runtimeStoppedBeforeStartup:
        "Paikallinen NetHack-runtime pysähtyi ennen käynnistyksen valmistumista.",
      preparingDownload: "Valmistellaan pelipäivityksen latausta...",
      idleStatus: "Päivityksen tila on joutokäynnillä.",
      fileProgress: (index: number, count: number) =>
        `File ${index} of ${count}`,
      unexpectedCheckFailure: "Odottamaton virhe päivityksen tarkistuksessa.",
      cancelRequested: "Peruutusta pyydetty.",
      stoppingActiveDownloadTask: "Pysäytetään aktiivista lataustehtävää.",
      unableToCancelDownload: "Päivityslatausta ei voitu peruuttaa.",
      noActiveDownloadToCancel: "Ei aktiivista päivityslatausta peruutettavaksi.",
      startingDownload: "Aloitetaan pelipäivityksen lataus.",
      canceled: "Päivityslataus peruutettiin.",
      unableToDownloadAndApply: "Päivityksiä ei voitu ladata ja ottaa käyttöön.",
      failed: "Päivitys epäonnistui.",
      latestAlreadyInstalled: "Uusin päivitys on jo asennettu.",
      downloadComplete: "Päivityslataus valmis.",
      nothingAppliedTryAgain:
        "Päivityksiä ei otettu käyttöön. Yritä tarkistaa uudelleen.",
      noFilesApplied: "Päivitystiedostoja ei otettu käyttöön.",
      unexpectedFailure: "Odottamaton päivitysvirhe.",
      checkingForUpdates: "Tarkistetaan GitHub-julkaisuja...",
      unsupportedPlatform:
        "GitHub-julkaisujen tarkistus ei ole saatavilla tällä alustalla.",
      latestAlreadyInstalledOptions: "Sinulla on jo pelin uusin versio.",
      oneUpdateAvailable:
        "Uudempi peliversio on saatavilla. Haluatko päivittää?",
      manyUpdatesAvailable: (count: number) =>
        `${count} uudempaa peliversiota on saatavilla. Haluatko päivittää?`,
      updateCheckFailed: (message: string) =>
        `GitHub-julkaisujen tarkistus epäonnistui: ${message}`,
    },
    saves: {
      sections: {
        manual: "Manuaaliset tallennukset",
        autosave: "Automaattitallennukset",
      },
      deleteTitle: "Poistetaanko tallennettu peli?",
      deleteMessage: (name: string) =>
        `Are you sure you want to delete ${name}?`,
      overwriteTitle: "Korvataanko tallennettu peli?",
      overwriteMessage: (name: string) =>
        `A saved game named "${name}" already exists. Do you want to overwrite it with a new character?`,
      errorLoading: "Virhe tallennusten lataamisessa",
      loading: "Ladataan tallennuksia...",
      noneFound: "Tallennettuja pelejä ei löytynyt.",
      savedAt: (date: string) => `Saved: ${date}`,
    },
    tilesets: {
      userTileset: "Käyttäjän ruutusetti",
      currentSelectionFallback: "tämä ruutusetti",
      deleteUploadedTitle: "Poistetaanko ladattu ruutusetti?",
      deleteUploadedMessage: (label: string) =>
        `Delete '${label}' from uploaded tilesets?`,
      failedToDelete: "Ruutusetin poistaminen epäonnistui.",
      chooseFile: "Valitse PNG/BMP/GIF/JPEG-ruutusetin tiedosto.",
      provideName: "Anna tälle ruutusetille nimi.",
      failedToSave: "Ruutusetin tallentaminen epäonnistui.",
      failedToLoadUploaded: "Ladattujen ruutusettien lataaminen epäonnistui:",
      userTilesetSuffix: "Käyttäjän ruutusetti (käyttäjä)",
      noTilesetsFound: "Ruutusettejä ei löytynyt",
      failedToReadImage: "Ruutusetin kuvan lukeminen epäonnistui.",
    },
    tilePicker: {
      noAtlasAvailable: "Ruutusetin atlasta ei ole saatavilla.",
      unableToLoadAtlas: "Ruutuatlasta ei voitu ladata.",
      atlasLoaded: "Ruutuatlas ladattu.",
      loadingAtlas: "Ladataan ruutuatlasta...",
      selectedTile: (tileId: number) => `Selected: tile #${tileId}`,
      glyph: (label: string) => `Glyph ${label}`,
      tile: (tileId: number) => `Tile ${tileId}`,
      defaultBadge: "Oletus",
      resetToDefault: "Palauta oletus",
      darkWallTitle: "Tumman seinäruudun valitsin",
      closeDarkWall: "Sulje tumman seinäruudun valitsin",
      closeBackground: "Sulje ruutusetin taustaruudun valitsin",
      backgroundHelper:
        "Käytetään poistamaan jaettu ruutusetin tausta hirviö-/saalisbillboardeista.",
      backgroundTitle: "Ruutusetin taustaruudun valitsin",
      backgroundTitleWithLabel: (label: string) =>
        `Tileset Background Tile Picker: ${label}`,
      closeSolidColor: "Sulje yksivärisen kroma-avaimen värivalitsin",
      solidColorTitle: "Yksivärisen kroma-avaimen valitsin",
      solidColorTitleWithLabel: (label: string) =>
        `Solid Color Chroma Key Picker: ${label}`,
    },
    soundPack: {
      discardChangesTitle: "Hylätäänkö äänipaketin muutokset?",
      discardChangesMessage:
        "Hylätäänkö tallentamattomat äänipaketin muutokset ja jatketaan?",
      discard: "Hylkää",
      keepEditing: "Jatka muokkausta",
      failedToLoadIndexedDb: "Äänipakettien lataaminen IndexedDB:stä epäonnistui.",
      failedToSelectRequested: "Pyydettyä äänipakettia ei voitu valita.",
      provideName: "Anna äänipaketille nimi.",
      created: (name: string) => `Created sound pack '${name}'.`,
      failedToCreate: "Äänipaketin luonti epäonnistui.",
      saved: (name: string) => `Saved sound pack '${name}'.`,
      failedToSave: "Äänipaketin tallennus epäonnistui.",
      failedToExportZip: "Äänipaketin ZIP-vienti epäonnistui.",
      exported: (name: string) => `Exported '${name}'.`,
      failedToImportZip: "Äänipaketin ZIP-tuonti epäonnistui.",
      imported: (name: string) => `Imported sound pack '${name}'.`,
      deleteTitle: "Poistetaanko äänipaketti?",
      deleteMessage: (name: string) =>
        `Delete sound pack '${name}'? This cannot be undone.`,
      deleted: (name: string) => `Deleted sound pack '${name}'.`,
      failedToDelete: "Äänipaketin poistaminen epäonnistui.",
      noPreviewSource: "Tälle äänelle ei ole esikatselulähdettä.",
      unableToPreview: "Tämän äänen esikatselu ei onnistu.",
      title: "Äänipaketit",
      activePack: "Aktiivinen äänipaketti",
      activePackDescription:
        "Valitse aktiivinen äänipaketti, jota käytetään äänipolkujen ratkaisuun.",
      createNew: "Luo uusi äänipaketti",
      createDescription: "Luo mukautettu äänipaketti, joka ohittaa oletukset.",
      createNameLabel: "Uuden äänipaketin nimi",
      createPlaceholder: "Oma äänipakettini",
      createAndSave: "Luo ja tallenna",
      packName: "Paketin nimi",
      packNameDescription:
        "Nimeä tämä paketti uudelleen ja tallenna päivittääksesi sen äänitiedostojen nimiavaruuden.",
      savePack: "Tallenna äänipaketti",
      export: "Vie äänipaketti",
      import: "Tuo äänipaketti",
      deletePack: "Poista äänipaketti",
      stopPreview: "Pysäytä esikatselu",
      loading: "Ladataan äänipaketteja...",
      pendingSaveSuffix: " (odottaa tallennusta)",
      defaultSuffix: " (oletus)",
      customSuffix: " (mukautettu)",
      noBundledSound: "Ei mukana tulevaa ääntä",
      enableSoundAria: (label: string) => `Enable ${label}`,
      volumeAria: (label: string) => `Volume for ${label}`,
      play: "Toista",
      playing: "Toistetaan...",
      volume: "Äänenvoimakkuus",
      remove: "Poista",
      replace: "Korvaa",
      soundFile: "Äänitiedosto",
      reset: "Palauta",
      attribution: "Lähdemerkintä",
      attributionAria: (label: string) => `Attribution for ${label}`,
      attributionPlaceholder: "Lähde, tekijä tai lisenssitiedot",
      addVariation: "+ Lisää variaatio",
    },
    dialogs: {
      pauseMenu: {
        saveBeforeQuit: "Haluatko tallentaa ennen lopettamista?",
        title: "Peli tauolla",
        resume: "Jatka",
        options: "Asetukset",
        saveGame: "Tallenna peli",
        exitToMainMenu: "Palaa päävalikkoon",
        quitGame: "Lopeta peli",
      },
      debugLogs: {
        closeLabel: "Sulje debug-lokit",
        title: "Tallennetut debug-lokit",
        hint: "Lokeja tallennetaan vasta, kun piilotettu debug-lokikytkin on otettu käyttöön.",
        showingEntries: (count: number, startedAt: string) =>
          `Showing ${count} entries from ${startedAt}.`,
        noneSaved: "Tallennettuja debug-lokeja ei vielä ole.",
        refresh: "Päivitä",
        clearLogs: "Tyhjennä lokit",
      },
      startupUpdate: {
        maintenanceNotice: "Uudempia GitHub-julkaisuja ei löytynyt.",
        summaryAvailable:
          "Uudempi peliversio on saatavilla. Haluatko päivittää?",
        summaryNone: "Sinulla on jo pelin uusin versio.",
        currentVersion: (version: string) => `Nykyinen versio: ${version}`,
        latestVersion: (version: string) =>
          `Uusin GitHub-julkaisu: ${version}`,
        disableAtStartup:
          "Älä näytä näitä ilmoituksia enää käynnistyksessä.",
        disabledNotice:
          "Käynnistyksen julkaisu-ilmoitukset on nyt poistettu käytöstä. Voit ottaa ne uudelleen käyttöön asetuksissa.",
        clientUpgradeRequired:
          "Uusimpien alustaparannusten käyttö vaatii myös täyden asiakasohjelman päivityksen.",
        progressTitle: "Päivityslatauksen tila",
        canceling: "Peruutetaan päivityslatausta...",
        noActiveTransfer: "Ei aktiivista tiedostosiirtoa.",
        waitingForUpdater: "Odotetaan päivittäjän toimintaa.",
        pendingUpdates: "Odottavat päivitykset",
        payloadAvailable: "Päivityspaketti on saatavilla.",
        downloadUpdates: "Lataa päivitykset",
        hideDetails: "Piilota tiedot",
        moreDetails: "Lisää tietoja",
        cancelDownload: "Peruuta lataus",
      },
      startup: {
        chooseVariant: "Valitse NetHack-variaatiosi:",
        options: "NetHack 3D -asetukset",
        quitGame: "Lopeta peli",
        chooseSetup: "Valitse hahmosi asetukset:",
        randomCharacter: "Satunnainen hahmo",
        createCharacter: "Luo hahmo",
        loadGame: "Lataa peli",
        selectSavedGame: "Valitse tallennettu peli:",
        enterRandomName: "Anna nimi satunnaiselle hahmollesi:",
        createCharacterPrompt: "Luo hahmosi:",
        name: "Nimi",
        role: "Rooli",
        race: "Rotu",
        gender: "Sukupuoli",
        alignment: "Suuntaus",
        startGame: "Aloita peli",
      },
      clientOptions: {
        closeLabel: "Sulje NetHack 3D -asetukset",
        title: "NetHack 3D:n asiakasasetukset",
        categoriesLabel: "Asetusluokat",
        updates: {
          checkOnLaunchLabel:
            "Näytä GitHub-julkaisu-ilmoitukset käynnistyksessä",
          checkOnLaunchDescription:
            "Tarkistaa GitHub-julkaisut käynnistyksessä ja ilmoittaa, jos uudempi versio on saatavilla.",
          title: "GitHub-julkaisut",
          description:
            "Vertaa tätä buildia julkaistuihin GitHub-julkaisuihin.",
          idle:
            "Paina Tarkista päivitykset vertaillaksesi tätä buildia GitHub-julkaisuihin.",
          button: "Tarkista päivitykset",
          openGitHubReleases: "Avaa GitHub-julkaisut",
        },
        buttons: {
          manageTileSets: "Hallitse ruutusettejä",
          remapController: "Määritä ohjain uudelleen",
          resetControllerDefaults: "Palauta ohjaimen oletukset",
        },
        hints: {
          darkWallsAlwaysEnabled:
            " Aina käytössä, kun Vulture-ruudut ovat aktiivisia.",
          darkWallsDisabledByVulture:
            " Pois käytöstä, kun Vulture-ruudut ovat aktiivisia.",
          enableDarkWallsFirst:
            " Ota ensin käyttöön perinteiset tummat käytäväseinät tai NetHack 5.0:n tummien seinien ohitukset.",
          enableFpsFirst: " Ota ensin käyttöön ensimmäisen persoonan tila Näyttö-osiossa.",
        },
        darkWallControls: {
          normal: "Normaalitila",
          fps: "FPS-tila",
          normalAria: "Tumman seinän yksiväri (normaalitila)",
          fpsAria: "Tumman seinän yksiväri (FPS-tila)",
          gridLines: "Ruudukkoviivat",
          intensity: "Voimakkuus",
        },
        controllerRemap: {
          title: "Ohjaimen uudelleensidonta",
          closeLabel: "Sulje ohjaimen uudelleensidonta",
          hint: "Valitse paikka ja paina sitten nappia tai liikuta sauvaa. Jokaisella toiminnolla on kaksi paikkaa.",
          listeningFor: (label: string, slot: number) =>
            `Listening for ${label} (slot ${slot}). Press ESC to cancel.`,
        },
        resetPrompt:
          "Palautetaanko NetHack 3D:n asetukset oletuksiin? Mukautetut ruutusetit säilyvät.",
      },
      tilesetManager: {
        closeLabel: "Sulje ruutusetinhallinta",
        title: "Hallitse ruutusettejä",
        description:
          "Lisää ruutusettejä ja muokkaa ruutusetti-kohtaisia tausta-/kroma-asetuksia.",
        createTitle: "Luo uusi ruutusetti",
        editTitle: "Muokkaa ruutusettiä",
        editTitleWithName: (label: string) => `Edit Tile Set: ${label}`,
        tileSetName: "Ruutusetin nimi",
        tileSetPlaceholder: "Oma ruutusetti",
        builtInNamesLocked: "Sisäänrakennettujen ruutusettien nimiä ei voi muuttaa.",
        tileLayoutVersion: "Ruutuasettelun versio",
        layout367: "NetHack 3.6.7 -asettelu",
        layout5: "NetHack 5.0 -asettelu",
        tileLayoutDescription:
          "Valitse tämän ladatun atlaksen käyttämä ruutuindeksien asettelu.",
        tileImage: "Ruutusetin kuva",
        tileImageOptional: "Ruutusetin kuva (valinnainen korvaus)",
        selectedFile: (fileName: string) => `Selected: ${fileName}`,
        currentFile: (fileName: string) => `Current: ${fileName}`,
        uploadedImage: "ladattu kuva",
        backgroundRemovalDescription:
          "Määritä tämän ruutusetin billboard-taustan poisto tai jätä molemmat tilat pois päältä pitääksesi atlaksen taustat ennallaan.",
        backgroundTileRemoval: "Taustaruudun poisto",
        backgroundTileRemovalDescription:
          "Käytä valittua atlasruutua billboard-taustan poistoon.",
        solidChromaKey: "Yksivärinen kroma-avain",
        solidChromaKeyDescription:
          "Käytä yhtä yhtenäistä RGB-väriä billboard-taustan poistoon.",
        clickToPickFromAtlas: "napsauta valitaksesi atlaksesta",
        saveFirstThenEdit:
          "Tallenna uusi ruutusetti ensin ja muokkaa sitten tausta-/kroma-asetuksia.",
        createTileSet: "Luo ruutusetti",
        saveTileSet: "Tallenna ruutusetti",
        saveTileSettings: "Tallenna ruutuasetukset",
        importNewTileSet: "+ Tuo uusi ruutusetti",
        noUploadedTilesets: "Ladattuja ruutusettejä ei ole saatavilla.",
        selectedSuffix: " (valittu)",
        editingSuffix: " (muokataan)",
        uploadedDetails: (fileName: string, layout: string) =>
          `${fileName} | uploaded | layout ${layout}`,
        builtInDetails: (path: string) => `${path} | built-in`,
      },
      textInput: {
        cancelLabel: "Peruuta tekstinsyöttö",
        placeholder: "Syötä teksti",
        ok: "Hyväksy",
      },
      question: {
        cancelPrompt: "Peruuta kehote",
        selectAll: "Valitse kaikki",
        deselectAll: "Poista kaikkien valinta",
        page: (current: number, total: number) => `Page ${current} / ${total}`,
        pageHintMultiple: "Käytä < ja > vaihtaaksesi sivua. Paina ESC peruuttaaksesi",
        pageHintSingle: "Paina ESC peruuttaaksesi",
        choices: {
          leftRingFinger: "Vasen nimetön",
          rightRingFinger: "Oikea nimetön",
          here: "Tässä",
          onGround: "Maassa",
          eligibleItems: "Kelvolliset esineet",
          allInventory: "Koko inventaario",
        },
      },
      runtimeStartError: {
        closeLabel: "Palaa päävalikkoon",
        title: "NetHackin alustaminen epäonnistui.",
        returnToMainMenu: "Palaa päävalikkoon",
      },
      newGamePrompt: {
        closeLabel: "Sulje uuden pelin kehote",
        title: "Palataanko päävalikkoon?",
        reasonFallback: "Peli ohi",
      },
      direction: {
        cancelLabel: "Peruuta suuntakehote",
      },
      info: {
        closeCharacter: "Sulje hahmoikkuna",
        closeInformation: "Sulje tietoikkuna",
        characterTitle: "Hahmo",
        experienceProgress: "Kokemuksen edistyminen",
        levelLabel: (level: number) => `Level ${level}`,
        xpAtMaxLevel: (xp: string) => `XP ${xp} (max level reached)`,
        xpToNextLevel: (xp: string, next: string, remaining: string) =>
          `XP ${xp} / ${next} • ${remaining} to next level`,
        vitals: "Perustiedot",
        characteristics: "Ominaisuudet",
        currentLimit: "Nykyinen / Raja",
        armorClass: "Panssariluokka",
        currentStatus: "Nykyinen tila",
        noActiveStatus: "Ei aktiivisia tiloja.",
        currentAttributes: "Nykyiset attribuutit",
        noTemporaryAttributes: "Ei tilapäisiä attribuuttivaikutuksia.",
        characterActions: "Hahmon toiminnot",
        inventory: "Tavarat",
        inventoryDetail: "Avaa kannetut esineet",
        closeHint:
          "Sulje painamalla VÄLILYÖNTIÄ, ENTERIÄ tai ESCIÄ. Avaa uudelleen painamalla Ctrl+M.",
        infoTitleFallback: "NetHack-tiedot",
        noDetails: "(Ei tietoja)",
      },
      inventory: {
        closeLabel: "Sulje tavarat",
        title: "TAVARAT",
        empty: "Tavarasi ovat tyhjät.",
        unknownItem: "Tuntematon esine",
        closeHint: "Sulje painamalla ENTERIÄ, ESCIÄ tai 'i'.",
        closeHintWithContext:
          "Valitse esine avataksesi kontekstikomennot. Sulje painamalla ENTERIÄ, ESCIÄ tai 'i'",
      },
      inventoryDropMenu: {
        title: "Pudota",
        dropType: "Pudotustapa",
        dropAmount: "Pudotusmäärä",
        dropSpecificAmount: "Pudota tietty määrä",
        onlyStackedItems: "Saatavilla vain pinotuille esineille",
      },
      inventoryDropCount: {
        title: "Kuinka monta tästä pinosta pudotetaan?",
        chooseAmount: (max: number) => `Choose an amount from 1 to ${max}.`,
        ariaLabel: "Pudotusmäärä",
        setMinimum: "Aseta pudotusmäärä minimiin",
        decrease: "Vähennä pudotusmäärää yhdellä",
        increase: "Kasvata pudotusmäärää yhdellä",
        setMaximum: "Aseta pudotusmäärä maksimiin",
      },
      mobileActions: {
        extendedCommands: "Laajennetut komennot",
        commonCommands: "Yleiset komennot",
        allCommands: "Kaikki komennot",
        actions: "Toiminnot",
        menu: "Valikko",
        close: "Sulje",
        wizardCommands: "Wizard-komennot",
        wizard: "Wizard-tila",
        wizardCommandFallbackDescription:
          "Suorita t\u00e4m\u00e4 vain wizard-tilan debug-komento.",
        wizardCommandDetails: {
          levelchange: { name: "Muuta tasoa", description: "Aseta sankarin kokemustaso." },
          lightsources: { name: "Valonl\u00e4hteet", description: "N\u00e4yt\u00e4 liikkuvat valonl\u00e4hteet." },
          migratemons: { name: "Vaeltavat hirvi\u00f6t", description: "N\u00e4yt\u00e4 tasojen v\u00e4lill\u00e4 liikkuvat hirvi\u00f6t." },
          panic: { name: "Paniikkitesti", description: "Testaa paniikkik\u00e4sittely ja p\u00e4\u00e4t\u00e4 peli." },
          polyself: { name: "Polymorfoi itse", description: "Vaihda sankarin nykyist\u00e4 muotoa." },
          seenv: { name: "N\u00e4hdyt vektorit", description: "N\u00e4yt\u00e4 n\u00e4k\u00f6vektorien debug-kartta." },
          stats: { name: "Muistitilastot", description: "N\u00e4yt\u00e4 ajonaikaiset muistitilastot." },
          timeout: { name: "Aikakatkaisujono", description: "N\u00e4yt\u00e4 ajastetut vaikutukset ja intrinsics." },
          vanquished: { name: "Kukistetut hirvi\u00f6t", description: "N\u00e4yt\u00e4 kuolleiden hirvi\u00f6iden m\u00e4\u00e4r\u00e4t." },
          vision: { name: "N\u00e4k\u00f6taulukko", description: "N\u00e4yt\u00e4 nykyinen n\u00e4k\u00f6taulukko." },
          wizbury: { name: "Hautaa l\u00e4hiesineet", description: "Hautaa lattiaesineet 3x3-alueella." },
          wizdetect: { name: "Havaitse piilotetut", description: "Paljasta piilotetut asiat sankarin l\u00e4helt\u00e4." },
          wizgenesis: { name: "Luo hirvi\u00f6", description: "Luo hirvi\u00f6 nimell\u00e4 tai luokalla." },
          wizidentify: { name: "Tunnista tavarat", description: "Tunnista kaikki inventaarion esineet." },
          wizintrinsic: { name: "Aseta intrinsics", description: "S\u00e4\u00e4d\u00e4 valittuja ajastettuja intrinsics-arvoja." },
          wizlevelport: { name: "Tasoteleportti", description: "Teleporttaa toiselle tasolle tai haaraan." },
          wizmakemap: { name: "Luo taso uudelleen", description: "Generoi nykyinen taso uudelleen." },
          wizmap: { name: "Kartoita taso", description: "Paljasta tason kartta ja ansat." },
          wizrumorcheck: { name: "Tarkista huhut", description: "Vahvista tosi- ja ep\u00e4tosihuhujen tiedostot." },
          wizsmell: { name: "Haista hirvi\u00f6", description: "Haista valittu hirvi\u00f6." },
          wizwhere: { name: "Erikoistasot", description: "N\u00e4yt\u00e4 erikoistasojen sijainnit." },
          wizwish: { name: "Toive", description: "Luo esine, ansa tai maastoa." },
          wmode: { name: "Sein\u00e4tilat", description: "N\u00e4yt\u00e4 sein\u00e4tilojen debug-tiedot." },
        },
        repeat: "Toista",
        character: "Hahmo",
        inventory: "Tavarat",
        log: "Loki",
        pickUp: "Poimi",
        search: "Etsi",
        closeMessageLog: "Sulje viestiloki",
      },
      positionPrompt: {
        closeLabel: "Sulje sijaintikehote",
        desktopHint:
          "Käytä liikesyötettä tai napsauta ruutua siirtääksesi valintaa. Vahvista napsauttamalla valittua ruutua uudelleen tai painamalla Enteriä.",
        mobileHint:
          "Käytä liikesyötettä tai napauta ruutua siirtääksesi valintaa. Vahvista napauttamalla valittua ruutua uudelleen tai painamalla Enteriä.",
        controllerHint:
          "Käytä liikesyötettä siirtääksesi valintaa. Vahvista painamalla Enteriä tai Vahvista-painiketta.",
      },
      controllerSupport: {
        prompt: "Ohjain havaittu. Otetaanko ohjaintuki käyttöön?",
      },
    },
  },
};

export const fi = mergeTranslations(en, fiOverrides);
