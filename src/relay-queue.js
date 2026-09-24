// Replace superseded movement without dropping action edges, world deltas or events.
export function mergeRelayMessage(previous, next) {
  if (previous?.type !== 'data' || next?.type !== 'data' || previous.channel !== next.channel) return null;
  const a=previous.data, b=next.data;
  if(a?.type==='input' && b?.type==='input') {
    const actions = input => Object.fromEntries(Object.entries(input||{}).filter(([k])=>!['seq','dt','forward','strafe','yaw','pitch'].includes(k)));
    if(JSON.stringify(actions(a.input))===JSON.stringify(actions(b.input)))return next;
  }
  if(a?.type!=='state'||b?.type!=='state'||a.state?.round!==b.state?.round||a.state?.phase!==b.state?.phase)return null;
  const events=new Map();
  for(const event of [...(a.state.events||[]),...(b.state.events||[])])events.set(event.id??JSON.stringify(event),event);
  if(events.size>120)return null;
  const state={...b.state,events:[...events.values()]};
  if(b.state.royale){
    state.royale={...b.state.royale};
    for(const key of ['loot','chests','builds','worldDamage'])if(!(key in state.royale)&&key in (a.state.royale||{}))state.royale[key]=a.state.royale[key];
  }
  return {...next,data:{...b,state,...(b.checkpoint||a.checkpoint?{checkpoint:b.checkpoint||a.checkpoint}:{})}};
}
