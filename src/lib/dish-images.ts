export interface CuratedDishPhoto {
  id: string;
  label: string;
  keywords: string[];
  url: string;
}

export const CURATED_DISH_PHOTOS: CuratedDishPhoto[] = [
  {
    id: "royal-biryani",
    label: "Royal Dum Biryani (Mutton / Chicken)",
    keywords: ["biryani", "dum", "gosht", "chicken biryani", "mutton"],
    url: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "hyderabadi-biryani",
    label: "Zafrani / Hyderabadi Handi Biryani",
    keywords: ["zafrani", "handi", "pulao", "rice", "murgh"],
    url: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "veg-biryani",
    label: "Subz / Vegetable Dum Biryani",
    keywords: ["veg", "vegetable", "subz", "paneer biryani"],
    url: "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "seekh-kebab",
    label: "Charcoal Seekh Kebab Platter",
    keywords: ["seekh", "kebab", "galouti", "shami", "platter", "boti"],
    url: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "reshmi-tikka",
    label: "Tandoori Murgh / Reshmi Tikka",
    keywords: ["reshmi", "tikka", "tandoori", "malai", "tangdi", "afghani"],
    url: "https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "paneer-tikka",
    label: "Paneer Tikka / Hara Bhara",
    keywords: ["paneer", "achari", "hara bhara", "mushroom", "starter"],
    url: "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "shahi-korma",
    label: "Shahi Korma / Butter Chicken",
    keywords: ["korma", "butter", "makhani", "lababdar", "masala", "changezi"],
    url: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "nihari-rogan",
    label: "Nalli Nihari / Mutton Rogan Josh",
    keywords: ["nihari", "rogan", "curry", "gravy", "stew", "haleem", "dal"],
    url: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "garlic-naan",
    label: "Butter Garlic Naan / Tandoori Bread",
    keywords: ["naan", "garlic", "kulcha", "paratha", "sheermal", "bakarkhani"],
    url: "https://images.unsplash.com/photo-1626074353765-517a681e40be?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "roomali-roti",
    label: "Roomali Roti / Tandoori Roti",
    keywords: ["roti", "roomali", "rumali", "bread"],
    url: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "shahi-tukda-phirni",
    label: "Shahi Tukda / Kesari Phirni / Dessert",
    keywords: ["tukda", "phirni", "firni", "gulab", "jamun", "halwa", "kheer", "sweet", "dessert"],
    url: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80",
  },
  {
    id: "shahi-lassi-sharbat",
    label: "Rose Lassi / Shahi Sharbat / Kahwa",
    keywords: ["lassi", "sharbat", "rooh", "chaas", "kahwa", "tea", "chai", "drink", "beverage"],
    url: "https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=800&q=80",
  },
];

export function getSuggestedDishImage(name: string, categorySlug?: string): string {
  const lower = `${name} ${categorySlug || ""}`.toLowerCase();
  if (lower.includes("veg") && lower.includes("biryani")) {
    return CURATED_DISH_PHOTOS[2].url;
  }
  if (lower.includes("paneer") && lower.includes("tikka")) {
    return CURATED_DISH_PHOTOS[5].url;
  }
  if (lower.includes("paneer") || lower.includes("lababdar") || lower.includes("korma") || lower.includes("butter")) {
    return CURATED_DISH_PHOTOS[6].url;
  }
  if (lower.includes("nihari") || lower.includes("rogan") || lower.includes("dal")) {
    return CURATED_DISH_PHOTOS[7].url;
  }
  if (lower.includes("roomali") || lower.includes("rumali") || lower.includes("roti")) {
    return CURATED_DISH_PHOTOS[9].url;
  }
  if (lower.includes("naan") || lower.includes("kulcha") || lower.includes("paratha") || lower.includes("sheermal")) {
    return CURATED_DISH_PHOTOS[8].url;
  }
  if (lower.includes("seekh") || lower.includes("galouti") || lower.includes("shami")) {
    return CURATED_DISH_PHOTOS[3].url;
  }
  if (lower.includes("reshmi") || lower.includes("tikka") || lower.includes("tandoori") || lower.includes("kebab")) {
    return CURATED_DISH_PHOTOS[4].url;
  }
  if (lower.includes("biryani") || lower.includes("pulao")) {
    return CURATED_DISH_PHOTOS[0].url;
  }
  if (lower.includes("phirni") || lower.includes("tukda") || lower.includes("gulab") || lower.includes("dessert")) {
    return CURATED_DISH_PHOTOS[10].url;
  }
  if (lower.includes("lassi") || lower.includes("sharbat") || lower.includes("kahwa") || lower.includes("drink")) {
    return CURATED_DISH_PHOTOS[11].url;
  }
  return CURATED_DISH_PHOTOS[0].url;
}
