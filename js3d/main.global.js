const canvas = document.getElementById('scene');
const loadingEl = document.getElementById('loading');
const stationIndicator = document.getElementById('station-indicator');
const stationNameEl = stationIndicator.querySelector('.station-name');

const btnUp = document.getElementById('btn-up');
const btnDown = document.getElementById('btn-down');
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnAction = document.getElementById('btn-action');

try {
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x050510, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050510, 30, 140);

  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(12, 9, 16);

  let controls = null;
  if (typeof THREE.OrbitControls === 'function') {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 10;
    controls.maxDistance = 24;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.target.set(0, 2, 0);
  }

  const hemi = new THREE.HemisphereLight(0xb9e6ff, 0x151530, 3.8);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xf8fafc, 3.2);
  dir.position.set(36, 54, 22);
  dir.castShadow = true;
  scene.add(dir);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshStandardMaterial({ color: 0x101025, roughness: 0.9 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(160, 32, 0x3b82f6, 0x1e293b);
  grid.material.opacity = 0.2;
  grid.material.transparent = true;
  grid.position.y = 0.01;
  scene.add(grid);

  function ring(r) {
    const pts = [];
    for (var i = 0; i <= 24; i++) {
      var a = (i/24)*Math.PI*2;
      pts.push(new THREE.Vector3(Math.cos(a)*r, 0.02, Math.sin(a)*r));
    }
    var curve = new THREE.CatmullRomCurve3(pts, true);
    var t = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 2, 12, true), new THREE.MeshStandardMaterial({color:0x1f2937, emissive:0x0f172a}));
    t.receiveShadow = true;
    scene.add(t);
  }
  ring(22); ring(34);

  const car = new THREE.Group();
  var ch = new THREE.Mesh(new THREE.BoxGeometry(2.4,0.7,4.2), new THREE.MeshStandardMaterial({color:0x6ee7ff, emissive:0x0ea5e9, emissiveIntensity:0.35}));
  ch.position.y=0.8; ch.castShadow=true; car.add(ch);
  var cab = new THREE.Mesh(new THREE.BoxGeometry(2,0.6,2.2), new THREE.MeshStandardMaterial({color:0xe2e8f0, transparent:true, opacity:0.9}));
  cab.position.y=1.4; cab.position.z=-0.1; cab.castShadow=true; car.add(cab);
  const wheels=[];
  var wg=new THREE.CylinderGeometry(0.48,0.48,0.36,16), wm=new THREE.MeshStandardMaterial({color:0x0f172a});
  [[-1.3,0.48,1.5],[1.3,0.48,1.5],[-1.3,0.48,-1.4],[1.3,0.48,-1.4]].forEach(function(p){var w=new THREE.Mesh(wg,wm); w.rotation.z=Math.PI/2; w.position.set(p[0],p[1],p[2]); w.castShadow=true; wheels.push(w); car.add(w);});
  car.position.set(0,0,26);
  car.rotation.y=Math.PI;
  scene.add(car);

  const stations = [
    {name:'LinkedIn Station', url:'https://www.linkedin.com/in/peter-yastreboff-6a9664313/', a:0, r:22, c:0x0ea5e9},
    {name:'Portfolio Station', url:'https://petery.is-a.dev/', a:Math.PI, r:34, c:0xa78bfa},
  ];
  const sg = new THREE.Group();
  stations.forEach(function(st){
    var g=new THREE.Group();
    var x=Math.cos(st.a)*st.r, z=Math.sin(st.a)*st.r;
    var pad=new THREE.Mesh(new THREE.CylinderGeometry(4,4,0.18,24), new THREE.MeshStandardMaterial({color:0x0f172a, emissive:st.c, emissiveIntensity:0.22}));
    pad.position.y=0.09; pad.receiveShadow=true; g.add(pad);
    var ringg=new THREE.Mesh(new THREE.RingGeometry(4.4,4.8,36), new THREE.MeshBasicMaterial({color:st.c, side:THREE.DoubleSide}));
    ringg.rotation.x=-Math.PI/2; ringg.position.y=0.2; g.add(ringg);
    var tow=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.8,5,12), new THREE.MeshStandardMaterial({color:0x1e293b, emissive:st.c, emissiveIntensity:0.16}));
    tow.position.y=2.7; tow.castShadow=true; g.add(tow);
    var be=new THREE.Mesh(new THREE.OctahedronGeometry(1,0), new THREE.MeshStandardMaterial({color:st.c, emissive:st.c, emissiveIntensity:0.8}));
    be.position.y=6; be.castShadow=true; g.add(be);
    g.position.set(x,0,z); g.lookAt(0,0,0); g.userData=st; sg.add(g);
  });
  scene.add(sg);

  var keys=new Set(), mob={up:false,down:false,left:false,right:false,action:false};
  window.addEventListener('keydown',function(e){ keys.add(e.code); if(e.code==='KeyE') tryInt(); });
  window.addEventListener('keyup',function(e){ keys.delete(e.code); });
  function bind(b,k){ if(!b)return; var setv=function(v){mob[k]=v; if(v&&k==='action') tryInt();}; b.addEventListener('touchstart',function(e){e.preventDefault();setv(true);},{passive:false}); b.addEventListener('touchend',function(e){e.preventDefault();setv(false);},{passive:false}); b.addEventListener('mousedown',function(){setv(true);}); b.addEventListener('mouseup',function(){setv(false);}); b.addEventListener('mouseleave',function(){setv(false);}); }
  bind(btnUp,'up'); bind(btnDown,'down'); bind(btnLeft,'left'); bind(btnRight,'right'); bind(btnAction,'action');

  var near=null;
  function tryInt(){ if(near && near.url) window.open(near.url,'_blank','noopener,noreferrer'); }
  var speed=0, max=22, acc=30, fri=14, turn=2.0;
  var clock=new THREE.Clock();
  setTimeout(function(){ if(loadingEl) loadingEl.classList.add('hidden'); }, 300);

  function anim(){
    requestAnimationFrame(anim);
    var dt=Math.min(clock.getDelta(),0.033);
    var f=keys.has('KeyW')||keys.has('ArrowUp')||mob.up;
    var b=keys.has('KeyS')||keys.has('ArrowDown')||mob.down;
    var l=keys.has('KeyA')||keys.has('ArrowLeft')||mob.left;
    var r=keys.has('KeyD')||keys.has('ArrowRight')||mob.right;
    if(f&&!b) speed+=acc*dt; else if(b&&!f) speed-=acc*dt; else { if(speed>0)speed-=fri*dt; if(speed<0)speed+=fri*dt; }
    if(speed>max)speed=max; if(speed<-max*0.35)speed=-max*0.35;
    if(Math.abs(speed)>0.01){ var d=speed>0?1:-1; if(l) car.rotation.y+=turn*dt*d; if(r) car.rotation.y-=turn*dt*d; }
    var vdir=new THREE.Vector3(Math.sin(car.rotation.y),0,Math.cos(car.rotation.y));
    car.position.addScaledVector(vdir,speed*dt); car.position.y=0;
    if(controls){ controls.target.lerp(car.position.clone().add(new THREE.Vector3(0,2,0)),0.12); controls.update(); }
    var c=null, dist=999;
    for(var i=0;i<sg.children.length;i++){ var gs=sg.children[i]; var dd=gs.position.distanceTo(car.position); if(dd<dist){dist=dd;c=gs;} }
    if(dist<8 && c){ near=c.userData; stationNameEl.textContent=near.name; stationIndicator.classList.remove('hidden'); }
    else { near=null; stationIndicator.classList.add('hidden'); }
    var t=clock.getElapsedTime();
    for(var j=0;j<sg.children.length;j++){ var gg=sg.children[j]; if(gg.children[2]) gg.children[2].rotation.y=t*0.7+j; if(gg.children[1]) gg.children[1].rotation.z=t*0.3; }
    for(var w=0;w<wheels.length;w++){ wheels[w].rotation.x+=speed*dt*1.4; }
    renderer.render(scene,camera);
  }
  anim();

  window.addEventListener('resize',function(){ camera.aspect=window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth,window.innerHeight); });
} catch(e) {
  if(loadingEl){ loadingEl.querySelector('.loading-text').textContent='Failed to start'; }
  console.error(e);
}
