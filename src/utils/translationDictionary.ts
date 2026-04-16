/**
 * Custom translation dictionary for terms that Google Translate gets wrong
 */

export const translationDictionary: Record<string, Record<string, string>> = {
  // English -> Other Languages
  "All-in-one platform": {
    "nl": "Alles-in-één platform",
    "de": "Alles-in-One-Plattform", 
    "fr": "Plateforme tout-en-un",
    "es": "Plataforma todo en uno"
  },
  "Exclusive Discounts": {
    "nl": "Exclusieve kortingen",
    "de": "Exklusive Rabatte",
    "fr": "Remises exclusives", 
    "es": "Descuentos exclusivos"
  },
  "Fast Delivery": {
    "nl": "Snelle levering",
    "de": "Schnelle Lieferung",
    "fr": "Livraison rapide",
    "es": "Entrega rápida"
  },
  "Complete Assessment": {
    "nl": "Volledige beoordeling",
    "de": "Vollständige Bewertung",
    "fr": "Évaluation complète",
    "es": "Evaluación completa"
  },
  "AI Analysis": {
    "nl": "AI-analyse",
    "de": "KI-Analyse",
    "fr": "Analyse IA",
    "es": "Análisis de IA"
  },
  "Receive & Thrive": {
    "nl": "Ontvang & Bloei",
    "de": "Erhalten & Gedeihen",
    "fr": "Recevez & Prospérez",
    "es": "Reciba & Prospera"
  },
  "Members transformed": {
    "nl": "Leden getransformeerd",
    "de": "Mitglieder umgewandelt",
    "fr": "Membres transformés",
    "es": "Miembros transformados"
  },
  "Avg. satisfaction score": {
    "nl": "Gem. tevredenheidsscore",
    "de": "Durchschn. Zufriedenheitswert",
    "fr": "Score de satisfaction moyenne",
    "es": "Puntuación de satisfacción promedio"
  },
  "Science-backed": {
    "nl": "Wetenschappelijk onderbouwd",
    "de": "Wissenschaftlich fundiert",
    "fr": "Soutenu par la science",
    "es": "Con respaldo científico"
  },
  "wellness solutions": {
    "nl": "Welzijnsoplossingen",
    "de": "Wellness-Lösungen",
    "fr": "solutions de bien-être",
    "es": "soluciones de bienestar"
  },
  "Terms of Service": {
    "nl": "Servicevoorwaarden",
    "de": "Nutzungsbedingungen",
    "fr": "Conditions d'utilisation",
    "es": "Términos de servicio"
  }
};

/**
 * Get custom translation if available, otherwise return null
 */
export function getCustomTranslation(englishText: string, targetLang: string): string | null {
  return translationDictionary[englishText]?.[targetLang] || null;
}

/**
 * Check if text has custom translation available
 */
export function hasCustomTranslation(englishText: string, targetLang: string): boolean {
  return !!translationDictionary[englishText]?.[targetLang];
}
