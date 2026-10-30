// QA-only egress guard. Incoming loopback HTTP remains available to the browser.
// Do not import this module into the normal Studio server.
import net from 'node:net';
net.Socket.prototype.connect=function(){throw Error('Outbound connections are disabled in browser QA.');};
globalThis.fetch=async()=>{throw Error('Outbound fetch is disabled in browser QA.');};
