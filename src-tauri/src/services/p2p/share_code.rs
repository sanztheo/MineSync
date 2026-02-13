use libp2p::PeerId;

const SHARE_CODE_PREFIX: &str = "MINE-";
const CODE_ALPHABET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH: usize = 6;

/// Generate a short share code from a PeerId.
///
/// Format: `MINE-XXXXXX` where X is base32-like (no ambiguous chars).
/// The code encodes enough of the PeerId bytes to be unique in practice.
pub fn generate_share_code(peer_id: &PeerId) -> String {
    let bytes = peer_id.to_bytes();
    let encoded: String = bytes
        .iter()
        .take(CODE_LENGTH)
        .map(|b| {
            let idx = (*b as usize) % CODE_ALPHABET.len();
            CODE_ALPHABET[idx] as char
        })
        .collect();

    format!("{SHARE_CODE_PREFIX}{encoded}")
}

/// Decode a share code back to a PeerId.
///
/// For the MVP, share codes are stored in a local mapping rather than
/// being directly decodable. This function validates the format and
/// returns an error with guidance.
///
/// In the real flow, the host stores `code -> (PeerId, relay_addr)`
/// and the joiner looks up the host via a rendezvous or relay.
pub fn decode_share_code(code: &str) -> Result<PeerId, ShareCodeError> {
    let trimmed = code.trim().to_uppercase();

    if !trimmed.starts_with(SHARE_CODE_PREFIX) {
        return Err(ShareCodeError::InvalidFormat(format!(
            "Share code must start with '{SHARE_CODE_PREFIX}', got: {trimmed}"
        )));
    }

    let suffix = &trimmed[SHARE_CODE_PREFIX.len()..];
    if suffix.len() != CODE_LENGTH {
        return Err(ShareCodeError::InvalidFormat(format!(
            "Share code suffix must be {CODE_LENGTH} characters, got: {}",
            suffix.len()
        )));
    }

    // Validate all characters are in the alphabet
    for ch in suffix.chars() {
        if !CODE_ALPHABET.contains(&(ch as u8)) {
            return Err(ShareCodeError::InvalidCharacter(ch));
        }
    }

    // MVP: the code is valid but we need the relay to resolve it
    // Return a placeholder error indicating lookup is needed
    Err(ShareCodeError::RequiresLookup(trimmed))
}

#[derive(Debug, thiserror::Error)]
pub enum ShareCodeError {
    #[error("Invalid share code format: {0}")]
    InvalidFormat(String),

    #[error("Invalid character in share code: '{0}'")]
    InvalidCharacter(char),

    #[error("Share code '{0}' requires relay lookup to resolve PeerId")]
    RequiresLookup(String),
}

#[cfg(test)]
mod tests {
    use super::*;
    use libp2p::identity::Keypair;

    #[test]
    fn share_code_has_correct_format() {
        let keypair = Keypair::generate_ed25519();
        let peer_id = keypair.public().to_peer_id();
        let code = generate_share_code(&peer_id);

        assert!(code.starts_with(SHARE_CODE_PREFIX));
        assert_eq!(code.len(), SHARE_CODE_PREFIX.len() + CODE_LENGTH);
    }

    #[test]
    fn decode_rejects_invalid_prefix() {
        let result = decode_share_code("INVALID-ABC123");
        assert!(result.is_err());
    }

    #[test]
    fn decode_rejects_wrong_length() {
        let result = decode_share_code("MINE-AB");
        assert!(result.is_err());
    }
}
