// Browser-host capabilities that the bundled game does not use.
export const excludedStorePermissions = [
  'android.permission.REQUEST_INSTALL_PACKAGES',
  'android.permission.QUERY_ALL_PACKAGES',
  'com.oculus.permission.EYE_TRACKING',
  'android.permission.RECORD_AUDIO',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.BLUETOOTH_SCAN',
  'android.permission.BLUETOOTH_CONNECT',
  'android.permission.BLUETOOTH_ADVERTISE',
  'android.permission.POST_NOTIFICATIONS',
];

/** Validate aapt's decoded binary manifest, including intent-filter ownership. */
function decodeXmlTree(tree) {
  const stack=[], nodes=[];
  for(const line of tree.split(/\r?\n/)) {
    const element=line.match(/^(\s*)E: ([\w-]+)/);
    if(element) {
      const indent=element[1].length;
      while(stack.length && stack.at(-1).indent>=indent) stack.pop();
      const node={name:element[2],indent,attributes:{},children:[],text:''};
      stack.at(-1)?.children.push(node);nodes.push(node);stack.push(node);
    } else {
      const attribute=line.match(/^\s*A: (?:android:)?([\w]+)(?:\([^)]*\))?=(.*)$/);
      if(attribute&&stack.length) stack.at(-1).attributes[attribute[1]]=attribute[2].match(/^"([^"]*)"/)?.[1]??attribute[2];
      const text=line.match(/^\s*T: (.*)$/);
      if(text&&stack.length) stack.at(-1).text+=text[1].trim().replace(/^"|"$/g,'');
    }
  }
  return nodes;
}

export function assertStoreManifest(tree) {
  const nodes=decodeXmlTree(tree);
  const app=nodes.find(n=>n.name==='application');
  if(!app) throw new Error('Cannot read APK application manifest.');
  const debug=app.attributes.debuggable;
  if(debug && debug!=='false' && !/^\(type 0x12\)0x0$/.test(debug)) throw new Error('Store APK must not be debuggable.');
  for (const name of ['allowBackup', 'fullBackupContent', 'usesCleartextTraffic']) {
    const value = app.attributes[name];
    if (value !== 'false' && value !== '(type 0x12)0x0') throw new Error(`Store APK must explicitly set ${name}=false.`);
  }
  if (!app.attributes.networkSecurityConfig) throw new Error('Missing network security configuration.');
  const permissions=nodes.filter(n=>n.name.startsWith('uses-permission')).map(n=>n.attributes.name);
  for(const p of excludedStorePermissions) if(permissions.includes(p)) throw new Error('Unsupported store permission: '+p);
  if(!nodes.some(n=>n.name==='intent-filter'&&n.children.some(c=>c.name==='action'&&c.attributes.name==='android.intent.action.MAIN')&&n.children.some(c=>c.name==='category'&&c.attributes.name==='com.oculus.intent.category.VR'))) throw new Error('Missing MAIN/VR launch intent filter.');
  if(app.attributes.label!=='NetHack 3D') throw new Error('Incorrect app name in store manifest.');
  if(!app.attributes.description) throw new Error('Missing Android app description.');
  return app.attributes.networkSecurityConfig;
}

export function networkSecurityResource(resources) {
  const match=resources.match(/^\s*resource (0x[0-9a-f]+) [^\r\n]*:xml\/nh3d_network_security_config:[^\r\n]*\r?\n\s*\(string(?:8|16)?\) "(res\/[^"\r\n]+)"/mi);
  if(!match) throw new Error('Cannot resolve packaged network security policy.');
  return { reference:'@'+match[1], path:match[2] };
}

export function assertNetworkSecurityPolicy(tree) {
  const nodes=decodeXmlTree(tree);
  const root=nodes.find(n=>n.name==='network-security-config');
  const base=nodes.filter(n=>n.name==='base-config');
  const configs=nodes.filter(n=>n.name==='domain-config');
  const domains=nodes.filter(n=>n.name==='domain');
  const isFalse=v=>v==='false'||v==='(type 0x12)0x0';
  const isTrue=v=>v==='true'||v==='(type 0x12)0xffffffff';
  if(!root || nodes.length!==4 || base.length!==1 || configs.length!==1 || domains.length!==1 ||
     !root.children.includes(base[0]) || !root.children.includes(configs[0]) ||
     !configs[0].children.includes(domains[0]) ||
     !isFalse(base[0].attributes.cleartextTrafficPermitted) ||
     !isTrue(configs[0].attributes.cleartextTrafficPermitted) ||
     !isFalse(domains[0].attributes.includeSubdomains) || domains[0].text!=='127.0.0.1') {
    throw new Error('Network policy must deny cleartext except for 127.0.0.1.');
  }
}

// Release aapt optimization shortens resource filenames. Resolve by resource
// identity rather than assuming the source-tree path survives packaging.
export function geckoConfigResourcePath(resources) {
  const match = resources.match(/^\s*resource [^\r\n]*:raw\/fxr_config:[^\r\n]*\r?\n\s*\(string(?:8|16)?\) "(res\/[^"\r\n]+)"/m);
  if (!match) throw new Error('Cannot resolve packaged Gecko settings resource.');
  return match[1];
}
