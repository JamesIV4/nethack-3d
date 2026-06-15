[33mcommit 13e4384e783520744302433a8ea6990e120c2ed6[m[33m ([m[1;36mHEAD -> [m[1;32mevilhack_wasm_spoofing[m[33m)[m
Author: Ryton <joachim.verhelst@gmail.com>
Date:   Thu Apr 16 01:03:21 2026 +0200

    a WORKING?? version of the build script, that finally produces linked .js and wasm files. unfort still too small to be viable, but its a start! Next step: testing and building and the

[33mcommit 7ddf7b4d1139a596cc7a1534d659695a3ef293cb[m
Author: FM-JVH <JVH@FM.be>
Date:   Wed Apr 15 21:19:03 2026 +0200

    added graphics shim for evilhack wasm build

[33mcommit 855d262f49dcb6554dcde0431775aba5c96221d9[m
Author: FM-JVH <JVH@FM.be>
Date:   Wed Apr 15 21:12:45 2026 +0200

    mapping of exorted functions

[33mcommit 65cde245802c34a4db6b77ed997f6f0256b38fd3[m
Author: FM-JVH <JVH@FM.be>
Date:   Wed Apr 15 21:10:05 2026 +0200

    apping

[33mcommit c30cc628e63f9bf7b0f4922e22d35cb5f98a81ff[m
Author: FM-JVH <JVH@FM.be>
Date:   Wed Apr 15 20:00:45 2026 +0200

    soem ./sys/unix hacks

[33mcommit e4aa872ee8bca459ea86ef781d8914ac4bd47ff4[m
Author: FM-JVH <JVH@FM.be>
Date:   Mon Apr 13 21:14:23 2026 +0200

    and ofc i forgot the relevant files :D
    
    NOT functional yet tho. WORK IN PROGRESS!
    
    Based on build.wasm.sh from JamesV4 's SLASHEM wasm implementation.
    almost functional (i think),
    
    Still, i get compile errors wrt MAGICAL_CHEST
    >../util/lev_comp bigroom.des
    ../util/lev_comp castle.des
    castle.des: line 59, pos 0: syntax error at "MAGIC_CHEST"
    
    The normal evilhack i can compile without problems!

[33mcommit 1d23d041bc752564fffc05bc4b76c4e642c83fa4[m
Author: FM-JVH <JVH@FM.be>
Date:   Mon Apr 13 21:08:39 2026 +0200

    Progress, but not there yet.
    
    updating build "./build.wasm.sh", still MAGIC CHEST ERROR...

[33mcommit e91fd39e00437610e6fd1d0992c8c27f614f87ba[m[33m ([m[1;32mmain[m[33m)[m
Author: FM-JVH <JVH@FM.be>
Date:   Fri Apr 10 15:30:07 2026 +0200

    Progress. Character creation works.
    New flags for Evilhack + better regex of (new) character roles
    
     Next step, fix  "this.nethackInstance.cwrap is not a function." (after character generation, before evilhack loading)

[33mcommit a9a44020d94e7f5464a9b53c19d9e4e35b6704c6[m
Author: FM-JVH <JVH@FM.be>
Date:   Fri Apr 10 14:54:29 2026 +0200

    main updates to integrate evilhack into the menu and the workflow (excluding evilhack specific settings, see next.

[33mcommit e9341ddfcea4ec1799fe689df2d56a28d4485cec[m
Author: FM-JVH <JVH@FM.be>
Date:   Fri Apr 10 14:25:59 2026 +0200

    attempt to include Evilhack to the list of options. Just built and compiled evilhack for now (using vibecoding), integration pending!
    
    the NH_NEW_VERSION_INTEGRATION.md describes the process (so far).
    
    Ps: I hope i did not violate any attribution rules. Code and bitmap from https://github.com/k21971/EvilHack/

[33mcommit 248df21991f2ab1aa6f6c78f9c6c59acd0eea666[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 8 21:01:11 2026 -0400

    Made weapon animations scale on the X axis according to the aspect ratio of the display

[33mcommit 00f34522ac04bb62f2953587d1a98f3275a9d782[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 8 20:54:09 2026 -0400

    Fixes for Electron save detection issue

[33mcommit c6304ce8884ee56402b0acf5a5e144859f8c3894[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 8 19:26:00 2026 -0400

    Upped version

[33mcommit 0e32f423012a639ded3d04627bf965acfd282297[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 8 19:22:58 2026 -0400

    Added a "first message" button to balance out the NetHack Message UI

[33mcommit a424655f94c51dc108020e7f63e72d121ab92508[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 8 19:20:18 2026 -0400

    Added patch notes display for pending updated in the More Details patch section

[33mcommit 076f0ce5e7181184bb6eaf3c54211921d92872c6[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 8 18:25:43 2026 -0400

    Added more default tileset entries for FPS weapon orientations

[33mcommit c7fb06039ff19d1f21b8537856c48c6f2ec14d93[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 8 15:03:06 2026 -0400

    Show weapon immediately when game starts by auto-checking inventory once

[33mcommit d4c283a71771997d10cef95b1ddf96420ac200f0[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 8 14:37:31 2026 -0400

    New animation defaults

[33mcommit cd37eadab8c8c0b2b5ba767bec3043b50bb47971[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 8 13:10:16 2026 -0400

    Added option to show or hide the FPS weapon

[33mcommit 030d0fbff6b40b3efc3668f93e462a34466fb930[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 8 10:44:36 2026 -0400

    Updated the weapon animation again

[33mcommit f55a2e4310002ed0a4c20272be6195ba8a8db5df[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 8 10:40:34 2026 -0400

    Added animation debug system and updated the FPS weapon animation

[33mcommit b7cf74aba637e6cf42dd34428b0edf72745bc717[m
Merge: fa1cec1 a32ae01
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Apr 7 21:34:04 2026 -0400

    Merge branch 'develop' of github.com:JamesIV4/nethack-3d

[33mcommit fa1cec1b626791d660956595dfe6edb3cc9ed723[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Apr 7 21:33:52 2026 -0400

    Upped version

[33mcommit a32ae013f0f3b604d17a5f4d99cfb61544b2288b[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Apr 7 21:23:48 2026 -0400

    Added swipe sound when swinging the weapon

[33mcommit 0c0f456b30953a7773c8088484337ab21a241277[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Apr 7 21:18:31 2026 -0400

    Tweak to rotation of swing

[33mcommit 0f96970150753fcd5e89e8a020134681ba86a609[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Apr 7 21:18:06 2026 -0400

    Added FPS attack animation

[33mcommit 34e0ab9942de85cfa5ff42aac82d48771c0bc418[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Apr 7 20:18:18 2026 -0400

    Added weapon sway animation during movement

[33mcommit 5a46f5f61103b682a47fc75d2f77bdd59ecca2dc[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Apr 7 18:57:56 2026 -0400

    Added FPS weapon display

[33mcommit f7c1c715da2d87020804751b095540b8058973cb[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Apr 7 15:20:27 2026 -0400

    Fix for Absurdly Evil tileset showing old defaults if user has played before

[33mcommit ef04fcfab663b55427e87ec539dee3a1306b9a55[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Apr 7 14:53:11 2026 -0400

    Added NetHack Message caching (50 messages back) and fixed broken Info contextual button

[33mcommit 2fe9de22e232640892a2cff93020d8aab2e58147[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Apr 7 14:29:10 2026 -0400

    Fixed mobile controls not working on new look mode interactions

[33mcommit bb03692e1d8d61962e0b09e5459465dde576c1e4[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Apr 7 13:32:26 2026 -0400

    Upped version

[33mcommit 4305d2026371021ec552e5f7d9a6837eae7579fc[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Apr 7 13:30:28 2026 -0400

    Added generated files for deterministic parsing of character classes and races for the NetHack variants

[33mcommit 39573519b01fdb660bd2e6f1d1307c2159f231b0[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Apr 7 12:57:44 2026 -0400

    Cleanup

[33mcommit db5a3547d8b390eada00fb667d578ddc9477e8cd[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Apr 7 12:50:00 2026 -0400

    Fixes for escape look mode handling

[33mcommit 6e75b0b441efd92085dc747ad65c92a3202758b8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Apr 7 12:03:12 2026 -0400

    Cleanup extra logging now that issue is solved with menu focus flow

[33mcommit 7090a3d92eb147e95e319cb1d039aef7e2c671d2[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Apr 7 11:51:39 2026 -0400

    Fixed focus tabbing and controller and arrow keys on throw and similar menus

[33mcommit 4a37f2f9258ce6adfb1f9b0fe66557b81d36cb0e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Apr 7 10:41:24 2026 -0400

    Removed duplicate focus and active styles

[33mcommit 154671f42d489d6ab5fc4dfbcab39a898538e576[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Apr 7 10:19:26 2026 -0400

    Fixed controller FPS mode not showing direction UI

[33mcommit 1123dd6fe79f6a848d0502bcbd82b83fdd606977[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Apr 7 09:36:52 2026 -0400

    Fixed controllers not being able to select up and down and self directions

[33mcommit 8e0ec124123575138d455d66b6e3d8e24f1d22d0[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Apr 7 09:23:11 2026 -0400

    Fixed left stick controller input requiring new input to allow repeated movement

[33mcommit ca98571437a4268ea796d340080787b98155ad0b[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Apr 7 09:11:07 2026 -0400

    Added new selector mode UI to overhead mode as well, and added lerping camera when switching between FPS mode and overhead mode.

[33mcommit 6ad51221c612ea39b30779c164947cdbb57ca11a[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Apr 6 21:30:13 2026 -0400

    Fixed corners and outline

[33mcommit 22cdf3bb8080ac0adf487a6d48cba1edea53514c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Apr 6 21:18:06 2026 -0400

    Fixed Look command flow for this look selection column

[33mcommit 5cc2da492dbae1ea6cc03d969a5a4b3160d94e9d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Apr 6 21:03:33 2026 -0400

    Fixed camera zoom out pitch

[33mcommit cc74343ecb8581aa1b4d4baceac66b602982d9a7[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Apr 6 21:01:03 2026 -0400

    Fixed Name and Call for activating position input mode

[33mcommit a0d38483ec1371ab57d41d77d6ca5d257b361fff[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Apr 6 19:47:55 2026 -0400

    Final fixes for the camera transition out of the far look FPS tile selection mode

[33mcommit eb4f5e0d4d767a39381df1a113d2e09682e46d8c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Apr 6 18:30:15 2026 -0400

    Fixes for FPS far look column

[33mcommit a71fc06ba86341a08fc7b537492cde39836aeead[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Apr 6 18:07:11 2026 -0400

    Fixed player not rendering in third person view (far look mode) and FPS crosshair still showing in this mode when it shouldn't

[33mcommit e02294bbb553b17741f591e9f92d326b306426e7[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Apr 6 17:46:50 2026 -0400

    FPS specific farlook position selection added

[33mcommit 1a803b965d781a07d93aad1de41ddd067a2db85d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Apr 6 16:39:37 2026 -0400

    Fixed pushing boulders in FPS mode showing boulders under the player (removed old FPS floor caching code)

[33mcommit 423ec1f8a9c39ff2c8978479c51e22f095cb45f0[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Apr 6 16:19:27 2026 -0400

    Fixed absurdly evil tileset transparency issues

[33mcommit 0caf92431596b82397ff456f7919e9cad2f70842[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Apr 6 16:06:04 2026 -0400

    Added handling for NetHack not showing an item as a possible item to perform an action on when we already tried to perform that action through contextual actions. Now we fallback through the * everything menu

[33mcommit 7212253cae61478d5ce4569f99acdde17d869412[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Apr 6 15:55:25 2026 -0400

    Fixed start button not opening the pause menu on mobile

[33mcommit 98bf85c13c38947561df30ca81accd3cecdbf08d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Apr 6 15:50:26 2026 -0400

    Fix for tabbing in the inventory contextual box

[33mcommit 9e911b7b206a11323a4067530c315696ee27964b[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Apr 6 15:43:54 2026 -0400

    Made tabbing start from the first item in the list

[33mcommit 0e9707fab61f9b5f5c1f0231da2be5b25f4cfd23[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Apr 6 15:39:32 2026 -0400

    Fixed tabbing in multi-select modals

[33mcommit 89c69abbc09b61f8f18cef4164661bb81a29515e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Apr 6 15:19:29 2026 -0400

    Added all the NetHack keyboard shortcuts missing in multi-select modals

[33mcommit 66059b46e0b5777a4291d0374c74ee3ef3921df1[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Apr 6 14:58:08 2026 -0400

    Fixed adjust command showing a broken UI experience

[33mcommit 508c3887c3165fbd57287bbba7f910e0f2f39168[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Apr 6 14:48:38 2026 -0400

    Fixed left click not working as fire or throw confirmation in FPS mode

[33mcommit 7ee45a84f7101927811b45ec71542f1149d7efd8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Apr 6 14:39:19 2026 -0400

    Fixed thrown weapons in FPS mode causing a duplicate version of the thrown weapon to appear on the ground

[33mcommit dfcccb106d9c9abbfca1eba8228b4c10366f8e20[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Apr 6 14:26:47 2026 -0400

    Added check for mojibake to translations validation checker

[33mcommit 967efe8378746c7c4f68f8f89db666b036d73eca[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Apr 6 14:19:48 2026 -0400

    Fixed mojibake characters in translation files

[33mcommit dd31cc602e0e3217efda1b868c6a3979486165a9[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Apr 3 17:11:04 2026 -0400

    Default blood splatter resolution to Very Low for mobile devices

[33mcommit 6bd9d607714fc99baef777975799abbe181a2053[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Apr 3 17:09:30 2026 -0400

    Monster spliting back to hardcoded to 8 lightning lines

[33mcommit c69b04ce85e67ea80f6bd7f9ff6eb1c0277bed1f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Apr 3 16:42:49 2026 -0400

    Fixes for game over handling to better allow you to see that your character died

[33mcommit bcf6361c59210ae9a428ab2e26723baca79ee01d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Apr 3 16:08:01 2026 -0400

    Monster pieces are between 5-8 now

[33mcommit f2968356038af74f3d1ed24737ef44638232cbb2[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Apr 3 15:51:18 2026 -0400

    Added player death shattering

[33mcommit 5e3c72250d40748e72df1df577295cf54ceb75af[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Apr 3 15:28:22 2026 -0400

    Added "smite" as a kill trigger word

[33mcommit 1f2286a2a2cfd507914cc228cc45825077f8e8b4[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Apr 3 14:55:30 2026 -0400

    Split the blood mist and blood splatter settings

[33mcommit e8c1d7e3195b6cff03a3695f58bbabdb75e6f2c4[m
Merge: 822da1c 4dc31c2
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Apr 3 13:38:28 2026 -0400

    Merge branch 'develop'

[33mcommit 4dc31c25a419e5dbe510c3b1aeb2e00c04c8abb1[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Apr 3 13:32:05 2026 -0400

    Upped version

[33mcommit 4957f082611317e761c8644b0dafed27ef157b28[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Apr 3 13:31:12 2026 -0400

    Fix for missed attack sound handling missing a log message, and new defaults for blood effects

[33mcommit 743df83e9da9599e5b5a8caa866f739bc28187d2[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Apr 3 13:14:55 2026 -0400

    Fixed SlashEm item action modal UI to display item lists correctly

[33mcommit d8d77f36caa9b9821f4e94d91744b1d84d67d106[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Apr 3 12:55:30 2026 -0400

    Tweaks to UI for game updates

[33mcommit e2cb10e6c93b50d87a93f8e97810f8b7da0e65aa[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Apr 3 12:49:34 2026 -0400

    Overhauled the game update system to notify you of new releases but not try to download files dynamically

[33mcommit 8776d4e07d86a0611d6289986c1c1199bece49db[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Apr 3 12:21:08 2026 -0400

    Options for new blood system

[33mcommit a7a68d015d806f7b50016cd3898f20605c758da8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Apr 3 11:11:36 2026 -0400

    Fixed tsc errors

[33mcommit 42d3998cc918cf4a2e083bfad9c6adbb2a2b212b[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Apr 3 11:06:21 2026 -0400

    Upped blood strength

[33mcommit 3f337391ca23dada0c357bdf2c5286a6fe1797ae[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Apr 3 10:55:54 2026 -0400

    Massive performance gains on splatter system

[33mcommit 78110aabbd8a80a9896a4345350ca2bcd97d8998[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Apr 3 10:14:05 2026 -0400

    Really cool stuff going with the splats

[33mcommit 897c86d116561e5d2171d0344ff05a0ab6c7967f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Apr 3 09:48:59 2026 -0400

    Blood splat system

[33mcommit 822da1c74e270b6c34ca5fb90e0ffbbe6a016494[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Apr 2 20:10:19 2026 -0400

    Update README.MD

[33mcommit 15c6c913bd02211a7b60b19b5ecf4679ccad44fd[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Apr 2 20:08:42 2026 -0400

    Update README.MD

[33mcommit 2d6615b8ac4d0af419903830ffb7574d00e7a4bc[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Apr 2 20:07:46 2026 -0400

    Update README.MD

[33mcommit 0f4b108a02f9834c99888d639a0935a0dfa09ce1[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Apr 2 19:50:21 2026 -0400

    Fix for macOS build issue

[33mcommit d7e76d7bf4a6140ff041350c1921427257b85e2c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Apr 2 19:29:53 2026 -0400

    Testing macOS fix

[33mcommit 9ef3fb67b1b6e1f92a5cbfc0b4ab3281fc4d6d12[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Apr 2 19:11:54 2026 -0400

    Testing fix for macOS not rendering

[33mcommit 53e60a37c180adf4599b916a3ca02d8435d5c2b6[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Apr 2 17:46:57 2026 -0400

    Fix for macOS build issue

[33mcommit 591bc1541273d19b9a7bea712f9956c872cb5601[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Apr 2 17:42:23 2026 -0400

    Fix for version syntax issue

[33mcommit fef794395a6ca77206010d4904b582e9dee481f1[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Apr 2 17:38:53 2026 -0400

    Fixes for macOS build script

[33mcommit 03864b904e6bb901417040fca4b635e79d2c4b26[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Apr 2 17:20:44 2026 -0400

    Fixes for parallel Electron build script

[33mcommit c31748ede4d22f810df01dd989a2267369c54897[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Apr 2 17:02:18 2026 -0400

    Added macOS native app support to NetHack 3D

[33mcommit 929baded50fd81c00d0e388af98c14a24cb67368[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Apr 2 16:54:20 2026 -0400

    Upgraded parallel build tooling

[33mcommit 243db195365fa6d5f091d1a2dd6b00e4c57e8275[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Apr 2 16:11:38 2026 -0400

    Added proper stat tracking to the SlashEm WASM

[33mcommit 9dc701eb03e2d6fb888edb5f3f173e1898a00f9e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Apr 2 14:57:15 2026 -0400

    Fix for status conditions getting stuck on in SlashEm

[33mcommit 3ab2d20a61c885f8fbb6276845172b0fe6e8174e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Apr 2 14:23:03 2026 -0400

    Updated sounds with thrown weapon sounds

[33mcommit a7694d26bc1033da1bc2d24adda7d6556c2fe184[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Apr 2 13:11:50 2026 -0400

    Fixed modal issues

[33mcommit ff0b89361397c5ca7d2105b8c322947950e8e472[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Apr 2 12:26:01 2026 -0400

    Updated random character to use all available options for a given runtime

[33mcommit 6129fb2e5aac928aeb67738ce09c771b11547ba6[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Apr 2 12:19:02 2026 -0400

    Contextual popup scrolling fixes

[33mcommit ca45b7a52461d83bbbc89cb95a08019bfd413350[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Apr 2 11:53:11 2026 -0400

    Fixed scrolling text speed being inconsistent in contextual popups

[33mcommit 702e0df5a17fde7a8a45417f5931f93cddc62629[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Apr 2 10:50:11 2026 -0400

    Fixed contextual popup CSS showing text outside buttons when the text is too long

[33mcommit c297e865ff85d8f3a3c3658fffdd6abce3c40ce1[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Apr 2 09:30:15 2026 -0400

    Added Technique command to contextual actions in SlashEm

[33mcommit 6a46669a853442a8ffbd7d72a85a18dc6e5cafa3[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Apr 2 09:12:58 2026 -0400

    Added separate UI rulesets for class and race combinations and available selections

[33mcommit 11a2b61a51e4fce61f703758eb599355807413ec[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 1 21:43:54 2026 -0400

    Fixed game variant box vertical centering

[33mcommit f0f3c1f0d4f66defe3d2dac31127bea7566dd845[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 1 21:41:32 2026 -0400

    Styled technique modal

[33mcommit ea1f2f13a9f7eecd11bac31da7dfe51da34b4e40[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 1 20:56:47 2026 -0400

    Many fixes

[33mcommit 44fcc14cb4f07b496055309a29ef28c44618388b[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 1 20:10:57 2026 -0400

    Upped version

[33mcommit e7d8069678950d1816abaa8025b1daeda1760f64[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 1 20:07:16 2026 -0400

    Gold sound updated to key on actual player gold stat increases and not messages, and removed Tip from SLashEm as it's a command that came later

[33mcommit 8871ead189a95782ac149e2c3b7eb0690da0cc23[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 1 19:56:02 2026 -0400

    Updated glow fade effect

[33mcommit b6b39fc52abe8dbf2583198edbdc02230ccd5b43[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 1 19:54:34 2026 -0400

    Added falling glyph decoration and updated game variant display

[33mcommit a09d8417bd936952080d225440f44b6cb67d23b4[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 1 19:27:57 2026 -0400

    Added game titles for the game variant selected

[33mcommit b0f784dd421835701589893ab25522abdce1aa48[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 1 18:48:07 2026 -0400

    Slashem support for statuses

[33mcommit 4748b2740b99d1efdd7df2ff4f36162c71a316d8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 1 18:07:12 2026 -0400

    Fix for drop menu using the wrong component for SLashem

[33mcommit 177aa90ef72e5032e70626b2facf23881a6e7c42[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 1 17:43:45 2026 -0400

    Fixed broken alt commands in Slashem

[33mcommit 27b204cde06dc306123a98afe4017ea60fbbf709[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 1 17:29:46 2026 -0400

    Fixes for 3.7 crash on iOS

[33mcommit a5f49bdd7dea0a0d8782a3f5b18699b0fad8aa68[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 1 16:25:42 2026 -0400

    Fix for the crash issue SLASHEM had on special levels

[33mcommit 0acc156592250ce40513418bd1e6767eff7d1104[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 1 15:02:49 2026 -0400

    Fixed issue where we used glyph catalog data to display items when we already had access to better runtime data

[33mcommit ee39485e5e352714e352605bfd2724a3541b8611[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 1 14:38:06 2026 -0400

    Fixed last remaining issue with item stacks

[33mcommit c207cebc5a0076c5ab46c065e91af8d15eac3ebd[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 1 14:26:19 2026 -0400

    Fixed issue with top of pile code being absent in 3.6.7 WASM

[33mcommit 2597fc42efc8ba46fa45b23059ac8b5a99c39100[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 1 11:10:21 2026 -0400

    Updated documentation around loot pickup and auto picked, including top of pile logic

[33mcommit 236d18e03b7ab93f94dd42e4fdf1322ed4f7fdbd[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 1 11:02:36 2026 -0400

    Fixed slashem gold not disappearing on autopickup

[33mcommit 5157118ea0f7056e3e4b7abb6d121899b59ebee3[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Apr 1 10:47:51 2026 -0400

    Nearly fixed loot under the player

[33mcommit 400abbf5aa4db5385469015e57a8d09eddb8df4e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 31 20:22:07 2026 -0400

    Fixes for loot under the player disappearing when it should

[33mcommit 7ac26b7c9df8fcb0ed296d52caa04a6fcb5f3c0f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 31 19:26:38 2026 -0400

    Fixed tileset manifest giving the wrong runtime and tile size information

[33mcommit ff18e1462201ef1ab907842a597eefe35bc86105[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 31 19:08:30 2026 -0400

    Fixed door floor edge cases across runtimes

[33mcommit d6d4ffcf1fc24125c10db225a9a8fa95df73cf9c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 31 17:36:14 2026 -0400

    Fixes for spell menu and tiles background in SLASHEM

[33mcommit b3f77813acfdf0fb3c06a0609a1a2914c5dedd95[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 31 15:47:15 2026 -0400

    Fixed yes/no question handling in NetHack 3.4.3 variants like SLASHEM

[33mcommit b98ee1ebbfb891d2aae0937752ec0f4ca26ab288[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 31 15:23:54 2026 -0400

    Better tileset loading handling

[33mcommit df7de52de4ee2c1a18eff09a31af3706f0572094[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 31 15:18:27 2026 -0400

    Added Info button to contextual command right clicks

[33mcommit 738c177fec95043fc2001037b999bd5ba4a0462d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 31 13:38:47 2026 -0400

    Fixed right click command in NetHack 3.4.3 variants (SLASHEM) and updated the steering docs with the new WASM artifacts and best practices

[33mcommit 8186f78adc249fd7567be7d08a35ecbb31062665[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 31 12:08:02 2026 -0400

    Fixes for inventory in legacy NetHack versions

[33mcommit a0e7f752f41ad3fd51133abb6746c025bc7425e1[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 31 10:15:00 2026 -0400

    Fixed dark corridor walls in legacy NetHack versions

[33mcommit a75d43c83ffe8fd71c0f1fc28dbcad2b9beecbb9[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 31 09:25:24 2026 -0400

    Tilesets working GREAT in Slash'Em

[33mcommit 82866805a7757dae994d11325001b70a3fa01b57[m
Merge: 70db071 a3147f2
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 31 08:01:20 2026 -0400

    Merge branch 'develop' of github.com:JamesIV4/nethack-3d into slashem

[33mcommit a3147f2d49435da82f2c6422f52b3d8edd034f00[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 31 07:56:13 2026 -0400

    Version upped

[33mcommit 368a16b96d682b7f66da6879ea9060c195c558df[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 30 21:28:25 2026 -0400

    Upped version

[33mcommit faf55d36d5ad440e60203935d74ccf373fd3dd40[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 30 21:26:32 2026 -0400

    Added Korean translation

[33mcommit fbda830a4ec55bd68993ed188d75510f5a3c4981[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 30 20:53:16 2026 -0400

    Added French translation

[33mcommit 7ed75f5bccf978acff590fad512447a6d042c8cc[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 30 20:21:09 2026 -0400

    Added Finnish

[33mcommit 36e0f68d27cfb5da81579238bce5f6d9c67b49bd[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 30 19:53:52 2026 -0400

    Added Japanese translation

[33mcommit 986bfe9c084ed77b6957da8455b34e91a43fe7ee[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 30 19:40:58 2026 -0400

    Added German

[33mcommit 2966cb07a78605c95806b2d3b0e6a6598a770e67[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 30 19:19:40 2026 -0400

    Added pt-BR translation

[33mcommit fee213e34ff658abe6e4d8a71a0e55985f9c27d8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 30 18:59:06 2026 -0400

    Added Spanish translation

[33mcommit 1f23378ad9954ee340f9c02113b68756c58d4cd7[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 30 18:39:34 2026 -0400

    Moe simplified chinese

[33mcommit d2752b21ebcc31846d62a27705a503ba8c100a45[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 30 18:11:51 2026 -0400

    Added script 'npm run i18n:check' to check for missing translation strings

[33mcommit 5a0ed187db84df272888510507684945bdb29075[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 30 18:06:24 2026 -0400

    Added simplified chinese translation strings

[33mcommit 824bb541a89e3a0d373999e8ba546b1cdc59726b[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 30 17:50:43 2026 -0400

    Added langgue option

[33mcommit faa1705668989c38738960fbe7423953984d22f7[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 30 17:40:31 2026 -0400

    Translation system added

[33mcommit 82c86f85313aad6af12244cc60b442c429336d87[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 28 18:48:41 2026 -0400

    Upped version

[33mcommit d3ca4295018aab7e12c25e312607a2df19db4bd8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 28 18:19:39 2026 -0400

    Revert "Don't allow runtime to query the WASM when it's busy answering a different shim"
    
    This reverts commit e8e5b3c0caa81dcec2e34431e512c01ebd77f805.

[33mcommit e1dd49e417abb7666ea6a5a9334b16712da8b6bd[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 28 18:06:09 2026 -0400

    Fix for inventory in death screen in NetHack 3.7 showing headers as items

[33mcommit a7de5e8bbe28b4199e3f3e1d4ba1785aeda4fb13[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 28 17:54:28 2026 -0400

    Log updates

[33mcommit e8e5b3c0caa81dcec2e34431e512c01ebd77f805[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 28 17:44:58 2026 -0400

    Don't allow runtime to query the WASM when it's busy answering a different shim

[33mcommit 26b61711aa461ea786d2d99e63af1c9ec1f5ed35[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 28 17:26:42 2026 -0400

    Potential fix for the crashes on iOS

[33mcommit 9445380b7e0c0eef8681a8087143f4bac7773e50[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 28 17:09:31 2026 -0400

    Fix for condition labels in 3.7

[33mcommit 70db0719f45ca7c8d699c6aafc429e792864a59c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 28 16:44:25 2026 -0400

    Got the WASM for SLASHEM running

[33mcommit cb3dde2835e83e996b7bed8ed1a7258115bf1145[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 28 11:15:28 2026 -0400

    Added SlashEm support and moved scripts to using forked WASMs as the path forward

[33mcommit 2c737934fdbb5c3ac10dcb5123dcccb43bdc8e9f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 22:18:26 2026 -0400

    Small cleanup

[33mcommit f022c298a045dfae32428e5196eea52c86e9bd73[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 21:39:14 2026 -0400

    More log stuff

[33mcommit bba263f0f7859d0e1b24668666917521f0cc86dd[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 21:22:35 2026 -0400

    Cleanup

[33mcommit 835e5c8d9eeb8ecde3b1d3ed727052325a3214f0[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 21:22:17 2026 -0400

    Add ability to save and read log locally from the device

[33mcommit bded6a2310a64e86d0bccfd000206e3ba6bed4a6[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 19:48:50 2026 -0400

    Allow debug log when clicking version number 10 times

[33mcommit 75bdb657639d27b62599498fabded4e92226f5d3[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 19:22:22 2026 -0400

    Added version display to main menu

[33mcommit cd78eefb6c0443038755ed7aa01538aca9e0ca55[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 19:19:14 2026 -0400

    Fix for iOS crashing web page

[33mcommit a5172d48024baac39f651e93ddc55f85a10b850b[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 17:30:53 2026 -0400

    More performance fixes

[33mcommit ade0628828262089a41c57e095cd56f7ca14525f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 17:17:22 2026 -0400

    Performance improvements

[33mcommit 77d990bfcd2052c19039fc4d949c8a68e01741dd[m
Merge: ef8bdc9 4fb2a52
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 16:48:51 2026 -0400

    Merge branch 'develop'

[33mcommit 4fb2a52c6aeab632c115a5dd19e07e4b4f087fb6[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 16:48:23 2026 -0400

    FIxed console errors about missing sounds

[33mcommit ef8bdc9fb9e2ec449739f0d3e7f172dad34b98f0[m
Merge: c38db46 5298f13
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 15:59:55 2026 -0400

    Merge pull request #17 from JamesIV4/develop
    
    Releasing v1.0.1

[33mcommit 5298f1371665df7dc3123f029cb30977a77b3d42[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 15:54:14 2026 -0400

    Upped version

[33mcommit 433c72f087fe3a35a1a4a2b7c5f826321702933a[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 15:52:59 2026 -0400

    Fixed FPS mode not removing auto-picked-up items

[33mcommit 688aa1149e95eb4fc1c4c57d08de075322f326a1[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 15:40:46 2026 -0400

    Fixed iron bars rendering opaque in 3.7

[33mcommit c0a9e9ca5e0e23c2da148c26844c90a448a18466[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 15:35:46 2026 -0400

    Revert "Fixed FPS mode issues with auto picked up items not being removed from under the player"
    
    This reverts commit e15841fc41a199a14705b643779351c2f5210e71.

[33mcommit e15841fc41a199a14705b643779351c2f5210e71[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 15:21:44 2026 -0400

    Fixed FPS mode issues with auto picked up items not being removed from under the player

[33mcommit 83fb714c206633a2eeefc63489e719edf7d492e7[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 15:13:50 2026 -0400

    Fixed a lot of Nevanda 3.7 noise in the image data

[33mcommit 4b6299d5cb6c0326d6d34be740dd6a1467a2d751[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 14:02:53 2026 -0400

    Stairs down should be flat

[33mcommit b6cb142bf44a76c774a1b275fae0c380abb8f54a[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 13:36:57 2026 -0400

    Fixed engraved floor showing under dungeon features in FPS mode in NetHack 3.7

[33mcommit 35cd33fa4fbed4a7419e0bf67ca3cb705294a569[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 13:26:10 2026 -0400

    Added debug tools to checking glyphs and ascii characters

[33mcommit 0a3080ba92345681517970415e4a69cb367e0ee8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 13:06:14 2026 -0400

    Fixed chamferred walls in 3.7 showing the wrong tile for the floor corner

[33mcommit 264cbfa343c2c96d19425e589bde7e89b4e2585d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 12:51:13 2026 -0400

    Allow Shift commands to pass through on W S and D in FPS mode, so only Shit + w is taken for running. This restores drop type (D), saving (S), and take off type (A)

[33mcommit 5e24107a101eac4c45d85239b772fe481640f666[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 12:43:27 2026 -0400

    Fixes for eating and actions not removing items under the player

[33mcommit 1497467554a3262bae62e8a8dac219f2a96c8ea7[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 11:26:00 2026 -0400

    Fixed regression causing floor under loot to be removed in FPS mode

[33mcommit 62798a2f8b25491b2bd78f4d66172f358b8cc88d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 10:46:03 2026 -0400

    Optimization to skip unexplored/nothing glyphs at a low level

[33mcommit c38db46359eb8af623fe38713d7b57af0aca87dc[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 27 10:06:28 2026 -0400

    Added FPS and render time debug stats

[33mcommit 8f48e56f0fd415440a2beb979e2f51158beca92d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 26 15:06:11 2026 -0400

    Cleanup

[33mcommit e23de1d5ceb73f969733869d64ece5a35bda111e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 26 15:01:53 2026 -0400

    Minor text update

[33mcommit 95220403330fb4e5d183483655e869befd64d5b0[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 26 14:39:37 2026 -0400

    Fixed boulders appearing under the player in NetHack 3.7

[33mcommit 3684c2967352dd812eed2c833c3f511936aba542[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 26 14:04:52 2026 -0400

    Fix for runtime failing on github pages

[33mcommit b136ea02482ebbe22d8f1619b0d53776b88a8106[m
Merge: ad6c382 f9b1f60
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 26 13:57:55 2026 -0400

    Merge pull request #16 from JamesIV4/develop
    
    Added NetHack 3.7 support

[33mcommit f9b1f60b08d362b0e20082af229246670545d6a6[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 26 13:56:08 2026 -0400

    Update menu flow to show NetHack Variants in a more obvious way

[33mcommit a3ce60b5343985292a2567e3e95b93a6c05be01e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 26 11:47:04 2026 -0400

    Fixed autopickup and item under player removal of items in NetHack 3.7

[33mcommit fefa6f0b0ed3c1f17ff642f24942881f9ff27244[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 26 11:13:30 2026 -0400

    Better direction arrow handling for clicks

[33mcommit ebe0c2a852bc340e0cdc3be462ceb7664e47eaf5[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 26 10:49:45 2026 -0400

    Fixed shopkeeper death in NetHack 3.7 not trigger end of game state

[33mcommit 836534907933cc09efa0705db82148e059204b23[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 26 10:42:24 2026 -0400

    Current status and current attributes parsing fixed in NetHack 3.7

[33mcommit 2e22026cbae91b8153e046df13b155b5f8aef70d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 26 10:31:08 2026 -0400

    Ensure sound to message log matching is done in lowercase

[33mcommit 59b501708307ea7d97370a6313d892bee9c08cc9[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 26 10:27:20 2026 -0400

    Fixed Dungeon overview handling in NetHack 3.7

[33mcommit d73f838dde1eba868eaa7ed7e9b63b582a87e584[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 26 10:21:09 2026 -0400

    Fixed further movement delay issues in NetHack 3.7

[33mcommit 0075e37c233a147995e617229d74ec17d105127d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 26 10:14:46 2026 -0400

    Fixed tilset background removal issue when translating 3.6.7 tiles to 3.7 automatically

[33mcommit 6657eebd1cc0d9afbbee694b87e6ce9b8cdb2ae3[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 26 09:28:51 2026 -0400

    Switched from runtime 3.6.7 to 3.7 tileset translation to precomputed translation

[33mcommit 3513e96c791050bda3bdeb6a3726052b17edf073[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 26 08:29:47 2026 -0400

    Disabled autosave for 3.7 for now

[33mcommit bc21fa35138c14f90a897ef11d75d68a5dc5ed61[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 26 08:22:36 2026 -0400

    3.7 autosave last attempt

[33mcommit ff06b413e589b6ceb86ea7bf3ef8f17647cd4e10[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 25 19:34:46 2026 -0400

    Almost fixes autosaves in 3.7

[33mcommit 55a497acbd59e5f6e03a1f79ab5f606ffbdd8254[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 25 18:20:23 2026 -0400

    3.7 door sound fix, autosave support for 3.7

[33mcommit 0a90ffaf9e3bb5c828c40c0be31d1c24b5cad51a[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 25 17:00:03 2026 -0400

    Swap from 3.6.7 to 3.7 tileset when starting 3.7 game, when possible

[33mcommit 872c557e4ffe70a0d6e84b404069aeaa4e2753cf[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 25 16:50:43 2026 -0400

    Fixes for fountains and tombstones in NetHack 3.7, and logic to swap back to a 3.6.7 tileset when a 3.7 tileset is selected and beginning a 3.6.7 game

[33mcommit 1e7265b748eca7ffa3a24959daedb07f26fb2ce6[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 25 11:33:33 2026 -0400

    Added option to override NetHack 3.7 dark corridor wall tiles (on by default)

[33mcommit 3f4c4abbacb9453d41861c897c854de9c3d6c6d9[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 24 22:36:27 2026 -0400

    Added 3.7 tilesets

[33mcommit 11cbb1edaa8836bddd764ab098b3f7b44cff1307[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 24 22:26:28 2026 -0400

    Auto-use first action on clicks like NetHack 3.6.7 does in 3.7

[33mcommit d61301716d963d689c8e50826569c793270a76e3[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 24 21:41:28 2026 -0400

    Fixed flat doors in 3.7

[33mcommit da7a72bc277ad7f788a0ad4eca53bef60d8d95c4[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 24 21:10:12 2026 -0400

    Fixed too much delay in movement in NetHack 3.7

[33mcommit 7a018482eebdd30538e8c5437c13eb55313d13bf[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 24 18:24:51 2026 -0400

    More context command adjustment

[33mcommit 6ec31cecc0314f61698f646ce758faa73b787152[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 24 18:21:47 2026 -0400

    Removed a lot of contextual commands that don't make sense

[33mcommit 7b2d927e099bd3b160c8686b1531ee4761ae6e3f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 24 18:05:28 2026 -0400

    Fixed inventory issues in 3.7

[33mcommit 91c67a385a96807d45d105a47939e4902a2caa7b[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 24 17:56:43 2026 -0400

    Many inventory action fixes for 3.7

[33mcommit c46833e18013d9fbf64a326fed3098b28ea1b38c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 24 16:55:42 2026 -0400

    Floor tIle fixes under items and monsters when first seeing them

[33mcommit 8df72c6deb85aaec3989c1602e7622302c98ee2d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 24 08:59:20 2026 -0400

    Fixed 3.7 crashing when overriding character

[33mcommit c0f8c88116d0c7f45c80c3dd19fa671bd3e29f9d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 24 08:26:42 2026 -0400

    Fixes for tile overrides in 3.7

[33mcommit 8cf4c4f59f231e69e33a4c70fdc66365724388f6[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 24 08:23:52 2026 -0400

    Fixed tiles in 3.7 with offset

[33mcommit 93355f1c7e1d4e9124e6cc0d2a45c5624011fb40[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 23 21:17:13 2026 -0400

    Fixed 3.7 not launching

[33mcommit bc4e7b9387d2ab2f1b47edef5a2b26e1bd38ccd7[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 23 19:33:07 2026 -0400

    Fixes for NetHack 3.7 tiles and helpers

[33mcommit bcd99c04d7182a0b384bd3d124178a91ebb735a8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 23 17:22:20 2026 -0400

    Fixes for NetHack 3.7

[33mcommit 0c3170fd8822c9269f9183cb1bac061b62717662[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 23 16:57:55 2026 -0400

    Cleanup

[33mcommit a091ef6cc8d9e5ebc2bcc5a5a621c06fd77d44d8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 23 16:37:13 2026 -0400

    Fixed mismatching commands systemically (pointers issue)

[33mcommit 959b6429c106b6db5ebfb8a96b931118523f7276[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 23 15:14:49 2026 -0400

    Fixed Call and Name commands

[33mcommit cffc11055209782669bac4155d6976bdfe092dc9[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 23 14:21:13 2026 -0400

    Fixed commands sometimes randomly breaking

[33mcommit 13a74d5f993efddf8aae3d21a21408beca976996[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 23 13:01:59 2026 -0400

    Updated steering docs

[33mcommit ad6c382ef158e23dea4b17a441798d614c963570[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 22 20:33:24 2026 -0400

    Hide the game UI when tombstone screen is up

[33mcommit 1ee401880158a0f6ee01c02d7635026b4ca85aaf[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 22 19:59:45 2026 -0400

    Hide the minimap when the game is over

[33mcommit d17e1194e32635ca6849f18c6cb880db75849f82[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 22 19:59:27 2026 -0400

    Hide minimap on tombstone screen as well

[33mcommit 1bae7de5525ab2411dfd7c8f4e0a413172eb2994[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 22 19:58:15 2026 -0400

    Hide stats bar on tombstone screen as well

[33mcommit 82d7b1ff866df52a606e151cfb2b7d0d85e9a32b[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 22 19:48:10 2026 -0400

    Hide the touch UI when the game is over

[33mcommit 75b7e57a56d5ee014e58b2520270aae6b8994bfd[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 22 19:33:28 2026 -0400

    Tombstone tweaks

[33mcommit df6484428c30b5ed66bf793f0fb585d26110ea04[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 22 19:09:51 2026 -0400

    Fixed loading wizard saves

[33mcommit a71828962418e8812d708622f8f715a116bd9a84[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 22 18:31:37 2026 -0400

    Fixed return to main menu save not working

[33mcommit 06e53c60573cb5b0a0dbba018d830fc4a2ede21c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 22 18:01:22 2026 -0400

    Tiles can now be shown under the player in overhead mode as well.

[33mcommit 458104ba33a075f0a2a55255d5e202c25dab2bdc[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 22 16:19:37 2026 -0400

    Added item pickup under players being visible

[33mcommit 46f7c8a4eac2216724258fa9410462a6e4c3a235[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 22 15:01:23 2026 -0400

    Added tombstone support and WASM fixes enabling it, and cleaned up dungeon branch parsing

[33mcommit fd96d588fe6f081bf9b6803d62a5f9c4108e3e48[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 22 09:43:41 2026 -0400

    Fixed game over "Return to main menu" not appearing

[33mcommit 04b2f887c915ae87911fa37963953e5ea93c237b[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 21 18:09:32 2026 -0400

    Fixed pray command not working, and probably others

[33mcommit 3b8158876fff0f67cb61b99c6ab5682a176b001a[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 21 14:42:30 2026 -0400

    Fix for online issue

[33mcommit e3f3add205ac044df34d25b4975be09ec18e0bb4[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 21 14:17:28 2026 -0400

    Revert "Fix for online version (will disable autosaves for online version for now)"
    
    This reverts commit 993c134643ce53a1789370862f5284b48d540e00.

[33mcommit 993c134643ce53a1789370862f5284b48d540e00[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 21 14:14:27 2026 -0400

    Fix for online version (will disable autosaves for online version for now)

[33mcommit 3f6ecd81125bfd612d0ff463ed0b4dd3cda15d3a[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 21 14:03:21 2026 -0400

    Fixed online build issue

[33mcommit 9c81d57cc51ee22d17c02fc84510f42419c5ddbb[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 21 13:20:50 2026 -0400

    Removed vite attempting to use custom NetHack WASM versions for now

[33mcommit f35c4001f304411cd5d8be229b7ab1223e8420fa[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 21 13:06:32 2026 -0400

    Disabled 'Check for updates' button for now

[33mcommit b196828f33be32f75957efdb0e1eb23139ca164c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 21 13:03:15 2026 -0400

    Disable online updater on launch for now, since it doesn't play well with forked NetHack WASM files

[33mcommit b7e2ee01fd5f4041103abce9b5f740b2de3687a8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 21 12:56:57 2026 -0400

    Revert "Online update"
    
    This reverts commit 6fa383a5ddc67e2c88c5989f73e8745eb184fc1e.

[33mcommit d7bac8cef34044c2a833b1f78def9d91461c6bc5[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 21 12:54:44 2026 -0400

    Revert "Reverted the forked WASM version for now"
    
    This reverts commit e4b7e23a5053988e91f0c68b8da1fbfd95394ad9.

[33mcommit d1067607843ce750c48569f66cfa953790fc5e0c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 21 12:22:54 2026 -0400

    Online game update reverting the forked NetHack WASM

[33mcommit e4b7e23a5053988e91f0c68b8da1fbfd95394ad9[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 21 12:21:46 2026 -0400

    Reverted the forked WASM version for now

[33mcommit a533f7e215210c471d433736a712945d446ff61d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 21 11:00:27 2026 -0400

    Remove android run command

[33mcommit 6fa383a5ddc67e2c88c5989f73e8745eb184fc1e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 21 10:59:26 2026 -0400

    Online update

[33mcommit 1d449c10c3c1716a6f3e1be17d832cc323420064[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 21 10:58:33 2026 -0400

    Better error handling when online updates break the game launch

[33mcommit c845c00eb2ad2ce1c64b1aef80bbf7f15592d8ab[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 21 10:54:35 2026 -0400

    Incremented game version

[33mcommit e1d1780cf8d9670dcbc3a26ed090f405ba52c88b[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 21 10:41:08 2026 -0400

    Publishing online update with forked NetHack WASM fixing autosave support

[33mcommit 872f3dd70a86be9991dac4598e91bfea0ad4ecc1[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 21 10:39:39 2026 -0400

    Allow online updates to serve forked NetHack WASM files

[33mcommit e0f848862fedf4a42ef421a82672dde676602efb[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 21 10:29:25 2026 -0400

    Allow forked version of NetHack WASM to override packaged version while waiting for PRs to be merged

[33mcommit 2fc07afa6d140d333c50a59d1c620b03a37cf9ab[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 21 10:09:49 2026 -0400

    Removed unneeded dependency

[33mcommit d856f66f3385d7770c22081ceafb98a545c82975[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 21 10:08:02 2026 -0400

    Fixed autosave system

[33mcommit c0482c4f4c812aafb1706c83819666b869cf064a[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 20 21:19:25 2026 -0400

    Online game update

[33mcommit f15780029a63b4fd9a5a92f60a5b77cc92a6b84e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 20 21:18:44 2026 -0400

    Removed autosave support, as a WASM update is needed to support it correctly

[33mcommit 717f54750ace720d8cb8b39c2120d41aef2cace9[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 20 19:49:35 2026 -0400

    Wizard mode working! FIxes for incompatible save handling after WASM update

[33mcommit 7286062046a1cceb0d6cfcb956e62552d2f92bb8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 20 19:02:42 2026 -0400

    Package-lock updates

[33mcommit 562876d9f3e342947e828fc38618534449b946d5[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 20 18:45:02 2026 -0400

    Online update

[33mcommit c2a74972bbf7b36eb6f389c2d68af07c3b70a5fb[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 20 18:44:35 2026 -0400

    Upped version. Fixes for Android online updater

[33mcommit 524a0d9e3a2a4996dd1e6d45d7ea31c8382abd97[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 20 18:41:29 2026 -0400

    Implemented autosave support

[33mcommit 18b17760d24e3b11d3fc5c1f9df30176bdb4d260[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 20 14:39:35 2026 -0400

    Online update release

[33mcommit 762cf34ec2c64c27f7691d61948da87e511e7f0c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 20 14:39:02 2026 -0400

    Fix for "call this..." prompts not grabbing all the information messages before the prompt

[33mcommit 5a51a36d57d05a9d1c7fe308bd62263556d4c51e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 20 14:10:39 2026 -0400

    Quaff sound triggers more reliably

[33mcommit b6ca66d44d4104315c03f83122b6339d122c0994[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 20 12:29:10 2026 -0400

    Append the last message when the game asks the user to name something, so they can clearly see the game's feedback about the item.

[33mcommit d89e03c7283befd6be00d3bd244c271e2db67386[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 20 12:01:51 2026 -0400

    Fixed return to main menu button for game in progress to work the same as the one after game over

[33mcommit 281f957a85598832860b525288af15755279fb5e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 20 11:57:42 2026 -0400

    Cleanup

[33mcommit ddd146e3ba592d43f67e68c9e85d8fbf27f53036[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 20 11:55:44 2026 -0400

    Fixed menu startup animation regression

[33mcommit edb6894d805a7d1c2af1d968e44e0721db27b333[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 20 11:44:04 2026 -0400

    Added Drop Amount and Drop Type contextual buttons.

[33mcommit a80dd086a7fc48ebb74cdd7511808d9feda33456[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 20 10:47:57 2026 -0400

    FIxed gold sound playing when it shouldn't

[33mcommit 725309eb5d6ad45667e3ed322e479f3938c3ab0f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 20 10:36:35 2026 -0400

    Fixed glance bug causing broken game state when using contextual menus

[33mcommit b48d581a580048c7dee20fc6efa393261b91224c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 22:43:02 2026 -0400

    Online game update

[33mcommit 7da1b18d4e91c7952da1e2f328a72114c1a40ad1[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 22:40:42 2026 -0400

    Fixes for contextual popup 'autodescribe is off' issues and arrows not showing on iOS

[33mcommit 0c4655ceabe3374cb9ebd8ba7c1d303d2c091150[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 20:43:24 2026 -0400

    Online game update release

[33mcommit e8ac9e48903d5cfdea3afec755f40e30c482e3a8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 20:42:47 2026 -0400

    Added warning when game updates are corrupted, automatically clear corrupt game updates and advise a full client update

[33mcommit a1a3c1099152ad34a3650c00ff4a2df43190be81[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 20:30:57 2026 -0400

    Update

[33mcommit 3f7816b093ab187be2972e1b7e7ada5036dae78b[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 20:30:26 2026 -0400

    Testing game updates

[33mcommit 63fb0529c83d0f2d68c6c74f3f66f528774bd3cd[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 20:27:04 2026 -0400

    Fixed update system (for real this time)

[33mcommit 15b1d4852f36ff7b6069810223df6947f5b9b69e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 20:17:59 2026 -0400

    Update

[33mcommit dd71302d40dd970e487594c6b9a1f3b448a73b86[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 20:16:55 2026 -0400

    Testing updates again

[33mcommit 0e1af24c99c771e1f0fc6fa24ba4f47c8090ebf1[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 20:13:51 2026 -0400

    Fixed game updates taking forever, remove file length check, only use SHA now

[33mcommit 8b08fc92a4fdbe14b30b1b0d698b0a3ca0ad07fe[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 19:58:50 2026 -0400

    Testing updates

[33mcommit df4025288ac246459859cd9add79f1db1d0c0d9a[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 19:56:21 2026 -0400

    Fixed broken updates causing black screen

[33mcommit 51f76daf443ae4702a4b01b696d0f1600b11e6c2[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 19:10:30 2026 -0400

    Show download progress as it happens, with progress bar

[33mcommit ab15a20204f3a05e8f0f050022bcdea859f56ed1[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 18:31:52 2026 -0400

    Testing game updates again

[33mcommit b786ed746b450d394fa38f345d6e0e2ac63aa571[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 18:17:16 2026 -0400

    Publishing test game update

[33mcommit e4c339ce3f06774b009cc77cc576f0a0b2f7adfd[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 18:15:24 2026 -0400

    Testing game updates

[33mcommit f80f5dc77a19ad3611f18fa2d33d0caeadc96c2f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 18:12:02 2026 -0400

    Added log dump key combo

[33mcommit 1b807ab3f0a4e66987aaaac4f0ee0e429a363bd5[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 17:49:29 2026 -0400

    Another game update test

[33mcommit a16459d40de7b7a1a66da86121abe2593eed068c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 17:48:10 2026 -0400

    Testing updates

[33mcommit 737e88d7fd59e89be5d18bec42743af772ea8e17[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 17:46:45 2026 -0400

    Testing updates

[33mcommit 3620d786ba0202562f2064b1ac3a7344a20177b3[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 17:43:14 2026 -0400

    Added logging to the update system

[33mcommit ed6d7e0aa5ccc2d52d57d4779ca4b556cc9f4f04[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 17:30:37 2026 -0400

    Game update

[33mcommit e9147ea1c6d50b0afa4bcb7ae07702bbcf102c2e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 17:28:51 2026 -0400

    Added option to disable update checking on launch

[33mcommit d38f43d7147bbc40318bda02013234e2c28a94f0[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 17:24:46 2026 -0400

    Fixes to update system

[33mcommit 633503a6792779a779b5105057722103a6b08c66[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 17:08:59 2026 -0400

    Added Check for Updates button in Options menu

[33mcommit 10bf13d28cf698edea6c14b26447f5ad1d0a7d57[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 17:02:37 2026 -0400

    Testing game updates

[33mcommit 26bac4fcd8e973fcf42eabb0df3f7d50172f45d6[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 16:58:52 2026 -0400

    Allow cancelling update downloads, and better detect when updates are available or not

[33mcommit 0568562f08d30d34b360091392ced0e674d96287[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 16:27:56 2026 -0400

    Updated build

[33mcommit ca861fdba2db38e812d4bac5df2c615d79209814[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 16:27:38 2026 -0400

    Online update system fixes

[33mcommit c7ecc7ebe07fe71cb0a6b70e58387da652ea92c4[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 16:18:49 2026 -0400

    Added parallel build creation for Windows and Linux

[33mcommit c15710f54e1b76e0730116006e02c227344468c8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 15:30:38 2026 -0400

    Fixed online update downloading, slightly reduced app size on Linux and Windows portable

[33mcommit 3ec214b7d689b02b87f7da6bf1fe241f9177cf7b[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 14:44:51 2026 -0400

    Update

[33mcommit ffe528974c7dab32b7db05c411c4ca397dcc7ab4[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 14:44:17 2026 -0400

    Updates are manually made now, not per-commit

[33mcommit 49044fa035beff15c991d1492f5e070334a54ba0[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 14:36:32 2026 -0400

    Updated commit hooks to include current update message in the manifest, not the previous one

[33mcommit 009eb7756c8d43518a266b6e03cd9f03cd7fc39f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 14:30:20 2026 -0400

    Moved setting within group

[33mcommit 077b76068a92758440e435149b14cbae396ec395[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 14:26:48 2026 -0400

    Updates are rolling now instead of storing the whole game in every commit

[33mcommit 94ea7bbbbfeeb9331ce81858987ab3c0edd15aa3[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 14:00:26 2026 -0400

    Updated package-lock.json

[33mcommit 88e94c5db853c2dd373ac4a3000569ae0c5d1896[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 13:58:31 2026 -0400

    Added game live update system for Windows, Android and Linux clients

[33mcommit 2f32fe7828c54cd4a5083ddc586508820d0a0a67[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 13:28:29 2026 -0400

    Updated option description

[33mcommit 0ce6a9f82997b846fd20b22a4e9990de9966d600[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 11:58:31 2026 -0400

    Restored tile flattening in FPS mode with new option to use raised sprite billboards in FPS mode instead (default to flattening sprites when player stands on them)

[33mcommit a7907c6871db87791f7c3335f05910dec717ed75[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 11:39:08 2026 -0400

    Added option for Message log scale, refactored Display options with groupings, refactored Controls option section with groupings, Return to Main Menu now properly returns instead of reloading the page

[33mcommit 25eecf04aa538e6097626bb264fd91c834f42ad7[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 10:31:27 2026 -0400

    README updates

[33mcommit b6d4779449db459545d355deb9efcb405cb9f97f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 19 10:26:03 2026 -0400

    Fixed Steam Deck Game Mode for Linux AppImage

[33mcommit b70fd38cd07b6bcfadc11d0441db3b99485ce713[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 21:08:32 2026 -0400

    Added Linux AppImage script

[33mcommit 5c994b315aa4f2bfe443ecd80c1682e38b3f4cf1[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 19:17:13 2026 -0400

    Fixed inset door floor strip AO by unifying all AO z-offset height

[33mcommit 1cf4988988e5d4eff882ae5427fa63c9a7eccb08[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 19:00:48 2026 -0400

    Fixes black lines on the floor strip near inset doors

[33mcommit 7039e4b69aa38668d51036223cfccbb38ca317cc[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 18:54:32 2026 -0400

    Fixed AO on the floor strip for inset doors

[33mcommit 429fa65aab80945a9f2a857d354739c433951fe1[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 18:37:22 2026 -0400

    Progress on AO for the floor plane

[33mcommit 6b17ce2e9cd3cac4a3faaed421254adb4f628409[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 18:10:33 2026 -0400

    Fixed AO around inset doors

[33mcommit 2e7a872db59be9b148c88da6ed6e7ca6ea15c0a1[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 17:55:45 2026 -0400

    Added floor plane in front of inset doorways, with AO

[33mcommit a8737fe181c00c659799fa2b2d4b99780a4d1b31[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 16:36:56 2026 -0400

    Render billboards as standing up when player or pet or monsters walk on them

[33mcommit b997d833278634c90c88583377c10aa2b2d6e75e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 15:56:04 2026 -0400

    Make vulture-mode FPS billboards show when the player moves on them

[33mcommit 4804c366c65f3da69570ea9dc6403ca518f0e109[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 15:21:09 2026 -0400

    Fixed iron bars in FPS mode

[33mcommit 43b01cfd57e1dbb42962da6c409dd7cd4b8142e3[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 15:08:55 2026 -0400

    Fixed iron bars showing blank wall faces in adjacent wall tiles in FPS mode

[33mcommit c4d2a523fdcca6676028a42838cdb57536ac0f0a[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 14:50:52 2026 -0400

    Added floor plan under iron bars

[33mcommit 20b671c248fa0dca28ac23faa484363bffd31a91[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 14:34:24 2026 -0400

    Fixed edge case in floor flattening logic

[33mcommit 21679a4d5d077e8bf62ef7762b59ed6c722cb9a4[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 14:32:04 2026 -0400

    Fixed loot not appearing under the player in FPS mode

[33mcommit 05f8e56d9efe2dd886798aae28afb597d5c8528e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 14:22:30 2026 -0400

    Fixed floor under loot in FPS mode

[33mcommit 2ed5da58c55134dc7fc62b0405ac5595610d2dc2[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 14:18:29 2026 -0400

    Fixed true-transparent tilesets handling of floors in normal and FPS mode

[33mcommit 7d2d4046219aa8e8fe8e9e65d0ce2cd1df700a31[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 14:01:01 2026 -0400

    Allow both tile background removal modes to be off

[33mcommit bbc6eea85b7e0f1faeee43c29225d9d4ed293778[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 12:17:32 2026 -0400

    Player stats don't bold when starting the game

[33mcommit 0e4dbb70ecf7d58ad8bbf8a372b1b7cbd45864ba[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 12:04:27 2026 -0400

    Responsive stats bar on mobile portait

[33mcommit b567b24bf4f7abae205b26318628e03f5632799e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 11:28:11 2026 -0400

    Minor update to package script name

[33mcommit 21ce0e2d633c8d14c958f7fc2c0d2bda6f1fbdc8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 11:27:24 2026 -0400

    Contextual popup is now animated too

[33mcommit 656aeeecdf7387007ec6680ae66f5962f02e8945[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 11:20:02 2026 -0400

    Added option for disabling menu animations

[33mcommit 7ad9c3ded27ebd3000d2b74986140a300f6075f0[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 11:13:31 2026 -0400

    Fixed animation main menu jumping

[33mcommit 8ffd7e928a318f9c82fe6b5fae4db53c020b4211[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 11:08:35 2026 -0400

    Added transitions between main menu phases

[33mcommit 5ea665f86ac6052084a50eee75870073534a3bf8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 10:45:09 2026 -0400

    Added animations for modals and dialogs:

[33mcommit c2f050885b5a731f9dfcc8fed09c2b5ef277c4b1[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 10:33:44 2026 -0400

    Startup animation fade-in

[33mcommit 5cc26693d9ff004c54cb3c9e77c3290e26d25c37[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 10:32:05 2026 -0400

    Tileset loading overlay

[33mcommit c4002329497cfff904d93704f96149668c0eeffd[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 10:17:39 2026 -0400

    Settings minor text tweaks

[33mcommit 67d56799b81cf898b240b1db718a6b17a48f552c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 18 10:11:39 2026 -0400

    Dramatically reduced portable startup time and added splash screen, and initial app loading handling

[33mcommit e8980f51bf5214a21c78285544bb3a5e24cc08fe[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 17 18:41:13 2026 -0400

    Moved settings to be more logical

[33mcommit 7713f852258f2db6592c1b210b7c5824b834c316[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 17 18:28:13 2026 -0400

    Always chamfer walls next to doorways in FPS mode, fixed billboards showing through walls in FPS mode

[33mcommit 7b12ba87ef579ea6f7e76809220e582089c93459[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 17 17:56:57 2026 -0400

    Fixed race condition bugs with running and player rendering. ASCII player color is green again, and no more flicking player sprite in front of the player in FPS mode.

[33mcommit b7f5808dcd6c1d3a8ae1104d555a95cb62c5e6dc[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 17 15:06:16 2026 -0400

    Cancel direction input by clicking elsewhere

[33mcommit bc71b2f4f404ec9fdf0f56189970b7789af740ba[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 17 14:58:19 2026 -0400

    Updated base font size on desktop to be larger by 2px

[33mcommit bd7914b0b52730ac6a63c727520e69ebefe73f3a[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 17 14:41:33 2026 -0400

    Direction modal updated to be in-world arrows instead of a modal covering your character

[33mcommit 1614e2fe88a0ca4d1abea0571b6e0aa2c12d2219[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 13 07:36:19 2026 -0400

    Many tweaks and fixes for Vulture mode first release

[33mcommit 75cc946836603989a5c6cf10c207a0a41a56bd02[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 12 22:22:17 2026 -0400

    Disable Vulture debug panel in prod mode

[33mcommit 357230ac7866ccd9cba36e4f5712931e701110a3[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 12 22:09:23 2026 -0400

    Added camera relative 'which direction' modal

[33mcommit af872da074a780d9a8519abd252c77fd3d26e79f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 12 18:39:55 2026 -0400

    Added tiles to menus (vulture mode)

[33mcommit d65a04f51cc67f0f62badc44224b5319f75f8fa8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 12 17:57:00 2026 -0400

    Fixed Vulture room style stability and floor decor placement

[33mcommit 31f79e776de8afd5f3e5fdc6ad95d801777e0cb0[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 12 14:32:20 2026 -0400

    Fixes to tile selection of closed doors

[33mcommit 24ff0c984a59cdb29eb4c2f6d31b791ec0ca1c4c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 12 13:37:50 2026 -0400

    Show tile highlight on the floor, and added raycasting logic to better resolve the intended tile for a click/touch

[33mcommit 513061f8e2e3e56d7f8e966a364580d73cd27079[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 12 11:48:00 2026 -0400

    Updated default camera angle for vulture mode

[33mcommit bde1323b585572da55e41b8b7f67faef7d8d9a33[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 12 09:48:04 2026 -0400

    Updated monster/items render scale

[33mcommit 94058e6ce5e4cf20843f1f92d123d23fe19fe7a2[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 11 21:13:37 2026 -0400

    Fixed rendering order of vulture doors

[33mcommit c08ccd5537c6684e54c30c69e4cd9b79da0bb94a[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 11 20:53:58 2026 -0400

    Fixed door offsets and rotation

[33mcommit 7412516bab3fb9922e933201e5d12cacef29733f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 11 19:18:10 2026 -0400

    New defaults again

[33mcommit f1253e5bb2305f89041779b0bd567c55e87196ac[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 11 19:11:23 2026 -0400

    CLeaned up gap in textures with better default values

[33mcommit 34a0a95860f794c7ad9fc912b42fde77c2e9c9ed[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 11 18:45:06 2026 -0400

    Precompute Vulture tile processing to save on performance

[33mcommit c483f3cb4940ef4e10262ee57e8c0c3f487fd4bd[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 11 13:08:59 2026 -0400

    Better vulture logic gating

[33mcommit f9850f03120ec95698b8faa7662df734c965d792[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 11 12:55:45 2026 -0400

    Cache object to vulture mapping once at start of game for performance

[33mcommit c8e676eb13bd9be42f56f7e7e3e17340a240ece3[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 11 12:47:37 2026 -0400

    Fixed object rendering in vulture mode

[33mcommit bd468756ff11c16bbdba283883646f854945e9f0[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 11 11:55:45 2026 -0400

    Door fixes

[33mcommit 6734d11154387bb565f22d88136a829e30d003ab[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 11 11:39:33 2026 -0400

    Fixed open doorways in vulture

[33mcommit 98dbc68617c9dac74992bfde80325645b69175c7[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 11 10:59:49 2026 -0400

    Fixed special case handling for ground tile billboards in vulture mode

[33mcommit 5d1b5c3ece205cbad7dc82cd8ea24627e77131fc[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 11 10:33:16 2026 -0400

    Updated wall and floor logic for vulture mode

[33mcommit 4fec6ecb58f613ea600c92cb63018cbfec3c02b1[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 11 09:33:08 2026 -0400

    Billboards standing on the ground correctly

[33mcommit 4c8d27bad930fd9f74181d2ce40fafd9d7352143[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 11 08:40:13 2026 -0400

    Fixed transparency issue with billboards

[33mcommit a6272987491462ca46f80dba59657e01c01c8975[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 11 08:32:49 2026 -0400

    Back surfaces of walls fixed

[33mcommit d4b9bcc540ed5e66f2e0b3f9f138cafc90f49124[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 10 21:08:04 2026 -0400

    Very close to correct wall rendering for Vulture

[33mcommit ff1aaa6c3634d5e3bb56e98245751b54c9b2cf03[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 10 20:06:54 2026 -0400

    Fixed floor gaps

[33mcommit 5eb7adce2e27f98978fcd53ea44a9ca6f470e3b7[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 10 19:59:29 2026 -0400

    Vulture walls looking good

[33mcommit 9749048ae77aa619cbbe6b5b822a9540ce645805[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 10 16:07:01 2026 -0400

    Updated README.md

[33mcommit 8fe717b624c65191f797c39703a81de660c03af4[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 10 16:04:59 2026 -0400

    Updated README.md

[33mcommit 4fa334c717158597f3c015c36b503c42432f6fa6[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 10 16:04:28 2026 -0400

    Updated README.md

[33mcommit 820a23c13a08d7712623df2c514335382a4033da[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 10 16:00:39 2026 -0400

    Updated README.md

[33mcommit a777a5d9b5b8adb5de0d8e6a1cd7b05c3489f8f4[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 10 15:42:36 2026 -0400

    Updated README.md

[33mcommit 277d8e6e4bbe14209f1e72bc09c0d88c99050811[m
Merge: 5476af9 7254af4
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 10 15:40:23 2026 -0400

    Merge branch 'main' of github.com:JamesIV4/nethack-3d

[33mcommit 5476af9e7d8e783e3e2156627659cdce04c12a47[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 10 15:40:15 2026 -0400

    Updated screenshots

[33mcommit 7254af4adcd7e5c378527d83c1cd8347e3912ff6[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 10 15:07:55 2026 -0400

    Update README.MD

[33mcommit 68cd6c0cf3c4c2bfaa8491abc824f29220afd712[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 10 15:07:21 2026 -0400

    Update README.MD

[33mcommit 182f5f77e6c23345e603b485d7ff00f09a675316[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 10 13:48:58 2026 -0400

    Updated sounds

[33mcommit 84eb9ed3190bbe6713cb210392cfcc19314b97f2[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 10 13:38:41 2026 -0400

    Updated sounds

[33mcommit 42792533ed5190e12952881699b7878d60e577fa[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 10 12:02:07 2026 -0400

    Fixed Quit button not working on Android, blood order updates

[33mcommit 6eb4feb343b0ee1960837f68fd8f3811111be56e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 10 11:40:40 2026 -0400

    Fixed single item container looting not working, CSS fixes on mobile

[33mcommit db4e98debc2f8b15eef5f9c0af605e2016d5dc16[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 10 11:17:34 2026 -0400

    CSS fixes

[33mcommit 6595d4016b37066b4d125bc7a60cc72b4aea1e09[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 10 11:08:56 2026 -0400

    CSS tweaks

[33mcommit 2c0888853f69e61852325ad2e2f63c94bf6aa4f6[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 10 11:04:39 2026 -0400

    CSS tweaks

[33mcommit d738858e390d3c3e2e572dcc9e22c9d876df9ce2[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 10 10:40:12 2026 -0400

    Upped version

[33mcommit b695c95a2e2f721b38027b9ec182c7448240c464[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 10 10:38:10 2026 -0400

    Last fix to the branch display system

[33mcommit cc1b34725ae49dfc9f44b0c7ec87b0cf9885ce19[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 10 10:25:38 2026 -0400

    Display branch names in level depth area

[33mcommit e2a2c36af2ef90840b34784c84a63e7fa20bc6fa[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 10 09:25:37 2026 -0400

    Fixed dungeon caching system

[33mcommit 51562920fa4a3ba67e8e69bd538bcf8e7fa8e4f9[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 9 23:15:48 2026 -0400

    Display area names

[33mcommit 237ff6218cef67e344abdfbdcf20dcb8bd04f0f8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 9 23:07:49 2026 -0400

    New cast modal

[33mcommit fddf760414fcc4b80c1de5b003373961edc51953[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 9 22:27:30 2026 -0400

    Display more statuses

[33mcommit 5f158a969db6ac876100bc71fa7e851ea91509bd[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 9 20:33:06 2026 -0400

    Fixed missing extended menu on FPS mode

[33mcommit 1f4a6b3e2fc00da4bf0c2893533bb91c41088453[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 9 20:28:25 2026 -0400

    Select all added

[33mcommit 5a3414752ed22656f1e1d92879fbe1ee6362db56[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 9 19:56:51 2026 -0400

    Updated level names and level name cache

[33mcommit d1310b0dee85cf3dc0949895065b667a3f1e8f91[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 9 17:56:05 2026 -0400

    Added 'Info' contextual inventory command to show item's description

[33mcommit 3cc8dc2133fedd195eb62643df5ff5af5304f53d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 9 17:34:55 2026 -0400

    No keyboard input when in options menu

[33mcommit cd14e5dd8668965a6bbf15cadba554dc80f5bdfc[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 9 16:42:23 2026 -0400

    Added many new contextual commands, and fixed name auto-selecting the item you contextually asked it to name

[33mcommit 498e1a2af74682e945943eff2e015219260ad365[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 9 15:20:36 2026 -0400

    Added rub to contextual actions

[33mcommit 64b15e5413eeddd398eaaaa246a12a560d5bf68c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 9 15:05:44 2026 -0400

    Removed delay to glance to test if it's fixed after callback changes

[33mcommit dc97183ca05da352021789e5c1ca54cd70875397[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 9 15:04:38 2026 -0400

    NetHack 3.6.7 shim and callback/runtime cleanup pass

[33mcommit 9e9ea9de264d1534d2c586de9436b12c281d8c92[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 9 14:35:10 2026 -0400

    Fixes between runtime and NetHack contracts, adding back support for Ctrl+m for last message and also adding NetHack's Ctrl+p command support for message history, with various fixes to movement runtime handling and safety for edge-cases found there

[33mcommit 32886fc1d8d81a4e760e1dce0b370808ad7737c7[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 9 10:31:53 2026 -0400

    Keyboard nav pass on inventory

[33mcommit 036486702a0bdafc958bdbbb87c047fa44edd72d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 9 09:13:44 2026 -0400

    Finished autocomplete system for extended commands

[33mcommit 869272d7832ccdb198c095fd5114148008a0bd37[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 8 19:12:09 2026 -0400

    Fixed Alt+f4 not working on Windows client, and quitting also now works on Windows client

[33mcommit c5a60476b72cb269380584a38489cd75fc212eeb[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 8 19:04:49 2026 -0400

    Fixed Windows runtime error, replaced system confirmation popups with in-game modals

[33mcommit 5f6f3d1562de182eb5162c757bda45345c7809e6[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 8 18:45:36 2026 -0400

    Wizard mode menu progress

[33mcommit cb0495144e926454e1d8362b973b1426a7951487[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 8 15:19:49 2026 -0400

    Corpses in doorways can been seen and eaten with contextual commands now

[33mcommit b3df422b6e611c0bab69f42bc815d0f790c1cd7d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 8 14:32:59 2026 -0400

    Fixed modal positioning issue on desktop main menu

[33mcommit 5c41d08359941eda48cc18f3e714810f009c5fba[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 8 11:42:52 2026 -0400

    Upped version

[33mcommit 168d5f0913e0b6948f089bd772c385612536a5bc[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 8 11:42:15 2026 -0400

    Fixed init accordian scrolling region height issue

[33mcommit f02a808952d4168f8de8667d56fb16e520a18666[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 8 11:33:06 2026 -0400

    Fixed init options being absurdly small to interact inside on desktop

[33mcommit a80736d23da1b0da2c53f93aa4ba6a82d6053c90[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 8 11:20:40 2026 -0400

    Disable controller support on launch (game will ask if a controller is detected)

[33mcommit e73f23b5f60cd523eb7d74b786e0e396c543f352[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 8 11:15:59 2026 -0400

    Add contorller detection modal

[33mcommit 3e1924223bc8c71ac577ca87d86804b50440d3fa[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 8 11:00:44 2026 -0400

    Added handling for NetHack options that are not selectabled

[33mcommit daeba0343b9e95e92cf99aa9eeec45e6cbcce927[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 8 10:50:10 2026 -0400

    Fixes for tiles showing in menus whedre they shouldn't, CSS fixes for cut off glow

[33mcommit 98c609a6b9ff0154f7edfb760f830d565402fecb[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 7 19:09:33 2026 -0500

    Upped version

[33mcommit e6cecd1bf02476e98ee58470953413a11bd27540[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 7 19:05:18 2026 -0500

    Improvements to movement and settings interactions

[33mcommit e4bf8b59ba54528bc0dc1c137d034e6e79041a92[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 7 18:37:23 2026 -0500

    Don't let the accordian's button get squished

[33mcommit 420416a279e8785dcf59375982aabcbb5e57a6ab[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 7 18:32:47 2026 -0500

    Fixes to controller bugs

[33mcommit b15daf632c5cb9f7ad13479622cb62e24bf9ddf2[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 7 18:11:56 2026 -0500

    Finished with extnded actions menu

[33mcommit 65204cda49e9641817e87cfb5b04bdb6f1e19a37[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 7 17:35:27 2026 -0500

    Added radial action wheel

[33mcommit b139d308991ce134bebb7617664daa05d9004b5e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 7 16:45:04 2026 -0500

    Working set of controller commands

[33mcommit 596f5b6399f93c95445cb35fc0e5239af4ad33e0[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 7 14:40:10 2026 -0500

    Fixed remaining issues for mobile start menu

[33mcommit f672835673e58bc9aa0b114f5507147820745a6e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 7 14:36:53 2026 -0500

    Fixed landscape initalization accordian CSS

[33mcommit 05f8f906857105b38caa7d225d8e4a7a894e87a5[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 7 13:55:59 2026 -0500

    Fixed initialization options scrolling issues

[33mcommit da7e30ab1c199aea248b41d2c55439ba0f320b87[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 7 12:58:42 2026 -0500

    Added option to remove tile backgrounds for UI-displayed tiles, and fixed some initialization options issues on mobile

[33mcommit c13bb1b69f1e458ecc8407ab6c4e4e394eb60716[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 7 12:25:59 2026 -0500

    Menu adjustments

[33mcommit aceafb6e28167331e7b59f247106a5587ea20d73[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 7 11:53:39 2026 -0500

    Don't show tiles in menus in ASCII mode

[33mcommit 11658f3599b5722962e1094c18221f10b6285469[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 7 11:44:51 2026 -0500

    Added tiled to other menus too

[33mcommit 70657dd39e76b9dac4b381a3f8b59e994ee53394[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 7 11:27:03 2026 -0500

    Inventory overhaul ready

[33mcommit c4a5b26ea6577f2c537d606d3cfe76a7f2a95a06[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Mar 7 10:53:36 2026 -0500

    Inventory tiles and animation added

[33mcommit cbc77fe61974398b7dfed48bb62b563fc78f821f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 6 17:47:34 2026 -0500

    Upped version

[33mcommit f13f05fc550bd0b0ef47272fd03404d2447182cd[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 6 17:44:05 2026 -0500

    Cleanup

[33mcommit ef7380ecb7ac497b8c2720583e6ca8e1668415f4[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 6 17:42:47 2026 -0500

    Better fountain sound handling

[33mcommit f8257134221d97e431bfc871b54f8099de497b0a[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 6 17:15:39 2026 -0500

    Added multi-drop support

[33mcommit 3cf40d4202ec746d06259c9794d8033539e975a3[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 6 17:10:34 2026 -0500

    Added RZTiles to tilesets and added nearly-straight camera auto-straightening after rotating the camera

[33mcommit 9c62b0c23f4ddb882d03815967b23afeacf3c20a[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 6 16:45:36 2026 -0500

    Show xp gains by default now

[33mcommit b907629349e8677093d2b8c27cd8469ac8e588ac[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 6 16:44:19 2026 -0500

    Upgraded the Enhance menu (leveling up skills)

[33mcommit aeb91cf7082f38b7ceb19496e33c9ca8a41ab712[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 6 16:04:39 2026 -0500

    Added Character menu with a bespoke UI to see character stats and actions

[33mcommit b5c1c79be7fb7ac81c5a8f1da7f1eae97447a703[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 6 14:53:47 2026 -0500

    Wizard (debug) and explore mode are available now

[33mcommit ae344f3b8585b35bca53a9249a968a2028a57dbb[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 6 14:47:58 2026 -0500

    Added initialization options

[33mcommit b0c34fde6ba6309b2c19e2fb86a12fa3c748d74c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Mar 6 14:33:47 2026 -0500

    Added init options

[33mcommit a103ff602cade99d45bd26008d74859737fe2221[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 5 14:09:41 2026 -0500

    Simplified release naming for less manual work and room for errors

[33mcommit 11fd403fc0ae888b846dff5afc94ce65a2b2b38e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 5 14:05:01 2026 -0500

    Fixed stat and damage numbers sometimes not appearing, reduce stacked stat change height

[33mcommit 060d4638c5a5ca84b814eaf9e99c2d978a750996[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 5 13:56:26 2026 -0500

    Fixed loophole preventing stat changes from showing up

[33mcommit 37bbad9491000669449cdb96c8d6b954eca61681[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 5 10:32:29 2026 -0500

    Upped version

[33mcommit 4b0c67c281696834775582f78a3617c65d1120ee[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 5 10:31:41 2026 -0500

    Negative XP supported now too

[33mcommit c6d6bcc54ded3eb16a3e2bd1e04db27b33dd1907[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 5 10:28:56 2026 -0500

    Stats added as a floating update above the player, and optionally XP gains as well

[33mcommit 4cd9b47380018279a7e1afd663a8de1bf7354bd5[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 5 10:11:14 2026 -0500

    Stats system display updates

[33mcommit c679ed108f41f5cbe0b4b425b33166d356a4ac43[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Mar 5 08:52:27 2026 -0500

    iOS audio fix

[33mcommit 7c97148598042cc0c03e2b003463221c734bd4db[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 4 21:33:16 2026 -0500

    Upped version

[33mcommit ab0c884fbe556000cc1632df4d1d45a716f9bcdc[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 4 21:27:46 2026 -0500

    Updated sounds that are in so far

[33mcommit 527ba6b0fbc441af176ef22a269812b25bf9dc83[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 4 20:43:54 2026 -0500

    Fixed sounds on web deployed version

[33mcommit 265782473c3e194941f4038f8b56e7634bf4ac68[m
Merge: 01c477d f766292
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 4 20:35:46 2026 -0500

    Merge pull request #12 from JamesIV4/add-sound
    
    Add sound

[33mcommit f766292a26dbb6626983495bbaf0670902e0d316[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 4 20:35:18 2026 -0500

    Added default soundpack

[33mcommit b1962c77730c622d42ea3c23fc4f0edea6126adc[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 4 19:57:38 2026 -0500

    Added many sound effects

[33mcommit 9fc9af7e5207db48f91b18fa2549620b5e0c9874[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 4 16:27:33 2026 -0500

    Movement sound in a good place

[33mcommit aad340aa77c34439fa2ceb88b4543777204c8743[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 4 13:12:43 2026 -0500

    Logic updates for confirm and cancel buttons on sound pack page

[33mcommit dafaf22a3d1974686f27cb10570bcf239d6ec08b[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 4 12:54:07 2026 -0500

    Settings CSS updates

[33mcommit f012f4d4ffc44a381749fb074f76cecb3bb367da[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 4 11:29:55 2026 -0500

    Added glow to show when there's scrolling content

[33mcommit 16360ac5a4b5ecb93f66e6442241084cf51b0bbd[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 4 10:16:00 2026 -0500

    Minor tweak

[33mcommit 380fd93abe8b0016da06ddb8df5f2eb966365404[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Mar 4 10:12:48 2026 -0500

    Added FMOD and settings overhaul

[33mcommit 01c477d5c1aaa62bc6b1a88ce9fe55e5cbd3adc7[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 3 21:48:21 2026 -0500

    Updated electron setup naming convention

[33mcommit 8f19822332c5c3f22aa292d4a923516d7e3b4fcf[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 3 21:46:48 2026 -0500

    Updated naming convention or electron portable builds

[33mcommit 1c6621dc7f414e52d716789d32d180f456ec30c3[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 3 21:35:18 2026 -0500

    Version up

[33mcommit 71544eaf4ea741b282b7d25b9277856badc0712b[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 3 21:34:26 2026 -0500

    Fixed selling

[33mcommit 3c345cd8c17ae0a81ec2a55ef9e6d82f2a030108[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 3 20:26:11 2026 -0500

    Fixed monster shatter making invisible monsters when similar ones move into the same spot as the killed one

[33mcommit f97689aba1a8757a2c9d24268221044b5a2988de[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 3 20:10:17 2026 -0500

    Fixed click move zooming character from one side of the level to the other too easily

[33mcommit 9bcf2e22edcbdb9b47cecd58c8ed5c2a12202660[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 3 19:58:04 2026 -0500

    Disabled map_glyph batching now that performance is better (might prevent weird rendering issues)

[33mcommit faaf88a1c3d8afcd96f5d4bf54d8d312e42390d8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 3 19:34:06 2026 -0500

    Fixed Desktop panning

[33mcommit 1290428d791cc6d152008a94937c33ee8b3330d7[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 3 08:42:50 2026 -0500

    Fix flashing ASCII in tiles mode on hit

[33mcommit b0106b840cfe145872c035676bdd9d1a48449cfa[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Mar 3 08:33:32 2026 -0500

    Workaround for contextual action race condition until flow can be debugged better

[33mcommit d92236ebafb396dc0d1dec9c996708bde3952e1a[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 2 23:17:17 2026 -0500

    Settings updates

[33mcommit f31087309e3ca4c0c747f2e8ea80161fd91dc646[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 2 23:09:51 2026 -0500

    Better blood settings

[33mcommit 4c0b1cad501a758966eb86798d6ef7acb305911d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 2 22:53:57 2026 -0500

    Always flatten floors under elevated tiles

[33mcommit b8d17106a706d459f04f9955112de5fc507bdd3f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Mar 2 22:46:20 2026 -0500

    Added monster shatter effect

[33mcommit 1f97b70827d9033fbaafb09c89e2bc2c973b3553[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 1 23:38:10 2026 -0500

    Fix startup crash on Android

[33mcommit a4e7163d38bd9fb00a5e7aa854339284db2d19f4[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 1 21:27:07 2026 -0500

    Fixed a dark tile rendering issue

[33mcommit 9966cfbd83342c9ef1851687e73460a2c4fdbc0e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 1 20:03:06 2026 -0500

    Plugged pet loophole in dark tile rendering

[33mcommit c3d4b57cdf9bacd267f023397fe601ec33dd7403[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 1 20:00:48 2026 -0500

    Fixed boulders preventing dark tile dicovery

[33mcommit a0039dcb8314bb38f307a49408b78205ec600531[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 1 19:30:13 2026 -0500

    Always request real tile data instead of using the saved cached data

[33mcommit bb1e19f3aa75f80c1874c20a2e4449032ac43d04[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 1 19:11:39 2026 -0500

    Added help files to imported section

[33mcommit 335072a3cc46a7e37a4ae0bc8e1d3324c364bd41[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 1 19:04:05 2026 -0500

    Fixed build issue

[33mcommit ad49aef9004e6794122391b170b4a452524b1293[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 1 18:44:24 2026 -0500

    Move contextual dialog up some

[33mcommit 50e9d38233e141ceb84659ac87bf1757cfbe7fae[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 1 18:29:19 2026 -0500

    Added contexual action menu on right click or long press on mobile

[33mcommit d25a64facf25ec548dac82feb7bb8bb0d89208b7[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 1 17:07:05 2026 -0500

    Fixed Extended commands list

[33mcommit 548279a2d256cf5e19df7b4a5d179b547fa38a9e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 1 17:00:28 2026 -0500

    Added support for NetHack help display methods

[33mcommit 79588180fd2a7e75b120a635008b2f56ca9716ff[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 1 16:35:14 2026 -0500

    Button font size up on mobile

[33mcommit 58501675233f149ebb67d972a7135389dbc7c72f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 1 16:26:55 2026 -0500

    Fixed stats bar in very small mobile views

[33mcommit de752a7abb59974deb3306563b57674946adaa82[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 1 16:13:31 2026 -0500

    Added font scaling

[33mcommit 8129b9e6f6de3f69bf55a809f7245931c969905f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 1 15:25:40 2026 -0500

    Main menu CSS pass

[33mcommit 6d6966eb9674cf50d025c28d008d79b69d3ef819[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 1 15:12:19 2026 -0500

    Refined settings CSS

[33mcommit 460ed70e7e8df29f967828822c31b4deebdb04b4[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 1 15:07:18 2026 -0500

    Mobile CSS improvements

[33mcommit 4c228a246bdd70726410fdb5e9e458b17c9df71d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 1 14:49:35 2026 -0500

    Removed inject message dialogs for inventory actions

[33mcommit c3fa74e46a174dfe37bbc0e38e3062881a0df956[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 1 14:43:54 2026 -0500

    Made live message log timing adjustable

[33mcommit 93e7f39e6c3c5bbaf1d0a5dee19b06c4262c3508[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 1 14:27:19 2026 -0500

    Removed 1400 lines of code from old JS UI, removing duplication cond confusion

[33mcommit e04d4f3b30dc660272b638d9c5f43d00086837e9[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Mar 1 14:04:54 2026 -0500

    Revert "Fix for selling on mobile"
    
    This reverts commit 484fd98fcb5d571cd3cec813602f3c09a2eb91d7.

[33mcommit 484fd98fcb5d571cd3cec813602f3c09a2eb91d7[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 28 22:17:58 2026 -0500

    Fix for selling on mobile

[33mcommit 70acc681c9d91f7cf0bb53fc2d92fe7b88445ae0[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 28 22:05:41 2026 -0500

    Fix again for iOS PWA resize issue

[33mcommit c4a525b1085e78f902161e262adebf3b71908912[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 28 21:43:03 2026 -0500

    Fix for rotating screen causing the player to fall off the screen

[33mcommit 203eab43a27292f1a77b3ad3b966a8c899c1a41d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 28 21:30:56 2026 -0500

    Fix for Android

[33mcommit 789e3069d12953349bd4fef8dd533c474a174990[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 28 21:29:14 2026 -0500

    Revert "Fix for bottom safe zone issue on Android app"
    
    This reverts commit f5133b5d878531a421da44c219c3984c3d83d06a.

[33mcommit dc6f7857c74154c9aa08d44692db67fc721dccad[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 28 20:38:47 2026 -0500

    Revert "Fix for PWA iOS padding on bottom bar"
    
    This reverts commit 8b1665e95d9b8b343af82b90c9394ec097d21395.

[33mcommit 8b1665e95d9b8b343af82b90c9394ec097d21395[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 28 20:34:44 2026 -0500

    Fix for PWA iOS padding on bottom bar

[33mcommit 34ba083d89702ca2bbaab3f609ada5f6a6101731[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 28 19:01:44 2026 -0500

    True fullscreen on Windows desktop

[33mcommit d949149750159cd533da0709c1ab8985ef8a7452[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 28 18:51:23 2026 -0500

    Upped version

[33mcommit f5133b5d878531a421da44c219c3984c3d83d06a[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 28 18:48:13 2026 -0500

    Fix for bottom safe zone issue on Android app

[33mcommit 64181d48ff693f38bd13ba0aa4a742c7d7bde335[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 28 14:20:36 2026 -0500

    Fixed dungeon overview not showing up at game over

[33mcommit ad923f2e8bd1f92fe41283c2ba9f8bc6529a3b03[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 28 13:14:24 2026 -0500

    Fixed random game mode after adding saved games and game loading

[33mcommit c370bcff4afd0e35e6d7be1b39a9a9b98ef05ba7[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 28 13:00:30 2026 -0500

    Added engrave and dip to contextual inventory action commands

[33mcommit 0eddf23b728fa06f07198bfd10893d836febd05d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 28 12:13:08 2026 -0500

    Fixed ring finger dialog

[33mcommit f89b1532f31b0817baf4c6ff826564ca85a501ac[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 28 11:30:16 2026 -0500

    Pause menu and saving are accessible on mobile now

[33mcommit 0b3e42e88411ec4460c70cd43be6b88bb92b3c12[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 28 11:26:08 2026 -0500

    Added pause menu

[33mcommit 79f0e7d4e27f669ab3b7557b7e492b269176010d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 28 10:44:41 2026 -0500

    Added save delete button and blessed and cursed item colors

[33mcommit f1fe5f5362028d16908e81223d334e3a2766802a[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 27 22:44:47 2026 -0500

    Fixed random character not being random after adding save/load

[33mcommit 0e51d7ef904da387fa1eca33aeee924cf79b5e69[m
Merge: b58cf77 440fadb
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 27 20:48:44 2026 -0500

    Merge branch 'main' of github.com:JamesIV4/nethack-3d

[33mcommit b58cf7774acff31f268ce6c9c50d6c816a52818e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 27 20:48:37 2026 -0500

    Added game saving and loading

[33mcommit 440fadbda5a6bd7fad0c1989308d9ed1e9cbe8e1[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Feb 26 16:49:39 2026 -0500

    Update README.MD

[33mcommit 3801edd369f60bf2da4d9e5d6a30a0b6a5524acf[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Feb 26 16:47:00 2026 -0500

    Updated video link

[33mcommit 10fd846a0eb1f3b61dbaa55d00eda1d368ce4875[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Feb 26 16:46:17 2026 -0500

    Updated README

[33mcommit b98034fdfe55585012f28efae4edf5524b9c2a0e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Feb 26 14:49:28 2026 -0500

    Upped version number

[33mcommit d8fcb444e9bc19e8564acbd483aeb58757028c37[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Feb 26 14:46:52 2026 -0500

    Fixed critical inventory refreshing bug

[33mcommit e4a469bf16aaa7638dcecb0369a2995a04403741[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Feb 26 14:19:29 2026 -0500

    Fixed main menu modal position

[33mcommit 9528489fb4be229b8c471b0c5e431378ff730d05[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Feb 26 13:58:45 2026 -0500

    Fixed chamfered walls' ambient occlusion (FPS mode)

[33mcommit 9e30fe1802cd4ff86f52eb7d8be58bd01780642c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Feb 26 13:49:06 2026 -0500

    Fixed several bugs around walls rendering

[33mcommit 86364fd836ba04dfd50b9d9aa69de85ac9793457[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Feb 26 13:33:15 2026 -0500

    Make ambient occlusion darker in FPS mode

[33mcommit 78ed84b7cf8d13b6a0904417f6cde40046919793[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Feb 26 11:45:54 2026 -0500

    Added ambient occlusion

[33mcommit 8eee975402068b8b4f15218c2cbf7905ffd0afe8[m
Merge: f287d22 e121d09
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Feb 26 11:05:03 2026 -0500

    Merge branch 'main' of github.com:JamesIV4/nethack-3d

[33mcommit f287d226b5363691471a882b3997d07e9ceea21f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Feb 26 11:04:54 2026 -0500

    Added settings for flat colored inferred dark corridor walls with or without a grid per tileset

[33mcommit e121d09c94b0f4c49c9d81ff43c270e6bc7d8724[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 25 20:15:44 2026 -0500

    Update README.MD

[33mcommit 95b2fc84d660398b3c6b4e4787e65d361a5b444f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 25 20:14:36 2026 -0500

    Update README.MD

[33mcommit ec298df4f3b48bbd58e5bc6721d7d4675d3b86c9[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 25 20:13:17 2026 -0500

    Updated README

[33mcommit 399e0f5888824eedff73f697da54525f6f57159b[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 25 20:11:57 2026 -0500

    Updated with Android build files and app icon for iOS web app

[33mcommit 4b75db1092963b1a0429783171582b4698d21e67[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 25 18:49:59 2026 -0500

    Updated README

[33mcommit 748b186a3d35a488668f13476cfb0d265658e634[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 25 18:09:47 2026 -0500

    Ready for Windows release

[33mcommit 30e1bd312e69d797e3c7da5126c96d68a594a17f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 25 17:17:59 2026 -0500

    Fixed engrave and all other extended commands not working in FPS mode

[33mcommit 374c0debf7f3663cc252bc6e1a794f9959bca078[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 25 17:13:29 2026 -0500

    Added Electron for Windows builds, and did major cleanup pass on game code

[33mcommit b9cd3ce4b1f1a2657c2cbac51cd31ff88158071b[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 25 14:47:20 2026 -0500

    FIXED wall rotation issues. All 3d blocks look correct with rotations and offsets applied as needed

[33mcommit cb1a77a7421ba1c01d0d8013131283dfbc9f9e5d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 25 12:51:10 2026 -0500

    Modal polish

[33mcommit 9e68580963b816791cde4e37772765a268146631[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 25 12:26:25 2026 -0500

    Better keyboard focus handling

[33mcommit fe500095d10452087ec32134bda58335c46e1242[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 25 12:02:37 2026 -0500

    Updated dealth flow to use proper player inventory screen

[33mcommit fceb17e4d39501869604177ac1b75827f830fada[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 25 11:09:45 2026 -0500

    Mobile style updates

[33mcommit ffa41b04f27a60f996bfe23e866497e7998e5285[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 25 11:05:34 2026 -0500

    Fixed tileset name issue

[33mcommit aa14384d059dcbaec18363f36cb1573e25a1f497[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 25 11:02:52 2026 -0500

    Tweaks to form

[33mcommit bc74a8d07d6913caa4b641c246f6463233cf4a93[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 25 10:56:25 2026 -0500

    Revised tileset management stuff

[33mcommit b506958bbacc2f9c3632c709d42f1aeb529abdc9[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 25 09:58:12 2026 -0500

    Removed mipmaps and increased disktop anisotropic filtering

[33mcommit 3b26c63017b082bd81558a0020adb2521fe397a3[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 25 09:44:56 2026 -0500

    Added NetHack Modern tileset

[33mcommit b57edb3c86354083a0e4c01c685511e7515f7915[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 25 08:52:43 2026 -0500

    Tileset internal variable cleanup

[33mcommit 4b504c8038f2604b4f7667412c687eb65384ca65[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 24 22:15:07 2026 -0500

    Fixed DawnHack

[33mcommit 344096c64aa2957f0bdfeb64dce0d1ae5dae43da[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 24 20:59:16 2026 -0500

    Mobile CSS fixes for options menu

[33mcommit 68e939dd33f5d527c21ed412703802a894811258[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 24 20:03:50 2026 -0500

    Added path for user to get back to starting a new game if they said No

[33mcommit 7babd3fb9198bf5d88577195d2b5a6462989cfd7[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 24 19:57:42 2026 -0500

    Fixed user-uploaded tilesets being reset to default tileset upon refreshing

[33mcommit 03f187d5bd917dd59da0c3bc8e20688ceb0902a7[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 24 19:54:12 2026 -0500

    Added ability to upload your own tilesets

[33mcommit 2b187bb18426aaf008b88a4ba4e38572d0b7b63a[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 24 19:32:50 2026 -0500

    Added color-based background removal as an alternative option

[33mcommit 00d033527eea91c1bbeae3d74a0063ca978f0450[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 24 15:04:37 2026 -0500

    Dev tooling

[33mcommit 12c7666348e03c22dd2c4e7b03ec58d2ca11872a[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 24 14:32:22 2026 -0500

    FPS next tile movement highlight now renders under billboards

[33mcommit 4a88943e999697e7e7a97b8c1861f7b02cc1c83a[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 24 13:50:48 2026 -0500

    Added 2 more tile sets, DawnHack and Absurdly Evil

[33mcommit 97800ab7e410993183943f6c44f334c5f06e759f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 24 13:29:49 2026 -0500

    Added tileset background removal picker

[33mcommit 6bd9b19caa727bc4c09c3eb8b066800137b2b72c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 24 13:01:08 2026 -0500

    Added dynamic tilesets

[33mcommit f5f5bc288a5ddfa71aac8c0e3300c6c3cf2e3444[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 24 09:23:23 2026 -0500

    CSS updates for mobile

[33mcommit 516574ef7a5b30faf954f5d35cb3657701c82066[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 24 08:35:46 2026 -0500

    Updated dialog/modal CSS on mobile to stiack to safe zones

[33mcommit f62f1de558d528d65ec679323a73713b3db3f279[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 24 08:26:08 2026 -0500

    Added inferred dark corridor wall tile texture override system for NetHack 3.6.7

[33mcommit e848dbe63959e2fe6b5ffd516b46979c728154f4[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 23 21:16:13 2026 -0500

    End game fixes

[33mcommit de2c83a0024a5af63060e046de0f5fa2bf3658f9[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 23 20:32:01 2026 -0500

    Added new game option and better resolution and options on desktop

[33mcommit 41c36eea428140ad09487031d1a0f4ae173d6fdd[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 23 18:40:53 2026 -0500

    CSS fix

[33mcommit 4ba8451e4e4b77c142501a99d56caaadd847a14b[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 23 18:23:24 2026 -0500

    Player damage rendering fix

[33mcommit b7462deb7b27fad060aec5842fabceb1b63a4d53[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 23 18:11:50 2026 -0500

    CSS and damage display fixes

[33mcommit 9cb8fafe3fbf51a2ecfb2177e537c208800cb75b[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 23 17:24:02 2026 -0500

    Added inverted Y axis look option

[33mcommit b74907fcff88ae69d88bc5c1f96e7f84807a1fe0[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 23 17:14:19 2026 -0500

    Reversed touch and hold to pan direction and added option to configure that

[33mcommit a054bca3db5b2e549223878cb86bb71a918acb53[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 23 17:08:10 2026 -0500

    CSS fixes

[33mcommit 719c69b9ea5e6e37318dfec55013aff0418820e8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 23 16:43:10 2026 -0500

    Fixed character damage effect

[33mcommit f71d68ed804e1a5bdc7c91e29df00cd5a8ab7add[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 23 16:14:18 2026 -0500

    CSS fixes

[33mcommit c6b9a89ba90dda006ae7eb74093c1befbf7e3bdc[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 23 15:37:44 2026 -0500

    Made blood pixelated

[33mcommit b1728c313eca0fe44d060d7ba0514f02d5a2aadd[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 23 15:31:00 2026 -0500

    ASCII FPS mode regression fixes

[33mcommit bcbdc848efafec5bba7210143d3cbbc29e9c3009[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 23 15:21:30 2026 -0500

    Fixed flashing inferred walls on movement

[33mcommit 72d2f62d93e3f4637666d4c73be3deb4f1b349d2[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 23 15:00:06 2026 -0500

    Updated walls

[33mcommit 7df46c1e5a7e96b4a4539e31424b363a18bee25b[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 23 14:44:36 2026 -0500

    Added dark wall discovery based on heuristics

[33mcommit 82ef355d3defbd47638acde0144eef7c65484221[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 23 13:40:25 2026 -0500

    Made left click more contextual instead of always firing:

[33mcommit 758ddb636974c400395ecf55f53c6b65000f874f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 23 13:05:03 2026 -0500

    Alter fix and movement into wall makes player search

[33mcommit 51f3c841cd32c1596b8d4c0ddc16923d431c43cd[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 23 12:52:44 2026 -0500

    Show loot under the player in FPS mode

[33mcommit 2144d0a0e3529d78ce0b9586efefd210571a4d30[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 23 12:44:41 2026 -0500

    Fixed dark wall glitch when dicovering a monster in the dark

[33mcommit ded9f826724ba37649f3aba769b7d070f808d471[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 23 12:36:28 2026 -0500

    FPS mode fixes for tiles under the player

[33mcommit 4a1e0f00c0ed0237a490b1a8b92753526cd2014e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 23 12:28:27 2026 -0500

    Fixes

[33mcommit 71606d573b21a2bb5a91c425e1cd9fb5e4516ba4[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 23 12:09:39 2026 -0500

    Better inventory message flow

[33mcommit 4f523ffeebbf8c721515da75f9ff1508d71ce4b9[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 23 12:00:18 2026 -0500

    Many logic fixes around contextual actions

[33mcommit c0947c784a18cdfbee1586c9e6f7358667474760[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 23 11:23:24 2026 -0500

    Many tweaks to contextual actions

[33mcommit 3eae07aed37c291eb7dc9c3988920ff68290a744[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 23 09:27:04 2026 -0500

    Fixed CSS issues

[33mcommit 2b8367fe64e31aa44e6f0d48afca7eae20ad1347[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 23:30:29 2026 -0500

    Removed bugs

[33mcommit 8386bf90f980a367ba2e3f54c071f029563b0159[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 23:07:06 2026 -0500

    Repeat button

[33mcommit ebee6cd41708373dac98ce1e41e6c6fde7050c8b[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 22:35:07 2026 -0500

    Fixes

[33mcommit 77f22980a257ca9130626996070f5b2e2732a7ec[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 22:21:11 2026 -0500

    Run mode added to mobile FPS

[33mcommit e02ff6294d87e15ac181e9f8ae8256663e4cd2d8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 21:35:03 2026 -0500

    Fix

[33mcommit 1fe2c1d8062d4a76ef241760a0c4f3c86df841bf[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 20:24:34 2026 -0500

    Fixed floor under the FPS player

[33mcommit c1df891aa3e2aed76c077df20639fa876640e9e5[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 17:59:35 2026 -0500

    Fixed minimap regression on mobile

[33mcommit dae124410bf651043ac0a38e2bb4fea6f8e13ae9[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 17:54:41 2026 -0500

    Fixed regeression for FPS input and kicking

[33mcommit 51bf7cec2c37199ba2bd4291e87f7dfc02042a76[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 17:32:14 2026 -0500

    Fixed chamfered walls in FPS tiles mode

[33mcommit 890d2223f0bbc672191f63a60c11a618d5f4af7d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 17:16:59 2026 -0500

    Added touch panning on mobile (hold half a second to activate)

[33mcommit 7c875742d19d564cd5440434ccf1f1fa2c41ae59[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 17:11:26 2026 -0500

    Lots of new features

[33mcommit 3716ad849744cd1f8adfc5f86f3ba8fa3117534a[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 16:52:42 2026 -0500

    Fixed direction keys in FPS mode, always should be relative to the view now

[33mcommit 280fcc89cf7b8298e0b593935970fa56f8234c5e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 16:49:26 2026 -0500

    Fix for FPS move highlighting in the void

[33mcommit 6c7e474b155d4f5de0d3089190025274e926d063[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 16:41:45 2026 -0500

    Mobile bottom actions sheet CSS fix

[33mcommit 7ef84a25e1b1575f96e16dbbc2cfc46ae85b93cb[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 16:35:19 2026 -0500

    Fix for inventory not updating bug, and a CSS fix

[33mcommit 2291e45a03e760797f15bccb6bd7f9bff154ce29[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 16:21:46 2026 -0500

    CSS cleanup

[33mcommit be2d4cc91d43599cace14e73f086d154a0e7fc52[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 16:18:08 2026 -0500

    Mobile fix

[33mcommit f62ebaa73b66bdd2c209ee8eb6cd2a2198ce01ed[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 16:16:28 2026 -0500

    ASCII tweak

[33mcommit b6e1552ccef91b5894c9209d94ce4d21d9356078[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 16:15:50 2026 -0500

    Testing mobile CSS fix

[33mcommit c49be5565ec1f3d70d1495157f1b86716beaacb1[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 16:09:21 2026 -0500

    Mobile cleanup

[33mcommit cfcdb9dc6c166d903ab7d42a88f72f9ae13b8f30[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 16:01:01 2026 -0500

    Fixed mobile CSS issue

[33mcommit 755253bc624c47f069ee483793f7502a54bf09c9[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 15:51:09 2026 -0500

    Added mobile fix

[33mcommit 0030455689ae92330ba56e5b7c569a70d99e43a0[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 15:46:30 2026 -0500

    Testing iOS issue

[33mcommit 6b9993e94a2b9815b407b18b252aaf22ed967c9f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 15:46:04 2026 -0500

    Testing iOS issue

[33mcommit 52cc949efe5db39ee6c4e30606ab68caa5a1d746[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 15:44:45 2026 -0500

    Fix?

[33mcommit 10f630c456de16d7048b70189df161fd69ddd9bb[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 15:39:35 2026 -0500

    Mobile CSS cleanup

[33mcommit 03a36d36064d4fae9f8a21289208c140aaf39e88[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 15:35:10 2026 -0500

    Mobile ASCII logo fix

[33mcommit 8d8cb2e46f0c3e2b97515ccbaa2c6b0bc82f3c50[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 15:32:20 2026 -0500

    Added NetHack 3D ASCII logo

[33mcommit d607885c84f2d67cb0d9d6b2e1a00e0ef7acbb30[m
Merge: 8f27260 ed0fef0
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 00:13:04 2026 -0500

    Merge pull request #9 from JamesIV4/codex/revert-last-commit
    
    Revert merge PR #8 FPS control changes

[33mcommit ed0fef0cab10d295ee378cdb0d3b4da17fe73e48[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 22 00:12:27 2026 -0500

    Revert "Merge pull request #8 from JamesIV4/codex/update-fps-mode-controls-and-interactions"
    
    This reverts commit 8f27260a378e2aecf34f6fd320bcf0fa1289d9c5, reversing
    changes made to aa9031681071d4442cf0c56692ea21cbb9141585.

[33mcommit 8f27260a378e2aecf34f6fd320bcf0fa1289d9c5[m
Merge: aa90316 843e230
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 21 23:56:51 2026 -0500

    Merge pull request #8 from JamesIV4/codex/update-fps-mode-controls-and-interactions
    
    FPS: Remap direction keys to mouse-look, support numpad diagonals, billboard raycast, and chamfered tile textures

[33mcommit 843e230e234c1f95bd38d8d5a07b005e67614acc[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 21 23:55:42 2026 -0500

    Improve FPS directional input and crosshair targeting

[33mcommit aa9031681071d4442cf0c56692ea21cbb9141585[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 20 11:10:36 2026 -0500

    Added fade-in for tile discovery again

[33mcommit 634f3c9a28b947e3f241f675eeef9d3348b56c66[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 20 10:48:42 2026 -0500

    Added FPS shader for lighting too

[33mcommit 046e5830e2168bf6e8640cadc9437b6446353378[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 20 10:05:55 2026 -0500

    Updated lighting shader to include sprite billboards too

[33mcommit 81250a64779c6a0277a062767d4bbce410bef405[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 20 09:50:13 2026 -0500

    New shader for lighting vignette

[33mcommit 824219f0a705a0cc9c9edd6189a9f3759509ddbc[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 20 08:26:41 2026 -0500

    Fixed ASCII mode not rendering ASCII

[33mcommit 671308fabf1d1dadf8a3e661c8914d9c43fec814[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Feb 19 23:49:03 2026 -0500

    Fix

[33mcommit 4f943a19b40f341dd9e3bac69c4f538297490f78[m
Merge: 2322d00 610fe5c
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Feb 19 23:45:18 2026 -0500

    Merge pull request #6 from JamesIV4/consolidate-nethack-versions-with-dropdown
    
    - Tile support
    - Much faster rendering
    - NetHack 3.6.7 now the default
    - Coming soon: up-to-date 2026 NetHack 3.7 version

[33mcommit 610fe5cf986053c9b768acc65986353ee7688dc1[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Feb 19 23:41:55 2026 -0500

    Ready to merge to main

[33mcommit 2409ee1ad7e81b8e2a7e6162ea3a041a46f3ce1b[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Feb 19 23:26:34 2026 -0500

    Fixed tile billboard regressions and door texture regressions, added statue billboards

[33mcommit 7917f9a20e110ab32c7d9c1d81380bec8d59259a[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Feb 19 15:15:54 2026 -0500

    Some updates to menu handling in 3.7

[33mcommit 521dfd56e07abff3bea3e988876141e73098d362[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Feb 19 10:11:29 2026 -0500

    Fixed more ASCII regressions

[33mcommit 956fae37f2084ee96f6dd74208cb677f292d9fee[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Feb 19 09:41:38 2026 -0500

    Cleanup

[33mcommit 76076ad55495c8096c4f93dc8306d1280912830d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Thu Feb 19 09:06:10 2026 -0500

    Fixed FPS mode ACII regressions

[33mcommit abef3bd68b7a9d4ca0e367c7149d738f2fc75f1b[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 18 23:17:08 2026 -0500

    Fixed glyph rendering in 3.7

[33mcommit ef6c6aa10a784515f81c9f5e7abc9625a616eb40[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 18 22:18:00 2026 -0500

    Fixed tilesgit add .!

[33mcommit afb49c424da93821f9a27ce5f71ac9ce5b82ad61[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 18 20:41:08 2026 -0500

    Fixed CSS error

[33mcommit 333b352e8596dcda8db483892d48c50e4357a6d1[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 18 19:54:25 2026 -0500

    Revert "Door improvements"
    
    This reverts commit 54d899e71ee4189e00bd4c20c58ecae1186f6ca9.

[33mcommit 47842ef1cfcc624648177ee14848ae4e435be3d2[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 18 19:54:20 2026 -0500

    Revert "UI improvement"
    
    This reverts commit 6fdd86ae19a696fd60a8aa88f570f75ea69e1f2f.

[33mcommit 6fdd86ae19a696fd60a8aa88f570f75ea69e1f2f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 18 19:53:14 2026 -0500

    UI improvement

[33mcommit 54d899e71ee4189e00bd4c20c58ecae1186f6ca9[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 18 19:02:41 2026 -0500

    Door improvements

[33mcommit 16bc45b3044b8813934dad29d418194bfaa9d1b0[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 18 17:18:00 2026 -0500

    Many tiles updates

[33mcommit 569251ea86424407544a2472b9384c649457cf62[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 18 15:39:52 2026 -0500

    Figured out the corpse tile index

[33mcommit f26d0ca852ac937f4a8bdc4943d8b375e133343d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 18 11:49:06 2026 -0500

    Fixed pets? tile rendering and committed necessary NetHack files in 'imported' folder so this can be run on any machine

[33mcommit 62e3b602dd41cedb5250f721b52ceb8d3bcd626d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Wed Feb 18 08:53:18 2026 -0500

    Removed force_player_redraw now that rendering and NetHack updates have stabilized

[33mcommit 987be184912f8cf8567aa99b1446eb4d576c381c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 17 21:53:55 2026 -0500

    Sprites in FPS mode working

[33mcommit 6d601ea303cc929bd5bdc35eb8b5c6268495b6f8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 17 19:45:33 2026 -0500

    Working tiles!

[33mcommit c10fe490f0c6329c5a51f86e29bdc86a019cd139[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 17 18:55:25 2026 -0500

    Partial progress on tile support

[33mcommit 0bd90686c9ef7eaa3c1184cb03083b96082a4880[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 17 17:46:14 2026 -0500

    Better default travel speed

[33mcommit 12320cbd223ba3dceeab72e97a5684dc6b354499[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 17 17:43:50 2026 -0500

    Added delay to travel speed so there's an animation of the player moving

[33mcommit b7ece9712747640a2ffb95dacbcea81af1bbfa89[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 17 17:26:25 2026 -0500

    Fixed status updates for 3.6.7

[33mcommit 3c8f3a29d0665b28a8b450db90820679b4a39ae7[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 17 16:57:12 2026 -0500

    Fixed dropping and multi-pickup

[33mcommit 99b69d9797fac99573517f45e0e538d3457493f1[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 17 15:31:10 2026 -0500

    Updated nethack wasm names to better distinguish them

[33mcommit 0e37b023d118a87ea830e9be5c3fb204bd780f82[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 17 13:06:12 2026 -0500

    New 3.7 launches now

[33mcommit 37a789211a5c7f033440549bf4ac8070c794b9ea[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 17 12:30:43 2026 -0500

    Partial progress, will continue later

[33mcommit faa4fe4cb1f08301301990c22ce308bb063cefd8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 17 10:33:17 2026 -0500

    Updated glyph rendering for better parsing of the glyph-catalog

[33mcommit 299577b34cd06ab4b129fd9e5e54b8e50c9882b1[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 17 09:49:47 2026 -0500

    Latest glyph catalog

[33mcommit 0e7c00529fbe79a2c2db5de6fc362e4c44267f02[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 17 09:46:43 2026 -0500

    Updated package-lock

[33mcommit c70748f9d37a39371c1dc8ae4bcd6aae632f5b11[m
Author: Adam Powers <apowers@ato.ms>
Date:   Tue Feb 17 06:35:29 2026 -0800

    Integrated NetHack 3.6.7 WASM build (#5)
    
    * Integrated NetHack 3.6.7 WASM build
    
    * Refactor WASM copy into shared helper, switch to published @neth4ck/wasm-367@2.1.0

[33mcommit 2322d00b7f38e2e3df984088d8b73b05a1bc645f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 16 22:29:53 2026 -0500

    CSS

[33mcommit b4191f21fbb8bee3ff2040ad98452c820be389f7[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 16 22:23:40 2026 -0500

    CSS

[33mcommit 048ffc2578f24408f309f0623311461f97e721af[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 16 22:15:35 2026 -0500

    CSS update

[33mcommit c2d0467194712e33b6c1e09d23ac678affa0575a[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 16 18:38:08 2026 -0500

    Enabled contextual inventory actions in normal mode too

[33mcommit 9a53404d040947ff2c2d72eda6700575c6ccfd7f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 16 18:09:38 2026 -0500

    Updated CSS

[33mcommit a6e069ec5aba92d5dc53c6b89f85b32d7e5495b1[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 16 17:53:16 2026 -0500

    Added pinch to zoom in normal mobile mode

[33mcommit 44ec8297de8a9a4596162d40a7c2bd08a666a58f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 16 17:39:52 2026 -0500

    Added CSS fix for portrait > landscape and back text size change

[33mcommit 45fdbc868cbe18c1c90b5399b72bedbd0a90c185[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 16 17:09:45 2026 -0500

    Fixed diagonal corner gaps in FPS mode (squeezing through)

[33mcommit bd68fa5edab7294bf837787a5fe9cdeda119c519[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 16 15:23:35 2026 -0500

    Uupdated .gitignore

[33mcommit 642e8749cf370778876e9dd6adbc5b9125c10f41[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 16 15:20:08 2026 -0500

    Updated gitignore

[33mcommit bc4842d99c3d5c01fb0ebd2e5a7c6395bd83ae2c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 16 14:55:13 2026 -0500

    Updated inventory CSS to not go below the bottom iOS nav bar

[33mcommit 7e99c229388204a424c7f69ce17521b00e9b3f51[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 16 14:53:51 2026 -0500

    Removed old 3.6.7 conversion attempt and enabled logging to always be on for localhost

[33mcommit fd416d8a99fb8edb404b965442bf93e2790c6159[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 16 14:27:54 2026 -0500

    Converted CSS into proper SCSS

[33mcommit aa3fa3277fe7a29c7cca5db6e1cfb8f6a33f202e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 15 21:20:03 2026 -0500

    CSS fixes

[33mcommit cd63324710686c32b87cf88e10e6188df58a36d5[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 15 21:14:31 2026 -0500

    CSS fixes

[33mcommit 51870163e78f270372c15de2dc8a316ca13b214d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 15 20:30:37 2026 -0500

    CSS

[33mcommit a60843cb4b782cec9a2407b51c7d103d493354ae[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 15 19:57:28 2026 -0500

    Updated CSS:

[33mcommit ac7a7f8c12df83e1c3012b0d31f2229333640cfa[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 15 15:23:13 2026 -0500

    Fixes

[33mcommit 67eefe95cbaac945e0824e4e3b5fad408bd01897[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 15 14:29:00 2026 -0500

    Mobile fixes for webpage mode (non-fullscreen app mode)

[33mcommit fa30b1ae14ee3876b23bf0e883d342cd7e2a755d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 15 14:21:53 2026 -0500

    Fixes for mobile FPS mode

[33mcommit 8336fdecf56311fa0762376108f9fb6aa9f7f227[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 15 14:11:51 2026 -0500

    Fixes for FPS mode and mobile

[33mcommit f84944330badcbc49c061f4afd2553a066ec43aa[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 15 08:21:19 2026 -0500

    FOV slider

[33mcommit 1c24c5673286749cdedfd53c37d67f35a1e18464[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 15 08:10:46 2026 -0500

    Client options menu

[33mcommit b168067031c5614ba7efeb8e9029bcd8b5f44fd9[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 15 07:32:23 2026 -0500

    Mobile FPS support

[33mcommit dc6bcb63449334fdb204db195eadeb4cb712e183[m
Merge: a5a97aa da2bb47
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 15 01:23:56 2026 -0500

    Merge pull request #4 from JamesIV4/fps-mode
    
    Added FPS Mode

[33mcommit da2bb4782419166e49bb09b04eee4f08846dafdb[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 15 01:22:32 2026 -0500

    Done

[33mcommit f189a2e531b3579c1cebf9649880d3cc38a6061d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 15 01:14:47 2026 -0500

    Basically done

[33mcommit b19b2aae78cc1ed1d6276873fa1ef7a2e1bd1d13[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 15 00:49:14 2026 -0500

    Almost done

[33mcommit 4f6052c9cc9352d1aaf54b64c4b49d51bc39a470[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 22:53:18 2026 -0500

    Polish

[33mcommit 83c3622fdd69dfd9e7ddb0c02b8e8db95b602587[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 22:45:54 2026 -0500

    Fully functional FPS mode

[33mcommit 1c0555bae7c3b66ccc09e99ab6343be2ab9eac59[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 21:00:17 2026 -0500

    WIP version

[33mcommit a5a97aa69b34a3524c969fe7c5aede8cd595764c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 20:40:14 2026 -0500

    Modal CSS fix

[33mcommit 0a7a94cb2a715fe78782a9c3b4c984a1fa2bc0e2[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 20:39:18 2026 -0500

    Plan

[33mcommit 98e2dbfb23bd3b7884a1666d3e7c4ffd899ed1fe[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 16:45:58 2026 -0500

    Revert "Updated camera movement"
    
    This reverts commit 65cbbba21b962a4bbceef484207281dab42c0d44.

[33mcommit 8139fe02d637f3ae94bdbebcbd0b0ea4de3519c4[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 16:43:11 2026 -0500

    Revert "Testing threaded camera again"
    
    This reverts commit 64fe7cb0c07a3b60324959975971a205f221bc6c.

[33mcommit 7e1a7015cc9457d694d3eb9a83f8f8396e89eb08[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 16:43:07 2026 -0500

    Revert "Testing camera smoothness updates"
    
    This reverts commit 0df0700c5cb2658460f6c843df88209d8ef0f7d4.

[33mcommit 0df0700c5cb2658460f6c843df88209d8ef0f7d4[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 16:40:00 2026 -0500

    Testing camera smoothness updates

[33mcommit 64fe7cb0c07a3b60324959975971a205f221bc6c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 16:29:29 2026 -0500

    Testing threaded camera again

[33mcommit 3d8057754c333ca3df8888e5beecd0b939ae4cbc[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 16:20:49 2026 -0500

    Fixed modal width on mobile

[33mcommit 044b0fe91fb1e4f716a8c55522d75b7f7d821458[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 16:16:18 2026 -0500

    Fixed jerky camera on mobile

[33mcommit 0c8d1a6163b4044096f212ed090e63ebac72fd2d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 16:10:36 2026 -0500

    Revert "Multi-threaded camera"
    
    This reverts commit 6277d3f112377d92b717d76547b6c55c5fcda508.

[33mcommit 6277d3f112377d92b717d76547b6c55c5fcda508[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 16:05:41 2026 -0500

    Multi-threaded camera

[33mcommit 8001e1aa8c5af25248f1f73674daaab79d099d66[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 15:02:54 2026 -0500

    Optimization pass

[33mcommit a472672b892d7f0bb78d6b5b77ca246533c739ec[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 14:30:04 2026 -0500

    Better bottom safe zone handling

[33mcommit d1ec70a6c03ec397fafecb15a8f15a0c3c8a3afa[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 14:26:49 2026 -0500

    Fixed inventory mobile CSS

[33mcommit 65cbbba21b962a4bbceef484207281dab42c0d44[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 14:21:42 2026 -0500

    Updated camera movement

[33mcommit 7474ed2ee19564b1adbe53b0d99e9e9b68814281[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 14:18:01 2026 -0500

    Camera fixes, center back on player when moving if camera panned

[33mcommit aa35d4a6bbb0caa70e88577e5840cb727a9db3a3[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 13:56:34 2026 -0500

    Fixed lighting issues

[33mcommit a603b1f38a8908d9f7ffd3437f82ddfe0057cea4[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 12:57:57 2026 -0500

    Updated readme

[33mcommit b2f8c400c8049795ef650125cabdb60a3f817423[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 12:15:01 2026 -0500

    Fixes to inconsistent blood rendering

[33mcommit cb5014c12f646341fb130527cd2b244e7f89f177[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 11:53:58 2026 -0500

    Message modal CSS updates

[33mcommit 06b5a7ac382d96d41aac1cdc8d6ac462302ef8d8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 11:36:38 2026 -0500

    Non-selectable text

[33mcommit 62c555c200bd3ec4dfcd8807a15a5b2f7dee55f9[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 11:33:17 2026 -0500

    Updated README with mininmap feature

[33mcommit ec93b5b4a0efda4bbb95f097c83aa228c521bcb8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 11:31:35 2026 -0500

    Minimap added and CSS fixes

[33mcommit c532372eebed0dba11631ba39090f6ba1a4a8342[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 11:27:16 2026 -0500

    CSS updates

[33mcommit ab441832d13a1a0b0dbada32acabb8b74860d4ae[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 10:44:48 2026 -0500

    New damage font

[33mcommit 83c1726c8bafba5eecec0198a35802ddbd2b1ded[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 10:33:12 2026 -0500

    Unified visual style of UI

[33mcommit f1ba6ffd34fb81a16203e3dab64b07b27e5e8bc2[m
Merge: 33bf197 a9809bc
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 10:30:37 2026 -0500

    Merge branch 'main' of github.com:JamesIV4/nethack-3d

[33mcommit 33bf1976985629d3b53973c09620d6274cb8c2eb[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 10:28:03 2026 -0500

    Mobile UI updates

[33mcommit 3172cd02da66df982b9d8aa5e064e6c5965fc380[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 10:18:09 2026 -0500

    Mobile tweaks

[33mcommit a9809bce6e3726d767bd7ab9ce261a09cece3c20[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 10:03:25 2026 -0500

    Update README.MD

[33mcommit 9ee78884e79aad141aa30fc9ac9aa0b92d5b174f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 09:45:55 2026 -0500

    Updated README

[33mcommit c252f561ea08c1c945cf6e4c4bd8a1ed79a8a1bd[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 09:45:22 2026 -0500

    Updated README

[33mcommit a7871604530e2c9ac20ec19def4b431ed56b0a36[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 14 09:42:08 2026 -0500

    Overhauled README with features and screenshots

[33mcommit 8b5e7296bc19db9dfc6f2f77f00af545bfe04e19[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 13 18:40:24 2026 -0500

    Fixed text input (elbereth)

[33mcommit 7335e938d7bf8979df34ea193198e2240f38a80d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 13 18:32:22 2026 -0500

    Hid keyboard help on mobile

[33mcommit 0523317678b8026c48da0e94896c3292595ed048[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 13 18:30:40 2026 -0500

    Added up, down and self to the direction modals

[33mcommit 1ebd3f1f619e46d5e43bf97cc758552d99f5aa98[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 13 18:10:24 2026 -0500

    Fixed player glyph sometimes turning red

[33mcommit 7558112b02367a4943f414caa2b55632e734d4b6[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 13 17:55:27 2026 -0500

    Fixed damage numbers calculation and added healing numbers

[33mcommit eb894613a3e5ffe8a3dcc3ad8fc92157120adba3[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 13 17:35:25 2026 -0500

    Fixe far-look mode breaking on / -> /

[33mcommit 7b0c94c0a2309e4d5629c8b4b8dbc9c4f7473ef7[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 13 17:16:22 2026 -0500

    Fixed text input zoom issue on iOS

[33mcommit 5dd58d256284e97d19776c53b0c20730d790a6f8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 13 17:14:28 2026 -0500

    Reduce bottom safe zone CSS

[33mcommit 0a998711c789714214321498fd0c3c5d5ee9095e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 13 17:06:50 2026 -0500

    Updated CSS for mobile web app fullscreen mode

[33mcommit f440b1250a3331e2c76c8360199ab340e07705f3[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 13 16:59:36 2026 -0500

    Modified AGENTS.md

[33mcommit 66b6f8258f24b404604101c0d0bc3161f62ea053[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 13 16:09:24 2026 -0500

    CSS updates:

[33mcommit 1b57c17e258af1d5642517aafdbe9e2b0df92410[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 10 18:50:54 2026 -0500

    Revert "iOS and Android fullscreen app support"
    
    This reverts commit 8a52d5420bcc714b7d9a9fc2c4c0c83ddb64825c.

[33mcommit 8a52d5420bcc714b7d9a9fc2c4c0c83ddb64825c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 10 18:45:02 2026 -0500

    iOS and Android fullscreen app support

[33mcommit 35391594ea755ad9c70e5ca9622ef09bea12cbc1[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 10 12:28:22 2026 -0500

    Updated gitignore

[33mcommit 316a78874514e9b45851b1b95be9bd44d2807681[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 10 10:23:12 2026 -0500

    UI support for numpad mode off

[33mcommit 060ddc6e9a9fa71dc19b6dab16ca558d7234a4dd[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Tue Feb 10 09:18:01 2026 -0500

    Fixed paginated key assignment regression

[33mcommit 739eebac6df392af8ebd940ade74d6873f8f4477[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 9 23:53:43 2026 -0500

    Auto-move fix

[33mcommit 5acdf98455bc9faa1f9c91628bb56d5cc424e711[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 9 23:39:32 2026 -0500

    Auto-move spupport added to mobile and desktop clicks

[33mcommit 69ed2e1c44c29dde3ae1e476efdbe6ca50ed39a7[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 9 22:53:24 2026 -0500

    Buttons on mobile multi-pickup:

[33mcommit ac37dc9c5311c76e4c22a972d7a3cb7db5da6423[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 9 22:38:00 2026 -0500

    Partial fix for text input commands

[33mcommit 50b6f64d301c10c1663854bcf5389f4b7045012c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 9 20:32:56 2026 -0500

    Added tap to move back

[33mcommit b880b58c8fad5eba32971ef36cb4571cefd9a5b8[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 9 18:32:14 2026 -0500

    Mobile commands:

[33mcommit bb5da78d9a1ff1dadbacffeadcc1a18546b295fd[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 9 17:57:39 2026 -0500

    Mobile support WIP

[33mcommit 7f3242b837125e400fd5c722fecd1901c64c3e58[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 9 17:15:41 2026 -0500

    Character creation overhaul tweaked

[33mcommit 0458a49368b88092229706af875803995fb91931[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 9 16:58:49 2026 -0500

    Added character creation

[33mcommit 49fff8c63eb0550600ad65954ad436eebd22272e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 9 16:13:37 2026 -0500

    Alternate way to enter far-look

[33mcommit 1aa51d3a10061fc1ebb901bf17a098ecdc02ddaf[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 9 16:02:46 2026 -0500

    Minor text change

[33mcommit e21d3fe16506ecd881a8c519b22bde3b680698ab[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 9 15:59:54 2026 -0500

    Fixed message window system

[33mcommit acce81fd29c0f7be806951a58c5b2ef01ef623f5[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 9 15:14:35 2026 -0500

    Fixed meta command regression

[33mcommit 4f93a69249f6dc667dc30ef69f07ad554d48bd5e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 9 15:04:46 2026 -0500

    Added blood effects

[33mcommit e326c307540ae111b858fbeb73039d6602827d60[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 9 12:30:08 2026 -0500

    Fixed far-look!

[33mcommit 2ce5782b86e15714ff26aa3b3f97a7c24ae7db74[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 9 12:08:41 2026 -0500

    Working around github instability

[33mcommit 7585ff497482df5d2e50c0678b259e362ddb6aa9[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 9 12:04:50 2026 -0500

    Working around github instability

[33mcommit 49844cc69b3a372f3ef7c5b55c6db57e1f0c93dd[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 9 11:45:41 2026 -0500

    Fixed options menu

[33mcommit 32994b7b6ecc56a53471c81acb8e4cc380c04500[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Feb 9 11:00:18 2026 -0500

    Massive input/handling fix! Much cleaner now

[33mcommit 1a085569340f0b94307a533ca785304472787e3c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 8 19:25:11 2026 -0500

    Removed lighting overlay z offset

[33mcommit 5fbc836f2417dae7410b8ffa81efedb5f0dfd01c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 8 18:54:29 2026 -0500

    Updated hunger and encumberance location

[33mcommit 9c84f218a5037260b4f763dfa0db5eeace28e2e3[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 8 18:49:14 2026 -0500

    No zoom while inventory is open

[33mcommit e270059a3aef5a2e8d917fa96598556d7e00989f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 8 18:44:22 2026 -0500

    Fixed background color difference from unexplored tiles

[33mcommit 3eac4edfd80f09cb1d6bc83ce82415d67ec9b470[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 8 18:11:57 2026 -0500

    Swapped out boulders rendering for 0

[33mcommit 79969a2f588dfb2584a2c7c7d710119d97016b5b[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 8 17:21:23 2026 -0500

    Meta commands are working

[33mcommit 06ad842330f08c12a7f62c9db433d8c6531d4d7e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 8 16:50:26 2026 -0500

    Meta command modal added

[33mcommit faa6c4da554c174b6407fea3e794b51f0ed31f92[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 8 16:09:08 2026 -0500

    Nearly-working far-look mode

[33mcommit f51edae1b3b6ae8867f0f6f6c4c44cd80892081d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 8 13:31:47 2026 -0500

    Added exp tracking on screen

[33mcommit 8c66f5354584699d0b10217226a740dda9bf0720[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 8 13:18:49 2026 -0500

    Fixed gold tracking

[33mcommit b828700cdde9863db4e6ccb8decce89cd81654a7[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 8 13:03:56 2026 -0500

    Fixed animation regression

[33mcommit f3aeaa73802479ad52d17f1bff00ddc2c70f082f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sun Feb 8 13:00:12 2026 -0500

    Converted game to React hooks with Zustand and Vite

[33mcommit 2df7fe0a96377e076510d878672a262c2b035498[m
Merge: ce6a18b ef4f816
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 7 20:30:53 2026 -0500

    Merge pull request #1 from JamesIV4/codex/commit-updated-glyphs-to-fix-build-issue
    
    Restore CI glyph catalog staleness check

[33mcommit ef4f81612d22a04e95372175206bfe8137913c3b[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 7 20:30:08 2026 -0500

    Restore CI glyph catalog check in deploy workflow

[33mcommit ce6a18bed3b726b3b9744f93b9ee7c23c2e77366[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 7 20:03:50 2026 -0500

    Fade in tiles

[33mcommit b9a5fda70200037b5fca337b5896147bcf42afc6[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 7 19:57:55 2026 -0500

    Messages above player, looting tweaks, damage numbers

[33mcommit f23b38a809054c150e367efd37b17b3cddd9e86d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 7 19:31:10 2026 -0500

    Added damage display system and chest looting convenience fixes

[33mcommit 1f90e3316664db8f3ad083979100e89f83f6b1e0[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 7 18:46:06 2026 -0500

    Added message display above player, abstracted inline CSS into an SCSS file

[33mcommit 26ae314735df0e020a1f2397894ef806d9fec66d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 7 16:14:35 2026 -0500

    Fixed multi-pickup!

[33mcommit 6a4d8e50097f6efe2e895634a8aecf82114f36e7[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 7 15:39:15 2026 -0500

    Fixed taking only one item when there's a grouped item

[33mcommit 2732a4c19fb422481bfe71e449cdf52aab03c43d[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 7 14:44:49 2026 -0500

    Fixed spellcasting and partially fixed chest looting

[33mcommit 6ee6688961a7c8219d2a40ce69dd503b70df015a[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 7 14:19:39 2026 -0500

    Added a vignnette

[33mcommit 33533a173cac40f554f0bf80af123f3e4110e317[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 7 13:08:27 2026 -0500

    Color handling enhancements

[33mcommit 555a9b57da3a1224a7c106610aeeb2236b3f4472[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 7 12:08:50 2026 -0500

    Single source of truth on glyph handling

[33mcommit 6e5e446e5fd93900144ab7511345f783f164f4fc[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Sat Feb 7 00:02:01 2026 -0500

    README update

[33mcommit d265c940f77fb41b2a1c774919b291e3b0759e86[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 6 23:38:26 2026 -0500

    Fix typo

[33mcommit bbf2ff4bdd1e760182307615edf5dd367eb78b37[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 6 23:37:54 2026 -0500

    Updated README

[33mcommit 05c8d4db74b6336908280e7628f2dfa3b4cb72f1[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 6 23:36:34 2026 -0500

    Updated README with game URL

[33mcommit 577e6eb815e3d405c30db6d52c0747cff4dd087f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 6 23:33:08 2026 -0500

    Fixed i conflict

[33mcommit ccf680df401c433f39e02c180e46f96a06a82c53[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 6 23:26:48 2026 -0500

    Cleanup

[33mcommit 479ee3cdd37a6875ec3ab09b283f1dab9573e45f[m
Merge: 014bbd7 ce7f3ad
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 6 22:51:43 2026 -0500

    Merge branch 'nextjs-conversion'

[33mcommit ce7f3ad6ac058819089e8e4e7c0c7717355f0fec[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 6 22:50:28 2026 -0500

    Set up github pages

[33mcommit df635c7b094277c55d033b4f5c814c13c1c72b6e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 6 22:49:01 2026 -0500

    Updated documentation

[33mcommit 9cf171108282f8a7c2503f36503c1570c947468c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 6 22:31:51 2026 -0500

    Removed shim of server

[33mcommit 0fc6c0d02ff9ec55a88a1d524a07ccf0e34102d7[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 6 22:16:04 2026 -0500

    Removed node.js implementation and run WASM in browser now

[33mcommit 792faf0ca1fa367f3ca91e83deb2d26f9036b193[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 6 22:02:47 2026 -0500

    Initial plan

[33mcommit 014bbd7c19a5c89204357323b3c2d37a444fb89e[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 6 19:33:06 2026 -0500

    Fixed waiting

[33mcommit 72525d2d1089755190b7fac7d475248ca48022d4[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 6 18:34:29 2026 -0500

    Chest looting fix

[33mcommit 0f5a5a7ea8aa19a3ac19c813766dece383b42f5c[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 6 18:28:36 2026 -0500

    Rendering improvements (darkened areas)

[33mcommit cbbeef3638ae6302852fec3a3d502f7ccbafb629[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 6 17:54:39 2026 -0500

    Rendering, camera, bug fixes

[33mcommit 51438d1af0e94e0b0ee9745ad3e418062355795f[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 6 16:17:09 2026 -0500

    Workaround for multi-pickup

[33mcommit 4fe4f391f0b229e04e2cc922c08d73add00c9104[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 6 15:14:08 2026 -0500

    Fixed issues with stats not being interpreted correctly

[33mcommit 6db9883f1bf5825e5d751076ab8dcc10d61810dd[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Fri Feb 6 15:00:30 2026 -0500

    Added steering files to the project

[33mcommit f99c884299750921a784182de5d2d417a738f2c0[m
Author: James Pound <james.pound@genesys.com>
Date:   Wed Oct 1 16:46:47 2025 -0400

    Much better text rendering

[33mcommit ac35b8bf5b056e90c509a3261c9f8f09055e6621[m
Author: James Pound <james.pound@genesys.com>
Date:   Wed Oct 1 16:23:13 2025 -0400

    Updated the text display to be rendered on the blocks directly

[33mcommit 6a93d54a55bbfd1c91ba8b126120e8d2aa10f6f4[m
Author: James Pound <james.pound@genesys.com>
Date:   Wed Oct 1 14:15:29 2025 -0400

    Removed threejs entire file contents from our app.js file

[33mcommit e871243355483c0552673cacd5538bd47d7c17b8[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Mon Aug 4 17:38:07 2025 -0400

    Minor style cleanup

[33mcommit a0c79805dcc432ee9ac09ea4d673c3f1a154c128[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Mon Aug 4 17:35:18 2025 -0400

    Fixed stats bar overlap

[33mcommit b4f57cfa5298e0f9c5cded76833a9ef3b1af9480[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Mon Aug 4 17:21:56 2025 -0400

    Stats WIP

[33mcommit a2ad56321f25778c576d2ebbb3894f0dbf4195aa[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Mon Aug 4 16:09:52 2025 -0400

    Attempting to cleanup disconnection polling text

[33mcommit 1d9e4f10ee5545ef62cd2ec8975cc7c7ee1376bb[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Mon Aug 4 15:37:02 2025 -0400

    Multi-select still broken, tabling for now

[33mcommit accd23ab9e76c136b9db56b22e5dd253e67697fa[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Mon Aug 4 14:19:39 2025 -0400

    Better handling for dropping items

[33mcommit 350c2c8bb18f44fde8209fb30b42c62242083f32[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Mon Aug 4 14:13:13 2025 -0400

    Game is good working state, except for item pickup on stacks

[33mcommit 2c73d5f7125a19f65d8d94d0843d1d8d086df37d[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Mon Aug 4 13:25:26 2025 -0400

    Massive improvements

[33mcommit f4513ed9e23b03ed00be18930faa132d19b2ce93[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Mon Aug 4 11:42:46 2025 -0400

    Colors better

[33mcommit 85845523d5f598d5a8ff8c395a5634f6b2e8d3fd[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Mon Aug 4 10:46:05 2025 -0400

    Fixed broken UI elements

[33mcommit b6f27a608adac5c2b9cbe6da8f64f10c0f55e417[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Mon Aug 4 10:39:42 2025 -0400

    Fixed pickup_options

[33mcommit 021192e4eecb0c585928d8cbdee097728f37d8fb[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Mon Aug 4 10:09:23 2025 -0400

    Fixed 3d axis movement being incorrect

[33mcommit 81ad150af17f80c1ddf4bd3c2b14cabbd058716e[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Mon Aug 4 10:00:05 2025 -0400

    Added console output for game messages

[33mcommit 9e6a3a7220d39dbad9e715346e653e490189c3fd[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Mon Aug 4 09:29:55 2025 -0400

    Updated port

[33mcommit 693114472359956786318efbf07b1dc39028a493[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Aug 4 09:29:27 2025 -0400

    Update README.MD

[33mcommit 41ba7f3ac9bd456894f47b981a77e249020e84d5[m
Author: James Pound <jamespoundiv@gmail.com>
Date:   Mon Aug 4 09:28:26 2025 -0400

    Update README.MD

[33mcommit a5b47bd873cd667e1a9c944f77dd6e76afad41a2[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Mon Aug 4 09:23:58 2025 -0400

    Cleanup

[33mcommit d31d8d01ad272dcedd1c92818ca1cc6fac0bb3dd[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Mon Aug 4 09:19:47 2025 -0400

    Fixed inputs being doubled

[33mcommit 847d657fce29baed1b448b031e9ea469905f8806[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Mon Aug 4 09:12:38 2025 -0400

    Game initalizes and runs in async mode once map is rendered

[33mcommit 5ae10382bb0f6b9478224bdc204ee768aa73770f[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Mon Aug 4 09:03:11 2025 -0400

    Fixed some bad code returning ESC all the time, in game and input works now but repeats

[33mcommit 549b8f6a69cf6eecf55fe58daa31a24e3626ffe5[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Mon Aug 4 08:47:18 2025 -0400

    There's looping logic again and the game doesn't start

[33mcommit 065d47ea85221615e2db591a54d4e22ecd0b652f[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Mon Aug 4 08:39:56 2025 -0400

    In game working

[33mcommit 519fba86f963cee6e2073baa13a47f87bfbadbd0[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Sun Aug 3 21:35:17 2025 -0400

    Restored last working sync version of server for reference

[33mcommit 4b8b1583fd2b4da07f0f155d4e9e3ce6275c7253[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Sun Aug 3 21:05:45 2025 -0400

    Input is much better

[33mcommit ec0889b1d1e3c3e03ca860b3babcef7e490b6f83[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Sun Aug 3 19:22:48 2025 -0400

    Fixed input handling

[33mcommit 05998aabd219736c9b4ffef8ee2b9837c33c8016[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Sun Aug 3 19:15:19 2025 -0400

    Fixed player @ but broke player input

[33mcommit 958d91ebe1c503c4058a4c4d8902ac03b5f84d9f[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Sun Aug 3 18:08:43 2025 -0400

    Mor progress

[33mcommit e3196b13bb2177d6dc4a3998948f475e3d6ee58c[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Sun Aug 3 18:00:39 2025 -0400

    Resolved infite drinking loop

[33mcommit dbf9b25e700311cabb46d1c3b0a45f9e9c3772a3[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Sun Aug 3 17:57:09 2025 -0400

    Message handling?

[33mcommit 01db6e0880e486af5183de682c250db7021942ad[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Sun Aug 3 17:44:17 2025 -0400

    Working 3d in browser

[33mcommit 6a2a66e9f50e3af1063db29f4928a540f547a45c[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Sun Aug 3 17:34:09 2025 -0400

    In game in terminal

[33mcommit ae90f028dee48818d2cc5ad9cbc422d6ff277a67[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Sun Aug 3 17:27:00 2025 -0400

    Currecnt progress

[33mcommit aa054e48ebb669e044a0ea982b8b9f8c244d6e20[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Sun Aug 3 17:00:01 2025 -0400

    Working serverside Nethack WASM running, a few issues remaining

[33mcommit 5ece54d2ebe030261e28a72c7b8e7209d100bd15[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Sun Aug 3 16:32:08 2025 -0400

    Progress

[33mcommit 3a4fdd395f5183560b907788353e6a2ce7a4347f[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Wed Jul 30 17:29:35 2025 -0400

    Refresh by Gemini

[33mcommit ff5cfc777d65be0245b3263f56e1381fc8033139[m
Author: James Pound IV <jamespoundiv@gmail.com>
Date:   Wed Jul 30 17:02:20 2025 -0400

    Basic setup:
