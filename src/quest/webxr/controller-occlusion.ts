import * as THREE from "three";
type Triangle = { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; center: THREE.Vector3 };
type Node = { box: THREE.Box3; left?: Node; right?: Node; triangles?: Triangle[] };
function tree(triangles: Triangle[]): Node {
  const box=new THREE.Box3();for(const t of triangles)box.expandByPoint(t.a).expandByPoint(t.b).expandByPoint(t.c);
  if(triangles.length<=12)return {box,triangles};
  const size=box.getSize(new THREE.Vector3());const axis=size.x>size.y&&size.x>size.z?"x":size.y>size.z?"y":"z";
  triangles.sort((a,b)=>a.center[axis]-b.center[axis]);const half=triangles.length>>1;
  return {box,left:tree(triangles.slice(0,half)),right:tree(triangles.slice(half))};
}
/** Model-space AO baked once; no screen buffers or per-frame raycasts. */
export async function bakeControllerOcclusion(scene: THREE.Object3D, signal: AbortSignal): Promise<void> {
  scene.updateMatrixWorld(true);
  const meshes: THREE.Mesh[]=[];let trianglesCount=0;
  scene.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;meshes.push(mesh);trianglesCount+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;});
  // Bound startup work for unexpectedly detailed runtime assets.
  if(trianglesCount>30000)return;
  const triangles: Triangle[]=[], samples:{mesh:THREE.Mesh;positions:THREE.Vector3[];normals:THREE.Vector3[]}[]=[];
  for(const mesh of meshes){
    if(signal.aborted)throw new Error("Controller AO cancelled");
    const geometry=mesh.geometry;if(!geometry.attributes.normal)geometry.computeVertexNormals();
    if((mesh as THREE.SkinnedMesh).isSkinnedMesh)(mesh as THREE.SkinnedMesh).skeleton.update();
    const positions:THREE.Vector3[]=[],normals:THREE.Vector3[]=[], normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    for(let i=0;i<geometry.attributes.position.count;i++){
      positions.push(mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
      normals.push(new THREE.Vector3().fromBufferAttribute(geometry.attributes.normal,i).applyNormalMatrix(normalMatrix));
    }
    const index=geometry.index,count=index?.count??positions.length;
    for(let i=0;i<count;i+=3){const a=positions[index?index.getX(i):i],b=positions[index?index.getX(i+1):i+1],c=positions[index?index.getX(i+2):i+2];triangles.push({a,b,c,center:a.clone().add(b).add(c).multiplyScalar(1/3)});}
    samples.push({mesh,positions,normals});
  }
  if(!triangles.length)return;
  const root=tree(triangles),ray=new THREE.Ray(),hit=new THREE.Vector3(),direction=new THREE.Vector3(),rotation=new THREE.Quaternion(),up=new THREE.Vector3(0,0,1);
  const radius=.014, rays=12, cache=new Map<string,number>();let computed=0;
  function occluded():boolean {
    const stack=[root];
    while(stack.length){const node=stack.pop()!;
      if(!ray.intersectBox(node.box,hit)||(!node.box.containsPoint(ray.origin)&&hit.distanceToSquared(ray.origin)>radius*radius))continue;
      if(node.triangles){for(const t of node.triangles)if(ray.intersectTriangle(t.a,t.b,t.c,false,hit)&&hit.distanceToSquared(ray.origin)<radius*radius)return true;}
      else {stack.push(node.left!,node.right!);}
    }
    return false;
  }
  for(const {mesh,positions,normals} of samples){
    const original=mesh.geometry,colors=original.getAttribute("color"), channels=colors?.itemSize===4?4:3, values=new Float32Array(positions.length*channels);
    for(let i=0;i<positions.length;i++){
      if(signal.aborted)throw new Error("Controller AO cancelled");
      const p=positions[i],n=normals[i];
      const key=`${Math.round(p.x*1000)},${Math.round(p.y*1000)},${Math.round(p.z*1000)},${Math.round(n.x*8)},${Math.round(n.y*8)},${Math.round(n.z*8)}`;
      let shade=cache.get(key);
      if(shade===undefined){
        ray.origin.copy(p).addScaledVector(n,.0004);rotation.setFromUnitVectors(up,n);let blocked=0;
        for(let j=0;j<rays;j++){const r=Math.sqrt((j+.5)/rays),theta=j*2.399963229728653;
          direction.set(r*Math.cos(theta),r*Math.sin(theta),Math.sqrt(1-r*r)).applyQuaternion(rotation);ray.direction.copy(direction);if(occluded())blocked++;
        }
        shade=1-.5*blocked/rays;cache.set(key,shade);
        if(++computed%128===0)await new Promise(resolve=>setTimeout(resolve,0));
      }
      for(let c=0;c<channels;c++)values[i*channels+c]=(colors?colors.getComponent(i,c):1)*(c===3?1:shade);
    }
    // Shared glTF geometry may be used at different transforms. Own each baked
    // color stream; retain skin/morph attributes through BufferGeometry.clone.
    mesh.geometry=original.clone();mesh.geometry.setAttribute("color",new THREE.BufferAttribute(values,channels));
  }
}
