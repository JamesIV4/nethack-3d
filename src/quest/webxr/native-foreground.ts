import * as THREE from "three";
/** Frame-local foreground mask for the APK compositor. RGB is never modified.
 * World alpha occupies [0,.5]; foreground is 1. Four reserved corner texels
 * identify encoded frames, so legacy frames are never mistaken for masks.
 */
export class NativeForeground {
  private readonly geometry = new THREE.PlaneGeometry(2,2);
  private readonly scale = new THREE.MeshBasicMaterial({opacity:.5,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,blending:THREE.CustomBlending,blendSrc:THREE.ZeroFactor,blendDst:THREE.OneFactor,blendSrcAlpha:THREE.ZeroFactor,blendDstAlpha:THREE.SrcAlphaFactor});
  readonly mask = new THREE.MeshBasicMaterial({transparent:true,depthTest:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,blending:THREE.CustomBlending,blendSrc:THREE.ZeroFactor,blendDst:THREE.OneFactor,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.ZeroFactor});
  private readonly stamp = new THREE.ShaderMaterial({uniforms:{eyeSize:{value:new THREE.Vector2(1,1)}},
    vertexShader:'uniform vec2 eyeSize; varying vec2 uvLocal; void main(){ uvLocal=uv; gl_Position=vec4(vec2(-1.)+uv*vec2(8.,2.)/eyeSize,0.,1.); }',
    fragmentShader:'varying vec2 uvLocal; void main(){ float i=floor(uvLocal.x*4.); float a=i<1.?0.625:i<2.?0.75:i<3.?0.875:0.625; gl_FragColor=vec4(0.,0.,0.,a); }',
    transparent:true,depthTest:false,depthWrite:false,blending:THREE.CustomBlending,blendSrc:THREE.ZeroFactor,blendDst:THREE.OneFactor,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.ZeroFactor});
  private readonly screen = new THREE.Scene();
  private readonly quad = new THREE.Mesh(this.geometry,this.scale as THREE.Material);
  constructor(){
    this.scale.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','gl_Position = vec4(position.xy, 0., 1.);');};
    this.quad.frustumCulled=false;this.screen.add(this.quad);
  }
  begin(renderer:THREE.WebGLRenderer,camera:THREE.Camera):void{this.quad.material=this.scale;renderer.render(this.screen,camera);}
  finish(renderer:THREE.WebGLRenderer,camera:THREE.Camera,scene:THREE.Scene):void{
    const previous=scene.overrideMaterial;
    try{scene.overrideMaterial=this.mask;renderer.render(scene,camera);}finally{scene.overrideMaterial=previous;}
    const viewport=renderer.xr.getCamera().cameras[0]?.viewport;
    if(!viewport)return;
    this.stamp.uniforms.eyeSize.value.set(viewport.z,viewport.w);
    this.quad.material=this.stamp;renderer.render(this.screen,camera);
  }
  dispose():void{this.geometry.dispose();this.scale.dispose();this.mask.dispose();this.stamp.dispose();}
}
