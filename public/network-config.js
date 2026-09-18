/* Optional deployment configuration. Leave empty to use the free PeerJS signaling service.
   The game uses data channels only; no camera, microphone, or account is required.
   For an approved private deployment, set peer to your own PeerServer options.
   Example: { peer: {host:'signal.example.org', port:443, path:'/peer', secure:true},
              iceServers: [{urls:'stun:stun.l.google.com:19302'}] }
   TURN credentials here are PUBLIC. Use short-lived credentials from your own service.
*/
window.YOLK_NETWORK = {};
