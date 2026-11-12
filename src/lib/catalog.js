// Product catalog: categories → product types. Edit freely to add more.
export const CATEGORIES = [
  {
    id: 'fragrance',
    label: 'Fragrance',
    icon: '🌿',
    types: ['Attar / Oil Perfume', 'Oud', 'Cologne / EDP', 'Bakhoor / Incense', 'Musk', 'Gift Sets'],
  },
  {
    id: 'clothing',
    label: 'Clothing',
    icon: '🧥',
    types: ['Thobe / Jubba', 'Abaya', 'Jilbab', 'Hijab / Scarf', 'Niqab', 'Kufi / Topi', 'Shemagh / Ghutra', 'Modest Dresses', 'Kurta', 'Kids Clothing', 'Outerwear'],
    hasGender: true,
  },
  {
    id: 'books',
    label: 'Books & Quran',
    icon: '📖',
    types: ['Quran (Mushaf)', 'Quran with Translation', 'Tafsir', 'Hadith', 'Seerah', 'Fiqh', 'Aqeedah', 'Dua & Adhkar', 'Arabic Learning', 'Islamic History', 'Children\'s Books', 'Self-Development'],
    hasLanguage: true,
  },
  {
    id: 'prayer',
    label: 'Prayer Essentials',
    icon: '🕌',
    types: ['Prayer Rug', 'Tasbih / Prayer Beads', 'Miswak', 'Quran Stand (Rehal)', 'Prayer Clothes', 'Qibla Compass'],
  },
  {
    id: 'home',
    label: 'Home & Decor',
    icon: '🏠',
    types: ['Wall Art / Calligraphy', 'Ramadan & Eid Decor', 'Incense Burners', 'Gifts'],
  },
  {
    id: 'accessories',
    label: 'Accessories',
    icon: '💍',
    types: ['Rings', 'Hijab Pins', 'Bags', 'Watches', 'Footwear'],
  },
  {
    id: 'food',
    label: 'Halal Food & Gifts',
    icon: '🌴',
    types: ['Dates', 'Honey', 'Zamzam', 'Sweets', 'Gift Boxes'],
  },
]

export const BOOK_LANGUAGES = ['Arabic', 'English', 'Arabic–English', 'Urdu', 'Somali', 'French', 'Turkish', 'Bengali', 'Other']
export const GENDERS = ['Men', 'Women', 'Kids', 'Unisex']

export const catById = (id) => CATEGORIES.find((c) => c.id === id)

export const formatPrice = (p, currency = 'USD') =>
  p == null || p === '' ? 'Ask seller' : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(p)
