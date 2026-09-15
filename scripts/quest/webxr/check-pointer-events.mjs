// Execute the patched Android event generator against a small recording API boundary.
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=fileURLToPath(new URL("../../../",import.meta.url));
const temp=path.join(root,"quest/runtime/pointer-event-check");
const sources={
 "android/os/SystemClock.java":`package android.os; public class SystemClock {static long t=0;public static long uptimeMillis(){return ++t;}}`,
 "android/util/Log.java":`package android.util; public class Log {public static int e(String a,String b){return 0;}}`,
 "android/util/SparseArray.java":`package android.util;public class SparseArray<T>{private java.util.Map<Integer,T> m=new java.util.HashMap<>();public T get(int i){return m.get(i);}public void put(int i,T t){m.put(i,t);}public int size(){return m.size();}public void clear(){m.clear();}}`,
 "android/view/InputDevice.java":`package android.view;public class InputDevice {public static final int SOURCE_TOUCHSCREEN=4098,SOURCE_MOUSE=8194;}`,
 "android/view/MotionEvent.java":`package android.view;public class MotionEvent {
 public static final int ACTION_DOWN=0,ACTION_UP=1,ACTION_MOVE=2,ACTION_CANCEL=3,ACTION_HOVER_ENTER=9,ACTION_HOVER_EXIT=10,ACTION_HOVER_MOVE=7,ACTION_SCROLL=8,TOOL_TYPE_FINGER=1,TOOL_TYPE_MOUSE=3,BUTTON_PRIMARY=1,AXIS_VSCROLL=9,AXIS_HSCROLL=10;
 public static class PointerProperties {public int id,toolType;}
 public static class PointerCoords {public float x,y,pressure,toolMajor,toolMinor,touchMajor,touchMinor;public void setAxisValue(int a,float v){}}
 public int action,source,buttons,type;
 public static MotionEvent obtain(long d,long t,int a,int count,PointerProperties[] p,PointerCoords[] c,int meta,int buttons,float xp,float yp,int device,int edge,int source,int flags){MotionEvent e=new MotionEvent();e.action=a;e.source=source;e.buttons=buttons;e.type=p[0].toolType;return e;}
 public void recycle(){}
 }`,
 "com/igalia/wolvic/BuildConfig.java":`package com.igalia.wolvic;public class BuildConfig {public static boolean NH3D_GAME_HOST=true;}`,
 "com/igalia/wolvic/utils/SystemUtils.java":`package com.igalia.wolvic.utils;public class SystemUtils {public static String createLogtag(Class<?> c){return c.getSimpleName();}}`,
 "com/igalia/wolvic/ui/widgets/Widget.java":`package com.igalia.wolvic.ui.widgets;import android.view.MotionEvent;public interface Widget {default boolean supportsMultipleInputDevices(){return false;}void handleHoverEvent(MotionEvent e);void handleTouchEvent(MotionEvent e);}`,
 "com/igalia/wolvic/ui/widgets/WidgetManagerDelegate.java":`package com.igalia.wolvic.ui.widgets;public interface WidgetManagerDelegate {void triggerHapticFeedback(int id);}`,
 "com/igalia/wolvic/ui/widgets/WindowWidget.java":`package com.igalia.wolvic.ui.widgets;import android.view.MotionEvent;public class WindowWidget implements Widget {public final java.util.List<MotionEvent> events=new java.util.ArrayList<>();public boolean isNativeContentVisible(){return false;}public void handleHoverEvent(MotionEvent e){events.add(e);}public void handleTouchEvent(MotionEvent e){events.add(e);}}`,
 "PointerEventCheck.java":`import android.view.*;import com.igalia.wolvic.input.MotionEventGenerator;import com.igalia.wolvic.ui.widgets.*;
 public class PointerEventCheck {
 static WidgetManagerDelegate manager=id->{};
 static void send(Widget w,int id,boolean focus,boolean down,float x){MotionEventGenerator.dispatch(manager,w,id,focus,down,x,20);}
 static void check(boolean b,String s){if(!b)throw new AssertionError(s);}
 static long count(WindowWidget w,int a){return w.events.stream().filter(e->e.action==a).count();}
 public static void main(String[] args){
  MotionEventGenerator.gameImmersive=true;
  WindowWidget w=new WindowWidget();Widget outside=new Widget(){public void handleHoverEvent(MotionEvent e){}public void handleTouchEvent(MotionEvent e){}};
  send(w,0,true,false,10);w.events.clear();send(w,0,true,true,10);send(w,0,true,false,10);
  check(count(w,MotionEvent.ACTION_DOWN)==1&&count(w,MotionEvent.ACTION_UP)==1,"one click on first press");
  check(count(w,MotionEvent.ACTION_HOVER_EXIT)==0,"no fake hover exit on press");
  for(MotionEvent e:w.events){check(e.source==InputDevice.SOURCE_MOUSE&&e.type==MotionEvent.TOOL_TYPE_MOUSE,"mouse input throughout");if(e.action==MotionEvent.ACTION_DOWN)check(e.buttons==1,"primary button down");if(e.action==MotionEvent.ACTION_UP)check(e.buttons==0,"button released");}
  send(outside,0,true,false,0);send(w,0,true,false,30);w.events.clear();send(w,0,true,true,30);send(w,0,true,false,30);
  check(count(w,0)==1&&count(w,1)==1&&count(w,10)==0,"first click after leaving and returning");
  send(w,1,false,false,60);w.events.clear();send(w,0,true,true,30);send(w,0,true,false,30);
  check(count(w,10)==0,"other hand cannot inject hover exit into this click");
  w.events.clear();send(w,0,true,true,30);send(w,0,true,true,50);send(w,0,true,false,50);check(count(w,2)==1,"drag remains supported");
  MotionEventGenerator.clearDevices(); MotionEventGenerator.gameImmersive=false; w.events.clear();
  send(w,0,true,false,10);send(w,0,true,true,10);send(w,0,true,true,20);send(w,0,true,false,20);
  check(w.events.stream().filter(e->e.action==0||e.action==1||e.action==2).allMatch(e->e.source==InputDevice.SOURCE_TOUCHSCREEN && e.type==MotionEvent.TOOL_TYPE_FINGER),"flat game uses touch press and drag");
  MotionEventGenerator.clearDevices();com.igalia.wolvic.BuildConfig.NH3D_GAME_HOST=false;w.events.clear();send(w,0,true,false,10);send(w,0,true,true,10);send(w,0,true,false,10);
  check(w.events.stream().filter(e->e.action==0).allMatch(e->e.source==InputDevice.SOURCE_TOUCHSCREEN),"non-host touch behavior retained");
  System.out.println("PASS: first click, re-entry, mouse buttons, other-hand isolation, drag, non-host behavior");
 }
 }`
};
const files=[];
for(const [name,source] of Object.entries(sources)){const file=path.join(temp,name);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,source);files.push(file);}
const classes=path.join(temp,"classes");mkdirSync(classes,{recursive:true});
const java=process.env.JAVA_HOME??"C:/Program Files/Android/Android Studio/jbr";
const generator=path.join(root,"quest/runtime/wolvic/app/src/common/shared/com/igalia/wolvic/input/MotionEventGenerator.java");
execFileSync(path.join(java,"bin/javac.exe"),["-d",classes,...files,generator],{stdio:"inherit",windowsHide:true});
execFileSync(path.join(java,"bin/java.exe"),["-cp",classes,"PointerEventCheck"],{stdio:"inherit",windowsHide:true});
