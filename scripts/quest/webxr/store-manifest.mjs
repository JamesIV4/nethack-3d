/** Validate aapt's decoded binary manifest, including intent-filter ownership. */
export function assertStoreManifest(tree) {
  const stack=[], nodes=[];
  for(const line of tree.split(/\r?\n/)) {
    const element=line.match(/^(\s*)E: ([\w-]+)/);
    if(element) {
      const indent=element[1].length;
      while(stack.length && stack.at(-1).indent>=indent) stack.pop();
      const node={name:element[2],indent,attributes:{},children:[]};
      stack.at(-1)?.children.push(node);nodes.push(node);stack.push(node);
    } else {
      const attribute=line.match(/^\s*A: (?:android:)?([\w]+)(?:\([^)]*\))?=(.*)$/);
      if(attribute&&stack.length) stack.at(-1).attributes[attribute[1]]=attribute[2].match(/^"([^"]*)"/)?.[1]??attribute[2];
    }
  }
  const app=nodes.find(n=>n.name==='application');
  if(!app) throw new Error('Cannot read APK application manifest.');
  const debug=app.attributes.debuggable;
  if(debug && debug!=='false' && !/^\(type 0x12\)0x0$/.test(debug)) throw new Error('Store APK must not be debuggable.');
  const permissions=nodes.filter(n=>n.name.startsWith('uses-permission')).map(n=>n.attributes.name);
  for(const p of ['android.permission.REQUEST_INSTALL_PACKAGES','android.permission.QUERY_ALL_PACKAGES']) if(permissions.includes(p)) throw new Error('Unsupported store permission: '+p);
  if(permissions.includes('com.oculus.permission.EYE_TRACKING')&&!nodes.some(n=>n.name==='uses-feature'&&n.attributes.name==='oculus.software.eye_tracking')) throw new Error('Eye tracking permission requires its uses-feature declaration.');
  if(!nodes.some(n=>n.name==='intent-filter'&&n.children.some(c=>c.name==='action'&&c.attributes.name==='android.intent.action.MAIN')&&n.children.some(c=>c.name==='category'&&c.attributes.name==='com.oculus.intent.category.VR'))) throw new Error('Missing MAIN/VR launch intent filter.');
  if(app.attributes.label!=='NetHack 3D') throw new Error('Incorrect app name in store manifest.');
  if(!app.attributes.description) throw new Error('Missing Android app description.');
}

// Release aapt optimization shortens resource filenames. Resolve by resource
// identity rather than assuming the source-tree path survives packaging.
export function geckoConfigResourcePath(resources) {
  const match = resources.match(/^\s*resource [^\r\n]*:raw\/fxr_config:[^\r\n]*\r?\n\s*\(string(?:8|16)?\) "(res\/[^"\r\n]+)"/m);
  if (!match) throw new Error('Cannot resolve packaged Gecko settings resource.');
  return match[1];
}
