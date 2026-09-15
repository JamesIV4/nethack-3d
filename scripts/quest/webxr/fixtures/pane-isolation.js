import {tableUiPanes} from './src/quest/webxr/table-ui-layout';
const style=document.createElement('style');style.textContent=window.__uiStyles;document.head.append(style);document.documentElement.classList.add('nh3d-webxr-active','nh3d-xr-native-ui');
const assert=(v,m)=>{if(!v)throw Error(m)};
document.body.innerHTML='<div id="stats-bar">Status</div><div class="nh3d-dialog is-visible" style="opacity:1;visibility:visible;display:block"><div style="width:1000px;height:2000px">Inventory</div></div><div class="nh3d-context-menu nh3d-inventory-drop-type-menu" style="opacity:1;visibility:visible;display:block"><button style="width:100px;height:40px">Drop Amount</button></div><div class="nh3d-mobile-bottom-bar"><button class="nh3d-mobile-bottom-button">Inventory</button><button class="nh3d-mobile-bottom-button">Actions</button></div><div class="nh3d-xr-table-controls"><div class="nh3d-xr-table-icons"><button>Area</button><button>Scale</button></div></div>';
const panes=tableUiPanes(false),modal=panes.find(p=>p[0]===4),action=panes.find(p=>p[0]===2),controls=panes.find(p=>p[0]===6);
assert(modal&&action&&controls,'all panes present');assert(modal[4]<action[2],'modal and actions separate');assert(action[4]<controls[2],'actions and scale separate');
const button=document.querySelector('.nh3d-inventory-drop-type-menu button').getBoundingClientRect();assert(Math.abs(button.width-50)<1,'drop submenu half scale');
const c=document.querySelector('.nh3d-xr-table-controls').getBoundingClientRect();assert(c.width<240,'scale container fits icons');
const modalNode=document.querySelector('.nh3d-dialog');
modalNode.innerHTML=Array.from({length:600},(_,i)=>`<label>Option ${i}<button>Change</button><input type="checkbox"></label>`).join('');
const originalStyle=window.getComputedStyle;let styleReads=0;
window.getComputedStyle=(...args)=>{styleReads++;return originalStyle(...args)};
try { tableUiPanes(false); } finally { window.getComputedStyle=originalStyle; }
assert(styleReads<180,'modal measurement should not read styles for every covered control');
window.probePromise=Promise.resolve({panes,dropButtonWidth:button.width,scaleWidth:c.width,largeModalStyleReads:styleReads});
