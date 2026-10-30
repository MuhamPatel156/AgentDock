// Pinned container images registry and verification
export const PINNED_IMAGES = {
 'agentdock-python-web': {
  tag: '0.2.0',
  digest: 'sha256:4b22c7a33e9b2512f45145b410526e8316a3a41e97d1976a165b4c19ef601b02',
  description: 'Verified Python Web and Notebooks sandbox image'
 },
 'agentdock-react-supervisor': {
  tag: '0.2.0',
  digest: 'sha256:9c1a5f6e87b213904a8b7c2d1e0f3456789abcdef0123456789abcdef0123456',
  description: 'Verified React and Node supervisor sandbox image'
 },
 'agentdock-node-web': {
  tag: '0.2.0',
  digest: 'sha256:7f3b2a1c0d4e5f6789abcdef0123456789abcdef0123456789abcdef01234567',
  description: 'Verified Node.js application server image'
 }
};

export function verifyPinnedImage(imageName, imageDigest = null) {
 if (!imageName || typeof imageName !== 'string') throw Error('Image name required.');
 const base = imageName.split(':')[0].trim();
 const pin = PINNED_IMAGES[base];
 if (!pin) {
  return {
   pinned: false,
   allowed: false,
   reason: `Image ${base} is not in the approved pinned images registry.`
  };
 }

 if (imageDigest && pin.digest && imageDigest !== pin.digest) {
  return {
   pinned: true,
   allowed: false,
   reason: `Image ${base} digest mismatch. Expected ${pin.digest}, got ${imageDigest}.`
  };
 }

 return {
  pinned: true,
  allowed: true,
  image: base,
  tag: pin.tag,
  digest: pin.digest
 };
}
