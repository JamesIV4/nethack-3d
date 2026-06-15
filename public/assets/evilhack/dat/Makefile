#
# This file is generated automatically.  Do not edit.
# Your changes will be lost.  See sys/unix/NewInstall.unx.
# Identify this file:
MAKEFILE_DAT=1

###
### Start hints/linux PRE
###
# (new segment at source line 6 )
# Linux hints file
# This hints file provides a single-user tty build for Linux, specifically
# for Ubuntu dapper.

# Typical install path for normal user (non-root)
PREFIX=$(wildcard ~)
HACKDIR=$(PREFIX)/games/$(GAME)dir

# Default install path (assumes running at root)
#PREFIX=/usr
#HACKDIR=$(PREFIX)/games/lib/$(GAME)dir

SHELLDIR = $(PREFIX)/games
INSTDIR = $(HACKDIR)
VARDIR = $(HACKDIR)/var

POSTINSTALL=cp -n sys/unix/sysconf $(INSTDIR)/sysconf; $(CHOWN) $(GAMEUID) $(INSTDIR)/sysconf; $(CHGRP) $(GAMEGRP) $(INSTDIR)/sysconf; chmod $(VARFILEPERM) $(INSTDIR)/sysconf; cp dat/serverseed $(INSTDIR)/serverseed; $(CHOWN) $(GAMEUID) $(INSTDIR)/serverseed; $(CHGRP) $(GAMEGRP) $(INSTDIR)/serverseed; chmod $(VARFILEPERM) $(INSTDIR)/serverseed;

CFLAGS=-g3 -O0 -I../include -DNOTPARMDECL -fno-common
CFLAGS+=-DDLB
CFLAGS+=-DCOMPRESS=\"/bin/gzip\" -DCOMPRESS_EXTENSION=\".gz\"
CFLAGS+=-Wno-unused-result -Wno-format-overflow
CFLAGS+=-DSYSCF -DSYSCF_FILE=\"$(HACKDIR)/sysconf\" -DSECURE
CFLAGS+=-DTIMED_DELAY
CFLAGS+=-DHACKDIR=\"$(HACKDIR)\"
CFLAGS+=-DVAR_PLAYGROUND=\"$(HACKDIR)/var\"
CFLAGS+=-DCONFIG_ERROR_SECURE=FALSE
CFLAGS+=-DCURSES_GRAPHICS
CFLAGS+=-DPANICLOG_FMT2
CFLAGS+=-DFCMASK=0644
CFLAGS+=-DTTY_TILES_ESCCODES
CFLAGS+=-DSCORE_ON_BOTL
CFLAGS+=-DREALTIME_ON_BOTL
CFLAGS+=-DDGAMELAUNCH
CFLAGS+=-DLIVELOG_ENABLE
CFLAGS+=-DDUMPLOG
CFLAGS+=-DDUMPHTML

#detection of clang vs gcc
CCISCLANG := $(shell echo `$(CC) --version` | grep clang)
ifneq "$(CCISCLANG)" ""
CLANGGTEQ18 := $(shell expr `$(CC) -dumpversion | cut -f1 -d.` \>= 18)
ifeq "$(CLANGGTEQ18)" "1"
# clang-specific starts here
CFLAGS+=-Wno-deprecated-non-prototype
endif
# clang-specific ends here
else
# gcc-specific starts here
CFLAGS+=-Wno-old-style-definition -Wno-unused-result -Wno-format-overflow
# gcc-specific ends here
endif  # clang-specific or gcc-specific ends here

LINK=$(CC)
# Only needed for GLIBC stack trace:
LFLAGS=-rdynamic

WINSRC = $(WINTTYSRC) $(WINCURSESSRC)
WINOBJ = $(WINTTYOBJ) $(WINCURSESOBJ)
WINLIB = $(WINTTYLIB) $(WINCURSESLIB)

# if TTY_TILES_ESCCODES
WINSRC += tile.c
WINOBJ += tile.o

WINTTYLIB=-lncursesw -ltinfo

CHOWN=true
CHGRP=true

VARDIRPERM = 0755
VARFILEPERM = 0600
GAMEPERM = 0755
### End hints/linux PRE

###
### Start Makefile.dat
###
#      NetHack Datafiles Makefile.dat $NHDT-Date: 1447844574 2018/04/25 19:25:54 $ $NHDT-Branch: NetHack-3.6.0 $:$NHDT-Revision: 1.22 $
# Copyright (c) 2018 by Pasi Kallinen
# NetHack may be freely redistributed.  See license for details.

# Root of source tree:
NHSROOT=..

# for Atari
# SHELL=E:/GEMINI2/MUPFEL.TTP
# UUDECODE=uudecode

VARDAT = bogusmon data engrave epitaph rumors quest.dat oracles options vaults.dat

all:	$(VARDAT) spec_levs quest_levs dungeon

../util/makedefs:
	(cd ../util ; $(MAKE) makedefs)

../util/dgn_comp:
	(cd ../util ; $(MAKE) dgn_comp)

../util/lev_comp:
	(cd ../util ; $(MAKE) lev_comp)

../util/tile2x11:
	(cd ../util ; $(MAKE) tile2x11)

../util/tile2beos:
	(cd ../util ; $(MAKE) tile2beos)

../util/tile2bmp:
	(cd ../util ; $(MAKE) tile2bmp)

x11tiles: ../util/tile2x11 ../win/share/monsters.txt ../win/share/objects.txt \
				../win/share/other.txt \
                                ../win/share/monsters.txt
	../util/tile2x11 ../win/share/monsters.txt ../win/share/objects.txt \
				../win/share/other.txt \
                                -grayscale ../win/share/monsters.txt

beostiles: ../util/tile2beos ../win/share/monsters.txt \
				../win/share/objects.txt \
				../win/share/other.txt
	../util/tile2beos ../win/share/monsters.txt \
				../win/share/objects.txt \
				../win/share/other.txt

nhtiles.bmp: ../util/tile2bmp ../win/share/monsters.txt \
				../win/share/objects.txt \
				../win/share/other.txt
	../util/tile2bmp $@

NetHack.ad: ../win/X11/NetHack.ad
# handle "#define foo bar" -lines
	grep ^#define ../win/X11/NetHack.ad | \
		sed -e 's/^#define/s/g' -e 's/  */ /g' \
		    -e 's/$$/ g/g' > NetHack.ad.tmp
	grep -v ^#define ../win/X11/NetHack.ad | \
		sed -f NetHack.ad.tmp > NetHack.ad
	-rm -f NetHack.ad.tmp

pet_mark.xbm: ../win/X11/pet_mark.xbm
	cp ../win/X11/pet_mark.xbm pet_mark.xbm

pilemark.xbm: ../win/X11/pilemark.xbm
	cp ../win/X11/pilemark.xbm pilemark.xbm

rip.xpm: ../win/X11/rip.xpm
	cp ../win/X11/rip.xpm rip.xpm

mapbg.xpm: ../win/gnome/mapbg.xpm
	cp ../win/gnome/mapbg.xpm mapbg.xpm

nhsplash.xpm: ../win/Qt/nhsplash.xpm
	cp ../win/Qt/nhsplash.xpm nhsplash.xpm

nethack.icns: ../win/Qt/nhicns.uu
	$(UUDECODE) ../win/Qt/nhicns.uu

Info.plist: ../win/Qt/Info.pli
	cp ../win/Qt/Info.pli Info.plist

../util/tile2img.ttp:
	(cd ../util ; $(MAKE) tile2img.ttp)

../util/xpm2img.ttp:
	(cd ../util ; $(MAKE) xpm2img.ttp)
nh16.img: ../util/tile2img.ttp ../win/share/monsters.txt \
				../win/share/objects.txt ../win/share/other.txt
	../util/tile2img.ttp nh16.img

rip.img: ../util/xpm2img.ttp
	../util/xpm2img.ttp ../win/X11/rip.xpm rip.img
title.img:
	# cp ../win/gem/title.img title.img
	$(UUDECODE) ../win/gem/title.uu

GEM_RSC.RSC:
	# cp ../win/gem/GEM_RSC.RSC GEM_RSC.RSC
	$(UUDECODE) ../win/gem/gem_rsc.uu


data:	data.base ../util/makedefs
	../util/makedefs -d

rumors:	rumors.tru rumors.fal ../util/makedefs
	../util/makedefs -r

quest.dat:	quest.txt ../util/makedefs
	../util/makedefs -q

oracles:	oracles.txt ../util/makedefs
	../util/makedefs -h

# note: 'makedefs -s' constructs three files at once: "epitaph", "engrave",
# and "bogusmon", in that order, but traditional 'make' doesn't provide any
# way for a Makefile to indicate that; make the third depend on the second
# and the second depend on the first so that if someone runs parallel make
# it will be forced to run three instances of 'makedefs -s' sequentially
# rather than simultaneously; depending upon how 'make' checks timestamps,
# this might result in building all three of them three times in a row
# [that will still produce the correct result in the end, and the extra
# overhead of doing it should be negligible]
bogusmon:	engrave bogusmon.txt ../util/makedefs
	../util/makedefs -s
engrave:	epitaph engrave.txt ../util/makedefs
	../util/makedefs -s
epitaph:	epitaph.txt ../util/makedefs
	../util/makedefs -s

# note: 'options' should have already been made when include/date.h was created
options:	../util/makedefs
	../util/makedefs -v

vaults.dat:	spec_levs

spec_levs: ../util/lev_comp \
	bigroom.des castle.des endgame.des forest.des gehennom.des \
	goblintown.des hdgn.des icequeen.des knox.des medusa.des \
	mines.des nymph.des oracle.des purgatory.des sokoban.des \
	tower.des vecna.des yendor.des vaults.des
	-rm -f vaults.dat
	../util/lev_comp bigroom.des
	../util/lev_comp castle.des
	../util/lev_comp endgame.des
	../util/lev_comp forest.des
	../util/lev_comp gehennom.des
	../util/lev_comp goblintown.des
	../util/lev_comp hdgn.des
	../util/lev_comp icequeen.des
	../util/lev_comp knox.des
	../util/lev_comp medusa.des
	../util/lev_comp mines.des
	../util/lev_comp nymph.des
	../util/lev_comp oracle.des
	../util/lev_comp purgatory.des
	../util/lev_comp sokoban.des
	../util/lev_comp tower.des
	../util/lev_comp vecna.des
	../util/lev_comp yendor.des
	../util/lev_comp vaults.des
	touch spec_levs

quest_levs: ../util/lev_comp \
	Arch.des Barb.des Caveman.des Convict.des DKnight.des Druid.des \
	Healer.des Infidel.des Knight.des Monk.des Priest.des Ranger.des \
	Rogue.des Samurai.des Tourist.des Valkyrie.des Wizard.des
	../util/lev_comp Arch.des
	../util/lev_comp Barb.des
	../util/lev_comp Caveman.des
	../util/lev_comp Convict.des
	../util/lev_comp DKnight.des
	../util/lev_comp Druid.des
	../util/lev_comp Healer.des
	../util/lev_comp Infidel.des
	../util/lev_comp Knight.des
	../util/lev_comp Monk.des
	../util/lev_comp Priest.des
	../util/lev_comp Ranger.des
	../util/lev_comp Rogue.des
	../util/lev_comp Samurai.des
	../util/lev_comp Tourist.des
	../util/lev_comp Valkyrie.des
	../util/lev_comp Wizard.des
	touch quest_levs

dungeon: dungeon.def ../util/makedefs ../util/dgn_comp
	../util/makedefs -e
	../util/dgn_comp dungeon.pdf

# gitinfo.txt is optionally made by src/Makefile when creating date.h
clean:
	-rm -f gitinfo.txt Guidebook

spotless: clean
	-rm -f spec_levs quest_levs *.lev $(VARDAT) dungeon dungeon.pdf
	-rm -f nhdat x11tiles beostiles pet_mark.xbm pilemark.xbm rip.xpm mapbg.xpm
	-rm -f rip.img GEM_RSC.RSC title.img nh16.img NetHack.ad vaults.dat
	-rm -f nhsplash.xpm nhtiles.bmp
### End Makefile.dat

###
### Start hints/linux POST
###
### End hints/linux POST
