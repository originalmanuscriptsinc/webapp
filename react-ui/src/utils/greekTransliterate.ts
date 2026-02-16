/**
 * Transliterates polytonic Greek text into a Latin-script phonetic pronunciation.
 * Handles diphthongs, breathing marks, accents, and special characters.
 */

// Diphthongs must be checked before single vowels
const DIPHTHONGS: [RegExp, string][] = [
    [/αι/gi, 'ai'],
    [/ει/gi, 'ei'],
    [/οι/gi, 'oi'],
    [/υι/gi, 'yi'],
    [/αυ/gi, 'av'],
    [/ευ/gi, 'ev'],
    [/ου/gi, 'ou'],
    [/ηυ/gi, 'iv'],
];

const SINGLE_MAP: Record<string, string> = {
    // Vowels
    'α': 'a', 'ά': 'á', 'ὰ': 'à', 'ᾶ': 'â', 'ἀ': 'a', 'ἁ': 'ha', 'ἄ': 'á', 'ἅ': 'há',
    'ἂ': 'à', 'ἃ': 'hà', 'ἆ': 'â', 'ἇ': 'hâ', 'ᾳ': 'a', 'ᾴ': 'á', 'ᾲ': 'à', 'ᾷ': 'â',
    'ᾀ': 'a', 'ᾁ': 'ha', 'ᾄ': 'á', 'ᾅ': 'há', 'ᾂ': 'à', 'ᾃ': 'hà', 'ᾆ': 'â', 'ᾇ': 'hâ',

    'ε': 'e', 'έ': 'é', 'ὲ': 'è', 'ἐ': 'e', 'ἑ': 'he', 'ἔ': 'é', 'ἕ': 'hé', 'ἒ': 'è', 'ἓ': 'hè',

    'η': 'ē', 'ή': 'ḗ', 'ὴ': 'ḕ', 'ῆ': 'ê', 'ἠ': 'ē', 'ἡ': 'hē', 'ἤ': 'ḗ', 'ἥ': 'hḗ',
    'ἢ': 'ḕ', 'ἣ': 'hḕ', 'ἦ': 'ê', 'ἧ': 'hê', 'ῃ': 'ē', 'ῄ': 'ḗ', 'ῂ': 'ḕ', 'ῇ': 'ê',
    'ᾐ': 'ē', 'ᾑ': 'hē', 'ᾔ': 'ḗ', 'ᾕ': 'hḗ', 'ᾒ': 'ḕ', 'ᾓ': 'hḕ', 'ᾖ': 'ê', 'ᾗ': 'hê',

    'ι': 'i', 'ί': 'í', 'ὶ': 'ì', 'ῖ': 'î', 'ἰ': 'i', 'ἱ': 'hi', 'ἴ': 'í', 'ἵ': 'hí',
    'ἲ': 'ì', 'ἳ': 'hì', 'ἶ': 'î', 'ἷ': 'hî', 'ϊ': 'i', 'ΐ': 'í', 'ῒ': 'ì', 'ῗ': 'î',

    'ο': 'o', 'ό': 'ó', 'ὸ': 'ò', 'ὀ': 'o', 'ὁ': 'ho', 'ὄ': 'ó', 'ὅ': 'hó', 'ὂ': 'ò', 'ὃ': 'hò',

    'υ': 'y', 'ύ': 'ý', 'ὺ': 'ỳ', 'ῦ': 'ŷ', 'ὐ': 'y', 'ὑ': 'hy', 'ὔ': 'ý', 'ὕ': 'hý',
    'ὒ': 'ỳ', 'ὓ': 'hỳ', 'ὖ': 'ŷ', 'ὗ': 'hŷ', 'ϋ': 'y', 'ΰ': 'ý', 'ῢ': 'ỳ', 'ῧ': 'ŷ',

    'ω': 'ō', 'ώ': 'ṓ', 'ὼ': 'ṑ', 'ῶ': 'ô', 'ὠ': 'ō', 'ὡ': 'hō', 'ὤ': 'ṓ', 'ὥ': 'hṓ',
    'ὢ': 'ṑ', 'ὣ': 'hṑ', 'ὦ': 'ô', 'ὧ': 'hô', 'ῳ': 'ō', 'ῴ': 'ṓ', 'ῲ': 'ṑ', 'ῷ': 'ô',
    'ᾠ': 'ō', 'ᾡ': 'hō', 'ᾤ': 'ṓ', 'ᾥ': 'hṓ', 'ᾢ': 'ṑ', 'ᾣ': 'hṑ', 'ᾦ': 'ô', 'ᾧ': 'hô',

    // Consonants
    'β': 'v', 'γ': 'g', 'δ': 'd', 'ζ': 'z', 'θ': 'th', 'κ': 'k', 'λ': 'l', 'μ': 'm',
    'ν': 'n', 'ξ': 'x', 'π': 'p', 'ρ': 'r', 'ῥ': 'rh', 'ῤ': 'r',
    'σ': 's', 'ς': 's', 'τ': 't', 'φ': 'ph', 'χ': 'ch', 'ψ': 'ps',

    // Digraphs - gamma before velars
    // handled separately below

    // Punctuation
    '·': ';', ';': '?',
};

// Gamma before gamma/kappa/xi/chi = 'n'
const GAMMA_NASALS = new Set(['γ', 'κ', 'ξ', 'χ']);

export function transliterateGreek(text: string): string {
    // Normalize to NFC
    let s = text.normalize('NFC');

    // Remove editorial marks (⸀ ⸁ ⸂ ⸃ etc.)
    s = s.replace(/[⸀⸁⸂⸃⸄⸅⸆⸇⸈⸉⸊⸋⸌⸍⸎⸏]/g, '');

    // Process diphthongs first (case-insensitive)
    for (const [pattern, replacement] of DIPHTHONGS) {
        s = s.replace(pattern, (match) => {
            // Preserve capitalization of first letter
            if (match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase()) {
                return replacement.charAt(0).toUpperCase() + replacement.slice(1);
            }
            return replacement;
        });
    }

    // Process character by character
    let result = '';
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        const lower = ch.toLowerCase();

        // Handle gamma nasals
        if (lower === 'γ' && i + 1 < s.length && GAMMA_NASALS.has(s[i + 1].toLowerCase())) {
            result += ch === ch.toUpperCase() && ch !== ch.toLowerCase() ? 'N' : 'n';
            continue;
        }

        const mapped = SINGLE_MAP[lower];
        if (mapped !== undefined) {
            // Preserve capitalization
            if (ch === ch.toUpperCase() && ch !== ch.toLowerCase()) {
                result += mapped.charAt(0).toUpperCase() + mapped.slice(1);
            } else {
                result += mapped;
            }
        } else {
            // Pass through spaces, punctuation, numbers, already-Latin chars
            result += ch;
        }
    }

    return result;
}
