/**
 * Translates a numeric amount into French words.
 * Specifically handles Dinars and Centimes for Algerian billing compliance.
 */

const UNITS = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
const TEENS = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const TENS = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];

// Convert an integer under 100 to words
function convertUnder100(n: number): string {
  if (n < 10) return UNITS[n];
  if (n >= 10 && n < 20) return TEENS[n - 10];
  
  const ten = Math.floor(n / 10);
  const unit = n % 10;
  
  if (ten === 7) { // 70-79: soixante-dix to soixante-dix-neuf
    if (unit === 1) return 'soixante et onze';
    return 'soixante-' + convertUnder100(10 + unit);
  }
  
  if (ten === 8) { // 80-89: quatre-vingt
    if (unit === 0) return 'quatre-vingt';
    return 'quatre-vingt-' + UNITS[unit];
  }
  
  if (ten === 9) { // 90-99: quatre-vingt-dix to quatre-vingt-dix-neuf
    return 'quatre-vingt-' + convertUnder100(10 + unit);
  }
  
  // Standard tens (20, 30, 40, 50, 60)
  if (unit === 0) return TENS[ten];
  if (unit === 1) return TENS[ten] + ' et un';
  return TENS[ten] + '-' + UNITS[unit];
}

// Convert an integer under 1000 to words
function convertUnder1000(n: number): string {
  if (n === 0) return '';
  
  const hundred = Math.floor(n / 100);
  const remainder = n % 100;
  
  let hundredStr = '';
  if (hundred === 1) {
    hundredStr = 'cent';
  } else if (hundred > 1) {
    hundredStr = UNITS[hundred] + ' cent';
    // Add plural 's' if exact hundred (e.g. deux cents)
    if (remainder === 0) {
      hundredStr += 's';
    }
  }
  
  const remainderStr = remainder > 0 ? convertUnder100(remainder) : '';
  
  return (hundredStr + ' ' + remainderStr).trim();
}

// Main recursive function to convert a large integer to words
function integerToWords(n: number): string {
  if (n === 0) return 'zéro';
  
  const chunks: { value: number; label: string; pluralLabel?: string }[] = [
    { value: 1000000000, label: 'milliard', pluralLabel: 'milliards' },
    { value: 1000000, label: 'million', pluralLabel: 'millions' },
    { value: 1000, label: 'mille' },
  ];
  
  let remainder = n;
  let result = '';
  
  for (const chunk of chunks) {
    const quotient = Math.floor(remainder / chunk.value);
    remainder = remainder % chunk.value;
    
    if (quotient > 0) {
      let chunkStr = '';
      if (chunk.value === 1000) {
        // "mille", not "un mille"
        chunkStr = quotient === 1 ? 'mille' : convertUnder1000(quotient) + ' mille';
      } else {
        const label = quotient > 1 && chunk.pluralLabel ? chunk.pluralLabel : chunk.label;
        chunkStr = convertUnder1000(quotient) + ' ' + label;
      }
      
      result += ' ' + chunkStr;
    }
  }
  
  if (remainder > 0) {
    result += ' ' + convertUnder1000(remainder);
  }
  
  return result.trim();
}

/**
 * Converts a price number (e.g., 2792800.50) into French written words.
 * E.g., 2792800.00 -> "Deux millions sept cent quatre-vingt-douze mille huit cent Dinars Algériens"
 */
export function numberToWordsFrench(amount: number): string {
  // Clean inputs
  if (amount === 0) {
    return 'Arrêté la présente facture à la somme de zéro Dinar Algérien';
  }

  // Split integer and decimals
  const parts = amount.toFixed(2).split('.');
  const dinars = parseInt(parts[0], 10);
  const centimes = parseInt(parts[1], 10);
  
  let words = integerToWords(dinars);
  
  // Pluralize Dinars
  const dinarLabel = dinars === 1 ? 'Dinar Algérien' : 'Dinars Algériens';
  words += ' ' + dinarLabel;
  
  // Add centimes if present
  if (centimes > 0) {
    const centimeLabel = centimes === 1 ? 'centime' : 'centimes';
    words += ' et ' + convertUnder100(centimes) + ' ' + centimeLabel;
  }
  
  // Capitalize first letter and prepend compliant accounting phrasing
  const finalSpelling = words.charAt(0).toUpperCase() + words.slice(1);
  return finalSpelling;
}
