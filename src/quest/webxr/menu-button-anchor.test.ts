import {expect,it} from "vitest";
import {menuButtonAnchor} from "./menu-button-anchor";
it("anchors to the top center of the actual invoking button, skipping the full HUD",()=>{
 expect(menuButtonAnchor([[2,.1,.8,.9,.95],[7,0,0,1,1]],{left:400,top:820,width:100,height:50},1000,1000)).toEqual({x:.45,y:.82,pane:2});
});
it("captures Menu within the current Actions modal before that modal closes",()=>{
 expect(menuButtonAnchor([[2,.1,.8,.9,.95],[7,0,0,1,1],[4,.2,.2,.8,.7]],{left:600,top:230,width:100,height:50},1000,1000)).toEqual({x:.65,y:.23,pane:4});
 expect(menuButtonAnchor([],{left:0,top:0,width:100,height:50},1000,1000)).toBeNull();
});
