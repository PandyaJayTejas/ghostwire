const nacl = require('tweetnacl');
const naclUtil = require('tweetnacl-util');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const IDENTITY_FILE = 'identity.json';

function getIdentityPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, IDENTITY_FILE);
}

/**
 * Generate a new Ed25519 signing keypair and X25519 encryption keypair
 */
function generateIdentity() {
  // Ed25519 for signing / device identity
  const signingKeypair = nacl.sign.keyPair();

  // X25519 for encryption key exchange
  const encryptionKeypair = nacl.box.keyPair();

  return {
    signing: {
      publicKey: naclUtil.encodeBase64(signingKeypair.publicKey),
      secretKey: naclUtil.encodeBase64(signingKeypair.secretKey),
    },
    encryption: {
      publicKey: naclUtil.encodeBase64(encryptionKeypair.publicKey),
      secretKey: naclUtil.encodeBase64(encryptionKeypair.secretKey),
    },
    fingerprint: generateFingerprint(signingKeypair.publicKey),
    createdAt: Date.now(),
  };
}

/**
 * Create a short human-readable fingerprint from public key
 */
function generateFingerprint(publicKeyBytes) {
  // Take first 8 bytes of public key, format as hex pairs
  const bytes = publicKeyBytes.slice(0, 8);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  // Format: XXXX-XXXX-XXXX-XXXX
  return hex.match(/.{4}/g).join('-').toUpperCase();
}

/**
 * Load existing identity or create a new one
 */
function loadOrCreateIdentity() {
  const identityPath = getIdentityPath();

  try {
    if (fs.existsSync(identityPath)) {
      const data = fs.readFileSync(identityPath, 'utf-8');
      const identity = JSON.parse(data);
      console.log(`[Identity] Loaded existing identity: ${identity.fingerprint}`);
      return identity;
    }
  } catch (err) {
    console.error('[Identity] Failed to load identity, generating new one:', err.message);
  }

  // Generate new identity
  const identity = generateIdentity();
  saveIdentity(identity);
  console.log(`[Identity] Generated new identity: ${identity.fingerprint}`);
  return identity;
}

/**
 * Save identity to disk
 */
function saveIdentity(identity) {
  const identityPath = getIdentityPath();
  const dir = path.dirname(identityPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(identityPath, JSON.stringify(identity, null, 2), 'utf-8');
}

/**
 * Get public identity info (safe to share)
 */
function getPublicIdentity(identity) {
  return {
    signingPublicKey: identity.signing.publicKey,
    encryptionPublicKey: identity.encryption.publicKey,
    fingerprint: identity.fingerprint,
    createdAt: identity.createdAt,
  };
}

module.exports = {
  generateIdentity,
  generateFingerprint,
  loadOrCreateIdentity,
  saveIdentity,
  getPublicIdentity,
};
