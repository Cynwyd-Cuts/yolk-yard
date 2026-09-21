import * as THREE from "three";
import { NO_EYEWEAR } from "./data.js";

export function optionProfile(key, value) {
  return {color: "#fff6da", accent: "#3d8ce8", hat: 0, pattern: 0, finish: 0, eyewear: NO_EYEWEAR, [key]: value};
}

export function patternedShell(profile) {
  const finish = profile.finish || 0;
  const material = new THREE.MeshStandardMaterial({
    color: profile.color || "#fff6da",
    roughness: [0.42, 0.95, 0.12, 0.28][finish] ?? 0.42,
    metalness: finish === 3 ? 0.65 : 0,
  });
  if (!profile.pattern) return material;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = profile.color || "#fff6da";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = profile.accent || "#f9b74a";
  ctx.strokeStyle = ctx.fillStyle;
  switch (profile.pattern) {
    case 1: for (let y=0;y<256;y+=48) ctx.fillRect(0,y,256,18); break;
    case 2: for(let x=16;x<256;x+=48) for(let y=16;y<256;y+=48) {ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.fill();} break;
    case 3: for(let x=0;x<8;x++) for(let y=0;y<8;y++) if((x+y)%2===0) ctx.fillRect(x*32,y*32,32,32); break;
    case 4: for(let i=0;i<70;i++) {ctx.save();ctx.translate((i*73)%256,(i*97)%256);ctx.rotate(i);ctx.fillRect(-3,-6,6,12);ctx.restore();} break;
    case 5: for(let x=0;x<256;x+=64) {ctx.beginPath();ctx.moveTo(x+35,20);ctx.lineTo(x+10,135);ctx.lineTo(x+30,135);ctx.lineTo(x+15,235);ctx.lineTo(x+58,100);ctx.lineTo(x+36,100);ctx.closePath();ctx.fill();} break;
    case 6: for(let x=24;x<256;x+=64) for(let y=28;y<256;y+=64) {ctx.beginPath();for(let j=0;j<10;j++){const a=j*Math.PI/5-Math.PI/2,r=j%2?6:15;ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r);}ctx.closePath();ctx.fill();} break;
    case 7: ctx.fillRect(0,128,256,128); break;
    case 8: ctx.lineWidth=12; for(let y=-20;y<300;y+=45){ctx.beginPath();for(let x=0;x<=256;x+=4)ctx.lineTo(x,y+Math.sin(x*Math.PI/64)*12);ctx.stroke();} break;
    case 9: for(let x=0;x<256;x+=48)for(let y=0;y<256;y+=48){ctx.beginPath();ctx.moveTo(x+24,y);ctx.lineTo(x+40,y+24);ctx.lineTo(x+24,y+48);ctx.lineTo(x+8,y+24);ctx.closePath();ctx.fill();} break;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  material.color.set("#ffffff");
  material.map = texture;
  return material;
}

export function addHeadwear(group, profile, {ball, block, cylinder, mat}) {
  const h=profile.hat, c=profile.accent || "#f9b74a", dark=0x273345;
  const cone=(x,y,z,r,height,color=c)=>{const m=new THREE.Mesh(new THREE.ConeGeometry(r,height,24),mat(color));m.position.set(x,y,z);group.add(m);return m;};
  const ring=(x,y,z,r,t,color=c)=>{const m=new THREE.Mesh(new THREE.TorusGeometry(r,t,12,40),mat(color));m.position.set(x,y,z);m.rotation.x=Math.PI/2;group.add(m);return m;};
  if(h===5){cylinder(group,0,1.58,0,.43,.055,dark);cylinder(group,0,1.85,0,.27,.5,dark);cylinder(group,0,1.67,0,.276,.1,c);}
  if(h===6){ball(group,0,1.57,0,.35,.25,.35,c);ring(0,1.5,0,.32,.055,c);ball(group,0,1.86,0,.09,.09,.09,c);}
  if(h===7){cylinder(group,0,1.57,0,.43,.045,c);cone(0,1.94,0,.3,.74);ball(group,0,2.32,0,.05,.05,.05,0xffe45e);}
  if(h===8){const brim=cylinder(group,0,1.58,0,.5,.06,c);brim.scale.z=.8;ball(group,0,1.76,0,.28,.23,.24,c);ring(0,1.64,0,.27,.03,dark);}
  if(h===9){cone(0,1.93,0,.28,.7);for(let i=0;i<3;i++)ball(group,0,1.72+i*.16,-.2+i*.045,.04,.04,.04,0xffffff);ball(group,0,2.31,0,.08,.08,.08,0xffffff);}
  if(h===10){ring(0,1.91,0,.34,.04,0xffdc59);}
  if(h===11){for(const x of [-.17,.17]){const ear=ball(group,x,1.94,0,.10,.4,.09,c);ear.rotation.z=-x;ball(group,x,1.96,-.073,.05,.27,.025,0xefb4df);}}
  if(h===12){for(const x of [-.24,.24]){const ear=cone(x,1.75,0,.16,.36);ear.rotation.z=-x;cone(x,1.75,-.07,.09,.23,0xefb4df);}}
  if(h===13){cylinder(group,0,1.65,0,.28,.25,0xffffff);for(const x of [-.18,0,.18])ball(group,x,1.91,0,.20,.20,.23,0xffffff);}
  if(h===14){const m=ball(group,.07,1.62,0,.39,.12,.34,c);m.rotation.z=-.2;cylinder(group,.08,1.77,0,.024,.07,dark);}
  if(h===15){cylinder(group,0,1.84,0,.022,.42,dark);ball(group,0,2.08,0,.12,.12,.12,c);}
  if(h===16){cylinder(group,0,1.79,0,.025,.3,0x45b979);for(let i=0;i<7;i++){const a=i*Math.PI*2/7;ball(group,Math.cos(a)*.15,1.99+Math.sin(a)*.15,-.01,.10,.10,.05,c);}ball(group,0,1.99,-.07,.09,.09,.055,0xffe45e);}
  if(h===17){ball(group,0,1.55,0,.35,.24,.34,0xb9ccd4);for(const x of [-.4,.4]){const horn=cone(x,1.72,0,.1,.35,0xfff6da);horn.rotation.z=-Math.sign(x)*.55;}}
  if(h===18){const brim=cylinder(group,0,1.58,0,.43,.09,dark,3);brim.rotation.y=Math.PI;ball(group,0,1.65,0,.28,.19,.24,dark);block(group,0,1.67,-.26,.15,.08,.02,c);}
  if(h===19){ball(group,0,1.57,0,.33,.18,.32,c);cylinder(group,0,1.85,0,.025,.24,dark);block(group,0,1.98,0,.8,.025,.10,0xff637e);block(group,0,1.99,0,.10,.025,.8,0x3d8ce8);ball(group,0,2,0,.06,.06,.06,0xffe45e);}
}

export function addEyewear(group, profile, {block, ball, mat}) {
  if (profile.eyewear === NO_EYEWEAR) return;
  const style=profile.eyewear||0, c=profile.accent||"#f9b74a", dark=0x263e4c;
  if(style===0){block(group,0,1.04,-.403,.66,.22,.13,dark);block(group,0,1.065,-.48,.54,.11,.025,0x62d5e3);block(group,-.2,1.095,-.501,.13,.021,.011,0xeafff1);return;}
  if(style===3){block(group,0,1.04,-.43,.61,.2,.10,c);block(group,0,1.055,-.49,.49,.07,.025,0xff637e);return;}
  for(const x of [-.18,.18]){
    if(style===1){const ring=new THREE.Mesh(new THREE.TorusGeometry(.13,.03,12,32),mat(c));ring.position.set(x,1.05,-.46);group.add(ring);ball(group,x,1.05,-.455,.105,.105,.035,0x62d5e3);}
    if(style===2){block(group,x,1.05,-.46,.28,.16,.05,dark);block(group,x-.04,1.09,-.49,.09,.025,.01,0xb9ccd4);}
    if(style===4){block(group,x,1.05,-.455,.28,.22,.045,c);block(group,x,1.05,-.485,.21,.15,.02,0x80eacb);}
    if(style===5){const shape=new THREE.Shape();for(let j=0;j<10;j++){const a=j*Math.PI/5+Math.PI/2,r=j%2?.065:.16;const px=Math.cos(a)*r,py=Math.sin(a)*r;if(j===0)shape.moveTo(px,py);else shape.lineTo(px,py);}shape.closePath();const m=new THREE.Mesh(new THREE.ShapeGeometry(shape),new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide}));m.userData.ownedMaterial=true;m.position.set(x,1.05,-.49);group.add(m);ball(group,x,1.05,-.51,.052,.052,.015,dark);}
  }
  block(group,0,1.06,-.48,.13,.03,.03,dark);
}
